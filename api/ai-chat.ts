import type { IncomingMessage, ServerResponse } from "node:http";

/* AI proxy for the reading assistant: rotates across every configured Gemini and OpenRouter key.

   Runs as a Vercel Function in production and as dev-server middleware locally (vite.config.ts),
   so the keys only ever live on a server. They come from server-only env vars, which must NOT
   carry the VITE_ prefix (Vite would bundle those into the public JavaScript):

     GEMINI_API_KEY,     GEMINI_API_KEY_1 … _9,     GEMINI_API_KEYS     (comma-separated)
     OPENROUTER_API_KEY, OPENROUTER_API_KEY_1 … _9, OPENROUTER_API_KEYS (comma-separated)
     OPENROUTER_MODELS   optional comma-separated model ids to use instead of the defaults

   Keys of both providers are interleaved and each request starts at the next one in turn, so the
   load (and the free-tier quotas) spread across all of them. A key that is rate-limited, out of
   credit or rejected is rested for a while and the request moves on to the next key. */

type Role = "user" | "assistant" | "system";
interface ChatMessage {
  role: Role;
  content: string;
}
type Env = Record<string, string | undefined>;
type Provider = "gemini" | "openrouter";
interface Slot {
  provider: Provider;
  key: string;
}
type Failure = { ok: false; status: number; message: string; tryNextKey: boolean; tryNextModel: boolean };
type Attempt = { ok: true; reply: string } | Failure;
interface Result {
  status: number;
  body: { reply?: string; error?: string; code?: string };
}

const GEMINI_DEFAULT = "gemini-2.5-flash";
// Google retires model ids; when one 404s the request moves down this list
const GEMINI_FALLBACKS = ["gemini-2.5-flash", "gemini-flash-latest"];
// Free models (checked October 2026). openrouter/free routes to whichever free model is up,
// so the chain keeps working when a named model is retired.
const OPENROUTER_DEFAULTS = ["google/gemma-4-31b-it:free", "qwen/qwen3.8-27b:free", "openrouter/free"];
// Model ids are interpolated into the Gemini URL, so only plain ids are accepted
const GEMINI_MODEL_ID = /^gemini-[a-z0-9.-]+$/;
const OPENROUTER_MODEL_ID = /^[a-z0-9._-]+\/[a-z0-9._:-]+$/i;
const MAX_MESSAGES = 40;
const MAX_CHARS = 60_000;
const MAX_BODY_BYTES = 1_000_000;
const ATTEMPT_TIMEOUT_MS = 25_000;
// Stays inside the function's maxDuration (vercel.json) with room to answer
const TOTAL_BUDGET_MS = 50_000;

// Rotation state lives as long as the function instance stays warm
let cursor = 0;
const restingUntil = new Map<string, number>();
const slotId = (s: Slot) => `${s.provider}:${s.key}`;

function readKeys(env: Env, prefix: string): string[] {
  const listed = (env[`${prefix}S`] ?? "").split(/[\s,]+/);
  const numbered = Array.from({ length: 9 }, (_, i) => env[`${prefix}_${i + 1}`]);
  const all = [env[prefix], ...numbered, ...listed].map((k) => (k ?? "").trim()).filter(Boolean);
  return [...new Set(all)];
}

export function configuredSlots(env: Env): Slot[] {
  const gemini = readKeys(env, "GEMINI_API_KEY").map((key) => ({ provider: "gemini" as const, key }));
  const openrouter = readKeys(env, "OPENROUTER_API_KEY").map((key) => ({ provider: "openrouter" as const, key }));
  // Interleave so consecutive requests alternate providers rather than draining one first
  const out: Slot[] = [];
  for (let i = 0; i < Math.max(gemini.length, openrouter.length); i++) {
    if (gemini[i]) out.push(gemini[i]);
    if (openrouter[i]) out.push(openrouter[i]);
  }
  return out;
}

function slotOrder(slots: Slot[]): Slot[] {
  const start = cursor++ % slots.length;
  const rotated = slots.map((_, i) => slots[(start + i) % slots.length]);
  const now = Date.now();
  const rested = (s: Slot) => (restingUntil.get(slotId(s)) ?? 0) <= now;
  // Resting keys go last rather than being dropped, so a lone key (or all keys resting) is still tried
  return [...rotated.filter(rested), ...rotated.filter((s) => !rested(s))];
}

function restFor(status: number): number {
  if (status === 429) return 60_000; // quota window
  if (status === 400 || status === 401 || status === 402 || status === 403) return 10 * 60_000; // rejected or out of credit
  return 15_000; // upstream hiccup or network
}

function parseInput(input: unknown): { messages: ChatMessage[]; model: string } | { error: string } {
  const body = (input ?? {}) as { messages?: unknown; model?: unknown };
  if (!Array.isArray(body.messages) || body.messages.length === 0) return { error: "messages array is required" };
  const messages: ChatMessage[] = [];
  for (const m of body.messages as { role?: unknown; content?: unknown }[]) {
    if (!m || (m.role !== "user" && m.role !== "assistant" && m.role !== "system") || typeof m.content !== "string") {
      return { error: "each message needs a role (user, assistant, system) and string content" };
    }
    messages.push({ role: m.role, content: m.content });
  }
  // Long conversations drop their oldest turns; the system prompt and book context always stay
  const system = messages.filter((m) => m.role === "system");
  let turns = messages.filter((m) => m.role !== "system").slice(-MAX_MESSAGES);
  const size = (list: ChatMessage[]) => list.reduce((n, m) => n + m.content.length, 0);
  while (turns.length > 1 && size(system) + size(turns) > MAX_CHARS) turns = turns.slice(1);
  if (!turns.length || size(system) + size(turns) > MAX_CHARS) return { error: "message too long" };
  const model = typeof body.model === "string" && GEMINI_MODEL_ID.test(body.model) ? body.model : GEMINI_DEFAULT;
  return { messages: [...system, ...turns], model };
}

/* ---------- providers ---------- */

async function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: controller.signal });
    return { res, data: (await res.json().catch(() => ({}))) as unknown };
  } finally {
    clearTimeout(timer);
  }
}

function networkFailure(e: unknown): Failure {
  const timedOut = e instanceof Error && e.name === "AbortError";
  return { ok: false, status: timedOut ? 504 : 502, message: timedOut ? "timeout" : "network error", tryNextKey: true, tryNextModel: false };
}

function geminiBody(messages: ChatMessage[], model: string) {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  for (const m of messages) {
    if (m.role === "system" || !m.content.trim()) continue;
    const role = m.role === "assistant" ? "model" : "user";
    const last = contents[contents.length - 1];
    // Gemini expects alternating turns
    if (last?.role === role) last.parts.push({ text: m.content });
    else contents.push({ role, parts: [{ text: m.content }] });
  }
  return {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
      // 2.5 models think by default; a reading assistant answers faster and cheaper without it
      ...(model.startsWith("gemini-2.5") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  };
}

async function callGemini(key: string, model: string, messages: ChatMessage[], timeoutMs: number): Promise<Attempt> {
  interface GeminiResponse {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
    error?: { message?: string };
  }
  try {
    const { res, data } = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      { "x-goog-api-key": key },
      geminiBody(messages, model),
      timeoutMs,
    );
    const d = data as GeminiResponse;
    if (res.ok) {
      const candidate = d.candidates?.[0];
      const text = (candidate?.content?.parts ?? [])
        .filter((p) => !p.thought && typeof p.text === "string")
        .map((p) => p.text)
        .join("")
        .trim();
      if (text) return { ok: true, reply: text };
      if (d.promptFeedback?.blockReason || candidate?.finishReason === "SAFETY") {
        return { ok: true, reply: "I can't help with that one. Try asking about the passage another way." };
      }
      return { ok: false, status: 502, message: "empty reply", tryNextKey: true, tryNextModel: true };
    }
    const message = String(d.error?.message ?? res.statusText ?? "error");
    // Gemini reports an invalid key as 400 API_KEY_INVALID, so 400 only moves on when it is about the key
    const keyProblem = res.status === 401 || res.status === 403 || res.status === 429 || res.status >= 500 || (res.status === 400 && /api[ _-]?key/i.test(message));
    return { ok: false, status: res.status, message, tryNextKey: keyProblem, tryNextModel: res.status === 404 };
  } catch (e) {
    return networkFailure(e);
  }
}

async function callOpenRouter(key: string, model: string, messages: ChatMessage[], timeoutMs: number, referer: string): Promise<Attempt> {
  interface OpenRouterResponse {
    choices?: { message?: { content?: string | null } }[];
    error?: { code?: number; message?: string };
  }
  try {
    const { res, data } = await postJson(
      "https://openrouter.ai/api/v1/chat/completions",
      { Authorization: `Bearer ${key}`, "HTTP-Referer": referer, "X-Title": "Ritual Reader" },
      { model, messages, temperature: 0.7, max_tokens: 4096 },
      timeoutMs,
    );
    const d = data as OpenRouterResponse;
    // OpenRouter can answer 200 with an error object when the routed provider fails
    const status = res.ok && d.error ? Number(d.error.code) || 502 : res.status;
    if (res.ok && !d.error) {
      const raw = d.choices?.[0]?.message?.content ?? "";
      // Reasoning models may inline their thinking
      const text = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      if (text) return { ok: true, reply: text };
      return { ok: false, status: 502, message: "empty reply", tryNextKey: true, tryNextModel: true };
    }
    const message = String(d.error?.message ?? res.statusText ?? "error");
    // 401 bad key, 402 out of credit, 429 rate-limited (free models: per minute and per day)
    const keyProblem = status === 401 || status === 402 || status === 403 || status === 429 || status >= 500;
    // 400/404 here usually mean this model is gone or can't take the request; another model may
    return { ok: false, status, message, tryNextKey: keyProblem, tryNextModel: status === 400 || status === 404 || status >= 500 };
  } catch (e) {
    return networkFailure(e);
  }
}

/* ---------- rotation ---------- */

export async function generateReply(input: unknown, env: Env, referer = "https://ritual-read.vercel.app"): Promise<Result> {
  const slots = configuredSlots(env);
  if (!slots.length) return { status: 503, body: { code: "NO_KEYS", error: "The assistant isn't configured on this server." } };
  const parsed = parseInput(input);
  if ("error" in parsed) return { status: 400, body: { error: parsed.error } };

  const models: Record<Provider, string[]> = {
    gemini: [parsed.model, ...GEMINI_FALLBACKS.filter((m) => m !== parsed.model)],
    openrouter: (env.OPENROUTER_MODELS ?? "").split(/[\s,]+/).filter((m) => OPENROUTER_MODEL_ID.test(m)),
  };
  if (!models.openrouter.length) models.openrouter = OPENROUTER_DEFAULTS;

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  // A provider that rejects the request itself (not the key) would do the same on every key
  const refused = new Set<Provider>();
  const failures: Failure[] = [];
  for (const slot of slotOrder(slots)) {
    if (refused.has(slot.provider)) continue;
    let last: Failure | null = null;
    for (const model of models[slot.provider]) {
      const remaining = deadline - Date.now();
      if (remaining < 3_000) break;
      const timeout = Math.min(ATTEMPT_TIMEOUT_MS, remaining);
      const attempt =
        slot.provider === "gemini"
          ? await callGemini(slot.key, model, parsed.messages, timeout)
          : await callOpenRouter(slot.key, model, parsed.messages, timeout, referer);
      if (attempt.ok) {
        restingUntil.delete(slotId(slot));
        return { status: 200, body: { reply: attempt.reply } };
      }
      last = attempt;
      failures.push(attempt);
      if (!attempt.tryNextModel) break;
    }
    if (!last) break; // out of time
    if (last.tryNextKey) restingUntil.set(slotId(slot), Date.now() + restFor(last.status));
    else refused.add(slot.provider);
  }

  // Provider messages never contain the key, but scrub defensively before logging
  const scrub = (m: string) => slots.reduce((s, x) => s.split(x.key).join("[key]"), m);
  console.error(`ai-chat: all ${slots.length} key(s) failed: ${failures.map((f) => `${f.status} ${scrub(f.message).slice(0, 120)}`).join(" | ")}`);
  if (failures.some((f) => f.status === 429)) {
    return { status: 429, body: { code: "RATE_LIMITED", error: "The assistant is busy right now. Try again in a minute." } };
  }
  return { status: 502, body: { code: "UPSTREAM", error: "The assistant couldn't answer right now. Try again." } };
}

/* ---------- HTTP ---------- */

/* Only signed-in readers can spend the keys. "unconfigured" means there is nothing to verify the
   session against; the client then falls back to the Supabase function instead. */
async function checkSession(authorization: string | undefined, env: Env): Promise<"ok" | "denied" | "unconfigured"> {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) return "unconfigured";
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return "denied";
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } });
    return res.ok ? "ok" : "denied";
  } catch {
    return "denied";
  }
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body too large"));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
  options?: { env?: Env; requireAuth?: boolean },
): Promise<void> {
  const env = options?.env ?? (process.env as Env);
  const send = (status: number, body: Result["body"]) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(body));
  };
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(405, { error: "Method not allowed" });
  }
  if (options?.requireAuth !== false) {
    const session = await checkSession(req.headers.authorization, env);
    if (session === "unconfigured") return send(503, { code: "NO_AUTH_CONFIG", error: "The assistant isn't configured on this server." });
    if (session === "denied") return send(401, { code: "UNAUTHORIZED", error: "Sign in again to use the assistant." });
  }
  let input: unknown;
  try {
    // Vercel parses JSON bodies itself; the dev server hands over the raw stream
    input = req.body !== undefined ? (typeof req.body === "string" ? JSON.parse(req.body) : req.body) : await readJson(req);
  } catch {
    return send(400, { error: "Request body must be JSON." });
  }
  const forwarded = req.headers["x-forwarded-host"];
  const host = (Array.isArray(forwarded) ? forwarded[0] : forwarded) ?? req.headers.host;
  const referer = typeof req.headers.origin === "string" ? req.headers.origin : host ? `https://${host}` : undefined;
  try {
    const out = await generateReply(input, env, referer);
    send(out.status, out.body);
  } catch (e) {
    console.error("ai-chat: unexpected error", e instanceof Error ? e.message : e);
    send(500, { error: "The assistant couldn't answer right now. Try again." });
  }
}

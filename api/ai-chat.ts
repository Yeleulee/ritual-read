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
/* Where a failure applies: just this model (its quota, overload or retirement), this whole key
   (rejected, out of credit, account-wide limit), or the request itself (same on every key). */
type Scope = "model" | "key" | "request";
type Failure = { ok: false; status: number; message: string; scope: Scope; retryAfterMs?: number };
type Attempt = { ok: true; reply: string } | Failure;
interface Result {
  status: number;
  body: { reply?: string; error?: string; code?: string };
}

const GEMINI_DEFAULT = "gemini-2.5-flash";
// Each model has its own free-tier quota and its own overloads, so when one is out of quota,
// overloaded or retired the request moves down this list on the same key (checked October 2026)
const GEMINI_FALLBACKS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-flash-lite-latest"];
// Free models (checked October 2026). openrouter/free routes to whichever free model is up,
// so the chain keeps working when a named model is retired.
const OPENROUTER_DEFAULTS = ["google/gemma-4-31b-it:free", "qwen/qwen3.8-27b:free", "openrouter/free"];
// Model ids are interpolated into the Gemini URL, so only plain ids are accepted
const GEMINI_MODEL_ID = /^gemini-[a-z0-9.-]+$/;
const OPENROUTER_MODEL_ID = /^[a-z0-9._-]+\/[a-z0-9._:-]+$/i;
const MAX_MESSAGES = 40;
const MAX_CHARS = 60_000;
const MAX_BODY_BYTES = 1_000_000;
const ATTEMPT_TIMEOUT_MS = 40_000;
// Stays inside the function's maxDuration (vercel.json) with room to answer
const TOTAL_BUDGET_MS = 50_000;

// Rotation state lives as long as the function instance stays warm. Rests are kept per key and
// per key+model, so a model that is out of quota is not asked first again on every message.
let cursor = 0;
const restingUntil = new Map<string, number>();
const slotId = (s: Slot) => `${s.provider}:${s.key}`;
const modelId = (s: Slot, model: string) => `${slotId(s)}|${model}`;
const isResting = (id: string) => (restingUntil.get(id) ?? 0) > Date.now();
// Resting entries go last rather than being dropped, so a lone key or model is still tried
const restingLast = <T,>(items: T[], id: (x: T) => string) => [...items.filter((x) => !isResting(id(x))), ...items.filter((x) => isResting(id(x)))];

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
  return restingLast(slots.map((_, i) => slots[(start + i) % slots.length]), slotId);
}

function restFor(f: Failure): number {
  // The provider says when to come back; trust it within sane bounds
  if (f.retryAfterMs) return Math.min(30 * 60_000, Math.max(5_000, f.retryAfterMs));
  // A daily allowance won't come back in a minute; don't keep spending requests to find that out
  if (f.status === 429 && /per[\s-]?day|daily/i.test(f.message)) return 30 * 60_000;
  if (f.status === 429) return 60_000; // per-minute window
  if (f.status === 503) return 30_000; // overloaded
  if (f.status === 404) return 60 * 60_000; // retired model
  if (f.status === 400 || f.status === 401 || f.status === 402 || f.status === 403) return 10 * 60_000; // rejected or out of credit
  return 15_000; // upstream hiccup or network
}

// "37s" (Gemini RetryInfo) or "37" (Retry-After header) -> ms
const parseRetry = (v: string | null | undefined) => {
  const n = v ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : undefined;
};

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
  // A hang is usually one overloaded model; the next model or key may answer
  return { ok: false, status: timedOut ? 504 : 502, message: timedOut ? "timeout" : "network error", scope: "model" };
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
      maxOutputTokens: 8192,
      ...(model.startsWith("gemini-2.5-flash") ? { thinkingConfig: { thinkingBudget: 1024 } } : {}),
    },
  };
}

async function callGemini(key: string, model: string, messages: ChatMessage[], timeoutMs: number): Promise<Attempt> {
  interface GeminiResponse {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
    error?: { message?: string; details?: { retryDelay?: string; violations?: { quotaId?: string }[] }[] };
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
        return { ok: false, status: 422, message: "The provider blocked this request. Try asking about the passage another way.", scope: "request" };
      }
      return { ok: false, status: 502, message: "empty reply", scope: "model" };
    }
    // Quota ids (e.g. ...PerDayPerProjectPerModel-FreeTier) tell a daily limit from a per-minute one
    const details = d.error?.details ?? [];
    const quotaIds = details.flatMap((x) => x.violations ?? []).map((v) => v.quotaId ?? "").filter(Boolean).join(" ");
    const message = `${String(d.error?.message ?? res.statusText ?? "error")}${quotaIds ? ` [${quotaIds}]` : ""}`;
    const retryAfterMs = parseRetry(details.find((x) => x.retryDelay)?.retryDelay);
    // Gemini reports an invalid key as 400 API_KEY_INVALID
    const keyRejected = res.status === 401 || res.status === 403 || (res.status === 400 && /api[ _-]?key/i.test(message));
    // Free-tier quota (429), overload (503) and retirement (404) are per model: the next model may answer
    const scope: Scope = keyRejected ? "key" : res.status === 400 ? "request" : "model";
    return { ok: false, status: res.status, message, scope, retryAfterMs };
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
      { model, messages, temperature: 0.7, max_tokens: 8192 },
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
      return { ok: false, status: 502, message: "empty reply", scope: "model" };
    }
    const message = String(d.error?.message ?? res.statusText ?? "error");
    const retryAfterMs = parseRetry(res.headers.get("retry-after"));
    // A 429 is either the account's free-model allowance (shared by every free model) or one model
    // being rate-limited upstream, in which case another free model may still answer
    const accountLimit = status === 429 && /free-models-per-|per[\s-]?day|daily/i.test(message);
    // 401 bad key, 402 out of credit, 403 key blocked: no model on this key will work.
    // 400/404 here usually mean this model is gone or can't take the request; another model may.
    const scope: Scope = status === 401 || status === 402 || status === 403 || accountLimit ? "key" : "model";
    return { ok: false, status, message, scope, retryAfterMs };
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
  let outOfTime = false;
  for (const slot of slotOrder(slots)) {
    if (outOfTime) break;
    if (refused.has(slot.provider)) continue;
    for (const model of restingLast(models[slot.provider], (m) => modelId(slot, m))) {
      const remaining = deadline - Date.now();
      if (remaining < 3_000) {
        outOfTime = true;
        break;
      }
      const attempt =
        slot.provider === "gemini"
          ? await callGemini(slot.key, model, parsed.messages, Math.min(ATTEMPT_TIMEOUT_MS, remaining))
          : await callOpenRouter(slot.key, model, parsed.messages, Math.min(ATTEMPT_TIMEOUT_MS, remaining), referer);
      if (attempt.ok) {
        restingUntil.delete(slotId(slot));
        restingUntil.delete(modelId(slot, model));
        return { status: 200, body: { reply: attempt.reply } };
      }
      failures.push(attempt);
      if (attempt.scope === "model") {
        restingUntil.set(modelId(slot, model), Date.now() + restFor(attempt));
        continue;
      }
      if (attempt.scope === "key") restingUntil.set(slotId(slot), Date.now() + restFor(attempt));
      else refused.add(slot.provider);
      break;
    }
  }

  // Provider messages never contain the key, but scrub defensively before logging
  const scrub = (m: string) => slots.reduce((s, x) => s.split(x.key).join("[key]"), m);
  console.error(`ai-chat: all ${slots.length} key(s) failed: ${failures.map((f) => `${f.status} ${scrub(f.message).slice(0, 120)}`).join(" | ")}`);
  // Busy (rate-limited or overloaded) vs broken; either way the client falls back to Supabase
  if (failures.some((f) => f.status === 429 || f.status === 503)) {
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

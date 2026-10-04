// Dev helper: screenshot a page at desktop width with localStorage preset (uses headless Edge via CDP).
// Usage: [SHOT_SIZE=WxH] node scripts/shot.mjs <url> <out.png> [key=value ...]
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const [url, out, ...kv] = process.argv.slice(2);
if (!url || !out) { console.error("usage: node scripts/shot.mjs <url> <out.png> [key=value ...]"); process.exit(1); }
const [W, H] = (process.env.SHOT_SIZE ?? "1440x900").split("x").map(Number);

const edge = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
const port = 9333;
const proc = spawn(edge, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
  `--remote-debugging-port=${port}`, `--user-data-dir=${process.env.TEMP}/edge-shot-cdp`,
  `--window-size=${W},${H}`, "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 40 && !target; i++) {
  await sleep(250);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch {}
}
if (!target) { proc.kill(); throw new Error("Edge did not start"); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });

await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: W < 1024 });
await send("Page.enable");
await send("Page.navigate", { url });
await sleep(1500);
if (kv.length) {
  const expr = kv.map((p) => { const [k, ...v] = p.split("="); return `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v.join("="))});`; }).join("");
  await send("Runtime.evaluate", { expression: expr });
  await send("Page.reload");
}
await sleep(4000);
const { data } = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(out, Buffer.from(data, "base64"));
ws.close(); proc.kill();
console.log("saved", out);

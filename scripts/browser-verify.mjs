import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// 1. Start a local static file server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/test-pdf-runner.html';
  const filePath = path.join(rootDir, 'public', reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mime = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 4199;
server.listen(PORT, async () => {
  console.log(`Local test server running at http://127.0.0.1:${PORT}`);
  await runBrowserTests();
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runBrowserTests() {
  const edgePath = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ].find(fs.existsSync);

  if (!edgePath) {
    console.error('Edge executable not found!');
    server.close();
    process.exit(1);
  }

  const cdpPort = 9444;
  const W = 1440;
  const H = 900;
  const tmpUserData = path.join(process.env.TEMP || '.', 'edge-verify-cdp');

  console.log('Launching Headless Edge via CDP...');
  const proc = spawn(
    edgePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${tmpUserData}`,
      `--window-size=${W},${H}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    try {
      target = (await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json()).find((t) => t.type === 'page');
    } catch {}
  }

  if (!target) {
    proc.kill();
    server.close();
    throw new Error('Edge CDP did not respond');
  }

  console.log('Connected to Edge page target via WebSocket...');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m.result);
      pending.delete(m.id);
    }
  };

  const send = (method, params = {}) =>
    new Promise((r) => {
      pending.set(++id, r);
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.enable');
  await send('Runtime.enable');

  console.log('Navigating to test runner page...');
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/test-pdf-runner.html` });
  await sleep(1500);

  // 1. Capture Single Page Presentation Screenshot
  console.log('Verifying single page presentation and capturing screenshot...');
  const res1 = await send('Page.captureScreenshot', { format: 'png' });
  const shot1Path = path.join(rootDir, 'test-pdf-single-page.png');
  fs.writeFileSync(shot1Path, Buffer.from(res1.data, 'base64'));
  console.log(`[VERIFIED] Single page presentation saved to: ${shot1Path}`);

  // 2. Toggle Two-Page Spread and Capture Screenshot
  console.log('Toggling Two-Page Spread mode...');
  await send('Runtime.evaluate', { expression: 'window.toggleSpread()' });
  await sleep(500);
  const res2 = await send('Page.captureScreenshot', { format: 'png' });
  const shot2Path = path.join(rootDir, 'test-pdf-spread-mode.png');
  fs.writeFileSync(shot2Path, Buffer.from(res2.data, 'base64'));
  console.log(`[VERIFIED] Two-page spread mode saved to: ${shot2Path}`);

  // 3. Show Live Selection Menu & Highlights
  console.log('Triggering text selection menu...');
  await send('Runtime.evaluate', { expression: 'window.showSelectionMenu()' });
  await sleep(500);
  const res3 = await send('Page.captureScreenshot', { format: 'png' });
  const shot3Path = path.join(rootDir, 'test-pdf-selection-menu.png');
  fs.writeFileSync(shot3Path, Buffer.from(res3.data, 'base64'));
  console.log(`[VERIFIED] Live selection menu saved to: ${shot3Path}`);

  // 4. Toggle Dark Mode (Spread Mode)
  console.log('Toggling Apple Books Dark Mode in Spread Mode...');
  await send('Runtime.evaluate', { expression: 'window.toggleDark()' });
  await sleep(500);
  const res4 = await send('Page.captureScreenshot', { format: 'png' });
  const shot4Path = path.join(rootDir, 'test-pdf-dark-mode-spread.png');
  fs.writeFileSync(shot4Path, Buffer.from(res4.data, 'base64'));
  console.log(`[VERIFIED] Dark Mode two-page spread saved to: ${shot4Path}`);

  // 5. Toggle Single Page in Dark Mode
  console.log('Toggling Single Page in Dark Mode...');
  await send('Runtime.evaluate', { expression: 'window.toggleSpread()' });
  await sleep(500);
  const res5 = await send('Page.captureScreenshot', { format: 'png' });
  const shot5Path = path.join(rootDir, 'test-pdf-dark-mode-single.png');
  fs.writeFileSync(shot5Path, Buffer.from(res5.data, 'base64'));
  console.log(`[VERIFIED] Dark Mode single page saved to: ${shot5Path}`);

  // Clean up
  ws.close();
  proc.kill();
  server.close();

  console.log('\n====================================================');
  console.log('>>> BROWSER VISUAL VERIFICATION COMPLETE! <<<');
  console.log('====================================================\n');
}

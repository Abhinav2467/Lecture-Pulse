#!/usr/bin/env node
// Captures the README screenshots into docs/screenshots/.
//   npm run screenshots            (needs: npx playwright install chromium)
//   npm run screenshots -- --no-build
//
// Builds the client, starts the production server on a free port with a
// throw-away database, creates a session, runs the simulator as host + 30
// students, and photographs each page at the right moment. Everything it
// starts is shut down again, also on failure.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'screenshots');
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const SIM_MINUTES = 2.5;
const SIM_STUDENTS = 30;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (message) => console.log(`[screenshots] ${message}`);

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitForHealth(base, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await fetch(`${base}/api/health`).then((r) => r.ok).catch(() => false);
    if (ok) return;
    await sleep(200);
  }
  throw new Error('Server did not become healthy in time');
}

const children = [];
function start(command, args, env) {
  const child = spawn(command, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (chunk) => process.stdout.write(`  ${chunk}`.replace(/\n(?=.)/g, '\n  ')));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  children.push(child);
  return child;
}

function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const force = setTimeout(() => child.kill('SIGKILL'), 4000);
    child.once('exit', () => {
      clearTimeout(force);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

let browser;
let tmpDir;

async function cleanup() {
  await browser?.close().catch(() => {});
  await Promise.all(children.map(stopChild));
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
}

async function main() {
  if (!process.argv.includes('--no-build')) {
    log('building client…');
    const build = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
    if (build.status !== 0) throw new Error('Build failed');
  }

  fs.mkdirSync(OUT, { recursive: true });
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lecture-pulse-shots-'));
  const port = await freePort();
  const base = `http://localhost:${port}`;

  log(`starting server on ${base}`);
  start(process.execPath, ['server/src/index.js'], {
    NODE_ENV: 'production',
    PORT: String(port),
    DB_PATH: path.join(tmpDir, 'pulse.db'),
    SERVER_SALT: 'screenshots',
    CLIENT_ORIGIN: base,
  });
  await waitForHealth(base);

  const created = await fetch(`${base}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'CS201 · Data Structures' }),
  }).then((r) => r.json());
  const { code, hostToken } = created;
  log(`session ${code} created`);

  browser = await chromium.launch();
  const desktop = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1 });
  const phone = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const shot = (page, name) => {
    log(`capturing ${name}`);
    return page.screenshot({ path: path.join(OUT, name) });
  };
  // Whole-page capture by growing the viewport (instead of fullPage stitching),
  // so fixed layers such as the grain cover the entire image.
  const shotFull = async (page, name) => {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: DESKTOP.width, height: Math.max(DESKTOP.height, height) });
    await page.waitForTimeout(400);
    await shot(page, name);
    await page.setViewportSize(DESKTOP);
  };
  // Entrance animations are staggered up to ~1.5s + 1s duration.
  const settle = (page, ms = 2800) => page.waitForTimeout(ms);

  // --- Static pages ---------------------------------------------------------
  const page = await desktop.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('.hero-photo canvas, .hero-photo video');
  await settle(page, 3400);
  await shot(page, 'landing.png');

  await page.goto(`${base}/about`, { waitUntil: 'networkidle' });
  await settle(page);
  await shotFull(page, 'about.png');
  await page.close();

  // --- Live session ---------------------------------------------------------
  // The host link (#t=token) is how this fresh browser becomes the host.
  const host = await desktop.newPage();
  await host.goto(`${base}/host/${code}#t=${hostToken}`, { waitUntil: 'networkidle' });
  await host.waitForSelector('.gauge');

  const student = await phone.newPage();
  await student.goto(`${base}/join/${code}`, { waitUntil: 'networkidle' });
  await student.waitForSelector('.tile:not([disabled])');

  log('starting simulator (host actions + students)');
  start(
    process.execPath,
    ['scripts/simulate.js', code, String(SIM_STUDENTS), String(SIM_MINUTES), '--host-actions', '--token', hostToken],
    { SERVER_URL: base },
  );

  await settle(student, 2200);
  await student.locator('.tile').nth(2).click(); // "Example please"
  await student.waitForSelector('.sent.is-visible');
  await student.waitForTimeout(700);
  await shot(student, 'student.png');

  // Poll: wait until the room has voted so the bars have something to show.
  await host.waitForSelector('.poll--live', { timeout: 90_000 });
  await host.waitForFunction(
    () => Number(document.querySelector('.poll--live .poll-foot')?.textContent.match(/\d+/)?.[0] ?? 0) >= 12,
    null,
    { timeout: 15_000 },
  );
  await host.waitForTimeout(600);
  await shot(host, 'poll.png');

  // Dashboard: the alert has fired and reactions are floating.
  await host.waitForSelector('.alert-banner', { timeout: 150_000 });
  await host.waitForFunction(() => document.querySelectorAll('.reaction').length >= 3, null, { timeout: 30_000 });
  await host.waitForTimeout(900);
  await shot(host, 'dashboard-live.png');

  await host.keyboard.press('f');
  await host.waitForSelector('.present canvas');
  await host.waitForTimeout(1500);
  await shot(host, 'present-mode.png');
  await host.keyboard.press('f');

  // Let the recap phase bring the score down so the summary has a full story.
  await host.waitForSelector('.alert-banner', { state: 'detached', timeout: 90_000 }).catch(() => {});
  await host.waitForTimeout(4000);

  log('ending session');
  await fetch(`${base}/api/sessions/${code}/end`, { method: 'POST', headers: { 'x-host-token': hostToken } });
  await host.waitForURL(`**/summary/${code}`, { timeout: 15_000 });
  await host.waitForSelector('.recharts-line-curve');
  await settle(host);
  await shotFull(host, 'summary.png');

  const files = fs.readdirSync(OUT).filter((file) => file.endsWith('.png')).sort();
  log(`done: ${files.join(', ')}`);
}

let failed = false;
try {
  await main();
} catch (err) {
  failed = true;
  console.error(`[screenshots] failed: ${err.stack || err}`);
} finally {
  await cleanup();
}
process.exit(failed ? 1 : 0);

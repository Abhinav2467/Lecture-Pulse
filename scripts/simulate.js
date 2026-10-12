#!/usr/bin/env node
// Fake classroom for demos:  npm run simulate -- <CODE> [students=30] [minutes=3]
// Spawns N anonymous student sockets that tap like a real room: mostly fine at
// first, a confusion spike in the middle, then a recovery.
import { randomUUID } from 'node:crypto';
import { io } from 'socket.io-client';

const [rawCode, rawStudents = '30', rawMinutes = '3'] = process.argv.slice(2);
const code = (rawCode || '').toUpperCase();
const students = Number.parseInt(rawStudents, 10);
const minutes = Number.parseFloat(rawMinutes);
const SERVER = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 4000}`;

if (!/^[A-Z0-9]{6}$/.test(code) || !(students > 0) || !(minutes > 0)) {
  console.error('Usage: npm run simulate -- <CODE> [students=30] [minutes=3]');
  process.exit(1);
}

const COOLDOWN_MS = 8000;
const durationMs = minutes * 60_000;

// Probability of each tap type per phase. `eagerness` scales how often students tap.
const PHASES = [
  { name: 'warm-up', until: 0.35, eagerness: 0.6, mix: { GOT_IT: 0.45, EXAMPLE: 0.25, TOO_FAST: 0.2, LOST: 0.1 } },
  { name: 'confusion spike', until: 0.65, eagerness: 1.0, mix: { GOT_IT: 0.08, EXAMPLE: 0.17, TOO_FAST: 0.25, LOST: 0.5 } },
  { name: 'recovery', until: 1.01, eagerness: 0.7, mix: { GOT_IT: 0.5, EXAMPLE: 0.2, TOO_FAST: 0.18, LOST: 0.12 } },
];

const phaseAt = (elapsedMs) => PHASES.find((phase) => elapsedMs / durationMs < phase.until) ?? PHASES.at(-1);
const rand = (min, max) => min + Math.random() * (max - min);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function pickType(mix) {
  let roll = Math.random();
  for (const [type, p] of Object.entries(mix)) {
    roll -= p;
    if (roll <= 0) return type;
  }
  return 'GOT_IT';
}

const res = await fetch(`${SERVER}/api/sessions/${code}`).catch(() => null);
if (!res) {
  console.error(`Cannot reach the server at ${SERVER}. Is it running?`);
  process.exit(1);
}
if (!res.ok) {
  console.error(`Session ${code} not found.`);
  process.exit(1);
}
const session = await res.json();
if (!session.active) {
  console.error(`Session ${code} has already ended.`);
  process.exit(1);
}

console.log(`Simulating ${students} students in "${session.title}" (${code}) for ${minutes} min → ${SERVER}`);

const startedAt = Date.now();
const stats = { sent: 0, rejected: 0, connected: 0 };
const sockets = [];
let stopped = false;

async function runStudent(index) {
  await sleep(rand(0, Math.min(10_000, durationMs * 0.1))); // people trickle in
  if (stopped) return;

  const socket = io(SERVER, { auth: { role: 'student', code, clientId: randomUUID() }, transports: ['websocket'] });
  sockets.push(socket);
  socket.on('connect', () => (stats.connected += 1));
  socket.on('disconnect', () => (stats.connected -= 1));
  socket.on('feedback:rejected', () => (stats.rejected += 1));
  socket.on('session:error', ({ message }) => console.error(`student ${index}: ${message}`));
  socket.on('session:ended', () => stop('Session ended by host.'));

  // Some students are chatty, some barely tap at all.
  const chattiness = rand(0.35, 1);

  await sleep(rand(500, 8000)); // first reaction shortly after joining

  while (!stopped) {
    const phase = phaseAt(Date.now() - startedAt);
    // Never faster than the server cooldown; quieter students wait longer.
    await sleep(COOLDOWN_MS + 300 + rand(0, 9000) / (chattiness * phase.eagerness));
    if (stopped || !socket.connected) continue;
    const current = phaseAt(Date.now() - startedAt);
    socket.emit('feedback:send', { type: pickType(current.mix) }, (ack) => {
      if (ack?.ok) stats.sent += 1;
    });
  }
}

function stop(reason) {
  if (stopped) return;
  stopped = true;
  clearInterval(reporter);
  sockets.forEach((socket) => socket.disconnect());
  console.log(`${reason} Sent ${stats.sent} taps (${stats.rejected} rejected by cooldown).`);
  setTimeout(() => process.exit(0), 200);
}

const reporter = setInterval(() => {
  const elapsed = Date.now() - startedAt;
  const stamp = new Date(elapsed).toISOString().slice(14, 19);
  console.log(`[${stamp}] ${phaseAt(elapsed).name.padEnd(15)} connected=${stats.connected} taps=${stats.sent}`);
}, 10_000);

setTimeout(() => stop('Done.'), durationMs);
process.on('SIGINT', () => stop('Interrupted.'));

for (let i = 0; i < students; i++) runStudent(i);

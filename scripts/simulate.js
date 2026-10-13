#!/usr/bin/env node
// Fake classroom for demos:
//   npm run simulate -- <CODE> [students=30] [minutes=3] [--host-actions --token <hostToken>]
//
// Spawns N anonymous student sockets that behave like a real room: mostly fine
// at first, a sustained confusion spike in the middle (long enough to trigger
// the "losing the room" alert), then a recovery. They also send reactions and
// vote in any poll that is running.
//
// With --host-actions the script also plays the lecturer: it starts the topics
// Intro -> Arrays -> Recursion (the spike happens during Recursion) and runs
// one quick-check poll. That needs the session's host token (--token).
import { randomUUID } from 'node:crypto';
import { io } from 'socket.io-client';

const args = process.argv.slice(2);
const flags = { hostActions: false, token: null };
const positional = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--host-actions') flags.hostActions = true;
  else if (arg === '--token') flags.token = args[++i] ?? null;
  else if (arg.startsWith('--token=')) flags.token = arg.slice('--token='.length);
  else positional.push(arg);
}

const [rawCode, rawStudents = '30', rawMinutes = '3'] = positional;
const code = (rawCode || '').toUpperCase();
const students = Number.parseInt(rawStudents, 10);
const minutes = Number.parseFloat(rawMinutes);
const SERVER = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 4000}`;

function usage(message) {
  if (message) console.error(message);
  console.error('Usage: npm run simulate -- <CODE> [students=30] [minutes=3] [--host-actions --token <hostToken>]');
  process.exit(1);
}

if (!/^[A-Z0-9]{6}$/.test(code) || !(students > 0) || !(minutes > 0)) usage();
if (flags.hostActions && !flags.token) usage('--host-actions needs the host token: --token <hostToken>');

const COOLDOWN_MS = 8000;
const REACTION_COOLDOWN_MS = 3000;
const REACTIONS = ['🔥', '🤯', '😂', '👏'];
const durationMs = minutes * 60_000;

/**
 * The lecture, as fractions of the run. `mix` is the probability of each tap,
 * `eagerness` scales how often students tap, `poll` is how they answer a
 * quick check and `reactions` weights the emoji they send.
 * The Recursion spike averages about +0.8 per student, far above the alert
 * threshold of 60, and lasts 40% of the run (72s of a 3-minute demo), so the
 * score stays >= 60 for well over the 20s the alert needs.
 */
const PHASES = [
  {
    name: 'Intro', topic: 'Intro', until: 0.2, eagerness: 0.7,
    mix: { GOT_IT: 0.5, EXAMPLE: 0.22, TOO_FAST: 0.18, LOST: 0.1 },
    poll: { YES: 0.7, UNSURE: 0.2, NO: 0.1 },
    reactions: [3, 1, 2, 4],
  },
  {
    name: 'Arrays', topic: 'Arrays', until: 0.42, eagerness: 0.8,
    mix: { GOT_IT: 0.4, EXAMPLE: 0.27, TOO_FAST: 0.2, LOST: 0.13 },
    poll: { YES: 0.55, UNSURE: 0.3, NO: 0.15 },
    reactions: [4, 2, 2, 3],
  },
  {
    name: 'Recursion (spike)', topic: 'Recursion', until: 0.82, eagerness: 1.7,
    mix: { GOT_IT: 0.03, EXAMPLE: 0.12, TOO_FAST: 0.25, LOST: 0.6 },
    poll: { YES: 0.1, UNSURE: 0.35, NO: 0.55 },
    reactions: [1, 7, 2, 1],
  },
  {
    name: 'Recursion (recap)', topic: 'Recursion', until: 1.01, eagerness: 1.3,
    mix: { GOT_IT: 0.62, EXAMPLE: 0.18, TOO_FAST: 0.12, LOST: 0.08 },
    poll: { YES: 0.6, UNSURE: 0.3, NO: 0.1 },
    reactions: [3, 2, 1, 5],
  },
];
const POLL_AT = 0.3; // during Arrays

const startedAt = Date.now();
const elapsedMs = () => Date.now() - startedAt;
const phaseNow = () => PHASES.find((phase) => elapsedMs() / durationMs < phase.until) ?? PHASES.at(-1);
const rand = (min, max) => min + Math.random() * (max - min);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function pick(weights) {
  const entries = Array.isArray(weights) ? weights.map((w, i) => [i, w]) : Object.entries(weights);
  let roll = Math.random() * entries.reduce((sum, [, w]) => sum + w, 0);
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return entries.at(-1)[0];
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

console.log(
  `Simulating ${students} students in "${session.title}" (${code}) for ${minutes} min → ${SERVER}` +
    (flags.hostActions ? ' (also acting as host)' : ''),
);

const stats = { taps: 0, rejected: 0, reactions: 0, votes: 0, connected: 0 };
const sockets = [];
const timers = [];
let stopped = false;

function later(ms, fn) {
  const timer = setTimeout(() => !stopped && fn(), ms);
  timers.push(timer);
}

async function runStudent(index) {
  await sleep(rand(0, Math.min(8000, durationMs * 0.08))); // people trickle in
  if (stopped) return;

  const socket = io(SERVER, { auth: { role: 'student', code, clientId: randomUUID() }, transports: ['websocket'] });
  sockets.push(socket);
  socket.on('connect', () => (stats.connected += 1));
  socket.on('disconnect', () => (stats.connected -= 1));
  socket.on('feedback:rejected', () => (stats.rejected += 1));
  socket.on('session:error', ({ message }) => console.error(`student ${index}: ${message}`));
  socket.on('session:ended', () => stop('Session ended by host.'));

  // Most students answer a poll, a few seconds apart.
  socket.on('poll:started', (poll) => {
    if (Math.random() > 0.9) return;
    later(rand(800, Math.max(1500, poll.remainingMs - 2500)), () => {
      socket.emit('poll:vote', { pollId: poll.id, choice: pick(phaseNow().poll) }, (ack) => {
        if (ack?.ok) stats.votes += 1;
      });
    });
  });

  // Some students are chatty, some barely tap at all.
  const chattiness = rand(0.4, 1);

  // Reactions: an independent loop with its own (shorter) cooldown.
  (async () => {
    await sleep(rand(2000, 9000));
    while (!stopped) {
      if (socket.connected) {
        socket.emit('reaction:send', { emoji: REACTIONS[pick(phaseNow().reactions)] }, (ack) => {
          if (ack?.ok) stats.reactions += 1;
        });
      }
      await sleep(REACTION_COOLDOWN_MS + 300 + rand(2000, 14000) / chattiness);
    }
  })();

  await sleep(rand(500, 7000)); // first tap shortly after joining
  while (!stopped) {
    if (socket.connected) {
      socket.emit('feedback:send', { type: pick(phaseNow().mix) }, (ack) => {
        if (ack?.ok) stats.taps += 1;
      });
    }
    // Never faster than the server cooldown; quieter students and calmer phases wait longer.
    await sleep(COOLDOWN_MS + 300 + rand(0, 9000) / (chattiness * phaseNow().eagerness));
  }
}

function runHost() {
  const host = io(SERVER, { auth: { role: 'host', code, hostToken: flags.token }, transports: ['websocket'] });
  sockets.push(host);
  host.on('session:error', ({ message }) => {
    console.error(`host: ${message}`);
    stop('Could not act as host.');
  });
  host.on('alert:lost', (alert) => console.log(`[host] ALERT losing the room → "${alert.suggestion}"`));
  host.on('alert:clear', () => console.log('[host] alert cleared'));
  host.on('poll:result', (r) => console.log(`[host] poll result: 👍 ${r.counts.YES}  🤔 ${r.counts.UNSURE}  👎 ${r.counts.NO}`));

  const startTopic = (label) =>
    host.emit('topic:start', { label }, (ack) => console.log(`[host] topic → ${label}${ack?.ok ? '' : ` (${ack?.error})`}`));

  host.once('session:info', () => {
    // "Intro" already exists as the default topic, so starting it is a no-op on the server.
    let from = 0;
    for (const phase of PHASES) {
      if (PHASES.findIndex((p) => p.topic === phase.topic) === PHASES.indexOf(phase)) {
        later(from * durationMs, () => startTopic(phase.topic));
      }
      from = phase.until;
    }
    later(POLL_AT * durationMs, () =>
      host.emit('poll:start', { question: 'Did arrays make sense?' }, (ack) =>
        console.log(`[host] poll started${ack?.ok ? '' : ` (${ack?.error})`}`),
      ),
    );
  });
}

function stop(reason) {
  if (stopped) return;
  stopped = true;
  clearInterval(reporter);
  timers.forEach(clearTimeout);
  sockets.forEach((socket) => socket.disconnect());
  console.log(
    `${reason} ${stats.taps} taps (${stats.rejected} rejected by cooldown), ${stats.reactions} reactions, ${stats.votes} poll votes.`,
  );
  setTimeout(() => process.exit(0), 200);
}

const reporter = setInterval(() => {
  const stamp = new Date(elapsedMs()).toISOString().slice(14, 19);
  console.log(
    `[${stamp}] ${phaseNow().name.padEnd(18)} connected=${stats.connected} taps=${stats.taps} reactions=${stats.reactions}`,
  );
}, 10_000);

setTimeout(() => stop('Done.'), durationMs);
process.on('SIGINT', () => stop('Interrupted.'));
process.on('SIGTERM', () => stop('Terminated.'));

if (flags.hostActions) runHost();
for (let i = 0; i < students; i++) runStudent(i);

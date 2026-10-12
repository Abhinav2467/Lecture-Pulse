import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Server } from 'socket.io';
import { io as connect } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { attachSockets } from '../src/sockets.js';
import { q } from '../src/db.js';
import { createSession, endSession, findSession } from '../src/lib/sessionService.js';

let io;
let sockets;
let url;
const clients = [];

beforeAll(async () => {
  const server = http.createServer(createApp());
  io = new Server(server);
  sockets = attachSockets(io, { pulseIntervalMs: 50, timelineIntervalMs: 60_000 });
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

afterAll(async () => {
  clients.forEach((client) => client.disconnect());
  sockets.stop();
  await io.close();
});

function open(auth) {
  const socket = connect(url, { auth, transports: ['websocket'], reconnection: false });
  clients.push(socket);
  return socket;
}

// Resolves with the first `event` payload matching `predicate`.
function waitFor(socket, event, predicate = () => true, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    const handler = (payload) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

async function join(auth) {
  const socket = open(auth);
  const info = await waitFor(socket, 'session:info');
  return { socket, info };
}

describe('socket flow', () => {
  it('student tap reaches the host as a pulse update, and cooldown rejects the next tap', async () => {
    const { code, hostToken } = createSession('Sockets 101');
    const { socket: host, info } = await join({ role: 'host', code, hostToken });
    expect(info).toEqual({ code, title: 'Sockets 101', active: true });

    const presence = waitFor(host, 'presence:update', (p) => p.activeStudents === 1);
    const { socket: student } = await join({ role: 'student', code, clientId: 'client-aaaaaaaa' });
    await presence;

    const updated = waitFor(host, 'pulse:update', (p) => p.counts.LOST === 1);
    const ack = await student.emitWithAck('feedback:send', { type: 'LOST' });
    expect(ack).toEqual({ ok: true, cooldownMs: 8000 });

    const pulse = await updated;
    expect(pulse).toMatchObject({ score: 100, level: 'Lost the room', activeStudents: 1 });
    expect(pulse.ts).toEqual(expect.any(Number));

    // Second tap inside the 8s cooldown is rejected server-side.
    const rejected = waitFor(student, 'feedback:rejected');
    const ack2 = await student.emitWithAck('feedback:send', { type: 'GOT_IT' });
    expect(ack2.ok).toBe(false);
    const rejection = await rejected;
    expect(rejection.retryInMs).toBeGreaterThan(0);
    expect(rejection.retryInMs).toBeLessThanOrEqual(8000);

    // Only the accepted tap was persisted, and only as a hash.
    const rows = q.recentFeedback.all(findSession(code).id, 0);
    expect(rows).toHaveLength(1);
    expect(rows[0].clientHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('shares the cooldown across sockets of the same client', async () => {
    const { code } = createSession('Two tabs');
    const auth = { role: 'student', code, clientId: 'client-bbbbbbbb' };
    const { socket: tabA } = await join(auth);
    const { socket: tabB } = await join(auth);
    expect((await tabA.emitWithAck('feedback:send', { type: 'EXAMPLE' })).ok).toBe(true);
    expect((await tabB.emitWithAck('feedback:send', { type: 'EXAMPLE' })).ok).toBe(false);
  });

  it('counts distinct clients, not sockets, as active students', async () => {
    const { code, hostToken } = createSession('Presence');
    const { socket: host } = await join({ role: 'host', code, hostToken });
    const presenceIs = (n) => waitFor(host, 'presence:update', (p) => p.activeStudents === n);
    const alice = { role: 'student', code, clientId: 'client-alice-0001' };

    let next = presenceIs(1);
    const { socket: tabA } = await join(alice);
    await next;

    // Second tab of the same browser: presence is re-announced but stays at 1.
    next = waitFor(host, 'presence:update');
    const { socket: tabB } = await join(alice);
    expect(await next).toEqual({ activeStudents: 1 });

    next = presenceIs(2);
    await join({ role: 'student', code, clientId: 'client-bob-00002' });
    await next;

    // The score denominator uses the same number: 1 LOST / 2 students = 50.
    const scored = waitFor(host, 'pulse:update', (p) => p.counts.LOST === 1);
    await tabA.emitWithAck('feedback:send', { type: 'LOST' });
    expect(await scored).toMatchObject({ score: 50, activeStudents: 2 });

    // Closing one of two tabs keeps the student in the room...
    next = waitFor(host, 'presence:update');
    tabA.disconnect();
    expect(await next).toEqual({ activeStudents: 2 });

    // ...closing the last one removes them.
    next = waitFor(host, 'presence:update');
    tabB.disconnect();
    expect(await next).toEqual({ activeStudents: 1 });
  });

  it('rejects invalid feedback types', async () => {
    const { code } = createSession('Types');
    const { socket } = await join({ role: 'student', code, clientId: 'client-cccccccc' });
    const ack = await socket.emitWithAck('feedback:send', { type: 'PIZZA' });
    expect(ack).toEqual({ ok: false, error: 'Invalid feedback type' });
  });

  it('disconnects a host with a bad token', async () => {
    const { code } = createSession('Private');
    const socket = open({ role: 'host', code, hostToken: 'not-the-token' });
    const error = waitFor(socket, 'session:error');
    const closed = waitFor(socket, 'disconnect');
    expect(await error).toEqual({ message: 'Invalid host token' });
    await closed;
    expect(socket.connected).toBe(false);
  });

  it('reports unknown sessions to students', async () => {
    const socket = open({ role: 'student', code: 'ZZZZZZ', clientId: 'client-dddddddd' });
    expect(await waitFor(socket, 'session:error')).toEqual({ message: 'Session not found' });
  });

  it('notifies everyone when the session ends and rejects later feedback', async () => {
    const { code, hostToken } = createSession('Finale');
    const { socket: host } = await join({ role: 'host', code, hostToken });
    const { socket: student } = await join({ role: 'student', code, clientId: 'client-eeeeeeee' });

    const hostEnded = waitFor(host, 'session:ended');
    const studentEnded = waitFor(student, 'session:ended');
    endSession(findSession(code));
    await Promise.all([hostEnded, studentEnded]);

    const ack = await student.emitWithAck('feedback:send', { type: 'LOST' });
    expect(ack).toEqual({ ok: false, error: 'Session has ended' });

    // A final timeline sample is written on end.
    expect(q.timeline.all(findSession(code).id)).toHaveLength(1);

    // Late joiners learn the session is over.
    const late = await join({ role: 'student', code, clientId: 'client-ffffffff' });
    expect(late.info.active).toBe(false);
  });
});

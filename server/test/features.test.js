import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Server } from 'socket.io';
import { io as connect } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { attachSockets } from '../src/sockets.js';
import { q } from '../src/db.js';
import { buildSummary, createSession, endSession, findSession, startTopic } from '../src/lib/sessionService.js';

// Topics, alerts, polls and reactions, with the timers shortened.
const ALERT_HOLD_MS = 150;
const POLL_MS = 400;

let app;
let io;
let sockets;
let url;
const clients = [];

beforeAll(async () => {
  app = createApp({ createLimit: 1000 });
  const server = http.createServer(app);
  io = new Server(server);
  sockets = attachSockets(io, {
    pulseIntervalMs: 40,
    timelineIntervalMs: 60_000,
    alertHoldMs: ALERT_HOLD_MS,
    pollDurationMs: POLL_MS,
  });
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

afterAll(async () => {
  clients.forEach((client) => client.disconnect());
  sockets.stop();
  await io.close();
});

function waitFor(socket, event, predicate = () => true, timeoutMs = 3000) {
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

// Connects and resolves once the server has sent session:info. `also` lists
// other events to capture from the connect burst (they arrive right behind it).
async function join(auth, also = []) {
  const socket = connect(url, { auth, transports: ['websocket'], reconnection: false });
  clients.push(socket);
  const extras = also.map((event) => waitFor(socket, event));
  await waitFor(socket, 'session:info');
  return { socket, extras: await Promise.all(extras) };
}

let seq = 0;
const student = (code, also) => join({ role: 'student', code, clientId: `client-feat-${String(seq++).padStart(4, '0')}` }, also);
const host = (code, hostToken, also) => join({ role: 'host', code, hostToken }, also);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('topics', () => {
  it('starts every session with an open "Intro" topic', () => {
    const { code } = createSession('Topics 101');
    const topics = q.topics.all(findSession(code).id);
    expect(topics).toHaveLength(1);
    expect(topics[0]).toMatchObject({ label: 'Intro', endedAt: null });
    expect(topics[0].startedAt).toBe(findSession(code).created_at);
  });

  it('sends the current topic to students and the full list to the host on connect', async () => {
    const { code, hostToken } = createSession('Connect');
    const h = await host(code, hostToken, ['topics:init']);
    const s = await student(code, ['topic:update']);
    expect(h.extras[0].map((t) => t.label)).toEqual(['Intro']);
    expect(s.extras[0]).toMatchObject({ label: 'Intro' });
  });

  it('host starts a topic: previous one is closed and everyone is told', async () => {
    const { code, hostToken } = createSession('Switch');
    const { socket: h } = await host(code, hostToken);
    const { socket: s } = await student(code, ['topic:update']);

    const toStudent = waitFor(s, 'topic:update', (t) => t.label === 'Recursion');
    const toHost = waitFor(h, 'topic:update');
    const ack = await h.emitWithAck('topic:start', { label: '  Recursion  ' });
    expect(ack).toMatchObject({ ok: true, topic: { label: 'Recursion' } });
    expect(await toStudent).toEqual(ack.topic);
    expect(await toHost).toEqual(ack.topic);

    const [intro, recursion] = q.topics.all(findSession(code).id);
    expect(intro.endedAt).toBe(recursion.startedAt);
    expect(recursion.endedAt).toBeNull();
  });

  it('treats restarting the current topic as a no-op', async () => {
    const { code, hostToken } = createSession('Idempotent');
    const { socket: h } = await host(code, hostToken);
    const ack = await h.emitWithAck('topic:start', { label: 'Intro' });
    expect(ack.ok).toBe(true);
    expect(q.topics.all(findSession(code).id)).toHaveLength(1);
  });

  it.each([[''], ['   '], ['x'.repeat(41)], [42], [undefined]])('rejects invalid label %j', async (label) => {
    const { code, hostToken } = createSession('Validation');
    const { socket: h } = await host(code, hostToken);
    expect(await h.emitWithAck('topic:start', { label })).toEqual({
      ok: false,
      error: 'Topic must be 1-40 characters',
    });
  });

  it('ignores topic:start from students', async () => {
    const { code } = createSession('Not yours');
    const { socket: s } = await student(code);
    s.emit('topic:start', { label: 'Hijack' });
    await sleep(100);
    expect(q.topics.all(findSession(code).id).map((t) => t.label)).toEqual(['Intro']);
  });

  it('closes the open topic when the session ends', () => {
    const { code } = createSession('Closing');
    const session = findSession(code);
    startTopic(session.id, 'Arrays');
    endSession(session);
    const ended = findSession(code);
    const topics = q.topics.all(session.id);
    expect(topics.map((t) => t.label)).toEqual(['Intro', 'Arrays']);
    expect(topics.every((t) => t.endedAt !== null)).toBe(true);
    expect(topics[1].endedAt).toBe(ended.ended_at);
  });
});

describe('losing-the-room alert', () => {
  it('alerts the host after sustained confusion, clears with hysteresis and records it', async () => {
    const { code, hostToken } = createSession('Alerting');
    const { socket: h } = await host(code, hostToken);
    const { socket: s } = await student(code);

    const lost = waitFor(h, 'alert:lost');
    const tappedAt = Date.now();
    await s.emitWithAck('feedback:send', { type: 'TOO_FAST' }); // 0.7 / 1 = 70
    const alert = await lost;
    expect(Date.now() - tappedAt).toBeGreaterThanOrEqual(ALERT_HOLD_MS);
    expect(alert).toMatchObject({ dominantType: 'TOO_FAST', suggestion: 'Slow down' });
    expect(alert.since).toBeGreaterThanOrEqual(tappedAt);

    const session = findSession(code);
    expect(q.alerts.all(session.id)).toMatchObject([{ dominantType: 'TOO_FAST', endedAt: null }]);

    // A reloaded dashboard is told about the alert that is still active.
    const reloaded = await host(code, hostToken, ['alert:lost']);
    expect(reloaded.extras[0]).toEqual(alert);

    // One more student: 70 / 2 = 35, below the exit threshold of 45.
    const cleared = waitFor(h, 'alert:clear');
    await student(code);
    await cleared;
    const [row] = q.alerts.all(session.id);
    expect(row.endedAt).toBeGreaterThanOrEqual(row.startedAt);

    // No second alert while the score stays low.
    let again = false;
    h.on('alert:lost', () => (again = true));
    await sleep(ALERT_HOLD_MS * 2);
    expect(again).toBe(false);
    expect(buildSummary(findSession(code))).toMatchObject({ alertCount: 1 });
  });

  it('closes an open alert when the session ends', async () => {
    const { code, hostToken } = createSession('Ends lost');
    const { socket: h } = await host(code, hostToken);
    const { socket: s } = await student(code);
    const lost = waitFor(h, 'alert:lost');
    await s.emitWithAck('feedback:send', { type: 'LOST' });
    expect(await lost).toMatchObject({ dominantType: 'LOST', suggestion: 'Pause and recap the last point' });

    endSession(findSession(code));
    const ended = findSession(code);
    expect(buildSummary(ended).alerts).toMatchObject([{ dominantType: 'LOST', endedAt: ended.ended_at }]);
  });
});

describe('quick-check polls', () => {
  it('runs a poll: one vote per client, live bars for the host, result for everyone', async () => {
    const { code, hostToken } = createSession('Polling');
    const { socket: h } = await host(code, hostToken);
    const { socket: a } = await student(code);
    const { socket: b } = await student(code);

    const started = waitFor(a, 'poll:started');
    const result = { a: waitFor(a, 'poll:result'), h: waitFor(h, 'poll:result') };
    const ack = await h.emitWithAck('poll:start', {});
    expect(ack).toMatchObject({ ok: true, poll: { question: 'Did that make sense?', durationMs: POLL_MS } });
    const poll = await started;
    expect(poll.id).toBe(ack.poll.id);
    expect(poll.remainingMs).toBeGreaterThan(0);

    // Only one poll at a time.
    expect(await h.emitWithAck('poll:start', { question: 'Another?' })).toEqual({
      ok: false,
      error: 'A poll is already running',
    });

    const live = waitFor(h, 'poll:update', (t) => t.total === 2);
    expect(await a.emitWithAck('poll:vote', { pollId: poll.id, choice: 'YES' })).toEqual({ ok: true });
    expect(await b.emitWithAck('poll:vote', { pollId: poll.id, choice: 'NO' })).toEqual({ ok: true });
    expect(await a.emitWithAck('poll:vote', { pollId: poll.id, choice: 'NO' })).toEqual({
      ok: false,
      error: 'Already voted',
    });
    expect(await b.emitWithAck('poll:vote', { pollId: poll.id, choice: 'MAYBE' })).toMatchObject({ ok: false });
    expect((await live).counts).toEqual({ YES: 1, UNSURE: 0, NO: 1 });

    const expected = { id: poll.id, question: 'Did that make sense?', counts: { YES: 1, UNSURE: 0, NO: 1 }, total: 2 };
    expect(await result.h).toEqual(expected);
    expect(await result.a).toEqual(expected);

    // Closed: late votes are refused, and a new poll may start.
    expect(await b.emitWithAck('poll:vote', { pollId: poll.id, choice: 'YES' })).toMatchObject({ ok: false });
    const summary = buildSummary(findSession(code));
    expect(summary.polls).toMatchObject([{ question: 'Did that make sense?', counts: expected.counts, total: 2 }]);
    expect(summary.polls[0].closedAt).toEqual(expect.any(Number));
    expect((await h.emitWithAck('poll:start', { question: 'Clear now?' })).ok).toBe(true);
  });

  it('shares the one vote across tabs of the same client, and skips the overlay if already voted', async () => {
    const { code, hostToken } = createSession('Two tabs poll');
    const { socket: h } = await host(code, hostToken);
    const auth = { role: 'student', code, clientId: 'client-poll-tabs-01' };
    const { socket: tabA } = await join(auth);
    const { socket: tabB } = await join(auth);

    const { poll } = await h.emitWithAck('poll:start', { question: 'Tabs?' });
    expect((await tabA.emitWithAck('poll:vote', { pollId: poll.id, choice: 'UNSURE' })).ok).toBe(true);
    expect((await tabB.emitWithAck('poll:vote', { pollId: poll.id, choice: 'YES' })).ok).toBe(false);

    // A third tab opened mid-poll is not asked again; a new student is.
    const { socket: tabC } = await join(auth);
    let asked = false;
    tabC.on('poll:started', () => (asked = true));
    const fresh = await student(code, ['poll:started']);
    expect(fresh.extras[0].id).toBe(poll.id);
    await sleep(60);
    expect(asked).toBe(false);
  });

  it('does not touch the score or the feedback cooldown', async () => {
    const { code, hostToken } = createSession('Independent');
    const { socket: h } = await host(code, hostToken);
    const { socket: s } = await student(code);
    const { poll } = await h.emitWithAck('poll:start', {});
    await s.emitWithAck('poll:vote', { pollId: poll.id, choice: 'NO' });

    const pulse = await waitFor(h, 'pulse:update');
    expect(pulse).toMatchObject({ score: 0, counts: { LOST: 0, TOO_FAST: 0, EXAMPLE: 0, GOT_IT: 0 } });
    // Voting did not start the 8s tap cooldown.
    expect(await s.emitWithAck('feedback:send', { type: 'GOT_IT' })).toEqual({ ok: true, cooldownMs: 8000 });
  });

  it('validates the question and rejects votes when no poll is running', async () => {
    const { code, hostToken } = createSession('Poll validation');
    const { socket: h } = await host(code, hostToken);
    const { socket: s } = await student(code);
    expect(await s.emitWithAck('poll:vote', { pollId: 1, choice: 'YES' })).toEqual({ ok: false, error: 'No active poll' });
    expect((await h.emitWithAck('poll:start', { question: 'x'.repeat(121) })).ok).toBe(false);
    expect((await h.emitWithAck('poll:start', { question: '   ' })).poll.question).toBe('Did that make sense?');
  });
});

describe('reactions', () => {
  it('floats to the host, has its own cooldown and is counted in the summary', async () => {
    const { code, hostToken } = createSession('Reacting');
    const { socket: h } = await host(code, hostToken);
    const { socket: a } = await student(code);
    const { socket: b } = await student(code);

    const seen = waitFor(h, 'reaction:new');
    expect(await a.emitWithAck('reaction:send', { emoji: '🔥' })).toEqual({ ok: true, cooldownMs: 3000 });
    expect(await seen).toEqual({ emoji: '🔥' });

    // 1 per 3s per client...
    const second = await a.emitWithAck('reaction:send', { emoji: '👏' });
    expect(second.ok).toBe(false);
    expect(second.retryInMs).toBeGreaterThan(0);
    expect(second.retryInMs).toBeLessThanOrEqual(3000);
    // ...but other clients are unaffected, and so is the feedback cooldown.
    expect((await b.emitWithAck('reaction:send', { emoji: '🔥' })).ok).toBe(true);
    expect((await a.emitWithAck('feedback:send', { type: 'GOT_IT' })).ok).toBe(true);
    expect(await a.emitWithAck('reaction:send', { emoji: '💩' })).toEqual({ ok: false, error: 'Invalid reaction' });

    const pulse = await waitFor(h, 'pulse:update', (p) => p.counts.GOT_IT === 1);
    expect(pulse.score).toBe(0);
    expect(buildSummary(findSession(code)).reactions).toEqual({ '🔥': 2, '🤯': 0, '😂': 0, '👏': 0 });
  });
});

describe('summary', () => {
  it('ranks topics and builds the headline insight', async () => {
    const res = await request(app).post('/api/sessions').send({ title: 'Data Structures' });
    const { code, hostToken } = res.body;
    const session = findSession(code);
    const t0 = session.created_at;

    // Rewrite the topic history: Intro 0-60s, Arrays 60-120s, Recursion 120s-end.
    q.closeOpenTopics.run(t0 + 60_000, session.id);
    q.insertTopic.run(session.id, 'Arrays', t0 + 60_000);
    q.closeOpenTopics.run(t0 + 120_000, session.id);
    q.insertTopic.run(session.id, 'Recursion', t0 + 120_000);

    [[15, 5], [45, 7], [75, 20], [105, 24], [135, 60], [165, 76.4]].forEach(([sec, score]) =>
      q.insertTimeline.run(session.id, t0 + sec * 1000, Math.round(score)),
    );
    [[10, 'GOT_IT'], [70, 'EXAMPLE'], [80, 'LOST'], [130, 'LOST'], [140, 'LOST'], [150, 'TOO_FAST']].forEach(
      ([sec, type], i) => q.insertFeedback.run(session.id, type, `c${i}`, t0 + sec * 1000),
    );
    q.endSession.run(t0 + 180_000, session.id);
    q.closeOpenTopics.run(t0 + 180_000, session.id);

    const { body } = await request(app).get(`/api/sessions/${code}/summary`).set('x-host-token', hostToken);
    expect(body.topics.map((t) => t.label)).toEqual(['Intro', 'Arrays', 'Recursion']);
    expect(body.topicRanking.map((t) => [t.label, t.avgScore, t.peakScore, t.taps, t.durationMs])).toEqual([
      ['Recursion', 68, 76, 3, 60_000],
      ['Arrays', 22, 24, 2, 60_000],
      ['Intro', 6, 7, 1, 60_000],
    ]);
    expect(body.topicInsight).toBe('Recursion was 11.3× more confusing than Intro.');
    expect(body).toMatchObject({ alerts: [], alertCount: 0, polls: [], reactions: { '🔥': 0, '🤯': 0, '😂': 0, '👏': 0 } });
  });

  it('has no insight for a session with a single topic', async () => {
    const { code } = createSession('Short');
    expect(buildSummary(findSession(code))).toMatchObject({ topicInsight: null, topics: [{ label: 'Intro' }] });
  });
});

import { q } from './db.js';
import { ALERT_HOLD_MS, SUGGESTIONS, createAlertState, dominantConfusion, stepAlert } from './lib/alert.js';
import {
  POLL_CHOICES,
  POLL_DURATION_MS,
  REACTIONS,
  REACTION_COOLDOWN_MS,
  emptyPollCounts,
  validateLabel,
  validateQuestion,
} from './lib/interactions.js';
import { COOLDOWN_MS, FEEDBACK_TYPES, WINDOW_MS, computePulse, pruneWindow } from './lib/pulse.js';
import { hashClientId } from './lib/security.js';
import {
  bus,
  findSession,
  normalizeCode,
  publicSession,
  startTopic,
  verifyHost,
} from './lib/sessionService.js';

const studentRoom = (code) => `students:${code}`;
const hostRoom = (code) => `hosts:${code}`;
const bothRooms = (code) => [studentRoom(code), hostRoom(code)];
const replier = (ack) => (typeof ack === 'function' ? ack : () => {});

export function attachSockets(
  io,
  {
    pulseIntervalMs = 2000,
    timelineIntervalMs = 15000,
    alertHoldMs = ALERT_HOLD_MS,
    pollDurationMs = POLL_DURATION_MS,
    reactionCooldownMs = REACTION_COOLDOWN_MS,
  } = {},
) {
  // code -> per-session live state.
  // Exists only while at least one socket is connected to an active session.
  const live = new Map();

  function getState(session) {
    let state = live.get(session.code);
    if (!state) {
      // Rebuild the rolling window from the DB so a server restart (or everyone
      // briefly disconnecting) loses neither the score nor running cooldowns.
      const events = q.recentFeedback.all(session.id, Date.now() - WINDOW_MS);
      const openAlert = q.openAlert.get(session.id);
      state = {
        sessionId: session.id,
        code: session.code,
        events,
        cooldowns: new Map(events.map((event) => [event.clientHash, event.ts])),
        reactionCooldowns: new Map(),
        students: new Map(), // clientHash -> Set of socket ids (one student, many tabs)
        hosts: new Set(),
        // Highest score seen so far; survives the state being dropped and rebuilt.
        peak: session.peak_score === null ? null : { score: session.peak_score, ts: session.peak_at },
        alert: openAlert ? { active: true, aboveSince: openAlert.startedAt } : createAlertState(),
        alertRow: openAlert
          ? {
              id: openAlert.id,
              payload: {
                since: openAlert.startedAt,
                dominantType: openAlert.dominantType,
                suggestion: SUGGESTIONS[openAlert.dominantType],
              },
            }
          : null,
        poll: null,
      };
      live.set(session.code, state);
    }
    return state;
  }

  function pulseOf(state, now = Date.now()) {
    state.events = pruneWindow(state.events, now);
    const pulse = computePulse(state.events, state.students.size, now);
    // Every computation (2s pulse, 15s timeline sample, final sample) feeds the
    // peak, so a spike that rises and falls between two timeline samples is kept.
    if (pulse.score > (state.peak?.score ?? 0)) state.peak = { score: pulse.score, ts: now };
    return pulse;
  }

  function persistPeak(state) {
    if (state.peak) q.raisePeak.run({ id: state.sessionId, score: state.peak.score, ts: state.peak.ts });
  }

  // Runs on the 2s pulse loop only, so "20 seconds" is measured on a steady clock.
  function checkAlert(state, pulse) {
    const { state: next, event } = stepAlert(state.alert, pulse.score, pulse.ts, alertHoldMs);
    state.alert = next;
    if (event === 'lost') {
      const dominantType = dominantConfusion(pulse.counts);
      const payload = { since: next.aboveSince, dominantType, suggestion: SUGGESTIONS[dominantType] };
      const { lastInsertRowid } = q.insertAlert.run(state.sessionId, pulse.ts, dominantType);
      state.alertRow = { id: Number(lastInsertRowid), payload };
      io.to(hostRoom(state.code)).emit('alert:lost', payload);
    } else if (event === 'clear') {
      if (state.alertRow) q.closeAlert.run(pulse.ts, state.alertRow.id);
      state.alertRow = null;
      io.to(hostRoom(state.code)).emit('alert:clear', { ts: pulse.ts });
    }
  }

  const pollStart = (poll) => ({
    id: poll.id,
    question: poll.question,
    durationMs: poll.endsAt - poll.startedAt,
    // Remaining time rather than an absolute timestamp: client clocks can be wrong.
    remainingMs: Math.max(0, poll.endsAt - Date.now()),
  });

  const pollTally = (poll) => ({
    id: poll.id,
    question: poll.question,
    counts: { ...poll.counts },
    total: POLL_CHOICES.reduce((sum, choice) => sum + poll.counts[choice], 0),
  });

  function closePoll(state, now = Date.now(), announce = true) {
    const poll = state.poll;
    if (!poll) return;
    clearTimeout(poll.timer);
    state.poll = null;
    q.closePoll.run(now, poll.id);
    if (announce) io.to(bothRooms(state.code)).emit('poll:result', pollTally(poll));
  }

  function release(state) {
    if (state.students.size === 0 && state.hosts.size === 0 && live.get(state.code) === state) {
      persistPeak(state); // the room emptied before the session ended: don't lose the peak
      closePoll(state, Date.now(), false);
      live.delete(state.code);
    }
  }

  const pulseTimer = setInterval(() => {
    for (const state of live.values()) {
      // Computed even with no host watching, so the peak and alerts are tracked regardless.
      const pulse = pulseOf(state);
      if (state.hosts.size > 0) io.to(hostRoom(state.code)).emit('pulse:update', pulse);
      checkAlert(state, pulse);
    }
  }, pulseIntervalMs);

  const timelineTimer = setInterval(() => {
    const now = Date.now();
    for (const state of live.values()) {
      const { score } = pulseOf(state, now);
      q.insertTimeline.run(state.sessionId, now, score);
      io.to(hostRoom(state.code)).emit('timeline:point', { ts: now, score });
      for (const [clientHash, ts] of state.cooldowns) {
        if (now - ts > COOLDOWN_MS) state.cooldowns.delete(clientHash);
      }
      for (const [clientHash, ts] of state.reactionCooldowns) {
        if (now - ts > reactionCooldownMs) state.reactionCooldowns.delete(clientHash);
      }
    }
  }, timelineIntervalMs);

  pulseTimer.unref();
  timelineTimer.unref();

  const onSessionEnded = ({ code, endedAt }) => {
    const state = live.get(code);
    if (state) {
      // Final sample so even very short sessions have a timeline.
      q.insertTimeline.run(state.sessionId, endedAt, pulseOf(state, endedAt).score);
      persistPeak(state);
      closePoll(state, endedAt);
      live.delete(code);
    }
    io.to(bothRooms(code)).emit('session:ended', { code });
  };
  bus.on('session:ended', onSessionEnded);

  io.on('connection', (socket) => {
    const { role, code: rawCode, clientId, hostToken } = socket.handshake.auth ?? {};
    const fail = (message) => {
      socket.emit('session:error', { message });
      socket.disconnect();
    };

    const code = normalizeCode(rawCode);
    const session = code && findSession(code);
    if (!session) return fail('Session not found');
    const info = publicSession(session);

    if (role === 'host') {
      // Host auth: the token from the handshake must hash to the stored value.
      if (!verifyHost(session, hostToken)) return fail('Invalid host token');
      socket.emit('session:info', info);
      if (!info.active) return socket.disconnect();

      const state = getState(session);
      const isLive = () => live.get(code) === state;
      state.hosts.add(socket.id);
      socket.join(hostRoom(code));
      socket.emit('timeline:init', q.timeline.all(session.id));
      socket.emit('topics:init', q.topics.all(session.id));
      socket.emit('pulse:update', pulseOf(state));
      // A reloaded dashboard must still show what is going on right now.
      if (state.alertRow) socket.emit('alert:lost', state.alertRow.payload);
      if (state.poll) {
        socket.emit('poll:started', pollStart(state.poll));
        socket.emit('poll:update', pollTally(state.poll));
      }

      socket.on('topic:start', (payload, ack) => {
        const reply = replier(ack);
        const label = validateLabel(payload?.label);
        if (!label) return reply({ ok: false, error: 'Topic must be 1-40 characters' });
        if (!isLive()) return reply({ ok: false, error: 'Session has ended' });
        const { topic, created } = startTopic(state.sessionId, label);
        if (created) io.to(bothRooms(code)).emit('topic:update', topic);
        reply({ ok: true, topic });
      });

      socket.on('poll:start', (payload, ack) => {
        const reply = replier(ack);
        const question = validateQuestion(payload?.question);
        if (!question) return reply({ ok: false, error: 'Question must be at most 120 characters' });
        if (!isLive()) return reply({ ok: false, error: 'Session has ended' });
        if (state.poll) return reply({ ok: false, error: 'A poll is already running' });

        const startedAt = Date.now();
        const { lastInsertRowid } = q.insertPoll.run(state.sessionId, question, startedAt);
        const poll = {
          id: Number(lastInsertRowid),
          question,
          startedAt,
          endsAt: startedAt + pollDurationMs,
          counts: emptyPollCounts(),
        };
        poll.timer = setTimeout(() => closePoll(state), pollDurationMs);
        poll.timer.unref();
        state.poll = poll;
        io.to(bothRooms(code)).emit('poll:started', pollStart(poll));
        reply({ ok: true, poll: pollStart(poll) });
      });

      socket.on('disconnect', () => {
        state.hosts.delete(socket.id);
        release(state);
      });
      return;
    }

    if (role !== 'student') return fail('Invalid role');
    if (typeof clientId !== 'string' || clientId.length < 8 || clientId.length > 100) {
      return fail('Invalid client id');
    }
    socket.emit('session:info', info);
    if (!info.active) return socket.disconnect();

    const clientHash = hashClientId(clientId);
    const state = getState(session);
    const isLive = () => live.get(code) === state;
    const emitPresence = () =>
      io.to(hostRoom(code)).emit('presence:update', { activeStudents: state.students.size });

    // Presence counts people, not connections: extra tabs from the same
    // browser share one clientHash and therefore one seat in the room.
    const tabs = state.students.get(clientHash) ?? new Set();
    tabs.add(socket.id);
    state.students.set(clientHash, tabs);
    socket.join(studentRoom(code));
    emitPresence();

    const topic = q.openTopic.get(session.id);
    if (topic) socket.emit('topic:update', topic);
    // Late joiners still get the running poll, unless they already voted in another tab.
    if (state.poll && !q.hasVoted.get(state.poll.id, clientHash)) {
      socket.emit('poll:started', pollStart(state.poll));
    }

    socket.on('feedback:send', (payload, ack) => {
      const reply = replier(ack);
      const type = payload?.type;
      if (!FEEDBACK_TYPES.includes(type)) return reply({ ok: false, error: 'Invalid feedback type' });

      // State is dropped the moment a session ends, so a missing/replaced entry means "ended".
      if (!isLive()) {
        socket.emit('feedback:rejected', { retryInMs: 0, reason: 'ended' });
        return reply({ ok: false, error: 'Session has ended' });
      }

      // Cooldown is enforced here, keyed by the hashed client (not the socket),
      // so opening extra tabs or reconnecting does not buy extra taps.
      const now = Date.now();
      const retryInMs = (state.cooldowns.get(clientHash) ?? 0) + COOLDOWN_MS - now;
      if (retryInMs > 0) {
        socket.emit('feedback:rejected', { retryInMs, reason: 'cooldown' });
        return reply({ ok: false, retryInMs });
      }

      state.cooldowns.set(clientHash, now);
      state.events.push({ type, clientHash, ts: now });
      q.insertFeedback.run(state.sessionId, type, clientHash, now);
      reply({ ok: true, cooldownMs: COOLDOWN_MS });
    });

    socket.on('poll:vote', (payload, ack) => {
      const reply = replier(ack);
      const poll = isLive() ? state.poll : null;
      if (!poll || payload?.pollId !== poll.id) return reply({ ok: false, error: 'No active poll' });
      const choice = payload?.choice;
      if (!POLL_CHOICES.includes(choice)) return reply({ ok: false, error: 'Invalid choice' });
      try {
        // One vote per client per poll is guaranteed by UNIQUE (poll_id, client_hash),
        // not by an in-memory check, so it holds across tabs, reconnects and races.
        q.insertVote.run(poll.id, clientHash, choice, Date.now());
      } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return reply({ ok: false, error: 'Already voted' });
        throw err;
      }
      poll.counts[choice] += 1;
      io.to(hostRoom(code)).emit('poll:update', pollTally(poll));
      reply({ ok: true });
    });

    socket.on('reaction:send', (payload, ack) => {
      const reply = replier(ack);
      const emoji = payload?.emoji;
      if (!REACTIONS.includes(emoji)) return reply({ ok: false, error: 'Invalid reaction' });
      if (!isLive()) return reply({ ok: false, error: 'Session has ended' });

      // Own, shorter cooldown: reactions are for fun and never touch the score.
      const now = Date.now();
      const retryInMs = (state.reactionCooldowns.get(clientHash) ?? 0) + reactionCooldownMs - now;
      if (retryInMs > 0) return reply({ ok: false, retryInMs });

      state.reactionCooldowns.set(clientHash, now);
      q.addReaction.run(state.sessionId, emoji);
      io.to(hostRoom(code)).emit('reaction:new', { emoji });
      reply({ ok: true, cooldownMs: reactionCooldownMs });
    });

    socket.on('disconnect', () => {
      tabs.delete(socket.id);
      if (tabs.size === 0 && state.students.get(clientHash) === tabs) state.students.delete(clientHash);
      emitPresence();
      release(state);
    });
  });

  return {
    stop() {
      clearInterval(pulseTimer);
      clearInterval(timelineTimer);
      bus.off('session:ended', onSessionEnded);
      for (const state of live.values()) clearTimeout(state.poll?.timer);
      live.clear();
    },
  };
}

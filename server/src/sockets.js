import { q } from './db.js';
import { COOLDOWN_MS, FEEDBACK_TYPES, WINDOW_MS, computePulse, pruneWindow } from './lib/pulse.js';
import { hashClientId } from './lib/security.js';
import { bus, findSession, normalizeCode, publicSession, verifyHost } from './lib/sessionService.js';

const studentRoom = (code) => `students:${code}`;
const hostRoom = (code) => `hosts:${code}`;

export function attachSockets(io, { pulseIntervalMs = 2000, timelineIntervalMs = 15000 } = {}) {
  // code -> { sessionId, code, events, cooldowns, students, hosts }
  // Exists only while at least one socket is connected to an active session.
  const live = new Map();

  function getState(session) {
    let state = live.get(session.code);
    if (!state) {
      // Rebuild the rolling window from the DB so a server restart (or everyone
      // briefly disconnecting) loses neither the score nor running cooldowns.
      const events = q.recentFeedback.all(session.id, Date.now() - WINDOW_MS);
      state = {
        sessionId: session.id,
        code: session.code,
        events,
        cooldowns: new Map(events.map((event) => [event.clientHash, event.ts])),
        students: new Map(), // clientHash -> Set of socket ids (one student, many tabs)
        hosts: new Set(),
      };
      live.set(session.code, state);
    }
    return state;
  }

  function pulseOf(state, now = Date.now()) {
    state.events = pruneWindow(state.events, now);
    return computePulse(state.events, state.students.size, now);
  }

  function release(state) {
    if (state.students.size === 0 && state.hosts.size === 0 && live.get(state.code) === state) {
      live.delete(state.code);
    }
  }

  const pulseTimer = setInterval(() => {
    for (const state of live.values()) {
      if (state.hosts.size > 0) io.to(hostRoom(state.code)).emit('pulse:update', pulseOf(state));
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
    }
  }, timelineIntervalMs);

  pulseTimer.unref();
  timelineTimer.unref();

  const onSessionEnded = ({ code, endedAt }) => {
    const state = live.get(code);
    if (state) {
      // Final sample so even very short sessions have a timeline.
      q.insertTimeline.run(state.sessionId, endedAt, pulseOf(state, endedAt).score);
      live.delete(code);
    }
    io.to([studentRoom(code), hostRoom(code)]).emit('session:ended', { code });
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
      state.hosts.add(socket.id);
      socket.join(hostRoom(code));
      socket.emit('timeline:init', q.timeline.all(session.id));
      socket.emit('pulse:update', pulseOf(state));
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
    const emitPresence = () =>
      io.to(hostRoom(code)).emit('presence:update', { activeStudents: state.students.size });

    // Presence counts people, not connections: extra tabs from the same
    // browser share one clientHash and therefore one seat in the room.
    const tabs = state.students.get(clientHash) ?? new Set();
    tabs.add(socket.id);
    state.students.set(clientHash, tabs);
    socket.join(studentRoom(code));
    emitPresence();

    socket.on('feedback:send', (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const type = payload?.type;
      if (!FEEDBACK_TYPES.includes(type)) return reply({ ok: false, error: 'Invalid feedback type' });

      // State is dropped the moment a session ends, so a missing/replaced entry means "ended".
      if (live.get(code) !== state) {
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
      live.clear();
    },
  };
}

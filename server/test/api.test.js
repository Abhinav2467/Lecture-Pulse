import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { q } from '../src/db.js';
import { INACTIVITY_MS, endStaleSessions, findSession } from '../src/lib/sessionService.js';

const app = createApp({ createLimit: 1000 });

async function createSession(title = 'Linear Algebra') {
  const res = await request(app).post('/api/sessions').send({ title });
  return res.body;
}

describe('GET /api/health', () => {
  it('responds ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('POST /api/sessions', () => {
  it('creates a session with an unambiguous code and a host token', async () => {
    const res = await request(app).post('/api/sessions').send({ title: '  Intro to Graphs  ' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Intro to Graphs');
    expect(res.body.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(res.body.hostToken).toHaveLength(32);
  });

  it('stores only a hash of the host token', async () => {
    const { code, hostToken } = await createSession();
    const row = findSession(code);
    expect(row.host_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(row)).not.toContain(hostToken);
  });

  it.each([[{}], [{ title: '' }], [{ title: '   ' }], [{ title: 'x'.repeat(81) }], [{ title: 42 }]])(
    'rejects invalid body %j',
    async (body) => {
      const res = await request(app).post('/api/sessions').send(body);
      expect(res.status).toBe(400);
      expect(res.body.error).toEqual(expect.any(String));
    },
  );

  it('rejects malformed JSON with the standard error shape', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Content-Type', 'application/json')
      .send('{"title":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid JSON body' });
  });

  it('rate-limits session creation per IP', async () => {
    const limited = createApp({ createLimit: 2 });
    const statuses = [];
    for (let i = 0; i < 3; i++) {
      statuses.push((await request(limited).post('/api/sessions').send({ title: 'Spam' })).status);
    }
    expect(statuses).toEqual([201, 201, 429]);
  });
});

describe('GET /api/sessions/:code', () => {
  it('returns public info without secrets', async () => {
    const { code } = await createSession('Thermodynamics');
    const res = await request(app).get(`/api/sessions/${code.toLowerCase()}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ code, title: 'Thermodynamics', active: true });
  });

  it('returns 404 for unknown or malformed codes', async () => {
    for (const code of ['ZZZZZZ', 'nope', 'O0I1O0']) {
      const res = await request(app).get(`/api/sessions/${code}`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Session not found' });
    }
  });
});

describe('POST /api/sessions/:code/end', () => {
  it('requires a valid host token', async () => {
    const { code } = await createSession();
    const missing = await request(app).post(`/api/sessions/${code}/end`);
    const wrong = await request(app).post(`/api/sessions/${code}/end`).set('x-host-token', 'x'.repeat(32));
    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(wrong.body.error).toEqual(expect.any(String));
    expect((await request(app).get(`/api/sessions/${code}`)).body.active).toBe(true);
  });

  it("does not accept another session's token", async () => {
    const a = await createSession('A');
    const b = await createSession('B');
    const res = await request(app).post(`/api/sessions/${a.code}/end`).set('x-host-token', b.hostToken);
    expect(res.status).toBe(401);
  });

  it('ends the session and is idempotent', async () => {
    const { code, hostToken } = await createSession();
    const first = await request(app).post(`/api/sessions/${code}/end`).set('x-host-token', hostToken);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ ok: true });
    const endedAt = findSession(code).ended_at;
    expect(endedAt).toEqual(expect.any(Number));

    const second = await request(app).post(`/api/sessions/${code}/end`).set('x-host-token', hostToken);
    expect(second.status).toBe(200);
    expect(findSession(code).ended_at).toBe(endedAt);
    expect((await request(app).get(`/api/sessions/${code}`)).body.active).toBe(false);
  });
});

describe('GET /api/sessions/:code/summary', () => {
  it('requires the host token', async () => {
    const { code } = await createSession();
    expect((await request(app).get(`/api/sessions/${code}/summary`)).status).toBe(401);
  });

  it('returns 404 for a missing session', async () => {
    const res = await request(app).get('/api/sessions/ZZZZZZ/summary').set('x-host-token', 'whatever');
    expect(res.status).toBe(404);
  });

  it('aggregates feedback and the timeline', async () => {
    const { code, hostToken } = await createSession('Signals');
    const session = findSession(code);
    const t0 = session.created_at;

    const taps = [['c1', 'LOST'], ['c1', 'LOST'], ['c2', 'TOO_FAST'], ['c3', 'GOT_IT'], ['c3', 'EXAMPLE']];
    taps.forEach(([client, type], i) => q.insertFeedback.run(session.id, type, client, t0 + i * 1000));
    [10, 80, 0, 45, 60].forEach((score, i) => q.insertTimeline.run(session.id, t0 + (i + 1) * 15000, score));

    await request(app).post(`/api/sessions/${code}/end`).set('x-host-token', hostToken);
    const res = await request(app).get(`/api/sessions/${code}/summary`).set('x-host-token', hostToken);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: 'Signals',
      createdAt: t0,
      uniqueParticipants: 3,
      totals: { LOST: 2, TOO_FAST: 1, EXAMPLE: 1, GOT_IT: 1 },
      peakScore: 80,
      peakAt: t0 + 30000,
      avgScore: 39,
    });
    expect(res.body.endedAt).toBeGreaterThanOrEqual(t0);
    expect(res.body.durationMs).toBe(res.body.endedAt - t0);
    expect(res.body.timeline).toHaveLength(5);
    expect(res.body.topConfusionMoments.map((p) => p.score)).toEqual([80, 60, 45]);
    expect(res.body).not.toHaveProperty('host_token_hash');
  });

  it('prefers the stored peak over the sampled timeline', async () => {
    const { code, hostToken } = await createSession('Spiky');
    const session = findSession(code);
    const t0 = session.created_at;
    // A spike to 90 happened between the 15s samples, which only saw 20 and 40.
    q.insertTimeline.run(session.id, t0 + 15000, 20);
    q.insertTimeline.run(session.id, t0 + 30000, 40);
    q.raisePeak.run({ id: session.id, score: 90, ts: t0 + 22000 });

    const res = await request(app).get(`/api/sessions/${code}/summary`).set('x-host-token', hostToken);
    expect(res.body).toMatchObject({ peakScore: 90, peakAt: t0 + 22000, avgScore: 30 });
  });

  it('falls back to the timeline max when no peak is stored, or the stored one is lower', async () => {
    const { code, hostToken } = await createSession('Legacy');
    const session = findSession(code);
    const t0 = session.created_at;
    q.insertTimeline.run(session.id, t0 + 15000, 35);
    q.insertTimeline.run(session.id, t0 + 30000, 70);
    const summary = () => request(app).get(`/api/sessions/${code}/summary`).set('x-host-token', hostToken);

    expect(session.peak_score).toBeNull();
    expect((await summary()).body).toMatchObject({ peakScore: 70, peakAt: t0 + 30000 });

    q.raisePeak.run({ id: session.id, score: 50, ts: t0 + 5000 });
    expect((await summary()).body).toMatchObject({ peakScore: 70, peakAt: t0 + 30000 });
  });

  it('never lowers a stored peak', async () => {
    const { code } = await createSession('Monotonic');
    const { id } = findSession(code);
    q.raisePeak.run({ id, score: 80, ts: 1000 });
    q.raisePeak.run({ id, score: 60, ts: 2000 });
    expect(findSession(code)).toMatchObject({ peak_score: 80, peak_at: 1000 });
  });

  it('returns zeroed stats for a session with no data', async () => {
    const { code, hostToken } = await createSession();
    const res = await request(app).get(`/api/sessions/${code}/summary`).set('x-host-token', hostToken);
    expect(res.body).toMatchObject({
      endedAt: null,
      uniqueParticipants: 0,
      totals: { LOST: 0, TOO_FAST: 0, EXAMPLE: 0, GOT_IT: 0 },
      peakScore: 0,
      peakAt: null,
      avgScore: 0,
      timeline: [],
      topConfusionMoments: [],
    });
  });
});

describe('unknown API routes', () => {
  it('return a JSON 404', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});

describe('endStaleSessions', () => {
  it('auto-ends only sessions inactive for 3h', async () => {
    const idle = await createSession('Idle');
    const busy = await createSession('Busy');
    const later = Date.now() + INACTIVITY_MS + 60_000;
    // "busy" got feedback recently relative to `later`.
    q.insertFeedback.run(findSession(busy.code).id, 'LOST', 'c1', later - 1000);

    endStaleSessions(later);

    expect(findSession(idle.code).ended_at).toBe(later);
    expect(findSession(busy.code).ended_at).toBeNull();
  });
});

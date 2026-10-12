import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { CODE_LENGTH, sanitizeCode } from '../lib/constants.js';
import { saveHostSession } from '../lib/storage.js';

export default function Home() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  async function handleCreate(event) {
    event.preventDefault();
    if (!title.trim() || creating) return;
    setCreating(true);
    setCreateError('');
    try {
      const session = await api.createSession(title.trim());
      saveHostSession(session);
      navigate(`/host/${session.code}`);
    } catch (err) {
      setCreateError(err.message);
      setCreating(false);
    }
  }

  function handleJoin(event) {
    event.preventDefault();
    if (code.length === CODE_LENGTH) navigate(`/join/${code}`);
  }

  return (
    <>
      <section className="hero">
        <h1>
          Know when you&apos;ve <em>lost the room</em>.
        </h1>
        <p>Anonymous, one-tap feedback from students. A live confusion meter for the lecturer.</p>
      </section>

      <div className="home-grid">
        <section className="card" aria-labelledby="start-title">
          <h2 id="start-title" className="card__title">Start a session</h2>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="title">Lecture title</label>
              <input
                id="title"
                className="input"
                value={title}
                maxLength={80}
                placeholder="e.g. CS201 · Recursion"
                autoComplete="off"
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn--primary" disabled={!title.trim() || creating}>
              {creating ? 'Starting…' : 'Start session'}
            </button>
            <p className="form-error" role="alert">{createError}</p>
          </form>
        </section>

        <section className="card" aria-labelledby="join-title">
          <h2 id="join-title" className="card__title">Join a session</h2>
          <form onSubmit={handleJoin}>
            <div className="field">
              <label htmlFor="code">6-character code</label>
              <input
                id="code"
                className="input input--code"
                value={code}
                placeholder="ABC234"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                onChange={(e) => setCode(sanitizeCode(e.target.value))}
              />
            </div>
            <button type="submit" className="btn" disabled={code.length !== CODE_LENGTH}>
              Join
            </button>
            <p className="form-error" />
          </form>
        </section>
      </div>
    </>
  );
}

import { useState } from 'react';
import { useCountdown } from '../hooks/useCountdown.js';
import { QUESTION_MAX } from '../lib/constants.js';
import PollBars from './PollBars.jsx';
import Button from './ui/Button.jsx';

/**
 * Host poll control. poll: null | { id, question, endsAt, counts, total, live }
 * `onStart(question)` is also what the P shortcut calls (with no question).
 */
export default function PollPanel({ poll, onStart, error, disabled }) {
  const [question, setQuestion] = useState('');
  const remainingMs = useCountdown(poll?.live ? poll.endsAt : 0);
  const live = Boolean(poll?.live);

  function handleSubmit(event) {
    event.preventDefault();
    onStart(question);
    setQuestion('');
  }

  return (
    <section className={`card ${live ? 'poll--live' : ''}`} aria-label="Quick-check poll">
      <h2 className="card-title">
        <span>Quick check</span>
        <kbd>P</kbd>
      </h2>

      {poll && (
        <>
          <div className="poll-live-head">
            <em>{poll.question}</em>
            <span role="timer">{live ? `${Math.ceil(remainingMs / 1000)}s left` : 'Final'}</span>
          </div>
          <PollBars counts={poll.counts} total={poll.total} />
          <p className="hint poll-foot" aria-live="polite">
            {poll.total} {poll.total === 1 ? 'vote' : 'votes'}
          </p>
        </>
      )}

      {!live && (
        <form onSubmit={handleSubmit} style={poll ? { marginTop: 14 } : undefined}>
          <label htmlFor="poll-question" className="sr-only">Poll question (optional)</label>
          <div className="input-row">
            <input
              id="poll-question"
              className="input"
              value={question}
              maxLength={QUESTION_MAX}
              placeholder="Question (optional)"
              autoComplete="off"
              onChange={(event) => setQuestion(event.target.value)}
            />
            <Button type="submit" variant="ghost" disabled={disabled}>{poll ? 'Ask again' : 'Ask'}</Button>
          </div>
          <p className="form-error" role="alert">{error}</p>
          {!poll && <p className="hint">15 seconds, one anonymous vote each. It never affects the score.</p>}
        </form>
      )}
    </section>
  );
}

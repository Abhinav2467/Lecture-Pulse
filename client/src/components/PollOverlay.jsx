import { useCountdown } from '../hooks/useCountdown.js';
import { POLL_CHOICES } from '../lib/constants.js';
import PollBars from './PollBars.jsx';

/**
 * Full-screen quick-check for students.
 * poll: { id, question, endsAt, durationMs, voted, result }
 */
export default function PollOverlay({ poll, onVote }) {
  const remainingMs = useCountdown(poll.endsAt);
  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <div className="poll-overlay" role="dialog" aria-modal="true" aria-label="Quick check">
      <span className="poll-eyebrow">Quick check</span>
      <h2>
        <em>{poll.question}</em>
      </h2>

      {poll.result ? (
        <>
          <PollBars counts={poll.result.counts} total={poll.result.total} />
          <p className="muted">
            {poll.result.total} {poll.result.total === 1 ? 'vote' : 'votes'}
          </p>
        </>
      ) : (
        <>
          <div className="poll-choices">
            {POLL_CHOICES.map(({ key, emoji, label }) => (
              <button
                key={key}
                type="button"
                className={`poll-choice ${poll.voted === key ? 'is-picked' : ''}`}
                disabled={Boolean(poll.voted)}
                onClick={() => onVote(key)}
              >
                <span aria-hidden="true">{emoji}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="poll-timer" role="timer" aria-label={`${seconds} seconds left`}>
            <div className="poll-timer-track">
              <div className="poll-timer-fill" style={{ width: `${(remainingMs / poll.durationMs) * 100}%` }} />
            </div>
            <p className="poll-timer-text">{poll.voted ? `Thanks — results in ${seconds}s` : `${seconds}s left`}</p>
          </div>
        </>
      )}
    </div>
  );
}

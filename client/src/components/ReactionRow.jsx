import { useEffect, useState } from 'react';
import { REACTIONS, REACTION_COOLDOWN_MS } from '../lib/constants.js';

const NAMES = { '🔥': 'Fire', '🤯': 'Mind blown', '😂': 'Funny', '👏': 'Applause' };

// Just-for-fun reactions. The 3s limit is enforced by the server; this mirrors it.
export default function ReactionRow({ disabled, emit }) {
  const [lockedUntil, setLockedUntil] = useState(0);
  const locked = lockedUntil > Date.now();

  useEffect(() => {
    if (!lockedUntil) return undefined;
    const id = setTimeout(() => setLockedUntil(0), Math.max(0, lockedUntil - Date.now()));
    return () => clearTimeout(id);
  }, [lockedUntil]);

  function send(emoji) {
    setLockedUntil(Date.now() + REACTION_COOLDOWN_MS);
    emit('reaction:send', { emoji }, (res) => {
      if (!res?.ok && res?.retryInMs > 0) setLockedUntil(Date.now() + res.retryInMs);
    });
  }

  return (
    <div className="reactions-row" role="group" aria-label="Send a reaction">
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="reaction-btn"
          aria-label={NAMES[emoji]}
          disabled={disabled || locked}
          onClick={() => send(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

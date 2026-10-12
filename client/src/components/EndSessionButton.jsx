import { useState } from 'react';

// Two-step inline confirm instead of a modal.
export default function EndSessionButton({ onConfirm, busy = false, error = null }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="end-box">
      {confirming ? (
        <>
          <p className="muted">End the session for everyone? This cannot be undone.</p>
          <div className="row">
            <button type="button" className="btn btn--danger" disabled={busy} onClick={onConfirm}>
              {busy ? 'Ending…' : 'Yes, end session'}
            </button>
            <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="btn btn--danger btn--block" onClick={() => setConfirming(true)}>
          End session
        </button>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

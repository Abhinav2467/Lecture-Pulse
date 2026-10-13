import { useState } from 'react';
import Button from './ui/Button.jsx';
import Modal from './ui/Modal.jsx';

export default function EndSessionButton({ onConfirm, busy = false, error = null }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Button variant="ghost" block className="btn-danger" onClick={() => setConfirming(true)}>
        End session
      </Button>
      {confirming && (
        <Modal
          title={<>End the <em>session?</em></>}
          description="Students are disconnected and no more feedback is accepted. You get the summary straight away. This cannot be undone."
          onClose={() => !busy && setConfirming(false)}
        >
          <p className="form-error" role="alert">{error}</p>
          <div className="modal-actions">
            <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>Keep going</Button>
            <Button disabled={busy} onClick={onConfirm}>{busy ? 'Ending…' : 'End session'}</Button>
          </div>
        </Modal>
      )}
    </>
  );
}

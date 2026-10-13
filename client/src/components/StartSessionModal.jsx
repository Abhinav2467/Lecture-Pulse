import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { saveHostSession } from '../lib/storage.js';
import Button from './ui/Button.jsx';
import Modal from './ui/Modal.jsx';

export default function StartSessionModal({ onClose }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const session = await api.createSession(title.trim());
      saveHostSession(session);
      navigate(`/host/${session.code}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={<>Start a <em>session</em></>}
      description="Give the lecture a title. You get a code and a QR for students straight away."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="session-title">Session title</label>
          <input
            id="session-title"
            className="input"
            value={title}
            maxLength={80}
            placeholder="e.g. CS201 · Recursion"
            autoComplete="off"
            autoFocus
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <p className="form-error" role="alert">{error}</p>
        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!title.trim() || busy}>{busy ? 'Starting…' : 'Start session'}</Button>
        </div>
      </form>
    </Modal>
  );
}

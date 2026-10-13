import { useState } from 'react';
import { TOPIC_MAX } from '../lib/constants.js';
import Button from './ui/Button.jsx';

// Shows the current topic and starts the next one. `inputRef` is focused by the T shortcut.
export default function TopicControl({ current, emit, inputRef, disabled }) {
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    const value = label.trim();
    if (!value) return;
    emit('topic:start', { label: value }, (res) => {
      if (res?.ok) {
        setLabel('');
        setError('');
      } else {
        setError(res?.error || 'Could not start the topic');
      }
    });
  }

  return (
    <section className="card" aria-label="Topics">
      <h2 className="card-title">
        <span>Topic</span>
        <kbd>T</kbd>
      </h2>
      <p className="current-topic" aria-live="polite">
        Now teaching
        <em>{current?.label ?? '—'}</em>
      </p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="new-topic" className="sr-only">New topic</label>
        <div className="input-row">
          <input
            id="new-topic"
            ref={inputRef}
            className="input"
            value={label}
            maxLength={TOPIC_MAX}
            placeholder="New topic"
            autoComplete="off"
            onChange={(event) => setLabel(event.target.value)}
          />
          <Button type="submit" variant="ghost" disabled={disabled || !label.trim()}>Start</Button>
        </div>
        <p className="form-error" role="alert">{error}</p>
      </form>
    </section>
  );
}

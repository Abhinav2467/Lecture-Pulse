import Icon from './ui/Icon.jsx';

// Full-page loading skeleton, or an error / 404 / ended message.
export default function StateScreen({ icon = 'warn', title, message, loading = false, children }) {
  if (loading) {
    return (
      <div className="skeleton-page" role="status" aria-live="polite">
        <span className="sr-only">{title || 'Loading…'}</span>
        <div className="skeleton" style={{ height: 54, maxWidth: 420 }} />
        <div className="skeleton-grid">
          <div className="skeleton" style={{ height: 150 }} />
          <div className="skeleton" style={{ height: 150 }} />
          <div className="skeleton" style={{ height: 150 }} />
        </div>
        <div className="skeleton" style={{ height: 240 }} />
      </div>
    );
  }

  return (
    <section className="state appear appear--soft" aria-live="polite">
      <div className="state-icon">
        <Icon name={icon} size={24} />
      </div>
      <h1>{title}</h1>
      {message && <p>{message}</p>}
      {children && <div className="row">{children}</div>}
    </section>
  );
}

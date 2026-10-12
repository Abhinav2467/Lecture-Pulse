// Full-page loading / error / 404 / ended state.
export default function StateScreen({ icon, title, message, loading = false, children }) {
  return (
    <section className="state" role={loading ? 'status' : undefined} aria-live="polite">
      {loading ? <div className="spinner" aria-hidden="true" /> : icon && <div className="state__icon" aria-hidden="true">{icon}</div>}
      <h1>{title}</h1>
      {message && <p className="muted">{message}</p>}
      {children}
    </section>
  );
}

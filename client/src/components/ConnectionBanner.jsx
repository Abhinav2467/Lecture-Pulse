export default function ConnectionBanner({ status }) {
  if (status !== 'reconnecting') return null;
  return (
    <div className="banner" role="status" aria-live="polite">
      <span className="banner__dot" aria-hidden="true" />
      Reconnecting…
    </div>
  );
}

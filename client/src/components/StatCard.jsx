export default function StatCard({ label, value, hint, color }) {
  return (
    <div className="card stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value" style={color ? { color } : undefined}>{value}</div>
      {hint && <div className="stat__hint">{hint}</div>}
    </div>
  );
}

// Emojis float up and fade. Pure CSS animation; the parent removes finished items.
export default function ReactionLayer({ items }) {
  return (
    <div className="reaction-layer" aria-hidden="true">
      {items.map((item) => (
        <span
          key={item.id}
          className="reaction"
          style={{ left: `${item.x}%`, '--sway': `${item.sway}px`, '--tilt': `${item.tilt}deg`, fontSize: item.size }}
        >
          {item.emoji}
        </span>
      ))}
    </div>
  );
}

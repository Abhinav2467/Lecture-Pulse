export default function FeedbackButton({ option, disabled, highlighted, onSend }) {
  return (
    <button
      type="button"
      className={`fb-btn ${highlighted ? 'fb-btn--last' : ''}`}
      style={{ '--fb-color': option.color }}
      disabled={disabled}
      onClick={() => onSend(option.type)}
    >
      <span className="fb-btn__emoji" aria-hidden="true">{option.emoji}</span>
      <span>{option.label}</span>
    </button>
  );
}

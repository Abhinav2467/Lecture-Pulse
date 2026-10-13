import Icon from './ui/Icon.jsx';

export default function FeedbackTile({ option, disabled, highlighted, onSend }) {
  return (
    <button
      type="button"
      className={`tile ${highlighted ? 'is-last' : ''}`}
      disabled={disabled}
      onClick={() => onSend(option.type)}
    >
      <span className="tile-icon">
        <Icon name={option.icon} size={22} />
      </span>
      <span>{option.label}</span>
    </button>
  );
}

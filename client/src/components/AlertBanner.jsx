import { FEEDBACK_LABEL } from '../lib/constants.js';
import { formatClock } from '../lib/format.js';
import Icon from './ui/Icon.jsx';

// alert: { since, dominantType, suggestion }
export default function AlertBanner({ alert, onDismiss }) {
  return (
    <div className="alert-banner" role="alert">
      <span className="alert-icon">
        <Icon name="bell" size={20} />
      </span>
      <div className="alert-text">
        <strong>
          Losing the room since {formatClock(alert.since)} · mostly “{FEEDBACK_LABEL[alert.dominantType]}”
        </strong>
        <em>{alert.suggestion}.</em>
      </div>
      <button type="button" className="icon-btn" aria-label="Dismiss alert" onClick={onDismiss}>
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}

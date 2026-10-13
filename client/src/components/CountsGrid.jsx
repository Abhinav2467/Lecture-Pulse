import { FEEDBACK } from '../lib/constants.js';
import Icon from './ui/Icon.jsx';

export default function CountsGrid({ counts = {} }) {
  return (
    <div className="counts">
      {FEEDBACK.map(({ type, label, icon }) => (
        <div key={type} className="count">
          <Icon name={icon} size={20} />
          <div>
            <div className="count-value">{counts[type] ?? 0}</div>
            <div className="count-label">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

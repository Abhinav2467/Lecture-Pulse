import { Link } from 'react-router-dom';

// Liquid-metal pill: nav links and small toggles.
export default function PillButton({ to, size, active = false, className = '', ...rest }) {
  const classes = ['pill', size === 'sm' && 'pill--sm', active && 'is-active', className].filter(Boolean).join(' ');
  if (to !== undefined) return <Link to={to} className={classes} {...rest} />;
  return <button type="button" className={classes} aria-pressed={active} {...rest} />;
}

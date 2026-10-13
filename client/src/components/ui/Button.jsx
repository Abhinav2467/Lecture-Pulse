import { Link } from 'react-router-dom';

/**
 * Liquid-glass button. variant: 'solid' (silver) | 'ghost' (frosted).
 * Renders a router <Link> when `to` is given, otherwise a <button>.
 */
export default function Button({ variant = 'solid', hero = false, size, block = false, className = '', to, ...rest }) {
  const classes = [
    'btn',
    `btn-${variant}`,
    hero && 'btn-hero',
    size === 'sm' && 'btn-sm',
    block && 'btn-block',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (to !== undefined) return <Link to={to} className={classes} {...rest} />;
  return <button type="button" className={classes} {...rest} />;
}

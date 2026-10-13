import { useEffect, useRef, useState } from 'react';

/**
 * Entrance animation wrapper: <Appear variant="soft" delay={0.2}>.
 * variant: scale | soft | mask | pop | btn | side | stat (see styles/motion.css).
 * `as` may be a tag or a component that forwards `ref` and `className`.
 */
export default function Appear({
  as: Tag = 'div',
  variant = 'soft',
  delay,
  duration,
  className = '',
  style,
  onAnimationEnd,
  ...rest
}) {
  const ref = useRef(null);
  const [done, setDone] = useState(false);

  // Fallback: if the animation never started (unsupported, throttled, blocked),
  // settle the element after two frames instead of leaving it mid-keyframe.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.getAnimations !== 'function') return undefined;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        const active = el.getAnimations().some((a) => a.playState === 'running' || a.playState === 'finished');
        if (!active) setDone(true);
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  return (
    <Tag
      ref={ref}
      className={`appear appear--${variant} ${done ? 'is-in' : ''} ${className}`}
      style={{
        ...(delay !== undefined ? { '--d': `${delay}s` } : null),
        ...(duration !== undefined ? { animationDuration: `${duration}s` } : null),
        ...style,
      }}
      onAnimationEnd={(event) => {
        // Only the element's own animation counts, not a child's bubbling up.
        if (event.target === event.currentTarget) setDone(true);
        onAnimationEnd?.(event);
      }}
      {...rest}
    />
  );
}

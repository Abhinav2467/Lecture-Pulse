import { useEffect, useId } from 'react';

// Frosted dialog. Closes on Escape and on a click outside the panel.
export default function Modal({ title, description, onClose, children }) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        {description && <p>{description}</p>}
        {children}
      </div>
    </div>
  );
}

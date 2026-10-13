import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Appear from './ui/Appear.jsx';
import Button from './ui/Button.jsx';
import Logo from './ui/Logo.jsx';
import PillButton from './ui/PillButton.jsx';

const LINKS = [
  { label: 'How It Works', to: '/about', variant: 'scale', delay: 0.16 },
  { label: 'Features', to: '/about#features', variant: 'soft', delay: 0.28 },
  { label: 'Join', to: '/#join', variant: 'scale', delay: 0.4 },
  { label: 'History', to: '/history', variant: 'soft', delay: 0.52 },
];

// `minimal` (student + host pages): logo only, nothing to tap by accident.
export default function Header({ minimal = false }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    document.body.classList.toggle('menu-open', open);
    return () => document.body.classList.remove('menu-open');
  }, [open]);

  // Navigation, Escape, or growing past the phone breakpoint closes the menu.
  useEffect(close, [location, close]);
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && close();
    const desktop = window.matchMedia('(min-width: 901px)');
    const onChange = (event) => event.matches && close();
    window.addEventListener('keydown', onKey);
    desktop.addEventListener('change', onChange);
    return () => {
      window.removeEventListener('keydown', onKey);
      desktop.removeEventListener('change', onChange);
    };
  }, [close]);

  return (
    <>
      {!minimal && <div className="menu-backdrop" onClick={close} />}
      <header className={`header ${minimal ? 'header--minimal' : ''}`}>
        <Appear as={Link} to="/" variant="scale" delay={0.08} className="logo" aria-label="Lecture Pulse home">
          <Logo />
        </Appear>

        {!minimal && (
          <nav id="site-nav" className="nav" aria-label="Primary">
            {LINKS.map((link) => (
              <Appear key={link.label} as={PillButton} to={link.to} variant={link.variant} delay={link.delay} onClick={close}>
                {link.label}
              </Appear>
            ))}
          </nav>
        )}

        {!minimal && (
          <div className="header-right">
            <Appear as={Button} to="/#start" variant="scale" delay={0.34} className="header-cta">
              Start a Session
            </Appear>
            <Appear
              as="button"
              type="button"
              variant="scale"
              delay={0.34}
              className="burger"
              aria-controls="site-nav"
              aria-expanded={open}
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((value) => !value)}
            >
              <span className="burger-bars" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </Appear>
          </div>
        )}
      </header>
    </>
  );
}

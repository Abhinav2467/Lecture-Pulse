import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import HeroBackground from '../components/HeroBackground.jsx';
import StartSessionModal from '../components/StartSessionModal.jsx';
import Appear from '../components/ui/Appear.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import Icon from '../components/ui/Icon.jsx';
import { api } from '../lib/api.js';
import { CODE_LENGTH, sanitizeCode } from '../lib/constants.js';
import '../styles/landing.css';

const STATS = [
  { icon: 'tap', label: 'One tap · fully anonymous', delay: 1.12 },
  { icon: 'bolt', label: 'Live updates every 2 seconds', delay: 1.28 },
  { icon: 'user', label: 'No sign-up for students', delay: 1.44 },
];

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const joinRef = useRef(null);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const starting = location.hash === '#start';

  // Marks <html> so the single-viewport lock applies to this page only.
  useEffect(() => {
    document.documentElement.classList.add('landing');
    return () => document.documentElement.classList.remove('landing');
  }, []);

  // Header "Join" pill links to /#join.
  useEffect(() => {
    if (location.hash === '#join') joinRef.current?.focus();
  }, [location.hash, location.key]);

  const closeModal = useCallback(() => navigate('/', { replace: true }), [navigate]);

  async function handleJoin(event) {
    event.preventDefault();
    if (code.length !== CODE_LENGTH || joining) return;
    setJoining(true);
    setJoinError('');
    try {
      const session = await api.getSession(code);
      if (!session.active) throw new Error('That session has already ended.');
      navigate(`/join/${code}`);
    } catch (err) {
      setJoinError(err.status === 404 ? `No session with the code ${code}.` : err.message);
      setJoining(false);
    }
  }

  return (
    <>
      <HeroBackground />

      <main className="hero" id="top">
        <div className="hero-copy">
          <Appear as={Badge} variant="pop" delay={0.22}>
            Live Classroom Feedback
          </Appear>

          <h1 className="headline">
            <span className="headline-line">
              <Appear as="span" variant="mask" delay={0.42}>Know the moment</Appear>
            </span>
            <span className="headline-line">
              <Appear as="span" variant="mask" delay={0.62}>
                you <em>lose the room.</em>
              </Appear>
            </span>
          </h1>

          <Appear as="p" variant="soft" delay={0.82} duration={1.25} className="lede">
            Students tap once, anonymously. You see a live confusion meter, topic insights and instant polls — while
            you teach.
          </Appear>

          <div className="hero-actions">
            <Appear as={Button} variant="btn" delay={0.96} hero to="/#start">
              Start a Session
            </Appear>

            <Appear as="div" variant="side" delay={1.1} className="hero-join">
              <form className="join-field" onSubmit={handleJoin} noValidate>
                <label htmlFor="join-code" className="sr-only">Session code</label>
                <input
                  id="join-code"
                  ref={joinRef}
                  value={code}
                  placeholder="Join with a code"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  inputMode="text"
                  aria-describedby="join-error"
                  onChange={(event) => {
                    setCode(sanitizeCode(event.target.value));
                    setJoinError('');
                  }}
                />
                <button type="submit" disabled={code.length !== CODE_LENGTH || joining} aria-label="Join session">
                  <Icon name="arrow" size={16} />
                </button>
              </form>
            </Appear>
          </div>

          <p id="join-error" className="hero-error" role="alert">{joinError}</p>
        </div>
      </main>

      <footer className="stats">
        {STATS.map((stat) => (
          <Appear key={stat.label} variant="stat" delay={stat.delay} className="stat">
            <Icon name={stat.icon} />
            <span>{stat.label}</span>
          </Appear>
        ))}
      </footer>

      {starting && <StartSessionModal onClose={closeModal} />}
    </>
  );
}

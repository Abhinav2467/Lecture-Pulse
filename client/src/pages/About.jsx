import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Appear from '../components/ui/Appear.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import Icon from '../components/ui/Icon.jsx';
import '../styles/about.css';

const STEPS = [
  { icon: 'screen', title: 'Start a session', text: 'Name the lecture and put the code or QR on the projector. No accounts, no installs.' },
  { icon: 'phone', title: 'Students tap', text: 'One anonymous tap: lost, too fast, example please, or got it. Eight seconds between taps.' },
  { icon: 'gauge', title: 'You read the room', text: 'A single 0–100 gauge updates every two seconds, with alerts when confusion is sustained.' },
];

const FEATURES = [
  { icon: 'gauge', title: 'Confusion score', text: 'One number from the latest tap of every student in the last two minutes, divided by who is in the room.' },
  { icon: 'flag', title: 'Topic markers', text: 'Mark what you are teaching. The summary ranks topics and tells you which one lost people.' },
  { icon: 'bell', title: 'Losing-the-room alert', text: 'Sixty or more for twenty seconds raises a banner with a suggestion. It clears below forty-five.' },
  { icon: 'poll', title: 'Quick-check polls', text: 'Fifteen seconds, three answers, one vote each. Live bars for you, results for everyone.' },
  { icon: 'smile', title: 'Floating reactions', text: 'A little warmth: reactions drift across your dashboard and never touch the score.' },
  { icon: 'replay', title: 'Session replay', text: 'Scrub through the lecture afterwards and watch the gauge and topic follow the timeline.' },
  { icon: 'lock', title: 'Anonymous by design', text: 'A random browser id, stored only as a salted hash. Enough for fairness, useless for tracing.' },
];

const WEIGHTS = [
  ["I'm lost", '+1.0'],
  ['Too fast', '+0.7'],
  ['Example please', '+0.5'],
  ['Got it', '−0.6'],
];

const LEVELS = [
  ['Clear', '0 – 29', 'var(--level-clear)'],
  ['Some confusion', '30 – 59', 'var(--level-some)'],
  ['Lost the room', '60 – 100', 'var(--level-lost)'],
];

export default function About() {
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo(0, 0);
  }, [hash]);

  return (
    <main className="main about">
      <div className="about-hero">
        <Appear as={Badge} variant="pop" delay={0.16}>How It Works</Appear>
        <h1 className="headline">
          <span className="headline-line">
            <Appear as="span" variant="mask" delay={0.3} style={{ display: 'block' }}>
              A quiet signal from <em>every seat.</em>
            </Appear>
          </span>
        </h1>
        <Appear as="p" variant="soft" delay={0.5}>
          Raising a hand is costly. Tapping a button is not. Lecture Pulse turns those taps into one number you can
          read at a glance, without stopping the lecture.
        </Appear>
      </div>

      <section id="how-it-works" aria-labelledby="how-title">
        <h2 id="how-title">
          Three steps, <em>no setup</em>
        </h2>
        <p className="about-sub">From an empty browser tab to live feedback in under a minute.</p>
        <div className="steps">
          {STEPS.map((step, i) => (
            <Appear key={step.title} variant="soft" delay={0.56 + i * 0.1}>
              <article className="card tile-card">
                <div className="step-head">
                  <span className="tile-card-icon">
                    <Icon name={step.icon} size={20} />
                  </span>
                  <span className="step-no">{i + 1}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            </Appear>
          ))}
        </div>
      </section>

      <section id="features" aria-labelledby="features-title">
        <h2 id="features-title">
          Everything in <em>the room</em>
        </h2>
        <p className="about-sub">Built for the person at the front, who has about half a second to look at a screen.</p>
        <div className="features">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="card tile-card">
              <span className="tile-card-icon">
                <Icon name={feature.icon} size={20} />
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="score" aria-labelledby="score-title">
        <h2 id="score-title">
          The <em>Confusion Score</em>
        </h2>
        <p className="about-sub">What share of the room is struggling, right now?</p>
        <div className="card formula">
          <em>score</em> = clamp( round( 100 × <em>Σ weights</em> ÷ <em>active students</em> ), 0, 100 )
          <small>
            Only each student&apos;s latest tap in the last 120 seconds counts. Silence counts as fine.
          </small>
        </div>
        <div className="score-grid">
          <div className="card">
            <h3 className="card-title"><span>Weights</span></h3>
            <ul className="kv">
              {WEIGHTS.map(([label, weight]) => (
                <li key={label}>
                  <span>{label}</span>
                  <span>{weight}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <h3 className="card-title"><span>Levels</span></h3>
            <ul className="kv">
              {LEVELS.map(([label, range, color]) => (
                <li key={label}>
                  <span>
                    <em>{label}</em>
                    <span className="level-dot" style={{ '--dot': color, display: 'inline-block', width: 8, height: 8, marginLeft: 10, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} aria-hidden="true" />
                  </span>
                  <span>{range}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="about-cta">
        <h2>
          Ready when <em>you are.</em>
        </h2>
        <div className="row">
          <Button hero to="/#start">Start a Session</Button>
          <Button hero variant="ghost" to="/#join">Join with a code</Button>
        </div>
      </div>
    </main>
  );
}

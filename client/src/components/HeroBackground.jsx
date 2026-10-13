import { Suspense, lazy, useEffect, useState } from 'react';

const ParticleField = lazy(() => import('./ParticleField.jsx'));
const VIDEO = '/hero.mp4';

/**
 * Landing background. Uses client/public/hero.mp4 when it exists (full-bleed,
 * 100% opacity, no overlay); otherwise, or if the video fails, the canvas
 * particle field. The existence check looks at the content type because the
 * SPA fallback answers unknown paths with index.html and a 200.
 */
export default function HeroBackground() {
  const [mode, setMode] = useState('pending'); // 'pending' | 'video' | 'canvas'

  useEffect(() => {
    let cancelled = false;
    fetch(VIDEO, { method: 'HEAD' })
      .then((res) => res.ok && (res.headers.get('content-type') || '').startsWith('video/'))
      .catch(() => false)
      .then((hasVideo) => !cancelled && setMode(hasVideo ? 'video' : 'canvas'));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="hero-photo" aria-hidden="true">
      {mode === 'video' && (
        <video src={VIDEO} autoPlay muted loop playsInline preload="auto" onError={() => setMode('canvas')} />
      )}
      {mode === 'canvas' && (
        <Suspense fallback={null}>
          <ParticleField />
        </Suspense>
      )}
    </div>
  );
}

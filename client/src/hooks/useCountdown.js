import { useEffect, useState } from 'react';

// Milliseconds left until `endsAt` (a local Date.now()-based timestamp), ticking ~5x/s.
export function useCountdown(endsAt) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt || endsAt <= Date.now()) return undefined;
    setNow(Date.now());
    const id = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= endsAt) clearInterval(id);
    }, 200);
    return () => clearInterval(id);
  }, [endsAt]);

  return endsAt ? Math.max(0, endsAt - now) : 0;
}

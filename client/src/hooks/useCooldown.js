import { useCallback, useEffect, useState } from 'react';

// Purely cosmetic countdown; the server is the one enforcing the cooldown.
export function useCooldown() {
  const [{ until, total }, setWindow] = useState({ until: 0, total: 0 });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until <= Date.now()) return undefined;
    const id = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= until) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [until]);

  const start = useCallback((ms) => {
    const current = Date.now();
    setNow(current);
    setWindow({ until: current + ms, total: ms });
  }, []);

  const remainingMs = Math.max(0, until - now);
  return {
    start,
    active: remainingMs > 0,
    remainingMs,
    progress: total > 0 ? remainingMs / total : 0, // 1 → 0
  };
}

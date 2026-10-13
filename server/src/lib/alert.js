// "Losing the room" alert: a pure state machine stepped once per pulse.

export const ALERT_ENTER = 60; // score that starts the clock
export const ALERT_EXIT = 45; // score that clears an active alert
export const ALERT_HOLD_MS = 20_000; // how long the score must stay >= ALERT_ENTER

export const SUGGESTIONS = Object.freeze({
  LOST: 'Pause and recap the last point',
  TOO_FAST: 'Slow down',
  EXAMPLE: 'Try a concrete example',
});

export const createAlertState = () => ({ active: false, aboveSince: null });

/**
 * Hysteresis: the alert fires only after the score has been >= 60 for a full
 * hold period, and clears only when it drops below 45. The gap between the two
 * thresholds stops a score hovering around 60 from flapping the banner, and
 * because an active alert swallows everything until it clears, there is never
 * a second alert without a clear in between.
 *
 * Returns the next state and the event to emit ('lost' | 'clear' | null).
 */
export function stepAlert(state, score, now, holdMs = ALERT_HOLD_MS) {
  if (state.active) {
    if (score < ALERT_EXIT) return { state: createAlertState(), event: 'clear' };
    return { state, event: null };
  }
  // Any dip below the enter threshold restarts the clock: it must be continuous.
  if (score < ALERT_ENTER) {
    return { state: state.aboveSince === null ? state : createAlertState(), event: null };
  }
  const aboveSince = state.aboveSince ?? now;
  if (now - aboveSince >= holdMs) return { state: { active: true, aboveSince }, event: 'lost' };
  return { state: { active: false, aboveSince }, event: null };
}

// Which kind of confusion is most common right now (ties go to the more severe type).
export function dominantConfusion(counts = {}) {
  let best = 'LOST';
  for (const type of Object.keys(SUGGESTIONS)) {
    if ((counts[type] ?? 0) > (counts[best] ?? 0)) best = type;
  }
  return best;
}

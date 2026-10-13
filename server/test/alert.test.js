import { describe, expect, it } from 'vitest';
import { SUGGESTIONS, createAlertState, dominantConfusion, stepAlert } from '../src/lib/alert.js';

// Feeds [seconds, score] samples through the state machine and collects events.
function run(samples, holdMs = 20_000) {
  let state = createAlertState();
  const events = [];
  for (const [seconds, score] of samples) {
    const step = stepAlert(state, score, seconds * 1000, holdMs);
    state = step.state;
    if (step.event) events.push([seconds, step.event]);
  }
  return { events, state };
}

describe('stepAlert', () => {
  it('fires only after the score has been >= 60 for the full hold period', () => {
    const { events, state } = run([[0, 70], [10, 65], [18, 60], [20, 61], [22, 90]]);
    expect(events).toEqual([[20, 'lost']]);
    expect(state).toEqual({ active: true, aboveSince: 0 });
  });

  it('does not fire for a short spike', () => {
    expect(run([[0, 80], [10, 80], [18, 80], [19, 10], [40, 10]]).events).toEqual([]);
  });

  it('restarts the clock when the score dips below 60 before firing', () => {
    const { events } = run([[0, 80], [15, 80], [16, 59], [18, 80], [30, 80], [37, 80], [38, 80]]);
    expect(events).toEqual([[38, 'lost']]);
  });

  it('stays active between 45 and 59 and clears only below 45 (hysteresis)', () => {
    const { events } = run([[0, 70], [20, 70], [22, 59], [24, 45], [26, 50], [28, 44]]);
    expect(events).toEqual([[20, 'lost'], [28, 'clear']]);
  });

  it('does not re-alert while active, and needs a fresh hold period after a clear', () => {
    const { events } = run([
      [0, 90], [20, 90], [40, 95], [60, 100], // one alert, however long it lasts
      [62, 30], // clear
      [64, 90], [80, 90], // only 16s above: nothing yet
      [84, 90], // 20s: second alert
    ]);
    expect(events).toEqual([[20, 'lost'], [62, 'clear'], [84, 'lost']]);
  });

  it('honours a custom hold period', () => {
    expect(run([[0, 60], [1, 60]], 1000).events).toEqual([[1, 'lost']]);
  });
});

describe('dominantConfusion', () => {
  it('picks the most common confusion type, ignoring GOT_IT', () => {
    expect(dominantConfusion({ LOST: 2, TOO_FAST: 5, EXAMPLE: 1, GOT_IT: 40 })).toBe('TOO_FAST');
    expect(dominantConfusion({ LOST: 0, TOO_FAST: 1, EXAMPLE: 3, GOT_IT: 0 })).toBe('EXAMPLE');
  });

  it('breaks ties towards the more severe type and defaults to LOST', () => {
    expect(dominantConfusion({ LOST: 3, TOO_FAST: 3, EXAMPLE: 3 })).toBe('LOST');
    expect(dominantConfusion({ LOST: 0, TOO_FAST: 2, EXAMPLE: 2 })).toBe('TOO_FAST');
    expect(dominantConfusion({})).toBe('LOST');
  });

  it('has a suggestion for every type it can return', () => {
    expect(SUGGESTIONS).toEqual({
      LOST: 'Pause and recap the last point',
      TOO_FAST: 'Slow down',
      EXAMPLE: 'Try a concrete example',
    });
  });
});

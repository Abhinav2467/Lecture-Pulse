// Order here is the order of the buttons, counters and bars everywhere.
export const FEEDBACK = [
  { type: 'LOST', label: "I'm lost", emoji: '😵', color: 'var(--fb-lost)' },
  { type: 'TOO_FAST', label: 'Too fast', emoji: '⏩', color: 'var(--fb-too-fast)' },
  { type: 'EXAMPLE', label: 'Example please', emoji: '💡', color: 'var(--fb-example)' },
  { type: 'GOT_IT', label: 'Got it', emoji: '✅', color: 'var(--fb-got-it)' },
];

const LEVEL_COLORS = {
  Clear: 'var(--level-clear)',
  'Some confusion': 'var(--level-some)',
  'Lost the room': 'var(--level-lost)',
};

export const levelColor = (level) => LEVEL_COLORS[level] ?? 'var(--level-clear)';

// Mirrors server/src/lib/pulse.js levelFor, for colouring stored scores.
export function levelForScore(score) {
  if (score >= 60) return 'Lost the room';
  if (score >= 30) return 'Some confusion';
  return 'Clear';
}

export const CODE_LENGTH = 6;
export const sanitizeCode = (value) =>
  String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);

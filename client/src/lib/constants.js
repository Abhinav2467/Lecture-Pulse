// Order here is the order of the tiles, counters and bars everywhere.
export const FEEDBACK = [
  { type: 'LOST', label: "I'm lost", short: 'Lost', icon: 'lost' },
  { type: 'TOO_FAST', label: 'Too fast', short: 'Too fast', icon: 'fast' },
  { type: 'EXAMPLE', label: 'Example please', short: 'Example', icon: 'example' },
  { type: 'GOT_IT', label: 'Got it', short: 'Got it', icon: 'check' },
];

export const FEEDBACK_LABEL = Object.fromEntries(FEEDBACK.map((f) => [f.type, f.label]));

export const REACTIONS = ['🔥', '🤯', '😂', '👏'];
export const REACTION_COOLDOWN_MS = 3000;

export const POLL_CHOICES = [
  { key: 'YES', emoji: '👍', label: 'Yes' },
  { key: 'UNSURE', emoji: '🤔', label: 'Not sure' },
  { key: 'NO', emoji: '👎', label: 'No' },
];

export const TOPIC_MAX = 40;
export const QUESTION_MAX = 120;

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

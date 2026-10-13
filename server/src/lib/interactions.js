// Constants and validators for topics, polls and reactions.

export const DEFAULT_TOPIC = 'Intro';
export const TOPIC_MAX = 40;

export const POLL_DURATION_MS = 15_000;
export const POLL_CHOICES = Object.freeze(['YES', 'UNSURE', 'NO']);
export const DEFAULT_POLL_QUESTION = 'Did that make sense?';
export const QUESTION_MAX = 120;

export const REACTIONS = Object.freeze(['🔥', '🤯', '😂', '👏']);
export const REACTION_COOLDOWN_MS = 3_000;

export function validateLabel(raw) {
  if (typeof raw !== 'string') return null;
  const label = raw.trim();
  return label.length >= 1 && label.length <= TOPIC_MAX ? label : null;
}

// Missing/blank question falls back to the default; an over-long one is rejected (null).
export function validateQuestion(raw) {
  if (raw === undefined || raw === null) return DEFAULT_POLL_QUESTION;
  if (typeof raw !== 'string') return null;
  const question = raw.trim();
  if (question.length === 0) return DEFAULT_POLL_QUESTION;
  return question.length <= QUESTION_MAX ? question : null;
}

export const emptyPollCounts = () => Object.fromEntries(POLL_CHOICES.map((choice) => [choice, 0]));
export const emptyReactionCounts = () => Object.fromEntries(REACTIONS.map((emoji) => [emoji, 0]));

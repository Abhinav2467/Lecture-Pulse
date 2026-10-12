import crypto from 'node:crypto';
import { customAlphabet, nanoid } from 'nanoid';
import { config } from '../config.js';

// No 0/O/1/I: codes are read off a projector and typed on phones.
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

export const generateCode = customAlphabet(CODE_ALPHABET, 6);
export const generateHostToken = () => nanoid(32);
export const generateId = () => nanoid(21);

export const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

// The raw clientId never touches the database: only this salted hash does, so
// stored feedback cannot be linked back to a browser without the server salt.
export const hashClientId = (clientId) => sha256(clientId + config.serverSalt);

// The host token is a 32-char random secret, so an unsalted SHA-256 is enough
// to make a leaked database useless for hijacking sessions.
export const hashToken = (token) => sha256(token);

// Constant-time comparison so response timing cannot be used to guess a token hash.
export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

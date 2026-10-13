const CLIENT_ID_KEY = 'lp:clientId';
const SESSIONS_KEY = 'lp:hostSessions';
const SOUND_KEY = 'lp:alertSound';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota: the app still works for this tab */
  }
}

// crypto.randomUUID only exists in secure contexts; students often join over
// plain http on a LAN IP, so fall back to getRandomValues.
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

let memoryClientId = null;

// Anonymous per-browser id. The server only ever stores a salted hash of it.
export function getClientId() {
  let id = read(CLIENT_ID_KEY, null) ?? memoryClientId;
  if (typeof id !== 'string' || id.length < 8) {
    id = uuid();
    memoryClientId = id;
    write(CLIENT_ID_KEY, id);
  }
  return id;
}

export function getHostSessions() {
  const list = read(SESSIONS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function saveHostSession({ code, hostToken, title }) {
  const rest = getHostSessions().filter((s) => s.code !== code);
  write(SESSIONS_KEY, [{ code, hostToken, title, createdAt: Date.now() }, ...rest]);
}

export const getHostToken = (code) => getHostSessions().find((s) => s.code === code)?.hostToken ?? null;

export function setHostSessionTitle(code, title) {
  write(SESSIONS_KEY, getHostSessions().map((s) => (s.code === code ? { ...s, title } : s)));
}

export const hostLink = (code, hostToken) => `${window.location.origin}/host/${code}#t=${hostToken}`;

/**
 * Host-link import: /host/CODE#t=<hostToken>.
 * The token rides in the URL fragment, which browsers never send to the server
 * (so it stays out of access logs and Referer headers). It is stored like a
 * locally created session and the fragment is removed from the address bar
 * and history straight away. Returns the imported token, or null.
 */
export function importHostToken(code) {
  const match = /^#t=([\w-]{16,64})$/.exec(window.location.hash);
  if (!match) return null;
  const hostToken = match[1];
  if (getHostToken(code) !== hostToken) saveHostSession({ code, hostToken, title: `Session ${code}` });
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  return hostToken;
}

export const getAlertSound = () => read(SOUND_KEY, false) === true;
export const setAlertSound = (on) => write(SOUND_KEY, Boolean(on));

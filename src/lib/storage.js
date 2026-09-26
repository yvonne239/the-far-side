/**
 * Everything a visitor writes or does stays here, in their own browser.
 * There is no server in this project — on purpose.
 */

// The prefix predates the Moonflip name; it stays so nobody loses what they
// already wrote in this browser.
const PREFIX = 'farside.v1.';
const KEYS = {
  reflections: `${PREFIX}reflections`,
  signals: `${PREFIX}signals`,
  muted: `${PREFIX}muted`,
  action: `${PREFIX}action`,
  discovered: `${PREFIX}discovered`,
};

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
    return true;
  } catch {
    return false; // private mode, quota, or storage disabled — fail quietly
  }
}

/* ---------- reflections the visitor wrote ---------- */

export function getReflections() {
  const list = read(KEYS.reflections, []);
  return Array.isArray(list) ? list : [];
}

export function addReflection({ bright, far, theme, intent }) {
  const list = getReflections();
  const entry = {
    id: `mine-${Date.now().toString(36)}`,
    bright: String(bright).slice(0, 160),
    far: String(far).slice(0, 240),
    theme: theme || 'uncertainty',
    intent: intent === 'shared' ? 'shared' : 'private',
    createdAt: new Date().toISOString(),
  };
  list.push(entry);
  write(KEYS.reflections, list);
  return entry;
}

export function removeReflection(id) {
  write(KEYS.reflections, getReflections().filter((r) => r.id !== id));
}

/* ---------- signals sent ---------- */

export function getSignals() {
  const map = read(KEYS.signals, {});
  return map && typeof map === 'object' ? map : {};
}

export function addSignal(storyId, text) {
  const map = getSignals();
  const list = Array.isArray(map[storyId]) ? map[storyId] : [];
  list.push({ text, at: new Date().toISOString() });
  map[storyId] = list;
  write(KEYS.signals, map);
  return map;
}

export function signalCount() {
  return Object.values(getSignals()).reduce((n, list) => n + list.length, 0);
}

/* ---------- discoveries already flipped ---------- */

export function getDiscovered() {
  const list = read(KEYS.discovered, []);
  return Array.isArray(list) ? list : [];
}

export function markDiscovered(id) {
  const list = getDiscovered();
  if (!list.includes(id)) {
    list.push(id);
    write(KEYS.discovered, list);
  }
  return list;
}

/* ---------- small preferences ---------- */

export const isMuted = () => read(KEYS.muted, false) === true;
export const setMuted = (v) => write(KEYS.muted, !!v);

export const getChosenAction = () => read(KEYS.action, null);
export const setChosenAction = (id) => write(KEYS.action, id);

export function clearAll() {
  Object.values(KEYS).forEach((k) => {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  });
}

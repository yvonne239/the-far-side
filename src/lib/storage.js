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
  unlocked: `${PREFIX}unlocked`,
  streak: `${PREFIX}streak`,
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

/**
 * Stores what the visitor wrote, whole. The old 160/240 caps are gone along
 * with the ones on the inputs — truncating here would quietly lose the end of
 * a long entry. Returns null if the browser refused to store it (private
 * mode, or quota) so the caller can say so rather than pretending it saved.
 */
export function addReflection({ bright, far, theme, intent }) {
  const list = getReflections();
  const entry = {
    id: `mine-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    bright: String(bright),
    far: String(far),
    theme: theme || 'uncertainty',
    intent: intent === 'shared' ? 'shared' : 'private',
    createdAt: new Date().toISOString(),
  };
  list.push(entry);
  return write(KEYS.reflections, list) ? entry : null;
}

export function removeReflection(id) {
  write(KEYS.reflections, getReflections().filter((r) => r.id !== id));
}

/* ---------- signals sent ---------- */

export function getSignals() {
  const map = read(KEYS.signals, {});
  return map && typeof map === 'object' ? map : {};
}

/**
 * Records a sent signal. The theme is stored alongside it: the constellation
 * is coloured by theme and the crystals are counted by theme, and neither can
 * be worked out later for a story the visitor has since deleted.
 */
export function addSignal(storyId, text, theme) {
  const map = getSignals();
  const list = Array.isArray(map[storyId]) ? map[storyId] : [];
  list.push({ text, at: new Date().toISOString(), theme: theme || null });
  map[storyId] = list;
  write(KEYS.signals, map);
  return map;
}

export function signalCount() {
  return Object.values(getSignals()).reduce((n, list) => n + list.length, 0);
}

/**
 * Every signal ever sent, oldest first, flattened out of the per-story map.
 * This is what rebuilds the sky on load.
 *
 * @returns {Array<{id:string, theme:string|null, at:string}>}
 */
export function getSignalLog() {
  const map = getSignals();
  const out = [];
  Object.entries(map).forEach(([id, list]) => {
    (Array.isArray(list) ? list : []).forEach((s) => {
      out.push({ id, theme: s.theme || null, at: s.at || null });
    });
  });
  return out.sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

/** Story ids that have been signalled, in the order they were first reached. */
export function signalledIds() {
  const seen = [];
  getSignalLog().forEach((s) => { if (!seen.includes(s.id)) seen.push(s.id); });
  return seen;
}

/* ---------- stardust and crystals already earned ---------- */

export function getUnlocked() {
  const list = read(KEYS.unlocked, []);
  return Array.isArray(list) ? list : [];
}

/** Remembers a milestone. Returns true the first time it is seen. */
export function unlock(id) {
  const list = getUnlocked();
  if (list.includes(id)) return false;
  list.push(id);
  write(KEYS.unlocked, list);
  return true;
}

/* ---------- nights in a row ---------- */

export function getStreak() {
  const s = read(KEYS.streak, null);
  return s && typeof s === 'object' ? { days: s.days || 0, lastDay: s.lastDay || null } : { days: 0, lastDay: null };
}

export function setStreak({ days, lastDay }) {
  return write(KEYS.streak, { days, lastDay });
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

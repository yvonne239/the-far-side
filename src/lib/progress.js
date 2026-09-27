import { THEMES } from '../data/stories.js';

/**
 * Everything that turns a list of sent signals into a sky: which stardust and
 * crystals are earned, and how many nights in a row somebody has stopped for
 * a story.
 *
 * Deliberately pure — it takes the stored signal log and gives back plain
 * objects. No DOM, no three.js, no storage. That makes the rules (especially
 * the streak's grace day) something you can actually check.
 */

/* ================================================================
   dates — always the visitor's own local day, never UTC
   ================================================================ */

/** `2026-09-27` for a Date, in local time. */
export function localDay(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Whole days from one `YYYY-MM-DD` to another. Negative if b is earlier. */
export function daysBetween(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / 86400000);
}

/* ================================================================
   the moon phase streak
   ================================================================ */

/**
 * A day counts only if a signal went out on it. Missing a single day is
 * forgiven; it takes two consecutive silent days to start the count over.
 *
 * @param {{days:number, lastDay:string|null}} streak  what was stored
 * @param {string} today
 * @returns {{days:number, lastDay:string, counted:boolean, returned:boolean}}
 *   `counted` false means today was already logged. `returned` means the
 *   count restarted — the caller says something gentle, never scolding.
 */
export function recordGivingDay(streak, today = localDay()) {
  const prev = streak && streak.lastDay ? streak.lastDay : null;
  if (!prev) return { days: 1, lastDay: today, counted: true, returned: false };

  const gap = daysBetween(prev, today);
  if (gap <= 0) return { ...streak, lastDay: prev, counted: false, returned: false };

  // gap 1 = last night, gap 2 = one night missed and forgiven
  if (gap <= 2) {
    return { days: (streak.days || 0) + 1, lastDay: today, counted: true, returned: false };
  }
  return { days: 1, lastDay: today, counted: true, returned: true };
}

/** How lit day one is. Enough to read as a sliver, not enough to read as more. */
const THIN_CRESCENT = 0.07;

/**
 * How the little moon should look right now. The icon holds its shape after a
 * break rather than snapping back, so it is read from the stored count.
 * Day 1 is a thin crescent, day 15 is full.
 */
export function moonFraction(days) {
  if (!days || days < 1) return 0;
  // day 1 is a thin crescent rather than nothing at all — a night of giving
  // should show on the moon, not leave it blank
  return Math.min(1, THIN_CRESCENT + ((days - 1) / 14) * (1 - THIN_CRESCENT));
}

/* ================================================================
   milestones — stardust and crystals share one unlocked list
   ================================================================ */

/** Stardust earned for the number of beams sent. */
const BEAM_DUST = [
  { at: 1,  id: 'dust-1',  label: 'First light',    line: 'Your first light. Someone was noticed.' },
  { at: 3,  id: 'dust-3',  label: 'Taking shape',   line: 'Your sky is starting to take shape.' },
  { at: 7,  id: 'dust-7',  label: 'Still stopping', line: 'You keep stopping for others.' },
  { at: 12, id: 'dust-12', label: 'Small galaxy',   line: 'A small galaxy, made of attention.' },
];

/** Milestones for nights in a row. 15 and 30 hand over something to keep. */
const STREAK_MARKS = [
  { at: 3,  id: 'streak-3',      kind: 'dust',    label: 'Three nights',   line: 'Three nights of noticing.' },
  { at: 7,  id: 'streak-7',      kind: 'dust',    label: 'A week of light', line: 'A week of light.' },
  { at: 15, id: 'dust-fullmoon', kind: 'dust',    label: 'Full moon stardust', line: 'Full moon. You kept showing up.' },
  { at: 30, id: 'crystal-lunar', kind: 'crystal', label: 'The Whole Lunar Cycle', line: 'One whole lunar cycle of kindness.' },
];

/** Three signals to stories of one theme earns that theme's crystal. */
export const CRYSTAL_AT = 3;

export const crystalId = (theme) => `crystal-${theme}`;

export function crystalLabel(theme) {
  return `The ${THEMES[theme]?.label || 'Quiet'} Crystal`;
}

export function crystalLine(theme) {
  return `You keep noticing stories about ${(THEMES[theme]?.label || 'this').toLowerCase()}.`;
}

/** How many signals have gone to each theme. */
export function themeTally(log) {
  const tally = {};
  log.forEach((s) => { if (s.theme) tally[s.theme] = (tally[s.theme] || 0) + 1; });
  return tally;
}

/**
 * Everything earned, given the whole signal log and the streak. Returns the
 * full set, so the caller can diff it against what was already unlocked to
 * find what is new.
 *
 * @returns {Array<{id,kind,label,line,theme?}>}
 */
export function earned(log, streak) {
  const out = [];

  BEAM_DUST.forEach((m) => {
    if (log.length >= m.at) out.push({ ...m, kind: 'dust' });
  });

  const tally = themeTally(log);
  Object.keys(tally).forEach((theme) => {
    if (tally[theme] >= CRYSTAL_AT) {
      out.push({
        id: crystalId(theme), kind: 'crystal', theme,
        label: crystalLabel(theme), line: crystalLine(theme),
      });
    }
  });

  const days = (streak && streak.days) || 0;
  STREAK_MARKS.forEach((m) => { if (days >= m.at) out.push(m); });

  return out;
}

/** The ones in `all` that are not in `known` — i.e. just unlocked. */
export function newlyEarned(all, known) {
  const seen = new Set(known);
  return all.filter((m) => !seen.has(m.id));
}

/** Signals sent today, for the card's optional count. */
export function sentToday(log, today = localDay()) {
  return log.filter((s) => s.at && localDay(new Date(s.at)) === today).length;
}

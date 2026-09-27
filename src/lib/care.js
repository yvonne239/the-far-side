/**
 * Noticing when someone might be in trouble.
 *
 * This is deliberately small and deliberately blunt. It is not a screening
 * tool and cannot tell how someone is actually doing — it only spots a few
 * phrases that people use when things are bad, so the piece can quietly put a
 * real helpline within reach.
 *
 * Three rules shape everything here:
 *
 *   1. It never blocks. Whatever someone wrote is saved exactly as written.
 *   2. It never warns. No alarm colour, no interception, no "are you sure".
 *      One gentle line, a link, and a way to close it.
 *   3. A false positive is cheap and a miss is not. The response is a
 *      dismissible sentence, so the patterns lean towards catching more.
 *
 * Nothing detected here is stored, counted, or sent anywhere.
 */

/**
 * Phrases in English and Chinese. Each is a whole expression rather than a
 * single loaded word: "die" on its own catches "dying to see you", while
 * "want to die" does not.
 */
const PATTERNS = [
  // --- English -------------------------------------------------------
  /\bsuicid(?:e|al)\b/,
  /\bkill(?:ing)?\s+my\s?self\b/,
  /\btak(?:e|ing)\s+my\s+(?:own\s+)?life\b/,
  /\bend(?:ing)?\s+(?:my\s+(?:own\s+)?life|it\s+all)\b/,
  /\b(?:want|wanted|wanting)\s+to\s+die\b/,
  /\bwanna\s+die\b/,
  /\bself[-\s]?harm(?:ing|ed)?\b/,
  /\b(?:hurt|hurting|cut|cutting)\s+my\s?self\b/,
  /\b(?:don'?t|do\s+not|dont|didn'?t)\s+want\s+to\s+(?:live|be\s+here|exist|wake\s+up)\b/,
  /\bbetter\s+off\s+(?:dead|without\s+me)\b/,
  /\bno\s+(?:reason|point)\s+(?:to|in)\s+(?:living|being\s+here)\b/,
  /\bcan'?t\s+(?:go\s+on|do\s+this\s+any\s?more|keep\s+going)\b/,

  // --- Chinese -------------------------------------------------------
  // no word boundaries in Chinese, so these match as substrings
  /自杀/,
  /自残/,
  /自伤/,
  /轻生/,
  /想死/,
  /不想活/,
  /活不下去/,
  /不想再活/,
  /结束生命/,
  /没有活下去的/,
];

/**
 * Folds the small differences that would otherwise slip past a pattern:
 * curly apostrophes, full-width punctuation, runs of whitespace, case.
 */
function normalise(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[＀-￯]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * True when a piece of writing contains one of the phrases above.
 *
 * @param {...string} parts any number of fields; they are checked together so
 *   a phrase split across the two sides of a post is still seen.
 */
export function needsCare(...parts) {
  const text = normalise(parts.filter(Boolean).join(' \n '));
  if (!text) return false;
  return PATTERNS.some((re) => re.test(text));
}

/** Exposed for tests, so the list itself can be checked rather than guessed at. */
export const _patterns = PATTERNS;

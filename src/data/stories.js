/**
 * Paired sample stories.
 *
 * Every entry has two halves that are BOTH true:
 *   `bright` — the post the world sees, on the near side of the Moon
 *   `far`    — what was standing just outside that frame
 *
 * These are written for the demo and are labelled as samples everywhere they
 * appear. No real person's words are in this file.
 */

export const THEMES = {
  belonging:   { label: 'Belonging',   color: '#7fd6c4' },
  work:        { label: 'Work',        color: '#9fb4ff' },
  family:      { label: 'Family',      color: '#ffb0a8' },
  identity:    { label: 'Identity',    color: '#d3a6ff' },
  uncertainty: { label: 'Uncertainty', color: '#ffd98a' },
};

export const THEME_ORDER = ['belonging', 'work', 'family', 'identity', 'uncertainty'];

export const STORIES = [
  {
    id: 'internship',
    theme: 'work',
    bright: {
      handle: '@sample_story',
      time: '2h',
      emoji: '🎉',
      caption: 'I got the internship!!! Still shaking. Dream company, dream team 🎉',
      likes: 412,
      comments: 58,
      gradient: 'linear-gradient(135deg, #5b7cff 0%, #8f5bff 55%, #ff6bb5 100%)',
      pos: { left: '9%', top: '20%' },
    },
    prompt: 'Nobody posts the eighteen versions of this that did not happen.',
    far: {
      text: 'I was rejected eighteen times first. I never told anyone I was applying, so nobody knew to be proud of the ones I survived — only the one that worked.',
      note: 'Sample story · written for this demo',
    },
    anchor: { lat: 16, lon: -52 },
  },

  {
    id: 'semester',
    theme: 'belonging',
    bright: {
      handle: '@sample_story',
      time: '5h',
      emoji: '🌙',
      caption: 'Best first semester ever 🌙 these people are my whole world',
      likes: 289,
      comments: 31,
      gradient: 'linear-gradient(135deg, #2bd4b4 0%, #3d8bff 60%, #7a5bff 100%)',
      pos: { left: '31%', top: '58%' },
    },
    prompt: 'A photo can hold nine people and still not hold one conversation.',
    far: {
      text: 'I always have people to sit with and nobody I could call at 2am. Everyone seems to have found their person already, so I keep smiling and waiting for it to click.',
      note: 'Sample story · written for this demo',
    },
    anchor: { lat: -6, lon: -14 },
  },

  {
    id: 'family',
    theme: 'family',
    bright: {
      handle: '@sample_story',
      time: '1d',
      emoji: '❤️',
      caption: 'So grateful for my family ❤️ home for the weekend and my heart is full',
      likes: 534,
      comments: 47,
      gradient: 'linear-gradient(135deg, #ff9a6b 0%, #ff5f8f 55%, #c14bff 100%)',
      pos: { left: '61%', top: '17%' },
    },
    prompt: 'Gratitude and exhaustion can sit at the same kitchen table.',
    far: {
      text: 'I go home every weekend because I help care for my mum. I do love her. I am also nineteen and so tired, and I do not know who to say that to without sounding ungrateful.',
      note: 'Sample story · written for this demo',
    },
    anchor: { lat: 24, lon: 30 },
  },

  {
    id: 'identity',
    theme: 'identity',
    bright: {
      handle: '@sample_story',
      time: '3d',
      emoji: '✨',
      caption: 'new hair, new city, new me ✨ finally feel like myself',
      likes: 673,
      comments: 92,
      gradient: 'linear-gradient(135deg, #b06bff 0%, #ff6bd6 55%, #ffb36b 100%)',
      pos: { left: '77%', top: '52%' },
    },
    prompt: 'Sometimes the outside changes first, because it is the part that is allowed to.',
    far: {
      text: 'I changed how I look before I could explain who I am. Here I go by the name that fits. On the phone home, I answer to the other one, and I have not worked out how to close that gap.',
      note: 'Sample story · written for this demo',
    },
    anchor: { lat: -22, lon: 62 },
  },

  {
    id: 'graduation',
    theme: 'uncertainty',
    bright: {
      handle: '@sample_story',
      time: '1w',
      emoji: '🎓',
      caption: 'WE MADE IT 🎓 on to the next chapter!! thank you to everyone',
      likes: 891,
      comments: 126,
      gradient: 'linear-gradient(135deg, #ffd36b 0%, #ff8f5b 55%, #ff5b8f 100%)',
      pos: { left: '46%', top: '31%' },
    },
    prompt: '"Next chapter" is a caption, not a plan.',
    far: {
      text: 'There is no next chapter yet. Everyone assumed I had one lined up and it felt easier to let them, so now I am four months into pretending and running out of ways to answer the question.',
      note: 'Sample story · written for this demo',
    },
    anchor: { lat: 6, lon: 108 },
  },
];

/** Signals a visitor can relay to a story. Deliberately short and unrankable. */
export const SIGNALS = [
  'I hear you',
  'Thank you for sharing',
  'You are not alone in this',
  'This helped me',
];

/** Fake notification copy for the bright side's comparison pressure. */
export const TOASTS = [
  '@sample_story just posted a photo',
  '3 people you follow are at the same party',
  'Your post from last year got 2 likes today',
  '@sample_story added to their story',
  'Everyone is watching @sample_story',
  '@sample_story got the offer 🎉',
  '12 new posts since you opened this',
  'You have not posted in 24 days',
];

/** Lines shown, in order, while flying around the Moon. */
export const FLIGHT_LINES = [
  'Leaving the bright side…',
  'The notifications fall away.',
  'One face of the Moon never turns toward Earth.',
  'Nothing here is performing for anyone.',
  'Arriving at the far side.',
];

export function getStory(id) {
  return STORIES.find((s) => s.id === id) || null;
}

/**
 * Step 5 of the journey: one small, real-world act of connection to carry
 * back to Earth. Each action ships with a message the visitor can copy,
 * because "check in with someone" fails at the blank-text-box stage.
 */

export const ACTIONS = [
  {
    id: 'check-in',
    icon: '📡',
    title: 'Check in with a friend',
    desc: 'Someone whose highlight reel looks fine. Ask about the part outside it.',
    message:
      "Hey — random, but I saw something today about how we only ever post the good frame. So: how are you actually doing this week? No need for a highlight version.",
  },
  {
    id: 'company',
    icon: '🫂',
    title: 'Ask someone for company',
    desc: 'Being the one who reaches out first is allowed, even when it feels exposed.',
    message:
      "Hey, I could use some company this week — nothing special, just a walk or coffee or sitting somewhere together. Are you free any evening?",
  },
  {
    id: 'rest',
    icon: '🌙',
    title: 'Take a real break',
    desc: 'Twenty minutes, no screen, no productivity attached to it.',
    message:
      "Taking twenty minutes off the internet. Back later — if you need me, call and I'll pick up.",
  },
  {
    id: 'own',
    icon: '✍️',
    title: 'Say your own other side',
    desc: 'Tell one person the second line you wrote on the far side of the Moon.',
    message:
      "Can I tell you something I've been keeping behind the nicer version? I've been finding things harder than I've let on, and I wanted one person to actually know.",
  },
];

export function getAction(id) {
  return ACTIONS.find((a) => a.id === id) || null;
}

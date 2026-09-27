import { TOASTS } from '../data/stories.js';
import { formatCount } from '../lib/util.js';

/** The look of a post the visitor wrote themselves. */
const MINE_GRADIENT = 'linear-gradient(135deg, #ffd9a0 0%, #ffb877 55%, #ff8f6b 100%)';

/**
 * Turns a stored reflection into the same shape a sample story has, so one
 * card builder serves both.
 */
export function reflectionAsPost(entry) {
  return {
    id: entry.id,
    mine: true,
    bright: {
      handle: '@you',
      time: 'just now',
      emoji: '🌙',
      caption: entry.bright,
      gradient: MINE_GRADIENT,
      pos: { left: '7%', top: '57%' },
    },
  };
}

/**
 * Builds one post card. `hero` returns a non-interactive version for the
 * sheet that opens when a post is selected. `story.mine` switches the badge
 * to MINE and drops the like counts — your own post is not a scoreboard.
 */
export function createPostCard(story, { hero = false } = {}) {
  const b = story.bright;
  const mine = !!story.mine;
  const el = document.createElement(hero ? 'div' : 'button');
  el.className = `post-card${hero ? ' post-card--hero' : ''}${mine ? ' post-card--mine' : ''}`;
  el.style.setProperty('--grad', b.gradient);
  if (!hero) {
    el.type = 'button';
    el.style.left = b.pos.left;
    el.style.top = b.pos.top;
    el.setAttribute('aria-label', mine
      ? `Your post: ${b.caption}. Fly to your light and read what you wrote behind it.`
      : `Post: ${b.caption}. See what was outside this frame.`);
  }

  const media = document.createElement('div');
  media.className = 'post-card__media';
  media.style.background = b.gradient;

  const badge = document.createElement('span');
  badge.className = `post-card__badge${mine ? ' post-card__badge--mine' : ''}`;
  badge.textContent = mine ? 'Mine' : 'Sample post';

  const emoji = document.createElement('span');
  emoji.className = 'post-card__emoji';
  emoji.setAttribute('aria-hidden', 'true');
  emoji.textContent = b.emoji;
  media.append(badge, emoji);

  const body = document.createElement('div');
  body.className = 'post-card__body';

  const head = document.createElement('div');
  head.className = 'post-card__head';
  const avatar = document.createElement('span');
  avatar.className = 'post-card__avatar';
  avatar.style.background = b.gradient;
  const handle = document.createElement('span');
  handle.className = 'post-card__handle';
  handle.textContent = b.handle;
  const time = document.createElement('span');
  time.className = 'post-card__time';
  time.textContent = b.time;
  head.append(avatar, handle, time);

  const caption = document.createElement('p');
  caption.className = 'post-card__caption';
  caption.textContent = b.caption;

  body.append(head, caption);

  if (!mine) {
    const meta = document.createElement('div');
    meta.className = 'post-card__meta';
    const likes = document.createElement('span');
    likes.textContent = `♥ ${formatCount(b.likes)}`;
    const comments = document.createElement('span');
    comments.textContent = `💬 ${formatCount(b.comments)}`;
    meta.append(likes, comments);
    body.appendChild(meta);
  } else {
    const note = document.createElement('p');
    note.className = 'post-card__mine-note';
    note.textContent = 'Only you can see this · this browser only';
    body.appendChild(note);
  }
  el.append(media, body);
  return el;
}

/** The bright side: a feed that floats over the Moon, plus nagging toasts. */
export class Feed {
  constructor({ root, toastRoot, stories, onSelect, onSelectMine }) {
    this.root = root;
    this.toastRoot = toastRoot;
    this.stories = stories;
    this.onSelect = onSelect;
    this.onSelectMine = onSelectMine || onSelect;
    this._timer = null;
    this._toastIndex = 0;
    this.build();
  }

  build() {
    this.root.textContent = '';
    this.stories.forEach((story, i) => {
      const card = createPostCard(story);
      card.style.setProperty('--delay', `${0.25 + i * 0.16}s`);
      card.style.setProperty('--drift', `${9 + (i % 3) * 2.4}s`);
      card.addEventListener('click', () => this.onSelect(story.id));
      this.root.appendChild(card);
    });
  }

  /* ---------- the visitor's own posts ---------- */

  /**
   * Puts a written post at the head of the feed. Prepended, so it is first in
   * DOM and tab order and sits at the top of the stack on a phone; on a wide
   * screen the cards fan out from a clear patch of sky.
   *
   * @param {boolean} fresh true for a just-written post, which fades in
   */
  addMine(entry, { fresh = false } = {}) {
    if (this.root.querySelector(`[data-mine-id="${entry.id}"]`)) return;
    const card = createPostCard(reflectionAsPost(entry));
    card.dataset.mineId = entry.id;
    card.style.setProperty('--drift', '10.5s');
    if (fresh) card.classList.add('is-fresh');
    card.addEventListener('click', () => this.onSelectMine(entry.id));
    this.root.prepend(card);
    this._placeMine();
  }

  removeMine(id) {
    const card = this.root.querySelector(`[data-mine-id="${id}"]`);
    if (card) card.remove();
    this._placeMine();
  }

  /**
   * Re-render every written post. Used on load and on delete.
   *
   * Walks oldest → newest because addMine prepends: reversing here as well
   * would flip the order twice and leave the oldest at the front.
   */
  setMine(reflections) {
    [...this.root.querySelectorAll('[data-mine-id]')].forEach((c) => c.remove());
    reflections.forEach((r) => this.addMine(r));
  }

  /**
   * Lays the written posts out so they never land underneath a sample. The
   * newest takes the clear patch at lower left and older ones fan up and
   * across; each sits above the samples so none of them can be buried.
   */
  _placeMine() {
    const cards = [...this.root.querySelectorAll('[data-mine-id]')];
    cards.forEach((card, i) => {
      card.style.left = `${7 + i * 5}%`;
      card.style.top = `${57 - i * 7}%`;
      // bounded: newest on top of the samples, but never high enough to climb
      // over the near-side controls or a modal
      card.style.zIndex = String(Math.max(1, 5 - i));
    });
  }

  startToasts() {
    if (this._timer) return;
    const tick = () => {
      this._show(TOASTS[this._toastIndex % TOASTS.length]);
      this._toastIndex += 1;
      this._timer = setTimeout(tick, 3400 + Math.random() * 3200);
    };
    this._timer = setTimeout(tick, 2600);
  }

  stopToasts() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
    this.toastRoot.textContent = '';
  }

  _show(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    this.toastRoot.appendChild(el);
    while (this.toastRoot.children.length > 3) this.toastRoot.firstChild.remove();
    setTimeout(() => {
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 700);
    }, 4200);
  }
}

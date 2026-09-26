import { TOASTS } from '../data/stories.js';
import { formatCount } from '../lib/util.js';

/**
 * Builds one post card. `hero` returns a non-interactive version for the
 * sheet that opens when a post is selected.
 */
export function createPostCard(story, { hero = false } = {}) {
  const b = story.bright;
  const el = document.createElement(hero ? 'div' : 'button');
  el.className = `post-card${hero ? ' post-card--hero' : ''}`;
  el.style.setProperty('--grad', b.gradient);
  if (!hero) {
    el.type = 'button';
    el.style.left = b.pos.left;
    el.style.top = b.pos.top;
    el.setAttribute('aria-label', `Post: ${b.caption}. See what was outside this frame.`);
  }

  const media = document.createElement('div');
  media.className = 'post-card__media';
  media.style.background = b.gradient;

  const badge = document.createElement('span');
  badge.className = 'post-card__badge';
  badge.textContent = 'Sample post';

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

  const meta = document.createElement('div');
  meta.className = 'post-card__meta';
  const likes = document.createElement('span');
  likes.textContent = `♥ ${formatCount(b.likes)}`;
  const comments = document.createElement('span');
  comments.textContent = `💬 ${formatCount(b.comments)}`;
  meta.append(likes, comments);

  body.append(head, caption, meta);
  el.append(media, body);
  return el;
}

/** The bright side: a feed that floats over the Moon, plus nagging toasts. */
export class Feed {
  constructor({ root, toastRoot, stories, onSelect }) {
    this.root = root;
    this.toastRoot = toastRoot;
    this.stories = stories;
    this.onSelect = onSelect;
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

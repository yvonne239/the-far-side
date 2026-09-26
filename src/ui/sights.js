import { CATEGORIES } from '../data/discoveries.js';

/**
 * The near side of the discoveries path: familiar sights floating over the
 * Moon, each one a question you have probably never actually answered.
 *
 * Same shape as the feed on the human-stories path — pick one, ask what else
 * is happening, then flip the Moon — but these are objects and conveniences
 * rather than posts, so they are styled as observations, not as social media.
 */
export function createSightCard(discovery, { hero = false } = {}) {
  const f = discovery.front;
  const cat = CATEGORIES[discovery.category];
  const el = document.createElement(hero ? 'div' : 'button');
  el.className = `sight-card${hero ? ' sight-card--hero' : ''}`;
  el.style.setProperty('--grad', f.gradient);
  el.style.setProperty('--c', cat.color);
  if (!hero) {
    el.type = 'button';
    el.style.left = f.pos.left;
    el.style.top = f.pos.top;
    el.setAttribute('aria-label', `${f.label}: ${f.question} Flip the Moon to find out.`);
  }

  const media = document.createElement('div');
  media.className = 'sight-card__media';
  media.style.background = f.gradient;

  const tag = document.createElement('span');
  tag.className = 'sight-card__tag';
  tag.textContent = cat.label;

  const emoji = document.createElement('span');
  emoji.className = 'sight-card__emoji';
  emoji.setAttribute('aria-hidden', 'true');
  emoji.textContent = f.emoji;
  media.append(tag, emoji);

  const body = document.createElement('div');
  body.className = 'sight-card__body';

  const label = document.createElement('span');
  label.className = 'sight-card__label';
  label.textContent = f.label;

  const question = document.createElement('p');
  question.className = 'sight-card__question';
  question.textContent = f.question;

  body.append(label, question);
  el.append(media, body);
  return el;
}

/** The near side of path B: a scatter of everyday sights over the Moon. */
export class Sights {
  constructor({ root, discoveries, onSelect }) {
    this.root = root;
    this.discoveries = discoveries;
    this.onSelect = onSelect;
    this.build();
  }

  build() {
    this.root.textContent = '';
    this.discoveries.forEach((d, i) => {
      const card = createSightCard(d);
      card.style.setProperty('--delay', `${0.25 + i * 0.16}s`);
      card.style.setProperty('--drift', `${10 + (i % 3) * 2.6}s`);
      card.addEventListener('click', () => this.onSelect(d.id));
      this.root.appendChild(card);
    });
  }

  /** Mark the ones already revealed, so a second pass is legible. */
  markSeen(ids) {
    [...this.root.children].forEach((card, i) => {
      card.classList.toggle('is-seen', ids.includes(this.discoveries[i].id));
    });
  }
}

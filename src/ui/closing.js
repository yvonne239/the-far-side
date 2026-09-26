import { ACTIONS, getAction } from '../data/actions.js';

/**
 * Step 5: pick one small act of connection to take back to Earth, with the
 * message pre-written so the hardest part (starting) is already done.
 */
export class Closing {
  constructor({ onChoose } = {}) {
    this.onChoose = onChoose || (() => {});
    this.cards = document.getElementById('action-cards');
    this.checkin = document.getElementById('checkin');
    this.checkinText = document.getElementById('checkin-text');
    this.copyStatus = document.getElementById('copy-status');
    this.copyBtn = document.getElementById('btn-copy');
    this.selected = null;

    this._build();

    this.copyBtn.addEventListener('click', () => this._copy());
  }

  _build() {
    ACTIONS.forEach((action) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'action-card';
      card.dataset.action = action.id;
      card.setAttribute('aria-pressed', 'false');

      const icon = document.createElement('span');
      icon.className = 'action-card__icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = action.icon;

      const title = document.createElement('span');
      title.className = 'action-card__title';
      title.textContent = action.title;

      const desc = document.createElement('span');
      desc.className = 'action-card__desc';
      desc.textContent = action.desc;

      card.append(icon, title, desc);
      card.addEventListener('click', () => this.choose(action.id));
      this.cards.appendChild(card);
    });
  }

  choose(id) {
    const action = getAction(id);
    if (!action) return;
    this.selected = id;

    this.cards.querySelectorAll('.action-card').forEach((card) => {
      card.setAttribute('aria-pressed', card.dataset.action === id ? 'true' : 'false');
    });

    this.checkinText.value = action.message;
    this.checkin.hidden = false;
    this.copyStatus.textContent = '';
    this.onChoose(id);
  }

  async _copy() {
    const text = this.checkinText.value;
    try {
      await navigator.clipboard.writeText(text);
      this.copyStatus.textContent = 'Copied. Now send it to one person.';
    } catch {
      // clipboard blocked (http, permissions) — select it so ⌘C still works
      this.checkinText.focus();
      this.checkinText.select();
      this.copyStatus.textContent = 'Selected — press ⌘C / Ctrl+C.';
    }
  }
}

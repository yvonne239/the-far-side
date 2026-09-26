import { THEMES, THEME_ORDER, SIGNALS } from '../data/stories.js';

/**
 * Far-side UI: the experience filters, the story panel, and the signal relay
 * buttons. This module only touches the DOM — the beam itself lives in the
 * 3D scene, and main.js wires the two together.
 */
export class FarSide {
  constructor({ onFilter, onSignal, onStep, onClose }) {
    this.onFilter = onFilter;
    this.onSignal = onSignal;
    this.onStep = onStep;
    this.onClose = onClose;

    this.panel = document.getElementById('story-panel');
    this.themeChip = document.getElementById('story-theme');
    this.seen = document.getElementById('story-seen');
    this.text = document.getElementById('story-text');
    this.note = document.getElementById('story-note');
    this.status = document.getElementById('signal-status');
    this.countEl = document.getElementById('constellation-count');
    this.signalButtons = document.getElementById('signal-buttons');
    this.filterRoot = document.getElementById('filter-chips');
    this.current = null;

    this._buildFilters();
    this._buildSignals();

    this.panel.querySelectorAll('[data-close-story]').forEach((btn) => {
      btn.addEventListener('click', () => this.close());
    });
    this.panel.querySelectorAll('[data-story-step]').forEach((btn) => {
      btn.addEventListener('click', () => this.onStep(Number(btn.dataset.storyStep)));
    });
  }

  _buildFilters() {
    const make = (key, label, color) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.dataset.filter = key;
      chip.setAttribute('aria-pressed', key === 'all' ? 'true' : 'false');
      if (color) chip.style.setProperty('--c', color);
      if (color) {
        const dot = document.createElement('span');
        dot.className = 'chip__dot';
        chip.appendChild(dot);
      }
      chip.append(document.createTextNode(label));
      chip.addEventListener('click', () => this.setFilter(key));
      return chip;
    };

    this.filterRoot.appendChild(make('all', 'All', null));
    THEME_ORDER.forEach((key) => {
      this.filterRoot.appendChild(make(key, THEMES[key].label, THEMES[key].color));
    });
  }

  setFilter(key) {
    this.filterRoot.querySelectorAll('.chip').forEach((chip) => {
      chip.setAttribute('aria-pressed', chip.dataset.filter === key ? 'true' : 'false');
    });
    this.onFilter(key);
  }

  _buildSignals() {
    SIGNALS.forEach((text) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'signal-btn';
      btn.textContent = text;
      btn.addEventListener('click', () => {
        if (!this.current) return;
        this.onSignal(this.current.id, text);
      });
      this.signalButtons.appendChild(btn);
    });
  }

  /**
   * @param {{id:string, theme:string, seen:string, text:string, note:string,
   *          mine?:boolean, signalCount?:number}} story
   */
  show(story) {
    this.current = story;
    const theme = THEMES[story.theme] || { label: 'Story', color: '#ffb877' };

    this.themeChip.textContent = story.mine ? 'Yours' : theme.label;
    this.themeChip.style.setProperty('--c', story.mine ? '#fff4d6' : theme.color);
    this.seen.textContent = story.seen;
    this.text.textContent = story.text;
    this.note.textContent = story.note;

    this.setSignalsEnabled(!story.mine);
    this.status.textContent = story.mine
      ? 'This one is yours. Nobody can signal it but you.'
      : story.signalCount
        ? `You have already sent ${story.signalCount === 1 ? 'a signal' : `${story.signalCount} signals`} to this light.`
        : '';

    this.panel.classList.add('is-open');
    this.panel.scrollTop = 0;
  }

  setSignalsEnabled(enabled) {
    this.signalButtons.querySelectorAll('button').forEach((b) => { b.disabled = !enabled; });
  }

  setStatus(text) {
    this.status.textContent = text;
  }

  setCount(n) {
    this.countEl.textContent = n === 0
      ? ''
      : `${n} signal${n === 1 ? '' : 's'} relayed · your constellation is forming`;
  }

  close() {
    this.panel.classList.remove('is-open');
    this.current = null;
    if (this.onClose) this.onClose();
  }

  get isOpen() {
    return this.panel.classList.contains('is-open');
  }
}

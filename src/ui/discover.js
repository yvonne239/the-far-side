import { CATEGORIES, CATEGORY_ORDER } from '../data/discoveries.js';
import { SunLab } from './widgets/sunlab.js';
import { Petrichor } from './widgets/petrichor.js';
import { QRScratch } from './widgets/qr.js';
import { NodeMap } from './widgets/nodemap.js';

const WIDGETS = {
  sunlab: (d, ctx) => new SunLab(ctx),
  petrichor: () => new Petrichor(),
  qr: () => new QRScratch(),
  nodemap: (d, ctx) => new NodeMap({ data: d.widgetData, sound: ctx.sound }),
};

/**
 * Far-side UI for the discoveries path: category filters, the reveal panel,
 * and whichever interactive widget the open discovery needs.
 *
 * Only one widget is alive at a time. Each one owns a canvas, a loop or a
 * hold on the 3D scene's lighting, so `close()` must always tear it down.
 */
export class Discover {
  constructor({ onFilter, onStep, onClose, onRevealed, onConnect, scene, sound }) {
    this.onFilter = onFilter;
    this.onStep = onStep;
    this.onClose = onClose;
    this.onRevealed = onRevealed || (() => {});
    this.onConnect = onConnect || (() => {});
    this.scene = scene;
    this.sound = sound;

    this.panel = document.getElementById('discovery-panel');
    this.catChip = document.getElementById('discovery-category');
    this.frontEl = document.getElementById('discovery-front');
    this.headlineEl = document.getElementById('discovery-headline');
    this.leadEl = document.getElementById('discovery-lead');
    this.widgetHost = document.getElementById('discovery-widget');
    this.explainEl = document.getElementById('discovery-explain');
    this.caveatEl = document.getElementById('discovery-caveat');
    this.connectionsEl = document.getElementById('discovery-connections');
    this.sourceEl = document.getElementById('discovery-source');
    this.countEl = document.getElementById('discovery-count');
    this.filterRoot = document.getElementById('discovery-filters');

    this.current = null;
    this.widget = null;

    this._buildFilters();

    this.panel.querySelectorAll('[data-close-discovery]').forEach((btn) =>
      btn.addEventListener('click', () => this.close()));
    this.panel.querySelectorAll('[data-discovery-step]').forEach((btn) =>
      btn.addEventListener('click', () => this.onStep(Number(btn.dataset.discoveryStep))));
  }

  _buildFilters() {
    const make = (key, label, color) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.dataset.filter = key;
      chip.setAttribute('aria-pressed', key === 'all' ? 'true' : 'false');
      if (color) {
        chip.style.setProperty('--c', color);
        const dot = document.createElement('span');
        dot.className = 'chip__dot';
        chip.appendChild(dot);
      }
      chip.append(document.createTextNode(label));
      chip.addEventListener('click', () => this.setFilter(key));
      return chip;
    };

    this.filterRoot.appendChild(make('all', 'Everything', null));
    CATEGORY_ORDER.forEach((key) =>
      this.filterRoot.appendChild(make(key, CATEGORIES[key].label, CATEGORIES[key].color)));
  }

  setFilter(key) {
    this.filterRoot.querySelectorAll('.chip').forEach((chip) =>
      chip.setAttribute('aria-pressed', chip.dataset.filter === key ? 'true' : 'false'));
    this.onFilter(key);
  }

  /* ---------- the reveal ---------- */

  show(discovery) {
    this._teardownWidget();
    this.current = discovery;
    const cat = CATEGORIES[discovery.category];

    this.catChip.textContent = cat.label;
    this.catChip.style.setProperty('--c', cat.color);
    this.panel.style.setProperty('--c', cat.color);

    this.frontEl.textContent = discovery.front.question;
    this.headlineEl.textContent = discovery.flip.headline;
    this.leadEl.textContent = discovery.flip.lead;

    /* the interactive part */
    const make = WIDGETS[discovery.widget];
    if (make) {
      this.widget = make(discovery, { scene: this.scene, sound: this.sound });
      this.widget.mount(this.widgetHost);
    }

    /* the words */
    this.explainEl.textContent = '';
    discovery.explain.forEach((para) => {
      const p = document.createElement('p');
      p.textContent = para;
      this.explainEl.appendChild(p);
    });

    this.caveatEl.textContent = discovery.caveat || '';
    this.caveatEl.hidden = !discovery.caveat;

    /* wider connections */
    this.connectionsEl.textContent = '';
    if (discovery.connections && discovery.connections.length) {
      const title = document.createElement('p');
      title.className = 'connections__title';
      title.textContent = 'Follow it further';
      this.connectionsEl.appendChild(title);

      discovery.connections.forEach((c) => {
        const item = document.createElement('details');
        item.className = 'connection';
        const summary = document.createElement('summary');
        summary.textContent = c.label;
        const body = document.createElement('p');
        body.textContent = c.text;
        item.append(summary, body);
        item.addEventListener('toggle', () => {
          if (!item.open) return;
          if (this.sound) this.sound.tick();
          this.onConnect(discovery.id, c.label);
        });
        this.connectionsEl.appendChild(item);
      });
    }

    /* where this came from */
    this.sourceEl.textContent = '';
    if (discovery.source) {
      this.sourceEl.append(document.createTextNode('Source: '));
      const a = document.createElement('a');
      a.href = discovery.source.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = discovery.source.label;
      this.sourceEl.appendChild(a);
      this.sourceEl.hidden = false;
    } else {
      this.sourceEl.hidden = true;
    }

    this.panel.classList.add('is-open');
    this.panel.scrollTop = 0;
    // the panel is not a live region (the widgets inside would drown it), so
    // move focus here instead — that is what actually announces the reveal
    this.panel.focus({ preventScroll: true });
    this.onRevealed(discovery.id);
  }

  setCount(seen, total) {
    if (!this.countEl) return;
    this.countEl.textContent = seen === 0
      ? ''
      : seen >= total
        ? 'All of them flipped — and every one still has more behind it.'
        : `${seen} of ${total} flipped`;
  }

  _teardownWidget() {
    if (this.widget) {
      this.widget.destroy();
      this.widget = null;
    }
    this.widgetHost.textContent = '';
  }

  close() {
    this._teardownWidget();
    this.panel.classList.remove('is-open');
    this.current = null;
    if (this.onClose) this.onClose();
  }

  get isOpen() {
    return this.panel.classList.contains('is-open');
  }
}

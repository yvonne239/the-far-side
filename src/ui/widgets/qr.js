import { mulberry32, clamp } from '../../lib/util.js';

/**
 * "A damaged QR code" — scratch the illustration, watch the recovery budget.
 *
 * This is deliberately NOT a scanner. The grid is decorative, nothing is
 * decoded, and the widget says so. What it models honestly is the shape of
 * the trade-off: four error-correction levels, each with a published share of
 * the code it can restore, and three finder patterns doing a different job
 * that no amount of redundancy replaces.
 */

const N = 25;                    // modules per side (a 25×25 grid, version-2-ish)

const LEVELS = {
  L: { label: 'L · ~7%',  budget: 0.07 },
  M: { label: 'M · ~15%', budget: 0.15 },
  Q: { label: 'Q · ~25%', budget: 0.25 },
  H: { label: 'H · ~30%', budget: 0.30 },
};

export class QRScratch {
  constructor() {
    this.level = 'M';
    this.cells = [];
    this.kind = [];              // 'finder' | 'timing' | 'data'
    this.damaged = new Set();
    this._build();
  }

  _build() {
    const rand = mulberry32(19940101);

    // the three 7×7 eyes, each with a one-module blank separator around it
    const EYES = [{ r: 0, c: 0 }, { r: 0, c: N - 7 }, { r: N - 7, c: 0 }];
    const eyeAt = (r, c) => EYES.find((e) =>
      r >= e.r - 1 && r <= e.r + 7 && c >= e.c - 1 && c <= e.c + 7) || null;

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const i = r * N + c;
        const eye = eyeAt(r, c);
        if (eye) {
          this.kind[i] = 'finder';
          const lr = r - eye.r;
          const lc = c - eye.c;
          if (lr < 0 || lr > 6 || lc < 0 || lc > 6) {
            this.cells[i] = 0;                       // separator: always blank
          } else {
            const ring = lr === 0 || lr === 6 || lc === 0 || lc === 6;
            const core = lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4;
            this.cells[i] = ring || core ? 1 : 0;
          }
        } else if (r === 6 || c === 6) {
          this.kind[i] = 'timing';                   // the alternating alignment runs
          this.cells[i] = (r + c) % 2 === 0 ? 1 : 0;
        } else {
          this.kind[i] = 'data';
          this.cells[i] = rand() < 0.48 ? 1 : 0;
        }
      }
    }
    this.dataTotal = this.kind.filter((k) => k === 'data').length;
  }

  /* ---------- build ---------- */

  mount(host) {
    this.host = host;
    host.classList.add('widget', 'widget--qr');

    const figure = document.createElement('figure');
    figure.className = 'qr__figure';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'qr__canvas';
    this.canvas.setAttribute('role', 'img');
    figure.appendChild(this.canvas);

    const cap = document.createElement('figcaption');
    cap.className = 'qr__caption';
    cap.textContent = 'Illustration only — nothing here is being scanned. Drag across it to scratch.';
    figure.appendChild(cap);
    host.appendChild(figure);

    let painting = false;
    const paint = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const c = Math.floor(((e.clientX - rect.left) / rect.width) * N);
      const r = Math.floor(((e.clientY - rect.top) / rect.height) * N);
      this._scratch(r, c, 1);
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      painting = true;
      this.canvas.setPointerCapture(e.pointerId);
      paint(e);
    });
    this.canvas.addEventListener('pointermove', (e) => { if (painting) paint(e); });
    this.canvas.addEventListener('pointerup', () => { painting = false; });
    this.canvas.addEventListener('pointercancel', () => { painting = false; });

    /* controls */
    const controls = document.createElement('div');
    controls.className = 'widget__controls';

    const set = document.createElement('fieldset');
    set.className = 'widget__chipset';
    const legend = document.createElement('legend');
    legend.textContent = 'Error-correction level';
    set.appendChild(legend);
    const chips = document.createElement('div');
    chips.className = 'filters__chips';
    Object.entries(LEVELS).forEach(([key, def]) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = def.label;
      chip.setAttribute('aria-pressed', key === this.level ? 'true' : 'false');
      chip.addEventListener('click', () => {
        this.level = key;
        chips.querySelectorAll('.chip').forEach((c) =>
          c.setAttribute('aria-pressed', String(c === chip)));
        this._draw();
      });
      chips.appendChild(chip);
    });
    set.appendChild(chips);
    controls.appendChild(set);

    const row = document.createElement('div');
    row.className = 'widget__row';
    row.append(
      this._btn('Scratch a patch', () => this._randomPatch()),
      this._btn('Scratch a corner square', () => this._scratchFinder()),
      this._btn('Repair', () => { this.damaged.clear(); this._draw(); }),
    );
    controls.appendChild(row);
    host.appendChild(controls);

    /* readout */
    this.readout = document.createElement('div');
    this.readout.className = 'widget__readout';
    this.meter = this._meter();
    // the meter ticks on every scratched module; only the verdict is announced
    this.verdictEl = document.createElement('p');
    this.verdictEl.className = 'widget__readout-note';
    this.verdictEl.setAttribute('aria-live', 'polite');
    this.readout.append(this.meter.root, this.verdictEl);
    host.appendChild(this.readout);

    this._resize = () => this._fit();
    window.addEventListener('resize', this._resize);
    this._fit();
  }

  _btn(text, fn) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn--ghost btn--sm';
    b.textContent = text;
    b.addEventListener('click', fn);
    return b;
  }

  _meter() {
    const root = document.createElement('div');
    root.className = 'meter meter--qr';
    const head = document.createElement('div');
    head.className = 'meter__head';
    const name = document.createElement('span');
    name.textContent = 'Data area scratched';
    const value = document.createElement('span');
    value.className = 'meter__value';
    head.append(name, value);
    const track = document.createElement('div');
    track.className = 'meter__track meter__track--budget';
    const fill = document.createElement('span');
    const mark = document.createElement('i');
    mark.className = 'meter__mark';
    track.append(fill, mark);
    root.append(head, track);
    return { root, value, fill, mark };
  }

  /* ---------- damage ---------- */

  _scratch(r, c, radius) {
    let changed = false;
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || rr >= N || cc < 0 || cc >= N) continue;
        if (dr * dr + dc * dc > radius * radius + 1) continue;
        const i = rr * N + cc;
        if (!this.damaged.has(i)) { this.damaged.add(i); changed = true; }
      }
    }
    if (changed) this._draw();
  }

  _randomPatch() {
    const r = 6 + Math.floor(Math.random() * (N - 12));
    const c = 6 + Math.floor(Math.random() * (N - 12));
    this._scratch(r, c, 2);
  }

  _scratchFinder() {
    const corners = [[3, 3], [3, N - 4], [N - 4, 3]];
    const [r, c] = corners[Math.floor(Math.random() * corners.length)];
    this._scratch(r, c, 2);
  }

  /* ---------- drawing ---------- */

  _fit() {
    if (!this.canvas) return;
    const cssW = clamp(this.canvas.parentElement.clientWidth, 180, 320);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssW}px`;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssW * dpr);
    this._draw();
  }

  _draw() {
    const ctx = this.canvas.getContext('2d');
    const size = this.canvas.width;
    const cell = size / N;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#e9e6dd';
    ctx.fillRect(0, 0, size, size);

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const i = r * N + c;
        const x = c * cell;
        const y = r * cell;
        if (this.damaged.has(i)) {
          ctx.fillStyle = '#b9a08c';
          ctx.fillRect(x, y, cell + 0.6, cell + 0.6);
          ctx.strokeStyle = 'rgba(90, 62, 44, 0.55)';
          ctx.lineWidth = Math.max(1, cell * 0.12);
          ctx.beginPath();
          ctx.moveTo(x + cell * 0.2, y + cell * 0.25);
          ctx.lineTo(x + cell * 0.85, y + cell * 0.7);
          ctx.stroke();
          continue;
        }
        if (this.cells[i]) {
          ctx.fillStyle = this.kind[i] === 'finder' ? '#111420' : '#171a26';
          ctx.fillRect(x, y, cell + 0.6, cell + 0.6);
        }
      }
    }

    this._report();
  }

  _report() {
    let dataHit = 0;
    let finderHit = 0;
    this.damaged.forEach((i) => {
      if (this.kind[i] === 'data') dataHit += 1;
      else if (this.kind[i] === 'finder') finderHit += 1;
    });

    const pct = this.dataTotal ? dataHit / this.dataTotal : 0;
    const budget = LEVELS[this.level].budget;

    this.meter.value.textContent = `${(pct * 100).toFixed(0)}% of ${budget * 100}% budget`;
    this.meter.fill.style.width = `${Math.min(100, pct * 100)}%`;
    this.meter.mark.style.left = `${budget * 100}%`;
    this.meter.root.dataset.state = pct > budget ? 'over' : 'ok';

    const scanned = finderHit > 5
      ? 'finder'
      : pct > budget ? 'over' : 'ok';

    const verdict = {
      finder: 'You have taken out a corner square. Those are the finder patterns a reader uses to locate and orient the code in the first place — damage there tends to fail differently, and no amount of error correction in the data area makes up for it.',
      over: `Past the ${this.level} budget. At this level roughly ${budget * 100}% of the code can be restored; beyond that there is not enough redundancy left to rebuild what is missing.`,
      ok: dataHit === 0
        ? 'Undamaged. Pick a level and start scratching — the higher the level, the more of the code is spare capacity rather than message.'
        : `Still inside the ${this.level} budget. The missing modules are reconstructable from the redundancy packed in when the code was generated.`,
    }[scanned];
    if (this.verdictEl.textContent !== verdict) this.verdictEl.textContent = verdict;

    this.canvas.setAttribute('aria-label',
      `Illustration of a QR code. ${(pct * 100).toFixed(0)} per cent of the data area is scratched out, against an error-correction budget of ${budget * 100} per cent at level ${this.level}.`);
  }

  destroy() {
    window.removeEventListener('resize', this._resize);
    if (this.host) {
      this.host.classList.remove('widget', 'widget--qr');
      this.host.textContent = '';
    }
  }
}

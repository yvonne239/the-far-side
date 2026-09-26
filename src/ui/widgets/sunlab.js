import { prefersReducedMotion } from '../../lib/util.js';

/**
 * "The dark side of the Moon" — the reveal that corrects the nickname.
 *
 * One slider drives two things at once: a top-down diagram of the Sun, the
 * Moon and Earth, and the real lighting on the 3D Moon behind the panel. Drag
 * to New Moon and the far side the visitor is standing on lights up.
 *
 * Geometry, in the diagram's own frame:
 *   Earth sits at angle 0 from the Moon, so the NEAR side is the right half.
 *   `t` runs 0 → 1 through one synodic cycle, starting at New Moon.
 *   The Sun's direction is α = π(1 − 2t):  t=0 → α=π (New), t=0.5 → α=0 (Full).
 *   The Moon is always exactly half lit; the terminator is the great circle
 *   perpendicular to α. The fraction of a hemisphere lying inside the lit
 *   hemisphere is 1 − (angle between their axes)/π.
 */

const CYCLE_MS = 20000;

const PHASES = [
  [0.030, 'New Moon'],
  [0.220, 'Waxing crescent'],
  [0.280, 'First quarter'],
  [0.470, 'Waxing gibbous'],
  [0.530, 'Full Moon'],
  [0.720, 'Waning gibbous'],
  [0.780, 'Last quarter'],
  [0.970, 'Waning crescent'],
  [1.001, 'New Moon'],
];

function phaseName(t) {
  return (PHASES.find(([edge]) => t < edge) || PHASES[PHASES.length - 1])[1];
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = (name, attrs = {}) => {
  const el = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
};

export class SunLab {
  constructor({ scene }) {
    this.scene = scene;
    this.t = 0.5;                 // start at Full Moon: the familiar view
    this._raf = null;
    this._playing = false;
    this.reduced = prefersReducedMotion();
  }

  mount(host) {
    this.host = host;
    host.classList.add('widget', 'widget--sunlab');

    /* ---------- diagram ---------- */
    const figure = document.createElement('figure');
    figure.className = 'sunlab__figure';

    const chart = svg('svg', {
      viewBox: '0 0 400 250',
      class: 'sunlab__svg',
      role: 'img',
    });
    this.svgTitle = svg('title');
    chart.appendChild(this.svgTitle);

    // The Moon sits left of centre so the Sun has room to swing all the way
    // round it without landing on Earth, which is pinned to the right.
    const CX = 185;
    const CY = 120;
    const EARTH_X = 352;
    this.C = { x: CX, y: CY, r: 58 };
    this.sunOrbit = 100;

    this.sightline = svg('line', {
      x1: CX, y1: CY, x2: EARTH_X, y2: CY,
      class: 'sunlab__sightline',
    });
    chart.appendChild(this.sightline);

    this.dark = svg('circle', { cx: CX, cy: CY, r: this.C.r, class: 'sunlab__dark' });
    chart.appendChild(this.dark);

    this.lit = svg('path', { class: 'sunlab__lit', d: '' });
    chart.appendChild(this.lit);

    this.divider = svg('line', {
      x1: CX, y1: CY - this.C.r, x2: CX, y2: CY + this.C.r,
      class: 'sunlab__divider',
    });
    chart.appendChild(this.divider);

    // below the Moon, far enough apart not to collide with each other or with
    // the Sun when it swings underneath
    const labelY = CY + this.C.r + 22;
    chart.appendChild(svg('text', { x: CX - 80, y: labelY, class: 'sunlab__side' })).textContent = 'far side';
    chart.appendChild(svg('text', { x: CX + 80, y: labelY, class: 'sunlab__side' })).textContent = 'near side';

    const earth = svg('circle', { cx: EARTH_X, cy: CY, r: 16, class: 'sunlab__earth' });
    chart.appendChild(earth);
    chart.appendChild(svg('text', { x: EARTH_X, y: CY + 34, class: 'sunlab__tag' })).textContent = 'Earth';

    this.rays = svg('g', { class: 'sunlab__rays' });
    for (let i = 0; i < 3; i++) this.rays.appendChild(svg('line', {}));
    chart.appendChild(this.rays);

    this.sun = svg('circle', { r: 15, class: 'sunlab__sun' });
    chart.appendChild(this.sun);

    figure.appendChild(chart);
    host.appendChild(figure);

    /* ---------- controls ---------- */
    const controls = document.createElement('div');
    controls.className = 'widget__controls';

    const label = document.createElement('label');
    label.className = 'widget__slider';
    const labelText = document.createElement('span');
    labelText.className = 'widget__slider-label';
    labelText.textContent = 'Move the Sun through one lunar cycle';
    this.range = document.createElement('input');
    this.range.type = 'range';
    this.range.min = '0';
    this.range.max = '1000';
    this.range.step = '1';
    this.range.value = String(Math.round(this.t * 1000));
    this.range.setAttribute('aria-label', 'Position in the lunar cycle');
    this.range.addEventListener('input', () => {
      this.pause();
      this.set(Number(this.range.value) / 1000);
    });
    label.append(labelText, this.range);
    controls.appendChild(label);

    const row = document.createElement('div');
    row.className = 'widget__row';

    this.playBtn = document.createElement('button');
    this.playBtn.type = 'button';
    this.playBtn.className = 'btn btn--ghost btn--sm';
    this.playBtn.textContent = this.reduced ? 'Step to New Moon' : 'Play the cycle';
    this.playBtn.addEventListener('click', () => {
      if (this.reduced) { this.set(0); return; }
      this._playing ? this.pause() : this.play();
    });
    row.appendChild(this.playBtn);

    const jump = document.createElement('button');
    jump.type = 'button';
    jump.className = 'btn btn--ghost btn--sm';
    jump.textContent = 'Jump to New Moon';
    jump.addEventListener('click', () => { this.pause(); this.set(0); });
    row.appendChild(jump);

    controls.appendChild(row);
    host.appendChild(controls);

    /* ---------- readout ---------- */
    this.readout = document.createElement('div');
    this.readout.className = 'widget__readout';

    // Only the phase and the verdict are a live region. The day counter and
    // the meters change on every frame while the cycle plays, and announcing
    // that would be unusable.
    this.phaseEl = document.createElement('p');
    this.phaseEl.className = 'widget__readout-head';
    this.phaseEl.setAttribute('aria-live', 'polite');

    this.dayEl = document.createElement('p');
    this.dayEl.className = 'widget__readout-day';

    this.metersEl = document.createElement('div');
    this.metersEl.className = 'meters';
    this.farMeter = this._meter('Far side in sunlight', 'far');
    this.nearMeter = this._meter('Near side in sunlight', 'near');
    this.metersEl.append(this.farMeter.root, this.nearMeter.root);

    this.verdictEl = document.createElement('p');
    this.verdictEl.className = 'widget__readout-note';
    this.verdictEl.setAttribute('aria-live', 'polite');

    this.readout.append(this.phaseEl, this.dayEl, this.metersEl, this.verdictEl);
    host.appendChild(this.readout);

    if (this.scene) this.scene.enterSunLab();
    this.set(this.t);
  }

  _meter(label, key) {
    const root = document.createElement('div');
    root.className = `meter meter--${key}`;
    const head = document.createElement('div');
    head.className = 'meter__head';
    const name = document.createElement('span');
    name.textContent = label;
    const value = document.createElement('span');
    value.className = 'meter__value';
    head.append(name, value);
    const track = document.createElement('div');
    track.className = 'meter__track';
    const fill = document.createElement('span');
    track.appendChild(fill);
    root.append(head, track);
    return { root, value, fill };
  }

  /* ---------- state ---------- */

  set(t) {
    this.t = ((t % 1) + 1) % 1;
    this.range.value = String(Math.round(this.t * 1000));
    this._draw();
  }

  play() {
    if (this._playing) return;
    this._playing = true;
    this.playBtn.textContent = 'Pause';
    let last = performance.now();
    const step = (now) => {
      if (!this._playing) return;
      const dt = Math.min(now - last, 64);
      last = now;
      this._raf = requestAnimationFrame(step);
      this.set(this.t + dt / CYCLE_MS);
    };
    this._raf = requestAnimationFrame(step);
  }

  pause() {
    this._playing = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    if (this.playBtn) this.playBtn.textContent = this.reduced ? 'Step to New Moon' : 'Play the cycle';
  }

  /* ---------- drawing ---------- */

  _draw() {
    const alpha = Math.PI * (1 - 2 * this.t);            // Sun direction, Earth at 0
    const { x: cx, y: cy, r } = this.C;

    // the lit half of the Moon, as a closed half-disc through the Sun side
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = alpha - Math.PI / 2 + (Math.PI * i) / 40;
      pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy - r * Math.sin(a)).toFixed(2)}`);
    }
    this.lit.setAttribute('d', `M${pts.join('L')}Z`);

    // parallel rays arriving from the Sun's direction
    const SUN_R = this.sunOrbit;
    const sx = cx + SUN_R * Math.cos(alpha);
    const sy = cy - SUN_R * Math.sin(alpha);
    this.sun.setAttribute('cx', sx.toFixed(1));
    this.sun.setAttribute('cy', sy.toFixed(1));

    const px = -Math.sin(alpha);
    const py = -Math.cos(alpha);                          // screen-space perpendicular
    [...this.rays.children].forEach((line, i) => {
      const off = (i - 1) * 26;
      const ox = sx + px * off;
      const oy = sy + py * off;
      const dx = cx - sx;
      const dy = cy - sy;
      const len = Math.hypot(dx, dy) || 1;
      line.setAttribute('x1', (ox + (dx / len) * 22).toFixed(1));
      line.setAttribute('y1', (oy + (dy / len) * 22).toFixed(1));
      line.setAttribute('x2', (ox + (dx / len) * (len - r - 4)).toFixed(1));
      line.setAttribute('y2', (oy + (dy / len) * (len - r - 4)).toFixed(1));
    });

    // surface-area fraction of each hemisphere that is lit
    const off = Math.abs(((alpha + Math.PI) % (Math.PI * 2)) - Math.PI);
    const near = Math.max(0, 1 - off / Math.PI);
    const far = 1 - near;

    const name = phaseName(this.t);
    // guard the assignment so the live region only fires when it really changes
    if (this.phaseEl.textContent !== name) this.phaseEl.textContent = name;
    this.dayEl.textContent = `day ${(this.t * 29.5).toFixed(1)} of 29.5`;
    this.svgTitle.textContent =
      `Top-down view: ${name}. The far side is ${Math.round(far * 100)} per cent sunlit, the near side ${Math.round(near * 100)} per cent.`;

    this.farMeter.value.textContent = `${Math.round(far * 100)}%`;
    this.farMeter.fill.style.width = `${far * 100}%`;
    this.nearMeter.value.textContent = `${Math.round(near * 100)}%`;
    this.nearMeter.fill.style.width = `${near * 100}%`;

    const verdict =
      far > 0.97
        ? 'New Moon. From Earth you can barely see it — and the far side is in full daylight.'
        : far < 0.03
          ? 'Full Moon. Now the far side really is in darkness — for about the next two weeks.'
          : far > near
            ? 'More sunlight is falling on the side facing away from us than on the side we can see.'
            : 'The half we can see is getting most of the light right now. That will swap.';
    if (this.verdictEl.textContent !== verdict) this.verdictEl.textContent = verdict;

    if (this.scene) this.scene.setSunAngle(alpha);
  }

  destroy() {
    this.pause();
    if (this.scene) this.scene.exitSunLab();
    if (this.host) {
      this.host.classList.remove('widget', 'widget--sunlab');
      this.host.textContent = '';
    }
  }
}

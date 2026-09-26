import { mulberry32, clamp, lerp, easeOut, prefersReducedMotion } from '../../lib/util.js';

/**
 * "The smell of rain" — release a drop, then zoom into the contact point and
 * watch trapped air bubbles rise, burst, and throw out aerosols.
 *
 * Two controls, both of which change the outcome the way the research found:
 * gentler rain releases more aerosols than a downpour, and porous ground
 * releases far more than a dense surface.
 *
 * World space is a fixed 400 × 250 box; the canvas scales to the panel.
 */

const W = 400;
const H = 250;
const GROUND = 168;

const RAIN = {
  light: { label: 'Light rain', speed: 0.55, bubbles: 10 },
  heavy: { label: 'Heavy rain', speed: 1.35, bubbles: 3 },
};

const SURFACE = {
  porous: { label: 'Porous soil', factor: 1 },
  packed: { label: 'Packed stone', factor: 0.12 },
};

export class Petrichor {
  constructor() {
    this.rain = 'light';
    this.surface = 'porous';
    this.released = 0;
    this.bubbles = [];
    this.aerosols = [];
    this.splash = [];
    this.stage = 'idle';
    this.reduced = prefersReducedMotion();
    this.view = { z: 1, fx: W / 2, fy: H / 2, tz: 1, tfx: W / 2, tfy: H / 2 };
    this._raf = null;
    this._soil = this._buildSoil();
  }

  /* ---------- build ---------- */

  mount(host) {
    this.host = host;
    host.classList.add('widget', 'widget--petrichor');

    const figure = document.createElement('figure');
    figure.className = 'petri__figure';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'petri__canvas';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label',
      'Cross-section of ground. A raindrop lands, traps air bubbles, and the bubbles burst into a spray of much smaller droplets.');
    this.canvas.addEventListener('click', () => this.drop());
    figure.appendChild(this.canvas);
    host.appendChild(figure);

    const controls = document.createElement('div');
    controls.className = 'widget__controls';
    controls.append(
      this._chips('Rain', RAIN, 'rain'),
      this._chips('Ground', SURFACE, 'surface'),
    );

    const row = document.createElement('div');
    row.className = 'widget__row';
    this.dropBtn = document.createElement('button');
    this.dropBtn.type = 'button';
    this.dropBtn.className = 'btn btn--primary btn--sm';
    this.dropBtn.textContent = 'Release a drop';
    this.dropBtn.addEventListener('click', () => this.drop());
    row.appendChild(this.dropBtn);
    controls.appendChild(row);
    host.appendChild(controls);

    this.readout = document.createElement('div');
    this.readout.className = 'widget__readout';
    this.readout.setAttribute('aria-live', 'polite');
    this.countEl = document.createElement('p');
    this.countEl.className = 'widget__readout-head';
    this.noteEl = document.createElement('p');
    this.noteEl.className = 'widget__readout-note';
    this.readout.append(this.countEl, this.noteEl);
    host.appendChild(this.readout);

    this._resize = () => this._fit();
    window.addEventListener('resize', this._resize);
    this._fit();
    this._report();
    this._loop();
  }

  _chips(legendText, table, key) {
    const set = document.createElement('fieldset');
    set.className = 'widget__chipset';
    const legend = document.createElement('legend');
    legend.textContent = legendText;
    set.appendChild(legend);
    const wrap = document.createElement('div');
    wrap.className = 'filters__chips';
    Object.entries(table).forEach(([id, def]) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = def.label;
      chip.setAttribute('aria-pressed', this[key] === id ? 'true' : 'false');
      chip.addEventListener('click', () => {
        this[key] = id;
        wrap.querySelectorAll('.chip').forEach((c) =>
          c.setAttribute('aria-pressed', String(c === chip)));
        this._report();
      });
      wrap.appendChild(chip);
    });
    set.appendChild(wrap);
    return set;
  }

  _buildSoil() {
    const rand = mulberry32(5150);
    const grains = [];
    for (let i = 0; i < 190; i++) {
      grains.push({
        x: rand() * W,
        y: GROUND + 6 + rand() * (H - GROUND - 6),
        r: 3 + rand() * 11,
        tone: 0.3 + rand() * 0.5,
      });
    }
    const pores = [];
    for (let i = 0; i < 46; i++) {
      pores.push({ x: rand() * W, y: GROUND + 4 + rand() * 58, r: 1.6 + rand() * 4 });
    }
    return { grains, pores };
  }

  _fit() {
    if (!this.canvas) return;
    const cssW = Math.max(200, this.canvas.parentElement.clientWidth);
    const cssH = Math.round((cssW * H) / W);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this._scale = (cssW / W) * dpr;
  }

  /* ---------- the drop ---------- */

  drop() {
    if (this.stage !== 'idle' && this.stage !== 'settle') return;
    const rain = RAIN[this.rain];
    this.stage = 'falling';
    this.drip = { x: W / 2, y: -20, vy: 1.4 * rain.speed, r: 9 };
    this.dome = null;
    this.bubbles.length = 0;
    this.splash.length = 0;
    this.view.tz = 1;
    this.view.tfx = W / 2;
    this.view.tfy = H / 2;
  }

  _impact() {
    const rain = RAIN[this.rain];
    const surface = SURFACE[this.surface];
    this.stage = 'spreading';
    this.dome = { x: W / 2, y: GROUND, w: 6, h: 9, age: 0 };

    const n = Math.max(0, Math.round(rain.bubbles * surface.factor));
    const rand = mulberry32(Math.floor(performance.now()) % 99991);
    for (let i = 0; i < n; i++) {
      this.bubbles.push({
        ox: (rand() - 0.5) * 26,
        y: GROUND + 2,
        r: 1.1 + rand() * 2.1,
        v: 0.22 + rand() * 0.3,
        delay: rand() * 34,
        popped: false,
      });
    }
    this.lastCount = n;
    for (let i = 0; i < 9; i++) {
      this.splash.push({
        x: W / 2, y: GROUND,
        vx: (rand() - 0.5) * 3.4 * rain.speed,
        vy: -(0.7 + rand() * 1.5) * rain.speed,
        r: 1 + rand() * 1.6, life: 1,
      });
    }

    // zoom into the contact point: the reveal inside the reveal
    this.view.tz = 3.1;
    this.view.tfx = W / 2;
    this.view.tfy = GROUND - 22;
  }

  _pop(b) {
    b.popped = true;
    const rand = mulberry32(Math.floor(b.ox * 1000 + b.y * 13) >>> 0);
    const n = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      this.aerosols.push({
        x: W / 2 + b.ox + (rand() - 0.5) * 4,
        y: b.y,
        vx: (rand() - 0.5) * 0.5,
        vy: -(0.35 + rand() * 0.55),
        r: 0.5 + rand() * 0.7,
        life: 1,
      });
    }
    this.released += n;
    this._report();
  }

  _report() {
    const rain = RAIN[this.rain];
    const surface = SURFACE[this.surface];
    this.countEl.textContent = this.released
      ? `${this.released} aerosol droplets in the air`
      : 'Nothing in the air yet';

    if (this.surface === 'packed') {
      this.noteEl.textContent =
        'A dense surface has almost no pores for air to get trapped in, so almost nothing is thrown back up. This is why wet stone smells like so much less than wet earth.';
    } else if (this.rain === 'heavy') {
      this.noteEl.textContent =
        'A fast, heavy drop spreads and drains before many bubbles can escape. Counter-intuitively, a downpour releases fewer of these aerosols than gentle rain does.';
    } else {
      this.noteEl.textContent =
        'Light rain on porous ground is the best case: the drop sits long enough for trapped air to rise through it and burst, carrying soil compounds up to where you can smell them.';
    }
    if (this.lastCount === 0 && this.stage !== 'idle') {
      this.noteEl.textContent += ' That last drop released none at all.';
    }
  }

  /* ---------- loop ---------- */

  _loop() {
    const step = () => {
      this._raf = requestAnimationFrame(step);
      this._update();
      this._draw();
    };
    this._raf = requestAnimationFrame(step);
  }

  _update() {
    const k = this.reduced ? 2.4 : 1;

    if (this.stage === 'falling' && this.drip) {
      this.drip.vy += 0.09 * k;
      this.drip.y += this.drip.vy * k * 1.6;
      if (this.drip.y >= GROUND - this.drip.r) this._impact();
    }

    if (this.dome) {
      this.dome.age += k;
      const p = clamp(this.dome.age / 26, 0, 1);
      this.dome.w = lerp(6, 34, easeOut(p));
      this.dome.h = lerp(9, 13, easeOut(p));
      if (this.stage === 'spreading' && p >= 1) this.stage = 'bubbling';
      if (this.stage === 'bubbling' && this.dome.age > 150) {
        this.dome.h *= 0.94;
        if (this.dome.h < 1.5) {
          this.dome = null;
          this.stage = 'settle';
          this.view.tz = 1;
          this.view.tfx = W / 2;
          this.view.tfy = H / 2;
        }
      }
    }

    this.bubbles.forEach((b) => {
      if (b.popped) return;
      if (b.delay > 0) { b.delay -= k; return; }
      b.y -= b.v * k;
      const top = this.dome ? this.dome.y - this.dome.h : GROUND - 10;
      if (b.y <= top + b.r) this._pop(b);
    });
    if (this.bubbles.length && this.bubbles.every((b) => b.popped) && this.stage === 'bubbling') {
      if (this.dome) this.dome.age = Math.max(this.dome.age, 140);
    }
    if (this.stage === 'bubbling' && !this.bubbles.length && this.dome && this.dome.age > 60) {
      this.dome.age = Math.max(this.dome.age, 140);
    }

    this.aerosols.forEach((a) => {
      a.x += a.vx * k;
      a.y += a.vy * k;
      a.vy *= 0.994;
      a.vx += (Math.sin((a.y + a.x) * 0.05) * 0.01);
      a.life -= 0.0042 * k;
    });
    this.aerosols = this.aerosols.filter((a) => a.life > 0 && a.y > -30);

    this.splash.forEach((s) => {
      s.vy += 0.12 * k;
      s.x += s.vx * k;
      s.y += s.vy * k;
      s.life -= 0.02 * k;
    });
    this.splash = this.splash.filter((s) => s.life > 0 && s.y < GROUND + 4);

    if (this.stage === 'settle' && Math.abs(this.view.z - 1) < 0.02) this.stage = 'idle';

    const ease = this.reduced ? 0.35 : 0.06;
    this.view.z += (this.view.tz - this.view.z) * ease;
    this.view.fx += (this.view.tfx - this.view.fx) * ease;
    this.view.fy += (this.view.tfy - this.view.fy) * ease;
  }

  _draw() {
    const ctx = this.canvas.getContext('2d');
    const s = this._scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(s, 0, 0, s, 0, 0);

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, '#0a1020');
    sky.addColorStop(1, '#16203a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(this.view.z, this.view.z);
    ctx.translate(-this.view.fx, -this.view.fy);

    // soil
    const earth = ctx.createLinearGradient(0, GROUND - 4, 0, H);
    earth.addColorStop(0, '#5a4433');
    earth.addColorStop(1, '#2a1f18');
    ctx.fillStyle = earth;
    ctx.fillRect(-W, GROUND, W * 3, H);

    this._soil.grains.forEach((g) => {
      ctx.fillStyle = `rgba(${Math.round(130 * g.tone + 40)}, ${Math.round(100 * g.tone + 32)}, ${Math.round(76 * g.tone + 24)}, 0.85)`;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
      ctx.fill();
    });
    if (this.surface === 'porous') {
      this._soil.pores.forEach((p) => {
        ctx.fillStyle = 'rgba(8, 10, 16, 0.75)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
    } else {
      ctx.fillStyle = 'rgba(150, 150, 156, 0.5)';
      ctx.fillRect(-W, GROUND, W * 3, 7);
    }

    // aerosols
    this.aerosols.forEach((a) => {
      ctx.fillStyle = `rgba(190, 232, 255, ${(a.life * 0.85).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(190, 232, 255, ${(a.life * 0.14).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r * 3.4, 0, Math.PI * 2);
      ctx.fill();
    });

    // the falling drop
    if (this.stage === 'falling' && this.drip) {
      ctx.fillStyle = 'rgba(160, 205, 245, 0.92)';
      ctx.beginPath();
      ctx.ellipse(this.drip.x, this.drip.y, this.drip.r * 0.78, this.drip.r * 1.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // the flattened drop plus the air it trapped
    if (this.dome) {
      const { x, y, w, h } = this.dome;
      ctx.fillStyle = 'rgba(150, 200, 240, 0.34)';
      ctx.strokeStyle = 'rgba(200, 232, 255, 0.55)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(x, y, w, h, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      this.bubbles.forEach((b) => {
        if (b.popped || b.delay > 0) return;
        ctx.strokeStyle = 'rgba(226, 246, 255, 0.85)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.arc(x + b.ox, b.y, b.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(226, 246, 255, 0.18)';
        ctx.fill();
      });
    }

    this.splash.forEach((s) => {
      ctx.fillStyle = `rgba(170, 212, 248, ${(s.life * 0.8).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();

    // caption inside the frame while zoomed in
    if (this.view.z > 1.6) {
      ctx.fillStyle = 'rgba(244, 241, 234, 0.55)';
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.fillText('trapped air escaping, ~1000× magnified idea', 12, 20);
    }
  }

  destroy() {
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._resize);
    if (this.host) {
      this.host.classList.remove('widget', 'widget--petrichor');
      this.host.textContent = '';
    }
  }
}

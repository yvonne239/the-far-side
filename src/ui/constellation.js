import { THEMES } from '../data/stories.js';
import { moonFraction } from '../lib/progress.js';

/**
 * "My constellation" — the private view of what one visitor has given.
 *
 * Two jobs: the glass panel on the far side (streak moon, stardust, crystals)
 * and the shareable card. The card is drawn from scratch on a 2D canvas, not
 * grabbed from the 3D scene, so it can never contain a story or a message —
 * only the shape of the attention someone paid.
 */

const CARD_W = 1080;
const CARD_H = 1350;

/* ================================================================
   the little moon that tracks the streak
   ================================================================ */

/**
 * An SVG moon lit by `k` (0 = new, 1 = full). The terminator is an ellipse,
 * the way it actually looks, rather than a circle sliding across.
 */
function moonSvg(k, size = 26) {
  const r = size / 2 - 1;
  const cx = size / 2;
  const cy = size / 2;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('class', 'streak__moon');
  svg.setAttribute('aria-hidden', 'true');

  const dark = document.createElementNS(NS, 'circle');
  dark.setAttribute('cx', cx); dark.setAttribute('cy', cy); dark.setAttribute('r', r);
  dark.setAttribute('class', 'streak__moon-dark');
  svg.appendChild(dark);

  if (k > 0.005) {
    // right-hand limb is always the outer edge of the lit part; the inner edge
    // is an ellipse whose width follows how far through the cycle we are
    const rx = Math.abs(1 - 2 * k) * r;
    const sweepInner = k < 0.5 ? 0 : 1;
    const lit = document.createElementNS(NS, 'path');
    lit.setAttribute('d', [
      `M ${cx} ${cy - r}`,
      `A ${r} ${r} 0 0 1 ${cx} ${cy + r}`,
      `A ${rx} ${r} 0 0 ${sweepInner} ${cx} ${cy - r}`,
      'Z',
    ].join(' '));
    lit.setAttribute('class', 'streak__moon-lit');
    svg.appendChild(lit);
  }
  return svg;
}

/* ================================================================
   the panel
   ================================================================ */

export class Constellation {
  /**
   * @param {object} o
   * @param {() => object} o.read  everything the panel needs, fetched fresh
   *   each time it opens: { log, unlocked, streak, points }
   * @param {(on:boolean) => void} o.onToggle
   */
  constructor({ read, onToggle }) {
    this.read = read;
    this.onToggle = onToggle;

    this.panel = document.getElementById('constellation-panel');
    this.streakEl = document.getElementById('constellation-streak');
    this.listEl = document.getElementById('constellation-list');
    this.emptyEl = document.getElementById('constellation-empty');
    this.cardWrap = document.getElementById('constellation-card');
    this.countToggle = document.getElementById('card-show-count');
    this.open = false;
    this._card = null;

    this.panel.querySelectorAll('[data-close-constellation]').forEach((b) =>
      b.addEventListener('click', () => this.close()));

    document.getElementById('btn-make-card').addEventListener('click', () => this.buildCard());
    this.countToggle.addEventListener('change', () => { if (this._card) this.buildCard(); });
    document.getElementById('btn-card-download').addEventListener('click', () => this.download());
    document.getElementById('btn-card-share').addEventListener('click', () => this.share());
  }

  toggle() { return this.open ? this.close() : this.show(); }

  show() {
    this.open = true;
    this.data = this.read();
    this.render();
    this.panel.classList.add('is-open');
    document.body.dataset.constellation = 'open';
    this.onToggle(true);
  }

  close() {
    this.open = false;
    this.panel.classList.remove('is-open');
    document.body.dataset.constellation = 'closed';
    this.onToggle(false);
  }

  render() {
    const { log, unlocked, streak } = this.data;

    /* the streak moon */
    this.streakEl.textContent = '';
    if (streak.days > 0) {
      this.streakEl.appendChild(moonSvg(moonFraction(streak.days)));
      const label = document.createElement('span');
      label.textContent = `Day ${streak.days} of your moon`;
      this.streakEl.appendChild(label);
    }
    this.streakEl.hidden = streak.days <= 0;

    /* what has been earned */
    this.listEl.textContent = '';
    const empty = log.length === 0;
    this.emptyEl.hidden = !empty;
    this.cardWrap.hidden = empty;
    document.getElementById('btn-make-card').hidden = empty;

    if (empty) return;

    unlocked.forEach((m) => {
      const row = document.createElement('li');
      row.className = `keepsake keepsake--${m.kind}`;
      if (m.theme) row.style.setProperty('--c', THEMES[m.theme]?.color || 'var(--warm)');

      const mark = document.createElement('span');
      mark.className = 'keepsake__mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = m.kind === 'crystal' ? '◆' : '✦';

      const body = document.createElement('span');
      body.className = 'keepsake__body';
      const name = document.createElement('strong');
      name.textContent = m.label;
      const line = document.createElement('em');
      line.textContent = m.line;
      body.append(name, line);

      row.append(mark, body);
      this.listEl.appendChild(row);
    });
  }

  /* ================================================================
     the card
     ================================================================ */

  async buildCard() {
    const { points, todayCount } = this.data;
    const showCount = this.countToggle.checked;

    const canvas = this.cardWrap.querySelector('canvas') || document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    canvas.className = 'card-preview';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'A card showing your constellation, with no story text on it.');
    if (!canvas.parentElement) this.cardWrap.querySelector('.card-slot').appendChild(canvas);

    // the card's type is Cinzel; make sure it is actually there before drawing
    try {
      await Promise.all([
        document.fonts.load('600 46px Cinzel'),
        document.fonts.load('400 24px Cinzel'),
      ]);
    } catch { /* fall back to the stack below */ }

    drawCard(canvas.getContext('2d'), { points, showCount, todayCount });
    this._card = canvas;
    document.getElementById('card-actions').hidden = false;

    const share = document.getElementById('btn-card-share');
    share.hidden = !(navigator.canShare && navigator.share);
  }

  async _blob() {
    if (!this._card) return null;
    return new Promise((res) => this._card.toBlob(res, 'image/png'));
  }

  async download() {
    const blob = await this._blob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'moonflip-constellation.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async share() {
    const blob = await this._blob();
    if (!blob) return;
    const file = new File([blob], 'moonflip-constellation.png', { type: 'image/png' });
    if (!(navigator.canShare && navigator.canShare({ files: [file] }))) return;
    try {
      await navigator.share({ files: [file], title: 'Moonflip' });
    } catch { /* the visitor dismissed the sheet */ }
  }
}

/* ================================================================
   drawing the card — 2D only, never a grab of the 3D scene
   ================================================================ */

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} o
 * @param {Array<{x:number,y:number,color:string,kind:string}>} o.points
 *   unit-sphere x/y of each signalled light, already orthographic from the
 *   far side, plus any stardust. No ids, no text — nothing readable.
 */
export function drawCard(ctx, { points, showCount, todayCount }) {
  const W = CARD_W;
  const H = CARD_H;
  const serif = '"Cinzel", Georgia, serif';

  /* --- deep sky --- */
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#080a14');
  sky.addColorStop(0.55, '#0b0e1c');
  sky.addColorStop(1, '#05060d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // a scatter of faint stars, deterministic so the card is reproducible
  let seed = 20260927;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 260; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = 0.6 + rand() * 1.5;
    ctx.fillStyle = `rgba(233,238,255,${0.12 + rand() * 0.4})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  /* --- the constellation --- */
  const cx = W / 2;
  const cy = H * 0.40;
  const R = W * 0.33;
  const at = (p) => ({ x: cx + p.x * R, y: cy - p.y * R });

  const lights = points.filter((p) => p.kind !== 'dust');
  const dust = points.filter((p) => p.kind === 'dust');

  // strands in order, each in the colour of the light it reaches
  ctx.lineCap = 'round';
  for (let i = 1; i < lights.length; i++) {
    const a = at(lights[i - 1]);
    const b = at(lights[i]);
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    g.addColorStop(0, hexA(lights[i - 1].color, 0.22));
    g.addColorStop(1, hexA(lights[i].color, 0.5));
    ctx.strokeStyle = g;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  dust.forEach((p) => {
    const q = at(p);
    ctx.fillStyle = 'rgba(255,242,212,0.9)';
    ctx.beginPath(); ctx.arc(q.x, q.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,242,212,0.16)';
    ctx.beginPath(); ctx.arc(q.x, q.y, 12, 0, Math.PI * 2); ctx.fill();
  });

  lights.forEach((p) => {
    const q = at(p);
    const halo = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 30);
    halo.addColorStop(0, hexA(p.color, 0.55));
    halo.addColorStop(1, hexA(p.color, 0));
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(q.x, q.y, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(q.x, q.y, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(q.x, q.y, 2.6, 0, Math.PI * 2); ctx.fill();
  });

  /* --- words --- */
  ctx.textAlign = 'center';

  const line = showCount
    ? `Tonight, I sent ${todayCount} ${todayCount === 1 ? 'beam' : 'beams'} of light into deep space.`
    : 'Tonight, I stopped for a few stories on the far side.';

  ctx.fillStyle = '#f4f1ea';
  ctx.font = `600 46px ${serif}`;
  wrap(ctx, line, cx, H * 0.78, W - 200, 62);

  ctx.fillStyle = 'rgba(255,184,119,0.78)';
  ctx.font = `400 24px ${serif}`;
  ctx.fillText('MoonFlip · Every highlight has a story outside the frame.', cx, H - 78);
}

/** #rrggbb → rgba(), so the card can fade a theme colour out. */
function hexA(hex, a) {
  const h = String(hex).replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function wrap(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  words.forEach((w) => {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && cur) { lines.push(cur); cur = w; }
    else cur = next;
  });
  if (cur) lines.push(cur);
  const top = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, top + i * lineHeight));
}

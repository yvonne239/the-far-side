import * as THREE from 'three';
import { mulberry32 } from '../lib/util.js';

/**
 * The Moon is drawn into a canvas at load time rather than downloaded, so the
 * whole piece is one repo with no binary assets.
 *
 * Texture layout follows three.js' default sphere UVs:
 *   u = 0.25 → +Z → the NEAR side, the face that performs for Earth
 *   u = 0.75 → -Z → the FAR side, where the journey ends
 * So the left half of the canvas is the bright, blue-grey, maria-scarred
 * near side, and the right half is the warmer, heavily cratered far side.
 */
export function createMoonTexture() {
  const W = 2048;
  const H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(20260926);

  // --- base albedo: cool and bright on the near side, warm on the far side
  const base = ctx.createLinearGradient(0, 0, W, 0);
  base.addColorStop(0.00, '#8a8885');
  base.addColorStop(0.12, '#b4b2ae');
  base.addColorStop(0.25, '#c2c0bb');
  base.addColorStop(0.38, '#a8a49f');
  base.addColorStop(0.50, '#8f8680');
  base.addColorStop(0.63, '#9d9690');
  base.addColorStop(0.75, '#a69b91');
  base.addColorStop(0.88, '#968f88');
  base.addColorStop(1.00, '#8a8885');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // --- maria: the big dark seas only the near side has
  const maria = [
    [0.155, 0.32, 0.115], [0.215, 0.24, 0.085], [0.27, 0.34, 0.1],
    [0.205, 0.46, 0.075], [0.135, 0.52, 0.06], [0.31, 0.2, 0.06],
    [0.345, 0.47, 0.05], [0.245, 0.62, 0.055],
  ];
  maria.forEach(([u, v, r]) => {
    const x = u * W;
    const y = v * H;
    const rad = r * W;
    const g = ctx.createRadialGradient(x, y, rad * 0.15, x, y, rad);
    g.addColorStop(0, 'rgba(46, 48, 56, 0.92)');
    g.addColorStop(0.6, 'rgba(56, 58, 66, 0.7)');
    g.addColorStop(1, 'rgba(62, 64, 72, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    // squash horizontally away from the equator to fight UV stretching
    ctx.ellipse(x, y, rad * (1.1 + rand() * 0.5), rad * (0.72 + rand() * 0.3), rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // --- craters everywhere, denser and older-looking on the far side
  const crater = (x, y, r, strength) => {
    // stretch in u near the poles so craters stay round on the sphere
    const stretch = 1 / Math.max(0.2, Math.sin((Math.PI * y) / H));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(Math.min(stretch, 5), 1);
    const g = ctx.createRadialGradient(0, 0, r * 0.05, 0, 0, r);
    g.addColorStop(0.00, `rgba(42, 39, 36, ${0.3 * strength})`);
    g.addColorStop(0.55, `rgba(66, 62, 57, ${0.16 * strength})`);
    g.addColorStop(0.82, `rgba(236, 232, 223, ${0.12 * strength})`);
    g.addColorStop(0.92, `rgba(236, 230, 220, ${0.05 * strength})`);
    g.addColorStop(1.00, 'rgba(236, 230, 220, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const total = 1700;
  for (let i = 0; i < total; i++) {
    const farSide = rand() < 0.64;                       // far side is more battered
    const u = farSide ? 0.5 + rand() * 0.5 : rand() * 0.5;
    const x = u * W;
    const y = Math.pow(rand(), 0.85) * H;
    const r = 2.5 + Math.pow(rand(), 3.4) * 44;
    const strength = (farSide ? 1.05 : 0.8) * (0.55 + rand() * 0.6);
    crater(x, y, r, strength);
    if (x - r * 2 < 0) crater(x + W, y, r, strength);    // wrap the seam
    if (x + r * 2 > W) crater(x - W, y, r, strength);
  }

  // --- a few bright ray systems (Tycho-like)
  for (let i = 0; i < 6; i++) {
    const x = rand() * W;
    const y = 0.2 * H + rand() * 0.6 * H;
    const rad = 200 + rand() * 170;
    const g = ctx.createRadialGradient(x, y, rad * 0.25, x, y, rad);
    g.addColorStop(0.0, 'rgba(240, 237, 229, 0.1)');
    g.addColorStop(0.5, 'rgba(240, 237, 229, 0.05)');
    g.addColorStop(1.0, 'rgba(240, 237, 229, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- fine grain
  const grain = ctx.getImageData(0, 0, W, H);
  const px = grain.data;
  for (let i = 0; i < px.length; i += 4) {
    const n = (rand() - 0.5) * 16;
    px[i] = Math.max(0, Math.min(255, px[i] + n));
    px[i + 1] = Math.max(0, Math.min(255, px[i + 1] + n));
    px[i + 2] = Math.max(0, Math.min(255, px[i + 2] + n));
  }
  ctx.putImageData(grain, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

/** Soft radial dot used for story lights, the travelling post and beam pulses. */
export function createGlowTexture(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0.00, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.42, 'rgba(255,255,255,0.28)');
  g.addColorStop(0.72, 'rgba(255,255,255,0.06)');
  g.addColorStop(1.00, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Earth, seen only from the near side — the far side never gets to look back. */
export function createEarthTexture() {
  const W = 512;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(7771);

  const ocean = ctx.createLinearGradient(0, 0, 0, H);
  ocean.addColorStop(0, '#1d4f9c');
  ocean.addColorStop(0.5, '#1668c4');
  ocean.addColorStop(1, '#1a4a8f');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#3f7a4a';
  for (let i = 0; i < 26; i++) {
    const x = rand() * W;
    const y = 30 + rand() * (H - 60);
    ctx.beginPath();
    ctx.ellipse(x, y, 12 + rand() * 46, 8 + rand() * 26, rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 40; i++) {
    const x = rand() * W;
    const y = rand() * H;
    ctx.beginPath();
    ctx.ellipse(x, y, 16 + rand() * 50, 5 + rand() * 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

import * as THREE from 'three';

/* ---------- deterministic randomness ---------- */

/** Mulberry32 — small, fast, seedable PRNG so the Moon looks the same every visit. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- maths ---------- */

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t) => t * t * t;

/** Shortest signed angular distance from `from` to `to`, in radians. */
export function shortestAngle(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/* ---------- lunar surface coordinates ---------- */

/**
 * A point on the Moon in local (moon-group) space.
 *
 * Longitude 0° points at -Z, which is the centre of the FAR side — the
 * hemisphere the camera ends its flight in. Longitude +90° is +X.
 * The default sphere UVs put -Z at u = 0.75, which is where the far-side
 * half of the generated texture lives, so the two agree.
 */
export function surfacePoint(lat, lon, radius = 1) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon);
  const s = Math.sin(phi);
  return new THREE.Vector3(
    radius * s * Math.sin(theta),
    radius * Math.cos(phi),
    -radius * s * Math.cos(theta),
  );
}

/** The azimuth (around +Y, measured from -Z) of a direction. */
export function azimuthOf(vec) {
  return Math.atan2(vec.x, -vec.z);
}

/** Great-circle interpolation between two directions (both assumed unit-ish). */
export function slerpDirection(a, b, t, out = new THREE.Vector3()) {
  const na = a.clone().normalize();
  const nb = b.clone().normalize();
  const dot = clamp(na.dot(nb), -1, 1);
  const omega = Math.acos(dot);
  if (omega < 1e-5) return out.copy(nb);
  const so = Math.sin(omega);
  const wa = Math.sin((1 - t) * omega) / so;
  const wb = Math.sin(t * omega) / so;
  return out.set(
    na.x * wa + nb.x * wb,
    na.y * wa + nb.y * wb,
    na.z * wa + nb.z * wb,
  );
}

/* ---------- misc ---------- */

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatCount(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

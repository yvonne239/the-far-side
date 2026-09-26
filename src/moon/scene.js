import * as THREE from 'three';
import { createMoonTexture, createGlowTexture, createEarthTexture } from './textures.js';
import { THEMES } from '../data/stories.js';
import {
  mulberry32, clamp, lerp, easeInOut, easeOut,
  surfacePoint, azimuthOf, slerpDirection, shortestAngle, prefersReducedMotion,
} from '../lib/util.js';

const MOON_R = 1;
const LIGHT_R = 1.016;

/**
 * The whole 3D stage: the Moon, the story lights on its far side, the relay
 * satellite, the flight around the limb, and the signal beams that slowly
 * draw a constellation across the surface.
 *
 * Far-side story lights get a real DOM button projected on top of them, so
 * they are clickable, focusable and screen-reader-visible. The hundreds of
 * ambient "other people" lights are GPU points with no DOM at all.
 */
export class MoonScene {
  constructor(canvas, markerLayer) {
    this.canvas = canvas;
    this.markerLayer = markerLayer;
    this.reduced = prefersReducedMotion();

    this.onLightClick = () => {};
    this.lights = new Map();       // id -> { id, theme, dir, sprite, el, quiet }
    this.tweens = [];
    this.phase = 'intro';
    this.filter = 'all';
    this.signalled = [];
    this.viewerAnchor = null;
    this.clock = new THREE.Clock();
    this._raf = null;
    this._dragMoved = false;

    this.cam = { angle: 0, radius: 3.35, elev: 0.1, spin: 0.03 };
    this.camVel = { angle: 0 };

    this._initRenderer();
    this._initScene();
    this._initDrag();

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  /* ================================================================
     setup
     ================================================================ */

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.setClearColor(0x05060d, 1);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);
    this.glow = createGlowTexture();

    // --- the Moon
    this.moonGroup = new THREE.Group();
    this.scene.add(this.moonGroup);

    const moonMap = createMoonTexture();
    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(MOON_R, 128, 96),
      new THREE.MeshStandardMaterial({
        map: moonMap,
        bumpMap: moonMap,
        bumpScale: 0.22,
        roughness: 0.94,
        metalness: 0,
      }),
    );
    this.moonGroup.add(this.moon);

    // a whisper of atmosphere-less rim light so the silhouette never dies
    this.rim = new THREE.Mesh(
      new THREE.SphereGeometry(MOON_R * 1.035, 64, 48),
      new THREE.MeshBasicMaterial({
        color: 0x6f86c8,
        transparent: true,
        opacity: 0.07,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.scene.add(this.rim);

    // --- light
    this.sun = new THREE.DirectionalLight(0xfff6e8, 2.5);
    this.sun.position.set(2.6, 1.1, 4.2);
    this.scene.add(this.sun);

    this.farFill = new THREE.DirectionalLight(0xffd2a8, 0);
    this.farFill.position.set(-1.8, 1.4, -3.6);
    this.scene.add(this.farFill);

    this.earthShine = new THREE.DirectionalLight(0x9fc4ff, 0.22);
    this.earthShine.position.set(1.2, 0.5, 3.0);
    this.scene.add(this.earthShine);

    // starlight from the other side, so the far side reads cool-grey with
    // warmth in it rather than sepia
    this.farCool = new THREE.DirectionalLight(0xa8c0ff, 0);
    this.farCool.position.set(2.2, -0.8, -2.4);
    this.scene.add(this.farCool);

    this.ambient = new THREE.AmbientLight(0x2a3050, 0.42);
    this.scene.add(this.ambient);

    this._initStars();
    this._initEarth();
    this._initRelay();

    // --- groups the journey writes into
    this.lightGroup = new THREE.Group();
    this.lightGroup.visible = false;      // the far side keeps its lights to itself
    this.moonGroup.add(this.lightGroup);

    this.constellation = new THREE.Group();
    this.moonGroup.add(this.constellation);

    this.beamGroup = new THREE.Group();
    this.scene.add(this.beamGroup);

    this._initTravellingPost();
  }

  _initStars() {
    const count = 2800;
    const rand = mulberry32(31337);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const u = rand() * 2 - 1;
      const t = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const r = 90 + rand() * 90;
      pos[i * 3] = r * s * Math.cos(t);
      pos[i * 3 + 1] = r * u;
      pos[i * 3 + 2] = r * s * Math.sin(t);

      const warmth = rand();
      c.setHSL(warmth < 0.75 ? 0.58 : 0.09, 0.35, 0.6 + rand() * 0.35);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 1.15,
      map: this.glow,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }));
    this.scene.add(this.stars);
  }

  _initEarth() {
    this.earth = new THREE.Group();
    this.earth.position.set(2.95, 1.5, -6.6);
    this.scene.add(this.earth);

    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 48, 36),
      new THREE.MeshStandardMaterial({
        map: createEarthTexture(),
        roughness: 0.75,
        metalness: 0.05,
        emissive: 0x0a1e3a,
        emissiveIntensity: 0.5,
      }),
    );
    globe.rotation.y = -0.6;
    this.earthGlobe = globe;
    this.earth.add(globe);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glow,
      color: 0x8fc2ff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    halo.scale.setScalar(1.5);
    this.earth.add(halo);
  }

  _initRelay() {
    this.relay = new THREE.Group();
    this.scene.add(this.relay);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.055, 0.085),
      new THREE.MeshStandardMaterial({ color: 0xd8d5cd, roughness: 0.45, metalness: 0.6 }),
    );
    this.relay.add(body);

    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x2a3f7a, roughness: 0.3, metalness: 0.7,
      emissive: 0x16284f, emissiveIntensity: 0.6,
    });
    [-1, 1].forEach((side) => {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.004, 0.06), panelMat);
      panel.position.x = side * 0.1;
      this.relay.add(panel);
    });

    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide }),
    );
    dish.rotation.x = Math.PI;
    dish.position.y = -0.04;
    this.relay.add(dish);

    this.relayBeacon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glow, color: 0xffb877, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.relayBeacon.scale.setScalar(0.22);
    this.relay.add(this.relayBeacon);

    this.relay.scale.setScalar(0.62);
    this.relayOrbit = { radius: 2.45, incl: 0.52, phase: 2.5, speed: 0.11 };
    this._updateRelay(0);
  }

  _initTravellingPost() {
    this.travel = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glow, color: 0xdce8ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.travel.scale.setScalar(0.5);
    this.travel.visible = false;
    this.moonGroup.add(this.travel);

    // the arc the post traces around the limb; it stays as the first strand
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(200 * 3), 3));
    geo.setDrawRange(0, 0);
    this.travelTrail = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0xffd3a1, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.travelTrail.visible = false;
    this.moonGroup.add(this.travelTrail);
  }

  /* ================================================================
     story lights
     ================================================================ */

  setStories(stories) {
    stories.forEach((story) => {
      this.addLight({
        id: story.id,
        theme: story.theme,
        lat: story.anchor.lat,
        lon: story.anchor.lon,
        label: THEMES[story.theme]?.label || '',
      });
    });
    this._initQuietLights();
  }

  addLight({ id, theme, lat, lon, label, mine = false }) {
    const color = new THREE.Color(mine ? '#fff4d6' : (THEMES[theme]?.color || '#ffb877'));
    const dir = surfacePoint(lat, lon, 1);

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glow, color, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sprite.position.copy(dir).multiplyScalar(LIGHT_R);
    sprite.scale.setScalar(0.2);
    this.lightGroup.add(sprite);

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'marker';
    el.style.setProperty('--c', `#${color.getHexString()}`);
    el.setAttribute('aria-label', `Open story: ${label || 'a story'}`);

    const dot = document.createElement('span');
    dot.className = 'marker__dot';
    const cap = document.createElement('span');
    cap.className = 'marker__label';
    cap.textContent = mine ? 'Yours' : label;
    el.append(dot, cap);

    el.addEventListener('click', () => {
      if (this._dragMoved) return;
      this.onLightClick(id);
    });

    // hidden and inert until the far side is reached
    el.style.pointerEvents = 'none';
    el.tabIndex = -1;
    this.markerLayer.appendChild(el);

    const light = { id, theme, dir, sprite, el, mine, baseScale: 0.2, pulse: 0, visible: false };
    this.lights.set(id, light);
    return light;
  }

  removeLight(id) {
    const light = this.lights.get(id);
    if (!light) return;
    this.lightGroup.remove(light.sprite);
    light.sprite.material.dispose();
    light.el.remove();
    this.lights.delete(id);
  }

  /** Hundreds of other two-sided stories, as GPU points. No DOM, no clicks. */
  _initQuietLights() {
    const rand = mulberry32(90210);
    const count = 220;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c = new THREE.Color();
    const keys = Object.keys(THEMES);

    for (let i = 0; i < count; i++) {
      const lat = (rand() * 2 - 1) * 72;
      const lon = (rand() * 2 - 1) * 175;
      const p = surfacePoint(lat, lon, LIGHT_R);
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      c.set(THEMES[keys[(rand() * keys.length) | 0]].color);
      const dim = 0.22 + rand() * 0.3;
      col[i * 3] = c.r * dim; col[i * 3 + 1] = c.g * dim; col[i * 3 + 2] = c.b * dim;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    this.quietLights = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.055,
      map: this.glow,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }));
    this.quietLights.visible = false;
    this.moonGroup.add(this.quietLights);
  }

  setFilter(theme) {
    this.filter = theme || 'all';
    this.lights.forEach((light) => {
      const on = this.filter === 'all' || light.theme === this.filter;
      light.el.classList.toggle('is-dim', !on);
      light.sprite.material.opacity = on ? 0.95 : 0.16;
    });
  }

  setActiveLight(id) {
    this.lights.forEach((light) => {
      light.el.classList.toggle('is-active', light.id === id);
    });
  }

  markSignalled(id) {
    const light = this.lights.get(id);
    if (light) light.el.classList.add('is-signalled');
  }

  /* ================================================================
     phases
     ================================================================ */

  setPhase(phase) {
    this.phase = phase;
    if (phase === 'bright' || phase === 'post') {
      this.cam.spin = phase === 'post' ? 0.006 : 0.028;
    } else if (phase === 'far') {
      this.cam.spin = 0.004;
    } else {
      this.cam.spin = 0.012;
    }
    this.markerLayer.setAttribute('aria-hidden', phase === 'far' ? 'false' : 'true');
  }

  /** Slow drift on the intro/bright side. */
  start() {
    if (this._raf) return;
    this.clock.start();
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      this._frame(Math.min(this.clock.getDelta(), 0.05));
    };
    loop();
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  /* ================================================================
     the flight
     ================================================================ */

  /**
   * Carry the selected post around the limb to its far-side light.
   * Resolves when the light lands.
   */
  flyToFarSide(storyId, { duration = 7000, onProgress } = {}) {
    const light = this.lights.get(storyId);
    if (!light) return Promise.resolve();

    const dur = this.reduced ? Math.min(duration, 2200) : duration;

    // turn the Moon so the target light ends up facing the camera
    const startRotY = this.moonGroup.rotation.y;
    const targetRotY = -azimuthOf(light.dir);
    const deltaRot = shortestAngle(startRotY, targetRotY);

    // the post starts wherever the near side currently faces Earth
    const startDir = new THREE.Vector3(0, 0, 1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), -startRotY)
      .normalize();
    const endDir = light.dir.clone().normalize();

    // pre-compute the arc it flies, for the trailing strand
    const SAMPLES = 200;
    const trailPos = this.travelTrail.geometry.attributes.position;
    const tmp = new THREE.Vector3();
    for (let i = 0; i < SAMPLES; i++) {
      const t = i / (SAMPLES - 1);
      slerpDirection(startDir, endDir, t, tmp);
      tmp.multiplyScalar(LIGHT_R + Math.sin(Math.PI * t) * 0.26);
      trailPos.setXYZ(i, tmp.x, tmp.y, tmp.z);
    }
    trailPos.needsUpdate = true;
    this.travelTrail.geometry.computeBoundingSphere();
    this.travelTrail.geometry.setDrawRange(0, 0);
    this.travelTrail.material.opacity = 0.75;

    this.travel.material.opacity = 1;
    this.travel.material.color.set(0xdce8ff);
    this.travel.scale.setScalar(0.62);
    this.travel.visible = true;
    this.travelTrail.visible = true;
    this.quietLights.visible = true;
    this.lightGroup.visible = true;

    const startCam = { ...this.cam };
    const targetSprite = light.sprite;
    targetSprite.material.opacity = 0;

    return new Promise((resolve) => {
      this.flight = this._tween({
        dur,
        onUpdate: (raw) => {
          const p = easeInOut(raw);

          // camera swings from the near face round to the far face
          this.cam.angle = lerp(startCam.angle, Math.PI, p);
          this.cam.radius = lerp(startCam.radius, 3.05, p) + Math.sin(Math.PI * raw) * 0.55;
          this.cam.elev = lerp(startCam.elev, 0.17, p) + Math.sin(Math.PI * raw) * 0.1;
          this.moonGroup.rotation.y = startRotY + deltaRot * p;

          // world warms up, the sun falls behind us
          this.sun.intensity = lerp(2.5, 0.62, p);
          this.farFill.intensity = lerp(0, 0.62, p);
          this.earthShine.intensity = lerp(0.22, 0.08, p);
          this.farCool.intensity = lerp(0, 0.4, p);
          this.ambient.color.setHSL(lerp(0.62, 0.1, p), lerp(0.4, 0.15, p), 0.23);
          this.ambient.intensity = lerp(0.42, 0.62, p);
          if (this.quietLights) this.quietLights.material.opacity = easeOut(clamp((p - 0.45) / 0.55, 0, 1)) * 0.75;

          // the post itself: polished image shrinking to a point of light
          const tp = clamp(p / 0.94, 0, 1);
          slerpDirection(startDir, endDir, tp, tmp);
          tmp.multiplyScalar(LIGHT_R + Math.sin(Math.PI * tp) * 0.26);
          this.travel.position.copy(tmp);
          this.travel.scale.setScalar(lerp(0.62, 0.2, easeOut(tp)));
          this.travel.material.color.lerpColors(
            new THREE.Color(0xdce8ff),
            light.sprite.material.color,
            easeOut(tp),
          );
          this.travelTrail.geometry.setDrawRange(0, Math.max(2, Math.floor(tp * SAMPLES)));
          this.travelTrail.material.opacity = 0.75 * (1 - clamp((p - 0.7) / 0.3, 0, 1)) + 0.18;

          if (onProgress) onProgress(raw);
        },
        onDone: () => {
          this.travel.material.opacity = 0;
          this.travel.visible = false;
          targetSprite.material.opacity = 0.95;
          light.pulse = 1.4;
          this.flight = null;
          this.viewerAnchor = surfacePoint(
            clamp(this._latOf(light.dir) - 26, -80, 80),
            this._lonOf(light.dir) - 13,
            1,
          );
          this._addViewerBeacon();
          resolve();
        },
      });
    });
  }

  skipFlight() {
    if (this.flight) this.flight.t = this.flight.dur;
  }

  /** Bring a light round to face the camera. */
  focusLight(id, dur = 1300) {
    const light = this.lights.get(id);
    if (!light) return;
    const start = this.moonGroup.rotation.y;
    const delta = shortestAngle(start, -azimuthOf(light.dir));
    const startElev = this.cam.elev;
    const targetElev = clamp(THREE.MathUtils.degToRad(this._latOf(light.dir)) * 0.55, -0.3, 0.45);
    this._tween({
      dur: this.reduced ? 200 : dur,
      onUpdate: (raw) => {
        const p = easeInOut(raw);
        this.moonGroup.rotation.y = start + delta * p;
        this.cam.elev = lerp(startElev, targetElev, p);
      },
    });
    light.pulse = 1;
  }

  /** Pull back so Earth rises past the limb again for the closing screen. */
  earthRise(dur = 3200) {
    const start = { ...this.cam };
    this._tween({
      dur: this.reduced ? 300 : dur,
      onUpdate: (raw) => {
        const p = easeInOut(raw);
        this.cam.angle = lerp(start.angle, Math.PI * 1.62, p);
        this.cam.radius = lerp(start.radius, 4.5, p);
        this.cam.elev = lerp(start.elev, 0.22, p);
        this.sun.intensity = lerp(0.62, 1.9, p);
        this.earthShine.intensity = lerp(0.08, 0.28, p);
      },
    });
  }

  /**
   * Fly back to the bright side for a second journey. The constellation and
   * the lights that have been signalled are deliberately kept — they are the
   * record of people noticing each other, and restarting should not erase it.
   */
  resetCamera() {
    this.tweens.length = 0;
    this.flight = null;
    this.cam = { angle: 0, radius: 3.35, elev: 0.1, spin: 0.028 };
    this.camVel.angle = 0;
    this.moonGroup.rotation.y = 0;
    this.sun.intensity = 2.5;
    this.farFill.intensity = 0;
    this.earthShine.intensity = 0.22;
    this.farCool.intensity = 0;
    this.ambient.color.setHSL(0.62, 0.4, 0.22);   // back to cool
    this.ambient.intensity = 0.42;
    if (this.quietLights) {
      this.quietLights.material.opacity = 0;
      this.quietLights.visible = false;
    }
    this.lightGroup.visible = false;
    this.travel.material.opacity = 0;
    this.travel.visible = false;
    this.travelTrail.material.opacity = 0;
    this.travelTrail.visible = false;
    this.travelTrail.geometry.setDrawRange(0, 0);
    this.beamGroup.clear();
    this.lights.forEach((l) => {
      l.el.classList.remove('is-active', 'is-dim');
      l.sprite.material.opacity = 0.95;
    });
    this.filter = 'all';
  }

  /* ================================================================
     signals + constellation
     ================================================================ */

  /**
   * A beam from where the visitor landed, up through the relay satellite,
   * and down onto the story's light. Resolves when it arrives.
   */
  sendSignal(storyId, { duration = 2600, onArrive } = {}) {
    const light = this.lights.get(storyId);
    if (!light) return Promise.resolve();

    const origin = (this.viewerAnchor || surfacePoint(-30, -20, 1)).clone();
    const target = light.dir.clone();

    const geo = new THREE.BufferGeometry();
    const SAMPLES = 150;
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SAMPLES * 3), 3));
    geo.setDrawRange(0, 0);
    const beam = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0xffd9a8, transparent: true, opacity: 0.85,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.beamGroup.add(beam);

    const pulse = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glow, color: 0xfff1d8, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    pulse.scale.setScalar(0.17);
    this.beamGroup.add(pulse);

    const dur = this.reduced ? 900 : duration;
    let arrived = false;

    return new Promise((resolve) => {
      this._tween({
        dur,
        onUpdate: (raw) => {
          const curve = this._beamCurve(origin, target);
          const pts = curve.getPoints(SAMPLES - 1);
          const attr = geo.attributes.position;
          for (let i = 0; i < SAMPLES; i++) {
            const p = pts[Math.min(i, pts.length - 1)];
            attr.setXYZ(i, p.x, p.y, p.z);
          }
          attr.needsUpdate = true;
          geo.computeBoundingSphere();

          const head = easeInOut(raw);
          geo.setDrawRange(0, Math.max(2, Math.floor(head * SAMPLES)));
          pulse.position.copy(curve.getPointAt(clamp(head, 0, 1)));
          pulse.scale.setScalar(0.17 + Math.sin(Math.PI * raw) * 0.07);

          // fade the trail out behind the head
          beam.material.opacity = 0.85 * (1 - clamp((raw - 0.55) / 0.45, 0, 1)) + 0.05;
          pulse.material.opacity = 1 - clamp((raw - 0.85) / 0.15, 0, 1);

          if (!arrived && raw > 0.97) {
            arrived = true;
            light.pulse = 1.6;
            if (onArrive) onArrive();
          }
        },
        onDone: () => {
          this.beamGroup.remove(beam);
          this.beamGroup.remove(pulse);
          geo.dispose();
          beam.material.dispose();
          pulse.material.dispose();
          this._addStrand(origin, target, 0.34);
          const prev = this.signalled[this.signalled.length - 1];
          if (prev && prev !== storyId) {
            const prevLight = this.lights.get(prev);
            if (prevLight) this._addStrand(prevLight.dir, target, 0.2);
          }
          if (!this.signalled.includes(storyId)) this.signalled.push(storyId);
          resolve();
        },
      });
    });
  }

  /** origin → lift off → relay satellite → descend → target, in world space. */
  _beamCurve(originLocal, targetLocal) {
    const o = this.moonGroup.localToWorld(originLocal.clone().multiplyScalar(LIGHT_R));
    const t = this.moonGroup.localToWorld(targetLocal.clone().multiplyScalar(LIGHT_R));
    const relay = this.relay.position.clone();
    return new THREE.CatmullRomCurve3([
      o,
      o.clone().normalize().multiplyScalar(1.28),
      o.clone().normalize().lerp(relay.clone().normalize(), 0.5).normalize().multiplyScalar(relay.length() * 0.96),
      relay,
      relay.clone().normalize().lerp(t.clone().normalize(), 0.55).normalize().multiplyScalar(relay.length() * 0.9),
      t.clone().normalize().multiplyScalar(1.24),
      t,
    ], false, 'catmullrom', 0.25);
  }

  /** A faint great-circle strand across the surface — part of the constellation. */
  _addStrand(aDir, bDir, opacity = 0.3) {
    const SEG = 64;
    const pts = [];
    const tmp = new THREE.Vector3();
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      slerpDirection(aDir, bDir, t, tmp);
      pts.push(tmp.clone().multiplyScalar(LIGHT_R + Math.sin(Math.PI * t) * 0.035));
    }
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({
        color: 0xffc98f, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    this.constellation.add(line);
    this._tween({
      dur: 1400,
      onUpdate: (raw) => { line.material.opacity = easeOut(raw) * opacity; },
    });
  }

  _addViewerBeacon() {
    if (this.viewerBeacon || !this.viewerAnchor) return;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glow, color: 0xffffff, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sprite.position.copy(this.viewerAnchor).multiplyScalar(LIGHT_R);
    sprite.scale.setScalar(0.16);
    this.viewerBeacon = sprite;
    this.moonGroup.add(sprite);
  }

  /* ================================================================
     interaction
     ================================================================ */

  _initDrag() {
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let downX = 0;
    let downY = 0;

    const down = (e) => {
      if (this.phase !== 'far') return;
      dragging = true;
      this.dragging = true;
      this._dragMoved = false;
      this.camVel.angle = 0;
      lastX = downX = e.clientX;
      lastY = downY = e.clientY;
      document.body.dataset.dragging = 'true';
    };

    const move = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 6) this._dragMoved = true;
      this.moonGroup.rotation.y -= dx * 0.0052;
      this._lastDrag = -dx * 0.0052;
      this.cam.elev = clamp(this.cam.elev + dy * 0.0026, -0.42, 0.62);
    };

    const up = () => {
      if (!dragging) return;
      dragging = false;
      this.dragging = false;
      this.camVel.angle = this._lastDrag || 0;   // fling, then settle
      this._lastDrag = 0;
      document.body.dataset.dragging = 'false';
      // let the marker's click handler run first, then clear the guard
      setTimeout(() => { this._dragMoved = false; }, 0);
    };

    this.canvas.addEventListener('pointerdown', down);
    this.markerLayer.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  /* ================================================================
     frame
     ================================================================ */

  _frame(dt) {
    // tweens
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t = Math.min(tw.t + dt * 1000, tw.dur);
      tw.onUpdate(tw.t / tw.dur);
      if (tw.t >= tw.dur) {
        this.tweens.splice(i, 1);
        if (tw.onDone) tw.onDone();
      }
    }

    // idle rotation + drag inertia
    if (!this.flight && !this.dragging) {
      this.moonGroup.rotation.y += this.cam.spin * dt;
      if (Math.abs(this.camVel.angle) > 0.00002) {
        this.moonGroup.rotation.y += this.camVel.angle * dt * 26;
        this.camVel.angle *= Math.pow(0.0009, dt);
      }
    }

    // camera on its orbit
    const { angle, radius, elev } = this.cam;
    const ce = Math.cos(elev);
    this.camera.position.set(
      radius * ce * Math.sin(angle),
      radius * Math.sin(elev),
      radius * ce * Math.cos(angle),
    );
    this.camera.lookAt(0, 0, 0);
    // the camera is not part of the scene graph, so update it ourselves —
    // marker projection needs matrixWorldInverse to be current
    this.camera.updateMatrixWorld();

    this.stars.rotation.y += dt * 0.004;
    this.earthGlobe.rotation.y += dt * 0.03;
    this._updateRelay(dt);

    // light pulses
    this.lights.forEach((light) => {
      if (light.pulse > 0) {
        light.pulse = Math.max(0, light.pulse - dt * 1.5);
        const k = 1 + Math.sin(light.pulse * Math.PI) * 0.9;
        light.sprite.scale.setScalar(light.baseScale * k);
      }
    });

    this.scene.updateMatrixWorld(true);
    this.renderer.render(this.scene, this.camera);
    this._projectMarkers();
  }

  _updateRelay(dt) {
    const o = this.relayOrbit;
    o.phase += dt * o.speed;
    const x = Math.cos(o.phase) * o.radius;
    const z = Math.sin(o.phase) * o.radius;
    this.relay.position.set(x, Math.sin(o.phase * 0.85) * o.radius * Math.sin(o.incl) * 0.6, z);
    this.relay.lookAt(0, 0, 0);
    this.relay.rotateZ(o.phase * 0.4);
    const blink = 0.45 + 0.55 * Math.abs(Math.sin(o.phase * 6));
    this.relayBeacon.material.opacity = blink * 0.8;
  }

  _projectMarkers() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const v = new THREE.Vector3();
    const camPos = this.camera.position;
    const showMarkers = this.phase === 'far';

    this.lights.forEach((light) => {
      if (!showMarkers) {
        if (light.visible || light.el.style.pointerEvents !== 'none') {
          light.el.style.opacity = '0';
          light.el.style.pointerEvents = 'none';
          light.el.tabIndex = -1;
          light.visible = false;
        }
        return;
      }
      v.copy(light.dir).multiplyScalar(LIGHT_R).applyMatrix4(this.moonGroup.matrixWorld);
      const normal = v.clone().normalize();
      const toCam = camPos.clone().sub(v).normalize();
      const facing = normal.dot(toCam);

      v.project(this.camera);
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;

      const fade = clamp((facing - 0.1) / 0.3, 0, 1);
      light.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      light.el.style.opacity = fade.toFixed(2);
      const interactive = fade > 0.18;
      if (interactive !== light.visible) {
        light.el.style.pointerEvents = interactive ? 'auto' : 'none';
        light.el.tabIndex = interactive ? 0 : -1;
        light.visible = interactive;
      }
    });
  }

  /* ================================================================
     helpers
     ================================================================ */

  _tween({ dur, onUpdate, onDone, }) {
    const tw = { t: 0, dur: Math.max(1, dur), onUpdate, onDone };
    this.tweens.push(tw);
    return tw;
  }

  _latOf(dir) {
    return THREE.MathUtils.radToDeg(Math.asin(clamp(dir.clone().normalize().y, -1, 1)));
  }

  _lonOf(dir) {
    return THREE.MathUtils.radToDeg(azimuthOf(dir));
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep the Moon comfortably in frame on tall, narrow phones
    this.camera.fov = w / h < 0.8 ? 62 : 46;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
  }
}

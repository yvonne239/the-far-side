import { MoonScene } from './moon/scene.js';
import { Soundscape } from './audio/soundscape.js';
import { Feed, createPostCard } from './ui/feed.js';
import { FarSide } from './ui/farside.js';
import { Contribute } from './ui/contribute.js';
import { Closing } from './ui/closing.js';
import { Constellation } from './ui/constellation.js';
import { STORIES, THEMES, FLIGHT_LINES, getStory } from './data/stories.js';
import * as store from './lib/storage.js';
import { mulberry32, prefersReducedMotion } from './lib/util.js';
import {
  earned, newlyEarned, recordGivingDay, sentToday, localDay,
} from './lib/progress.js';

/* ================================================================
   elements
   ================================================================ */

const $ = (id) => document.getElementById(id);

const screens = {
  loading: $('screen-loading'),
  intro: $('screen-intro'),
  bright: $('screen-bright'),
  flight: $('screen-flight'),
  far: $('screen-far'),
  unsupported: $('screen-unsupported'),
};

const overlays = {
  post: $('screen-post'),
  contribute: $('screen-contribute'),
  closing: $('screen-closing'),
  notice: $('notice-safety'),
};

const progressEl = $('progress');
const flightLine = $('flight-line');
const flightFill = $('flight-fill');

/**
 * What lands on screen when the flight ends. Two lines rather than one string
 * so the caption keeps its shape while it shrinks — no reflow mid-move.
 */
const ARRIVAL_LINES = ["You've left the noise behind.", 'Welcome to the dark side.'];

/** How long the caption holds at full size before it docks, in ms. */
const ARRIVAL_HOLD = 2800;
const ARRIVAL_HOLD_REDUCED = 900;

/** Must match the transform transition on .arrival__text in base.css. */
const ARRIVAL_GLIDE = 1150;

/* ================================================================
   state
   ================================================================ */

const state = {
  phase: 'loading',
  selectedPost: null,     // story chosen on the near side
  currentStory: null,     // story open on the far side
  flying: false,
  flightLines: FLIGHT_LINES,
  flightLineIndex: -1,
};

const sound = new Soundscape();
sound.muted = store.isMuted();

let scene;
let feed;
let farSide;
let contribute;
let closing;
let myLights = [];
let constellation;
let signalCounter = 0;

/* ================================================================
   phase + overlay plumbing
   ================================================================ */

function setPhase(phase) {
  state.phase = phase;
  document.body.dataset.phase = phase;
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle('is-active', key === phase);
  });
  if (scene) scene.setPhase(phase);
}

function setOverlay(key, open) {
  overlays[key].classList.toggle('is-active', open);
  if ((key === 'post' || key === 'sight') && scene) {
    scene.setPhase(open ? (key === 'post' ? 'post' : 'sight') : state.phase);
  }
}

function anyOverlayOpen() {
  return Object.values(overlays).some((el) => el.classList.contains('is-active'));
}

/* ================================================================
   the arrival caption
   ================================================================ */

/**
 * Fades in centred when the flight lands, holds, then shrinks and slides up
 * to sit as the title for the far side. It is pointer-events: none throughout,
 * so it can pass over the Moon and the buttons without ever blocking them.
 */
const arrival = {
  root: $('arrival'),
  lines: [...$('arrival').querySelectorAll('.arrival__line')],
  timer: null,

  play() {
    this.clear();
    this.lines.forEach((el, i) => { el.textContent = ARRIVAL_LINES[i] || ''; });

    // Pin the start state and flush it synchronously, so the fade has
    // somewhere to animate from. A forced reflow rather than rAF: rAF is
    // throttled in a background tab, and the caption must not be left
    // invisible just because the visitor looked away mid-flight.
    document.body.dataset.arrival = 'off';
    void this.root.offsetWidth;
    document.body.dataset.arrival = 'in';

    this.timer = setTimeout(
      () => { document.body.dataset.arrival = 'docked'; },
      prefersReducedMotion() ? ARRIVAL_HOLD_REDUCED : ARRIVAL_HOLD,
    );
  },

  /** A one-off line that fades in, waits, and goes. No docking. */
  flash(text, hold = 3200) {
    this.clear();
    this.lines[0].textContent = text;
    this.lines[1].textContent = '';
    document.body.dataset.arrival = 'off';
    void this.root.offsetWidth;
    document.body.dataset.arrival = 'flash';
    this.timer = setTimeout(() => {
      if (document.body.dataset.arrival === 'flash') this.clear();
    }, prefersReducedMotion() ? 1600 : hold);
  },

  clear() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    document.body.dataset.arrival = 'none';
  },
};

/** Shown when a light of the visitor's own lands on the far side. */
const LIGHT_LANDED = 'Your light has joined the dark side.';

/**
 * Milestone lines wait their turn rather than talking over each other, and
 * each one is spoken once. Nothing here ever nags: there is no reminder, and
 * a broken streak is only ever met with "The moon waited for you."
 */
const whisper = {
  queue: [],
  busy: false,
  say(line) {
    this.queue.push(line);
    this._next();
  },
  _next() {
    if (this.busy || !this.queue.length) return;
    this.busy = true;
    const line = this.queue.shift();
    arrival.flash(line, prefersReducedMotion() ? 1600 : 4200);
    setTimeout(() => {
      this.busy = false;
      this._next();
    }, prefersReducedMotion() ? 1900 : 4700);
  },
};

/* ================================================================
   the sky the visitor builds: stardust, crystals, nights in a row
   ================================================================ */

/** Puts every earned keepsake into the scene. Safe to call repeatedly. */
function placeKeepsakes(list) {
  list.forEach((m, i) => {
    if (m.kind === 'crystal') {
      scene.addCrystal(m.id, THEMES[m.theme]?.color || '#ffc98f', i);
    } else {
      scene.addStardust(m.id, i);
    }
  });
}

/**
 * Works out what is newly earned, remembers it, shows it, and puts it in the
 * sky. Called after a signal lands and once on arrival at the far side.
 *
 * @param {boolean} announce false while restoring a saved sky, so old
 *   milestones do not all shout at once on page load
 */
function syncKeepsakes({ announce = true } = {}) {
  const log = store.getSignalLog();
  const all = earned(log, store.getStreak());
  const fresh = newlyEarned(all, store.getUnlocked());

  placeKeepsakes(all);
  fresh.forEach((m) => {
    store.unlock(m.id);
    if (announce) whisper.say(m.line);
  });
  if (constellation && constellation.open) constellation.render();
  return fresh;
}

/** The data the private panel and the card are drawn from. */
function constellationData() {
  const log = store.getSignalLog();
  const unlocked = earned(log, store.getStreak())
    .filter((m) => store.getUnlocked().includes(m.id));

  // unit-sphere x/y is already an orthographic view of the far side
  const points = [];
  store.signalledIds().forEach((id) => {
    const light = scene.lights.get(id);
    if (!light) return;
    points.push({
      x: light.dir.x, y: light.dir.y, kind: 'light',
      color: THEMES[light.theme]?.color || '#ffc98f',
    });
  });
  scene.stardust.forEach(({ dir }) => {
    if (dir) points.push({ x: dir.x, y: dir.y, kind: 'dust', color: '#fff2d4' });
  });

  return { log, unlocked, streak: store.getStreak(), points, todayCount: sentToday(log) };
}

/**
 * The panel opens once the caption has finished moving, not during, so the
 * two never fight for attention on the way in.
 */
function arrivalPanelDelay() {
  return prefersReducedMotion()
    ? ARRIVAL_HOLD_REDUCED + 300
    : ARRIVAL_HOLD + ARRIVAL_GLIDE + 120;
}

function setProgress(step) {
  const order = ['bright', 'flight', 'far', 'signal', 'closing'];
  const at = order.indexOf(step);
  progressEl.querySelectorAll('li').forEach((li) => {
    const i = order.indexOf(li.dataset.step);
    li.classList.toggle('is-current', i === at);
    li.classList.toggle('is-done', i < at);
  });
}

/* ================================================================
   stories: samples + the visitor's own
   ================================================================ */

/** Seats for the visitor's own reflections, spread over the far side. */
function seatFor(index) {
  const rand = mulberry32(4242 + index * 977);
  return { lat: -52 + rand() * 104, lon: -168 + rand() * 336 };
}

/**
 * Puts everything the visitor has written back on both sides of the Moon: a
 * light on the far side and a post card on the near one. Runs at boot, so a
 * refresh loses nothing.
 */
function loadMyLights() {
  myLights = store.getReflections();
  myLights.forEach((r, i) => {
    if (scene.lights.has(r.id)) return;
    const seat = seatFor(i);
    scene.addLight({ id: r.id, theme: r.theme, lat: seat.lat, lon: seat.lon, label: 'Yours', mine: true });
  });
  if (feed) feed.setMine(myLights);
}

/** The shape the far-side panel wants, for either a sample story or your own. */
function panelData(id) {
  const sample = getStory(id);
  const signals = store.getSignals()[id] || [];
  if (sample) {
    return {
      id,
      theme: sample.theme,
      seen: sample.bright.caption,
      text: sample.far.text,
      note: sample.far.note,
      mine: false,
      signalCount: signals.length,
    };
  }
  const mine = myLights.find((r) => r.id === id);
  if (!mine) return null;
  return {
    id,
    theme: mine.theme,
    seen: mine.bright,
    text: mine.far,
    note: `Written by you · ${
      mine.intent === 'shared' ? 'offered for anonymous sharing' : 'kept private'
    } · stored only in this browser`,
    mine: true,
    signalCount: 0,
  };
}

/** Everything currently lit on the story track, in orbit order. */
function visibleStoryIds() {
  const all = [...STORIES.map((s) => s.id), ...myLights.map((r) => r.id)];
  if (!scene || scene.filter === 'all') return all;
  return all.filter((id) => {
    const d = panelData(id);
    return d && d.theme === scene.filter;
  });
}

/* ================================================================
   0 · arrive
   ================================================================ */

function begin() {
  sound.init();
  sound.setMuted(store.isMuted());
  startJourney();
}

/** Drop the visitor on the near side and let the feed start drifting. */
function startJourney() {
  setProgress('bright');
  farSide.setFilter('all');
  sound.startBright();
  setPhase('bright');
  feed.startToasts();
}

/* ================================================================
   the journey
   ================================================================ */

function selectPost(id) {
  const story = getStory(id);
  if (!story) return;
  state.selectedPost = id;

  const host = $('post-card');
  host.textContent = '';
  host.appendChild(createPostCard(story, { hero: true }));
  $('post-hint').textContent = story.prompt;

  setOverlay('post', true);
  sound.tick();
  setTimeout(() => $('btn-see-other-side').focus(), 320);
}

function closePost() {
  setOverlay('post', false);
  state.selectedPost = null;
}

/**
 * A post the visitor wrote: no "what might be outside this frame?" sheet —
 * they already know — so it flies straight round to their own light, which
 * opens showing what they said people might not see.
 */
function flyToOwnLight(id, opts = {}) {
  if (state.flying || !scene.lights.has(id)) return;
  state.flying = true;
  state.selectedPost = id;
  Object.keys(overlays).forEach((k) => setOverlay(k, false));
  feed.stopToasts();
  startFlight(id, {
    lines: FLIGHT_LINES,
    crossfade: () => sound.crossfadeToFar(prefersReducedMotion() ? 1.4 : 6),
    arrive: () => enterFarSide(id, opts),
  });
}

function seeOtherSide() {
  const id = state.selectedPost;
  if (!id || state.flying) return;

  state.flying = true;
  setOverlay('post', false);
  feed.stopToasts();
  startFlight(id, {
    lines: FLIGHT_LINES,
    crossfade: () => sound.crossfadeToFar(prefersReducedMotion() ? 1.4 : 6),
    arrive: () => enterFarSide(id),
  });
}

function enterFarSide(focusId, { landed = false } = {}) {
  setPhase('far');
  setProgress('far');
  sound.startTheme(prefersReducedMotion() ? 1.2 : 5);
  if (landed) arrival.flash(LIGHT_LANDED);
  else arrival.play();
  farSide.setCount(store.signalCount());
  restoreSky();
  const delay = landed ? 900 : arrivalPanelDelay();
  if (focusId) setTimeout(() => openStory(focusId, { skipFocus: true }), delay);
}

/**
 * Draws the saved sky the first time the far side is reached in a session:
 * the strands, then every keepsake already earned. Silent — these were
 * celebrated when they happened.
 */
let skyRestored = false;
function restoreSky() {
  if (skyRestored) return;
  skyRestored = true;
  const log = store.getSignalLog();
  const seen = new Set();
  const order = [];
  log.forEach((s) => {
    if (seen.has(s.id)) return;
    seen.add(s.id);
    order.push({ id: s.id, theme: s.theme });
  });
  scene.restoreConstellation(order);
  syncKeepsakes({ announce: false });
}

function openStory(id, { skipFocus = false } = {}) {
  const data = panelData(id);
  if (!data) return;
  state.currentStory = id;
  farSide.show(data);
  scene.setActiveLight(id);
  if (!skipFocus) scene.focusLight(id);
  sound.tick();
}

function stepStory(delta) {
  const ids = visibleStoryIds();
  if (!ids.length) return;
  const at = ids.indexOf(state.currentStory);
  const next = ids[(at + delta + ids.length) % ids.length];
  openStory(next);
}

function sendSignal(id, text) {
  farSide.setSignalsEnabled(false);
  farSide.setStatus(`Relaying “${text}” through the satellite…`);
  const theme = (panelData(id) || {}).theme || null;

  scene
    .sendSignal(id, { onArrive: () => sound.chime(signalCounter++) })
    .then(() => {
      store.addSignal(id, text, theme);
      scene.markSignalled(id);
      farSide.setCount(store.signalCount());
      farSide.setStatus('Delivered. No counter, no ranking — just one light knowing someone stopped.');
      const data = panelData(id);
      farSide.setSignalsEnabled(!(data && data.mine));
      setProgress('signal');

      // only sending a signal counts towards the moon; writing does not
      const next = recordGivingDay(store.getStreak(), localDay());
      if (next.counted) {
        store.setStreak({ days: next.days, lastDay: next.lastDay });
        if (next.returned) whisper.say('The moon waited for you.');
      }
      syncKeepsakes();
    });
}

function openContribute() {
  contribute.renderList(store.getReflections());
  setOverlay('contribute', true);
  contribute.focusFirst();
}

function saveReflection({ bright, far, theme, intent }) {
  const entry = store.addReflection({ bright, far, theme, intent });
  if (!entry) {
    contribute.fail('This browser would not save it — private mode, or storage is full.');
    return;
  }

  myLights = store.getReflections();
  scene.addLight({
    id: entry.id,
    theme: entry.theme,
    ...seatFor(myLights.length - 1),
    label: 'Yours',
    mine: true,
  });
  scene.setFilter(scene.filter);
  contribute.renderList(myLights);
  feed.addMine(entry, { fresh: true });        // shows up on the near side at once
  sound.chime(signalCounter++);

  setOverlay('contribute', false);
  const onFarSide = state.phase === 'far';

  if (onFarSide) {
    // already there: clear the filter so the new light cannot be hidden by it,
    // then bring it round to the middle and leave it there
    farSide.setFilter('all');
    scene.setActiveLight(entry.id);
    scene.focusLight(entry.id);
    arrival.flash(LIGHT_LANDED);
    setTimeout(() => openStory(entry.id, { skipFocus: true }), 700);
  } else {
    // on the near side: fly the same arc a post flies
    flyToOwnLight(entry.id, { landed: true });
  }
}

function deleteReflection(id) {
  store.removeReflection(id);
  myLights = store.getReflections();
  scene.removeLight(id);        // off the Moon
  feed.removeMine(id);          // and off the near side
  contribute.renderList(myLights);
  if (state.currentStory === id) farSide.close();
  if (state.selectedPost === id) closePost();
}

function toggleConstellation() {
  constellation.toggle();
}

function closeConstellation() {
  if (constellation && constellation.open) constellation.close();
}

function openClosing() {
  setOverlay('closing', true);
  setProgress('closing');
  scene.earthRise();
  const saved = store.getChosenAction();
  if (saved) closing.choose(saved);
}

/* ================================================================
   the flight
   ================================================================ */

function startFlight(id, { lines, crossfade, arrive }) {
  arrival.clear();
  state.flightLines = lines;
  state.flightLineIndex = -1;
  setPhase('flight');
  setProgress('flight');
  updateFlightHud(0);
  crossfade();

  scene
    .flyToFarSide(id, {
      duration: prefersReducedMotion() ? 2200 : 7400,
      onProgress: updateFlightHud,
    })
    .then(() => {
      state.flying = false;
      arrive();
    });
}

function updateFlightHud(p) {
  const lines = state.flightLines || FLIGHT_LINES;
  flightFill.style.width = `${(p * 100).toFixed(1)}%`;
  const i = Math.min(lines.length - 1, Math.floor(p * lines.length));
  if (i !== state.flightLineIndex) {
    state.flightLineIndex = i;
    flightLine.style.opacity = '0';
    setTimeout(() => {
      flightLine.textContent = lines[i];
      flightLine.style.opacity = '1';
    }, 220);
  }
}

/* ================================================================
   restart
   ================================================================ */

function restart() {
  Object.keys(overlays).forEach((k) => setOverlay(k, false));
  arrival.clear();
  farSide.close();
  scene.resetCamera();
  scene.setActiveLight(null);
  state.selectedPost = null;
  state.currentStory = null;
  state.flying = false;
  $('far-hint').textContent = 'Drag to turn the Moon. Every light is a story someone did not post.';
  closeConstellation();
  skyRestored = false;
  startJourney();
}

/* ================================================================
   boot
   ================================================================ */

function wireSoundToggle() {
  const muteBtn = $('btn-mute');
  const render = () => {
    const muted = store.isMuted();
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.title = muted ? 'Unmute sound' : 'Mute sound';
    muteBtn.querySelector('.icon-btn__glyph').textContent = muted ? '✕' : '♪';
  };
  muteBtn.addEventListener('click', () => {
    const muted = !store.isMuted();
    store.setMuted(muted);
    sound.setMuted(muted);
    if (!muted) sound.resume();
    render();
  });
  render();
}

function wireNotices() {
  document.querySelectorAll('[data-open-notice]').forEach((b) =>
    b.addEventListener('click', (e) => { e.preventDefault(); setOverlay('notice', true); }));
  document.querySelectorAll('[data-close-notice]').forEach((b) =>
    b.addEventListener('click', () => setOverlay('notice', false)));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlays.notice.classList.contains('is-active')) {
      setOverlay('notice', false);
    }
  });
}

function boot() {
  scene.onLightClick = (id) => openStory(id);
  scene.setStories(STORIES);

  feed = new Feed({
    root: $('feed'),
    toastRoot: $('toasts'),
    stories: STORIES,
    onSelect: selectPost,
    onSelectMine: (id) => flyToOwnLight(id),
  });

  farSide = new FarSide({
    onFilter: (theme) => {
      scene.setFilter(theme);
      const ids = visibleStoryIds();
      const label = (THEMES[theme]?.label || '').toLowerCase();
      $('far-hint').textContent = ids.length
        ? `${ids.length} ${theme === 'all' ? 'stories' : `${label} stories`} lit. Drag to turn the Moon.`
        : 'No lights in this experience yet — try another, or add your own.';
      if (state.currentStory && !ids.includes(state.currentStory)) farSide.close();
    },
    onSignal: sendSignal,
    onStep: stepStory,
    onClose: () => {
      state.currentStory = null;
      scene.setActiveLight(null);
    },
  });

  constellation = new Constellation({
    read: constellationData,
    onToggle: (on) => {
      scene.setPrivateView(on);
      $('btn-constellation').setAttribute('aria-pressed', String(on));
      if (on) farSide.close();
    },
  });

  contribute = new Contribute({ onSave: saveReflection, onDelete: deleteReflection });
  closing = new Closing({
    onChoose: (id) => { store.setChosenAction(id); sound.tick(); },
  });

  $('btn-begin').addEventListener('click', begin);
  $('btn-see-other-side').addEventListener('click', seeOtherSide);
  // from a sample post straight into writing your own, without the detour
  // through the far side
  $('btn-write-own').addEventListener('click', () => { closePost(); openContribute(); });
  $('btn-skip').addEventListener('click', () => scene.skipFlight());
  $('btn-contribute').addEventListener('click', openContribute);
  $('btn-constellation').addEventListener('click', toggleConstellation);
  $('btn-contribute-near').addEventListener('click', openContribute);
  $('btn-return').addEventListener('click', openClosing);
  $('btn-back-to-far').addEventListener('click', () => setOverlay('closing', false));
  $('btn-restart-2').addEventListener('click', restart);
  $('btn-restart').addEventListener('click', restart);

  document.querySelectorAll('[data-close-post]').forEach((b) =>
    b.addEventListener('click', closePost));
  document.querySelectorAll('[data-close-contribute]').forEach((b) =>
    b.addEventListener('click', () => setOverlay('contribute', false)));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (overlays.notice.classList.contains('is-active')) return;     // handled in wireNotices
      if (overlays.contribute.classList.contains('is-active')) setOverlay('contribute', false);
      else if (overlays.closing.classList.contains('is-active')) setOverlay('closing', false);
      else if (overlays.post.classList.contains('is-active')) closePost();
      else if (constellation.open) closeConstellation();
      else if (farSide.isOpen) farSide.close();
      return;
    }
    if (state.phase === 'flight' && (e.key === 'Enter' || e.key === ' ') && !anyOverlayOpen()) {
      e.preventDefault();
      scene.skipFlight();
    }
  });

  loadMyLights();
  scene.start();

  requestAnimationFrame(() => {
    setTimeout(() => {
      setPhase('intro');
      setTimeout(() => $('btn-begin').focus(), 400);
    }, 700);
  });

  // some browsers keep audio suspended until a gesture lands anywhere
  window.addEventListener('pointerdown', () => sound.resume(), { once: true });

  // a small handle for judges and debugging
  window.Moonflip = { scene, sound, store, restart, state, constellation };
}

wireSoundToggle();
wireNotices();

try {
  scene = new MoonScene($('scene'), $('markers'));
  boot();
} catch (err) {
  // no WebGL (or a GPU the browser will not use): say so instead of dying silently
  console.error('Moonflip could not start the 3D scene:', err);
  $('scene').hidden = true;
  setPhase('unsupported');
}

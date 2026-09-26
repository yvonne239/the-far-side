import { MoonScene } from './moon/scene.js';
import { Soundscape } from './audio/soundscape.js';
import { Feed, createPostCard } from './ui/feed.js';
import { Sights, createSightCard } from './ui/sights.js';
import { FarSide } from './ui/farside.js';
import { Discover } from './ui/discover.js';
import { Contribute } from './ui/contribute.js';
import { Closing } from './ui/closing.js';
import { STORIES, THEMES, FLIGHT_LINES, getStory } from './data/stories.js';
import {
  DISCOVERIES, CATEGORIES, DISCOVERY_FLIGHT_LINES, getDiscovery,
} from './data/discoveries.js';
import * as store from './lib/storage.js';
import { mulberry32, prefersReducedMotion } from './lib/util.js';

/* ================================================================
   elements
   ================================================================ */

const $ = (id) => document.getElementById(id);

const screens = {
  loading: $('screen-loading'),
  intro: $('screen-intro'),
  paths: $('screen-paths'),
  bright: $('screen-bright'),
  sights: $('screen-sights'),
  flight: $('screen-flight'),
  far: $('screen-far'),
  discover: $('screen-discover'),
  unsupported: $('screen-unsupported'),
};

const overlays = {
  post: $('screen-post'),
  sight: $('screen-sight'),
  contribute: $('screen-contribute'),
  closing: $('screen-closing'),
  notice: $('notice-safety'),
};

const progressEl = $('progress');
const flightLine = $('flight-line');
const flightFill = $('flight-fill');

/** The same five beats, named for whichever path the visitor took. */
const RAILS = {
  story:     ['Arrive', 'Fly', 'Discover', 'Respond', 'Return'],
  discovery: ['Look', 'Flip', 'Reveal', 'Connect', 'Return'],
};

/* ================================================================
   state
   ================================================================ */

const state = {
  phase: 'loading',
  path: null,             // 'story' | 'discovery'
  selectedPost: null,     // story chosen on the near side
  currentStory: null,     // story open on the far side
  selectedSight: null,    // discovery chosen on the near side
  currentDiscovery: null, // discovery open on the far side
  flying: false,
  flightLines: FLIGHT_LINES,
  flightLineIndex: -1,
};

const sound = new Soundscape();
sound.muted = store.isMuted();

let scene;
let feed;
let sights;
let farSide;
let discover;
let contribute;
let closing;
let myLights = [];
let discovered = [];
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

function setRail(path) {
  const labels = RAILS[path] || RAILS.story;
  progressEl.querySelectorAll('li').forEach((li, i) => {
    li.querySelector('span').textContent = labels[i];
  });
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

function loadMyLights() {
  myLights = store.getReflections();
  myLights.forEach((r, i) => {
    if (scene.lights.has(r.id)) return;
    const seat = seatFor(i);
    scene.addLight({ id: r.id, theme: r.theme, lat: seat.lat, lon: seat.lon, label: 'Yours', mine: true });
  });
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

/** Everything currently lit on the discovery track, in orbit order. */
function visibleDiscoveryIds() {
  if (!scene || scene.filter === 'all') return DISCOVERIES.map((d) => d.id);
  return DISCOVERIES.filter((d) => d.category === scene.filter).map((d) => d.id);
}

/* ================================================================
   0 · arrive, then choose a path
   ================================================================ */

function begin() {
  sound.init();
  sound.setMuted(store.isMuted());
  goToPaths({ fresh: true });
}

/**
 * The hub. Reachable from anywhere, from the intro onward, and deliberately
 * non-destructive: signals, reflections and flipped discoveries all survive.
 */
function goToPaths({ fresh = false } = {}) {
  Object.keys(overlays).forEach((k) => setOverlay(k, false));
  if (farSide) farSide.close();
  if (discover) discover.close();
  if (feed) feed.stopToasts();
  if (scene) scene.resetCamera();

  state.selectedPost = null;
  state.currentStory = null;
  state.selectedSight = null;
  state.currentDiscovery = null;
  state.flying = false;

  if (!fresh && state.path) setProgress('closing');
  setPhase('paths');
  sound.fadeOutAll(fresh ? 0.4 : 1.2);
  setTimeout(() => {
    const card = document.querySelector(`.path-card[data-path="${state.path || 'story'}"]`);
    if (card && state.phase === 'paths') card.focus();
  }, 420);
}

/** Jump straight from one path's far side to the other path's near side. */
function switchPath(path) {
  Object.keys(overlays).forEach((k) => setOverlay(k, false));
  farSide.close();
  discover.close();
  scene.resetCamera();
  scene.setActiveLight(null);
  state.selectedPost = null;
  state.currentStory = null;
  state.selectedSight = null;
  state.currentDiscovery = null;
  state.flying = false;
  choosePath(path);
}

function choosePath(path) {
  state.path = path;
  document.body.dataset.path = path;
  setRail(path);
  setProgress('bright');
  scene.setTrack(path);

  if (path === 'story') {
    farSide.setFilter('all');
    sound.startBright();
    setPhase('bright');
    feed.startToasts();
  } else {
    discover.setFilter('all');
    sights.markSeen(discovered);
    sound.startHum();
    setPhase('sights');
  }
}

/* ================================================================
   PATH ONE · Behind the Moment
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

function seeOtherSide() {
  const id = state.selectedPost;
  if (!id || state.flying) return;

  state.flying = true;
  setOverlay('post', false);
  feed.stopToasts();
  startFlight(id, {
    lines: FLIGHT_LINES,
    mood: 'warm',
    crossfade: () => sound.crossfadeToFar(prefersReducedMotion() ? 1.4 : 6),
    arrive: () => enterFarSide(id),
  });
}

function enterFarSide(focusId) {
  setPhase('far');
  setProgress('far');
  sound.startTheme(prefersReducedMotion() ? 1.2 : 5);
  farSide.setCount(store.signalCount());
  if (focusId) setTimeout(() => openStory(focusId, { skipFocus: true }), 500);
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

  scene
    .sendSignal(id, { onArrive: () => sound.chime(signalCounter++) })
    .then(() => {
      store.addSignal(id, text);
      scene.markSignalled(id);
      farSide.setCount(store.signalCount());
      farSide.setStatus('Delivered. No counter, no ranking — just one light knowing someone stopped.');
      const data = panelData(id);
      farSide.setSignalsEnabled(!(data && data.mine));
      setProgress('signal');
    });
}

function openContribute() {
  contribute.renderList(store.getReflections());
  setOverlay('contribute', true);
  contribute.focusFirst();
}

function saveReflection({ bright, far, theme, intent }) {
  const entry = store.addReflection({ bright, far, theme, intent });
  myLights = store.getReflections();
  const seat = seatFor(myLights.length - 1);
  scene.addLight({
    id: entry.id,
    theme: entry.theme,
    lat: seat.lat,
    lon: seat.lon,
    label: 'Yours',
    mine: true,
  });
  scene.setFilter(scene.filter);
  contribute.renderList(myLights);
  contribute.flash(
    intent === 'shared'
      ? 'Saved, and your light is on the far side. (No server in this demo — it stays in this browser.)'
      : 'Kept private. Your light is on the far side, visible only to you.',
  );
  sound.chime(signalCounter++);
}

function deleteReflection(id) {
  store.removeReflection(id);
  myLights = store.getReflections();
  scene.removeLight(id);
  contribute.renderList(myLights);
  if (state.currentStory === id) farSide.close();
}

function openClosing() {
  setOverlay('closing', true);
  setProgress('closing');
  scene.earthRise();
  const saved = store.getChosenAction();
  if (saved) closing.choose(saved);
}

/* ================================================================
   PATH TWO · Hidden in Plain Sight
   ================================================================ */

function selectSight(id) {
  const d = getDiscovery(id);
  if (!d) return;
  state.selectedSight = id;

  const host = $('sight-card');
  host.textContent = '';
  host.appendChild(createSightCard(d, { hero: true }));
  $('sight-hint').textContent = CATEGORIES[d.category].blurb;

  setOverlay('sight', true);
  sound.tick();
  setTimeout(() => $('btn-flip-moon').focus(), 320);
}

function closeSight() {
  setOverlay('sight', false);
  state.selectedSight = null;
}

function flipToDiscovery() {
  const id = state.selectedSight;
  if (!id || state.flying) return;

  state.flying = true;
  setOverlay('sight', false);
  startFlight(id, {
    lines: DISCOVERY_FLIGHT_LINES,
    mood: 'cool',
    crossfade: () => sound.crossfadeToOpen(prefersReducedMotion() ? 1.4 : 6),
    arrive: () => enterDiscover(id),
  });
}

function enterDiscover(focusId) {
  setPhase('discover');
  setProgress('far');
  sound.startTheme(prefersReducedMotion() ? 1.2 : 5);
  discover.setCount(discovered.length, DISCOVERIES.length);
  if (focusId) setTimeout(() => openDiscovery(focusId, { skipFocus: true }), 500);
}

function openDiscovery(id, { skipFocus = false } = {}) {
  const d = getDiscovery(id);
  if (!d) return;
  state.currentDiscovery = id;
  discover.show(d);
  scene.setActiveLight(id);
  if (!skipFocus) scene.focusLight(id);
  sound.tick();
}

function stepDiscovery(delta) {
  const ids = visibleDiscoveryIds();
  if (!ids.length) return;
  const at = ids.indexOf(state.currentDiscovery);
  const next = ids[(at + delta + ids.length) % ids.length];
  openDiscovery(next);
}

function markRevealed(id) {
  discovered = store.markDiscovered(id);
  scene.markSignalled(id);
  discover.setCount(discovered.length, DISCOVERIES.length);
  sights.markSeen(discovered);
}

function backToSights() {
  discover.close();
  state.currentDiscovery = null;
  scene.resetCamera();
  scene.setActiveLight(null);
  sights.markSeen(discovered);
  sound.startHum();
  setPhase('sights');
  setProgress('bright');
}

/* ================================================================
   the flight, shared by both paths
   ================================================================ */

function startFlight(id, { lines, mood, crossfade, arrive }) {
  state.flightLines = lines;
  state.flightLineIndex = -1;
  setPhase('flight');
  setProgress('flight');
  updateFlightHud(0);
  crossfade();

  scene
    .flyToFarSide(id, {
      duration: prefersReducedMotion() ? 2200 : 7400,
      mood,
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
  farSide.close();
  farSide.setFilter('all');
  discover.close();
  discover.setFilter('all');
  scene.resetCamera();
  state.selectedPost = null;
  state.currentStory = null;
  state.selectedSight = null;
  state.currentDiscovery = null;
  state.flying = false;
  $('far-hint').textContent = 'Drag to turn the Moon. Every light is a story someone did not post.';
  $('discover-hint').textContent = 'Drag to turn the Moon. Every light is something you already walk past.';

  if (state.path) choosePath(state.path);
  else goToPaths({ fresh: true });
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
  scene.onLightClick = (id) =>
    (state.path === 'discovery' ? openDiscovery(id) : openStory(id));
  scene.setStories(STORIES);
  scene.setDiscoveries(DISCOVERIES, CATEGORIES);

  discovered = store.getDiscovered();

  feed = new Feed({
    root: $('feed'),
    toastRoot: $('toasts'),
    stories: STORIES,
    onSelect: selectPost,
  });

  sights = new Sights({
    root: $('sights'),
    discoveries: DISCOVERIES,
    onSelect: selectSight,
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

  discover = new Discover({
    scene,
    sound,
    onFilter: (key) => {
      scene.setFilter(key);
      const ids = visibleDiscoveryIds();
      const label = (CATEGORIES[key]?.short || '').toLowerCase();
      $('discover-hint').textContent = ids.length
        ? `${ids.length} ${key === 'all' ? 'discoveries' : `“${label}” discoveries`} lit. Drag to turn the Moon.`
        : 'Nothing lit under that question yet.';
      if (state.currentDiscovery && !ids.includes(state.currentDiscovery)) discover.close();
    },
    onStep: stepDiscovery,
    onRevealed: markRevealed,
    onConnect: () => setProgress('signal'),
    onClose: () => {
      state.currentDiscovery = null;
      scene.setActiveLight(null);
    },
  });

  contribute = new Contribute({ onSave: saveReflection, onDelete: deleteReflection });
  closing = new Closing({
    onChoose: (id) => { store.setChosenAction(id); sound.tick(); },
  });

  $('btn-begin').addEventListener('click', begin);
  document.querySelectorAll('.path-card').forEach((card) =>
    card.addEventListener('click', () => choosePath(card.dataset.path)));

  $('btn-see-other-side').addEventListener('click', seeOtherSide);
  // from a sample post straight into writing your own, without the detour
  // through the far side
  $('btn-write-own').addEventListener('click', () => { closePost(); openContribute(); });
  $('btn-flip-moon').addEventListener('click', flipToDiscovery);
  $('btn-skip').addEventListener('click', () => scene.skipFlight());
  $('btn-contribute').addEventListener('click', openContribute);
  $('btn-return').addEventListener('click', openClosing);
  $('btn-back-to-far').addEventListener('click', () => setOverlay('closing', false));
  $('btn-back-to-sights').addEventListener('click', backToSights);
  $('btn-other-path').addEventListener('click', () => switchPath('story'));
  $('btn-try-other').addEventListener('click', () => switchPath('discovery'));
  $('btn-paths').addEventListener('click', () => goToPaths());
  $('btn-restart').addEventListener('click', restart);

  document.querySelectorAll('[data-close-post]').forEach((b) =>
    b.addEventListener('click', closePost));
  document.querySelectorAll('[data-close-sight]').forEach((b) =>
    b.addEventListener('click', closeSight));
  document.querySelectorAll('[data-close-contribute]').forEach((b) =>
    b.addEventListener('click', () => setOverlay('contribute', false)));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (overlays.notice.classList.contains('is-active')) return;     // handled in wireNotices
      if (overlays.contribute.classList.contains('is-active')) setOverlay('contribute', false);
      else if (overlays.closing.classList.contains('is-active')) setOverlay('closing', false);
      else if (overlays.post.classList.contains('is-active')) closePost();
      else if (overlays.sight.classList.contains('is-active')) closeSight();
      else if (farSide.isOpen) farSide.close();
      else if (discover.isOpen) discover.close();
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
  window.Moonflip = { scene, sound, store, restart, goToPaths, choosePath, state };
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

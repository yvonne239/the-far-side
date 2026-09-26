import { MoonScene } from './moon/scene.js';
import { Soundscape } from './audio/soundscape.js';
import { Feed, createPostCard } from './ui/feed.js';
import { FarSide } from './ui/farside.js';
import { Contribute } from './ui/contribute.js';
import { Closing } from './ui/closing.js';
import { STORIES, THEMES, FLIGHT_LINES, getStory } from './data/stories.js';
import * as store from './lib/storage.js';
import { mulberry32, prefersReducedMotion } from './lib/util.js';

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

/* ================================================================
   state
   ================================================================ */

const state = {
  phase: 'loading',
  selectedPost: null,     // story chosen on the bright side
  currentStory: null,     // story open on the far side
  flying: false,
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
  if (key === 'post' && scene) scene.setPhase(open ? 'post' : state.phase);
}

function anyOverlayOpen() {
  return Object.values(overlays).some((el) => el.classList.contains('is-active'));
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

/** Everything currently lit on the far side, in orbit order. */
function visibleIds() {
  const all = [...STORIES.map((s) => s.id), ...myLights.map((r) => r.id)];
  if (!scene || scene.filter === 'all') return all;
  return all.filter((id) => {
    const d = panelData(id);
    return d && d.theme === scene.filter;
  });
}

/* ================================================================
   1 · arrive
   ================================================================ */

function begin() {
  sound.init();
  sound.setMuted(store.isMuted());
  sound.startBright();
  setPhase('bright');
  setProgress('bright');
  feed.startToasts();
}

/* ================================================================
   2 · choose a post, ask what is outside the frame
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

/* ================================================================
   3 · fly around the Moon
   ================================================================ */

function seeOtherSide() {
  const id = state.selectedPost;
  if (!id || state.flying) return;

  state.flying = true;
  state.flightLineIndex = -1;
  setOverlay('post', false);
  feed.stopToasts();
  setPhase('flight');
  setProgress('flight');
  updateFlightHud(0);

  sound.crossfadeToFar(prefersReducedMotion() ? 1.4 : 6);

  scene
    .flyToFarSide(id, {
      duration: prefersReducedMotion() ? 2200 : 7400,
      onProgress: updateFlightHud,
    })
    .then(() => {
      state.flying = false;
      enterFarSide(id);
    });
}

function updateFlightHud(p) {
  flightFill.style.width = `${(p * 100).toFixed(1)}%`;
  const i = Math.min(FLIGHT_LINES.length - 1, Math.floor(p * FLIGHT_LINES.length));
  if (i !== state.flightLineIndex) {
    state.flightLineIndex = i;
    flightLine.style.opacity = '0';
    setTimeout(() => {
      flightLine.textContent = FLIGHT_LINES[i];
      flightLine.style.opacity = '1';
    }, 220);
  }
}

/* ================================================================
   4 · discover, then respond through the relay
   ================================================================ */

function enterFarSide(focusId) {
  setPhase('far');
  setProgress('far');
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
  const ids = visibleIds();
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

/* ================================================================
   5 · contribute, then take something back
   ================================================================ */

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

function restart() {
  ['post', 'contribute', 'closing', 'notice'].forEach((k) => setOverlay(k, false));
  farSide.close();
  farSide.setFilter('all');
  scene.resetCamera();
  state.selectedPost = null;
  state.currentStory = null;
  state.flying = false;
  setPhase('bright');
  setProgress('bright');
  $('far-hint').textContent = 'Drag to turn the Moon. Every light is a story someone did not post.';
  sound.startBright();
  feed.startToasts();
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
  });

  farSide = new FarSide({
    onFilter: (theme) => {
      scene.setFilter(theme);
      const ids = visibleIds();
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

  contribute = new Contribute({ onSave: saveReflection, onDelete: deleteReflection });
  closing = new Closing({
    onChoose: (id) => { store.setChosenAction(id); sound.tick(); },
  });

  $('btn-begin').addEventListener('click', begin);
  $('btn-see-other-side').addEventListener('click', seeOtherSide);
  $('btn-skip').addEventListener('click', () => scene.skipFlight());
  $('btn-contribute').addEventListener('click', openContribute);
  $('btn-return').addEventListener('click', openClosing);
  $('btn-back-to-far').addEventListener('click', () => setOverlay('closing', false));
  $('btn-restart').addEventListener('click', restart);
  $('btn-restart-2').addEventListener('click', restart);

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
  window.FarSide = { scene, sound, store, restart, state };
}

wireSoundToggle();
wireNotices();

try {
  scene = new MoonScene($('scene'), $('markers'));
  boot();
} catch (err) {
  // no WebGL (or a GPU the browser will not use): say so instead of dying silently
  console.error('The Far Side could not start the 3D scene:', err);
  $('scene').hidden = true;
  setPhase('unsupported');
}

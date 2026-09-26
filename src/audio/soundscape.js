/**
 * Every sound in this piece is synthesised in the browser — no audio files.
 *
 * Two worlds:
 *   bright — overlapping chatter, hiss and notification pings (comparison)
 *   far    — one slow warm chord that breathes (nothing demanding anything)
 *
 * The flight between them is a crossfade plus a whoosh, which is the whole
 * emotional argument of the project in about four seconds.
 */

export class Soundscape {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this.world = 'none';
    this.nodes = {};
    this._blipTimer = null;
    this._padVoices = [];
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  init() {
    if (this.ready) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;

    try {
      const ctx = new AC();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.9;
      master.connect(ctx.destination);

      const bright = ctx.createGain();
      bright.gain.value = 0;
      bright.connect(master);

      const far = ctx.createGain();
      far.gain.value = 0;
      far.connect(master);

      // shared shimmer / space for the far side
      const delay = ctx.createDelay(1.2);
      delay.delayTime.value = 0.42;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.34;
      const delayTone = ctx.createBiquadFilter();
      delayTone.type = 'lowpass';
      delayTone.frequency.value = 1600;
      delay.connect(feedback);
      feedback.connect(delayTone);
      delayTone.connect(delay);
      delay.connect(far);

      this.nodes = { master, bright, far, delay };
      this.noiseBuffer = this._makeNoise(ctx, 3);
      this.ready = true;
      return true;
    } catch {
      this.ready = false;
      return false;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (!this.ready) return;
    const { master } = this.nodes;
    const now = this.ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(this.muted ? 0 : 0.9, now, 0.12);
  }

  /* ================= worlds ================= */

  startBright(fade = 1.6) {
    if (!this.init()) return;
    this.resume();
    if (this.world === 'bright') return;
    this.world = 'bright';

    const ctx = this.ctx;
    const { bright, far } = this.nodes;
    const now = ctx.currentTime;

    this._buildBright();
    bright.gain.cancelScheduledValues(now);
    bright.gain.setValueAtTime(bright.gain.value, now);
    bright.gain.linearRampToValueAtTime(0.5, now + fade);
    far.gain.setTargetAtTime(0, now, 0.4);

    this._startBlips();
  }

  /** Crossfade the busy world out and the quiet one in over `seconds`. */
  crossfadeToFar(seconds = 5) {
    if (!this.init()) return;
    this.resume();
    if (this.world === 'far') return;
    this.world = 'far';

    const ctx = this.ctx;
    const { bright, far } = this.nodes;
    const now = ctx.currentTime;

    this._stopBlips();
    bright.gain.cancelScheduledValues(now);
    bright.gain.setValueAtTime(bright.gain.value, now);
    bright.gain.linearRampToValueAtTime(0.0001, now + seconds * 0.6);

    this._buildPad();
    far.gain.cancelScheduledValues(now);
    far.gain.setValueAtTime(Math.max(far.gain.value, 0.0001), now);
    far.gain.linearRampToValueAtTime(0.42, now + seconds);

    this.whoosh(seconds * 0.55);
  }

  fadeOutAll(seconds = 2) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this._stopBlips();
    [this.nodes.bright, this.nodes.far].forEach((g) => {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0.0001, now + seconds);
    });
    this.world = 'none';
  }

  /* ================= one-shots ================= */

  /** Rising, softening sweep — the camera moving around the limb. */
  whoosh(duration = 3) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 1.1;
    band.frequency.setValueAtTime(180, now);
    band.frequency.exponentialRampToValueAtTime(2400, now + duration * 0.45);
    band.frequency.exponentialRampToValueAtTime(140, now + duration);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.2, now + duration * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, now + duration);

    src.connect(band); band.connect(g); g.connect(this.nodes.master);
    src.start(now);
    src.stop(now + duration + 0.1);
  }

  /** Soft bell for an arriving signal. */
  chime(step = 0) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.01;
    const scale = [523.25, 587.33, 698.46, 783.99, 880.0, 1046.5];
    const base = scale[Math.abs(step) % scale.length];

    [1, 2.01, 3.02].forEach((mult, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = base * mult;

      const g = ctx.createGain();
      const peak = 0.26 / (i + 1.6);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(peak, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.6 - i * 0.5);

      osc.connect(g);
      g.connect(this.nodes.master);
      if (this.nodes.delay) g.connect(this.nodes.delay);
      osc.start(now);
      osc.stop(now + 3);
    });
  }

  /** Dry, dull click — a UI confirmation that does not feel like a "like". */
  tick() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(g); g.connect(this.nodes.master);
    osc.start(now); osc.stop(now + 0.2);
  }

  /* ================= builders ================= */

  _makeNoise(ctx, seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;       // cheap pink-ish tilt
      data[i] = last * 3.2;
    }
    return buffer;
  }

  _buildBright() {
    if (this._brightBuilt) return;
    const ctx = this.ctx;
    const out = this.nodes.bright;
    const now = ctx.currentTime;

    // room hiss
    const hiss = ctx.createBufferSource();
    hiss.buffer = this.noiseBuffer;
    hiss.loop = true;
    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'highpass';
    hissFilter.frequency.value = 900;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0.05;
    hiss.connect(hissFilter); hissFilter.connect(hissGain); hissGain.connect(out);
    hiss.start(now);

    // unintelligible overlapping chatter: detuned saws behind a wobbling lowpass
    const chatterGain = ctx.createGain();
    chatterGain.gain.value = 0.045;
    const chatterFilter = ctx.createBiquadFilter();
    chatterFilter.type = 'lowpass';
    chatterFilter.frequency.value = 620;
    chatterFilter.Q.value = 6;
    chatterFilter.connect(chatterGain);
    chatterGain.connect(out);

    [92, 117, 143].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.21 + i * 0.13;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 190;
      lfo.connect(lfoGain);
      lfoGain.connect(chatterFilter.frequency);
      osc.connect(chatterFilter);
      osc.start(now); lfo.start(now);
    });

    this._brightBuilt = true;
  }

  _startBlips() {
    this._stopBlips();
    const schedule = () => {
      if (this.world !== 'bright') return;
      this._blip();
      if (Math.random() < 0.35) setTimeout(() => this._blip(), 140 + Math.random() * 180);
      this._blipTimer = setTimeout(schedule, 900 + Math.random() * 2200);
    };
    this._blipTimer = setTimeout(schedule, 700);
  }

  _stopBlips() {
    if (this._blipTimer) clearTimeout(this._blipTimer);
    this._blipTimer = null;
  }

  _blip() {
    if (!this.ready || this.world !== 'bright') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const tones = [880, 1174.66, 1318.51, 1567.98];
    const f = tones[(Math.random() * tones.length) | 0];

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.linearRampToValueAtTime(f * 1.5, now + 0.08);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);

    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = Math.random() * 1.6 - 0.8;

    osc.connect(g);
    if (pan) { g.connect(pan); pan.connect(this.nodes.bright); }
    else g.connect(this.nodes.bright);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  _buildPad() {
    if (this._padVoices.length) return;
    const ctx = this.ctx;
    const out = this.nodes.far;
    const now = ctx.currentTime;

    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 1100;
    tone.Q.value = 0.6;
    tone.connect(out);
    tone.connect(this.nodes.delay);

    // a wide, unresolved chord: F2 · C3 · A3 · E4 · G4
    const chord = [87.31, 130.81, 220.0, 329.63, 392.0];
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i < 2 ? 'sine' : 'triangle';
      osc.frequency.value = freq;

      const drift = ctx.createOscillator();
      drift.type = 'sine';
      drift.frequency.value = 0.045 + i * 0.017;
      const driftAmt = ctx.createGain();
      driftAmt.gain.value = freq * 0.0035;
      drift.connect(driftAmt);
      driftAmt.connect(osc.frequency);

      const g = ctx.createGain();
      g.gain.value = 0.1 / (1 + i * 0.45);

      // each voice breathes at its own rate, so the chord never sits still
      const breath = ctx.createOscillator();
      breath.type = 'sine';
      breath.frequency.value = 0.055 + i * 0.023;
      const breathAmt = ctx.createGain();
      breathAmt.gain.value = g.gain.value * 0.55;
      breath.connect(breathAmt);
      breathAmt.connect(g.gain);

      osc.connect(g);
      g.connect(tone);
      osc.start(now); drift.start(now); breath.start(now);
      this._padVoices.push(osc, drift, breath);
    });
  }
}

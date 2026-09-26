/**
 * The music that comes in once the Moon has flipped.
 *
 * ── About the song ────────────────────────────────────────────────────────
 * The obvious choice here is "Fly Me to the Moon". It is also not ours to
 * ship: Bart Howard wrote it in 1954 and the composition is under copyright
 * until the late 2040s, and every recording of it (Sinatra's especially)
 * carries a second, separate copyright in the master. So this repository
 * contains no part of that song.
 *
 * Two ways to have music, then:
 *
 *  1. Supply your own licensed file. Drop it in `assets/` and point
 *     MOON_THEME_URL at it. Anything the browser can decode works. It will be
 *     used instead of everything below, looped, ducked under the ambience,
 *     and muted along with the rest of the sound.
 *
 *  2. Use the built-in instrumental, which is what plays by default. It is an
 *     original tune written for this project, played on synthesised
 *     instruments. It sits on the circle-of-fifths turnaround that the jazz
 *     standards share — Am7 · Dm7 · G7 · Cmaj7 · Fmaj7 · Bm7♭5 · E7 · Am6 —
 *     in a slow 3/4, because chord progressions are common property and that
 *     particular one is most of why those tunes feel the way they do. The
 *     melody over it is deliberately not anybody else's melody.
 */

/**
 * Path to a licensed recording, or null for the built-in instrumental.
 * e.g. './assets/moon-theme.mp3'
 */
export const MOON_THEME_URL = null;

const TEMPO = 96;                  // beats per minute, 3/4
const BEAT = 60 / TEMPO;
const BEATS_PER_BAR = 3;
const LOOKAHEAD = 0.9;             // seconds of audio scheduled in advance

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

/** Eight bars: the turnaround, once around. */
const BARS = [
  { name: 'Am7',    bass: 45, chord: [60, 64, 67, 69] },   // C  E  G  A
  { name: 'Dm7',    bass: 50, chord: [60, 65, 69, 72] },   // C  F  A  D
  { name: 'G7',     bass: 43, chord: [59, 65, 67, 74] },   // B  F  G  D
  { name: 'Cmaj7',  bass: 48, chord: [59, 64, 67, 72] },   // B  E  G  C
  { name: 'Fmaj7',  bass: 41, chord: [60, 64, 65, 69] },   // C  E  F  A
  { name: 'Bm7b5',  bass: 47, chord: [57, 62, 65, 69] },   // A  D  F  A
  { name: 'E7',     bass: 40, chord: [56, 62, 68, 71] },   // G# D  G# B
  { name: 'Am6',    bass: 45, chord: [57, 60, 64, 66] },   // A  C  E  F#
];

/** An original line over those changes. [beat within the loop, note, beats] */
const MELODY = [
  [0, 76, 2], [2, 72, 1],
  [3, 74, 2], [5, 69, 1],
  [6, 71, 1.5], [7.5, 74, 1.5],
  [9, 76, 3],
  [12, 69, 1], [13, 72, 2],
  [15, 74, 1], [16, 77, 2],
  [18, 76, 1], [19, 74, 1], [20, 71, 1],
  [21, 69, 3],
];

const LOOP_BEATS = BARS.length * BEATS_PER_BAR;

export class MoonMusic {
  /**
   * @param {AudioContext} ctx
   * @param {GainNode} out    where the music lands (already under master)
   * @param {AudioBuffer} noise  shared noise buffer, for the brushes
   */
  constructor(ctx, out, noise) {
    this.ctx = ctx;
    this.out = out;
    this.noise = noise;
    this.playing = false;
    this.buffer = null;          // a supplied recording, if there is one
    this._source = null;
    this._timer = null;
    this._beat = 0;
    this._nextTime = 0;
  }

  /** Try to fetch and decode a supplied recording. Safe to call more than once. */
  async load(url = MOON_THEME_URL) {
    if (!url || this.buffer) return !!this.buffer;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      this.buffer = await this.ctx.decodeAudioData(await res.arrayBuffer());
      return true;
    } catch (err) {
      console.warn(`Moonflip: could not load ${url}, using the built-in instrumental.`, err);
      this.buffer = null;
      return false;
    }
  }

  start() {
    if (this.playing) return;
    this.playing = true;
    if (this.buffer) this._startRecording();
    else this._startSequencer();
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
    if (this._source) {
      try { this._source.stop(this.ctx.currentTime + 0.05); } catch { /* already stopped */ }
      this._source = null;
    }
  }

  /* ---------- a supplied recording ---------- */

  _startRecording() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = true;
    src.connect(this.out);
    src.start(this.ctx.currentTime + 0.02);
    this._source = src;
  }

  /* ---------- the built-in instrumental ---------- */

  _startSequencer() {
    this._beat = 0;
    this._nextTime = this.ctx.currentTime + 0.12;
    this._tick();
  }

  _tick() {
    if (!this.playing) return;
    while (this._nextTime < this.ctx.currentTime + LOOKAHEAD) {
      this._scheduleBeat(this._beat % LOOP_BEATS, this._nextTime);
      this._nextTime += BEAT;
      this._beat += 1;
    }
    this._timer = setTimeout(() => this._tick(), 180);
  }

  _scheduleBeat(beat, at) {
    const bar = BARS[Math.floor(beat / BEATS_PER_BAR)];
    const inBar = beat % BEATS_PER_BAR;

    if (inBar === 0) {
      this._bass(bar.bass, at, BEAT * 1.7);
      bar.chord.forEach((n, i) => this._keys(n, at + i * 0.012, BEAT * 2.4, 1));
    } else {
      // light comping on two and three, quieter than the downbeat
      this._bass(bar.bass + (inBar === 2 ? 7 : 12), at, BEAT * 0.8, 0.5);
      if (inBar === 2) bar.chord.forEach((n, i) => this._keys(n, at + i * 0.01, BEAT * 1.4, 0.4));
    }

    this._brush(at, inBar === 0 ? 0.05 : 0.028);

    MELODY.forEach(([b, note, len]) => {
      if (Math.abs(b - beat) < 1e-6) this._lead(note, at, len * BEAT);
    });
    // off-beat melody notes land halfway through their beat
    MELODY.forEach(([b, note, len]) => {
      if (Math.abs(b - (beat + 0.5)) < 1e-6) this._lead(note, at + BEAT * 0.5, len * BEAT);
    });
  }

  /** Soft electric-piano-ish tone: sine body, a little triangle on top. */
  _keys(note, at, dur, level = 1) {
    const ctx = this.ctx;
    const f = midi(note);
    [[1, 'sine', 0.05], [2, 'triangle', 0.016]].forEach(([mult, type, peak]) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = f * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(peak * level, at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(g); g.connect(this.out);
      osc.start(at); osc.stop(at + dur + 0.05);
    });
  }

  _bass(note, at, dur, level = 1) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = midi(note);
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.13 * level, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(tone); tone.connect(g); g.connect(this.out);
    osc.start(at); osc.stop(at + dur + 0.05);
  }

  /** The tune itself: a single breathy voice with a slow vibrato. */
  _lead(note, at, dur) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = midi(note);

    const vib = ctx.createOscillator();
    vib.type = 'sine';
    vib.frequency.value = 4.8;
    const vibAmt = ctx.createGain();
    vibAmt.gain.setValueAtTime(0, at);
    vibAmt.gain.linearRampToValueAtTime(midi(note) * 0.004, at + Math.min(0.5, dur * 0.6));
    vib.connect(vibAmt); vibAmt.connect(osc.frequency);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.085, at + 0.06);
    g.gain.setValueAtTime(0.085, at + dur * 0.62);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    osc.connect(g); g.connect(this.out);
    osc.start(at); vib.start(at);
    osc.stop(at + dur + 0.05); vib.stop(at + dur + 0.05);
  }

  /** Brushes, not sticks — a short swish rather than a hit. */
  _brush(at, peak) {
    if (!this.noise) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 5200;
    band.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(peak, at + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
    src.connect(band); band.connect(g); g.connect(this.out);
    src.start(at); src.stop(at + 0.35);
  }
}

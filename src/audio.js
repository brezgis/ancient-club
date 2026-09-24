// Procedural club music. Everything is synthesised live with WebAudio: no samples,
// no copyrighted tracks. A small sequencer plays a playlist of tracks (see tracks.js);
// each track is an arrangement of 8-bar sections with drum patterns, bass, leads and pads.
import { TRACKS, SEIKILOS } from './tracks.js';

const hzOf = (root, scale) => (deg, oct = 0) => {
  const n = scale.length;
  const o = Math.floor(deg / n);
  const s = scale[((deg % n) + n) % n] + 12 * (o + oct);
  return root * Math.pow(2, s / 12);
};

// A timer in a worker keeps ticking when the tab is in the background or the page is busy,
// where a plain setInterval gets throttled and the music would stall.
function makeTicker(cb) {
  try {
    const src = 'let id; onmessage = (e) => { clearInterval(id); id = setInterval(() => postMessage(0), e.data); };';
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    w.onmessage = cb;
    w.postMessage(25);
    return w;
  } catch {
    setInterval(cb, 25);
    return null;
  }
}

export class ClubAudio {
  constructor() {
    this.started = false;
    this.muted = false;
    this.muffle = 0;       // 0 = on the floor, 1 = behind the bathroom door
    this.trackIndex = 0;
    this.onTrackChange = null;
    this.energy = 0.6;
  }

  get track() { return TRACKS[this.trackIndex]; }

  start() {
    if (this.started) { this.resume(); return; }
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 18000;
    this.music = ctx.createGain();
    this.music.connect(this.lp).connect(this.master);
    this.fx = ctx.createGain();
    this.fx.connect(this.master);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);

    const len = ctx.sampleRate * 2.2;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    this.verb = ctx.createConvolver();
    this.verb.buffer = ir;
    const vg = ctx.createGain(); vg.gain.value = 0.25;
    this.verb.connect(vg).connect(this.lp);
    this.fxVerb = ctx.createConvolver();
    this.fxVerb.buffer = ir;
    const fvg = ctx.createGain(); fvg.gain.value = 0.5;
    this.fxVerb.connect(fvg).connect(this.master);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    this.started = true;
    this.beginTrack(0, ctx.currentTime + 0.1, 0);
    this.ticker = makeTicker(() => this.schedule());
    // browsers may suspend audio when you switch away; pick it back up when you return
    const wake = () => this.resume();
    document.addEventListener('visibilitychange', wake);
    addEventListener('focus', wake);
    addEventListener('pointerdown', wake);
    addEventListener('keydown', wake);
  }

  resume() {
    if (this.started && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  // --- the clock ------------------------------------------------------------------------
  // Visuals follow the audio clock, so tempo changes between tracks are tracked as segments.
  beginTrack(index, time, beatAtStart) {
    this.trackIndex = index;
    const tr = this.track;
    this.spb = 60 / tr.bpm;
    this.step = 0;
    this.nextTime = time;
    this.hz = hzOf(tr.root, tr.scale);
    this.pendingSkip = false;
    // keep the segment that is still playing (plus anything newer); drop the rest
    const segs = this.segments ?? [];
    const live = segs.filter(sg => sg.time <= time).at(-1);
    this.segments = segs.filter(sg => sg === live || sg.time > time);
    this.segments.push({ time, beat: beatAtStart, spb: this.spb });
    setTimeout(() => this.onTrackChange?.(tr), Math.max(0, (time - this.ctx.currentTime) * 1000));
  }

  get beatPosition() {
    if (!this.started) return performance.now() / 1000 / (60 / 118);
    const now = this.ctx.currentTime;
    let seg = this.segments[0];
    for (const sg of this.segments) if (sg.time <= now) seg = sg;
    return Math.max(0, seg.beat + (now - seg.time) / seg.spb);
  }

  nextTrack() {
    if (!this.started) return;
    this.pendingSkip = true;
  }

  schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    const ahead = ctx.currentTime + (document.hidden ? 1.2 : 0.3);
    // if we fell badly behind (the machine slept, say), skip ahead instead of bursting notes
    const stepDur = this.spb / 4;
    if (this.nextTime < ctx.currentTime - 0.05) {
      const skip = Math.ceil((ctx.currentTime - this.nextTime) / stepDur);
      this.nextTime += skip * stepDur;
      this.step += skip;
    }
    while (this.nextTime < ahead) {
      const tr = this.track;
      const totalSteps = tr.arrangement.length * 8 * 16;
      const atBar = this.step % 16 === 0;
      if (this.step >= totalSteps || (atBar && this.pendingSkip)) {
        const beat = this.segmentBeatAt(this.nextTime);
        this.beginTrack((this.trackIndex + 1) % TRACKS.length, this.nextTime, Math.round(beat));
        this.impact(this.nextTime);
        continue;
      }
      this.playStep(tr, this.step, this.nextTime);
      this.step++;
      this.nextTime += stepDur;
    }
  }

  segmentBeatAt(time) {
    let seg = this.segments[0];
    for (const sg of this.segments) if (sg.time <= time) seg = sg;
    return seg.beat + (time - seg.time) / seg.spb;
  }

  // --- the sequencer ---------------------------------------------------------------------
  playStep(tr, n, t) {
    const s16 = n % 16, bar = Math.floor(n / 16);
    const sectionName = tr.arrangement[Math.floor(bar / 8)] ?? 'outro';
    const sec = tr.sections[sectionName] ?? tr.sections[tr.arrangement.at(-1)];
    const barInSection = bar % 8;
    const spb = this.spb;
    if (s16 === 0) this.energy = sec.energy ?? 0.6;
    const hit = (pat) => pat && pat[s16] !== '.' && pat[s16] !== undefined ? pat[s16] : null;
    // swing on the off-16ths
    const tt = t + (s16 % 2 === 1 ? (tr.swing ?? 0) * spb / 4 : 0);

    const d = sec.drums ?? {};
    if (hit(d.kick)) this.kick(t, hit(d.kick) === 'x' ? 0.9 : 0.55);
    if (hit(d.clap)) this.clap(tt);
    if (hit(d.hat)) this.hat(tt, hit(d.hat) === 'x' ? 0.14 : 0.05);
    if (hit(d.ohat)) this.openHat(tt);
    if (hit(d.ride)) this.ride(tt);
    if (hit(d.rim)) this.rim(tt);
    if (hit(d.zill)) this.zill(tt);
    if (hit(d.sistrum)) this.sistrum(tt);
    if (hit(d.shaker)) this.shaker(tt, hit(d.shaker) === 'x' ? 0.06 : 0.03);
    const db = hit(d.darbuka);
    if (db === 'D') this.dum(t);
    if (db === 'T') this.tek(tt);
    if (db === 'k') this.tek(tt, 0.2);
    // darbuka fill in the last bar of each 4
    if (sec.fills && bar % 4 === 3 && s16 >= 8 && Math.random() < 0.7) this.tek(tt, 0.18 + (s16 - 8) * 0.03);
    // riser into the next section
    if (sec.riser && barInSection === 7 && s16 === 0) this.riser(t, spb * 4);

    // bass
    const b = sec.bass ?? tr.bass;
    if (b && !sec.noBass) {
      const pat = b.pattern;
      const deg = pat[s16 % pat.length];
      if (deg !== null && deg !== undefined) {
        const chordShift = tr.progression ? tr.progression[bar % tr.progression.length] : 0;
        const f = this.hz(deg + (b.follow ? chordShift : 0), b.octave ?? -1);
        const len = (b.len ?? 0.9) * spb / 4;
        if (b.type === 'acid') this.acid(t, f, len * 1.6, bar, s16 % 4 === 0);
        else if (b.type === 'sub') this.sub(t, f, len * 2);
        else this.bass(t, f, len, b.cutoff);
      }
    }

    // pads
    const pad = sec.pad && (tr.pad ?? { voicing: [0, 2, 4] });
    if (pad && s16 === 0) {
      const root = tr.progression ? tr.progression[bar % tr.progression.length] : 0;
      for (const v of pad.voicing) this.pad(t, this.hz(root + v, pad.octave ?? 0), spb * 4, pad.cutoff);
    }

    // arpeggio
    if (sec.arp && tr.arp) {
      const a = tr.arp;
      const deg = a.pattern[s16 % a.pattern.length];
      if (deg !== null) {
        const root = tr.progression ? tr.progression[bar % tr.progression.length] : 0;
        const f = this.hz(root + deg, a.octave ?? 1);
        if (a.instrument === 'bell') this.bell(tt, f, 0.6, 0.035, this.music);
        else this.pluck(tt, f, spb / 2, this.music, 0.12);
      }
    }

    // stabs
    if (sec.stabs && tr.stabs && hit(tr.stabs.pattern)) {
      const root = tr.progression ? tr.progression[bar % tr.progression.length] : 0;
      for (const v of tr.stabs.voicing) this.stab(tt, this.hz(root + v, tr.stabs.octave ?? 1));
    }

    // lead phrases
    if (sec.lead && tr.lead) {
      const L = tr.lead;
      const ph = L.phrases[Math.floor(bar / (L.bars ?? 1)) % L.phrases.length];
      const idx = (bar % (L.bars ?? 1)) * 16 + s16;
      const deg = ph[idx];
      if (deg !== null && deg !== undefined && (!L.every || bar % L.every.of === L.every.at || (L.every.at2 !== undefined && bar % L.every.of === L.every.at2))) {
        const f = this.hz(deg, L.octave ?? 1);
        const dur = (L.len ?? 2) * spb / 4;
        if (L.instrument === 'ney') this.ney(t, f, dur);
        else if (L.instrument === 'bell') this.bell(t, f, dur * 3, 0.05, this.music);
        else this.lead(t, f, dur);
      }
    }

    // the Seikilos melody as a lead line: 32 beats = 8 bars, starts on section boundaries
    if (sec.seikilos) {
      const beatInPhrase = barInSection * 4 + s16 / 4;
      const note = SEIKILOS_STEPS.get(Math.round(beatInPhrase * 4));
      if (note) {
        const f = 329.63 * Math.pow(2, note[0] / 12);
        this.pluck(t, f, note[1] * spb, this.music, 0.2);
        if (sec.seikilos === 'bell') this.bell(t, f * 2, note[1] * spb * 2, 0.03, this.music);
      }
    }
  }

  env(g, t, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  kick(t, v = 0.9) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    this.env(g, t, 0.002, 0.35, v);
    o.connect(g).connect(this.music);
    o.start(t); o.stop(t + 0.4);
  }

  noiseHit(t, { type = 'highpass', freq = 8000, q = 1, dur = 0.05, peak = 0.2, dest = this.music }) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, t, 0.001, dur, peak);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  hat(t, v) { this.noiseHit(t, { freq: 9000, dur: 0.04, peak: v }); }
  clap(t) {
    for (let i = 0; i < 3; i++) this.noiseHit(t + i * 0.012, { type: 'bandpass', freq: 1400, q: 0.8, dur: 0.08, peak: 0.28 });
  }
  dum(t) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.2);
    this.env(g, t, 0.003, 0.28, 0.35);
    o.connect(g).connect(this.music);
    o.start(t); o.stop(t + 0.35);
  }
  tek(t, v = 0.4) {
    this.noiseHit(t, { type: 'bandpass', freq: 3200, q: 3, dur: 0.035, peak: v * 0.6 });
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.value = 820; o.type = 'triangle';
    this.env(g, t, 0.001, 0.04, v * 0.12);
    o.connect(g).connect(this.music); o.start(t); o.stop(t + 0.06);
  }
  sistrum(t) {
    // the sistrum was Hathor's rattle: metal discs on rods
    for (let i = 0; i < 6; i++) this.noiseHit(t + i * 0.018 + Math.random() * 0.006, { type: 'bandpass', freq: 6500 + Math.random() * 2000, q: 8, dur: 0.05, peak: 0.07 });
  }
  bass(t, f, dur, cutoff = 900) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), lp = this.ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(cutoff, t); lp.frequency.exponentialRampToValueAtTime(160, t + dur);
    this.env(g, t, 0.005, dur, 0.3);
    o.connect(lp).connect(g).connect(this.music);
    o.start(t); o.stop(t + dur + 0.05);
  }
  lead(t, f, dur) {
    // something between a mizmar and a synth: nasal square with vibrato
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), bp = this.ctx.createBiquadFilter();
    const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
    o.type = 'square'; o.frequency.value = f;
    lfo.frequency.value = 5.5; lg.gain.value = f * 0.012;
    lfo.connect(lg).connect(o.frequency);
    bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.2;
    this.env(g, t, 0.03, dur, 0.09);
    o.connect(bp).connect(g);
    g.connect(this.music); g.connect(this.verb);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
  }
  pad(t, f, dur, cutoff = 700) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), lp = this.ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 12;
    lp.type = 'lowpass'; lp.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.035, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(this.music);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // a plucked lyre, built from a few decaying harmonics (no feedback delays, so no buzz)
  pluck(t, f, dur, dest = this.fx, amp = 0.22) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = amp;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2600;
    out.connect(lp); lp.connect(dest); lp.connect(dest === this.fx ? this.fxVerb : this.verb);
    const decay = Math.max(0.8, dur * 2.2);
    [[1, 1, 1], [2, 0.45, 0.6], [3, 0.2, 0.4], [4, 0.08, 0.25]].forEach(([h, amp, dk]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f * h;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay * dk);
      o.connect(g).connect(out);
      o.start(t); o.stop(t + decay * dk + 0.05);
    });
  }

  // a soft glassy bell: a pure tone plus quiet inharmonic partials that fade first
  bell(t, f, dur, amp = 0.1, dest = this.fx) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = amp;
    out.connect(dest); out.connect(dest === this.fx ? this.fxVerb : this.verb);
    [[1, 1, 1], [2.76, 0.25, 0.35], [5.4, 0.08, 0.15]].forEach(([r, a, dk]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f * r;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(a, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * dk);
      o.connect(g).connect(out);
      o.start(t); o.stop(t + dur * dk + 0.05);
    });
  }

  // airy shimmer: filtered noise swelling and sweeping upward
  shimmer(t, dur, amp = 0.035) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6;
    bp.frequency.setValueAtTime(2500, t);
    bp.frequency.exponentialRampToValueAtTime(9000, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp).connect(g);
    g.connect(this.fxVerb);
    g.connect(this.fx);
    s.start(t); s.stop(t + dur + 0.05);
  }

  // small UI sounds
  // the translation sound: a rising run of bells that follows the sparkle sweep,
  // then a warm chord as the new script settles
  chime(dur = 1.6) {
    if (!this.started) return;
    const t = this.ctx.currentTime + 0.02;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];   // pentatonic, bright and consonant
    const root = 587.33;                                     // D5
    const n = scale.length;
    scale.forEach((d, i) => {
      const at = t + (i / n) * dur * 0.85 + Math.random() * 0.03;
      this.bell(at, root * Math.pow(2, d / 12), 1.4, 0.07 * (1 - i / n * 0.5));
    });
    this.shimmer(t, dur);
    for (const [d, a] of [[-12, 0.07], [-5, 0.05], [4, 0.045], [12, 0.035]]) {
      this.bell(t + dur, root * Math.pow(2, d / 12), 3.2, a);
    }
  }
  clink() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    for (const f of [2400, 3100]) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.frequency.value = f; o.type = 'sine';
      this.env(g, t, 0.001, 0.5, 0.08);
      o.connect(g).connect(this.fx); o.start(t); o.stop(t + 0.6);
    }
  }

  // --- extra instruments ---------------------------------------------------------------------
  openHat(t) { this.noiseHit(t, { freq: 7000, dur: 0.18, peak: 0.08 }); }
  ride(t) {
    this.noiseHit(t, { type: 'bandpass', freq: 9500, q: 2, dur: 0.3, peak: 0.035 });
  }
  rim(t) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 1700;
    this.env(g, t, 0.001, 0.03, 0.12);
    o.connect(g).connect(this.music); o.start(t); o.stop(t + 0.05);
  }
  shaker(t, v) { this.noiseHit(t, { type: 'bandpass', freq: 7500, q: 1.5, dur: 0.05, peak: v }); }
  // zills: the finger cymbals of Egyptian dance
  zill(t) {
    for (const [f, a] of [[2830, 0.05], [4170, 0.03], [6300, 0.015]]) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.frequency.value = f;
      this.env(g, t, 0.001, 0.35, a);
      o.connect(g).connect(this.music); o.start(t); o.stop(t + 0.4);
    }
  }
  sub(t, f, dur) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    this.env(g, t, 0.01, dur, 0.4);
    o.connect(g).connect(this.music); o.start(t); o.stop(t + dur + 0.05);
  }
  // a squelchy 303-ish line; the filter opens and closes over 16 bars
  acid(t, f, dur, bar, accent) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), lp = this.ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = f;
    const open = 0.5 - 0.5 * Math.cos((bar % 16) / 16 * Math.PI * 2);
    const cut = 280 + 2600 * open * (accent ? 1.3 : 1);
    lp.type = 'lowpass'; lp.Q.value = 14;
    lp.frequency.setValueAtTime(cut, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(120, cut * 0.25), t + dur);
    this.env(g, t, 0.004, dur, accent ? 0.2 : 0.13);
    o.connect(lp).connect(g).connect(this.music);
    o.start(t); o.stop(t + dur + 0.05);
  }
  stab(t, f) {
    for (const det of [-7, 7]) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain(), lp = this.ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(400, t + 0.2);
      this.env(g, t, 0.003, 0.2, 0.04);
      o.connect(lp).connect(g); g.connect(this.music); g.connect(this.verb);
      o.start(t); o.stop(t + 0.3);
    }
  }
  // the ney, an end-blown reed flute: a soft tone with breath noise and slow vibrato
  ney(t, f, dur) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    lfo.frequency.value = 4.8; lg.gain.value = f * 0.008;
    lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.12);
    g.gain.setValueAtTime(0.08, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
    o.connect(g); g.connect(this.music); g.connect(this.verb);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.35); lfo.stop(t + dur + 0.35);
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 3;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.02, t + 0.08);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
    s.connect(bp).connect(ng); ng.connect(this.music);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.3);
  }
  riser(t, dur) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(9000, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + dur * 0.95);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02);
    s.connect(f).connect(g).connect(this.music);
    s.start(t); s.stop(t + dur + 0.05);
  }
  impact(t) {
    this.kick(t, 1);
    this.noiseHit(t, { type: 'lowpass', freq: 3000, dur: 1.4, peak: 0.12 });
  }

  // translating the Seikilos column: the song on a solo lyre, with the club dipped underneath
  playSeikilos() {
    if (!this.started || this.seikilosUntil > this.ctx.currentTime) return;
    let t = this.ctx.currentTime + 0.1;
    const beat = 0.55;
    for (const [semi, len] of SEIKILOS) {
      this.pluck(t, 329.63 * Math.pow(2, semi / 12), len * beat);
      t += len * beat;
    }
    this.seikilosUntil = t;
    this.music.gain.setTargetAtTime(0.25, this.ctx.currentTime, 0.3);
    this.music.gain.setTargetAtTime(1 - this.muffle * 0.45, t, 0.3);
  }

  setMuffle(m, force = false) {
    if (!this.started) return;
    if (!force && Math.abs(m - this.muffle) < 0.01 && !this._firstMuffle) return;
    this._firstMuffle = false;
    this.muffle = m;
    const f = 18000 * Math.pow(420 / 18000, m);
    this.lp.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.1);
    const at = Math.max(this.ctx.currentTime, this.seikilosUntil ?? 0);  // never undo the Seikilos dip early
    this.music.gain.setTargetAtTime(1 - m * 0.45, at, at > this.ctx.currentTime ? 0.3 : 0.1);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.started) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    return this.muted;
  }
}

// step (in 16ths within the 8-bar phrase) -> [semitone, beats]
const SEIKILOS_STEPS = (() => {
  const m = new Map();
  let beat = 0;
  for (const [semi, len] of SEIKILOS) { m.set(Math.round(beat * 4), [semi, len]); beat += len; }
  return m;
})();

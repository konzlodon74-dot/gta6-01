// audio.js — every sound in Palmera is synthesised with WebAudio: the
// engine's growl, two-tone sirens, horns, the till-chime of a paid job and
// a quiet pad of chords under the whole city. No audio files, no network.
//
// The context is created lazily on the first key press (browsers refuse
// sound before a gesture), and every entry point tolerates sound being off.

let ctx = null;
let master = null;
let engineOsc = null;
let engineGain = null;
let engineFilter = null;
let sirenOsc = null;
let sirenGain = null;
let sirenTimer = 0;
let sirenHigh = false;

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    ctx = null;
    return;
  }
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  startEngineVoice();
  startSirenVoice();
  startPad();
}

function startEngineVoice() {
  engineOsc = ctx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 55;
  engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 320;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  engineOsc.connect(engineFilter).connect(engineGain).connect(master);
  engineOsc.start();
}

function startSirenVoice() {
  sirenOsc = ctx.createOscillator();
  sirenOsc.type = 'triangle';
  sirenOsc.frequency.value = 720;
  sirenGain = ctx.createGain();
  sirenGain.gain.value = 0;
  sirenOsc.connect(sirenGain).connect(master);
  sirenOsc.start();
}

function startPad() {
  // A slow Cmaj7 wash, quiet enough to sit under traffic noise.
  const notes = [130.81, 196.0, 246.94, 329.63];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = 0.012;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05 + i * 0.017;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.007;
    lfo.connect(lfoGain).connect(gain.gain);
    osc.connect(gain).connect(master);
    osc.start();
    lfo.start();
  });
}

// Called every frame: engine pitch follows speed, the siren follows the
// nearest police car. loud is 0..1 for each voice.
export function updateAudio(dt, engine, siren) {
  if (!ctx) return;
  const now = ctx.currentTime;
  const target = engine.on ? 0.05 + engine.load * 0.05 : 0;
  engineGain.gain.setTargetAtTime(target, now, 0.08);
  engineOsc.frequency.setTargetAtTime(52 + engine.load * 165, now, 0.06);
  engineFilter.frequency.setTargetAtTime(280 + engine.load * 900, now, 0.1);

  sirenTimer -= dt;
  if (sirenTimer <= 0) {
    sirenTimer = 0.38;
    sirenHigh = !sirenHigh;
    if (sirenOsc) sirenOsc.frequency.setValueAtTime(sirenHigh ? 950 : 715, now);
  }
  sirenGain.gain.setTargetAtTime(siren.on ? 0.028 * siren.level : 0, now, 0.15);
}

function tone(freq, dur, type, gain, when = 0, slideTo = null) {
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  blip() {
    tone(880, 0.09, 'square', 0.05);
  },
  objective() {
    tone(660, 0.1, 'square', 0.05);
    tone(990, 0.14, 'square', 0.05, 0.09);
  },
  cash() {
    tone(1245, 0.08, 'square', 0.045);
    tone(1865, 0.16, 'square', 0.045, 0.07);
  },
  horn() {
    tone(392, 0.22, 'square', 0.035);
    tone(494, 0.22, 'square', 0.03);
  },
  thud(strength) {
    tone(70, 0.18, 'sine', Math.min(0.3, 0.08 + strength * 0.02), 0, 40);
  },
  door() {
    tone(180, 0.07, 'square', 0.04, 0, 120);
  },
  busted() {
    tone(392, 0.2, 'square', 0.06);
    tone(311, 0.2, 'square', 0.06, 0.18);
    tone(262, 0.34, 'square', 0.06, 0.36);
  },
  wasted() {
    tone(330, 0.5, 'sawtooth', 0.05, 0, 82);
  },
};

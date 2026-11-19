// All of Palmera Heat's sound is synthesised with WebAudio — no audio files.
// A tiny engine hum that follows the player's car, a two-tone siren for
// police, and one-shot blips for pickups, punches, gunfire and cash. The
// context starts on the first user gesture, as browsers require.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;

  function ensure() {
    if (ctx !== null) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return false;
    }
    engineOsc = ctx.createOscillator();
    engineGain = ctx.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain.gain.value = 0;
    engineOsc.connect(engineGain).connect(ctx.destination);
    engineOsc.start();
    sirenOsc = ctx.createOscillator();
    sirenGain = ctx.createGain();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 700;
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(ctx.destination);
    sirenOsc.start();
    return true;
  }

  function blip(freq, seconds, type, volume, slideTo) {
    if (ctx === null || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + seconds);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + seconds);
  }

  function noise(seconds, volume) {
    if (ctx === null || muted) return;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    gain.gain.value = volume;
    src.connect(gain).connect(ctx.destination);
    src.start();
  }

  return {
    /** Start the context; call from any key or mouse handler. */
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    /** Per-frame: engine pitch from speed, siren audibility from nearby police. */
    update(engineLevel, sirenLevel, time) {
      if (ctx === null) return;
      const engineTarget = muted ? 0 : engineLevel * 0.05;
      engineGain.gain.setTargetAtTime(engineTarget, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(50 + engineLevel * 130, ctx.currentTime, 0.08);
      const sirenTarget = muted ? 0 : sirenLevel * 0.028;
      sirenGain.gain.setTargetAtTime(sirenTarget, ctx.currentTime, 0.15);
      sirenOsc.frequency.setTargetAtTime(680 + Math.sin(time * 5.2) * 190, ctx.currentTime, 0.03);
    },
    shoot() { noise(0.09, 0.25); blip(190, 0.08, 'square', 0.12, 60); },
    punch() { noise(0.05, 0.15); },
    cash() { blip(880, 0.09, 'sine', 0.16); setTimeout(() => blip(1320, 0.12, 'sine', 0.14), 60); },
    pickup() { blip(520, 0.1, 'sine', 0.15, 780); },
    crash() { noise(0.18, 0.3); },
    horn() { blip(340, 0.22, 'square', 0.06, 320); },
    mission() { blip(660, 0.12, 'sine', 0.15); setTimeout(() => blip(990, 0.18, 'sine', 0.15), 110); },
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
  };
}

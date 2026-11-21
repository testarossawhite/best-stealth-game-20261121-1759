// GLOAMING ARCHIVE — synthesized WebAudio sound. No audio files: every effect
// is an oscillator or a filtered noise burst shaped in code, so the game stays
// fully offline and self-contained. Sound starts on the first user gesture;
// until then (and in screenshot scenes) every call is a safe no-op.

let ctx = null;
let master = null;
let muted = false;
let ambienceNodes = null;

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    startAmbience();
  } catch {
    ctx = null;
  }
}

export function setMuted(value) {
  muted = value;
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.03);
  return muted;
}

export function isMuted() {
  return muted;
}

/** A low library hum: two detuned sines through a slow breathing gain. */
function startAmbience() {
  if (!ctx || ambienceNodes) return;
  const gain = ctx.createGain();
  gain.gain.value = 0.035;
  const oscA = ctx.createOscillator();
  oscA.type = 'sine';
  oscA.frequency.value = 55;
  const oscB = ctx.createOscillator();
  oscB.type = 'triangle';
  oscB.frequency.value = 110.5;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.012;
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);
  oscA.connect(gain);
  oscB.connect(gain);
  gain.connect(master);
  oscA.start();
  oscB.start();
  lfo.start();
  ambienceNodes = { gain, oscA, oscB, lfo };
}

function tone(freq, dur, type, vol, when = 0, slideTo = null) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noiseBurst(dur, vol, freq, when = 0) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + when;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 0.9;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(t0);
}

export const sfx = {
  step() {
    noiseBurst(0.05, 0.05, 700);
  },
  page() {
    tone(880, 0.16, 'sine', 0.16);
    tone(1318, 0.22, 'sine', 0.14, 0.07);
    tone(1760, 0.3, 'sine', 0.1, 0.14);
  },
  pebbleThrow() {
    noiseBurst(0.08, 0.06, 1800);
  },
  pebbleLand() {
    tone(340, 0.09, 'square', 0.1, 0, 180);
    noiseBurst(0.06, 0.1, 1200);
  },
  stir() {
    tone(196, 0.35, 'sawtooth', 0.07, 0, 262);
  },
  caught() {
    tone(392, 0.5, 'sawtooth', 0.2, 0, 98);
    tone(415, 0.5, 'sawtooth', 0.18, 0.02, 104);
    noiseBurst(0.4, 0.16, 300);
  },
  clear() {
    tone(523, 0.2, 'sine', 0.14);
    tone(659, 0.2, 'sine', 0.14, 0.1);
    tone(784, 0.34, 'sine', 0.16, 0.2);
    tone(1046, 0.5, 'sine', 0.12, 0.3);
  },
  unlock() {
    tone(740, 0.12, 'triangle', 0.14);
    tone(988, 0.2, 'triangle', 0.12, 0.09);
  },
  denied() {
    tone(160, 0.14, 'square', 0.08);
  },
  select() {
    tone(620, 0.07, 'triangle', 0.09);
    tone(930, 0.09, 'triangle', 0.07, 0.05);
  },
  rustle() {
    noiseBurst(0.16, 0.05, 2400);
    noiseBurst(0.12, 0.04, 1500, 0.05);
  },
  hound() {
    tone(140, 0.18, 'sawtooth', 0.1, 0, 90);
    tone(140, 0.18, 'sawtooth', 0.1, 0.22, 90);
  },
};

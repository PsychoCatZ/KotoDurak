/** Синтезированные звуки на Web Audio — без внешних файлов */

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
}
export function isMuted() {
  return muted;
}

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.15, slideTo?: number) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur: number, freq: number, gain = 0.12) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime;
  const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t0);
}

export const sfx = {
  flip() { noise(0.08, 2400, 0.1); },
  deal() { noise(0.06, 1800, 0.08); tone(500, 0.06, 'triangle', 0.05); },
  attack() { noise(0.1, 1200, 0.14); tone(300, 0.1, 'triangle', 0.08, 220); },
  beat() { tone(620, 0.09, 'triangle', 0.12); tone(930, 0.12, 'sine', 0.08); },
  add() { tone(440, 0.08, 'square', 0.06); noise(0.07, 2000, 0.07); },
  take() { tone(600, 0.28, 'sine', 0.12, 240); }, // грустное «мя-а-у»
  pass() { tone(330, 0.07, 'sine', 0.06); },
  click() { tone(880, 0.04, 'sine', 0.05); },
  win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.12), i * 110)); },
  lose() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sine', 0.11), i * 140)); },
  meow() { tone(700, 0.2, 'sine', 0.06, 900); },
};

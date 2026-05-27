// Discord paritesi: ses bildirimleri (mention/DM için kısa "ping")
// Web Audio API ile dahili ton üret — dosya bağımlılığı yok

let ctx: AudioContext | null = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}

function tone(freq: number, durationMs: number, gain = 0.15, type: OscillatorType = 'sine') {
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(gain, ac.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + durationMs / 1000);
    osc.connect(g).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + durationMs / 1000);
  } catch {}
}

export function playMessageSound() {
  tone(523, 80);
  setTimeout(() => tone(659, 110), 70);
}

export function playMentionSound() {
  tone(659, 100);
  setTimeout(() => tone(880, 100), 90);
  setTimeout(() => tone(1047, 150), 180);
}

export function playJoinSound() {
  tone(440, 100);
  setTimeout(() => tone(660, 150), 90);
}

export function playLeaveSound() {
  tone(660, 100);
  setTimeout(() => tone(440, 150), 90);
}

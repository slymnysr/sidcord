// Soundboard ses oynatma + durdurma — çalan Audio nesnelerini izler ki durdurulabilsin.

const playing = new Set<HTMLAudioElement>();

// Çalan ses sayısı değişince haber ver (Durdur butonu reaktif görünsün)
type Listener = () => void;
const listeners = new Set<Listener>();
function notify() {
  for (const l of listeners) l();
}
export function onSoundboardChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function playSound(url: string, volume = 1): void {
  try {
    const a = new Audio(url);
    a.volume = Math.min(1, Math.max(0, volume));
    const cleanup = () => {
      playing.delete(a);
      notify();
    };
    a.addEventListener('ended', cleanup);
    a.addEventListener('error', cleanup);
    playing.add(a);
    notify();
    a.play().catch(() => cleanup());
  } catch {
    /* yoksay */
  }
}

export function stopAllSounds(): void {
  for (const a of playing) {
    try {
      a.pause();
      a.currentTime = 0;
    } catch {
      /* yoksay */
    }
  }
  playing.clear();
  notify();
}

export function soundsPlaying(): number {
  return playing.size;
}

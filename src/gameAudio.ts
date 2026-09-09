let context: AudioContext | null = null;

function play(frequency: number, endFrequency: number, duration: number, type: OscillatorType) {
  if (!context || context.state !== 'running') return;
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.045, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}

export const gameAudio = {
  unlock() {
    try {
      if (typeof window.AudioContext === 'undefined') return;
      context ??= new AudioContext();
      if (context.state === 'suspended') void context.resume().catch(() => {});
    } catch {
      // Audio is optional when the browser or device does not allow it.
    }
  },
  eat(score: number) {
    const note = 540 + (Math.floor(score / 10) % 7) * 65;
    play(note, note * 1.5, 0.12, 'sine');
  },
  bonus(kind: string) {
    if (kind === 'speed') play(240, 720, 0.18, 'sawtooth');
    else if (kind === 'chomp') play(160, 90, 0.16, 'square');
    else if (kind === 'x100') play(420, 1260, 0.32, 'triangle');
    else play(380, 860, 0.2, 'triangle');
  },
  gameOver() {
    play(180, 38, 0.38, 'triangle');
  },
};
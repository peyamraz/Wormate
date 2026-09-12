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
  _lastGulp: 0,
  _lastZip: 0,
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
    else if (kind === 'chomp') play(160, 90, 0.16, 'triangle');
    else if (kind === 'x100') play(420, 1260, 0.32, 'triangle');
    else play(380, 860, 0.2, 'triangle');
  },
  frenzy(combo: number) {
    const base = 420 + Math.min(400, combo * 28);
    play(base, base * 1.6, 0.22, 'triangle');
    play(base * 1.25, base * 2.2, 0.3, 'sine');
  },
  gameOver() {
    play(180, 38, 0.38, 'triangle');
  },
  expired() {
    play(520, 260, 0.16, 'sine');
  },
  gulp() {
    // CHOMP şöleninde makineli tüfek etkisi yapmasın: yumuşak dalga + 120ms seyretme.
    const now = performance.now();
    if (now - this._lastGulp < 120) return;
    this._lastGulp = now;
    play(150, 70, 0.1, 'triangle');
  },
  zip() {
    const now = performance.now();
    if (now - this._lastZip < 120) return;
    this._lastZip = now;
    play(700, 1500, 0.08, 'sine');
  },
  takedown() {
    play(300, 900, 0.14, 'square');
    play(450, 1350, 0.2, 'triangle');
  },
};
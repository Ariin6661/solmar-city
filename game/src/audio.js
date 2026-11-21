// Solmar City — fully synthesized sound.
// No audio files: engine, sirens, gunshots and music are all built from
// WebAudio oscillators and filtered noise. Everything is guarded so the
// game plays silently when audio is unavailable or locked.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicOn = true;
    this.engineNodes = null;
    this.sirenNodes = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.unlocked = false;
  }

  unlock() {
    if (this.unlocked) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.unlocked = true;
      this.startEngine();
      this.startMusic();
    } catch (err) {
      this.ctx = null;
    }
  }

  startEngine() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = 28;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc2.start();
    this.engineNodes = { osc, osc2, gain, filter };
  }

  setEngine(speed01, driving) {
    if (!this.engineNodes || !this.ctx) return;
    const t = this.ctx.currentTime;
    const target = driving ? 0.05 + speed01 * 0.11 : 0.0;
    this.engineNodes.gain.gain.setTargetAtTime(target, t, 0.08);
    this.engineNodes.osc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.1);
    this.engineNodes.osc2.frequency.setTargetAtTime(28 + speed01 * 62, t, 0.1);
    this.engineNodes.filter.frequency.setTargetAtTime(320 + speed01 * 900, t, 0.1);
  }

  startSiren(on) {
    if (!this.ctx) return;
    if (!on) {
      if (this.sirenNodes) {
        try { this.sirenNodes.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); } catch (err) { /* already gone */ }
        const nodes = this.sirenNodes;
        this.sirenNodes = null;
        setTimeout(() => {
          try { nodes.osc.stop(); nodes.lfo.stop(); } catch (err) { /* stopped */ }
        }, 600);
      }
      return;
    }
    if (this.sirenNodes) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 820;
    const lfo = this.ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 0.9;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.045, this.ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    lfo.start();
    this.sirenNodes = { osc, lfo, gain };
  }

  noiseBuffer(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  gunshot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.14);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.12);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
    src.stop(t + 0.15);
  }

  punch() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.09);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.11);
  }

  blip(freq, when, dur) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  pickup() {
    this.blip(660, 0, 0.12);
    this.blip(880, 0.09, 0.18);
  }

  missionDone() {
    this.blip(523, 0, 0.14);
    this.blip(659, 0.12, 0.14);
    this.blip(784, 0.24, 0.26);
  }

  crash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.25);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
    src.stop(t + 0.26);
  }

  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [110, 110, 130.8, 164.8, 98, 110, 146.8, 164.8];
    const lead = [440, 0, 523.3, 0, 659.3, 0, 587.3, 0];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || !this.musicOn) return;
      const step = this.musicStep % 8;
      const t = this.ctx.currentTime;
      this.note(bass[step] / 2, t, 0.22, 'triangle', 0.16);
      if (lead[step]) this.note(lead[step], t, 0.2, 'sine', 0.07);
      this.musicStep++;
    }, 230);
  }

  note(freq, t, dur, type, vol) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    return this.musicOn;
  }
}

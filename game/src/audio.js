// Solmar City — fully synthesized WebAudio sound.
//
// No audio files, no network: every sound is an oscillator or a burst of
// generated noise. The context is created lazily on the first user
// gesture (browsers block audio before that), and everything is guarded
// so a missing AudioContext never breaks the game.

function makeNoiseBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    noise: null,
    musicOn: true,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenLfo: null,
    musicTimer: null,
    musicStep: 0,
  };

  audio.ensure = () => {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return true;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
      audio.noise = makeNoiseBuffer(audio.ctx, 1);
    } catch (err) {
      return false;
    }
    return true;
  };

  audio.setMuted = (muted) => {
    audio.muted = muted;
    if (audio.master) audio.master.gain.value = muted ? 0 : 0.5;
  };

  audio.toggleMusic = () => {
    audio.musicOn = !audio.musicOn;
    if (!audio.musicOn) audio.stopMusic();
    return audio.musicOn;
  };

  // A short blip: one oscillator, quick pitch slide, fast decay.
  audio.blip = (freqA, freqB, dur, type, vol) => {
    if (!audio.ensure() || audio.muted) return;
    const t = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freqA, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqB), t + dur);
    gain.gain.setValueAtTime(vol || 0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };

  // A burst of filtered noise (gunshots, punches, crashes).
  audio.noiseBurst = (dur, filterFreq, vol) => {
    if (!audio.ensure() || audio.muted) return;
    const t = audio.ctx.currentTime;
    const src = audio.ctx.createBufferSource();
    src.buffer = audio.noise;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  };

  audio.gunshot = () => audio.noiseBurst(0.14, 900, 0.3);
  audio.punch = () => audio.noiseBurst(0.09, 500, 0.22);
  audio.pickup = () => { audio.blip(660, 990, 0.12, 'sine', 0.14); };
  audio.cash = () => { audio.blip(880, 880, 0.07, 'sine', 0.12); audio.blip(1320, 1320, 0.1, 'sine', 0.1); };
  audio.missionDone = () => {
    audio.blip(523, 523, 0.12, 'triangle', 0.14);
    setTimeout(() => audio.blip(659, 659, 0.12, 'triangle', 0.14), 110);
    setTimeout(() => audio.blip(784, 784, 0.2, 'triangle', 0.14), 220);
  };

  // Continuous engine hum: one sawtooth whose pitch follows speed.
  audio.engine = (speedNorm) => {
    if (!audio.ensure() || audio.muted) return;
    // A NaN speed (bad caller, corrupt state) would poison the oscillator.
    if (!Number.isFinite(speedNorm)) speedNorm = 0;
    speedNorm = Math.max(0, Math.min(1, speedNorm));
    if (!audio.engineOsc) {
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      audio.engineOsc.connect(filter);
      filter.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engineOsc.start();
    }
    const t = audio.ctx.currentTime;
    audio.engineOsc.frequency.setTargetAtTime(55 + speedNorm * 140, t, 0.08);
    audio.engineGain.gain.setTargetAtTime(speedNorm > 0.02 ? 0.05 : 0, t, 0.1);
  };

  // Two-tone siren while the police are after you.
  audio.siren = (on) => {
    if (!audio.ensure()) return;
    if (on && !audio.sirenOsc) {
      audio.sirenOsc = audio.ctx.createOscillator();
      audio.sirenOsc.type = 'sine';
      audio.sirenOsc.frequency.value = 750;
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenGain.gain.value = 0.035;
      audio.sirenLfo = audio.ctx.createOscillator();
      audio.sirenLfo.frequency.value = 0.9;
      const lfoGain = audio.ctx.createGain();
      lfoGain.gain.value = 260;
      audio.sirenLfo.connect(lfoGain);
      lfoGain.connect(audio.sirenOsc.frequency);
      audio.sirenOsc.connect(audio.sirenGain);
      audio.sirenGain.connect(audio.master);
      audio.sirenOsc.start();
      audio.sirenLfo.start();
    } else if (!on && audio.sirenOsc) {
      try { audio.sirenOsc.stop(); audio.sirenLfo.stop(); } catch (err) { /* already stopped */ }
      audio.sirenOsc = null;
      audio.sirenLfo = null;
      audio.sirenGain = null;
    }
  };

  // A lazy bassline loop: a few notes on a timer, quiet underneath.
  const BASS = [55, 0, 65.4, 0, 49, 0, 58.3, 0, 55, 0, 65.4, 0, 73.4, 0, 65.4, 0];
  audio.startMusic = () => {
    if (!audio.ensure() || audio.musicTimer) return;
    audio.musicTimer = setInterval(() => {
      if (!audio.musicOn || audio.muted || !audio.ctx) return;
      const note = BASS[audio.musicStep % BASS.length];
      audio.musicStep++;
      if (!note) return;
      const t = audio.ctx.currentTime;
      const osc = audio.ctx.createOscillator();
      const gain = audio.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = note;
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(t);
      osc.stop(t + 0.45);
    }, 240);
  };

  audio.stopMusic = () => {
    if (audio.musicTimer) {
      clearInterval(audio.musicTimer);
      audio.musicTimer = null;
    }
  };

  return audio;
}

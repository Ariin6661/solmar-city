// Sound, all synthesized with WebAudio — no audio files, no network.
// The context is created on the first user gesture (browsers demand it),
// and every effect is a few oscillators or a burst of noise.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenLfo: null,
    musicTimer: null,
    musicStep: 0,
    musicOn: false,
  };

  audio.ensure = function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
    } catch {
      audio.ctx = null;
    }
  };

  audio.setMuted = function setMuted(muted) {
    audio.muted = muted;
    if (audio.master) audio.master.gain.value = muted ? 0 : 0.5;
  };

  function tone(freq, dur, type, vol, slideTo) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start(t);
  }

  // (named effects are attached below, then the object is returned)

  // ---- Named effects the game triggers ----

  audio.sfx = function sfx(name) {
    if (!audio.ctx) return;
    switch (name) {
      case 'shoot':
        noise(0.12, 0.35, 2600);
        tone(180, 0.08, 'square', 0.12, 60);
        break;
      case 'enemyShoot':
        noise(0.1, 0.2, 1800);
        break;
      case 'punch':
        tone(90, 0.12, 'sine', 0.4, 45);
        noise(0.06, 0.2, 500);
        break;
      case 'pickup':
        tone(660, 0.09, 'sine', 0.2);
        setTimeout(() => tone(990, 0.14, 'sine', 0.2), 90);
        break;
      case 'crash':
        noise(0.25, 0.4, 700);
        tone(70, 0.2, 'sine', 0.3, 35);
        break;
      case 'honk':
        tone(370, 0.18, 'square', 0.12);
        tone(466, 0.18, 'square', 0.1);
        break;
      case 'click':
        tone(880, 0.05, 'sine', 0.15);
        break;
      case 'missionPass': {
        const notes = [523, 659, 784, 1047];
        notes.forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.22), i * 110));
        break;
      }
      case 'missionFail':
        tone(220, 0.35, 'sawtooth', 0.15, 110);
        break;
      case 'wantedUp':
        tone(520, 0.12, 'square', 0.14);
        setTimeout(() => tone(520, 0.12, 'square', 0.14), 140);
        break;
      case 'coin':
        tone(1320, 0.07, 'sine', 0.18);
        setTimeout(() => tone(1760, 0.12, 'sine', 0.18), 70);
        break;
      default:
        break;
    }
  };

  // Continuous engine hum while driving; speed01 is 0..1.
  audio.engine = function engine(speed01, on) {
    if (!audio.ctx) return;
    if (!on) {
      if (audio.engineOsc) {
        try { audio.engineOsc.stop(); } catch { /* already stopped */ }
        audio.engineOsc = null;
        audio.engineGain = null;
      }
      return;
    }
    if (!audio.engineOsc) {
      const osc = audio.ctx.createOscillator();
      const gain = audio.ctx.createGain();
      const filter = audio.ctx.createBiquadFilter();
      osc.type = 'sawtooth';
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      gain.gain.value = 0.05;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audio.master);
      osc.start();
      audio.engineOsc = osc;
      audio.engineGain = gain;
    }
    audio.engineOsc.frequency.value = 55 + speed01 * 130;
    audio.engineGain.gain.value = 0.035 + speed01 * 0.05;
  };

  // Two-tone police siren while the wanted level is up.
  audio.siren = function siren(on) {
    if (!audio.ctx) return;
    if (!on) {
      if (audio.sirenOsc) {
        try { audio.sirenOsc.stop(); audio.sirenLfo.stop(); } catch { /* stopped */ }
        audio.sirenOsc = null;
        audio.sirenGain = null;
        audio.sirenLfo = null;
      }
      return;
    }
    if (!audio.sirenOsc) {
      const osc = audio.ctx.createOscillator();
      const gain = audio.ctx.createGain();
      const lfo = audio.ctx.createOscillator();
      const lfoGain = audio.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 820;
      lfo.type = 'square';
      lfo.frequency.value = 0.55;
      lfoGain.gain.value = 160;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      gain.gain.value = 0.035;
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start();
      lfo.start();
      audio.sirenOsc = osc;
      audio.sirenGain = gain;
      audio.sirenLfo = lfo;
    }
  };

  // A simple bass-and-hat loop, scheduled a few notes ahead.
  audio.music = function music(on) {
    if (!audio.ctx) return;
    audio.musicOn = on;
    if (!on) {
      if (audio.musicTimer) clearInterval(audio.musicTimer);
      audio.musicTimer = null;
      return;
    }
    if (audio.musicTimer) return;
    const bass = [110, 110, 130.8, 164.8, 98, 110, 87.3, 82.4];
    audio.musicTimer = setInterval(() => {
      if (audio.muted || !audio.musicOn) return;
      const step = audio.musicStep % 8;
      tone(bass[step], 0.42, 'triangle', 0.1);
      if (step % 2 === 0) noise(0.03, 0.05, 6000);
      audio.musicStep++;
    }, 300);
  };

  return audio;
}

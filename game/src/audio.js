// Synthesized sound only: no audio files. Engine hum, siren, gunshots,
// pickups and a small looping bass-and-hat groove, all WebAudio.
export function makeAudio() {
  return {
    ctx: null,
    master: null,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenHigh: false,
    sirenTimer: 0,
    musicOn: true,
    musicTimer: 0,
    musicStep: 0,
    musicGain: null,
    started: false,
  };
}

export function initAudio(A) {
  if (A.started) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    A.ctx = new Ctx();
    A.master = A.ctx.createGain();
    A.master.gain.value = 0.5;
    A.master.connect(A.ctx.destination);
    // Engine: two detuned saws through a lowpass, quiet by default.
    A.engineOsc = A.ctx.createOscillator();
    A.engineOsc.type = 'sawtooth';
    A.engineOsc.frequency.value = 42;
    A.engineOsc2 = A.ctx.createOscillator();
    A.engineOsc2.type = 'sawtooth';
    A.engineOsc2.frequency.value = 63;
    const lp = A.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    A.engineGain = A.ctx.createGain();
    A.engineGain.gain.value = 0;
    A.engineOsc.connect(lp);
    A.engineOsc2.connect(lp);
    lp.connect(A.engineGain);
    A.engineGain.connect(A.master);
    A.engineOsc.start();
    A.engineOsc2.start();
    // Siren: one square wave, flipped between two notes by update().
    A.sirenOsc = A.ctx.createOscillator();
    A.sirenOsc.type = 'square';
    A.sirenOsc.frequency.value = 720;
    A.sirenGain = A.ctx.createGain();
    A.sirenGain.gain.value = 0;
    A.sirenOsc.connect(A.sirenGain);
    A.sirenGain.connect(A.master);
    A.sirenOsc.start();
    // Music bus, quieter than effects.
    A.musicGain = A.ctx.createGain();
    A.musicGain.gain.value = 0.16;
    A.musicGain.connect(A.master);
    A.started = true;
  } catch (e) {
    A.started = false;
  }
}

export function resumeAudio(A) {
  if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
}

function noiseBuffer(A, seconds) {
  const len = Math.floor(A.ctx.sampleRate * seconds);
  const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function blip(A, freq, dur, type, vol, slideTo) {
  if (!A.started) return;
  const t = A.ctx.currentTime;
  const osc = A.ctx.createOscillator();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = A.ctx.createGain();
  g.gain.setValueAtTime(vol || 0.25, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g);
  g.connect(A.master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noiseHit(A, dur, filterFreq, vol) {
  if (!A.started) return;
  const t = A.ctx.currentTime;
  const src = A.ctx.createBufferSource();
  src.buffer = noiseBuffer(A, dur);
  const f = A.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filterFreq || 1200;
  const g = A.ctx.createGain();
  g.gain.setValueAtTime(vol || 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(A.master);
  src.start(t);
}

// Named effects the game triggers.
export function sfx(A, name) {
  if (!A.started) return;
  switch (name) {
    case 'shot':
      noiseHit(A, 0.14, 2600, 0.5);
      blip(A, 190, 0.09, 'square', 0.2, 70);
      break;
    case 'enemyShot':
      noiseHit(A, 0.12, 1800, 0.28);
      break;
    case 'punch':
      noiseHit(A, 0.1, 500, 0.4);
      break;
    case 'pickup':
      blip(A, 660, 0.09, 'sine', 0.25);
      setTimeout(() => blip(A, 990, 0.12, 'sine', 0.25), 70);
      break;
    case 'cash':
      blip(A, 880, 0.08, 'sine', 0.25);
      setTimeout(() => blip(A, 1174, 0.1, 'sine', 0.25), 80);
      setTimeout(() => blip(A, 1568, 0.14, 'sine', 0.22), 160);
      break;
    case 'crash':
      noiseHit(A, 0.3, 420, 0.55);
      break;
    case 'reload':
      blip(A, 320, 0.05, 'square', 0.15);
      setTimeout(() => blip(A, 420, 0.05, 'square', 0.15), 110);
      break;
    case 'missionPass':
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(A, f, 0.22, 'triangle', 0.28), i * 110));
      break;
    case 'missionFail':
      [392, 330, 262].forEach((f, i) => setTimeout(() => blip(A, f, 0.25, 'triangle', 0.25), i * 130));
      break;
    case 'wantedUp':
      blip(A, 220, 0.3, 'sawtooth', 0.2, 440);
      break;
    case 'horn':
      blip(A, 370, 0.18, 'square', 0.12, 370);
      break;
    default:
      break;
  }
}

// Per-frame audio: engine follows the player's car speed, the siren
// wails while wanted, and a small groove loops when music is on.
// Bass line: A minor walk, one note per eighth at 112 BPM.
const MUSIC_BASS = [55, 0, 55, 65.41, 55, 0, 49, 55, 55, 0, 55, 65.41, 82.41, 0, 73.42, 65.41];
const MUSIC_LEAD = [220, 0, 261.63, 0, 329.63, 0, 261.63, 220, 196, 0, 220, 0, 246.94, 0, 293.66, 0];

export function updateAudio(A, G, dt) {
  if (!A.started) return;
  const speed = G.player.car ? Math.abs(G.player.car.speed) : 0;
  // Engine hum: pitch and volume rise with speed, silent on foot.
  const target = G.player.car ? 0.05 + (speed / CFG_MAX_SPEED_FOR_AUDIO) * 0.09 : 0;
  A.engineGain.gain.value += (target - A.engineGain.gain.value) * Math.min(1, dt * 6);
  const f = 42 + speed * 0.22;
  A.engineOsc.frequency.value = f;
  A.engineOsc2.frequency.value = f * 1.5;
  // Siren while wanted.
  if (G.wanted > 0) {
    A.sirenTimer -= dt;
    if (A.sirenTimer <= 0) {
      A.sirenTimer = 0.42;
      A.sirenHigh = !A.sirenHigh;
      A.sirenOsc.frequency.value = A.sirenHigh ? 950 : 700;
    }
    const sg = 0.028 + G.wanted * 0.008;
    A.sirenGain.gain.value += (sg - A.sirenGain.gain.value) * Math.min(1, dt * 4);
  } else {
    A.sirenGain.gain.value += (0 - A.sirenGain.gain.value) * Math.min(1, dt * 4);
  }
  // Music groove, only while playing and music is on.
  if (A.musicOn && G.mode === 'playing') {
    A.musicTimer -= dt;
    if (A.musicTimer <= 0) {
      A.musicTimer = 60 / 112 / 2; // eighth notes at 112 BPM
      const step = A.musicStep % 16;
      const bass = MUSIC_BASS[step];
      if (bass) blip(A, bass, 0.24, 'triangle', 0.5);
      const lead = MUSIC_LEAD[step];
      if (lead && step % 2 === 0) blip(A, lead, 0.18, 'square', 0.06);
      if (step % 4 === 2) noiseHit(A, 0.05, 6000, 0.06); // hat
      A.musicStep++;
    }
    A.musicGain.gain.value = 0.16;
  } else {
    A.musicGain.gain.value = 0;
  }
}

const CFG_MAX_SPEED_FOR_AUDIO = 540;

// audio.js — WebAudio-driven SFX and a looping square-wave melody.
// All sounds generated on the fly; no audio files.

const Audio = (() => {
  let ctx = null;
  let master = null, sfxGain = null, musicGain = null;
  let muted = false;
  let musicEnabled = false;
  let musicNextTime = 0;
  let musicMeasure = 0;
  let musicNote = 0;
  let musicTimer = null;

  function init() {
    // AudioContext is created lazily on first user gesture (browser autoplay rules).
  }

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(ctx.destination);

      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.85;
      sfxGain.connect(master);

      musicGain = ctx.createGain();
      musicGain.gain.value = 0.32;
      musicGain.connect(master);
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function setMuted(v) {
    muted = v;
    if (master) master.gain.value = muted ? 0 : 0.55;
  }
  function toggleMute() { setMuted(!muted); return muted; }
  function isMuted() { return muted; }

  // ─── Building blocks ──────────────────────────────────────────────────────
  function tone({ freq, duration, type = 'square', volume = 0.2, freqEnd = null, attack = 0.005, dest }) {
    if (!ensure()) return;
    resume();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + duration);
    }
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);
    osc.connect(gain).connect(dest || sfxGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.04);
  }

  function noise({ duration, volume = 0.15, lowpass = 4000, hipass = 0, attack = 0.001 }) {
    if (!ensure()) return;
    resume();
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);
    let last = src;
    if (hipass > 0) {
      const f = ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = hipass;
      last.connect(f); last = f;
    }
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass'; lpf.frequency.value = lowpass;
    last.connect(lpf).connect(gain).connect(sfxGain);
    src.start(t0);
    src.stop(t0 + duration + 0.04);
  }

  // ─── SFX library ──────────────────────────────────────────────────────────
  const SFX = {
    jump: () => {
      tone({ freq: 460, duration: 0.10, type: 'square', volume: 0.18, freqEnd: 880, attack: 0.001 });
      tone({ freq: 920, duration: 0.04, type: 'triangle', volume: 0.06, freqEnd: 1300 });
    },
    swing: () => {
      noise({ duration: 0.10, volume: 0.10, lowpass: 6500, hipass: 1200 });
      tone({ freq: 1200, duration: 0.06, type: 'sawtooth', volume: 0.05, freqEnd: 360 });
    },
    hit: () => {
      tone({ freq: 200, duration: 0.10, type: 'square', volume: 0.20, freqEnd: 70 });
      noise({ duration: 0.07, volume: 0.13, lowpass: 1600 });
    },
    death: () => {
      tone({ freq: 240, duration: 0.30, type: 'sawtooth', volume: 0.18, freqEnd: 60 });
      noise({ duration: 0.18, volume: 0.10, lowpass: 700 });
    },
    hurt: () => {
      tone({ freq: 130, duration: 0.18, type: 'sawtooth', volume: 0.22, freqEnd: 60 });
      noise({ duration: 0.10, volume: 0.12, lowpass: 1400 });
    },
    gem: () => {
      tone({ freq: 880, duration: 0.07, type: 'square', volume: 0.13 });
      setTimeout(() => tone({ freq: 1318, duration: 0.08, type: 'square', volume: 0.11 }), 55);
      setTimeout(() => tone({ freq: 1760, duration: 0.14, type: 'square', volume: 0.09 }), 120);
    },
    heart: () => {
      tone({ freq: 523, duration: 0.10, type: 'sine',     volume: 0.18 });
      setTimeout(() => tone({ freq: 659, duration: 0.14, type: 'sine', volume: 0.16 }), 70);
      setTimeout(() => tone({ freq: 784, duration: 0.18, type: 'sine', volume: 0.14 }), 150);
    },
    relic: () => {
      // triumphant chord arpeggio
      tone({ freq: 523, duration: 0.16, type: 'square', volume: 0.14 });
      setTimeout(() => tone({ freq: 659, duration: 0.16, type: 'square', volume: 0.13 }), 80);
      setTimeout(() => tone({ freq: 784, duration: 0.20, type: 'square', volume: 0.13 }), 170);
      setTimeout(() => tone({ freq: 1046,duration: 0.40, type: 'square', volume: 0.12 }), 280);
      setTimeout(() => tone({ freq: 1318,duration: 0.40, type: 'triangle',volume: 0.10}), 280);
    },
    checkpoint: () => {
      tone({ freq: 523, duration: 0.18, type: 'square',   volume: 0.14 });
      tone({ freq: 784, duration: 0.20, type: 'triangle', volume: 0.11 });
      setTimeout(() => tone({ freq: 1046,duration: 0.30, type: 'square', volume: 0.11 }), 80);
    },
    arrow: () => {
      tone({ freq: 140, duration: 0.16, type: 'sawtooth', volume: 0.10, freqEnd: 32, attack: 0.005 });
      noise({ duration: 0.06, volume: 0.04, lowpass: 4000 });
    },
  };

  function play(name) {
    const f = SFX[name];
    if (!f || muted) return;
    try { f(); } catch (e) {}
  }

  // ─── Music ────────────────────────────────────────────────────────────────
  // Notes are semitone offsets from A4 (440 Hz). -99 = rest.
  const REST = -99;
  function noteFreq(semi) { return 440 * Math.pow(2, semi / 12); }

  // 4-bar haunting / hopeful theme in A minor — 8th notes (8 per bar)
  const MELODY = [
    // Bar 1 — Am
    [   0,  3,  7, 12,  7,  3,  0, -2],
    // Bar 2 — F  (8 below A)
    [  -4,  0,  3,  8,  3,  0, -4, -5],
    // Bar 3 — Dm
    [  -7, -4,  0,  5,  0, -4, -7, -9],
    // Bar 4 — E   (resolves back via 5 ≅ V)
    [  -5, -2,  2,  7,  2, -2, -5,  0],
  ];
  // Bass (root–fifth on quarters): 4 notes per bar.
  const BASS = [
    [-12, -5, -12, -5],   // A,  E
    [-16, -9, -16, -9],   // F,  C
    [-19, -12,-19, -12],  // D,  A
    [-17, -10,-17, -10],  // E,  B
  ];

  function startMusic() {
    if (!ensure()) return;
    musicEnabled = true;
    musicNextTime = ctx.currentTime + 0.06;
    musicMeasure = 0;
    musicNote = 0;
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = setInterval(scheduleAhead, 50);
  }
  function stopMusic() {
    musicEnabled = false;
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
  }

  function scheduleAhead() {
    if (!ctx || !musicEnabled) return;
    const beat = 0.18;     // 8th-note duration ≈ 83 bpm
    while (musicNextTime < ctx.currentTime + 0.15) {
      const m = MELODY[musicMeasure];
      const b = BASS[musicMeasure];
      const idx = musicNote;
      const semi = m[idx];

      if (semi !== REST) {
        scheduleNote(noteFreq(semi), musicNextTime, beat * 0.92, 'square', 0.05);
        // gentle harmony layer 1 octave up but quieter & fewer notes
        if (idx % 4 === 0) {
          scheduleNote(noteFreq(semi + 12), musicNextTime, beat * 0.85, 'triangle', 0.020);
        }
      }
      // bass on quarter notes (every other 8th)
      if (idx % 2 === 0) {
        const bs = b[idx >> 1];
        if (bs !== REST) {
          scheduleNote(noteFreq(bs - 12), musicNextTime, beat * 1.85, 'triangle', 0.06);
        }
      }
      musicNextTime += beat;
      musicNote++;
      if (musicNote >= m.length) {
        musicNote = 0;
        musicMeasure = (musicMeasure + 1) % MELODY.length;
      }
    }
  }

  function scheduleNote(freq, when, dur, type, vol) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(vol, when + 0.005);
    gain.gain.linearRampToValueAtTime(vol * 0.45, when + dur * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0008, when + dur);
    osc.connect(gain).connect(musicGain);
    osc.start(when);
    osc.stop(when + dur + 0.04);
  }

  return {
    init, ensure,
    play, startMusic, stopMusic,
    setMuted, toggleMute, isMuted,
  };
})();

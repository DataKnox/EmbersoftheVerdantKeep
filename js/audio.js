// audio.js — WebAudio-driven SFX and looping chiptune music.
// Stub for now. Sounds added in a later commit.

const Audio = (() => {
  let ctx = null;
  let master = null;
  let muted = false;

  function init() {
    // AudioContext can only be created after first user gesture in some browsers.
    // We lazy-init on first sound() call.
  }

  function ensure() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  function setMuted(v) {
    muted = v;
    if (master) master.gain.value = muted ? 0 : 0.5;
  }
  function toggleMute() { setMuted(!muted); return muted; }
  function isMuted() { return muted; }

  function play(name) { /* stubbed */ }
  function startMusic() { /* stubbed */ }
  function stopMusic() { /* stubbed */ }

  return { init, ensure, play, startMusic, stopMusic, setMuted, toggleMute, isMuted };
})();

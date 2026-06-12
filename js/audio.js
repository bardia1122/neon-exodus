// NEON EXODUS — procedural audio (WebAudio, zero assets)
const Sfx = (() => {
  let ctx = null, master = null, musicGain = null, musicTimer = null;

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
  }

  function env(g, t, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  function tone(type, f0, f1, a, d, peak, dest) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + a + d);
    env(g, t, a, d, peak);
    o.connect(g); g.connect(dest || master);
    o.start(t); o.stop(t + a + d + 0.05);
  }

  function noise(dur, peak, hp, lp) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain();
    env(g, t, 0.005, dur, peak);
    let node = src;
    if (hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; node.connect(f); node = f; }
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    node.connect(g); g.connect(master);
    src.start(t);
  }

  const api = {
    init,
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },

    pistol()  { tone('square', 880, 110, 0.005, 0.12, 0.35); noise(0.08, 0.2, 2000); },
    shotgun() { noise(0.25, 0.5, 400, 4000); tone('sawtooth', 200, 40, 0.005, 0.2, 0.4); },
    smg()     { tone('square', 1200, 200, 0.003, 0.07, 0.22); noise(0.05, 0.15, 3000); },
    railgun() { tone('sawtooth', 60, 1800, 0.02, 0.35, 0.45); noise(0.3, 0.3, 1000); },
    sunlance(){ tone('sine', 100, 30, 0.01, 0.4, 0.5); noise(0.35, 0.4, 200, 2500); },
    explode() { noise(0.5, 0.6, 60, 1200); tone('sine', 120, 25, 0.01, 0.45, 0.5); },
    empty()   { tone('square', 220, 180, 0.005, 0.06, 0.15); },
    reload()  { tone('square', 500, 700, 0.005, 0.05, 0.15); setTimeout(() => ctx && tone('square', 700, 900, 0.005, 0.06, 0.18), 160); },
    hit()     { tone('triangle', 1500, 900, 0.003, 0.05, 0.25); },
    kill()    { tone('triangle', 500, 1400, 0.01, 0.18, 0.3); },
    hurt()    { tone('sawtooth', 220, 70, 0.005, 0.25, 0.4); noise(0.15, 0.25, 100, 800); },
    pickup()  { tone('sine', 600, 1200, 0.01, 0.15, 0.3); setTimeout(() => ctx && tone('sine', 900, 1800, 0.01, 0.15, 0.25), 90); },
    unlock()  { [440, 660, 880, 1320].forEach((f, i) => setTimeout(() => ctx && tone('sine', f, f, 0.01, 0.3, 0.25), i * 110)); },
    enemyShot(){ tone('sawtooth', 700, 250, 0.005, 0.15, 0.2); },
    step()    { noise(0.04, 0.06, 600, 3000); },
    jump()    { tone('sine', 300, 500, 0.01, 0.1, 0.12); },
    bossRoar(){ tone('sawtooth', 80, 35, 0.05, 1.2, 0.5); noise(1.0, 0.3, 50, 600); },

    startMusic() {
      if (musicTimer) return;
      const beat = () => {
        if (!ctx) return;
        tone('sine', 55, 50, 0.02, 0.5, 0.5, musicGain);
        tone('sine', 82.5, 82, 0.05, 1.4, 0.25, musicGain);
        if (Math.random() < 0.35) tone('triangle', 660 + Math.random() * 440, 660, 0.3, 1.2, 0.06, musicGain);
      };
      beat();
      musicTimer = setInterval(beat, 1900);
    },
    stopMusic() { clearInterval(musicTimer); musicTimer = null; }
  };
  return api;
})();

// Synthesised sound (WebAudio): hammer swings, impacts, ult cues and the hit/kill ticks, attenuated by
// distance from the camera. Optionally reads the team comms aloud with the browser's speech voices.
(function (G) {
  class Audio {
    constructor(game) {
      this.g = game;
      this.ctx = null;
      this.vol = 0.5;
      this.voice = false;
    }
    start() {
      if (this.ctx) { this.ctx.resume(); return; }
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      this.ctx = new C();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.vol;
      this.master.connect(this.ctx.destination);
      const n = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, n, n);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }

    gainFor(pos) {
      if (!pos) return 1;
      const cam = this.g.world.camera.position;
      const d = cam.distanceTo(pos);
      return Math.max(0.05, Math.min(1, 6 / Math.max(6, d)));
    }

    tone(type, f0, f1, dur, vol, at = 0) {
      const c = this.ctx, t = c.currentTime + at;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    }

    hiss(dur, vol, f0, f1, q = 1, at = 0) {
      const c = this.ctx, t = c.currentTime + at;
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noise;
      f.type = 'bandpass'; f.Q.value = q;
      f.frequency.setValueAtTime(f0, t);
      f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(f); f.connect(g); g.connect(this.master);
      s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    }

    play(name, pos) {
      if (!this.ctx) return;
      const v = this.gainFor(pos);
      switch (name) {
        case 'swing': this.hiss(0.32, 0.5 * v, 300, 1400, 0.8); break;
        case 'hammerHit': this.tone('sine', 120, 50, 0.22, 0.7 * v); this.hiss(0.12, 0.4 * v, 800, 200); break;
        case 'shieldHit': this.tone('triangle', 900, 700, 0.08, 0.12 * v); break;
        case 'fire': this.hiss(0.6, 0.5 * v, 600, 150, 0.6); this.tone('sawtooth', 160, 60, 0.5, 0.15 * v); break;
        case 'charge': this.hiss(1.4, 0.35 * v, 200, 900, 0.7); this.tone('sawtooth', 80, 140, 1.2, 0.12 * v); break;
        case 'slam': this.tone('sine', 90, 30, 0.5, 0.9 * v); this.hiss(0.35, 0.6 * v, 500, 80); break;
        case 'shatter': this.tone('sine', 70, 25, 1.0, 1.0 * v); this.hiss(1.0, 0.8 * v, 900, 60, 0.5); break;
        case 'zalt': this.tone('square', 500, 200, 0.12, 0.08 * v); break;
        case 'bubble': this.tone('sine', 400, 900, 0.25, 0.25 * v); break;
        case 'pop': this.tone('sine', 900, 300, 0.2, 0.25 * v); break;
        case 'grav': this.tone('sawtooth', 60, 40, 3.5, 0.25 * v); this.tone('sine', 220, 110, 3.5, 0.2 * v); break;
        case 'dvagun': this.hiss(0.05, 0.12 * v, 2000, 1500, 2); break;
        case 'boost': this.hiss(0.9, 0.3 * v, 300, 1200, 0.5); break;
        case 'bombArm': for (let i = 0; i < 9; i++) this.tone('square', 1400 + i * 120, 1400 + i * 120, 0.06, 0.12 * v, i * (0.34 - i * 0.025)); break;
        case 'boom': this.tone('sine', 60, 20, 1.6, 1.0); this.hiss(1.6, 0.9, 1200, 50, 0.4); break;
        case 'wave': this.tone('sine', 300, 80, 0.25, 0.35 * v); break;
        case 'amp': this.tone('square', 330, 660, 0.3, 0.12 * v); break;
        case 'beat': for (let i = 0; i < 4; i++) this.tone('square', 110, 55, 0.25, 0.3 * v, i * 0.12); this.tone('sine', 220, 880, 0.8, 0.25 * v, 0.5); break;
        case 'rally': this.tone('triangle', 330, 495, 0.6, 0.25 * v); break;
        case 'trans': this.tone('sine', 523, 523, 1.2, 0.18 * v); this.tone('sine', 784, 784, 1.2, 0.12 * v); break;
        case 'whip': this.hiss(0.15, 0.3 * v, 2500, 600, 2); break;
        case 'bash': this.tone('triangle', 200, 80, 0.15, 0.4 * v); break;
        case 'flail': this.hiss(0.2, 0.2 * v, 500, 1200); break;
        case 'hit': this.tone('square', 1700, 1700, 0.03, 0.06); break;
        case 'kill': this.tone('triangle', 880, 880, 0.08, 0.2); this.tone('triangle', 1320, 1320, 0.12, 0.2, 0.07); break;
        case 'ultReady': this.tone('sine', 660, 990, 0.35, 0.2); break;
        case 'hurt': this.tone('sine', 180, 120, 0.1, 0.2); break;
        case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.3, 0.2, i * 0.12)); break;
        case 'lose': [392, 330, 262].forEach((f, i) => this.tone('triangle', f, f, 0.4, 0.2, i * 0.18)); break;
      }
    }

    say(text, ally) {
      if (!this.voice || !window.speechSynthesis) return;
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.15; u.volume = ally ? 0.8 : 0.6; u.pitch = ally ? 1.05 : 0.9;
      speechSynthesis.speak(u);
    }
  }

  G.Audio = Audio;
})(window.G = window.G || {});

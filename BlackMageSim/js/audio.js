// Small Web Audio synth for spell sounds. Nothing is loaded from disk.
(function (B) {
  class Sfx {
    constructor() { this.ctx = null; this.vol = 0.5; }

    ensure() {
      if (!this.ctx) {
        try {
          this.ctx = new (window.AudioContext || window.webkitAudioContext)();
          this.master = this.ctx.createGain();
          this.master.gain.value = this.vol * 0.6;
          this.master.connect(this.ctx.destination);
          const len = this.ctx.sampleRate * 2;
          this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
          const d = this.noiseBuf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        } catch (e) { this.ctx = null; }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return !!this.ctx;
    }

    setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v * 0.6; }

    env(node, t, a, peak, d) {
      node.gain.setValueAtTime(0.0001, t);
      node.gain.exponentialRampToValueAtTime(peak, t + a);
      node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    }

    tone(type, f0, f1, dur, peak, delay) {
      const c = this.ctx, t = c.currentTime + (delay || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      this.env(g, t, 0.01, peak, dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.05);
    }

    noise(filter, freq, q, dur, peak, delay) {
      const c = this.ctx, t = c.currentTime + (delay || 0);
      const s = c.createBufferSource(); s.buffer = this.noiseBuf;
      const f = c.createBiquadFilter(); f.type = filter; f.frequency.value = freq; f.Q.value = q || 0.7;
      const g = c.createGain();
      this.env(g, t, 0.005, peak, dur);
      s.connect(f); f.connect(g); g.connect(this.master);
      s.start(t, Math.random()); s.stop(t + dur + 0.05);
    }

    play(kind) {
      if (this.vol <= 0 || !this.ensure()) return;
      switch (kind) {
        case 'cast': this.tone('sine', 520, 880, 0.35, 0.05); this.tone('triangle', 1040, 1300, 0.3, 0.02, 0.05); break;
        case 'fire': this.noise('lowpass', 900, 1, 0.55, 0.5); this.tone('sine', 110, 50, 0.4, 0.35); break;
        case 'fire4': this.noise('lowpass', 1300, 1, 0.75, 0.6); this.tone('sine', 90, 40, 0.5, 0.45); this.noise('bandpass', 3000, 2, 0.3, 0.15, 0.05); break;
        case 'despair': this.noise('lowpass', 700, 1, 1.1, 0.75); this.tone('sawtooth', 70, 30, 0.9, 0.25); this.tone('sine', 55, 30, 1.0, 0.5); break;
        case 'ice': this.tone('sine', 1800, 1700, 0.5, 0.12); this.tone('sine', 2400, 2300, 0.4, 0.08, 0.03); this.noise('highpass', 5000, 1, 0.25, 0.2); break;
        case 'ice4': this.tone('sine', 1500, 1400, 0.7, 0.14); this.tone('sine', 2250, 2100, 0.6, 0.1, 0.04); this.tone('sine', 3000, 2900, 0.5, 0.06, 0.08); this.noise('highpass', 4000, 1, 0.4, 0.25); break;
        case 'thunder': this.noise('bandpass', 2500, 0.6, 0.18, 0.7); this.noise('lowpass', 300, 0.7, 1.0, 0.5, 0.05); this.tone('sine', 60, 35, 0.8, 0.3, 0.05); break;
        case 'xeno': this.tone('sine', 260, 55, 0.7, 0.5); this.noise('lowpass', 600, 1, 0.6, 0.4); this.tone('triangle', 880, 660, 0.4, 0.06); break;
        case 'paradox': [880, 1320, 1760, 2640].forEach((f, i) => this.tone('sine', f, f, 0.45, 0.07, i * 0.04)); this.noise('highpass', 6000, 1, 0.2, 0.1); break;
        case 'dot': this.noise('bandpass', 3500, 3, 0.08, 0.12); break;
        // Samurai: a blade leaving the sheath, swishes, and heavier cuts for Iaijutsu and the big oGCDs.
        case 'draw': this.noise('highpass', 5000, 1, 0.25, 0.08); this.tone('triangle', 2800, 3100, 0.2, 0.03); break;
        case 'auto': this.noise('bandpass', 2600, 1.2, 0.07, 0.12); break;
        case 'slash': case 'slash2': case 'shinten': case 'enpi':
          this.noise('bandpass', 3800, 1.2, 0.14, 0.32); this.tone('sawtooth', 900, 280, 0.12, 0.04);
          if (kind === 'slash2') this.noise('bandpass', 4400, 1.2, 0.12, 0.25, 0.09);
          break;
        case 'slash3': case 'slashFire': case 'slashIce':
          this.noise('bandpass', 3400, 1, 0.18, 0.38); this.noise('bandpass', 4200, 1.2, 0.14, 0.28, 0.1);
          this.tone('sine', 160, 70, 0.25, 0.18);
          if (kind === 'slashIce') this.tone('sine', 2200, 2100, 0.4, 0.06, 0.05);
          if (kind === 'slashFire') this.noise('lowpass', 900, 1, 0.4, 0.25, 0.05);
          break;
        case 'higanbana': case 'tenka':
          this.noise('bandpass', 3000, 1, 0.22, 0.45); this.tone('sine', 120, 50, 0.4, 0.3);
          this.tone('triangle', 2400, 2350, 0.5, 0.04, 0.05);
          break;
        case 'midare': case 'ogi': case 'senei': case 'shoha':
          [0, 0.07, 0.14].forEach(d => this.noise('bandpass', 3200 + d * 6000, 1, 0.16, 0.4, d));
          this.noise('lowpass', 1100, 0.8, 0.6, 0.5, 0.1); this.tone('sine', 90, 35, 0.6, 0.45, 0.1);
          this.tone('triangle', 2600, 2550, 0.8, 0.05, 0.15);
          break;
        case 'ogcd': this.tone('sine', 1300, 1700, 0.18, 0.06); this.tone('sine', 1950, 2300, 0.15, 0.03, 0.03); break;
        case 'manafont': this.tone('sine', 400, 1200, 0.6, 0.12); this.noise('highpass', 3000, 1, 0.5, 0.08); break;
        case 'error': this.tone('square', 180, 160, 0.12, 0.04); break;
        case 'tick': this.tone('sine', 1000, 1000, 0.08, 0.1); break;
        case 'engage': this.tone('sawtooth', 220, 440, 0.6, 0.08); this.tone('sine', 660, 880, 0.6, 0.12, 0.05); break;
        case 'interrupt': this.tone('triangle', 500, 200, 0.2, 0.08); break;
      }
    }
  }

  B.Sfx = Sfx;
})(window.BLM);

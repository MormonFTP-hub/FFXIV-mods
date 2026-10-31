// Sound: the game's own (tools/export_audio.py: each job's action sounds, each boss's, each fight's music), loaded
// when a job or a fight needs them, and a small Web Audio synth that stands in for anything without a game sound.
(function (B) {
  // Where the exported files are: work/ next to index.html; the build puts them beside the page instead.
  B.ASSET_BASE = B.ASSET_BASE !== undefined ? B.ASSET_BASE : 'work/';
  const loading = {};
  B.loadAsset = (path) => loading[path] || (loading[path] = new Promise((res) => {
    const s = document.createElement('script');
    s.src = B.ASSET_BASE + path;
    s.onload = () => res(true);
    s.onerror = () => res(false);          // not exported: the synth stands in
    document.head.appendChild(s);
  }));
  const bytes = (url) => {                 // a data URL's bytes, for decodeAudioData
    const bin = atob(url.slice(url.indexOf(',') + 1)), a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a.buffer;
  };

  class Sfx {
    constructor() {
      this.ctx = null; this.vol = 0.5;
      this.clips = {}; this.acts = {}; this.bosses = {}; this.have = new Set(); this.bufs = new Map(); this.casting = [];
    }

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

    // ---------- the game's sounds ----------
    // Take what the loaded files pushed (BLM.SOUNDS_IN: {name, clips, actions | bosses}).
    drain() {
      const q = B.SOUNDS_IN;
      if (!q || !q.length) return;
      for (const d of q.splice(0)) {
        Object.assign(this.clips, d.clips || {});
        Object.assign(this.acts, d.actions || {});
        Object.assign(this.bosses, d.bosses || {});
        this.have.add(d.name);
      }
    }

    // A job's sounds ('blm') or a fight's boss ('boss-m5s'): loaded once, then decoded ahead so the first cast isn't late.
    want(name) {
      this.drain();
      const ready = () => {
        if (!this.ctx) return;
        const pre = name.startsWith('boss-') ? this.bosses[name.slice(5)] : Object.fromEntries(Object.entries(this.acts).filter(([k]) => k.startsWith(name + ':')));
        for (const v of Object.values(pre || {})) for (const list of Object.values(v)) for (const [id] of list) this.buffer(id);
      };
      if (this.have.has(name)) { ready(); return; }
      B.loadAsset(`sounds/${name}.js`).then(() => { this.drain(); ready(); });
    }

    buffer(id) {
      if (!this.bufs.has(id)) {
        const url = this.clips[id];
        this.bufs.set(id, url && this.ctx ? this.ctx.decodeAudioData(bytes(url)).catch(() => null) : Promise.resolve(null));
      }
      return this.bufs.get(id);
    }

    // Play [[clip, second], ...] as the game would (each clip that many seconds after now); true when there's any.
    game(list, gain, keep) {
      if (!list || !list.length) return false;
      if (this.vol <= 0 || !this.ensure()) return true;
      const c = this.ctx, t0 = c.currentTime;
      for (const [id, at] of list) {
        this.buffer(id).then((buf) => {
          if (!buf) return;
          const s = c.createBufferSource(), g = c.createGain();
          s.buffer = buf;
          g.gain.value = gain || 1;
          s.connect(g); g.connect(this.master);
          s.start(Math.max(c.currentTime, t0 + at));
          if (keep) keep.push({ s, g });
        });
      }
      return true;
    }

    // Your action's sounds: 'cast' (as the cast starts), 'use' (as it goes off), 'hit' (as it lands). False when
    // the game has none for it, so the synth plays instead.
    action(id, phase) {
      const a = B.ACTIONS && B.ACTIONS[id];
      const s = this.acts[`${B.jobId}:${id}`] || (a && a.iconOf && this.acts[`${B.jobId}:${a.iconOf}`]);
      if (phase === 'cast') { this.stopCast(); return this.game(s && s.cast, 1, this.casting); }
      return this.game(s && s[phase]);
    }
    hasAction(id, phase) {
      const s = this.acts[`${B.jobId}:${id}`];
      return !!(s && s[phase] && s[phase].length);
    }
    // An interrupted cast's sound stops with it.
    stopCast() {
      for (const { s, g } of this.casting.splice(0)) {
        try { g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04); s.stop(this.ctx.currentTime + 0.2); } catch (e) { /* not started yet */ }
      }
    }

    // The boss's ability (by its name, as the fight's timeline shows it): 'cast' as the cast starts, 'use' as it goes off.
    boss(fight, name, phase) {
      // cactbot's names can carry a note and a count ("Let's Dance! (Cleave) 3"); the ability is the name before them.
      const b = this.bosses[fight], s = b && (b[name] || b[name.replace(/\s*\([^)]*\)/g, '').replace(/\s+\d+$/, '').trim()]);
      return this.game(s && s[phase], 0.85);
    }

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
        case 'ruin': this.tone('sine', 720, 360, 0.35, 0.16); this.noise('bandpass', 1800, 2, 0.25, 0.14); break;
        case 'wind': this.noise('bandpass', 1400, 0.8, 0.35, 0.28); this.noise('highpass', 4000, 1, 0.2, 0.1, 0.05); break;
        case 'wyrm': this.tone('sawtooth', 180, 90, 0.5, 0.1); this.noise('lowpass', 800, 1, 0.5, 0.28); break;
        case 'akhmorn': this.noise('lowpass', 600, 1, 1.2, 0.7); this.tone('sawtooth', 80, 30, 1.0, 0.28); this.tone('sine', 1200, 300, 0.8, 0.1); break;
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
        // Gunbreaker: a swish, and a gunshot crack and thump when a cartridge fires.
        case 'gnbSlash': case 'gnbSlash2': case 'gnbFang': case 'gnbFang2': case 'gnbFang3':
          this.noise('bandpass', 3600, 1.1, 0.15, 0.32); this.tone('sawtooth', 820, 260, 0.12, 0.04);
          if (kind !== 'gnbSlash' && kind !== 'gnbSlash2') { this.noise('highpass', 2500, 0.8, 0.08, 0.45, 0.05); this.tone('sine', 140, 50, 0.25, 0.35, 0.05); }
          break;
        case 'gnbBarrel': case 'gnbShot': case 'gnbCont': case 'gnbBurst':
          this.noise('highpass', 2000, 0.8, 0.09, 0.55); this.tone('sine', 150, 45, 0.3, 0.4);
          if (kind === 'gnbBurst') this.noise('lowpass', 900, 1, 0.5, 0.4, 0.04);
          break;
        case 'gnbSonic': case 'gnbZone': case 'gnbBow': case 'gnbDouble':
          this.noise('highpass', 1800, 0.8, 0.1, 0.6); this.noise('lowpass', 800, 0.8, 0.7, 0.55, 0.05);
          this.tone('sine', 90, 30, 0.7, 0.5, 0.03);
          if (kind === 'gnbDouble') { this.noise('highpass', 2200, 0.8, 0.1, 0.6, 0.14); this.tone('sine', 80, 30, 0.6, 0.45, 0.16); }
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
        // Something of the fight's landed on you.
        case 'hurt': this.noise('lowpass', 1200, 0.8, 0.25, 0.35); this.tone('sine', 140, 60, 0.25, 0.25); break;
      }
    }
  }

  // The fight's music (work/music/<key>.js: its parts with the game's loop points; win.js the victory fanfare), on
  // the sound's AudioContext with its own volume. One part loops on its loop; a track in parts (M5S's dance floor)
  // plays each to its loop's end and then the next, round again from the first part's loop.
  class Music {
    constructor(sfx) { this.sfx = sfx; this.vol = 0.35; this.tracks = {}; this.key = null; this.run = 0; this.srcs = []; }

    drain() { for (const d of (B.MUSIC_IN || []).splice(0)) this.tracks[d.key] = d.parts; }

    async load(key) {
      this.drain();
      if (!this.tracks[key]) { await B.loadAsset(`music/${key}.js`); this.drain(); }
      return this.tracks[key] || null;
    }

    out() {
      if (!this.sfx.ensure()) return null;
      const c = this.sfx.ctx;
      if (!this.gain) { this.gain = c.createGain(); this.gain.connect(c.destination); }
      return c;
    }

    setVolume(v) {
      this.vol = v;
      if (this.gain) this.gain.gain.setTargetAtTime(v * 0.7, this.sfx.ctx.currentTime, 0.05);
      if (v <= 0) this.stop();
      else if (this.key && !this.srcs.length) this.play(this.key, this.mode === 'win');
    }

    stop() {
      this.run++;
      clearTimeout(this.timer);
      for (const s of this.srcs.splice(0)) { try { s.stop(); } catch (e) { /* not started */ } }
    }

    // The map's music from its start (or, win, the fanfare).
    async play(key, win) {
      this.key = key; this.mode = win ? 'win' : 'bgm';
      this.stop();
      const run = this.run;
      if (!key || this.vol <= 0) return;
      const parts = await this.load(win ? 'win' : key);
      const c = this.out();
      if (!parts || !c || run !== this.run) return;
      this.gain.gain.cancelScheduledValues(c.currentTime);
      this.gain.gain.setValueAtTime(this.vol * 0.7, c.currentTime);
      this.chain(parts, 0, c.currentTime + 0.05, 0, run);
    }

    keep(s) {                                // every source started or queued, so stop() gets them all
      this.srcs.push(s);
      s.onended = () => { const i = this.srcs.indexOf(s); if (i >= 0) this.srcs.splice(i, 1); };
    }

    async part(p) {
      if (!p.buf) p.buf = this.sfx.ctx.decodeAudioData(bytes(p.src)).catch(() => null);
      return p.buf;
    }

    async chain(parts, k, when, offset, run) {
      const c = this.sfx.ctx, p = parts[k], buf = await this.part(p);
      if (!buf || run !== this.run) return;
      const s = c.createBufferSource();
      s.buffer = buf;
      s.connect(this.gain);
      const at = Math.max(when, c.currentTime);
      if (parts.length === 1) {                // one track: round its loop, or the whole of it
        s.loop = true;
        if (p.loop) { s.loopStart = p.loop[0]; s.loopEnd = Math.min(p.loop[1], buf.duration); }
        s.start(at, offset);
        this.keep(s);
        return;
      }
      const end = at + (p.loop ? Math.min(p.loop[1], buf.duration) : buf.duration) - offset;
      s.start(at, offset);
      s.stop(end);
      this.keep(s);
      const n = (k + 1) % parts.length;
      if (parts.length > 2) parts.forEach((q, i) => { if (i !== k && i !== n) q.buf = null; });   // two decoded at a time
      this.part(parts[n]);                     // decode the next one ahead
      this.timer = setTimeout(() => this.chain(parts, n, end, n === 0 && parts[0].loop ? parts[0].loop[0] : 0, run),
        Math.max(0, (end - c.currentTime - 4) * 1000));
    }

    // The boss is down: the music fades and the fanfare plays.
    win() {
      if (!this.key || this.vol <= 0 || !this.gain) return;
      const c = this.sfx.ctx;
      this.gain.gain.setTargetAtTime(0, c.currentTime, 0.4);
      const key = this.key;
      setTimeout(() => { if (this.key === key) this.play(key, true); }, 1500);
    }
  }

  B.Sfx = Sfx;
  B.Music = Music;
})(window.BLM);

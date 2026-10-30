// The debug log: a plain-text report of what the sim is doing, to copy and paste into a chat with Claude (or a bug
// report). Settings → Copy debug log, or /debug in chat. It has the build and browser, the job and its settings,
// what's loaded (icons, models, map), where you are and what's going on right now (MP, gauge, casts, statuses,
// cooldowns, the pull), the last pulls, the last ~80 events (actions, hits, errors, status changes) and any script
// errors. Errors are caught from the moment this file loads, so it goes in early.
(function (B) {
  const MAX_EVENTS = 80, MAX_ERRORS = 25;
  const errors = [];
  const loadedAt = Date.now();

  const clock = () => new Date().toTimeString().slice(0, 8);
  const keepError = (kind, msg) => {
    errors.push(`${clock()} ${kind}: ${String(msg).slice(0, 400)}`);
    if (errors.length > MAX_ERRORS) errors.shift();
  };
  // In a page only: the command-line simulator (tools/xivsim.js) loads this file too.
  if (typeof window.addEventListener === 'function') {
    const stack = (x, n) => x.stack.split('\n').slice(0, n).join(' | ');
    window.addEventListener('error', (ev) => keepError('error', ev.error && ev.error.stack ? stack(ev.error, 3) : `${ev.message} (${ev.filename}:${ev.lineno})`));
    window.addEventListener('unhandledrejection', (ev) => keepError('promise', ev.reason && ev.reason.stack ? stack(ev.reason, 3) : ev.reason));
    for (const level of ['error', 'warn']) {
      const orig = console[level].bind(console);
      console[level] = (...args) => {
        keepError(`console.${level}`, args.map(a => (a && a.stack ? stack(a, 2) : typeof a === 'object' ? safeJson(a, 200) : String(a))).join(' '));
        orig(...args);
      };
    }
  }

  function safeJson(v, max) {
    let s;
    try { s = JSON.stringify(v, (k, x) => (typeof x === 'number' ? Math.round(x * 100) / 100 : x)); } catch (e) { s = String(v); }
    return s && s.length > max ? s.slice(0, max) + '…' : s;
  }
  const n0 = (x) => Math.round(x).toLocaleString('en-US');
  const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
  const name = (id) => (B.ACTIONS[id] && B.ACTIONS[id].name) || id;
  const sname = (k) => (B.STATUSES[k] && B.STATUSES[k].name) || k;

  class DebugLog {
    constructor(app) {
      this.app = app;
      this.events = [];
      this.frames = [];
      const e = app.engine;
      const add = (s) => { this.events.push(`t=${e.now.toFixed(2).padStart(7)}  ${s}`); if (this.events.length > MAX_EVENTS) this.events.shift(); };
      this.add = add;
      e.on('use', d => add(`use ${name(d.id)}${d.gcd ? (d.cast ? ` (cast ${d.cast.toFixed(2)}s)` : ' (GCD)') : ''}`));
      e.on('hit', d => { if (!d.dot && !d.auto && !d.extra) add(`hit ${name(d.id)} ${n0(d.amount)}${d.crit ? ' crit' : ''}${d.dh ? ' DH' : ''}${d.positional ? ` (positional ${d.positional})` : ''}`); });
      e.on('error', d => add(`refused ${name(d.id)}: ${d.msg}`));
      e.on('interrupt', d => add(`interrupted ${name(d.id)}${d.reason ? ': ' + d.reason : ''}`));
      e.on('statusGain', d => { if (d.self) add(`+ ${sname(d.key)}`); });
      e.on('statusLose', d => { if (d.self) add(`- ${sname(d.key)}`); });
      e.on('reset', () => add('reset'));
    }

    frame(dt) {
      if (dt > 0) { this.frames.push(dt); if (this.frames.length > 300) this.frames.shift(); }
    }

    // ---------- the report ----------
    text() {
      const app = this.app, e = app.engine, st = app.store.settings, job = B.job, L = [];
      L.push('=== Striking Dummy Sim debug log ===');
      L.push(`Sim ${B.SIM_VERSION || '?'} · ${where()} · ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC · open ${mins((Date.now() - loadedAt) / 1000)}`);
      L.push(`Browser: ${browser()} · window ${innerWidth}×${innerHeight} @${devicePixelRatio}x · ${gpu()} · ${this.fps()}`);

      // The job and its settings.
      const def = job.def || {};
      L.push(`Job: ${def.name} (${job.abbr}) · ${job.versionLabel} [${job.id}:${job.version}] · level ${e.level}`);
      const s = e.stats;
      L.push(`Stats: main ${s.main} · WD ${s.wd} · det ${s.det} · crit ${s.crit} · DH ${s.dh} · speed ${s.speed} (GCD ${e.gcdForSpeed(s.speed).toFixed(2)})${job.speedInfo ? ' · ' + job.speedInfo(e) : ''}`);
      L.push(`Ping ${st.ping} ms · NoClippy ${st.latencyComp ? 'on' : 'off'} · dummies ${e.targets} · pull length ${st.pullLength ? st.pullLength + 's' : 'until you stop'}`);
      const changed = Object.keys(B.DEFAULT_SETTINGS).filter(k => !['name', 'versions', 'speed', 'job'].includes(k) && JSON.stringify(st[k]) !== JSON.stringify(B.DEFAULT_SETTINGS[k]));
      L.push(`Settings changed from default: ${changed.length ? changed.map(k => `${k}=${safeJson(st[k], 40)}`).join(', ') : 'none'}`);
      const bars = app.store.barsByJob[app.jobKey()];
      const filled = bars ? bars.flat().filter(Boolean).length : 0;
      L.push(`Hotbars: ${bars ? `${filled} slots filled` : 'defaults (not saved yet)'} · keybinds ${JSON.stringify(app.store.binds) === JSON.stringify(B.DEFAULT_BINDS) ? 'default' : 'customised'}`);

      // What's loaded.
      const G = B.GAME_MODELS, M = B.GAME_MAP, map = app.map, models = app.models;
      L.push(`Loaded: three.js ${window.THREE ? 'r' + THREE.REVISION : 'no'} · icons ${B.GAME_ICONS ? Object.keys(B.GAME_ICONS).length : 'no'} · models ${G ? `yes (${Object.keys(G.jobs || {}).length} characters, ${models && models.active() ? 'on' : 'off'}${models && models.ch ? '' : ', none for this job'})` : 'no'}`
        + ` · map ${M ? `${M.name} (${map && map.active() ? 'on' : map && map.ok ? (map.ready ? 'off' : 'loading') : 'failed'}${map && map.world ? `, ${n0(map.world.t.length / 9)} collision triangles` : ''})` : 'no'}`);
      if (map && map.renderer && map.active()) {
        const r = map.renderer.info.render;
        L.push(`Map render: ${n0(r.calls)} draw calls, ${n0(r.triangles)} triangles`);
      }

      // Right now.
      L.push('');
      L.push(`-- Now (t=${e.now.toFixed(2)}s) --`);
      const p = e.pos;
      L.push(`Position x ${f1(p.x)} y ${f1(p.y || 0)} z ${f1(p.z)} · ${f1(e.distToTarget())}y from the dummy (${e.side()}) · ${e.moving ? 'moving' : 'standing'}${e.world && e.world.vy ? ' · falling' : ''} · camera yaw ${f1(app.scene.camYaw * 180 / Math.PI)}° pitch ${f1(app.scene.camPitch * 180 / Math.PI)}° zoom ${app.scene.camZoom.toFixed(2)}`);
      L.push(`HP ${n0(e.hp)}/${n0(e.maxHp)} · MP ${n0(e.mp)}/${n0(e.maxMp)}${e.usesTp ? ` · TP ${n0(e.tp)}` : ''} · ${e.inCombat ? 'in combat' : 'out of combat'}`);
      const gcdLeft = Math.max(0, e.gcdEnd - e.now), lockLeft = Math.max(0, e.lockUntil - e.now);
      L.push(`GCD ${gcdLeft ? `${gcdLeft.toFixed(2)}s left of ${e.gcdLen.toFixed(2)}` : 'ready'} · lock ${lockLeft ? lockLeft.toFixed(2) + 's' : 'none'}`
        + ` · casting ${e.casting ? `${name(e.casting.id)} (${(e.now - e.casting.start).toFixed(2)}/${(e.casting.end - e.casting.start).toFixed(2)}s)` : 'nothing'}`
        + ` · queued ${e.queue.length ? e.queuedIds().map(name).join(', ') : 'nothing'} · combo ${e.combo && e.combo.until > e.now ? `after ${name(e.combo.id)}` : 'none'}`);
      L.push(`Gauge: ${safeJson(e.g, 600)}`);
      const stat = (o) => Object.entries(o).filter(([, v]) => v && v.until > e.now).map(([k, v]) => `${sname(k)} ${v.until > 1e8 ? '∞' : f1(v.until - e.now) + 's'}${v.stacks > 1 ? ' ×' + v.stacks : ''}`).join(', ') || 'none';
      L.push(`Your statuses: ${stat(e.statuses)}`);
      L.push(`Dummy's statuses: ${stat(e.tStatuses)}`);
      const cds = Object.entries(e.cds).filter(([, c]) => c.charges < c.max && c.nextAt !== null)
        .map(([k, c]) => `${name(k)} ${f1(Math.max(0, c.nextAt - e.now))}s${c.max > 1 ? ` (${c.charges}/${c.max})` : ''}`);
      L.push(`On cooldown: ${cds.join(', ') || 'nothing'}`);
      if (app.enc) {
        const enc = app.enc, dur = enc.duration(e.now);
        L.push(`Pull ${enc.n}: ${mins(dur)} · ${n0(enc.total / dur)} DPS · ${enc.hits} hits · ${enc.uses.length} actions`);
      } else L.push('Pull: none going');

      // The last pulls.
      const hist = app.history.slice(-3);
      if (hist.length) {
        L.push('');
        L.push('-- Last pulls --');
        for (const enc of hist) {
          const dur = enc.duration();
          const top = Object.entries(enc.byAction).sort((a, b) => b[1].total - a[1].total).slice(0, 4)
            .map(([id, r]) => `${(enc.actions[id] && enc.actions[id].name) || id} ${Math.round(r.total / enc.total * 100)}%`).join(', ');
          L.push(`Pull ${enc.n} · ${enc.job} · ${n0(enc.total / dur)} DPS over ${mins(dur)} · crit ${Math.round(enc.crits / Math.max(1, enc.hits) * 100)}% DH ${Math.round(enc.dhs / Math.max(1, enc.hits) * 100)}% · ${top}`);
        }
      }

      L.push('');
      L.push(`-- Last ${this.events.length} events (newest last; DoT ticks and auto-attacks left out) --`);
      L.push(...(this.events.length ? this.events : ['none yet']));
      L.push('');
      L.push(`-- Script errors (${errors.length}) --`);
      L.push(...(errors.length ? errors : ['none']));
      L.push('=== end of debug log ===');
      return L.join('\n');
    }

    fps() {
      const f = this.frames;
      if (f.length < 10) return 'fps: not measured yet';
      const avg = f.reduce((a, b) => a + b, 0) / f.length;
      const worst = f.slice().sort((a, b) => b - a)[Math.floor(f.length / 100)];
      return `${(1 / avg).toFixed(0)} fps (slowest 1% of frames ${(worst * 1000).toFixed(0)} ms)`;
    }

    // Copy it, and show it in a window as well (selected, for Ctrl+C where the page may not use the clipboard).
    copy() {
      const text = this.text();
      const box = document.getElementById('debug-text'), msg = document.getElementById('debug-msg');
      box.value = text;
      this.app.ui.openWindow('win-debug');
      box.focus(); box.select();
      const done = (ok) => { msg.textContent = ok ? 'Copied. Paste it into your chat with Claude.' : 'Select all (Ctrl+A) and copy (Ctrl+C), then paste it into your chat with Claude.'; };
      try {
        navigator.clipboard.writeText(text).then(() => done(true), () => done(document.execCommand && document.execCommand('copy')));
      } catch (err) { done(false); }
      return text;
    }
  }

  function mins(sec) { return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`; }
  function where() {
    const h = location.hostname;
    if (location.protocol === 'file:') return 'the downloaded file';
    if (/workers\.dev$|pages\.dev$/.test(h)) return `the website (${h})`;
    if (/claude|usercontent/.test(h)) return 'the claude.ai artifact';
    if (h === 'localhost' || h === '127.0.0.1') return `local preview (${location.host})`;
    return h || 'unknown';
  }
  function browser() {
    const ua = navigator.userAgent;
    const m = ua.match(/(Edg|OPR|Firefox|Chrome|Version)\/(\d+)/);
    const b = m ? ({ Edg: 'Edge', OPR: 'Opera', Version: 'Safari' }[m[1]] || m[1]) + ' ' + m[2] : ua.slice(0, 60);
    const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : '?';
    return `${b} on ${os}`;
  }
  function gpu() {
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      if (!gl) return 'no WebGL';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return 'GPU ' + (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).replace(/\s+/g, ' ').slice(0, 90);
    } catch (err) { return 'GPU ?'; }
  }

  B.DebugLog = DebugLog;
})(window.BLM);

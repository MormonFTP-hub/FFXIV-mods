// Dummy Sim Lab's page: the setup column (job, stats, fight, party, action list), the run (spread over Web Workers
// when the browser allows, otherwise in slices on the page) and the two views, a job's report and every job ranked.
// The simulator itself is js/sim/sim.js; the report's sections are js/sim/report.js.
(function (B) {
  const PAGE_SCRIPT = document.currentScript;
  const R = () => B.SimReport;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- saved settings (this browser only) ----------
  const KEY = 'dummySimLab.v1';
  const DEFAULTS = {
    tab: 'sim', job: 'sam', stats: {}, apl: {},
    fight: { style: 'patchwerk', duration: 300, variance: 10, targets: 1, iterations: 1000, ping: 50, latencyComp: false, positionals: 100, moveEvery: 30, moveFor: 3 },
    partyPreset: 'standard', party: B.PARTY_PRESETS.standard.slice(), weights: false, sets: '',
    rank: { iterations: 300, duration: 300, partyPreset: 'standard', targets: 1 },
    search: { time: 120, width: '1024' },
  };
  let state;
  try { state = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { state = null; }
  state = Object.assign({}, DEFAULTS, state || {});
  state.fight = Object.assign({}, DEFAULTS.fight, state.fight || {});
  state.rank = Object.assign({}, DEFAULTS.rank, state.rank || {});
  state.search = Object.assign({}, DEFAULTS.search, state.search || {});
  if (!B.SIM_JOBS.includes(state.job)) state.job = DEFAULTS.job;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private window */ } };

  const ROLES = [['tank', 'Tanks'], ['healer', 'Healers'], ['melee', 'Melee'], ['ranged', 'Physical ranged'], ['caster', 'Casters']];
  const roleClass = (id) => (B.ROLE_OF[id] === 'tank' ? 'tank' : B.ROLE_OF[id] === 'healer' ? 'healer' : 'dps');
  const MAIN_NAME = { str: 'Strength', dex: 'Dexterity', int: 'Intelligence', mnd: 'Mind' };

  // Facts about a job's live version for the setup column: its default stats and names.
  function jobInfo(id) {
    const v = B.liveVersion(id);
    const job = B.setJob(id, v.id);
    const st = job.stats;
    const caster = B.isCaster(job);
    return {
      id, v, job, stats: st, name: job.name, abbr: job.def.abbr,
      mainName: MAIN_NAME[st.mainStat] || (caster ? (job.role === 'healer' ? 'Mind' : 'Intelligence') : 'Strength'),
      speedName: job.speedName || (caster ? 'Spell speed' : 'Skill speed'),
      speedAbbr: (job.speedName || (caster ? 'Spell speed' : 'Skill speed')).startsWith('Spell') ? 'SPS' : 'SKS',
      tank: job.role === 'tank', melee: B.ROLE_OF[id] === 'melee',
      actions: job.actions, statuses: Object.assign({}, B.STATUSES),
    };
  }

  // ---------- the skeleton ----------
  const app = $('#app');
  app.innerHTML = `
<header class="top">
  <div class="brand"><span class="mark" aria-hidden="true"></span><div><h1>Dummy Sim Lab</h1>
    <p class="tagline">Thousands of pulls on a striking dummy, at live patch <b>${esc(B.SIM_PATCH)}</b>, with the game's own numbers.</p></div></div>
  <nav class="tabs" role="tablist" aria-label="View">
    <button id="tab-sim" role="tab" data-tab="sim">One job</button>
    <button id="tab-search" role="tab" data-tab="search">Best rotation</button>
    <button id="tab-rank" role="tab" data-tab="rank">Every job</button>
  </nav>
</header>
<main class="bench">
  <aside class="setup" aria-label="Setup">
    <div id="pane-sim">
      <section class="block"><h2>Job</h2><div id="jobs" class="jobs"></div><p id="jobnote" class="muted small"></p></section>
      <section class="block"><h2>Gear</h2>
        <p class="muted small">Your character sheet's numbers, in a full party (the 5% party bonus included). The defaults are The Balance's 7.4 savage set for the job.</p>
        <div id="stats" class="fields"></div>
        <div class="row"><span id="gcd" class="readout"></span><button id="bis" class="ghost" type="button">Reset to best in slot</button></div>
      </section>
      <section class="block"><h2>Fight</h2>
        <div class="fields">
          <label class="wide">Style<select id="f-style"><option value="patchwerk">Patchwerk: stand still and hit</option><option value="movement">Movement: no casting for a while every so often</option></select></label>
          <label class="simonly">Length (s)<input id="f-duration" type="number" min="30" max="1800" step="10"></label>
          <label class="simonly">Length ± %<input id="f-variance" type="number" min="0" max="50" step="1"></label>
          <label>Targets<input id="f-targets" type="number" min="1" max="5" step="1"></label>
          <label class="simonly">Iterations<input id="f-iterations" type="number" min="10" max="50000" step="100"></label>
          <label>Ping (ms)<input id="f-ping" type="number" min="0" max="500" step="5"></label>
          <label id="lab-pos">Positionals hit %<input id="f-positionals" type="number" min="0" max="100" step="5"></label>
          <label class="mv">Move every (s)<input id="f-moveEvery" type="number" min="5" max="300" step="1"></label>
          <label class="mv">Moving for (s)<input id="f-moveFor" type="number" min="0.5" max="30" step="0.5"></label>
          <label class="check wide"><input id="f-latencyComp" type="checkbox"> Latency compensation (NoClippy or XivAlexander: ping no longer adds to animation locks)</label>
        </div>
      </section>
      <section class="block"><h2>Party</h2>
        <label class="wide">Raid buffs<select id="p-preset"><option value="none">Solo dummy: no raid buffs</option><option value="standard">Standard party (DRG, MNK, NIN, BRD, SMN, AST, SCH)</option><option value="all">Every raid buff in the game</option><option value="custom">Pick them below</option></select></label>
        <div id="buffs" class="buffs"></div>
        <p class="muted small">Each buff lands where its job's opener puts it and again every two minutes; your own job's buff comes from your rotation, not from here.</p>
      </section>
      <section class="block simonly"><h2>Extras</h2>
        <label class="check"><input id="o-weights" type="checkbox"> Stat weights (one more run per stat)</label>
        <details id="sets-box"><summary>Profile sets: compare gear changes</summary>
          <p class="muted small">One set per line. <code>+</code> or <code>−</code> changes a stat, a plain number sets it. Stats: main, wd, crt, det, dh, sks (or sps), ten.</p>
          <textarea id="o-sets" rows="4" spellcheck="false" placeholder="Crit meld swap: crt=+216 det=-216&#10;Faster GCD: sks=+540 crt=-540"></textarea>
        </details>
      </section>
      <section class="block"><h2>Action list</h2>
        <p class="muted small">The rotation as a SimulationCraft-style priority list: the first line whose action is ready and whose <code>if=</code> holds goes next.</p>
        <textarea id="apl" rows="16" spellcheck="false" aria-label="Action priority list"></textarea>
        <div class="row"><span id="apl-state" class="muted small"></span><button id="apl-reset" class="ghost" type="button">Restore the default list</button></div>
        <details><summary>Names you can use in conditions</summary><div class="scroll"><table class="tbl help" id="help"></table></div></details>
        <details><summary>This job's actions and statuses</summary><div id="ids" class="ids"></div></details>
      </section>
      <section class="block searchonly"><h2>Search</h2>
        <p class="muted small">Every GCD order can't be tried past a few GCDs (a minute is already billions), so it tries every order for the first few, then a beam: at each GCD every GCD that could go, each judged by playing the rest of the fight out, keeping the best lines. The beam is widened 4× at a time until a wider one finds nothing more. It can't do worse than the action list, which still picks the abilities between GCDs.</p>
        <div class="fields">
          <label>Time limit (s)<input id="q-time" type="number" min="10" max="900" step="10"></label>
          <label>How hard to look<select id="q-width"><option value="1024">Until it settles (up to 1,024 lines)</option><option value="256">Until it settles, up to 256 lines</option><option value="16">Quick: 16 lines</option><option value="exact">Every order (a few GCDs only)</option></select></label>
        </div>
      </section>
      <div class="runbar simonly"><button id="run" class="primary" type="button">Simulate</button><button id="stop" class="ghost" type="button" hidden>Stop</button>
        <div class="prog" id="prog" hidden><div class="pbar"><i id="pfill"></i></div><span id="plabel" class="small"></span></div></div>
      <div class="runbar searchonly"><button id="search-run" class="primary" type="button">Find the best GCD order</button><button id="search-stop" class="ghost" type="button" hidden>Stop</button>
        <div class="prog" id="qprog" hidden><div class="pbar"><i id="qpfill"></i></div><span id="qplabel" class="small"></span></div></div>
    </div>
    <div id="pane-rank" hidden>
      <section class="block"><h2>Every job</h2>
        <p class="muted small">All 21 jobs at their live version, each in its own best-in-slot set with its default action list, on the same fight.</p>
        <div class="fields">
          <label>Iterations each<input id="r-iterations" type="number" min="20" max="5000" step="50"></label>
          <label>Length (s)<input id="r-duration" type="number" min="30" max="1800" step="10"></label>
          <label>Targets<input id="r-targets" type="number" min="1" max="5" step="1"></label>
          <label class="wide">Raid buffs<select id="r-preset"><option value="none">Solo dummy: no raid buffs</option><option value="standard">Standard party</option><option value="all">Every raid buff</option></select></label>
        </div>
      </section>
      <div class="runbar"><button id="rank-run" class="primary" type="button">Simulate every job</button><button id="rank-stop" class="ghost" type="button" hidden>Stop</button>
        <div class="prog" id="rprog" hidden><div class="pbar"><i id="rpfill"></i></div><span id="rplabel" class="small"></span></div></div>
    </div>
  </aside>
  <section class="report" id="report" aria-live="polite"></section>
  <section class="report" id="search-report" aria-live="polite" hidden></section>
  <section class="report" id="rank-report" aria-live="polite" hidden></section>
</main>
<footer class="foot"><p>Built on the <a href="https://striking-dummy.lack-age-im.workers.dev">Striking Dummy Sim</a>'s engine and job modules. Damage formula, GCD and animation-lock rules as in game; party buffs on fixed two-minute windows. A fan project, not affiliated with Square Enix.</p></footer>`;

  // ---------- job picker ----------
  let info = jobInfo(state.job);
  function drawJobs() {
    $('#jobs').innerHTML = ROLES.map(([role, label]) => {
      const ids = B.SIM_JOBS.filter(id => B.ROLE_OF[id] === role && B.JOBS[id]);
      return `<div class="jobgroup"><span class="glabel">${label}</span><div class="chips">${ids.map(id => {
        const d = B.JOBS[id];
        const ok = !!B.SIM_APLS[id];
        return `<button type="button" class="jobchip ${roleClass(id)}${id === state.job ? ' on' : ''}" data-job="${id}" aria-pressed="${id === state.job}" title="${esc(d.name)}${ok ? '' : ' (no action list yet)'}"${ok ? '' : ' disabled'}>${esc(d.abbr)}</button>`;
      }).join('')}</div></div>`;
    }).join('');
    $('#jobnote').textContent = `${info.name}: ${info.v.label}. ${info.v.note || ''}`;
  }
  $('#jobs').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-job]');
    if (!b || b.disabled) return;
    state.job = b.dataset.job;
    save();
    info = jobInfo(state.job);
    drawAll();
  });

  // ---------- stats ----------
  const STAT_KEYS = () => ['main', 'wd', 'crit', 'det', 'dh', 'speed'].concat(info.tank ? ['ten'] : []);
  const statLabel = (k) => ({ main: info.mainName, wd: 'Weapon damage', crit: 'Critical hit', det: 'Determination', dh: 'Direct hit', speed: info.speedName, ten: 'Tenacity' }[k]);
  function myStats() { return Object.assign({}, state.stats[state.job] || {}); }
  function drawStats() {
    const mine = myStats();
    $('#stats').innerHTML = STAT_KEYS().map(k => `<label>${esc(statLabel(k))}<input id="s-${k}" data-stat="${k}" type="number" min="0" max="20000" step="1" value="${mine[k] !== undefined ? mine[k] : info.stats[k]}"${mine[k] !== undefined && mine[k] !== info.stats[k] ? ' class="changed"' : ''}></label>`).join('');
    drawGcd();
  }
  function drawGcd() {
    try {
      const g = B.Sim.gcdFor({ job: state.job, stats: myStats() });
      $('#gcd').innerHTML = `Base GCD <b>${g.toFixed(2)}</b>`;
    } catch (e) { $('#gcd').textContent = ''; }
  }
  $('#stats').addEventListener('input', (ev) => {
    const k = ev.target.dataset.stat;
    if (!k) return;
    const v = ev.target.value === '' ? undefined : Math.max(0, Math.round(+ev.target.value));
    const mine = myStats();
    if (v === undefined || v === info.stats[k]) delete mine[k]; else mine[k] = v;
    state.stats[state.job] = mine;
    ev.target.classList.toggle('changed', mine[k] !== undefined);
    save();
    drawGcd();
  });
  $('#bis').addEventListener('click', () => { delete state.stats[state.job]; save(); drawStats(); });

  // ---------- fight, party, extras ----------
  const F = ['style', 'duration', 'variance', 'targets', 'iterations', 'ping', 'positionals', 'moveEvery', 'moveFor', 'latencyComp'];
  function drawFight() {
    for (const k of F) {
      const el = $('#f-' + k);
      if (el.type === 'checkbox') el.checked = !!state.fight[k]; else el.value = state.fight[k];
    }
    $$('.mv').forEach(el => { el.hidden = state.fight.style !== 'movement'; });
    $('#lab-pos').hidden = !info.melee;
  }
  for (const k of F) {
    $('#f-' + k).addEventListener('input', (ev) => {
      const el = ev.target;
      state.fight[k] = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' ? el.value : +el.value;
      save();
      if (k === 'style') drawFight();
    });
  }
  function drawParty() {
    $('#p-preset').value = state.partyPreset;
    $('#buffs').innerHTML = B.RAID_BUFFS.map(b => {
      const own = b.job === state.job;
      const on = state.party.includes(b.id) && !own;
      return `<label class="check${b.single ? ' single' : ''}${own ? ' own' : ''}"><input type="checkbox" data-buff="${b.id}"${on ? ' checked' : ''}${own ? ' disabled' : ''}>
        <span>${esc(b.name)} <span class="muted">${esc(B.JOBS[b.job] ? B.JOBS[b.job].abbr : '')}${b.mult ? ` +${Math.round((b.mult - 1) * 100)}%` : ''}${b.crit ? ` +${Math.round(b.crit * 100)}% crit` : ''}${b.dh ? ` +${Math.round(b.dh * 100)}% DH` : ''}${own ? ' · yours' : ''}</span></span></label>`;
    }).join('');
  }
  $('#p-preset').addEventListener('change', (ev) => {
    state.partyPreset = ev.target.value;
    if (B.PARTY_PRESETS[state.partyPreset]) state.party = B.PARTY_PRESETS[state.partyPreset].slice();
    save(); drawParty();
  });
  $('#buffs').addEventListener('change', (ev) => {
    const id = ev.target.dataset.buff;
    if (!id) return;
    state.party = state.party.filter(x => x !== id);
    if (ev.target.checked) state.party.push(id);
    state.partyPreset = 'custom';
    $('#p-preset').value = 'custom';
    save();
  });
  $('#o-weights').addEventListener('change', (ev) => { state.weights = ev.target.checked; save(); });
  $('#o-sets').addEventListener('input', (ev) => { state.sets = ev.target.value; save(); });

  // ---------- action list ----------
  const defaultApl = () => (B.SIM_APLS[state.job] || '').replace(/^\n/, '');
  function drawApl() {
    const custom = state.apl[state.job];
    $('#apl').value = custom !== undefined && custom !== null ? custom : defaultApl();
    aplState();
    $('#ids').innerHTML = `<h3>Actions</h3><p class="mono small">${Object.entries(info.actions).filter(([, a]) => a && a.kind && a.kind !== 'auto').map(([id, a]) => `<span title="${esc(a.name)}">${esc(id)}</span>`).join(' ')}</p>
      <h3>Statuses</h3><p class="mono small">${Object.entries(info.statuses).map(([id, s]) => `<span title="${esc(s.name)}">${esc(id)}</span>`).join(' ')}</p>
      <h3>Gauge</h3><p class="mono small">${esc(gaugeKeys().join(' '))}</p>`;
  }
  function gaugeKeys() {
    try { return Object.keys(new B.SimEngine({ ping: 0, speed: {} }, B.setJob(state.job, info.v.id)).g || {}); } catch (e) { return []; }
  }
  function aplState() {
    const custom = state.apl[state.job] !== undefined && state.apl[state.job] !== null;
    let msg = custom ? 'Edited: your own list for this job, saved in this browser.' : 'The default list.';
    try {
      const parsed = B.SimAPL.parse($('#apl').value);
      const c = B.SimAPL.compile(parsed, info.job, info.actions);
      if (c.warnings.length) msg += ` ${c.warnings.length} problem${c.warnings.length > 1 ? 's' : ''}: ${c.warnings.slice(0, 3).join('; ')}${c.warnings.length > 3 ? '…' : ''}`;
      $('#apl-state').classList.toggle('bad', c.warnings.length > 0);
    } catch (e) { msg += ' ' + e.message; }
    $('#apl-state').textContent = msg;
  }
  $('#apl').addEventListener('input', (ev) => {
    const v = ev.target.value;
    if (v.trim() === defaultApl().trim()) delete state.apl[state.job]; else state.apl[state.job] = v;
    save(); aplState();
  });
  $('#apl-reset').addEventListener('click', () => { delete state.apl[state.job]; save(); drawApl(); });
  $('#help').innerHTML = '<tbody>' + B.SimAPL.HELP.map(([n, d]) => `<tr><th scope="row"><code>${esc(n)}</code></th><td>${esc(d)}</td></tr>`).join('') + '</tbody>';

  function drawAll() {
    drawJobs(); drawStats(); drawFight(); drawParty(); drawApl();
    $('#o-weights').checked = !!state.weights;
    $('#o-sets').value = state.sets || '';
    if (state.sets) $('#sets-box').open = true;
  }

  // ---------- tabs ----------
  function showTab(tab) {
    state.tab = tab; save();
    $$('.tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    $('#pane-sim').hidden = tab !== 'sim' && tab !== 'search';
    $$('.simonly').forEach(el => { el.hidden = tab !== 'sim'; });
    $$('.searchonly').forEach(el => { el.hidden = tab !== 'search'; });
    $('#report').hidden = tab !== 'sim';
    $('#search-report').hidden = tab !== 'search';
    $('#pane-rank').hidden = tab !== 'rank';
    $('#rank-report').hidden = tab !== 'rank';
    if (tab === 'rank' && !rankDone && !busy) runRank();
  }
  $$('.tabs [role=tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

  // ---------- workers ----------
  // Each worker gets the same scripts this page loaded before page.js (engine, jobs, simulator, action lists),
  // as a blob; a page opened from disk can't do that, so it runs everything here in slices instead.
  const Pool = {
    workers: null, failed: /[?&]workers=0(&|$)/.test(location.search), url: null,     // ?workers=0: everything on the page
    size() { return Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1)); },
    make() {
      if (this.workers || this.failed) return !!this.workers;
      try {
        if (!this.url) {
          const scripts = Array.from(document.scripts);
          const upto = scripts.indexOf(PAGE_SCRIPT);
          let code = 'self.window = self;\n';
          for (const s of scripts.slice(0, upto < 0 ? scripts.length : upto)) {
            if (s.src) code += `try { importScripts(${JSON.stringify(s.src)}); } catch (e) {}\n`;     // a file the page couldn't load either
            else if (!s.type || /javascript/.test(s.type)) code += s.textContent + '\n;\n';
          }
          code += `self.onmessage = function (ev) {
  var m = ev.data;
  try { postMessage({ id: m.id, out: m.items ? BLM.Sim.rollouts(m.cfg, m.items) : BLM.Sim.runRange(m.cfg, m.from, m.to, m.stats, m.seq) }); }
  catch (err) { postMessage({ id: m.id, error: String((err && err.stack) || err) }); }
};`;
          this.url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
        }
        this.workers = Array.from({ length: this.size() }, () => new Worker(this.url));
        return true;
      } catch (e) { this.failed = true; this.workers = null; return false; }
    },
    kill() { if (this.workers) this.workers.forEach(w => w.terminate()); this.workers = null; },
  };

  let cancelled = false, busy = false;
  // tasks: [{ cfg, from, to, stats, seq }] → aggregates in task order. onDone(iterations finished so far).
  async function execute(tasks, onDone) {
    if (Pool.make()) {
      try { return await viaWorkers(tasks, onDone); }
      catch (e) {
        if (cancelled) throw e;
        console.warn('Workers unavailable, running on the page:', e);
        Pool.kill(); Pool.failed = true;
      }
    }
    return onPage(tasks, onDone);
  }
  function viaWorkers(tasks, onDone) {
    return new Promise((resolve, reject) => {
      const out = new Array(tasks.length);
      let next = 0, finished = 0, iters = 0, dead = false;
      const fail = (err) => { if (dead) return; dead = true; reject(err); };
      const feed = (w) => {
        if (dead) return;
        if (cancelled) { fail(new Error('cancelled')); return; }
        if (next >= tasks.length) return;
        const id = next++;
        const t = tasks[id];
        w.onmessage = (ev) => {
          if (ev.data.error) { fail(new Error(ev.data.error)); return; }
          out[ev.data.id] = ev.data.out;
          finished++; iters += t.items ? t.items.length : t.to - t.from;
          onDone(iters);
          if (finished === tasks.length) resolve(out); else feed(w);
        };
        w.onerror = (ev) => { ev.preventDefault(); fail(new Error(ev.message || 'worker error')); };
        w.postMessage(t.items ? { id, cfg: t.cfg, items: t.items } : { id, cfg: t.cfg, from: t.from, to: t.to, stats: t.stats || null, seq: !!t.seq });
      };
      Pool.workers.forEach(feed);
    });
  }
  // A yield that background tabs don't throttle the way they do setTimeout.
  const channel = new MessageChannel();
  const waiting = [];
  channel.port1.onmessage = () => { const r = waiting.shift(); if (r) r(); };
  const yieldNow = () => new Promise(r => { waiting.push(r); channel.port2.postMessage(0); });
  async function onPage(tasks, onDone) {
    const out = [];
    let iters = 0;
    for (const t of tasks) {
      if (t.items) {     // rotation-search rollouts, a few at a time
        const res = [];
        for (let i = 0; i < t.items.length; i += 4) {
          if (cancelled) throw new Error('cancelled');
          res.push(...B.Sim.rollouts(t.cfg, t.items.slice(i, i + 4)));
          iters += Math.min(4, t.items.length - i);
          onDone(iters);
          await yieldNow();
        }
        out.push(res);
        continue;
      }
      const P = B.Sim.prepare(t.cfg);
      const agg = B.Sim.newAgg(!!t.seq);
      let i = t.from;
      while (i < t.to) {
        if (cancelled) throw new Error('cancelled');
        const t0 = performance.now();
        while (i < t.to && performance.now() - t0 < 30) { B.Sim.iterate(P, i++, agg, t.stats || null); iters++; }
        onDone(iters);
        await yieldNow();
      }
      out.push(agg);
    }
    return out;
  }
  // Split n iterations of each variant into slices the pool can share.
  function slices(n, variants) {
    const size = Math.max(10, Math.ceil(n / (Pool.size() * 3)));
    const tasks = [];
    variants.forEach((v, vi) => {
      for (let from = 0; from < n; from += size) tasks.push({ cfg: v.cfg, from, to: Math.min(n, from + size), stats: v.stats, seq: v.seq && from === 0, vi });
    });
    return tasks;
  }
  function group(tasks, aggs, count) {
    const by = Array.from({ length: count }, () => []);
    tasks.forEach((t, i) => by[t.vi].push(aggs[i]));
    return by.map(parts => B.Sim.mergeAggs(parts));
  }

  // ---------- profile sets ----------
  const ALIAS = { main: 'main', str: 'main', dex: 'main', int: 'main', mnd: 'main', wd: 'wd', crt: 'crit', crit: 'crit', det: 'det',
    dh: 'dh', dhit: 'dh', sks: 'speed', sps: 'speed', speed: 'speed', ten: 'ten', tnc: 'ten' };
  function parseSets(text, base) {
    const out = [], errors = [];
    String(text || '').split(/\r?\n/).forEach((line, i) => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      let name = `Set ${out.length + 1}`;
      const c = line.indexOf(':');
      if (c >= 0) { name = line.slice(0, c).trim() || name; line = line.slice(c + 1); }
      const stats = Object.assign({}, base);
      const desc = [];
      for (const tok of line.trim().split(/[\s,]+/).filter(Boolean)) {
        const m = tok.match(/^([a-z]+)=([+\-−]?)(\d+)$/i);
        if (!m || !ALIAS[m[1].toLowerCase()]) { errors.push(`line ${i + 1}: "${tok}" isn't stat=value`); continue; }
        const k = ALIAS[m[1].toLowerCase()];
        const v = +m[3];
        stats[k] = m[2] === '+' ? stats[k] + v : m[2] ? stats[k] - v : v;
        desc.push(`${m[1]} ${m[2] === '+' ? '+' : m[2] ? '−' : '='}${v}`);
      }
      if (desc.length) out.push({ name, stats, desc: desc.join(', ') });
    });
    return { sets: out.slice(0, 8), errors };
  }

  // ---------- running one job ----------
  function currentCfg() {
    const f = state.fight;
    return {
      job: state.job, stats: myStats(), apl: $('#apl').value,
      iterations: Math.max(10, Math.min(50000, Math.round(f.iterations) || 1000)),
      duration: Math.max(30, +f.duration || 300), variance: Math.max(0, Math.min(50, +f.variance || 0)) / 100,
      targets: Math.max(1, Math.min(5, Math.round(f.targets) || 1)), ping: Math.max(0, +f.ping || 0), latencyComp: !!f.latencyComp,
      positionals: info.melee ? Math.max(0, Math.min(100, +f.positionals)) / 100 : 1,
      style: f.style, moveEvery: +f.moveEvery || 30, moveFor: +f.moveFor || 3,
      party: state.party.slice(), weights: !!state.weights, seed: 12345,
    };
  }
  function progress(which, frac, label) {
    $(which === 'rank' ? '#rprog' : '#prog').hidden = frac === null;
    if (frac === null) return;
    $(which === 'rank' ? '#rpfill' : '#pfill').style.width = (frac * 100).toFixed(1) + '%';
    $(which === 'rank' ? '#rplabel' : '#plabel').textContent = label;
  }
  function setBusy(on, which) {
    busy = on;
    $('#run').disabled = on; $('#rank-run').disabled = on;
    $(which === 'rank' ? '#rank-stop' : '#stop').hidden = !on;
    if (!on) { $('#stop').hidden = true; $('#rank-stop').hidden = true; }
  }

  async function runSim() {
    if (busy) return;
    const cfg = currentCfg();
    let base;
    try { base = B.Sim.prepare(cfg); } catch (e) { $('#report').innerHTML = `<div class="notice">${esc(e.message)}</div>`; return; }
    const variants = [{ key: 'base', cfg, stats: null, seq: true }];
    for (const w of B.Sim.weightStats(cfg)) variants.push({ key: 'w', stat: w.stat, cfg, stats: w.stats });
    const ps = parseSets(state.sets, base.stats);
    for (const s of ps.sets) variants.push({ key: 's', set: s, cfg, stats: s.stats });
    const n = cfg.iterations;
    const tasks = slices(n, variants);
    const total = n * variants.length;
    cancelled = false; setBusy(true, 'sim');
    const t0 = performance.now();
    progress('sim', 0, `0 of ${total.toLocaleString()} iterations`);
    try {
      const aggs = group(tasks, await execute(tasks, (k) => progress('sim', k / total, `${k.toLocaleString()} of ${total.toLocaleString()} iterations`)), variants.length);
      const baseAgg = aggs[0];
      const weightRows = variants.map((v, i) => (v.key === 'w' ? B.Sim.weightRow(v.stat, baseAgg.dps, aggs[i].dps) : null)).filter(Boolean);
      const setRows = variants.map((v, i) => {
        if (v.key !== 's') return null;
        const c = B.Sim.compare(baseAgg.dps, aggs[i].dps);
        return { name: v.set.name, desc: v.set.desc, mean: B.Sim.summarize(aggs[i]).mean, delta: c.delta, err: c.err };
      }).filter(Boolean);
      const rep = B.Sim.finish(cfg, baseAgg, weightRows, performance.now() - t0);
      if (ps.errors.length) rep.warnings = rep.warnings.concat(ps.errors.map(e => 'Profile sets, ' + e));
      showReport(rep, setRows);
    } catch (e) {
      if (!cancelled) $('#report').insertAdjacentHTML('afterbegin', `<div class="notice">The run stopped: ${esc(e.message)}</div>`);
    } finally {
      progress('sim', null); setBusy(false);
      if (cancelled) Pool.kill();
    }
  }
  let lastReport = null;
  function showReport(rep, setRows) {
    lastReport = rep;
    const took = (rep.ms / 1000).toFixed(1);
    $('#report').innerHTML = `<div class="reporthead"><p class="muted small">${rep.summary.n.toLocaleString()} iterations in ${took}s${Pool.workers ? ` on ${Pool.workers.length} workers` : ''}.</p>
      <button id="copy" class="ghost" type="button">Copy as text</button></div>` +
      R().render(rep, { speedName: info.speedName, speedAbbr: info.speedAbbr, mainName: info.mainName, sets: setRows });
    $('#copy').addEventListener('click', async (ev) => {
      const txt = R().text(lastReport);
      try { await navigator.clipboard.writeText(txt); ev.target.textContent = 'Copied'; }
      catch (e) {
        const ta = document.createElement('textarea');
        ta.value = txt; ta.rows = 8; ta.className = 'copybox';
        ev.target.replaceWith(ta); ta.select();
      }
    });
  }
  $('#run').addEventListener('click', runSim);
  $('#stop').addEventListener('click', () => { cancelled = true; Pool.kill(); });

  // ---------- the best GCD order ----------
  function drawSearchFields() {
    $('#q-time').value = state.search.time;
    if (!['1024', '256', '16', 'exact'].includes(String(state.search.width))) state.search.width = '1024';
    $('#q-width').value = String(state.search.width);
  }
  $('#q-time').addEventListener('input', (ev) => { state.search.time = +ev.target.value; save(); });
  $('#q-width').addEventListener('change', (ev) => { state.search.width = ev.target.value; save(); });
  let searchStop = false;
  async function runSearch() {
    if (busy) return;
    const cfg = Object.assign(currentCfg(), { duration: Math.max(10, Math.min(900, +state.search.time || 120)), variance: 0, weights: false });
    try { B.Sim.prepare(cfg); } catch (e) { $('#search-report').innerHTML = `<div class="notice">${esc(e.message)}</div>`; return; }
    cancelled = false; searchStop = false; busy = true;
    $('#run').disabled = true; $('#rank-run').disabled = true; $('#search-run').disabled = true; $('#search-stop').hidden = false;
    const bar = (frac, label) => {
      $('#qprog').hidden = frac === null;
      if (frac === null) return;
      $('#qpfill').style.width = (frac * 100).toFixed(1) + '%';
      $('#qplabel').textContent = label;
    };
    bar(0, 'Playing the action list…');
    // Each batch of rollouts spread over the workers, a few per message.
    const exec = async (items) => {
      const per = Math.max(1, Math.ceil(items.length / (Pool.size() * 2)));
      const tasks = [];
      for (let i = 0; i < items.length; i += per) tasks.push({ cfg, items: items.slice(i, i + per) });
      const parts = await execute(tasks, () => {});
      return [].concat(...parts);
    };
    try {
      const how = String(state.search.width);
      const gainTxt = (p) => (p.best > guide0 + 0.5 && guide0 ? `best so far +${((p.best - guide0) / guide0 * 100).toFixed(2)}%` : 'nothing better than the list yet');
      let guide0 = 0;
      const res = await B.Sim.optimize(cfg, {
        exec, shouldStop: () => searchStop,
        mode: how === 'exact' ? 'exact' : 'auto', maxNodes: 400000,
        width: how === '16' ? 16 : undefined, maxWidth: how === '256' ? 256 : 1024,
        onProgress: (p) => {
          if (p.guide) guide0 = p.guide;
          if (p.phase === 'exact') bar(Math.min(1, p.depth / Math.max(1, p.total)), `Every order: GCD ${p.depth} · ${p.open.toLocaleString()} positions open · ${p.tried.toLocaleString()} tried · ${gainTxt(p)}`);
          else if (p.phase === 'beam') bar(Math.min(1, p.depth / Math.max(1, p.total)), `${p.width} lines: GCD ${p.depth} of about ${p.total} · ${p.tried.toLocaleString()} fights played · ${gainTxt(p)}`);
          else bar(Math.min(1, p.at / Math.max(1, p.total)), `Polishing: GCD ${p.at} of ${p.total} · sweep ${p.sweep}`);
        },
      });
      const rep = B.Sim.searchReport(res);
      $('#search-report').innerHTML = R().search(res, rep);
      $('#copy-order').addEventListener('click', async (ev) => {
        const txt = R().orderText(rep);
        try { await navigator.clipboard.writeText(txt); ev.target.textContent = 'Copied'; }
        catch (e) {
          const ta = document.createElement('textarea');
          ta.value = txt; ta.rows = 8; ta.className = 'copybox';
          ev.target.replaceWith(ta); ta.select();
        }
      });
    } catch (e) {
      if (!cancelled) $('#search-report').innerHTML = `<div class="notice">The search stopped: ${esc(e.message)}</div>`;
    } finally {
      busy = false;
      $('#run').disabled = false; $('#rank-run').disabled = false; $('#search-run').disabled = false; $('#search-stop').hidden = true;
      bar(null);
      if (cancelled) Pool.kill();
    }
  }
  $('#search-run').addEventListener('click', runSearch);
  // Stop keeps the best order found so far.
  $('#search-stop').addEventListener('click', () => { searchStop = true; });

  // ---------- every job ----------
  let rankDone = false;
  function drawRankFields() {
    for (const k of ['iterations', 'duration', 'targets']) $('#r-' + k).value = state.rank[k];
    $('#r-preset').value = state.rank.partyPreset;
  }
  for (const k of ['iterations', 'duration', 'targets']) $('#r-' + k).addEventListener('input', (ev) => { state.rank[k] = +ev.target.value; save(); });
  $('#r-preset').addEventListener('change', (ev) => { state.rank.partyPreset = ev.target.value; save(); });

  async function runRank() {
    if (busy) return;
    const r = state.rank;
    const jobs = B.SIM_JOBS.filter(id => B.SIM_APLS[id] && B.liveVersion(id));
    const n = Math.max(20, Math.min(5000, Math.round(r.iterations) || 300));
    const variants = jobs.map(id => ({ cfg: { job: id, iterations: n, duration: Math.max(30, +r.duration || 300), variance: 0.1,
      targets: Math.max(1, Math.min(5, Math.round(r.targets) || 1)), ping: 50, party: (B.PARTY_PRESETS[r.partyPreset] || []).slice(), seed: 777 } }));
    const tasks = slices(n, variants);
    const total = n * variants.length;
    cancelled = false; setBusy(true, 'rank');
    const t0 = performance.now();
    progress('rank', 0, `0 of ${jobs.length} jobs`);
    try {
      const aggs = group(tasks, await execute(tasks, (k) => progress('rank', k / total, `${k.toLocaleString()} of ${total.toLocaleString()} iterations`)), variants.length);
      const rows = variants.map((v, i) => B.Sim.rankRow(v.cfg, aggs[i])).sort((a, b) => b.mean - a.mean);
      const party = r.partyPreset === 'none' ? 'solo, no raid buffs' : r.partyPreset === 'all' ? 'every raid buff' : 'a standard party\'s raid buffs';
      $('#rank-report').innerHTML = `<section class="card"><h2>Every job, live ${esc(B.SIM_PATCH)}</h2>
        <p class="muted small">${n.toLocaleString()} iterations each, ${R().mmss(+r.duration || 300)} fights (±10%), ${r.targets > 1 ? r.targets + ' targets' : 'one target'}, ${party}, ping 50 ms, in ${((performance.now() - t0) / 1000).toFixed(1)}s. Personal DPS only: a job's value to the raid through its own buffs isn't counted.</p>
        ${R().rankings(rows)}</section>`;
      rankDone = true;
    } catch (e) {
      if (!cancelled) $('#rank-report').innerHTML = `<div class="notice">The run stopped: ${esc(e.message)}</div>`;
    } finally {
      progress('rank', null); setBusy(false);
      if (cancelled) Pool.kill();
    }
  }
  $('#rank-run').addEventListener('click', runRank);
  $('#rank-stop').addEventListener('click', () => { cancelled = true; Pool.kill(); });

  // ---------- start ----------
  drawAll();
  drawRankFields();
  drawSearchFields();
  $('#search-report').innerHTML = '<section class="card placeholder"><h2>Best rotation</h2><p class="muted">Pick a job and a time limit, then press “Find the best GCD order”. A minute or two of fight settles in about ten seconds; a full five minutes in about a minute.</p></section>';
  $('#report').innerHTML = '<section class="card placeholder"><h2>Simulating…</h2><p class="muted">A first run of the selected job is on its way.</p></section>';
  $('#rank-report').innerHTML = '<section class="card placeholder"><h2>Every job</h2><p class="muted">Press “Simulate every job” to rank all 21 jobs on the same fight.</p></section>';
  showTab(['rank', 'search'].includes(state.tab) ? state.tab : 'sim');
  // Open on a real result: a quick run of the saved setup (a few hundred iterations, no extras).
  if (state.tab !== 'rank') {
    const keep = { it: state.fight.iterations, w: state.weights, sets: state.sets };
    state.fight.iterations = Math.min(keep.it, 400); state.weights = false; state.sets = '';
    runSim().finally(() => { state.fight.iterations = keep.it; state.weights = keep.w; state.sets = keep.sets; save(); });
  }
})(window.BLM);

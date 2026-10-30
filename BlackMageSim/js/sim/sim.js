// The simulator: runs a job's live version against a striking dummy thousands of times, headless, with an action
// priority list (js/sim/apl.js) at the keys, and gathers what SimulationCraft reports: DPS with its error,
// the spread, damage by action, buff uptimes, DPS over time, a sample sequence and stat weights. It drives the
// same Engine and job modules as the game (js/engine.js, js/jobs/*.js), so the numbers are the game's own.
// Runs in the page or in Node (tools/xivsim.js); nothing here touches the DOM.
(function (B) {
  const EPS = 1e-6;

  // ---------- the live patch ----------
  // Each job's newest Dawntrail version: the one whose history label runs to the last patch.
  B.SIM_PATCH = '7.57';
  B.liveVersion = function (jobId) {
    const def = B.JOBS[jobId];
    if (!def) return null;
    return def.versions.find(v => /^DT /.test(v.history || '') && v.history.endsWith(B.SIM_PATCH)) ||
      def.versions.find(v => /^DT /.test(v.history || '')) || null;
  };
  B.SIM_JOBS = ['pld', 'war', 'drk', 'gnb', 'whm', 'sch', 'ast', 'sge', 'mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr',
    'brd', 'mch', 'dnc', 'blm', 'smn', 'rdm', 'pct'];
  B.ROLE_OF = { pld: 'tank', war: 'tank', drk: 'tank', gnb: 'tank', whm: 'healer', sch: 'healer', ast: 'healer', sge: 'healer',
    mnk: 'melee', drg: 'melee', nin: 'melee', sam: 'melee', rpr: 'melee', vpr: 'melee', brd: 'ranged', mch: 'ranged', dnc: 'ranged',
    blm: 'caster', smn: 'caster', rdm: 'caster', pct: 'caster' };

  // ---------- party buffs ----------
  // Raid buffs other party members bring, at Dawntrail's values, on the usual two-minute alignment: each lands
  // `at` seconds into the pull (where the standard opener puts it) and again every `every` seconds. A job never
  // receives its own buff from here (its module already plays it). mult: damage dealt or taken, crit / dh: rate.
  B.RAID_BUFFS = [
    { id: 'litany', name: 'Battle Litany', job: 'drg', crit: 0.10, at: 3.6, dur: 20 },
    { id: 'brotherhood', name: 'Brotherhood', job: 'mnk', mult: 1.05, at: 4.6, dur: 20 },
    { id: 'circle', name: 'Arcane Circle', job: 'rpr', mult: 1.03, at: 4.8, dur: 20 },
    { id: 'dokumori', name: 'Dokumori', job: 'nin', mult: 1.05, at: 4.1, dur: 20 },
    { id: 'battleVoice', name: 'Battle Voice', job: 'brd', dh: 0.20, at: 5.0, dur: 20 },
    { id: 'finale', name: 'Radiant Finale', job: 'brd', mult: 1.06, firstMult: 1.02, at: 5.0, dur: 20 },
    { id: 'technical', name: 'Technical Finish', job: 'dnc', mult: 1.05, at: 6.0, dur: 20 },
    { id: 'searing', name: 'Searing Light', job: 'smn', mult: 1.05, at: 1.8, dur: 20 },
    { id: 'embolden', name: 'Embolden', job: 'rdm', mult: 1.05, at: 5.4, dur: 20 },
    { id: 'starry', name: 'Starry Muse', job: 'pct', mult: 1.05, at: 5.6, dur: 20 },
    { id: 'divination', name: 'Divination', job: 'ast', mult: 1.06, at: 5.0, dur: 20 },
    { id: 'chain', name: 'Chain Stratagem', job: 'sch', crit: 0.10, at: 5.2, dur: 20 },
    // One player's own, off unless ticked: the Astrologian's card and the Dancer's partner.
    { id: 'card', name: 'The Balance / The Spear (card)', job: 'ast', mult: 1.06, at: 5.0, dur: 15, every: 60, single: true },
    { id: 'partner', name: 'Dance partner (Standard Finish)', job: 'dnc', mult: 1.05, at: 0, dur: 1e9, every: 1e9, single: true },
    { id: 'devilment', name: 'Dance partner (Devilment)', job: 'dnc', crit: 0.20, dh: 0.20, at: 6.0, dur: 20, single: true },
  ];
  // A full party for each role: a tank, a healer pair and four other DPS, as most statics run.
  B.PARTY_PRESETS = {
    none: [],
    standard: ['litany', 'brotherhood', 'dokumori', 'battleVoice', 'finale', 'searing', 'divination', 'chain'],
    all: B.RAID_BUFFS.filter(b => !b.single).map(b => b.id),
  };

  // ---------- seeded random numbers ----------
  // Every iteration gets its own seed, so a stat-weight run sees the same crits as the base run (common random
  // numbers): the difference between them is then mostly the stat, not luck.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- the engine, as the simulator drives it ----------
  class SimEngine extends B.Engine {
    queueHit(id, potency, snap, delay, after, opts) {
      if (this.raidSnap && snap && !snap.__raid) snap = this.raidSnap(snap, this.now);
      return super.queueHit(id, potency, snap, delay, after, opts);
    }
    // Positionals land at the rate in the settings (default: every one).
    positionalHit(a) {
      if (!a.positional) return false;
      if (this.has('trueNorth')) return true;
      const r = this.simPositionals === undefined ? 1 : this.simPositionals;
      return r >= 1 || Math.random() < r;
    }
    // Since 6.2, an action that always crits or direct hits still gains from crit- and direct-hit-rate buffs, by
    // its chance's worth of the bonus.
    damage(potency, snap, isDot, opts) {
      const r = super.damage(potency, snap, isDot, opts);
      if (!opts || !snap || this.lv.formula === 'hw') return r;
      const s = this.stats, L = this.lv;
      if (opts.crit && snap.critAdd) r.amount = Math.floor(r.amount * (1 + snap.critAdd * (Math.floor(200 * (s.crit - L.sub) / L.div + 1400) / 1000 - 1)));
      if (opts.dh && snap.dhAdd) r.amount = Math.floor(r.amount * (1 + snap.dhAdd * 0.25));
      return r;
    }
  }
  B.SimEngine = SimEngine;

  // ---------- one prepared simulation ----------
  // cfg: { job, version, apl (text), stats: { main, wd, det, crit, dh, speed, ten }, iterations, duration,
  //   variance (0.1 = ±10%), targets, ping, latencyComp, positionals (0–1), party: [buff ids], style
  //   ('patchwerk' | 'movement'), moveEvery, moveFor, seed, sample (keep iteration 0's sequence) }
  function prepare(cfg) {
    const jobId = cfg.job;
    const ver = cfg.version ? B.JOBS[jobId].versions.find(v => v.id === cfg.version) : B.liveVersion(jobId);
    if (!ver) throw new Error(`no live version for ${jobId}`);
    const job0 = B.setJob(jobId, ver.id);
    const parsed = B.SimAPL.parse(cfg.apl !== undefined ? cfg.apl : (B.SIM_APLS[jobId] || ''));
    const compiled = B.SimAPL.compile(parsed, job0, job0.actions);
    const base = Object.assign({}, job0.stats);
    const stats = Object.assign({}, base);
    for (const k of ['main', 'wd', 'det', 'crit', 'dh', 'speed', 'ten']) {
      if (cfg.stats && cfg.stats[k] !== undefined && cfg.stats[k] !== null && cfg.stats[k] !== '') stats[k] = +cfg.stats[k];
    }
    const buffs = B.RAID_BUFFS.filter(b => (cfg.party || []).includes(b.id) && b.job !== jobId);
    return { cfg, jobId, ver, job0, compiled, stats, base, buffs };
  }

  // Which party buffs are up at time t, and their combined effect.
  function raidAt(buffs, t) {
    let mult = 1, crit = 0, dh = 0;
    const up = [];
    for (const b of buffs) {
      const every = b.every || 120;
      if (t < b.at) continue;
      const k = Math.floor((t - b.at) / every);
      const into = t - b.at - k * every;
      if (into >= b.dur) continue;
      up.push(b);
      if (b.mult) mult *= k === 0 && b.firstMult ? b.firstMult : b.mult;
      if (b.crit) crit += b.crit;
      if (b.dh) dh += b.dh;
    }
    return { mult, crit, dh, up };
  }

  function raidQuery(buffs, which, field, t) {
    const list = which ? buffs.filter(b => b.id === which) : buffs.filter(b => !b.single || which);
    if (!list.length) return field === 'in' ? 999 : field === 'down' ? 1 : 0;
    let best = 0, next = Infinity, any = false;
    for (const b of list) {
      const every = b.every || 120;
      if (t < b.at) { next = Math.min(next, b.at - t); continue; }
      const k = Math.floor((t - b.at) / every);
      const into = t - b.at - k * every;
      if (into < b.dur) { any = true; best = Math.max(best, b.dur - into); next = 0; }
      else next = Math.min(next, every - into);
    }
    if (field === 'up') return any ? 1 : 0;
    if (field === 'down') return any ? 0 : 1;
    if (field === 'remains') return best;
    if (field === 'in') return next === Infinity ? 999 : next;
    return 0;
  }

  // Run iteration `it` of a prepared sim. Returns its totals; fills `agg` when given.
  function iterate(P, it, agg, overrideStats) {
    const cfg = P.cfg;
    const seed = ((cfg.seed || 12345) + it * 7919) >>> 0;
    const R = rng(seed);
    const job = B.setJob(P.jobId, P.ver.id);
    job.stats = Object.assign({}, job.stats, overrideStats || P.stats);
    const settings = {
      ping: cfg.ping !== undefined ? +cfg.ping : 50, latencyComp: !!cfg.latencyComp,
      dummies: Math.max(1, Math.min(5, +cfg.targets || 1)), speed: { [P.jobId]: job.stats.speed },
    };
    const buffs = P.buffs;
    // The engine's clock starts at 0 at the first pre-pull press (it treats 0 as "ready"), so the pull is at
    // engine time T0 and fight time is e.now - T0.
    const pre = P.compiled.lists.precombat || [];
    const T0 = 1 - Math.min(-5, ...pre.filter(p => p.at !== undefined).map(p => p.at));
    // Party buffs go onto every snapshot when it's taken (DoTs keep the buffs they were applied with). A hit queued
    // with a snapshot of its own (Living Shadow's) gets them as it's queued; __raid marks a snapshot that has them.
    let raidSnap = null;
    if (buffs.length) {
      raidSnap = (s, now) => {
        const r = raidAt(buffs, now - T0);
        if (!r.up.length) return Object.assign({}, s, { __raid: true });
        return Object.assign({}, s, { mult: (s.mult === undefined ? 1 : s.mult) * r.mult,
          critAdd: (s.critAdd || 0) + r.crit, dhAdd: (s.dhAdd || 0) + r.dh, __raid: true });
      };
      const own = job.snapshot.bind(job);
      job.snapshot = function (a, e) { return raidSnap(own(a, e), e.now); };
    }
    const savedRandom = Math.random;
    Math.random = R;
    try {
      const variance = cfg.variance !== undefined ? +cfg.variance : 0.1;
      const D = Math.max(10, (+cfg.duration || 300) * (1 + variance * (2 * R() - 1)));
      const END = T0 + D;
      const e = new SimEngine(settings, job);
      e.raidSnap = raidSnap;
      e.simPositionals = cfg.positionals !== undefined ? +cfg.positionals : 1;
      e.pos.x = 0; e.pos.z = -(B.isCaster(job) || job.role === 'ranged' ? 8 : 2.4);
      e.now = 0;
      e.reset();
      e.gcdEnd = e.lockUntil = 0;

      const sim = {
        iteration: it, lastAction: null, lastGcd: null, vars: {},
        raidQuery: (which, field, t) => raidQuery(buffs, which, field, t - T0),
      };
      const ctx = { e, job, A: job.actions, end: END, t0: T0, sim };
      for (const list of Object.values(P.compiled.lists)) for (const ent of list) ent.last = -1e9;

      // What the iteration records.
      const out = { dmg: 0, D, byId: {}, uses: {}, buffs: {}, seq: null, buckets: null, gcds: 0, idle: 0 };
      const keepSeq = agg && agg.wantSeq && it === 0;
      if (keepSeq) out.seq = [];
      if (agg) out.buckets = new Float64Array(Math.ceil(D) + 1);
      const row = (id) => out.byId[id] || (out.byId[id] = { dmg: 0, hits: 0, crit: 0, dh: 0, ticks: 0 });
      const open = {};
      e.on('hit', (h) => {
        if (h.t < T0 - EPS || h.t > END + EPS) return;
        out.dmg += h.amount;
        const r = row(h.id || 'unknown');
        r.dmg += h.amount; r.hits++;
        if (h.crit) r.crit++;
        if (h.dh) r.dh++;
        if (h.dot) r.ticks++;
        if (out.buckets) out.buckets[Math.max(0, Math.floor(h.t - T0))] += h.amount;
      });
      e.on('use', (u) => {
        out.uses[u.id] = (out.uses[u.id] || 0) + 1;
        if (u.gcd && u.t >= T0) out.gcds++;
      });
      if (agg) {
        e.on('statusGain', (s) => { const k = (s.self ? 'b:' : 'd:') + s.key; if (open[k] === undefined) open[k] = Math.max(T0, e.now); });
        e.on('statusLose', (s) => {
          const k = (s.self ? 'b:' : 'd:') + s.key;
          if (open[k] === undefined) return;
          const from = open[k], to = Math.min(END, e.now);
          delete open[k];
          if (to > from) out.buffs[k] = (out.buffs[k] || 0) + (to - from);
        });
      }

      const moveOn = cfg.style === 'movement';
      const moveEvery = +cfg.moveEvery || 30, moveFor = +cfg.moveFor || 3;
      // Movement: the last moveFor seconds of every moveEvery (fight time), when nothing can be cast.
      const movingAt = (t) => moveOn && t > T0 && ((t - T0) % moveEvery) >= moveEvery - moveFor;
      const nextMoveEdge = (t) => {
        if (!moveOn) return Infinity;
        if (t < T0) return T0 + moveEvery - moveFor;
        const into = (t - T0) % moveEvery, base = t - into;
        return into < moveEvery - moveFor ? base + moveEvery - moveFor : base + moveEvery;
      };
      if (moveOn) {
        sim.moveIn = () => (e.moving ? 0 : Math.max(0, nextMoveEdge(e.now) - e.now));
        sim.moveLeft = () => (e.moving ? Math.max(0, nextMoveEdge(e.now) - e.now) : 0);
      }
      const step = (target) => {
        if (target <= e.now + EPS) return;
        e.advance(target - e.now);
      };
      const press = (id, ent) => {
        const ok = e.execute(id);
        if (!ok) return false;
        if (ent) ent.last = e.now;
        sim.lastAction = id;
        if (job.actions[id].kind === 'gcd') sim.lastGcd = id;
        if (out.seq && out.seq.length < 2000) {
          out.seq.push({ t: e.now - T0, id, gcd: job.actions[id].kind === 'gcd', line: ent ? ent.line : 0, mp: Math.round(e.mp),
            buffs: Object.keys(e.statuses).filter(k => e.has(k)) });
        }
        return true;
      };

      // Before the pull: each line at its `at=` (or as soon as the one before it allows).
      for (const p of pre) {
        if (p.call || p.wait || p.varName) continue;
        const id = e.resolve(p.action);
        if (!job.actions[id]) continue;
        let t = Math.max(e.now, p.at !== undefined ? T0 + p.at : e.now);
        step(t);
        t = Math.max(e.now, e.availableAt(id));
        step(t);
        if (e.checkConditions(id) || (p.cond && !p.cond(ctx))) continue;
        press(id, p);
      }
      // Auto-attacks start with the pull, whatever was pressed before it.
      if (e.autoNext !== null && e.autoNext < T0) e.autoNext = T0;

      let guardT = NaN, guardN = 0;
      while (e.now < END - EPS) {
        if (moveOn) { const m = movingAt(e.now); if (m !== e.moving) e.setMoving(m); }
        e.frame();
        const pick = e.now >= T0 - EPS ? B.SimAPL.choose(P.compiled, ctx) : null;
        if (pick && pick.id) {
          if (e.now === guardT) { if (++guardN > 30) { step(e.now + 0.01); continue; } } else { guardT = e.now; guardN = 0; }
          if (!press(pick.id, pick.entry)) step(e.now + 0.01);
          continue;
        }
        let t = Math.min(END, e.nextEventTime());
        if (e.now < T0) t = Math.min(t, T0);
        if (pick && pick.wait) t = Math.min(t, e.now + pick.wait);
        if (e.lockUntil > e.now + EPS) t = Math.min(t, e.lockUntil);
        if (e.casting) t = Math.min(t, e.casting.end + e.casting.tax);
        if (e.gcdEnd > e.now + EPS) t = Math.min(t, e.gcdEnd);
        else if (!e.casting && e.lockUntil <= e.now + EPS && e.now >= T0) out.idle += Math.max(0, Math.min(t, END) - e.now);
        if (moveOn) t = Math.min(t, nextMoveEdge(e.now));
        if (t <= e.now + EPS) t = e.now + 0.005;
        step(t);
      }
      for (const k in open) {
        const from = open[k], to = END;
        if (to > from) out.buffs[k] = (out.buffs[k] || 0) + (to - from);
      }
      out.dps = out.dmg / D;
      if (agg) merge(agg, out);
      return out;
    } finally {
      Math.random = savedRandom;
    }
  }

  function newAgg(wantSeq) {
    return { n: 0, dps: [], dmg: 0, time: 0, byId: {}, uses: {}, buffs: {}, buckets: [], bucketN: [], seq: null, wantSeq, gcds: 0, idle: 0 };
  }
  function merge(agg, out) {
    agg.n++;
    agg.dps.push(out.dps);
    agg.dmg += out.dmg; agg.time += out.D; agg.gcds += out.gcds; agg.idle += out.idle;
    for (const [id, r] of Object.entries(out.byId)) {
      const a = agg.byId[id] || (agg.byId[id] = { dmg: 0, hits: 0, crit: 0, dh: 0, ticks: 0 });
      a.dmg += r.dmg; a.hits += r.hits; a.crit += r.crit; a.dh += r.dh; a.ticks += r.ticks;
    }
    for (const [id, n] of Object.entries(out.uses)) agg.uses[id] = (agg.uses[id] || 0) + n;
    for (const [k, v] of Object.entries(out.buffs)) agg.buffs[k] = (agg.buffs[k] || 0) + v;
    if (out.buckets) out.buckets.forEach((v, i) => { agg.buckets[i] = (agg.buckets[i] || 0) + v; agg.bucketN[i] = (agg.bucketN[i] || 0) + 1; });
    if (out.seq && !agg.seq) agg.seq = out.seq;
  }

  function summarize(agg) {
    const n = agg.dps.length;
    const mean = agg.dps.reduce((s, x) => s + x, 0) / n;
    const sd = Math.sqrt(agg.dps.reduce((s, x) => s + (x - mean) * (x - mean), 0) / Math.max(1, n - 1));
    const sorted = agg.dps.slice().sort((a, b) => a - b);
    const q = (f) => sorted[Math.min(n - 1, Math.max(0, Math.round(f * (n - 1))))];
    return { n, mean, sd, err: 1.96 * sd / Math.sqrt(n), min: sorted[0], max: sorted[n - 1], p5: q(0.05), p25: q(0.25), median: q(0.5), p75: q(0.75), p95: q(0.95) };
  }

  const tick = () => new Promise(r => (typeof setImmediate === 'function' ? setImmediate(r) : setTimeout(r, 0)));
  const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // Run `n` iterations of a prepared sim in slices, yielding between them so a page stays responsive.
  async function runMany(P, n, agg, overrideStats, onStep, shouldStop) {
    let it = 0;
    while (it < n) {
      const t0 = clock();
      while (it < n && clock() - t0 < 40) iterate(P, it++, agg, overrideStats);
      if (onStep) onStep(it);
      if (shouldStop && shouldStop()) break;
      await tick();
    }
    return agg;
  }

  // Stat weights: one extra run per stat with the same seeds, ΔDPS per point, normalised to the main stat.
  B.SIM_WEIGHT_DELTAS = { main: 150, wd: 6, det: 300, crit: 300, dh: 300, speed: 300, ten: 300 };

  // The whole report for one job. opts: { onProgress(fraction, label), shouldStop() }.
  async function run(cfg, opts) {
    opts = opts || {};
    const t0 = clock();
    const P = prepare(cfg);
    const n = Math.max(1, Math.min(100000, +cfg.iterations || 1000));
    const weights = cfg.weights ? Object.keys(B.SIM_WEIGHT_DELTAS).filter(k => k !== 'ten' || P.stats.ten) : [];
    const totalRuns = 1 + weights.length;
    let done = 0;
    const progress = (label) => (k) => { if (opts.onProgress) opts.onProgress((done * n + k) / (totalRuns * n), label); };
    const agg = await runMany(P, n, newAgg(true), null, progress('Simulating'), opts.shouldStop);
    done++;
    const S = summarize(agg);

    const weightRows = [];
    for (const k of weights) {
      if (opts.shouldStop && opts.shouldStop()) break;
      const delta = B.SIM_WEIGHT_DELTAS[k];
      const st = Object.assign({}, P.stats, { [k]: P.stats[k] + delta });
      const a2 = await runMany(P, agg.dps.length, newAgg(false), st, progress(`Stat weight: ${k}`), opts.shouldStop);
      done++;
      const m = Math.min(a2.dps.length, agg.dps.length);
      const diffs = [];
      for (let i = 0; i < m; i++) diffs.push(a2.dps[i] - agg.dps[i]);
      const dm = diffs.reduce((s, x) => s + x, 0) / m;
      const dsd = Math.sqrt(diffs.reduce((s, x) => s + (x - dm) * (x - dm), 0) / Math.max(1, m - 1));
      weightRows.push({ stat: k, delta, dps: dm, perPoint: dm / delta, err: 1.96 * dsd / Math.sqrt(m) / delta });
    }
    normWeights(weightRows);
    return report(P, agg, S, weightRows, clock() - t0);
  }

  function normWeights(rows) {
    const mainW = (rows.find(r => r.stat === 'main') || {}).perPoint;
    for (const r of rows) r.norm = mainW ? r.perPoint / mainW : null;
    return rows;
  }

  // ---------- the pieces a page uses to spread a run over Web Workers ----------
  // Iterations [from, to) of a config, synchronously: what one worker does with one slice.
  function runRange(cfg, from, to, overrideStats, wantSeq) {
    const P = prepare(cfg);
    const agg = newAgg(!!wantSeq);
    for (let i = from; i < to; i++) iterate(P, i, agg, overrideStats || null);
    agg.buckets = Array.from(agg.buckets, v => v || 0);
    return agg;
  }
  // Slices back into one aggregate, in iteration order (stat weights pair iteration i with iteration i).
  function mergeAggs(parts) {
    const agg = newAgg(true);
    for (const p of parts) {
      agg.n += p.n; agg.dmg += p.dmg; agg.time += p.time; agg.gcds += p.gcds; agg.idle += p.idle;
      for (const x of p.dps) agg.dps.push(x);
      for (const [id, r] of Object.entries(p.byId)) {
        const a = agg.byId[id] || (agg.byId[id] = { dmg: 0, hits: 0, crit: 0, dh: 0, ticks: 0 });
        a.dmg += r.dmg; a.hits += r.hits; a.crit += r.crit; a.dh += r.dh; a.ticks += r.ticks;
      }
      for (const [id, n] of Object.entries(p.uses)) agg.uses[id] = (agg.uses[id] || 0) + n;
      for (const [k, v] of Object.entries(p.buffs)) agg.buffs[k] = (agg.buffs[k] || 0) + v;
      (p.buckets || []).forEach((v, i) => { agg.buckets[i] = (agg.buckets[i] || 0) + (v || 0); agg.bucketN[i] = (agg.bucketN[i] || 0) + (p.bucketN[i] || 0); });
      if (p.seq && !agg.seq) agg.seq = p.seq;
    }
    return agg;
  }
  // ΔDPS of a variant run against the base, iteration by iteration (common random numbers).
  function compare(baseDps, varDps) {
    const m = Math.min(baseDps.length, varDps.length);
    const diffs = [];
    for (let i = 0; i < m; i++) diffs.push(varDps[i] - baseDps[i]);
    const dm = diffs.reduce((s, x) => s + x, 0) / Math.max(1, m);
    const dsd = Math.sqrt(diffs.reduce((s, x) => s + (x - dm) * (x - dm), 0) / Math.max(1, m - 1));
    return { delta: dm, err: 1.96 * dsd / Math.sqrt(Math.max(1, m)) };
  }
  function weightRow(stat, baseDps, varDps) {
    const delta = B.SIM_WEIGHT_DELTAS[stat];
    const c = compare(baseDps, varDps);
    return { stat, delta, dps: c.delta, perPoint: c.delta / delta, err: c.err / delta };
  }
  function weightStats(cfg) {
    const P = prepare(cfg);
    return (cfg.weights ? Object.keys(B.SIM_WEIGHT_DELTAS).filter(k => k !== 'ten' || P.stats.ten) : [])
      .map(k => ({ stat: k, stats: Object.assign({}, P.stats, { [k]: P.stats[k] + B.SIM_WEIGHT_DELTAS[k] }) }));
  }
  function finish(cfg, agg, weightRows, ms) {
    const P = prepare(cfg);
    return report(P, agg, summarize(agg), normWeights(weightRows || []), ms);
  }
  // One rankings row from a finished aggregate.
  function rankRow(cfg, agg) {
    const P = prepare(cfg);
    const S = summarize(agg);
    return { job: P.jobId, name: P.job0.name, abbr: P.job0.def.abbr, role: B.ROLE_OF[P.jobId], version: P.ver.label,
      mean: S.mean, err: S.err, sd: S.sd, min: S.min, max: S.max, gcd: gcdOf(P) };
  }

  // Shape the aggregate into the report the page and the CLI print.
  function report(P, agg, S, weightRows, ms) {
    const A = P.job0.actions;
    const n = agg.n;
    const nameOf = (id) => (id === 'auto' ? (P.job0.autoAttack && P.job0.autoAttack.name) || 'Auto-attack' : (A[id] && A[id].name) || id);
    const abilities = Object.entries(agg.byId).map(([id, r]) => ({
      id, name: nameOf(id), dmg: r.dmg / n, dps: r.dmg / agg.time, share: r.dmg / Math.max(1, agg.dmg),
      hits: r.hits / n, casts: (agg.uses[id] || 0) / n, avg: r.hits ? r.dmg / r.hits : 0,
      crit: r.hits ? r.crit / r.hits : 0, dh: r.hits ? r.dh / r.hits : 0, dot: r.ticks > r.hits / 2,
    })).sort((a, b) => b.dmg - a.dmg);
    const uses = Object.entries(agg.uses).map(([id, k]) => ({ id, name: nameOf(id), count: k / n, gcd: A[id] && A[id].kind === 'gcd' }))
      .sort((a, b) => b.count - a.count);
    const statusName = (k) => (B.STATUSES[k] && B.STATUSES[k].name) || k;
    const buffs = Object.entries(agg.buffs).map(([k, v]) => ({ key: k.slice(2), self: k[0] === 'b', name: statusName(k.slice(2)), uptime: v / agg.time }))
      .filter(b => b.uptime > 0.0005).sort((a, b) => b.uptime - a.uptime);
    const timeline = agg.buckets.map((v, i) => (agg.bucketN[i] ? v / agg.bucketN[i] : 0));
    const lo = Math.min(...agg.dps), hi = Math.max(...agg.dps);
    const bins = 40, hist = new Array(bins).fill(0);
    for (const x of agg.dps) hist[Math.min(bins - 1, Math.floor((x - lo) / Math.max(1e-9, hi - lo) * bins))]++;
    const seq = (agg.seq || []).map(s => Object.assign({}, s, { name: nameOf(s.id) }));
    const settings = P.cfg;
    // Party buff windows over the average fight, for shading the DPS-over-time chart.
    const windows = [];
    const party = P.buffs.filter(b => !b.single);
    if (party.length) {
      for (let t = Math.min(...party.map(b => b.at)); t < agg.time / n; t += 120) {
        windows.push([t, t + 20]);
      }
    }
    return {
      job: P.jobId, jobName: P.job0.name, abbr: P.job0.def.abbr, role: B.ROLE_OF[P.jobId], windows,
      version: P.ver.id, versionLabel: P.ver.label, patch: B.SIM_PATCH,
      stats: P.stats, base: P.base, gcd: gcdOf(P), settings, summary: S, abilities, uses, buffs, timeline,
      hist: { lo, hi, bins: hist }, seq, weights: weightRows, warnings: P.compiled.warnings,
      fight: agg.time / n, gcdsPerMin: agg.gcds / (agg.time / 60), idle: agg.idle / agg.time, ms,
      party: P.buffs.map(b => b.name),
    };
  }

  function gcdOf(P) {
    const job = B.setJob(P.jobId, P.ver.id);
    job.stats = Object.assign({}, job.stats, P.stats);
    const e = new SimEngine({ speed: { [P.jobId]: P.stats.speed }, ping: 0 }, job);
    return e.gcdRecast();
  }

  // Every live job with its own best-in-slot set: the "rankings" chart.
  async function rankAll(cfg, opts) {
    opts = opts || {};
    const rows = [];
    const jobs = cfg.jobs || B.SIM_JOBS;
    for (let i = 0; i < jobs.length; i++) {
      if (opts.shouldStop && opts.shouldStop()) break;
      const id = jobs[i];
      if (!B.SIM_APLS[id] || !B.liveVersion(id)) continue;
      const c = Object.assign({}, cfg, { job: id, apl: undefined, stats: null, weights: false });
      const P = prepare(c);
      const n = Math.max(1, +cfg.iterations || 200);
      const agg = await runMany(P, n, newAgg(false), null, (k) => opts.onProgress && opts.onProgress((i + k / n) / jobs.length, P.job0.name), opts.shouldStop);
      rows.push(rankRow(c, agg));
    }
    rows.sort((a, b) => b.mean - a.mean);
    return rows;
  }

  B.Sim = { prepare, iterate, newAgg, run, rankAll, summarize, raidAt, raidQuery, rng,
    runRange, mergeAggs, compare, weightRow, weightStats, finish, rankRow, gcdFor: (cfg) => gcdOf(prepare(cfg)) };
  B.SIM_APLS = B.SIM_APLS || {};
})(window.BLM);

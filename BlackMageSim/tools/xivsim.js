#!/usr/bin/env node
// The simulator from the command line, SimulationCraft style:
//
//   node BlackMageSim/tools/xivsim.js job=sam iterations=2000 time=300 party=standard weights=1
//   node BlackMageSim/tools/xivsim.js job=blm apl=my_blm.simc html=report.json
//   node BlackMageSim/tools/xivsim.js rank=1 iterations=300 party=standard
//
// Options (key=value): job, version (another of the job's versions by id, e.g. dt705; the live one by default), iterations, time (fight length, s), variance (0.1 = ±10%), targets, ping (ms),
// latency_comp, positionals (0–1), party (none | standard | all | comma-separated buff ids), style
// (patchwerk | movement), weights, apl (a file with an action list), main / wd / det / crit / dh / speed / ten
// (stat overrides), seed, json (write the full report there), rank (every job), seq (print the sample sequence),
// search=1 (the best GCD order for time=: every order when that is few enough, else a beam widened until it settles;
// width= fixes the width, max_width= caps it (default 1024), mode=exact|beam forces one: see B.Sim.optimize).
// Loads the same files the page does (index.html's order), with `window` standing in for the page.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
global.window = global;

function load() {
  const html = fs.readFileSync(path.join(ROOT, 'sim.html'), 'utf8');
  // The page's own scripts (report.js, page.js) draw; the rest is the engine, the jobs and the simulator.
  const srcs = [...html.matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1]).filter(s => !/js\/sim\/(page|report)\.js$/.test(s));
  for (const s of srcs) {
    const file = path.join(ROOT, s);
    if (!fs.existsSync(file)) continue;     // a job without an action list yet
    vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: s });
  }
  return window.BLM;
}

function args() {
  const o = {};
  for (const a of process.argv.slice(2)) {
    const k = a.indexOf('=');
    if (k < 0) o[a.replace(/^--/, '')] = '1';
    else o[a.slice(0, k).replace(/^--/, '')] = a.slice(k + 1);
  }
  return o;
}

const fmt = (x, d = 0) => (x === undefined || x === null || Number.isNaN(x) ? '-' : x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (x, d = 1) => (x * 100).toFixed(d) + '%';
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

function partyOf(B, s) {
  if (!s) return [];
  if (B.PARTY_PRESETS[s]) return B.PARTY_PRESETS[s].slice();
  return s.split(',').map(x => x.trim()).filter(Boolean);
}

async function main() {
  const B = load();
  const o = args();
  const cfg = {
    job: o.job || 'sam',
    version: o.version,
    iterations: +(o.iterations || 1000),
    duration: +(o.time || o.duration || 300),
    variance: o.variance !== undefined ? +o.variance : 0.1,
    targets: +(o.targets || 1),
    ping: o.ping !== undefined ? +o.ping : 50,
    latencyComp: o.latency_comp === '1',
    positionals: o.positionals !== undefined ? +o.positionals : 1,
    party: partyOf(B, o.party || 'none'),
    style: o.style || 'patchwerk',
    weights: o.weights === '1',
    seed: +(o.seed || 12345),
    stats: {},
  };
  for (const k of ['main', 'wd', 'det', 'crit', 'dh', 'speed', 'ten']) if (o[k] !== undefined) cfg.stats[k] = +o[k];
  if (o.apl) cfg.apl = fs.readFileSync(o.apl, 'utf8');

  if (o.search === '1') {
    // The best GCD order for the fight length (time=): see B.Sim.optimize.
    const res = await B.Sim.optimize(cfg, {
      mode: o.mode || 'auto', width: o.width ? +o.width : undefined, maxWidth: +(o.max_width || 1024),
      onProgress: (p) => process.stderr.write(`\r${p.phase}${p.width ? ' ' + p.width : ''}: GCD ${p.depth || p.at} of ~${p.total}, ${p.tried} tried, best ${fmt(p.best / cfg.duration, 1)}   `),
    });
    process.stderr.write('\r' + ' '.repeat(80) + '\r');
    const rep = B.Sim.searchReport(res);
    const D = cfg.duration, gain = res.best.score - res.guide.score;
    const how = res.mode === 'exact' ? `every order tried (${res.tried} states, ${res.merged} merged)` :
      `beam ${res.steps.map(x => x.width).join(' → ')}${res.converged ? ', settled' : ', not settled'}${res.polished ? `, polish ${res.polished.changes} change(s)` : ''}, ${res.tried} fights played`;
    console.log(`${rep.best.jobName} — best GCD order for ${D}s (live ${B.SIM_PATCH}): ${how}, ${(res.ms / 1000).toFixed(1)}s${res.seeds.length > 1 ? ', procs averaged over 3 seeds' : ''}`);
    if (res.steps) console.log('  ' + res.steps.map(x => `width ${x.width}: +${((x.score / res.guide.score - 1) * 100).toFixed(2)}%`).join('   '));
    console.log(`  action list ${fmt(res.guide.score / D, 1)} DPS   best found ${fmt(res.best.score / D, 1)} DPS   ${gain >= 0 ? '+' : ''}${fmt(gain / D, 1)} (${(gain / res.guide.score * 100).toFixed(2)}%)`);
    const nm = (id) => (rep.best.seq.find(q => q.id === id) || rep.guide.seq.find(q => q.id === id) || { name: id }).name;
    const bg = rep.best.seq.filter(q => q.gcd && q.t >= -1e-6), gg = rep.guide.seq.filter(q => q.gcd && q.t >= -1e-6);
    const n = Math.max(bg.length, gg.length);
    console.log('');
    console.log(`  ${'#'.padStart(3)}  ${'best'.padEnd(34)} action list`);
    for (let i = 0; i < Math.min(n, +(o.seqn || 400)); i++) {
      const b1 = bg[i], g1 = gg[i];
      const diff = !b1 || !g1 || b1.id !== g1.id;
      console.log(`  ${String(i + 1).padStart(3)}  ${(b1 ? b1.t.toFixed(2).padStart(6) + ' ' + nm(b1.id) : '').padEnd(34)} ${g1 ? g1.t.toFixed(2).padStart(6) + ' ' + nm(g1.id) : ''}${diff ? '   *' : ''}`);
    }
    if (o.json) fs.writeFileSync(o.json, JSON.stringify({ res, rep }, null, 1));
    return;
  }

  if (o.rank === '1') {
    const t0 = Date.now();
    const rows = await B.Sim.rankAll(cfg, { onProgress: (f, l) => process.stderr.write(`\r${lpad((f * 100).toFixed(0), 3)}% ${pad(l, 14)}`) });
    process.stderr.write('\r' + ' '.repeat(30) + '\r');
    console.log(`Every job, live patch ${B.SIM_PATCH}, ${cfg.iterations} iterations each, ${cfg.duration}s, party: ${o.party || 'none'}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    for (const r of rows) console.log(`${pad(r.name, 14)} ${pad(r.role, 7)} ${lpad(fmt(r.mean), 8)} ± ${lpad(fmt(r.err), 4)}   GCD ${r.gcd.toFixed(2)}   ${r.version}`);
    if (o.json) fs.writeFileSync(o.json, JSON.stringify(rows, null, 1));
    return;
  }

  const R = await B.Sim.run(cfg, { onProgress: (f, l) => process.stderr.write(`\r${lpad((f * 100).toFixed(0), 3)}% ${pad(l, 22)}`) });
  process.stderr.write('\r' + ' '.repeat(34) + '\r');
  const S = R.summary;
  console.log(`${R.jobName} — ${R.versionLabel}${B.liveVersion(R.job).id === R.version ? ` (live ${R.patch})` : ' (not the live version)'}`);
  console.log(`  ${R.settings.iterations} iterations, ${fmt(R.fight, 1)}s average fight, ${R.settings.targets} target(s), ping ${R.settings.ping}ms, ${(R.ms / 1000).toFixed(1)}s`);
  if (R.party.length) console.log(`  Party buffs: ${R.party.join(', ')}`);
  console.log(`  Stats: main ${R.stats.main}  WD ${R.stats.wd}  DET ${R.stats.det}  CRT ${R.stats.crit}  DH ${R.stats.dh}  speed ${R.stats.speed}${R.stats.ten ? '  TEN ' + R.stats.ten : ''}  (GCD ${R.gcd.toFixed(2)})`);
  for (const w of R.warnings) console.log(`  warning: ${w}`);
  console.log('');
  console.log(`  DPS ${fmt(S.mean, 1)}  ±${fmt(S.err, 1)} (95%)   min ${fmt(S.min)}  median ${fmt(S.median)}  max ${fmt(S.max)}   sd ${fmt(S.sd, 1)}`);
  console.log(`  ${fmt(R.gcdsPerMin, 2)} GCDs a minute, idle ${pct(R.idle)}`);
  console.log('');
  console.log(`  ${pad('Action', 26)} ${lpad('DPS', 8)} ${lpad('share', 6)} ${lpad('casts', 6)} ${lpad('hits', 6)} ${lpad('avg', 8)} ${lpad('crit', 6)} ${lpad('DH', 6)}`);
  for (const a of R.abilities) {
    console.log(`  ${pad(a.name + (a.dot ? ' (DoT)' : ''), 26)} ${lpad(fmt(a.dps), 8)} ${lpad(pct(a.share), 6)} ${lpad(fmt(a.casts, 1), 6)} ${lpad(fmt(a.hits, 1), 6)} ${lpad(fmt(a.avg), 8)} ${lpad(pct(a.crit, 0), 6)} ${lpad(pct(a.dh, 0), 6)}`);
  }
  const noDamage = R.uses.filter(u => !R.abilities.some(a => a.id === u.id));
  if (noDamage.length) console.log('  Also used: ' + noDamage.map(u => `${u.name} ×${fmt(u.count, 1)}`).join(', '));
  console.log('');
  console.log('  Uptime: ' + R.buffs.slice(0, 14).map(b => `${b.name} ${pct(b.uptime, 0)}`).join(', '));
  if (R.weights.length) {
    console.log('');
    console.log('  Stat weights (DPS per point, normalised to main stat):');
    for (const w of R.weights) console.log(`    ${pad(w.stat, 6)} ${lpad(w.perPoint.toFixed(3), 7)} ±${w.err.toFixed(3)}   ${w.norm !== null ? w.norm.toFixed(3) : '-'}`);
  }
  if (o.seq === '1') {
    console.log('');
    for (const s of R.seq.slice(0, +(o.seqn || 80))) console.log(`  ${lpad(s.t.toFixed(2), 7)} ${s.gcd ? '' : '  · '}${s.name}  [line ${s.line}]`);
  }
  if (o.json) fs.writeFileSync(o.json, JSON.stringify(R, null, 1));
}

main().catch(err => { console.error(err.stack || err); process.exit(1); });

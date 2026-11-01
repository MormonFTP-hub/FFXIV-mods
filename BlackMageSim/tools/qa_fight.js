// The /qa self-check without the browser: loads a fight's script (js/fights/<key>.js) with the sim's mechanics and
// party code, fast-forwards whole pulls with a perfect player in every spot for every strat (or the ones asked for),
// and lists everything that hit anyone it shouldn't have. For building fights from the command line.
//
//   node BlackMageSim/tools/qa_fight.js m6s                 every strat, every spot, once
//   node BlackMageSim/tools/qa_fight.js m6s hector 3        one strat, three times each
//   node BlackMageSim/tools/qa_fight.js m6s --logs          the bots against the fight's FFLogs reference
//   node BlackMageSim/tools/qa_fight.js m6s --plan hector   the pull's plan (mechanics, spots) as text, for reading
//
// The fight's timeline comes from work/fights/<key>.json (tools/export_map.py <key> --timeline) or, failing that, the
// fight's exported map (work/game-map-<key>.js).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SIM = path.resolve(__dirname, '..');
const [key, ...rest] = process.argv.slice(2);
if (!key) { console.log('usage: node qa_fight.js <fight> [strat] [runs] [--logs] [--plan strat]'); process.exit(1); }

// A page that isn't there: just enough of window and document for the party and fight code.
const el = () => new Proxy({ style: {}, dataset: {}, children: [] }, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'classList') return { toggle() {}, add() {}, remove() {}, contains() { return false; } };
    if (k === 'querySelector') return () => el();
    if (k === 'querySelectorAll') return () => [];
    if (typeof k === 'string' && /^(appendChild|insertBefore|remove|addEventListener|setAttribute)$/.test(k)) return () => {};
    return undefined;
  },
  set(t, k, v) { t[k] = v; return true; },
});
const ctx = { console, setTimeout, Math, JSON, Promise, Object, Array, Set, Map, Number, String, Boolean, Error };
ctx.window = ctx;
ctx.BLM = {};
ctx.document = { querySelector: () => el(), querySelectorAll: () => [], body: el(), createElement: () => el() };
vm.createContext(ctx);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(SIM, f), 'utf8'), ctx, { filename: f });
for (const f of ['js/mech.js', 'js/party.js', 'js/fight.js']) load(f);
const B = ctx.BLM;
B.jobIcon = () => '';
B.GAME_MODELS = { jobs: {} };
const script = `js/fights/${key}.js`;
if (!fs.existsSync(path.join(SIM, script))) { console.log(`no ${script}`); process.exit(1); }
load(script);
if (fs.existsSync(path.join(SIM, `js/fights/${key}_ref.js`))) load(`js/fights/${key}_ref.js`);

// The fight's data: its timeline file, or its map.
let data = null;
const tl = path.join(SIM, 'work', 'fights', `${key}.json`);
if (fs.existsSync(tl)) data = JSON.parse(fs.readFileSync(tl, 'utf8')).fight;
else {
  const mp = path.join(SIM, 'work', `game-map-${key}.js`);
  if (!fs.existsSync(mp)) { console.log(`no timeline: run  python -P -E BlackMageSim/tools/export_map.py ${key} --timeline`); process.exit(1); }
  ctx.BLM.GAME_MAPS = {};
  vm.runInContext(fs.readFileSync(mp, 'utf8'), ctx);
  data = ctx.BLM.GAME_MAPS[key].fight;
}

// The app, cut down to what the mechanics, the party and the fight touch.
const app = {
  qa: true,                 // a perfect player: does what movement checks ask (stand still, keep moving)
  store: { settings: { strats: {}, partySlot: 'auto', takeDamage: true, showSpot: true } },
  engine: { pos: { x: 0, y: 0, z: -8 }, now: 0, maxHp: 100000, hp: 100000, job: { role: 'caster', id: 'blm' }, facing: Math.PI, ko: false, untargetable: false, interrupt() {}, has: () => false, queue: [], outMult: 1 },
  ui: { log() {}, callout() {}, fly() {}, count() {} },
  scene: { mageHead: () => null },
  sfx: { play() {} },
  enc: null,
  endEncounter() {},
  placeStart() { this.engine.pos.x = 0; this.engine.pos.z = -8; },
};
B.app = app;
app.party = new B.Party(app);
app.fight = new B.Fight(app, key, data);
app.party.setup();
const F = app.fight;
if (!F.mech) { console.log(`${key}: the script didn't register (B.FIGHT_SCRIPTS.${key})`); process.exit(1); }

(async () => {
  if (rest[0] === '--plan') {
    app.store.settings.strats = { [key]: rest[1] || F.script.defaultStrat };
    F.reset();
    const P = F.mech.plan, f2 = (v) => (typeof v === 'function' ? 'fn' : `[${v.map(x => x.toFixed(1)).join(',')}]`);
    console.log(`plan for ${rest[1] || F.script.defaultStrat}: ${P.hazards.length} attacks, ${P.checks.length} checks, ${P.prefs.length} spot changes`);
    const rows = [];
    for (const h of P.hazards) rows.push([h.t, `HIT  ${h.name} ${h.raidwide ? 'raidwide' : h.shape}${h.dir ? ' dir ' + h.dir : ''}${h.r ? ' r ' + h.r : ''}${h.r0 ? ' r0 ' + h.r0 : ''}${h.deg !== undefined ? ' deg ' + h.deg : ''}${h.set ? ' tiles ' + h.set.size : ''}`]);
    for (const c of P.checks) rows.push([c.t, `CHK  ${c.name} ${c.kind}${c.slots ? ' ' + c.slots.join('+') : ''}`]);
    for (const p of P.prefs) rows.push([p.t, `SPOT ${Object.entries(p.spots).map(([s, v]) => s + f2(v)).join(' ')}`]);
    for (const c of P.calls) rows.push([c.t, `CALL ${c.slot ? c.slot + ': ' : ''}${c.text}`]);
    rows.sort((a, b) => a[0] - b[0]).forEach(([t, s]) => console.log(`${t.toFixed(1).padStart(6)}  ${s}`));
    return;
  }
  if (rest[0] === '--logs') {
    const res = await B.mechLogCheck(app, {});
    if (!res) { console.log('no FFLogs reference for this fight'); return; }
    for (const m of res.mechs) {
      if (m.missing) { console.log(`${m.name}: not in this pull`); continue; }
      console.log(`${m.name}: ${m.mean.toFixed(1)}y  ` + m.slots.map(s => `${s.slot} ${s.off.toFixed(1)}`).join(' ') + (m.loose.length ? `  (loose ${m.loose.join(',')})` : ''));
    }
    return;
  }
  const strats = rest[0] && F.script.strats[rest[0]] ? [rest[0]] : Object.keys(F.script.strats);
  const reps = parseInt(rest.find(x => /^\d+$/.test(x)), 10) || 1;
  const res = await B.mechQA(app, { strats, reps });
  const bad = new Set(res.issues.map(i => `${i.strat}:${i.slot}`)), by = {};
  for (const i of res.issues) by[`${i.what} (${i.why})`] = (by[`${i.what} (${i.why})`] || 0) + 1;
  console.log(`${key}: ${res.runs - bad.size} of ${res.runs} pulls clean (${strats.join(', ')})`);
  for (const [k, n] of Object.entries(by).sort((a, b) => b[1] - a[1])) console.log(`  x${n}  ${k}`);
  for (const i of res.issues.slice(0, 25)) console.log(`    ${i.strat}/${i.slot} t${i.t.toFixed(1)} ${i.who} ${i.what}: ${i.why} @${i.at}`);
})();

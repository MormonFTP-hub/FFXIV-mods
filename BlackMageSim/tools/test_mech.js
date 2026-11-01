// Tests for the mechanics toolkit (js/mech.js): each of the game's standard mechanics (stacks, spreads, towers,
// knockbacks and draw-ins, gazes, line stacks, tethers, chasers, exaflares, lasting puddles) set up with the party
// standing where the test puts them, checked for who gets hit and why, and the bots' dodging checked against a
// knockback into a follow-up attack. Runs without the browser:
//
//   node BlackMageSim/tools/test_mech.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SIM = path.resolve(__dirname, '..');
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
for (const f of ['js/mech.js', 'js/party.js', 'js/fight.js']) vm.runInContext(fs.readFileSync(path.join(SIM, f), 'utf8'), ctx, { filename: f });
const B = ctx.BLM;
B.jobIcon = () => '';
B.GAME_MODELS = { jobs: {} };

// A fight whose plan is whatever the test sets (PLAN), with the party at the spots the test gives.
let PLAN_WALLS = null;
let PLAN = () => ({ start: Object.fromEntries(B.SLOTS.map(s => [s, [0, -10]])), prefs: [], hazards: [], checks: [], calls: [], marks: [], labels: new Map(), debuffs: [] });
B.FIGHT_SCRIPTS = { toolkit: { hp: 1e9, defaultStrat: 'test', strats: { test: { label: 'test' } }, plan: () => PLAN() } };
const statuses = new Set();
const app = {
  store: { settings: { strats: {}, partySlot: 'R2', takeDamage: true, showSpot: true } },
  engine: { pos: { x: 0, y: 0, z: -8 }, now: 0, maxHp: 100000, hp: 100000, job: { role: 'caster', id: 'blm' }, facing: Math.PI, ko: false, has: (k) => statuses.has(k), interrupt() {}, queue: [], outMult: 1 },
  ui: { log() {}, callout() {}, fly() {}, count() {} },
  scene: { mageHead: () => null },
  sfx: { play() {} },
  enc: null,
  endEncounter() {},
  placeStart() {},
};
B.app = app;
app.party = new B.Party(app);
const data = { duty: 'Toolkit test', boss: 'Test', hitbox: 5, events: [], untargetable: [], enrage: 60 };
app.fight = new B.Fight(app, 'toolkit', data);
app.party.setup();
const F = app.fight, P = app.party;

// One scenario: the plan's hazards, everyone's spot ([E, N]; the player is R2), then the fight run to `until`.
function run({ hazards = [], spots = {}, until = 10, arena, boss, move = false, facing }) {
  const start = Object.assign(Object.fromEntries(B.SLOTS.map((s, i) => [s, B.bearing(i * 45, 30)])), spots);
  PLAN = () => ({ start, prefs: [], hazards: hazards.map(h => Object.assign({ name: 'test', dmg: 0.3, tell: 0 }, h)), checks: [], calls: [], marks: [], labels: new Map(), debuffs: [], arena, boss, walls: PLAN_WALLS || undefined });
  F.reset(); P.setup();
  for (const b of P.bots) b.pos = start[b.slot].slice();
  const me = B.toSim(start.R2); app.engine.pos.x = me.x; app.engine.pos.z = me.z;
  if (facing !== undefined) app.engine.faceYaw = -facing * Math.PI / 180;
  const hurt = [], keep = P.hurt;
  P.hurt = (slot, share, src, why) => hurt.push({ slot, share: +share.toFixed(3), why: why || null });
  const dt = 0.05;
  for (let t = 0; t <= until; t += dt) {
    F.t = t;
    if (move) {
      const s = B.toSim(F.mech.target('R2', t, P.compassOf('R2')));
      const dx = s.x - app.engine.pos.x, dz = s.z - app.engine.pos.z, d = Math.hypot(dx, dz), step = Math.min(d, 6 * dt);
      if (d > 0.01 && !P.knocked('R2')) { app.engine.pos.x += dx / d * step; app.engine.pos.z += dz / d * step; }
    }
    F.mech.update(t);
    if (move) P.update(dt);
    else for (const [slot, k] of Object.entries(P.pushes)) {      // without the bots walking: just the knockback slides
      const q = k.to;
      if (slot === 'R2') { const s = B.toSim(q); app.engine.pos.x = s.x; app.engine.pos.z = s.z; } else P.bot(slot).pos = q.slice();
      delete P.pushes[slot]; app.engine.knocked = false;
    }
  }
  P.hurt = keep;
  return { hurt, at: (s) => P.compassOf(s).map(v => +v.toFixed(2)) };
}

let pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) pass++; else { fail++; console.log(`FAIL ${name}${info ? ': ' + JSON.stringify(info) : ''}`); }
}
const whys = (r, slot) => r.hurt.filter(h => h.slot === slot).map(h => h.why);

// Stacks: a light-party stack on H1 (r 6, 4 to share it).
{
  const h = { t: 5, effect: 'share', shape: 'circle', r: 6, from: 'target', targets: ['H1'], min: 4, dmg: 0.4 };
  let r = run({ hazards: [h], spots: { H1: [0, -10], MT: [1, -10], M1: [-1, -10], R2: [0, -11] } });
  check('stack of 4: shared, no failures', r.hurt.filter(x => x.why).length === 0 && r.hurt.length === 4, r.hurt);
  check('stack of 4: each takes its share', r.hurt.every(x => Math.abs(x.share - 0.4) < 1e-6), r.hurt);
  r = run({ hazards: [h], spots: { H1: [0, -10], R2: [0, -11] } });
  check('stack short', whys(r, 'R2')[0] === 'a stack short: 2 of 4', r.hurt);
  // Several stacks at once are one attack with several targets (so standing in two shows).
  r = run({ hazards: [{ ...h, targets: ['H1', 'H2'] }], spots: { H1: [0, -8], H2: [0, -16], R2: [0, -12] } });
  check('standing in two stacks', whys(r, 'R2')[0] === 'in 2 stacks at once', r.hurt);
}

// Spreads: a 5-yalm circle on everyone.
{
  const h = { t: 5, effect: 'bait', shape: 'circle', r: 5, from: 'target', targets: { role: 'dps' }, dmg: 0.5, own: 0.2 };
  let r = run({ hazards: [h], spots: { M1: [0, 0], M2: [10, 0], R1: [-10, 0], R2: [0, -10] } });
  check('spread apart: each takes its own', r.hurt.length === 4 && r.hurt.every(x => !x.why && x.share === 0.2), r.hurt);
  r = run({ hazards: [h], spots: { M1: [0, 0], M2: [10, 0], R1: [-10, 0], R2: [0, -3] } });
  check('spread too close', whys(r, 'R2').includes("in M1's test") && whys(r, 'M1').includes("in R2's test"), r.hurt);
}

// Towers: two to soak, r 3.
{
  const h = { t: 5, effect: 'tower', shape: 'circle', r: 3, at: [0, -10], soak: 2, dmg: 0.3, fail: 0.9 };
  let r = run({ hazards: [h], spots: { R2: [0, -10], M2: [1, -10] } });
  check('tower soaked by 2', r.hurt.length === 2 && r.hurt.every(x => !x.why), r.hurt);
  r = run({ hazards: [h], spots: { R2: [0, -10] } });
  check('tower short hits everyone', r.hurt.length === 8 && r.hurt.every(x => x.why === 'a tower short: 1 of 2'), r.hurt);
  r = run({ hazards: [{ ...h, soak: [1, 2] }], spots: { R2: [0, -10], M2: [1, -10], R1: [-1, -10] } });
  check('tower over-soaked', whys(r, 'R2')[0] === 'too many in a tower: 3 of 2', r.hurt);
}

// Knockbacks: 10 yalms from the boss; a round arena of 20 with a deathwall.
{
  const kb = { t: 5, effect: 'knockback', from: 'boss', dist: 10, dmg: 0 };
  let r = run({ hazards: [kb], spots: { R2: [0, -5] } });
  check('knocked 10 away from the middle', JSON.stringify(r.at('R2')) === JSON.stringify([0, -15]), r.at('R2'));
  r = run({ hazards: [kb], spots: { R2: [0, -15] }, arena: { shape: 'circle', r: 20, deathwall: true } });
  check('knocked off a deathwall arena', whys(r, 'R2')[0] === 'knocked off the arena', r.hurt);
  r = run({ hazards: [kb], spots: { R2: [0, -15] }, arena: { shape: 'circle', r: 20 } });
  check('a wall stops you', !r.hurt.length && Math.hypot(...r.at('R2')) < 20, { at: r.at('R2'), hurt: r.hurt });
  statuses.add('armsLength');
  r = run({ hazards: [kb], spots: { R2: [0, -5] } });
  statuses.clear();
  check("Arm's Length stops it", JSON.stringify(r.at('R2')) === JSON.stringify([0, -5]), r.at('R2'));
  r = run({ hazards: [{ ...kb, immune: ['M1'] }], spots: { M1: [0, 5] } });
  check('a bot using it stays', JSON.stringify(r.at('M1')) === JSON.stringify([0, 5]), r.at('M1'));
  r = run({ hazards: [{ ...kb, dir: 90 }], spots: { R2: [0, -5] } });
  check('knocked east', JSON.stringify(r.at('R2')) === JSON.stringify([10, -5]), r.at('R2'));
  r = run({ hazards: [{ t: 5, effect: 'pull', from: 'boss', dist: 30, minDist: 2 }], spots: { R2: [0, -12] } });
  check('drawn in, stopping 2 short', JSON.stringify(r.at('R2')) === JSON.stringify([0, -2]), r.at('R2'));
  r = run({ hazards: [kb], spots: { R2: [0, -5] }, boss: [{ t: 0, at: [0, -10] }] });
  check('knocked away from a boss that moved', JSON.stringify(r.at('R2')) === JSON.stringify([0, 5]), r.at('R2'));
}

// The bots against a knockback into an attack: thrown 12 from the middle at 5, then the north half hits at 7.
// Anyone wanting to stand north must start south of the middle instead (or far enough east/west) to land safe.
{
  const hz = [{ t: 5, tell: 1, effect: 'knockback', from: 'boss', dist: 12, react: 4 },
    { t: 7, tell: 1, shape: 'half', dir: [0, 1], dmg: 0.8, name: 'north half' }];
  const spots = Object.fromEntries(B.SLOTS.map((s, i) => [s, B.bearing(-60 + i * 17, 4)]));      // all north of the middle
  const r = run({ hazards: hz, spots, move: true, until: 9 });
  check('bots and player land clear of the follow-up', r.hurt.length === 0, r.hurt);
}

// A gaze from the boss: facing it hurts, facing away doesn't.
{
  const g = { t: 5, effect: 'gaze', from: 'boss', dmg: 0.5 };
  let r = run({ hazards: [g], spots: { R2: [0, -10] }, facing: 0 });         // looking north, at the boss
  check('looking at the gaze', whys(r, 'R2')[0] === 'looked at the gaze', r.hurt);
  r = run({ hazards: [g], spots: { R2: [0, -10] }, facing: 180 });
  check('looking away', !r.hurt.length, r.hurt);
}

// A line stack from the boss at H1 (8 wide), shared by 4.
{
  const h = { t: 5, effect: 'share', shape: 'line', from: 'boss', aim: 'target', targets: ['H1'], len: 40, w: 8, min: 4, dmg: 0.4 };
  const r = run({ hazards: [h], spots: { H1: [0, -12], MT: [2, -8], M1: [-2, -10], R2: [0, -6] } });
  check('line stack shared', r.hurt.length === 4 && r.hurt.every(x => !x.why), r.hurt);
}

// A tether that must be stretched to 15 yalms.
{
  const h = { t: 5, effect: 'bait', shape: 'circle', r: 4, from: 'target', targets: ['R2'], tether: 'boss', stretch: 15, dmg: 0.4 };
  let r = run({ hazards: [h], spots: { R2: [0, -8] } });
  check('tether too short', String(whys(r, 'R2')[0]).startsWith('tether not stretched'), r.hurt);
  r = run({ hazards: [h], spots: { R2: [0, -16] } });
  check('tether stretched', !r.hurt.some(x => x.why), r.hurt);
}

// A baited puddle that locks in a second before it lands: whoever moves after it locks is safe.
{
  const h = { t: 5, effect: 'hit', shape: 'circle', r: 4, from: 'target', targets: ['R2'], snap: 1, dmg: 0.4 };
  let r = run({ hazards: [h], spots: { R2: [0, -10] } });
  check('stood still under a baited puddle', r.hurt.length === 1, r.hurt);
}

// Sequences.
{
  const ex = B.mechSeq.exaflare({ at: [-18, 0], deg: 90, t: 5 });
  check('exaflare steps across the floor', ex.length === 7 && ex[6].at[0] > 20, ex.map(h => h.at));
  const rot = B.mechSeq.rotating({ deg: 0, by: 72, t: 5, n: 5, every: 4.3 });
  check('rotating cleave turns', rot[4].deg === 288 && rot[1].t === 9.3, rot.map(h => [h.t, h.deg]));
  const ch = B.mechSeq.chase({ target: 'R2', t: 5, n: 3, every: 1.5, move: 4 });
  const r = run({ hazards: ch, spots: { R2: [0, -10] }, until: 9 });
  check('a chaser lands on you when you stand still', r.hurt.length === 3, r.hurt);
}

// A lasting puddle: 4 seconds of ticks.
{
  const h = { t: 2, shape: 'circle', r: 5, at: [0, -10], lasts: 4, tick: 1, dmg: 0.5, tickDmg: 0.1 };
  const r = run({ hazards: [h], spots: { R2: [0, -10] } });
  check('puddle ticks while you stand in it', r.hurt.length === 5, r.hurt);
}

// Walking off a deathwall arena's edge is a KO.
{
  const r = run({ hazards: [], spots: { R2: [0, -15] }, arena: { shape: 'circle', r: 12, deathwall: true }, until: 1 });
  check('off a deathwall arena on foot', whys(r, 'R2')[0] === 'fell off the arena', r.hurt);
}

// Thrown off platforms with no floor between them (no deathwall): back onto the nearest platform, not the middle.
{
  const arena = { parts: [{ shape: 'circle', at: [-15, 0], r: 5 }, { shape: 'circle', at: [15, 0], r: 5 }] };
  const r = run({ hazards: [{ t: 5, effect: 'knockback', from: [15, 0], dist: 10 }], spots: { R2: [12, 0] }, arena });
  const q = r.at('R2');
  check('back onto the nearest platform', Math.hypot(q[0] - 15, q[1]) < 5.01 && q[0] < 11, q);
}

// A tank-only tower: a healer in it is hit and doesn't count.
{
  const h = { t: 5, effect: 'tower', shape: 'circle', r: 3, at: [0, -10], soak: 1, only: { role: 'tank' }, dmg: 0.3, fail: 0.9 };
  let r = run({ hazards: [h], spots: { MT: [0, -10] } });
  check('tank tower soaked by a tank', r.hurt.length === 1 && !r.hurt[0].why, r.hurt);
  r = run({ hazards: [h], spots: { H1: [0, -10] } });
  check('a healer in a tank tower', whys(r, 'H1').includes("in a tower that isn't yours") && r.hurt.filter(x => x.why === 'a tower nobody soaked').length === 8, r.hurt);
}

// A puddle that grows: 2 yalms, then 1 a second more (ticks at r 3-7); standing 4 yalms out, 4 ticks reach you.
{
  const h = { t: 1, shape: 'circle', r: 2, at: [0, -10], lasts: 5, tick: 1, grow: 1, dmg: 0.4, tickDmg: 0.1 };
  const r = run({ hazards: [h], spots: { R2: [0, -14] } });
  check('a growing puddle reaches you', r.hurt.length === 4, r.hurt);
}

// A flare (a bait with falloff): close to it hurts and counts, far out barely.
{
  const h = { t: 5, effect: 'bait', shape: 'circle', r: 30, from: 'target', targets: ['MT'], falloff: 30, dmg: 1, own: 0.5 };
  let r = run({ hazards: [h], spots: { MT: [0, 15], R2: [0, 10] } });
  check('close to a flare', String(whys(r, 'R2')[0]).startsWith('too close'), r.hurt);
  r = run({ hazards: [h], spots: { MT: [0, 15], R2: [0, -12] } });
  check('far from a flare', r.hurt.filter(x => x.slot === 'R2').every(x => !x.why), r.hurt);
}

// Chasers on two players: each follows its own.
{
  const a = { t: 3, shape: 'circle', r: 3, from: 'target', targets: ['R2', 'M1'], snap: 0.2, dmg: 0.4, name: 'chase' };
  const b = { t: 5, shape: 'circle', r: 3, from: 'target', targets: ['R2', 'M1'], snap: 0.2, dmg: 0.4, name: 'chase', after: a, move: 4 };
  const r = run({ hazards: [a, b], spots: { R2: [0, -10], M1: [10, 10] } });
  check('two chasers, each on its own target', r.hurt.filter(x => x.slot === 'R2').length === 2 && r.hurt.filter(x => x.slot === 'M1').length === 2, r.hurt);
}

// ifAlive: an attack that only comes while the adds are up (none here: it never comes).
{
  const r = run({ hazards: [{ t: 5, raidwide: true, dmg: 0.5, ifAlive: 0 }] });
  check('no adds alive: it never comes', r.hurt.length === 0, r.hurt);
}

// A knockback aimed at one player throws only them.
{
  const r = run({ hazards: [{ t: 5, effect: 'knockback', from: 'boss', targets: ['R2'], dist: 10 }], spots: { R2: [0, -5], M1: [0, 5] } });
  check('a targeted knockback throws its target', JSON.stringify(r.at('R2')) === JSON.stringify([0, -15]), r.at('R2'));
  check('and nobody else', JSON.stringify(r.at('M1')) === JSON.stringify([0, 5]), r.at('M1'));
}

// A diamond floor (a turned square) with a deathwall: off its corner-cut edge on foot is a KO.
{
  const arena = { shape: 'line', at: [0, -14], deg: 45, len: 28, back: 0, w: 28, deathwall: true };
  let r = run({ hazards: [], spots: { R2: [0, -2] }, arena, until: 1 });
  check('inside a diamond floor', !r.hurt.length, r.hurt);
  r = run({ hazards: [], spots: { R2: [-14, -14] }, arena, until: 1 });
  check('off a diamond floor', whys(r, 'R2')[0] === 'fell off the arena', r.hurt);
}

// A cleave turned 90 degrees off its target: it misses them and hits whoever's beside.
{
  const h = { t: 5, shape: 'cone', r: 20, half: 20, from: 'boss', aim: 'target', targets: ['MT'], turn: 90, dmg: 0.5 };
  const r = run({ hazards: [h], spots: { MT: [0, 10], R2: [10, 0] } });
  check('a turned cleave', r.hurt.length === 1 && r.hurt[0].slot === 'R2', r.hurt);
}

// Stand still / keep moving, judged by whether you're walking as it lands.
{
  let r = run({ hazards: [{ t: 5, effect: 'still', dmg: 0.5, name: 'Pyretic' }], spots: { R2: [0, -10] } });
  check('standing still under Pyretic', !r.hurt.length, r.hurt);
  r = run({ hazards: [{ t: 5, effect: 'moving', dmg: 0.5, name: 'Freezing' }], spots: { R2: [0, -10] } });
  check('standing still under Freezing', whys(r, 'R2')[0] === 'stood still', r.hurt);
}

// A gaze with a reach: far enough away, looking at it is fine.
{
  const g = { t: 5, effect: 'gaze', from: 'boss', range: 8, dmg: 0.5 };
  const r = run({ hazards: [g], spots: { R2: [0, -12] }, facing: 0 });
  check('a gaze out of reach', !r.hurt.length, r.hurt);
}

// A wall stops a knockback short.
{
  PLAN_WALLS = [{ shape: 'rect', a: [-5, -12], b: [5, -11] }];
  const r = run({ hazards: [{ t: 5, effect: 'knockback', from: 'boss', dist: 10 }], spots: { R2: [0, -5] } });
  PLAN_WALLS = null;
  check('a wall stops a knockback', r.at('R2')[1] > -11 && r.at('R2')[1] < -9.5, r.at('R2'));
}

// A phase push: skipping from second 2 to 6 passes over the attack at 3 and keeps the one at 8.
{
  const hz = [{ t: 3, shape: 'circle', r: 5, at: [0, -10], name: 'skipped' }, { t: 8, shape: 'circle', r: 5, at: [0, -10], name: 'kept' }];
  const start = Object.fromEntries(B.SLOTS.map((s, i) => [s, B.bearing(i * 45, 30)]));
  start.R2 = [0, -10];
  PLAN = () => ({ start, prefs: [], hazards: hz.map(h => Object.assign({ dmg: 0.3, tell: 0 }, h)), checks: [], calls: [], marks: [], labels: new Map(), debuffs: [] });
  F.reset(); P.setup();
  for (const b of P.bots) b.pos = start[b.slot].slice();
  app.engine.pos.x = 0; app.engine.pos.z = -10;
  const hurt = [], keep = P.hurt;
  P.hurt = (slot, share, src) => hurt.push(src);
  for (let t = 0; t <= 2; t += 0.05) { F.t = t; F.mech.update(t); }
  F.t = 2; F.jump(6, 'test push');
  for (let t = 6; t <= 10; t += 0.05) { F.t = t; F.mech.update(t); }
  P.hurt = keep;
  check('a phase push skips what it passes over', hurt.length === 1 && hurt[0] === 'kept', hurt);
}

// A boss that leaps: tank cones and proteans come from where it stands.
{
  const h = { t: 5, shape: 'protean', half: 15, r: 40, dmg: 0.3 };
  const r = run({ hazards: [h], spots: { R2: [10, -10], M1: [10, -20] }, boss: [{ t: 0, at: [10, 0] }] });
  check('a protean from a boss that moved', whys(r, 'R2').some(w => w && w.includes('protean')), r.hurt);
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

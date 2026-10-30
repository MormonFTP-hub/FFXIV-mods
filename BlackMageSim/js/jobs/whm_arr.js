// White Mage, A Realm Reborn at level 50, built on the Heavensward class (whm_hw.js). Cleric Stance swaps Mind into
// Intelligence (+10%); Stone II (170) is the filler with Aero (50 + 25 × 18s, instant) and Aero II (50 + 40 × 12s) as two
// DoTs; Fluid Aura (150, 30s); Presence of Mind 20% faster casts; Shroud of Saints is the only MP refill (Refresh 80 =
// 213 MP a tick for 15s). Not yet: Stone III, Aero III, Assize, Tetragrammaton and Asylum (all 3.0). Every MP cost is the
// ARR percentage of level 50's 2,660 (Stone II 7% = 186, Aero 6% = 160, Aero II 11% = 293), from a pool of
// 1.24 × (1,665 + 4.81 × Piety). ARR's damage formula (B.LEVELS.arr50).
//  - 2.0: Holy 240, Thunder from Thaumaturge as a third DoT (30 + 35 × 18s, 213 MP), Presence of Mind 10s on 300s;
//    Binding Coil i90 gear (Thyrus Zenith, Mind 498) with the NQ X-Potion of Mind (max 67).
//  - 2.1–2.28: Holy 200, Thunder gone (Blizzard II cross-class instead); Second Coil gear (High Allagan Crook, Mind 578).
//  - 2.3–2.57: Presence of Mind 15s on 150s; Final Coil gear with Nirvana Zeta (Mind 665).
// A scripted rotation parses about 273, 226 and 183 over 5 minutes, MP-bound: Stone II costs 186 against about 80 MP
// a tick. Numbers are the Lodestone notes for 2.1 and 2.3, Gamer Escape's and the Console Games Wiki's 2013–15 pages.
(function (B) {
  const HW = B.WhiteMageHW;
  const MP_SCALE = 2660 / 8840;
  const set = B.setAction;     // a version's change to an action (its description's numbers follow the potency)

  const VERSIONS = {
    arr23: { label: 'A Realm Reborn 2.3–2.57', history: 'ARR 2.3–2.57', holy: 200, pom: [150, 15], maxMp: 3896, potion: 84, ref: 290,
      stats: { hp: 8500, main: 665, wd: 82, det: 305, crit: 552, speed: 520, piety: 307, delay: 3.36 },
      gear: 'a Final Coil set with Nirvana Zeta (Mind 665, 82 magic damage)',
      note: 'Level 50: Cleric Stance, Stone II with Aero and Aero II, Fluid Aura, Presence of Mind 15s; Shroud of Saints for MP; Final Coil gear' },
    arr21: { label: 'A Realm Reborn 2.1–2.28', history: 'ARR 2.1–2.28', holy: 200, pom: [300, 10], maxMp: 4146, potion: 84, ref: 240,
      stats: { hp: 7500, main: 578, wd: 77, det: 267, crit: 431, speed: 509, piety: 349, delay: 3.36 },
      gear: 'a Second Coil set with the High Allagan Crook (Mind 578, 77 magic damage)',
      note: 'Level 50: Cleric Stance, Stone II with Aero and Aero II, Presence of Mind 10s every five minutes; Second Coil gear' },
    arr20: { label: 'A Realm Reborn 2.0–2.0', history: 'ARR 2.0–2.0', holy: 240, pom: [300, 10], maxMp: 4212, potion: 67, thunder: true, ref: 195,
      stats: { hp: 6500, main: 498, wd: 69, det: 287, crit: 396, speed: 415, piety: 360, delay: 3.44 },
      gear: 'the Binding Coil i90 set with Thyrus Zenith (Mind 498, 69 magic damage)',
      note: 'Level 50 at launch: Thunder as a third DoT, Holy 240, Presence of Mind 10s every five minutes; Binding Coil gear' },
  };

  class WhiteMageARR extends HW {
    constructor(v) {
      super();
      const V = this.V = VERSIONS[v];
      this.level = 50;
      this.levelKey = 'arr50';
      this.maxMp = V.maxMp;
      this.potionCap = V.potion;
      this.shroudMp = 213;
      this.pomDur = V.pom[1];
      const A = Object.assign({}, this.actions);
      for (const k of ['stone3', 'aero3', 'assize', 'tetragrammaton', 'asylum']) delete A[k];
      for (const k of Object.keys(A)) if (A[k] && A[k].mp) A[k] = Object.assign({}, A[k], { mp: Math.round(A[k].mp * MP_SCALE) });
      set(A, 'stone2', { mp: 186 });
      set(A, 'aero', { mp: 160 });
      set(A, 'aero2', { mp: 293, dot: { potency: 40, duration: 12 }, desc: 'Deals wind damage with a potency of 50.\nAdditional Effect: Wind damage over time\nPotency: 40\nDuration: 12s' });
      set(A, 'holy', V.holy === 240
        ? { potency: 240, mp: 532, aoe: true, desc: 'Deals unaspected damage with a potency of 240 to all nearby enemies.\nAdditional Effect: Stun\nDuration: 4s' }
        : { potency: 200, mp: 532 });
      set(A, 'presenceOfMind', { recast: V.pom[0], desc: `Reduces spell cast time and recast time by 20%.\nDuration: ${V.pom[1]}s` });
      set(A, 'shroudOfSaints', { recast: 180 });
      if (V.thunder) {
        A.thunder = { name: 'Thunder', kind: 'gcd', school: 'thunder', sound: 'thunder', potency: 30, cast: 2.5, mp: 213, delay: 0.8, target: true, range: 25,
          dot: { potency: 35, duration: 18 }, desc: 'Deals lightning damage with a potency of 30.\nAdditional Effect: Lightning damage over time\nPotency: 35\nDuration: 18s\n(Thaumaturge cross-class skill)' };
      } else {
        A.blizzard2 = { name: 'Blizzard II', kind: 'gcd', school: 'ice', sound: 'ice', potency: 50, cast: 2.5, mp: 213, delay: 0.8, target: false, pbaoe: 5, aoe: true,
          desc: 'Deals ice damage with a potency of 50 to all nearby enemies.\nAdditional Effect: Bind\nDuration: 8s\n(Thaumaturge cross-class skill)' };
      }
      A.tincture = Object.assign({}, A.tincture, { name: 'X-Potion of Mind', desc: `This diluted brew temporarily increases mind.\nMind +20% (Max ${V.potion})\nDuration: 15s` });
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, { thunder: { name: 'Thunder', self: false, icon: 'st_thunder' } });
      this.stats = Object.assign({}, this.stats, V.stats, { int: 220, dh: 341 });
      this.targetStatusOrder = V.thunder ? ['aero2', 'aero', 'thunder'] : ['aero2', 'aero'];
      this.defaultBars = [
        ['stone2', 'aero', 'aero2', V.thunder ? 'thunder' : 'blizzard2', 'clericStance', 'presenceOfMind', 'swiftcast', 'shroudOfSaints', 'fluidAura', 'tincture', 'holy', null],
        ['cure', 'cure2', 'medica', 'medica2', 'regen', 'benediction', 'divineSeal', 'surecast', 'sprint', null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['White Mage', ['stone2', 'aero', 'aero2', 'holy', 'cure', 'cure2', 'medica', 'medica2', 'regen', 'clericStance', 'presenceOfMind', 'shroudOfSaints',
          'fluidAura', 'divineSeal', 'benediction']],
        ['Cross-class', ['swiftcast', 'surecast', V.thunder ? 'thunder' : 'blizzard2']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = 2.3;
    }

    gaugeDots() { return this.V.thunder ? ['thunder', 'aero2', 'aero'] : ['aero2', 'aero']; }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)}, ${e.gcdForSpeed(e.stats.speed, 20).toFixed(2)} in Presence of Mind · ${e.maxMp.toLocaleString()} MP · A Realm Reborn's formula (no Direct Hit)`; }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 50 White Mage on a dummy. <b>Cleric Stance</b> swaps your Mind into Intelligence (+10% attack magic). Fill with <b>Stone II</b> (170, 2.5s) and keep <b>Aero</b> (50 + 25 × 18s, instant) and <b>Aero II</b> (50 + 40 × 12s, 2.5s)${V.thunder ? ' and <b>Thunder</b> from Thaumaturge (30 + 35 × 18s; 2.1 took it away from healers)' : ''} running; <b>Fluid Aura</b> (150) on cooldown.</p>
<p><b>Presence of Mind</b> (${V.pom[0]}s) makes casts and the GCD 20% faster for ${V.pom[1]}s; put the potion and Swiftcast with it. MP is the limit: about ${V.maxMp.toLocaleString()} at level 50 with Stone II at 186 a cast, and <b>Shroud of Saints</b> (180s, about 1,065 MP over 15s) is the only refill. No Stone III, Aero III or Assize until Heavensward.</p>
<h3>An opener (constructed)</h3>
${seq([['clericStance'], 'aero2', ['presenceOfMind'], ['tincture'], 'aero'].concat(V.thunder ? ['thunder'] : []).concat([['fluidAura'], 'stone2', 'stone2', ['swiftcast'], 'aero2', 'stone2', 'stone2', 'stone2', 'stone2', 'aero2']))}
<p>No ARR White Mage damage guide survives; this keeps the DoTs first and the buffs together. Cleric Stance before the pull.</p>
<p style="color:#a9a3b4">The numbers: Stone II 170 (186 MP), Aero 50 + 25 × 18s (160), Aero II 50 + 40 × 12s (293), Holy ${V.holy}, Fluid Aura 150; a ${V.maxMp.toLocaleString()} MP pool at Piety ${V.stats.piety}. ARR's damage formula here is a refit of the 2013–14 community formulas. Gear: ${V.gear}, with the ${V.potion === 67 ? 'NQ ' : ''}X-Potion of Mind (max ${V.potion}).</p>`;
    }
  }

  B.registerJob({
    id: 'whm', name: 'White Mage', abbr: 'WHM', role: 'healer', classJob: 24,
    versions: ['arr23', 'arr21', 'arr20'].map(id => ({ id, label: VERSIONS[id].label, history: VERSIONS[id].history, note: VERSIONS[id].note, create: () => new WhiteMageARR(id) })),
  });
})(window.BLM);

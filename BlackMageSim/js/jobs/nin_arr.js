// Ninja, A Realm Reborn 2.4–2.57 at level 50: the debut. Built on the Heavensward class (nin_hw.js): Kiss of the Viper
// (+20% physical), Huton (+15% speed, 70s) cast with Jin → Chi → Ten, the mudras off the GCD with Ninjutsu's 20s recast
// and Rabbit Medium, Suiton into Trick Attack, Kassatsu, Shadow Fang, Mutilate and Dancing Edge. What ARR didn't have:
// Armor Crush (so Huton has to be recast every 70s), Duality, Dream Within a Dream, Shadewalker and Smoke Screen (all
// 3.0). Aeolian Edge is 320 in combo with no positional, Dancing Edge 260, Katon 180, Doton 30 a tick; Spinning Edge
// costs 60 TP, Shadow Fang 70, Mutilate 80. ARR's damage formula (B.LEVELS.arr50). Numbers are the Lodestone notes for
// 2.4 and 2.45, Gamer Escape's ARR pages and the xiv-sim data files (2015); Aeolian Edge's and Dancing Edge's values are
// uncertain. Gear is the 2015 Ariyala best-in-slot (Sasuke's Blades Zeta, Final Coil i130) with the X-Potion of
// Dexterity (max 84).
(function (B) {
  const HW = B.NinjaHW;
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };

  class NinjaARR extends HW {
    constructor() {
      super();
      this.level = 50;
      this.levelKey = 'arr50';
      this.model = 'nin-arr';
      this.potionCap = 84;
      const A = Object.assign({}, this.actions);
      for (const k of ['armorCrush', 'duality', 'dreamWithinADream', 'shadewalker', 'smokeScreen']) delete A[k];
      set(A, 'spinningEdge', { tp: 60 });
      set(A, 'aeolianEdge', { comboPotency: 320, positional: null, posBonus: 0, tp: 60, desc: 'Delivers an attack with a potency of 100.\nCombo Action: Gust Slash\nCombo Potency: 320' });
      set(A, 'dancingEdge', { comboPotency: 260, tp: 60 });
      set(A, 'shadowFang', { tp: 70 });
      set(A, 'mutilate', { tp: 80 });
      set(A, 'deathBlossom', { potency: 100, tp: 120, desc: 'Delivers an attack with a potency of 100 to all nearby enemies.' });
      set(A, 'katon', { potency: 180, desc: A.katon.desc.replace('potency of 250', 'potency of 180') });
      set(A, 'doton', { dot: { potency: 30, duration: 24, aoe: true }, desc: A.doton.desc.replace('potency of 40', 'potency of 30') });
      A.tincture = Object.assign({}, A.tincture, { name: 'X-Potion of Dexterity', desc: 'This diluted brew temporarily increases dexterity.\nDexterity +20% (Max 84)\nDuration: 15s' });
      this.actions = A;
      this.stats = { hp: 11000, main: 655, mainStat: 'dex', jobMod: 110, trait: 100, wd: 58, det: 346, crit: 529, dh: 341, speed: 433, delay: 2.4 };
      this.autoAttack = { potency: 100, delay: 2.4, range: B.MELEE_RANGE };
      this.defaultBars = [
        ['spinningEdge', 'gustSlash', 'aeolianEdge', 'dancingEdge', 'shadowFang', 'mutilate', 'ten', 'chi', 'jin', 'ninjutsu', 'trickAttack', 'mug'],
        ['jugulate', 'kassatsu', 'internalRelease', 'bloodForBlood', 'invigorate', 'tincture', 'kissOfTheViper', 'kissOfTheWasp', 'shadeShift', 'featherfoot', 'secondWind', 'sprint'],
        ['deathBlossom', 'throwingDagger', 'sneakAttack', 'assassinate', 'hide', 'shukuchi', 'goad', 'mantra', 'keenFlurry', null, null, null],
      ];
      this.actionGroups = this.actionGroups.map(([n, ids]) => [n, ids.filter(x => A[x])]);
      this.referenceDps = 620;     // a scripted 2.5 rotation parses about 590 on the dummy
      this.referenceGcd = 2.05;
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)}, ${e.gcdForSpeed(e.stats.speed, 15).toFixed(2)} under Huton · A Realm Reborn's formula (no Direct Hit)`; }

    helpHtml(seq) {
      return `
<h3>How it plays (A Realm Reborn 2.4–2.57)</h3>
<p>Level 50 Ninja on TP, the job's debut, in <b>Kiss of the Viper</b> (+20% physical). <b>Huton</b> (+15% speed, 70s) has to be cast again with Jin → Chi → Ten before it runs out: there's no Armor Crush to extend it until 3.0. The combo is Spinning Edge → Gust Slash → <b>Aeolian Edge</b> (320) or <b>Dancing Edge</b> (260, −10% slashing resistance); keep <b>Shadow Fang</b> and <b>Mutilate</b> on the dummy.</p>
<p><b>Ten, Chi and Jin</b> are off the GCD and share Ninjutsu's 20s recast: two signs ending in Chi make <b>Raiton</b> (360), three ending in Jin <b>Suiton</b>, which allows <b>Trick Attack</b> (400 from the rear, +10% damage taken for 10s). Kassatsu resets Ninjutsu with a sure crit. The ARR guide's Ninjutsu priority: Huton, Suiton, Kassatsu, Raiton.</p>
<h3>The opener (the FFXIV wiki's ARR Ninja guide, 2014)</h3>
${seq([['bloodForBlood'], ['internalRelease'], 'spinningEdge', ['tincture'], 'gustSlash', ['chi'], ['ten'], ['jin'], ['suiton'], 'dancingEdge', ['trickAttack'], 'mutilate', ['kassatsu'], 'spinningEdge', ['ten'], ['chi'], ['raiton'], 'shadowFang', ['mug'], ['jugulate'], 'gustSlash', 'aeolianEdge'])}
<p>Huton before the pull.</p>
<p style="color:#a9a3b4">The 2.5x numbers: Spinning Edge 150, Gust Slash combo 200, Aeolian Edge combo 320, Dancing Edge combo 260, Shadow Fang combo 200 + 40 × 18s, Mutilate 60 + 30 × 30s, Trick Attack 240 (400 rear), Mug 140, Jugulate 80, Fuma Shuriken 240, Katon 180, Raiton 360, Suiton 180, Doton 30 × 24s. ARR's damage formula here is a refit of the 2013–14 community formulas (about 2–4% off). Gear: the 2015 Ariyala set (Dexterity 655, 58 weapon damage, 2.40 delay) with the X-Potion of Dexterity.</p>`;
    }
  }

  B.registerJob({
    id: 'nin', name: 'Ninja', abbr: 'NIN', role: 'melee', classJob: 30,
    versions: [{ id: 'arr24', label: 'A Realm Reborn 2.4–2.57', history: 'ARR 2.4–2.57', note: 'Level 50, the debut: mudras and Ninjutsu, Huton recast every 70s, Suiton into Trick Attack, Kassatsu, Kiss of the Viper; Final Coil gear', create: () => new NinjaARR() }],
  });
})(window.BLM);

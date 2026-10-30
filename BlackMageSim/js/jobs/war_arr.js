// Warrior, A Realm Reborn 2.1–2.57 at level 50. Built on the Heavensward class (war_hw.js) with what ARR had instead:
// Defiance is the only stance (−25% damage, +25% HP), and its Wrath stacks (from Skull Sunder, Butcher's Block, Maim,
// Storm's Path, Storm's Eye, Berserk and Vengeance) are each +2% crit; at five you're Infuriated, for Inner Beast (300,
// ignores Defiance's penalty) or Unchained (no penalty for 20s, 120s). No Deliverance, Fell Cleave, Decimate, Raw
// Intuition or Equilibrium (all 3.0). Berserk +50% for 20s then 5s of Pacification; Infuriate (60s) gives five stacks.
// Maim (+20%) and Storm's Eye (−10% slashing resistance; 15s before 2.4, 20s here) stay up. ARR's damage formula
// (B.LEVELS.arr50). Numbers are the Lodestone notes for 2.1–2.57, Gamer Escape's ARR pages and the xiv-sim data files
// (2015); Brutal Swing's 50 and Wrath's crit (the 2015 wiki says parry) are uncertain. Gear is the 2015 Ariyala
// best-in-slot (Ragnarok Zeta, Final Coil i130) with the X-Potion of Strength (max 84).
//  - A Realm Reborn 2.0: Unchained on a 180s recast, cross-class Internal Release +20% crit, Storm's Eye 70 TP and 15s,
//    Storm's Path 90 TP, Brutal Swing every 30s (all changed in 2.1). An end-of-2.0 set (the Allagan Battleaxe, i95:
//    Strength 492, 47 weapon damage) with the HQ Mega-Potion of Strength (max 61); X-Potions came with 2.2.
(function (B) {
  const HW = B.WarriorHW;
  const set = B.setAction;     // a version's change to an action (its description's numbers follow the potency)

  class WarriorARR extends HW {
    constructor() {
      super();
      this.level = 50;
      this.levelKey = 'arr50';
      this.model = 'war-arr';
      this.potionCap = 84;
      this.wrathCrit = true;
      const A = Object.assign({}, this.actions);
      for (const k of ['deliverance', 'fellCleave', 'decimate', 'rawIntuition', 'equilibrium']) delete A[k];
      // No Abandon before 3.0: the stack builders only add Wrath.
      for (const k of Object.keys(A)) {
        if (typeof A[k].desc === 'string' && A[k].desc.includes('Wrath / Abandon +1')) set(A, k, { desc: A[k].desc.replace('Wrath / Abandon +1', 'Wrath +1') });
      }
      // Fracture's DoT lasted 18s in A Realm Reborn.
      set(A, 'fracture', { dot: { potency: 20, duration: 18 }, desc: A.fracture.desc.replace('Duration: 30s', 'Duration: 18s') });
      set(A, 'brutalSwing', { potency: 50, desc: 'Delivers an attack with a potency of 50.\nAdditional Effect: Stun\nDuration: 5s' });
      set(A, 'defiance', { desc: 'Increases maximum HP by 25% and enmity, while reducing damage dealt by 25%. Weaponskills build Wrath (+2% critical hit rate a stack); five make you Infuriated.\nEffect ends upon reuse.' });
      set(A, 'infuriate', { desc: 'Grants five stacks of Wrath.\nCan only be executed in Defiance.' });
      A.tincture = Object.assign({}, A.tincture, { name: 'X-Potion of Strength', desc: 'This diluted brew temporarily increases strength.\nStrength +20% (Max 84)\nDuration: 15s' });
      this.actions = A;
      this.stats = { hp: 17500, main: 617, mainStat: 'str', jobMod: 105, trait: 100, wd: 58, det: 350, crit: 516, dh: 341, speed: 387, delay: 3.44 };
      this.autoAttack = { potency: 100, delay: 3.44, range: B.MELEE_RANGE };
      this.selfStatusOrder = this.selfStatusOrder.filter(k => !['deliverance', 'abandon', 'uncontrollable', 'rawIntuition'].includes(k));
      this.defaultBars = [
        ['heavySwing', 'skullSunder', 'butchersBlock', 'maim', 'stormsPath', 'stormsEye', 'innerBeast', 'fracture', 'tomahawk', 'brutalSwing', 'berserk', 'infuriate'],
        ['defiance', 'unchained', 'vengeance', 'internalRelease', 'tincture', 'bloodbath', 'thrillOfBattle', 'foresight', 'holmgang', 'overpower', 'steelCyclone', 'sprint'],
        ['provoke', 'awareness', 'convalescence', 'flash', 'secondWind', null, null, null, null, null, null, null],
      ];
      this.actionGroups = this.actionGroups.map(([n, ids]) => [n, ids.filter(x => A[x])]);
      this.referenceDps = 370;     // a scripted 2.5 rotation in Defiance parses about 350 (TP runs out)
      this.referenceGcd = 2.45;
    }

    initGauge(e) {
      e.addStatus('defiance', 1e9, { permanent: true });
      return { stacks: 0, stackUntil: 0 };
    }

    // Only Defiance: pressing it again leaves the stance (and its Wrath).
    ability(id, e) {
      if (id === 'defiance') {
        if (e.has('defiance')) { e.removeStatus('defiance', true); this.clearStacks(e); }
        else e.addStatus('defiance', 1e9, { permanent: true });
        return;
      }
      super.ability(id, e);
    }

    proc(id, e) {
      const a = this.actions[id];
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (id === 'innerBeast') return this.stance(e) === 'defiance' && this.full(e);
      return false;
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · A Realm Reborn's formula (no Direct Hit)`; }

    helpHtml(seq) {
      return `
<h3>How it plays (A Realm Reborn 2.1–2.57)</h3>
<p>Level 50 Warrior on TP, in <b>Defiance</b>, the only stance: −25% damage, but every combo hit builds <b>Wrath</b> (+2% crit a stack, 30s). At five you're Infuriated: spend it on <b>Inner Beast</b> (300, ignores Defiance's penalty) or on <b>Unchained</b> (no penalty for 20s, every 120s). <b>Infuriate</b> (60s) gives all five at once. No Deliverance or Fell Cleave until Heavensward.</p>
<p>Keep <b>Maim</b> up (Heavy Swing → Maim: +20% damage) and <b>Storm's Eye</b> on the dummy (−10% slashing resistance); fill with Heavy Swing → Skull Sunder → Butcher's Block. <b>Berserk</b> is +50% for 20s and then 5s of Pacification; put it with Unchained.</p>
<h3>An opener (from the 2015 xiv-sim priority list)</h3>
${seq(['tomahawk', ['unchained'], ['berserk'], 'heavySwing', ['internalRelease'], 'maim', ['brutalSwing'], ['tincture'], 'stormsEye', 'heavySwing', 'skullSunder', 'butchersBlock', 'heavySwing', 'maim', 'stormsPath'])}
<p>Defiance and Infuriate before the pull, so you start Infuriated for Unchained. No fixed opener was published in 2.x.</p>
<p style="color:#a9a3b4">The 2.5x numbers: Heavy Swing 150, Skull Sunder combo 200, Butcher's Block combo 280, Maim combo 190 (+20%), Storm's Path combo 250, Storm's Eye combo 270, Inner Beast 300, Fracture 100 + 20 × 18s, Brutal Swing 50, Berserk +50%. ARR's damage formula here is a refit of the 2013–14 community formulas (about 2–4% off). Gear: the 2015 Ariyala set (Strength 617, 58 weapon damage) with the X-Potion of Strength.</p>`;
    }
  }

  class WarriorARR20 extends WarriorARR {
    constructor() {
      super();
      const A = Object.assign({}, this.actions);
      set(A, 'unchained', { recast: 180 });
      set(A, 'internalRelease', { desc: 'Increases critical hit rate by 20%.\nDuration: 15s\n(Pugilist cross-class skill)' });
      set(A, 'innerBeast', { desc: A.innerBeast.desc.replace('Absorbs 100% of damage', 'Absorbs 300% of damage') });
      set(A, 'stormsEye', { tp: 70, desc: A.stormsEye.desc.replace('Duration: 20s', 'Duration: 15s') });
      set(A, 'stormsPath', { tp: 90 });
      set(A, 'brutalSwing', { recast: 30 });
      A.tincture = Object.assign({}, A.tincture, { name: 'Mega-Potion of Strength', desc: 'This diluted brew temporarily increases strength.\nStrength +20% (Max 61)\nDuration: 15s' });
      this.actions = A;
      this.potionCap = 61;
      this.stormsEyeDur = 15;
      this.stats = Object.assign({}, this.stats, { hp: 14000, main: 492, wd: 47, det: 299, crit: 433, speed: 372, delay: 3.36 });
      this.autoAttack = Object.assign({}, this.autoAttack, { delay: 3.36 });
      this.referenceDps = 245;     // a scripted 2.0 rotation parses about 228
      this.referenceGcd = 2.46;
    }

    // Internal Release was +20% before 2.1.
    snapshot(a, e) {
      const s = super.snapshot(a, e);
      if (e.has('internalRelease')) s.critAdd += 0.10;
      return s;
    }

    helpHtml(seq) {
      return `
<h3>How it plays (A Realm Reborn 2.0)</h3>
<p>Level 50 Warrior at launch, in <b>Defiance</b>: −25% damage, Wrath +2% crit a stack, and at five you're Infuriated for <b>Inner Beast</b> (300, heals 300% of the damage) or <b>Unchained</b> (no penalty for 20s). Unchained comes back every <b>180s</b>, so two of every three Infuriates go to Inner Beast.</p>
<p>Keep <b>Maim</b> (+20%) and <b>Storm's Eye</b> (−10% slashing resistance, only 15s: refresh it every second Maim combo); fill with Heavy Swing → Skull Sunder → Butcher's Block. Storm's Path costs 90 TP and Storm's Eye 70, so TP runs out sooner. <b>Berserk</b> (+50%) with Unchained; Internal Release is +20% crit before 2.1.</p>
<h3>An opener (from the 2.1 one, with 2.0's cooldowns)</h3>
${seq(['tomahawk', ['unchained'], ['berserk'], 'heavySwing', ['internalRelease'], 'maim', ['brutalSwing'], ['tincture'], 'stormsEye', 'heavySwing', 'skullSunder', 'butchersBlock', 'heavySwing', 'maim', 'stormsEye'])}
<p style="color:#a9a3b4">Gear: an end-of-2.0 set with the Allagan Battleaxe (Strength 492, 47 weapon damage) and the HQ Mega-Potion of Strength (max 61).</p>`;
    }
  }

  B.registerJob({
    id: 'war', name: 'Warrior', abbr: 'WAR', role: 'tank', classJob: 21,
    versions: [{ id: 'arr21', label: 'A Realm Reborn 2.1–2.57', history: 'ARR 2.1–2.57', note: 'Level 50 on TP: Defiance with Wrath +2% crit a stack, Inner Beast and Unchained from Infuriated, Berserk, Maim and Storm\'s Eye; Final Coil gear', create: () => new WarriorARR() },
      { id: 'arr20', label: 'A Realm Reborn 2.0–2.0', history: 'ARR 2.0–2.0', note: 'Level 50 at launch: Defiance and Wrath, Unchained every 180s, Inner Beast heals 300%, Internal Release +20%, Storm\'s Eye 15s; Binding Coil gear', create: () => new WarriorARR20() }],
  });
})(window.BLM);

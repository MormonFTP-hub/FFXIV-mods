// Dancer, Shadowbringers 5.0–5.58 at level 80, the job's first expansion. Cascade → Fountain (300 in combo), each with
// a 50% proc (Reverse Cascade 300, Fountainfall 350) that has a 50% chance of a Fourfold Feather for Fan Dance (150, and
// a 50% Fan Dance III proc). Standard Step (30s) and Technical Step (120s) are dances: steps shown in a random order,
// on fixed GCDs (Step 1.5s, each step 1.0s, Finish 1.5s), whose Finish hits harder and buffs harder for each correct step
// (Standard 1,000 and +5% for 60s; Technical 1,500 and +5% for 20s). The Finishes give Esprit: your weaponskills then
// have about a 30% chance of 10 Esprit each, spent on Saber Dance (600 for 50). Devilment (+20% crit and direct hit),
// Flourish (every proc at once), Improvisation (Esprit over 15s). Alone on a dummy there's no Dance Partner.
// The 5.58 numbers: 5.1 raised Cascade 200 → 250, Fountain 250 → 300, Rising Windmill and Bloodshower by 50, and Shield
// Samba to a 120s recast; 5.0–5.08 had the lower ones (the Finishes never changed in PvE). Game data at 5.58, the
// Lodestone notes and The Balance; gear stats are the 5.58 Item.csv's (pre-6.0).
(function (B) {
  const EPS = 1e-6;
  const STEPS = ['emboite', 'entrechat', 'jete', 'pirouette'];
  const STD = [500, 750, 1000], STD_BUFF = [0, 0.02, 0.05];
  const TECH = [500, 750, 1000, 1250, 1500], TECH_BUFF = [0, 0.01, 0.02, 0.03, 0.05];
  const ESPRIT_CHANCE = 0.3;      // The Balance's estimate for your own weaponskills
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.5, fx: 'gnbSlash' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const step = (name) => ws({ name, target: false, fixedRecast: 1, lock: 0.5, step: true, fx: null, desc: `Perform ${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name.toLowerCase()}.\nWhen performed together with other step actions, in sequence, the potency of Standard Finish and Technical Finish is increased.\nTriggers a 1s cooldown of step and finish actions.` });

  const ACTIONS = {
    cascade: ws({ name: 'Cascade', potency: 250, comboStart: true, comboNext: true, procs: 'flourishingCascade', desc: 'Delivers an attack with a potency of 250.\nAdditional Effect: 50% chance of granting Flourishing Cascade\nDuration: 20s\n※Action changes to Emboite while dancing.' }),
    fountain: ws({ name: 'Fountain', potency: 100, comboPotency: 300, comboFrom: 'cascade', procs: 'flourishingFountain', fx: 'gnbSlash2', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Cascade\nCombo Potency: 300\nCombo Bonus: 50% chance of granting Flourishing Fountain\nDuration: 20s\n※Action changes to Entrechat while dancing.' }),
    reverseCascade: ws({ name: 'Reverse Cascade', potency: 300, ready: 'flourishingCascade', feather: true, fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 300.\nAdditional Effect: 50% chance of granting a Fourfold Feather\nCan only be executed while under the effect of Flourishing Cascade.\n※Action changes to Jete while dancing.' }),
    fountainfall: ws({ name: 'Fountainfall', potency: 350, ready: 'flourishingFountain', feather: true, fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 350.\nAdditional Effect: 50% chance of granting a Fourfold Feather\nCan only be executed while under the effect of Flourishing Fountain.\n※Action changes to Pirouette while dancing.' }),
    windmill: ws({ name: 'Windmill', potency: 150, comboStart: true, comboNext: true, target: false, pbaoe: 5, aoe: true, procs: 'flourishingWindmill', desc: 'Delivers an attack with a potency of 150 to all nearby enemies.\nAdditional Effect: 50% chance of granting Flourishing Windmill\nDuration: 20s' }),
    bladeshower: ws({ name: 'Bladeshower', potency: 100, comboPotency: 200, comboFrom: 'windmill', target: false, pbaoe: 5, aoe: true, procs: 'flourishingShower', desc: 'Delivers an attack with a potency of 100 to all nearby enemies.\nCombo Action: Windmill\nCombo Potency: 200\nCombo Bonus: 50% chance of granting Flourishing Shower\nDuration: 20s' }),
    risingWindmill: ws({ name: 'Rising Windmill', potency: 300, ready: 'flourishingWindmill', feather: true, target: false, pbaoe: 5, aoe: 0.5, desc: 'Delivers an attack to all nearby enemies with a potency of 300 for the first enemy, and 50% less for all remaining enemies.\nAdditional Effect: 50% chance of granting a Fourfold Feather\nCan only be executed while under the effect of Flourishing Windmill.' }),
    bloodshower: ws({ name: 'Bloodshower', potency: 350, ready: 'flourishingShower', feather: true, target: false, pbaoe: 5, aoe: 0.5, desc: 'Delivers an attack to all nearby enemies with a potency of 350 for the first enemy, and 50% less for all remaining enemies.\nAdditional Effect: 50% chance of granting a Fourfold Feather\nCan only be executed while under the effect of Flourishing Shower.' }),
    saberDance: ws({ name: 'Saber Dance', potency: 600, esprit: 50, aoe: 0.5, fx: 'gnbDouble', desc: 'Delivers an attack to target and all enemies nearby it with a potency of 600 for the first enemy, and 50% less for all remaining enemies.\nEsprit Gauge Cost: 50' }),
    // Dances: fixed GCDs, not shortened by skill speed.
    standardStep: ws({ name: 'Standard Step', target: false, cd: 30, fixedRecast: 1.5, dance: 'standardStep', count: 2, fx: null, desc: 'Begin dancing, granting yourself Standard Step.\nDuration: 15s\nAction changes to Standard Finish while dancing.\nOnly Standard Finish, En Avant, step actions, role actions and Sprint can be performed while dancing.\nRecast: 30s' }),
    technicalStep: ws({ name: 'Technical Step', target: false, cd: 120, fixedRecast: 1.5, dance: 'technicalStep', count: 4, fx: null, desc: 'Begin dancing, granting yourself Technical Step.\nDuration: 15s\nAction changes to Technical Finish while dancing.\nOnly Technical Finish, En Avant, step actions, role actions and Sprint can be performed while dancing.\nRecast: 120s' }),
    emboite: step('Emboite'), entrechat: step('Entrechat'), jete: step('Jete'), pirouette: step('Pirouette'),
    standardFinish: ws({ name: 'Standard Finish', target: false, pbaoe: 15, aoe: 0.25, fixedRecast: 1.5, finish: 'standardStep', delay: 0.6, fx: 'gnbZone', desc: 'Delivers an attack to all nearby enemies. Potency varies with number of successful steps, dealing full potency for the first enemy, and 75% less for all remaining enemies.\n0 steps: 500\n1 step: 750\n2 steps: 1,000\nStep Bonus: Increases damage dealt by 2% (1 step) or 5% (2 steps)\nDuration: 60s\nAdditional Effect: Grants Esprit\nDuration: 60s' }),
    technicalFinish: ws({ name: 'Technical Finish', target: false, pbaoe: 15, aoe: 0.25, fixedRecast: 1.5, finish: 'technicalStep', delay: 0.6, fx: 'gnbZone', desc: 'Delivers an attack to all nearby enemies. Potency varies with number of successful steps, dealing full potency for the first enemy, and 75% less for all remaining enemies.\n0 steps: 500\n1 step: 750\n2 steps: 1,000\n3 steps: 1,250\n4 steps: 1,500\nStep Bonus: Increases damage dealt by self and nearby party members by 1% / 2% / 3% / 5%\nDuration: 20s\nAdditional Effect: Grants Esprit\nDuration: 20s' }),
    // Off the GCD.
    fanDance: ab({ name: 'Fan Dance', recast: 1, cdGroup: 'fan', potency: 150, feathers: 1, target: true, range: 25, delay: 0.5, fx: 'gnbShot', desc: 'Delivers an attack with a potency of 150.\nAdditional Effect: 50% chance of granting Flourishing Fan Dance\nDuration: 20s\nCan only be executed while in possession of Fourfold Feathers.' }),
    fanDance2: ab({ name: 'Fan Dance II', recast: 1, cdGroup: 'fan', potency: 100, feathers: 1, target: false, pbaoe: 5, aoe: true, delay: 0.5, desc: 'Delivers an attack with a potency of 100 to all nearby enemies.\nAdditional Effect: 50% chance of granting Flourishing Fan Dance\nDuration: 20s\nCan only be executed while in possession of Fourfold Feathers.' }),
    fanDance3: ab({ name: 'Fan Dance III', recast: 1, potency: 200, target: true, range: 25, aoe: 0.5, ready: 'flourishingFanDance', delay: 0.5, fx: 'gnbBurst', desc: 'Delivers an attack to target and all enemies nearby it with a potency of 200 for the first enemy, and 50% less for all remaining enemies.\nCan only be executed while under the effect of Flourishing Fan Dance.' }),
    devilment: ab({ name: 'Devilment', recast: 120, desc: 'Increases critical hit rate and direct hit rate by 20%.\nDuration: 20s\nAdditional Effect: Party member designated as your Dance Partner will also receive the effect of Devilment' }),
    flourish: ab({ name: 'Flourish', recast: 60, desc: 'Grants you the effects of Flourishing Cascade, Flourishing Fountain, Flourishing Windmill, Flourishing Shower, and Flourishing Fan Dance.\nDuration: 20s' }),
    improvisation: ab({ name: 'Improvisation', recast: 120, desc: 'Dance to the beat of your own drum, granting Improvisation to self.\nImprovisation Effect: Continuously increases Esprit Gauge while in combat\nDuration: 15s\nEffect ends upon using another action or moving.' }),
    closedPosition: ab({ name: 'Closed Position', recast: 30, desc: 'Grants you Closed Position and designates a party member as your Dance Partner, allowing you to share the effects of Standard Finish, Devilment, and Curing Waltz with said party member.' }),
    shieldSamba: ab({ name: 'Shield Samba', recast: 120, desc: 'Reduces damage taken by self and nearby party members by 10%.\nDuration: 15s' }),
    curingWaltz: ab({ name: 'Curing Waltz', recast: 60, desc: 'Restores own HP and the HP of all nearby party members.\nCure Potency: 300' }),
    enAvant: ab({ name: 'En Avant', recast: 30, charges: 3, desc: 'Quickly dash 10 yalms forward.\nMaximum Charges: 3' }),
    // The physical ranged role actions of 5.x.
    legGraze: ab({ name: 'Leg Graze', recast: 30, role: true, target: true, range: 25, desc: 'Afflicts target with Heavy +40%.\nDuration: 10s' }),
    secondWind: ab({ name: 'Second Wind', recast: 120, role: true, desc: 'Instantly restores own HP.\nCure Potency: 500' }),
    footGraze: ab({ name: 'Foot Graze', recast: 30, role: true, target: true, range: 25, desc: 'Binds target.\nDuration: 10s' }),
    peloton: ab({ name: 'Peloton', recast: 5, role: true, desc: 'Increases movement speed of self and nearby party members.\nDuration: 30s\nHas no effect in battle.' }),
    headGraze: ab({ name: 'Head Graze', recast: 30, role: true, target: true, range: 25, desc: 'Interrupts the use of a target\'s action.' }),
    armsLength: ab({ name: 'Arm\'s Length', recast: 120, role: true, desc: 'Creates a barrier nullifying most knockback and draw-in effects.\nDuration: 6s' }),
    ...B.GENERAL_ACTIONS,
    tincture: B.tincture('dex4'),
    auto: { name: 'Shot', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
  };
  // What can be pressed while dancing.
  const WHILE_DANCING = { emboite: 1, entrechat: 1, jete: 1, pirouette: 1, standardFinish: 1, technicalFinish: 1, enAvant: 1, sprint: 1,
    legGraze: 1, secondWind: 1, footGraze: 1, peloton: 1, headGraze: 1, armsLength: 1 };

  const STATUSES = {
    standardStep: { name: 'Standard Step', self: true, icon: 'st_std' },
    technicalStep: { name: 'Technical Step', self: true, icon: 'st_tech' },
    standardFinish: { name: 'Standard Finish', self: true, icon: 'st_stdfin' },
    technicalFinish: { name: 'Technical Finish', self: true, icon: 'st_techfin' },
    esprit: { name: 'Esprit', self: true, icon: 'st_esprit' },
    devilment: { name: 'Devilment', self: true, icon: 'st_devilment' },
    flourishingCascade: { name: 'Flourishing Cascade', self: true, icon: 'st_fcascade' },
    flourishingFountain: { name: 'Flourishing Fountain', self: true, icon: 'st_ffountain' },
    flourishingWindmill: { name: 'Flourishing Windmill', self: true, icon: 'st_fwindmill' },
    flourishingShower: { name: 'Flourishing Shower', self: true, icon: 'st_fshower' },
    flourishingFanDance: { name: 'Flourishing Fan Dance', self: true, icon: 'st_ffan' },
    improvisation: { name: 'Improvisation', self: true, icon: 'st_improv' },
    shieldSamba: { name: 'Shield Samba', self: true, icon: 'st_samba' },
    peloton: { name: 'Peloton', self: true, icon: 'st_peloton' },
  };

  class DancerShB {
    constructor() {
      this.name = 'Dancer';
      this.abbr = 'DNC';
      this.role = 'ranged';
      this.level = 80;
      this.levelKey = 'shb80';
      this.model = 'dnc-shb';
      this.actions = ACTIONS;
      this.statuses = STATUSES;
      this.comboTime = 15;
      // Increased Action Damage II: +20%.
      this.stats = { hp: 62000, main: 5560, mainStat: 'dex', jobMod: 115, trait: 120, wd: 134, det: 2295, crit: 3812, dh: 3284, speed: 380, delay: 3.12 };
      this.speedName = 'Skill speed';
      this.tierHaste = 0;
      this.autoAttack = { potency: 100, delay: 3.12, range: 25 };
      this.selfStatusOrder = ['standardStep', 'technicalStep', 'technicalFinish', 'standardFinish', 'devilment', 'esprit', 'flourishingCascade', 'flourishingFountain',
        'flourishingWindmill', 'flourishingShower', 'flourishingFanDance', 'improvisation', 'shieldSamba', 'medicated', 'peloton', 'armsLength', 'sprint'];
      this.targetStatusOrder = [];
      this.defaultBars = [
        ['cascade', 'fountain', 'reverseCascade', 'fountainfall', 'saberDance', 'standardStep', 'technicalStep', 'fanDance', 'fanDance3', 'devilment', 'flourish', 'tincture'],
        ['windmill', 'bladeshower', 'risingWindmill', 'bloodshower', 'fanDance2', 'improvisation', 'closedPosition', 'shieldSamba', 'curingWaltz', 'enAvant', 'headGraze', 'secondWind'],
        ['legGraze', 'footGraze', 'peloton', 'armsLength', 'sprint', null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Dancer', ['cascade', 'fountain', 'reverseCascade', 'fountainfall', 'windmill', 'bladeshower', 'risingWindmill', 'bloodshower', 'saberDance',
          'standardStep', 'technicalStep', 'emboite', 'entrechat', 'jete', 'pirouette', 'standardFinish', 'technicalFinish', 'fanDance', 'fanDance2', 'fanDance3',
          'devilment', 'flourish', 'improvisation', 'closedPosition', 'shieldSamba', 'curingWaltz', 'enAvant']],
        ['Role Actions', ['legGraze', 'secondWind', 'footGraze', 'peloton', 'headGraze', 'armsLength']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 18040;     // a scripted 5.58 rotation alone on this gear parses about 17,020 on the dummy
      this.referenceGcd = 2.5;
      this.startDistance = 12;
    }

    initGauge() { return { esprit: 0, feathers: 0, steps: [], stepIdx: 0, done: 0, improvNext: 0, stdBuff: 0, techBuff: 0 }; }

    dancing(e) { return e.has('standardStep') || e.has('technicalStep'); }

    // While dancing, the combo buttons are the four steps and the Step buttons their Finish.
    resolveId(id, e) {
      if (!this.dancing(e)) return id;
      const map = { cascade: 'emboite', fountain: 'entrechat', reverseCascade: 'jete', fountainfall: 'pirouette' };
      if (map[id]) return map[id];
      if (id === 'standardStep' && e.has('standardStep')) return 'standardFinish';
      if (id === 'technicalStep' && e.has('technicalStep')) return 'technicalFinish';
      return id;
    }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (this.dancing(e) && !WHILE_DANCING[id]) return 'Unable to execute action while dancing.';
      if ((a.step || a.finish) && !this.dancing(e)) return 'Unable to execute action.';
      if (a.finish && !e.has(a.finish)) return 'Unable to execute action.';
      if (a.step && g.done >= g.steps.length) return 'Unable to execute action. All steps complete.';
      if (a.ready && !e.has(a.ready)) return 'Unable to execute action.';
      if (a.esprit && g.esprit < a.esprit) return 'Not enough Esprit.';
      if (a.feathers && g.feathers < a.feathers) return 'Unable to execute action. Fourfold Feathers required.';
      if (id === 'peloton' && e.inCombat) return 'Unable to execute action while in combat.';
      return null;
    }

    snapshot(a, e) {
      const g = e.g;
      let mult = 1, critAdd = 0, dhAdd = 0;
      if (e.has('standardFinish')) mult *= 1 + g.stdBuff;
      if (e.has('technicalFinish')) mult *= 1 + g.techBuff;
      if (e.has('devilment')) { critAdd += 0.2; dhAdd += 0.2; }
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES.dex4.cap : 0);
      return { mult, main, critAdd, dhAdd };
    }

    esprit(e, n) { e.g.esprit = Math.max(0, Math.min(100, e.g.esprit + n)); }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      if (id !== 'improvisation' && e.has('improvisation')) e.removeStatus('improvisation');
      if (a.dance) {
        // Two (Standard) or four (Technical) distinct steps in a random order.
        const pool = STEPS.slice();
        for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
        g.steps = pool.slice(0, a.count); g.stepIdx = 0; g.done = 0;
        e.addStatus(a.dance, 15);
        e.emit('steps', {});
        return;
      }
      if (a.step) {
        if (g.steps[g.done] === id) g.done++;
        e.emit('steps', {});
        return;
      }
      if (a.finish) {
        const n = g.done;
        e.removeStatus(a.finish);
        const potency = a.finish === 'standardStep' ? (this.STD || STD)[n] : (this.TECH || TECH)[n];
        const snap = this.snapshot(a, e);
        if (a.finish === 'standardStep') { if (n) { g.stdBuff = STD_BUFF[n]; e.addStatus('standardFinish', 60); } }
        else if (n) { g.techBuff = TECH_BUFF[n]; e.addStatus('technicalFinish', 20); }
        // Esprit: 60s from Standard Finish, 20s from Technical (which doesn't stack with it).
        const dur = a.finish === 'standardStep' ? 60 : 20;
        if (!e.has('esprit') || e.statuses.esprit.until - e.now < dur) e.addStatus('esprit', dur);
        g.steps = []; g.done = 0;
        e.emit('steps', {});
        e.queueHit(id, potency, snap, a.delay);
        return;
      }
      if (a.kind === 'gcd') {
        const combo = !!a.comboFrom && e.lastComboHit;
        const potency = a.comboFrom && combo ? a.comboPotency : a.potency;
        if (a.ready) e.removeStatus(a.ready);
        if (a.esprit) this.esprit(e, -a.esprit);
        if (a.procs && (!a.comboFrom || combo) && Math.random() < 0.5) e.addStatus(a.procs, 20);
        if (a.feather && Math.random() < 0.5) g.feathers = Math.min(4, g.feathers + 1);
        if (e.has('esprit') && Math.random() < ESPRIT_CHANCE) this.esprit(e, 10);
        e.queueHit(id, potency, this.snapshot(a, e), a.delay);
        return;
      }
      switch (id) {
        case 'fanDance': case 'fanDance2':
          g.feathers--;
          if (Math.random() < 0.5) e.addStatus('flourishingFanDance', 20);
          break;
        case 'fanDance3': e.removeStatus('flourishingFanDance'); break;
        case 'devilment': e.addStatus('devilment', 20); break;
        case 'flourish':
          for (const k of ['flourishingCascade', 'flourishingFountain', 'flourishingWindmill', 'flourishingShower', 'flourishingFanDance']) e.addStatus(k, 20);
          break;
        case 'improvisation': e.addStatus('improvisation', 15); g.improvNext = e.now + 3; break;
        case 'shieldSamba': e.addStatus('shieldSamba', 15); break;
        case 'peloton': e.addStatus('peloton', 30); break;
        case 'enAvant': {
          const from = { x: e.pos.x, z: e.pos.z };
          const d = Math.hypot(e.pos.x, e.pos.z) || 1;
          const s = Math.min(10, Math.max(0, d - 2.4));
          e.pos.x -= e.pos.x / d * s; e.pos.z -= e.pos.z / d * s;
          e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
          break;
        }
        default:
          if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
      }
      if (a.potency) e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
    }

    // Improvisation: about 3 Esprit a tick alone, while you stand still.
    nextEvent(e) { return e.has('improvisation') ? e.g.improvNext : Infinity; }
    process(e) {
      const g = e.g;
      if (e.has('improvisation') && e.now >= g.improvNext - EPS) { g.improvNext += 3; this.esprit(e, 3); }
    }
    frame(e) { if (e.moving && e.has('improvisation')) e.removeStatus('improvisation'); }

    proc(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.step) return g.steps[g.done] === id;
      if (a.finish) return g.done >= g.steps.length;
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (a.ready) return e.has(a.ready);
      if (id === 'saberDance') return g.esprit >= 50;
      if (id === 'fanDance') return g.feathers > 0;
      return false;
    }

    mpRegen() { return B.BASE_REGEN; }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Standard Step 5.0s, Technical Step 7.0s (fixed)`; }

    // ---------- the Step Gauge, feathers and Esprit ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="150" viewBox="0 0 360 150">
  <defs><linearGradient id="dn-e" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a2a5a"/><stop offset="1" stop-color="#ffb0e0"/></linearGradient></defs>
  <rect x="8" y="10" width="344" height="130" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text x="24" y="34" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">STEPS</text>
  ${[0, 1, 2, 3].map(k => `<rect id="dn-s${k}" x="${24 + k * 46}" y="42" width="38" height="24" rx="6" fill="#2a2535" stroke="rgba(0,0,0,.8)"/><text id="dn-st${k}" x="${43 + k * 46}" y="59" text-anchor="middle" font-family="Noto Sans, sans-serif" font-size="10" font-weight="700" fill="#fff"></text>`).join('')}
  <text x="216" y="34" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">FEATHERS</text>
  ${[0, 1, 2, 3].map(k => `<path id="dn-f${k}" d="M0 -11 C6 -4 6 6 0 11 C-6 6 -6 -4 0 -11 Z" transform="translate(${226 + k * 28} 56)" fill="#2a2535" stroke="rgba(255,255,255,.3)"/>`).join('')}
  <text x="24" y="92" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">ESPRIT</text>
  <rect x="24" y="100" width="250" height="12" rx="6" fill="#2a2535" stroke="rgba(0,0,0,.8)"/>
  <rect id="dn-e" x="24" y="100" width="0" height="12" rx="6" fill="url(#dn-e)"/>
  <line x1="149" y1="96" x2="149" y2="116" stroke="rgba(255,255,255,.5)"/>
  <text id="dn-et" x="336" y="112" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">0</text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.dg = { s: [0, 1, 2, 3].map(k => $('#dn-s' + k)), st: [0, 1, 2, 3].map(k => $('#dn-st' + k)), f: [0, 1, 2, 3].map(k => $('#dn-f' + k)), e: $('#dn-e'), et: $('#dn-et'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.dg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      const col = { emboite: '#e05a5a', entrechat: '#5a8ae0', jete: '#5ac07a', pirouette: '#e0c05a' };
      const label = { emboite: 'EMB', entrechat: 'ENT', jete: 'JETE', pirouette: 'PIR' };
      for (let i = 0; i < 4; i++) {
        const st = g.steps[i] || '';
        put('s' + i, `${st}|${i < g.done}`, () => {
          G.s[i].setAttribute('fill', st ? col[st] : '#2a2535');
          G.s[i].setAttribute('opacity', st && i < g.done ? '0.45' : '1');
          G.st[i].textContent = st ? label[st] : '';
        });
      }
      for (let i = 0; i < 4; i++) put('f' + i, g.feathers > i, v => G.f[i].setAttribute('fill', v ? '#ffd0f0' : '#2a2535'));
      put('e', g.esprit, v => { G.e.setAttribute('width', String(250 * v / 100)); G.et.textContent = String(v); });
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Shadowbringers 5.0–5.58)</h3>
<p>Level 80 Dancer, alone on a dummy. <b>Cascade → Fountain</b> (250 / 300), each with a 50% proc: <b>Reverse Cascade</b> (300) and <b>Fountainfall</b> (350), which each have a 50% chance of a <b>Fourfold Feather</b> (up to four) for <b>Fan Dance</b> (150, and a 50% chance of <b>Fan Dance III</b>, 200). Don't let a proc run out (20s).</p>
<p><b>Standard Step</b> (30s) and <b>Technical Step</b> (120s) start a dance: the gauge shows two or four steps in a random order, and while dancing the Cascade, Fountain, Reverse Cascade and Fountainfall buttons are Emboite, Entrechat, Jete and Pirouette. Each correct step strengthens the Finish: <b>Standard Finish</b> 1,000 and +5% damage for 60s with two, <b>Technical Finish</b> 1,500 and +5% for 20s with four. Dances run on fixed GCDs (Step 1.5s, steps 1.0s, Finish 1.5s). The Finishes grant <b>Esprit</b>: while it lasts, your weaponskills have about a 30% chance of 10 Esprit each, for <b>Saber Dance</b> (600, 50 Esprit). <b>Devilment</b> (+20% crit and direct hit, 120s) goes with Technical, and <b>Flourish</b> (60s) gives every proc at once.</p>
<h3>The opener (The Balance, 5.58)</h3>
${seq(['standardStep', 'emboite', 'entrechat', 'standardFinish', 'technicalStep', 'emboite', 'entrechat', 'jete', 'pirouette', 'technicalFinish', ['flourish'], 'reverseCascade', ['devilment'], 'saberDance', ['fanDance3'], 'fountainfall', ['fanDance'], 'standardStep', 'emboite', 'entrechat', 'standardFinish'])}
<p>Standard Step at −15s with its steps, the tincture at −1.5s and Standard Finish on the pull. Your steps will be in another order. Then about ten GCDs between Standard Steps; feathers and Saber Dance go inside Technical Finish and Devilment, spent sooner only to avoid capping.</p>
<p style="color:#a9a3b4">The 5.58 numbers: Cascade 250, Fountain 300 in combo, Reverse Cascade 300, Fountainfall 350, Saber Dance 600, Fan Dance 150, Fan Dance III 200, Standard Finish 500 / 750 / 1,000, Technical Finish 500–1,500, Windmill 150, Bladeshower 200, Rising Windmill 300, Bloodshower 350; Increased Action Damage II +20%; auto-attacks 100 at 3.12s. 5.0–5.08 had Cascade 200, Fountain 250, Rising Windmill 250, Bloodshower 300 and a 180s Shield Samba. The Esprit chance (about 30%) is The Balance's estimate. Gear: The Balance's 5.55 relic split on a 2.50 set (Dexterity 5,560, 134 weapon damage), pre-6.0 stats from the 5.58 game data.</p>`;
    }
  }

  B.DancerShB = DancerShB;
  B.registerJob({
    id: 'dnc', name: 'Dancer', abbr: 'DNC', role: 'ranged', classJob: 38,
    versions: [{ id: 'shb50', label: 'Shadowbringers 5.0–5.58', history: 'ShB 5.0–5.58', note: 'Level 80, Dancer\'s debut: Standard and Technical Step dances, Cascade and Fountain procs, Fourfold Feathers, Esprit into Saber Dance, Devilment, Flourish; the 5.58 numbers', create: () => new DancerShB() }],
  });
})(window.BLM);

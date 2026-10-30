// Dragoon, Heavensward (patches 3.0–3.57) at level 60, on TP. Two combos: Impulse Drive → Disembowel (−10% piercing
// resistance, 30s) → Chaos Thrust (250 from the rear, + 35 × 30s), and True Thrust → Vorpal Thrust → Full Thrust (360),
// with Heavy Thrust (+15% damage, 24s) and Phlebotomize (170 + 30 × 24s) kept up. Blood of the Dragon (60s) is a 15s
// buff: Jump and Spineshatter Dive +30%, and the two combo finishers then open Fang and Claw (finished from the flank) or
// Wheeling Thrust (from the rear): 290 positional, each adding 15s to Blood (30s at most). Geirskogul (200, 10s recast)
// costs 10s of Blood. Power Surge (+50% to the next jump), Life Surge (a sure crit), Blood for Blood (+30% for the
// Dragoon), Battle Litany (+15% crit) and Internal Release (+10% crit). Heavensward's damage formula (B.LEVELS.hw60).
// Numbers are the official job guide's 3.57 tooltips (Wayback, June 2017) and the FFXIV wiki's Heavensward Dragoon
// guide; Blood of the Dragon and Power Surge are added together on a jump (200 × 1.8), which isn't settled. Gear is an
// Alexander: Creator set at 2.38 (the Shire / Alexandrian spear: 84 weapon damage, 2.8 delay).
(function (B) {
  const EPS = 1e-6;
  const BOTD_MAX = 30;
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.5, fx: 'slash' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const ACTIONS = {
    trueThrust: ws({ name: 'True Thrust', potency: 150, tp: 70, comboStart: true, comboNext: true, desc: 'Delivers an attack with a potency of 150.' }),
    vorpalThrust: ws({ name: 'Vorpal Thrust', potency: 100, comboPotency: 200, comboFrom: 'trueThrust', comboNext: true, tp: 60, fx: 'slash2', desc: 'Delivers an attack with a potency of 100.\nCombo Action: True Thrust\nCombo Potency: 200' }),
    fullThrust: ws({ name: 'Full Thrust', potency: 100, comboPotency: 360, comboFrom: 'vorpalThrust', tp: 60, finisher: true, fx: 'slash3', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Vorpal Thrust\nCombo Potency: 360\nBlood of the Dragon Combo Bonus: Grants Sharper Fang and Claw (finished from the flank) or Enhanced Wheeling Thrust (from the rear)\nDuration: 10s' }),
    impulseDrive: ws({ name: 'Impulse Drive', potency: 180, tp: 70, comboStart: true, comboNext: true, desc: 'Delivers an attack with a potency of 180.' }),
    disembowel: ws({ name: 'Disembowel', potency: 100, comboPotency: 220, comboFrom: 'impulseDrive', comboNext: true, tp: 60, fx: 'slash2', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Impulse Drive\nCombo Potency: 220\nCombo Bonus: Reduces target\'s piercing resistance by 10%\nDuration: 30s' }),
    chaosThrust: ws({ name: 'Chaos Thrust', potency: 100, comboPotency: 200, comboFrom: 'disembowel', positional: 'rear', posBonus: 50, comboPos: true, tp: 60, finisher: true, dot: { potency: 35, duration: 30 }, fx: 'slash3', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Disembowel\nCombo Potency: 200\nRear Combo Potency: 250\nCombo Bonus: Damage over time\nPotency: 35\nDuration: 30s\nBlood of the Dragon Combo Bonus: Grants Sharper Fang and Claw (flank) or Enhanced Wheeling Thrust (rear)\nDuration: 10s' }),
    heavyThrust: ws({ name: 'Heavy Thrust', potency: 100, positional: 'flank', posBonus: 70, tp: 70, breaksCombo: true, fx: 'slash2', desc: 'Delivers an attack with a potency of 100.\n170 when executed from a target\'s flank.\nAdditional Effect: Increases damage dealt by 15%\nDuration: 24s' }),
    phlebotomize: ws({ name: 'Phlebotomize', potency: 170, tp: 90, breaksCombo: true, dot: { potency: 30, duration: 24 }, fx: 'slash2', desc: 'Delivers an attack with a potency of 170.\nAdditional Effect: Damage over time\nPotency: 30\nDuration: 24s' }),
    fangAndClaw: ws({ name: 'Fang and Claw', potency: 200, positional: 'flank', posBonus: 90, tp: 60, needs: 'sharperFangAndClaw', fx: 'slash3', desc: 'Delivers an attack with a potency of 200.\n290 when executed from a target\'s flank.\nAdditional Effect: Extends Blood of the Dragon by 15s (to 30s at most)\nCan only be executed under Blood of the Dragon and Sharper Fang and Claw.' }),
    wheelingThrust: ws({ name: 'Wheeling Thrust', potency: 200, positional: 'rear', posBonus: 90, tp: 60, needs: 'enhancedWheelingThrust', fx: 'slash3', desc: 'Delivers an attack with a potency of 200.\n290 when executed from a target\'s rear.\nAdditional Effect: Extends Blood of the Dragon by 15s (to 30s at most)\nCan only be executed under Blood of the Dragon and Enhanced Wheeling Thrust.' }),
    piercingTalon: ws({ name: 'Piercing Talon', potency: 120, tp: 130, range: 15, breaksCombo: true, delay: 0.7, desc: 'Delivers a ranged attack with a potency of 120.' }),
    doomSpike: ws({ name: 'Doom Spike', potency: 160, tp: 160, range: 10, aoe: true, breaksCombo: true, desc: 'Delivers an attack with a potency of 160 to all enemies in a straight line before you.' }),
    // Off the GCD.
    jump: ab({ name: 'Jump', recast: 30, potency: 200, jumpBuff: true, target: true, range: 15, delay: 0.8, fx: 'slash3', desc: 'Delivers a jumping attack with a potency of 200.' }),
    spineshatterDive: ab({ name: 'Spineshatter Dive', recast: 60, potency: 170, jumpBuff: true, target: true, range: 15, delay: 0.8, fx: 'slash3', desc: 'Delivers a jumping attack with a potency of 170.\nAdditional Effect: Stun\nDuration: 2s' }),
    dragonfireDive: ab({ name: 'Dragonfire Dive', recast: 120, potency: 250, target: true, range: 15, aoe: true, delay: 0.8, fx: 'gnbBurst', desc: 'Delivers a jumping fire-based attack with a potency of 250 to target and all enemies nearby it.' }),
    geirskogul: ab({ name: 'Geirskogul', recast: 10, potency: 200, target: true, range: 15, aoe: true, delay: 0.6, fx: 'gnbBow', desc: 'Delivers an attack with a potency of 200 to all enemies in a straight line before you.\nReduces Blood of the Dragon by 10s.\nCan only be executed under Blood of the Dragon.' }),
    legSweep: ab({ name: 'Leg Sweep', recast: 20, potency: 130, target: true, range: B.MELEE_RANGE, delay: 0.5, fx: 'slash', desc: 'Delivers an attack with a potency of 130.\nAdditional Effect: Stun\nDuration: 3s' }),
    bloodOfTheDragon: ab({ name: 'Blood of the Dragon', recast: 60, desc: 'Increases the potency of Jump and Spineshatter Dive by 30%.\nDuration: 15s\nAdditional Effect: Full Thrust and Chaos Thrust combos grant Sharper Fang and Claw or Enhanced Wheeling Thrust.\nFang and Claw and Wheeling Thrust extend it by 15s (to 30s); Geirskogul shortens it by 10s.' }),
    powerSurge: ab({ name: 'Power Surge', recast: 60, desc: 'Increases the potency of the next Jump or Spineshatter Dive by 50%.\nDuration: 10s' }),
    lifeSurge: ab({ name: 'Life Surge', recast: 50, desc: 'Ensures the next weaponskill is a critical hit.\nDuration: 10s' }),
    battleLitany: ab({ name: 'Battle Litany', recast: 180, desc: 'Increases critical hit rate of self and nearby party members by 15%.\nDuration: 20s' }),
    bloodForBlood: ab({ name: 'Blood for Blood', recast: 80, desc: 'Increases damage dealt by 30% while increasing damage taken by 15% (Enhanced Blood for Blood).\nDuration: 20s' }),
    invigorate: ab({ name: 'Invigorate', recast: 120, desc: 'Instantly restores 500 TP (Exhilarate).' }),
    elusiveJump: ab({ name: 'Elusive Jump', recast: 180, desc: 'Executes a 15-yalm backflip.' }),
    keenFlurry: ab({ name: 'Keen Flurry', recast: 90, desc: 'Increases parry rate by 30%.\nDuration: 20s' }),
    // Pugilist cross-class.
    internalRelease: ab({ name: 'Internal Release', recast: 60, role: true, desc: 'Increases critical hit rate by 10%.\nDuration: 15s' }),
    secondWind: ab({ name: 'Second Wind', recast: 120, role: true, desc: 'Instantly restores own HP.' }),
    ...B.GENERAL_ACTIONS,
    tincture: Object.assign({}, B.tincture('str3sb'), { name: 'Supramax-Potion of Strength', dur: 15, desc: 'This diluted brew temporarily increases strength.\nStrength +20% (Max 154)\nDuration: 15s' }),
    auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
  };

  const STATUSES = {
    bloodOfTheDragon: { name: 'Blood of the Dragon', self: true, icon: 'st_botd' },
    sharperFangAndClaw: { name: 'Sharper Fang and Claw', self: true, icon: 'st_fang' },
    enhancedWheelingThrust: { name: 'Enhanced Wheeling Thrust', self: true, icon: 'st_wheel' },
    heavyThrust: { name: 'Heavy Thrust', self: true, icon: 'st_heavy' },
    powerSurge: { name: 'Power Surge', self: true, icon: 'st_surge' },
    lifeSurge: { name: 'Life Surge', self: true, icon: 'st_lifesurge' },
    battleLitany: { name: 'Battle Litany', self: true, icon: 'st_litany' },
    bloodForBlood: { name: 'Blood for Blood', self: true, icon: 'st_bfb' },
    internalRelease: { name: 'Internal Release', self: true, icon: 'st_ir' },
    keenFlurry: { name: 'Keen Flurry', self: true, icon: 'st_keen' },
    piercingResDown: { name: 'Piercing Resistance Down', self: false, icon: 'st_pierce' },
    chaosThrust: { name: 'Chaos Thrust', self: false, icon: 'st_chaos' },
    phlebotomize: { name: 'Phlebotomize', self: false, icon: 'st_phlebo' },
  };

  class DragoonHW {
    constructor() {
      this.name = 'Dragoon';
      this.abbr = 'DRG';
      this.role = 'melee';
      this.level = 60;
      this.levelKey = 'hw60';
      this.model = 'drg-hw';
      this.actions = ACTIONS;
      this.statuses = STATUSES;
      this.tp = { max: 1000, regen: 60 };
      this.comboTime = 10;
      // An Alexander: Creator set at 2.38 (the guide's skill speed tier), Heavensward-era stats. No Direct Hit before 4.0.
      this.stats = { hp: 20600, main: 1591, mainStat: 'str', jobMod: 115, trait: 100, wd: 84, det: 798, crit: 1284, dh: 354, speed: 664, delay: 2.8 };
      this.speedName = 'Skill speed';
      this.tierHaste = 0;
      this.autoAttack = { potency: 100, delay: 2.8, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['bloodOfTheDragon', 'sharperFangAndClaw', 'enhancedWheelingThrust', 'heavyThrust', 'bloodForBlood', 'battleLitany',
        'internalRelease', 'powerSurge', 'lifeSurge', 'medicated', 'keenFlurry', 'sprint'];
      this.targetStatusOrder = ['piercingResDown', 'chaosThrust', 'phlebotomize'];
      this.defaultBars = [
        ['trueThrust', 'vorpalThrust', 'fullThrust', 'impulseDrive', 'disembowel', 'chaosThrust', 'heavyThrust', 'phlebotomize', 'fangAndClaw', 'wheelingThrust', 'jump', 'spineshatterDive'],
        ['bloodOfTheDragon', 'geirskogul', 'powerSurge', 'lifeSurge', 'dragonfireDive', 'legSweep', 'bloodForBlood', 'battleLitany', 'internalRelease', 'tincture', 'invigorate', 'piercingTalon'],
        ['doomSpike', 'elusiveJump', 'keenFlurry', 'secondWind', 'sprint', null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Dragoon', ['trueThrust', 'vorpalThrust', 'fullThrust', 'impulseDrive', 'disembowel', 'chaosThrust', 'heavyThrust', 'phlebotomize', 'fangAndClaw',
          'wheelingThrust', 'piercingTalon', 'doomSpike', 'jump', 'spineshatterDive', 'dragonfireDive', 'geirskogul', 'legSweep', 'bloodOfTheDragon',
          'powerSurge', 'lifeSurge', 'battleLitany', 'bloodForBlood', 'invigorate', 'elusiveJump', 'keenFlurry']],
        ['Cross-class', ['internalRelease', 'secondWind']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 2480;     // a scripted 3.5 rotation parses about 2,340 on the dummy
      this.referenceGcd = 2.38;
      this.startDistance = 3.2;
    }

    initGauge() { return {}; }

    botd(e) { return e.has('bloodOfTheDragon'); }

    check(id, e) {
      const a = this.actions[id];
      if (a.needs && (!e.has(a.needs) || !this.botd(e))) return 'Unable to execute action.';
      if (id === 'geirskogul' && !this.botd(e)) return 'Unable to execute action. Blood of the Dragon required.';
      return null;
    }

    snapshot(a, e) {
      let mult = 1, critAdd = 0;
      if (e.has('heavyThrust')) mult *= 1.15;
      if (e.has('bloodForBlood')) mult *= 1.30;
      if (e.tHas('piercingResDown')) mult *= 1.10;
      if (e.has('battleLitany')) critAdd += 0.15;
      if (e.has('internalRelease')) critAdd += 0.10;
      const main = this.stats.main + (e.has('medicated') ? (this.potionCap || 154) : 0);
      return { mult, main, critAdd };
    }

    resolve(id, e) {
      if (this.actions[id].kind === 'gcd') this.weaponskill(id, e);
      else this.ability(id, e);
    }

    weaponskill(id, e) {
      const a = this.actions[id];
      const combo = !!a.comboFrom && e.lastComboHit;
      let potency = a.comboFrom && combo ? a.comboPotency : a.potency;
      const posOk = !!a.positional && (!a.comboPos || combo) && e.positionalHit(a);
      if (posOk) potency += a.posBonus;
      const snap = this.snapshot(a, e);
      let crit = false;
      if (e.has('lifeSurge')) { crit = true; e.removeStatus('lifeSurge'); }
      if (id === 'heavyThrust') e.addStatus('heavyThrust', 24);
      if (id === 'disembowel' && combo) e.addTStatus('piercingResDown', 30);
      if (a.needs) {
        e.removeStatus(a.needs);
        const s = e.statuses.bloodOfTheDragon;
        if (s) s.until = Math.min(e.now + BOTD_MAX, s.until + 15);
      }
      // Blood of the Dragon: a finished Full Thrust or Chaos Thrust combo opens Fang and Claw (flank) or Wheeling Thrust (rear).
      if (a.finisher && combo && this.botd(e)) {
        const rear = e.positionalHit({ positional: 'rear' });
        e.addStatus(rear ? 'enhancedWheelingThrust' : 'sharperFangAndClaw', 10);
      }
      const dot = a.dot && (!a.comboFrom || combo);
      const after = dot ? () => e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }) : null;
      e.queueHit(id, potency, snap, a.delay, after, { crit, positional: a.positional ? (posOk ? 'hit' : 'miss') : null });
    }

    ability(id, e) {
      const a = this.actions[id];
      switch (id) {
        case 'bloodOfTheDragon': e.addStatus('bloodOfTheDragon', 15); return;
        case 'powerSurge': e.addStatus('powerSurge', 10); return;
        case 'lifeSurge': e.addStatus('lifeSurge', 10); return;
        case 'battleLitany': e.addStatus('battleLitany', 20); return;
        case 'bloodForBlood': e.addStatus('bloodForBlood', 20); return;
        case 'internalRelease': e.addStatus('internalRelease', 15); return;
        case 'keenFlurry': e.addStatus('keenFlurry', 20); return;
        case 'invigorate': e.tp = Math.min(this.tp.max, e.tp + 500); return;
        case 'geirskogul': {
          const s = e.statuses.bloodOfTheDragon;
          if (s) { s.until -= 10; if (s.until <= e.now + EPS) e.removeStatus('bloodOfTheDragon'); }
          break;
        }
        default:
          if (B.ROLE_EFFECTS[id]) { B.ROLE_EFFECTS[id](e); return; }
      }
      if (!a.potency) return;
      let potency = a.potency;
      if (a.jumpBuff) {
        // Blood of the Dragon and Power Surge, added together.
        let bonus = this.botd(e) ? 0.3 : 0;
        if (e.has('powerSurge')) { bonus += 0.5; e.removeStatus('powerSurge'); }
        potency = Math.round(potency * (1 + bonus));
        this.gap(e);
      }
      e.queueHit(id, potency, this.snapshot(a, e), a.delay);
    }

    gap(e) {
      const d = e.distToTarget() || 1;
      if (d > 2.6) {
        const from = { x: e.pos.x, z: e.pos.z };
        e.pos.x *= 2.4 / d; e.pos.z *= 2.4 / d;
        e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
      }
    }

    proc(id, e) {
      const a = this.actions[id];
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (a.needs) return e.has(a.needs) && this.botd(e);
      return false;
    }

    mpRegen() { return B.BASE_REGEN; }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Heavensward's formula (no Direct Hit)`; }

    // ---------- Blood of the Dragon (Heavensward had no job gauge; this shows its timer) ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="100" viewBox="0 0 360 100">
  <rect x="8" y="10" width="344" height="80" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text x="24" y="38" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">BLOOD OF THE DRAGON</text>
  <rect x="24" y="52" width="250" height="14" rx="7" fill="#2a2535" stroke="rgba(0,0,0,.8)"/>
  <rect id="dh-b" x="24" y="52" width="0" height="14" rx="7" fill="#5a7fe0"/>
  <text id="dh-t" x="336" y="66" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke"></text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.dg = { b: $('#dh-b'), t: $('#dh-t'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.dg, c = G.cache;
      const left = this.botd(e) ? Math.max(0, e.statuses.bloodOfTheDragon.until - e.now) : 0;
      const k = Math.round(left * 4);
      if (c.k !== k) {
        c.k = k;
        G.b.setAttribute('width', (250 * Math.min(1, left / BOTD_MAX)).toFixed(1));
        G.b.setAttribute('fill', left > 0 && left < 8 ? '#ff8f6b' : '#5a7fe0');
        G.t.textContent = left ? Math.ceil(left) + 's' : '';
      }
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Heavensward 3.0–3.57)</h3>
<p>Level 60 Dragoon on TP. Keep up <b>Heavy Thrust</b> (+15% damage, 24s), <b>Disembowel</b>'s −10% piercing resistance (Impulse Drive → Disembowel → <b>Chaos Thrust</b>: 250 from the rear + 35 × 30s) and <b>Phlebotomize</b> (170 + 30 × 24s); otherwise True Thrust → Vorpal Thrust → <b>Full Thrust</b> (360).</p>
<p><b>Blood of the Dragon</b> (60s) lasts only 15s: Jump and Spineshatter Dive get +30%, and each Full Thrust or Chaos Thrust combo opens <b>Fang and Claw</b> (if you finished from the flank) or <b>Wheeling Thrust</b> (from the rear), 290 from that side, each adding 15s to Blood (30s at most). <b>Geirskogul</b> (200, 10s recast) takes 10s off it, so spend it only while there's time to reach the next finisher. Power Surge (+50%) goes on Jump; Life Surge on Full Thrust. Blood for Blood is +30% for a Dragoon.</p>
<h3>The opener (the FFXIV wiki's Heavensward Dragoon guide)</h3>
${seq(['heavyThrust', ['battleLitany'], ['internalRelease'], 'impulseDrive', ['bloodOfTheDragon'], ['bloodForBlood'], 'disembowel', ['tincture'], 'chaosThrust', ['powerSurge'], ['legSweep'], 'wheelingThrust', ['jump'], 'phlebotomize', ['spineshatterDive'], 'trueThrust', ['dragonfireDive'], 'vorpalThrust', ['lifeSurge'], ['geirskogul'], 'fullThrust', 'fangAndClaw'])}
<p>Chaos Thrust from the rear gives Wheeling Thrust; Full Thrust from the flank gives Fang and Claw, so both are from the side you're already on.</p>
<p style="color:#a9a3b4">The 3.57 numbers: True Thrust 150, Vorpal Thrust combo 200, Full Thrust combo 360, Impulse Drive 180, Disembowel combo 220, Chaos Thrust combo 200 (250 rear) + 35 × 30s, Heavy Thrust 100 (170 flank), Phlebotomize 170 + 30 × 24s, Fang and Claw / Wheeling Thrust 200 (290 positional), Jump 200, Spineshatter Dive 170, Dragonfire Dive 250, Geirskogul 200, Leg Sweep 130. Heavensward's formula is the community fit; gear is an Alexander: Creator set (Strength 1,591, 84 weapon damage) with the Supramax-Potion of Strength.</p>`;
    }
  }

  B.DragoonHW = DragoonHW;
  B.registerJob({
    id: 'drg', name: 'Dragoon', abbr: 'DRG', role: 'melee', classJob: 22,
    versions: [{ id: 'hw30', label: 'Heavensward 3.0–3.57', history: 'HW 3.0–3.57', note: 'Level 60 on TP: Blood of the Dragon kept going by Fang and Claw and Wheeling Thrust, Geirskogul spending it, Heavy Thrust, Phlebotomize, Blood for Blood +30%; Creator gear', create: () => new DragoonHW() }],
  });
})(window.BLM);

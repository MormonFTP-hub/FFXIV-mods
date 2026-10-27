// Paladin, Shadowbringers at level 80, in two versions. Built on the Dawntrail class (pld_dt.js) for the Oath Gauge,
// Intervene and the defensives, with the 5.x kit: Fast Blade → Riot Blade, then Royal Authority (three Sword Oath
// stacks for Atonement) or Goring Blade (a 21s DoT); Fight or Flight raises physical damage only (+25%, 25s), and
// Requiescat is an attack (150–550 by MP) that, at 80% MP or more, gives 12s of +50% magic potency and instant spells
// for four Holy Spirits and Confiteor, which ends it. Tank spells ignore skill speed (no spell speed on tank gear): Holy
// Spirit is a 1.5s cast on a 2.50s recast.
//  - 5.0–5.08: Sentinel 10s and a single-target 5s Reprisal; Eden's Gate gear.
//  - 5.1–5.58: Sentinel 15s, Reprisal on all nearby enemies for 10s; Eden's Promise gear and the relic.
// No damage number changed from 5.0 to 5.58 (the game data at 17 patches, the Lodestone notes and the wiki's patch
// histories). Gear stats are the 5.58 Item.csv's (pre-6.0); the opener is The Balance's 5.5x one. ref: a scripted bot
// parses about 12,500 / 8,680 on these.
(function (B) {
  const DT = B.PaladinDT;
  const FOF = 1.25, REQ = 1.5;
  const VERSIONS = {
    shb51: { label: 'Shadowbringers 5.1–5.58', history: 'ShB 5.1–5.58', sentinel: 15, reprisal: 10, tincture: 'str4', gcd: 2.41, ref: 13250,
      stats: { hp: 90000, main: 5509, wd: 134, det: 2600, crit: 4145, dh: 1280, speed: 1218, ten: 908 },
      gear: 'The Balance\'s 5.58 relic set at 2.41 (Strength 5,509, 134 weapon damage)',
      note: 'Level 80: Royal Authority into three Atonements, Goring Blade\'s DoT, Fight or Flight for physical hits, Requiescat into four instant Holy Spirits and Confiteor; Eden\'s Promise gear' },
    shb50: { label: 'Shadowbringers 5.0–5.08', history: 'ShB 5.0–5.08', sentinel: 10, reprisal: 5, tincture: 'str2', gcd: 2.4, ref: 9200,
      stats: { hp: 78000, main: 4142, wd: 122, det: 1913, crit: 3602, dh: 1280, speed: 1331, ten: 1041 },
      gear: 'an Eden\'s Gate set at 2.40 (Strength 4,142, 122 weapon damage), with a Grade 2 Tincture',
      note: 'The launch Paladin: the 5.1 kit with a 10s Sentinel and a single-target Reprisal; Eden\'s Gate gear' },
  };
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.5, fx: 'gnbSlash' }, o);
  const spell = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.7, school: 'holy', mp: 2000, spell: true, magic: true,
    fixedRecast: 2.5, fx: 'gnbBurst', sound: 'paradox' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);

  function buildActions(V) {
    return {
      fastBlade: ws({ name: 'Fast Blade', potency: 200, comboStart: true, comboNext: true, desc: 'Delivers an attack with a potency of 200.' }),
      riotBlade: ws({ name: 'Riot Blade', potency: 100, comboPotency: 300, comboFrom: 'fastBlade', comboNext: true, fx: 'gnbSlash2', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Fast Blade\nCombo Potency: 300\nCombo Bonus: Restores MP' }),
      royalAuthority: ws({ name: 'Royal Authority', potency: 100, comboPotency: 550, comboFrom: 'riotBlade', fx: 'gnbBarrel', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Riot Blade\nCombo Potency: 550\nCombo Bonus: Grants 3 stacks of Sword Oath\nDuration: 15s' }),
      goringBlade: ws({ name: 'Goring Blade', potency: 100, comboPotency: 390, comboFrom: 'riotBlade', dot: { potency: 85, duration: 21 }, fx: 'gnbFang3', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Riot Blade\nCombo Potency: 390\nCombo Bonus: Damage over time\nPotency: 85\nDuration: 21s' }),
      atonement: ws({ name: 'Atonement', potency: 550, fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 550.\nAdditional Effect: Restores MP\nCan only be executed while under the effect of Sword Oath.' }),
      shieldLob: ws({ name: 'Shield Lob', potency: 120, range: 20, delay: 0.7, fx: 'gnbShot', desc: 'Delivers a ranged attack with a potency of 120.\nAdditional Effect: Increased enmity' }),
      totalEclipse: ws({ name: 'Total Eclipse', potency: 120, comboStart: true, comboNext: true, target: false, pbaoe: 5, aoe: true, desc: 'Delivers an attack with a potency of 120 to all nearby enemies.' }),
      prominence: ws({ name: 'Prominence', potency: 100, comboPotency: 220, comboFrom: 'totalEclipse', target: false, pbaoe: 5, aoe: true, fx: 'gnbSlash2', desc: 'Delivers an attack with a potency of 100 to all nearby enemies.\nCombo Action: Total Eclipse\nCombo Potency: 220\nCombo Bonus: Restores MP' }),
      holySpirit: spell({ name: 'Holy Spirit', potency: 350, cast: 1.5, desc: 'Deals unaspected damage with a potency of 350.\nCast 1.5s, recast 2.5s (no spell speed on tank gear).' }),
      holyCircle: spell({ name: 'Holy Circle', potency: 250, cast: 1.5, target: false, pbaoe: 5, aoe: true, desc: 'Deals unaspected damage with a potency of 250 to all nearby enemies.' }),
      confiteor: spell({ name: 'Confiteor', potency: 800, aoe: true, fx: 'gnbZone', desc: 'Deals unaspected damage with a potency of 800 to target and all enemies nearby it.\nCan only be executed while under the effect of Requiescat. Effect fades upon execution.' }),
      clemency: spell({ name: 'Clemency', potency: 0, cast: 1.5, magic: false, target: false, desc: 'Restores target\'s HP.\nCure Potency: 1,200\nAdditional Effect: Restores to self 50% of HP restored to target if target is a party member' }),
      fightOrFlight: ab({ name: 'Fight or Flight', recast: 60, desc: 'Increases physical damage dealt by 25%.\nDuration: 25s' }),
      requiescat: ab({ name: 'Requiescat', recast: 60, potency: 550, target: true, range: B.MELEE_RANGE, delay: 0.6, magic: true, fx: 'gnbZone',
        desc: 'Deals unaspected damage with a potency of 150. Potency increases up to 550 as MP nears maximum.\nAdditional Effect: Increases attack magic and healing magic potency by 50% if current MP is at 80% or higher, and allows spells to be cast immediately\nDuration: 12s' }),
      spiritsWithin: ab({ name: 'Spirits Within', recast: 30, potency: 370, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'gnbBow', desc: 'Delivers an attack with a potency of 100.\nPotency increases up to 370 as own HP nears maximum.\nAdditional Effect: Restores MP' }),
      circleOfScorn: ab({ name: 'Circle of Scorn', recast: 25, potency: 120, target: false, pbaoe: 5, aoe: true, delay: 0.6, dot: { potency: 35, duration: 15, aoe: true }, fx: 'gnbBow', desc: 'Delivers an attack with a potency of 120 to all nearby enemies.\nAdditional Effect: Damage over time\nPotency: 35\nDuration: 15s' }),
      intervene: ab({ name: 'Intervene', recast: 30, charges: 2, potency: 200, target: true, range: 20, delay: 0.3, fx: 'gnbCont', desc: 'Rushes target and delivers an attack with a potency of 200.\nMaximum Charges: 2\nCannot be executed while bound.' }),
      ironWill: ab({ name: 'Iron Will', recast: 10, desc: 'Significantly increases enmity generation.\nEffect ends upon reuse.' }),
      sheltron: ab({ name: 'Sheltron', recast: 5, oath: 50, desc: 'Block incoming attacks.\nDuration: 6s\nOath Gauge Cost: 50' }),
      intervention: ab({ name: 'Intervention', recast: 10, oath: 50, desc: 'Reduces target party member\'s damage taken by 10%.\nDuration: 6s\nOath Gauge Cost: 50' }),
      cover: ab({ name: 'Cover', recast: 120, oath: 50, desc: 'Take all damage intended for another party member.\nDuration: 12s\nOath Gauge Cost: 50' }),
      sentinel: ab({ name: 'Sentinel', recast: 120, desc: `Reduces damage taken by 30%.\nDuration: ${V.sentinel}s` }),
      hallowedGround: ab({ name: 'Hallowed Ground', recast: 420, desc: 'Renders you impervious to most attacks.\nDuration: 10s' }),
      divineVeil: ab({ name: 'Divine Veil', recast: 90, desc: 'Upon HP recovery via healing magic, a protective barrier is cast on all party members within 15 yalms.\nDuration: 30s' }),
      passageOfArms: ab({ name: 'Passage of Arms', recast: 120, desc: 'Increases block rate to 100% and creates a designated area in a cone behind you in which party members will only suffer 85% of all damage inflicted.\nDuration: 18s\nEffect ends upon using another action or moving.' }),
      ...B.ROLE_ACTIONS.tank,
      reprisal: Object.assign({}, B.ROLE_ACTIONS.tank.reprisal, V.reprisal === 5 ? { desc: 'Reduces damage dealt by target by 10%.\nDuration: 5s' } : {}),
      ...B.GENERAL_ACTIONS,
      tincture: B.tincture(V.tincture),
      auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
    };
  }

  class PaladinShB extends DT {
    constructor(version) {
      super();
      const V = VERSIONS[version];
      this.V = V;
      this.level = 80;
      this.levelKey = 'shb80';
      this.model = 'pld-shb';
      this.tinctureKey = V.tincture;
      this.maxMp = 10000;
      this.actions = buildActions(V);
      this.statuses = Object.assign({}, this.statuses, {
        swordOath: { name: 'Sword Oath', self: true, icon: 'st_oath' },
        sheltron: { name: 'Sheltron', self: true, icon: 'st_sheltron' },
        sentinel: { name: 'Sentinel', self: true, icon: 'st_sentinel' },
        cover: { name: 'Cover', self: true, icon: 'st_cover' },
        goringBlade: { name: 'Goring Blade', self: false, icon: 'st_goring' },
      });
      this.stats = Object.assign({ mainStat: 'str', jobMod: 100, trait: 100, delay: 2.24 }, V.stats);
      this.autoAttack = { potency: 110, delay: 2.24, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['fightOrFlight', 'requiescat', 'swordOath', 'ironWill', 'medicated', 'sheltron', 'rampart', 'sentinel',
        'hallowedGround', 'divineVeil', 'passageOfArms', 'cover', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['goringBlade', 'circleOfScorn', 'reprisal'];
      this.defaultBars = [
        ['fastBlade', 'riotBlade', 'royalAuthority', 'goringBlade', 'atonement', 'holySpirit', 'confiteor', 'fightOrFlight', 'requiescat', 'spiritsWithin', 'circleOfScorn', 'intervene'],
        ['shieldLob', 'tincture', 'ironWill', 'sheltron', 'rampart', 'sentinel', 'hallowedGround', 'divineVeil', 'intervention', 'reprisal', 'provoke', 'cover'],
        ['totalEclipse', 'prominence', 'holyCircle', 'clemency', 'passageOfArms', 'shirk', 'lowBlow', 'interject', 'armsLength', 'sprint', null, null],
      ];
      this.actionGroups = [
        ['Paladin', ['fastBlade', 'riotBlade', 'royalAuthority', 'goringBlade', 'atonement', 'holySpirit', 'confiteor', 'fightOrFlight', 'requiescat',
          'spiritsWithin', 'circleOfScorn', 'intervene', 'shieldLob', 'totalEclipse', 'prominence', 'holyCircle', 'clemency', 'ironWill', 'sheltron',
          'intervention', 'cover', 'sentinel', 'hallowedGround', 'divineVeil', 'passageOfArms']],
        ['Role Actions', ['rampart', 'lowBlow', 'provoke', 'interject', 'reprisal', 'armsLength', 'shirk']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = V.gcd;
    }

    initGauge() { return { oath: 0 }; }
    resolveId(id) { return id; }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (id === 'atonement' && !e.has('swordOath')) return 'Unable to execute action. Sword Oath required.';
      if (id === 'confiteor' && !e.has('requiescat')) return 'Unable to execute action. Requiescat required.';
      if (a.oath && g.oath < a.oath) return 'Not enough Oath Gauge.';
      return null;
    }

    // Spells are instant under Requiescat; otherwise a flat 1.5s (tank gear has no spell speed).
    castTime(id, e) {
      const a = this.actions[id];
      if (!a.cast) return 0;
      return e.has('requiescat') ? 0 : a.cast;
    }

    // Fight or Flight: physical hits (weaponskills, abilities, auto-attacks). Requiescat: spells.
    snapshot(a, e) {
      let mult = 1;
      if (a.magic) { if (a.spell && e.has('requiescat')) mult = REQ; }
      else if (e.has('fightOrFlight')) mult = FOF;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main };
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      let potency = a.potency || 0, snap = null, dot = a.dot;
      if (a.comboFrom) { if (e.lastComboHit) potency = a.comboPotency; else dot = null; }
      if (a.mp) e.mp -= a.mp;
      if (a.oath) g.oath -= a.oath;

      switch (id) {
        case 'riotBlade': if (e.lastComboHit) this.gainMp(e, 1000); break;
        case 'royalAuthority': if (e.lastComboHit) e.addStatus('swordOath', 15, { stacks: 3 }); break;
        case 'prominence': if (e.lastComboHit) this.gainMp(e, 500); break;
        case 'atonement': {
          const s = e.statuses.swordOath;
          s.stacks = (s.stacks || 1) - 1;
          if (s.stacks <= 0) e.removeStatus('swordOath'); else e.emit('statusStack', { key: 'swordOath' });
          this.gainMp(e, 400);
          break;
        }
        // Requiescat's own hit lands before its buff; Confiteor's gains from the Requiescat it ends.
        case 'requiescat':
          potency = Math.floor(150 + 400 * Math.max(0, e.mp) / e.maxMp);
          snap = this.snapshot(a, e);
          if (e.mp >= 0.8 * e.maxMp) e.addStatus('requiescat', 12);
          break;
        case 'confiteor': snap = this.snapshot(a, e); e.removeStatus('requiescat'); break;
        case 'fightOrFlight': e.addStatus('fightOrFlight', 25); break;
        case 'spiritsWithin': this.gainMp(e, 500); break;
        case 'intervene': {
          const d = e.distToTarget() || 1;
          if (d > 2.6) {
            const from = { x: e.pos.x, z: e.pos.z };
            e.pos.x *= 2.4 / d; e.pos.z *= 2.4 / d;
            e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
          }
          break;
        }
        case 'ironWill':
          if (e.has('ironWill')) e.removeStatus('ironWill');
          else e.addStatus('ironWill', 1e9, { permanent: true });
          break;
        case 'sheltron': e.addStatus('sheltron', 6); break;
        case 'sentinel': e.addStatus('sentinel', this.V.sentinel); break;
        case 'cover': e.addStatus('cover', 12); break;
        case 'hallowedGround': e.addStatus('hallowedGround', 10); break;
        case 'divineVeil': e.addStatus('divineVeil', 30); break;
        case 'passageOfArms': e.addStatus('passageOfArms', 18); break;
        case 'reprisal': e.addTStatus('reprisal', this.V.reprisal); break;
        default:
          if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
      }

      if (potency) {
        snap = snap || this.snapshot(a, e);
        const s = snap;
        const after = dot ? () => e.addTStatus(id, dot.duration, { snap: s, dot: { potency: dot.potency, id } }) : null;
        e.queueHit(id, potency, snap, a.delay, after);
      }
    }

    proc(id, e) {
      const a = this.actions[id];
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (id === 'atonement') return e.has('swordOath');
      if (id === 'confiteor') return e.has('requiescat');
      if (id === 'holySpirit') return e.has('requiescat');
      return false;
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · spells 2.50 · Fight or Flight fits ${Math.floor(25 / e.gcdForSpeed(e.stats.speed))} GCDs`; }

    gaugeUpdate(e) {
      const G = this.pg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      put('o', g.oath, v => { G.n.textContent = String(v); G.bar.setAttribute('width', String(312 * v / 100)); });
      const r = e.has('requiescat') ? Math.ceil(e.statuses.requiescat.until - e.now) : 0;
      const so = e.has('swordOath') ? (e.statuses.swordOath.stacks || 0) : 0;
      put('r', `${r}|${so}`, () => { G.req.textContent = [r ? `REQUIESCAT ${r}s` : '', so ? `SWORD OATH ×${so}` : ''].filter(Boolean).join('  ·  '); });
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 80 Paladin. <b>Fast Blade → Riot Blade</b> (its combo restores MP), then either <b>Royal Authority</b> (550, three <b>Sword Oath</b> stacks for 15s) or <b>Goring Blade</b> (390 and a DoT of 85 for 21s). Each Sword Oath stack is one <b>Atonement</b> (550, restores MP). Alternate the two finishers, keeping Goring Blade's DoT up.</p>
<p><b>Fight or Flight</b> (+25% to physical damage for 25s, 60s) fits about eleven weaponskills: put two Goring Blades, a Royal Authority and its three Atonements in it, with <b>Spirits Within</b> (370), <b>Circle of Scorn</b> (120 + a DoT) and both <b>Intervene</b> charges (200). Then, at 80% MP or more, <b>Requiescat</b> (550 at full MP): for 12s spells are instant and 50% stronger, enough for four <b>Holy Spirits</b> (350, 2,000 MP each) and <b>Confiteor</b> (800, which ends Requiescat). Tank gear has no spell speed, so each spell takes 2.50s. Fight or Flight doesn't raise spells, so keep them apart.</p>
<h3>The opener (The Balance, 5.5x)</h3>
${seq(['holySpirit', 'fastBlade', ['circleOfScorn'], ['fightOrFlight'], 'riotBlade', 'goringBlade', 'fastBlade', ['tincture'], 'riotBlade', ['spiritsWithin'], ['intervene'], 'royalAuthority', ['intervene'], 'atonement', 'atonement', 'atonement', 'fastBlade', 'riotBlade', ['circleOfScorn'], 'goringBlade', ['requiescat'], 'holySpirit', 'holySpirit', 'holySpirit', 'holySpirit', 'confiteor', ['spiritsWithin']])}
<p>A hardcast Holy Spirit 2s before the pull. Then: Fast Blade → Riot Blade → Goring Blade → Fast Blade → Riot Blade → Royal Authority → three Atonements, with Fight or Flight late on the next Fast Blade, about 63s a loop.${V.reprisal === 5 ? ' No 5.0x text of the opener survives; the kit is the same, so the 5.5x one is used.' : ''}</p>
<p style="color:#a9a3b4">The 5.0–5.58 numbers: Fast Blade 200, Riot Blade 300, Royal Authority 550 and Goring Blade 390 + 85 × 21s in combo, Atonement 550, Holy Spirit 350, Holy Circle 250, Confiteor 800 (all three 50% more under Requiescat), Requiescat 150–550, Spirits Within 370, Circle of Scorn 120 + 35 × 15s, Intervene 200, Shield Lob 120; auto-attacks 110 at 2.24s. Gear: ${V.gear}, pre-6.0 stats from the 5.58 game data.</p>`;
    }
  }

  B.registerJob({
    id: 'pld', name: 'Paladin', abbr: 'PLD', role: 'tank', classJob: 19,
    versions: ['shb51', 'shb50'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new PaladinShB(v) })),
  });
})(window.BLM);

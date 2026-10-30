// Paladin, Endwalker at level 90 before 6.3's rework, in two versions. Built on the 6.3 class (pld_ew.js), with
// the older kit put back: Goring Blade is a combo finisher after Riot Blade (250 and a 65-potency DoT for 21s),
// Royal Authority grants three Sword Oath stacks for Atonement (420, which breaks the combo) and no Divine Might,
// Fight or Flight raises physical damage only (+25%, 25s), and Requiescat (400) gives five stacks: each makes Holy
// Spirit or Holy Circle instant and stronger, and Confiteor (full damage to every target) ends it.
//  - 6.0–6.08: Confiteor → Blade of Faith → Truth → Valor is a combo, and every other GCD breaks it; Holy Spirit,
//    Holy Circle and Clemency break the Fast Blade combo too. 6.08's numbers.
//  - 6.1–6.28: spells no longer break combos; Requiescat ending (by Confiteor or its last stack) grants Blade of
//    Faith Ready, and from 6.2 a melee weaponskill ends it. 6.21's numbers (Holy Spirit 300 / 600, Confiteor 1,000).
// Blade of Valor's DoT (80 for 21s) and Goring Blade's can't both be on the target. Numbers are the game data at 6.0,
// 6.08, 6.15, 6.2 and 6.28 (xivapi's datamining) and the Lodestone notes; gear is The Balance's set for the tier.
// ref: a scripted bot parses about 5,280 / 6,740 on these.
(function (B) {
  const EW = B.PaladinEW;
  const FOF = 1.25;
  const BLADES = ['confiteor', 'bladeOfFaith', 'bladeOfTruth', 'bladeOfValor'];
  const VERSIONS = {
    ew60: { label: 'Endwalker 6.0–6.08', history: 'EW 6.0–6.08', hs: [270, 540], conf: 900, blades: [420, 500, 580], exp: 340,
      spellsBreak: true, faithReady: false, tincture: 'str6', ref: 5600,
      stats: { hp: 85094, main: 2502, wd: 120, det: 1680, crit: 2319, dh: 1012, speed: 650, ten: 527 },
      note: 'Level 90 at launch: Goring Blade in the combo, physical-only Fight or Flight, five Requiescat stacks into Holy Spirit and Confiteor, the Blades as a combo that any other GCD breaks; Asphodelos gear' },
    ew61: { label: 'Endwalker 6.1–6.28', history: 'EW 6.1–6.28', hs: [300, 600], conf: 1000, blades: [480, 560, 620], exp: 420,
      spellsBreak: false, faithReady: true, tincture: 'str7', ref: 7140,
      stats: { hp: 103086, main: 2891, wd: 126, det: 1844, crit: 2377, dh: 1012, speed: 400, ten: 751 },
      note: 'Level 90: spells no longer break combos, Requiescat ending grants Blade of Faith Ready, 6.21\'s Holy Spirit 600 and Confiteor 1,000; Abyssos gear' },
  };
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };

  class PaladinEW60 extends EW {
    constructor(version) {
      super('ew63');
      const V = VERSIONS[version];
      this.V = V;
      this.tinctureKey = V.tincture;
      const A = Object.assign({}, this.actions);
      delete A.bulwark;
      const brk = V.spellsBreak || undefined;
      set(A, 'riotBlade', { potency: 170, comboPotency: 300, desc: 'Delivers an attack with a potency of 170.\nCombo Action: Fast Blade\nCombo Potency: 300\nCombo Bonus: Restores MP' });
      set(A, 'royalAuthority', { potency: 130, comboPotency: 420, desc: 'Delivers an attack with a potency of 130.\nCombo Action: Riot Blade\nCombo Potency: 420\nCombo Bonus: Grants 3 stacks of Sword Oath\nDuration: 30s' });
      set(A, 'goringBlade', { potency: 100, comboPotency: 250, comboFrom: 'riotBlade', cd: undefined, dot: { potency: 65, duration: 21 },
        desc: 'Delivers an attack with a potency of 100.\nCombo Action: Riot Blade\nCombo Potency: 250\nCombo Bonus: Damage over time\nPotency: 65\nDuration: 21s\nCannot be applied at the same time as Blade of Valor\'s damage over time.' });
      set(A, 'atonement', { potency: 420, breaksCombo: true, desc: 'Delivers an attack with a potency of 420.\nAdditional Effect: Restores MP\nCan only be executed while under the effect of Sword Oath.' });
      set(A, 'holySpirit', { potency: V.hs[0], dm: undefined, req: V.hs[1], magic: true, breaksCombo: brk,
        desc: `Deals unaspected damage with a potency of ${V.hs[0]}.\nRequiescat Potency: ${V.hs[1]}\nRequiescat: cast immediately.` });
      set(A, 'holyCircle', { potency: 130, dm: undefined, req: 300, magic: true, breaksCombo: brk, desc: 'Deals unaspected damage with a potency of 130 to all nearby enemies.\nRequiescat Potency: 300' });
      set(A, 'clemency', { breaksCombo: brk });
      set(A, 'prominence', { desc: 'Delivers an attack with a potency of 100 to all nearby enemies.\nCombo Action: Total Eclipse\nCombo Potency: 170\nCombo Bonus: Restores MP' });
      set(A, 'confiteor', { potency: V.conf, req: undefined, ready: undefined, aoe: true, magic: true, breaksCombo: brk,
        desc: `Deals unaspected damage with a potency of ${V.conf.toLocaleString()} to target and all enemies nearby it.\nCan only be executed while under the effect of Requiescat. Effect of Requiescat ends upon execution.\n${V.faithReady ? 'Requiescat ending grants Blade of Faith Ready, and Confiteor changes to Blade of Faith.' : 'Combo: Confiteor → Blade of Faith → Blade of Truth → Blade of Valor.'}` });
      const prev = { bladeOfFaith: V.faithReady ? 'Blade of Faith Ready' : 'Confiteor', bladeOfTruth: 'Blade of Faith', bladeOfValor: 'Blade of Truth' };
      ['bladeOfFaith', 'bladeOfTruth', 'bladeOfValor'].forEach((id, k) => {
        set(A, id, { potency: V.blades[k], req: undefined, mp: 0, aoe: 0.5, magic: true, breaksCombo: brk, dot: id === 'bladeOfValor' ? { potency: 80, duration: 21 } : undefined,
          desc: `Deals unaspected damage with a potency of ${V.blades[k]} to target and all enemies nearby it, 50% less for all remaining enemies.\n${id === 'bladeOfFaith' && V.faithReady ? 'Can only be executed while under the effect of Blade of Faith Ready.' : `Combo Action: ${prev[id]}`}\nAdditional Effect: Restores MP${id === 'bladeOfValor' ? '\nAdditional Effect: Damage over time\nPotency: 80\nDuration: 21s' : ''}` });
      });
      set(A, 'expiacion', { potency: V.exp, desc: `Delivers an attack with a potency of ${V.exp} to target and all enemies nearby it, 50% less for all remaining enemies.\nAdditional Effect: Restores MP` });
      set(A, 'fightOrFlight', { desc: 'Increases physical damage dealt by 25%.\nDuration: 25s' });
      set(A, 'requiescat', { potency: 400, magic: true, desc: 'Delivers an attack with a potency of 400.\nAdditional Effect: Grants 5 stacks of Requiescat\nDuration: 30s\nEach stack makes Holy Spirit or Holy Circle instant and stronger.' });
      A.tincture = B.tincture(V.tincture);
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        goringBlade: { name: 'Goring Blade', self: false, icon: 'st_goring' },
        bladeOfValor: { name: 'Blade of Valor', self: false, icon: 'st_valor' },
        bladeOfFaithReady: { name: 'Blade of Faith Ready', self: true, icon: 'st_faith' },
      });
      this.stats = Object.assign({ mainStat: 'str', jobMod: 100, trait: 100, delay: 2.24 }, V.stats);
      this.selfStatusOrder = ['fightOrFlight', 'requiescat', 'bladeOfFaithReady', 'swordOath', 'ironWill', 'medicated', 'holySheltron',
        'rampart', 'guardian', 'hallowedGround', 'divineVeil', 'passageOfArms', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['goringBlade', 'bladeOfValor', 'circleOfScorn', 'reprisal'];
      this.defaultBars = [
        ['fastBlade', 'riotBlade', 'royalAuthority', 'goringBlade', 'atonement', 'holySpirit', 'confiteor', 'fightOrFlight', 'requiescat', 'expiacion', 'circleOfScorn', 'intervene'],
        ['shieldLob', 'tincture', 'ironWill', 'holySheltron', 'rampart', 'guardian', 'hallowedGround', 'divineVeil', 'intervention', 'reprisal', 'provoke', 'cover'],
        ['totalEclipse', 'prominence', 'holyCircle', 'clemency', 'passageOfArms', 'shirk', 'lowBlow', 'interject', 'armsLength', 'sprint', null, null],
      ];
      this.actionGroups = [
        ['Paladin', ['fastBlade', 'riotBlade', 'royalAuthority', 'goringBlade', 'atonement', 'holySpirit', 'confiteor', 'bladeOfFaith', 'bladeOfTruth',
          'bladeOfValor', 'fightOrFlight', 'requiescat', 'expiacion', 'circleOfScorn', 'intervene', 'shieldLob', 'totalEclipse', 'prominence', 'holyCircle',
          'clemency', 'ironWill', 'holySheltron', 'intervention', 'cover', 'guardian', 'hallowedGround', 'divineVeil', 'passageOfArms']],
        ['Role Actions', ['rampart', 'lowBlow', 'provoke', 'interject', 'reprisal', 'armsLength', 'shirk']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
    }

    // Confiteor plays the next Blade while the chain is open, or Blade of Faith under Blade of Faith Ready (6.1+).
    resolveId(id, e) {
      const g = e.g;
      if (id === 'confiteor') {
        if (g.blade && g.blade.until > e.now) return g.blade.next;
        if (this.V.faithReady && e.has('bladeOfFaithReady')) return 'bladeOfFaith';
      }
      return id;
    }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (id === 'atonement' && !e.has('swordOath')) return 'Unable to execute action. Sword Oath required.';
      if (id === 'confiteor' && !e.has('requiescat')) return 'Unable to execute action. Requiescat required.';
      if (id === 'bladeOfFaith' && this.V.faithReady) { if (!e.has('bladeOfFaithReady')) return 'Unable to execute action.'; }
      else if (BLADES.indexOf(id) > 0 && !(g.blade && g.blade.next === id && g.blade.until > e.now)) return 'Unable to execute action.';
      if (a.oath && g.oath < a.oath) return 'Not enough Oath Gauge.';
      return null;
    }

    castTime(id, e) {
      const a = this.actions[id];
      if (!a.cast) return 0;
      return e.has('requiescat') ? 0 : e.speedScale(a.cast, 0);
    }

    // Fight or Flight raises physical hits only: weaponskills, abilities and auto-attacks, not the spells or Requiescat.
    snapshot(a, e) {
      const mult = !a.magic && e.has('fightOrFlight') ? FOF : 1;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main };
    }

    // Requiescat ends: from 6.1 that grants Blade of Faith Ready.
    endRequiescat(e) {
      e.removeStatus('requiescat');
      if (this.V.faithReady) e.addStatus('bladeOfFaithReady', 30);
    }

    // Blade of Valor's DoT and Goring Blade's replace each other.
    putDot(e, key, other, a, snap) {
      if (e.tStatuses[other]) { delete e.tStatuses[other]; e.emit('statusLose', { key: other, self: false }); }
      e.addTStatus(key, a.dot.duration, { snap, dot: { potency: a.dot.potency, id: key } });
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g, V = this.V;
      // 6.0–6.08: any other GCD breaks the Blade combo. 6.2+: a melee weaponskill ends Blade of Faith Ready.
      if (a.kind === 'gcd' && BLADES.indexOf(id) < 0 && V.spellsBreak) g.blade = null;
      if (a.kind === 'gcd' && !a.spell && V.faithReady) e.removeStatus('bladeOfFaithReady');
      let potency = a.potency || 0, dot = null;
      switch (id) {
        case 'royalAuthority':
          if (e.lastComboHit) { potency = a.comboPotency; e.addStatus('swordOath', 30, { stacks: 3 }); }
          break;
        case 'goringBlade':
          if (e.lastComboHit) { potency = a.comboPotency; dot = ['goringBlade', 'bladeOfValor']; }
          break;
        case 'prominence':
          if (e.lastComboHit) { potency = a.comboPotency; this.gainMp(e, 500); }
          break;
        case 'holySpirit': case 'holyCircle':
          e.mp -= a.mp;
          if (e.has('requiescat')) {
            potency = a.req;
            const st = e.statuses.requiescat;
            st.stacks = (st.stacks || 1) - 1;
            if (st.stacks <= 0) this.endRequiescat(e); else e.emit('statusStack', { key: 'requiescat' });
          }
          break;
        case 'confiteor':
          e.mp -= a.mp;
          this.endRequiescat(e);
          g.blade = V.faithReady ? null : { next: 'bladeOfFaith', until: e.now + 30 };
          break;
        case 'bladeOfFaith': case 'bladeOfTruth': case 'bladeOfValor': {
          if (id === 'bladeOfFaith') e.removeStatus('bladeOfFaithReady');
          const k = BLADES.indexOf(id);
          g.blade = k < 3 ? { next: BLADES[k + 1], until: e.now + 30 } : null;
          this.gainMp(e, 400);
          if (id === 'bladeOfValor') dot = ['bladeOfValor', 'goringBlade'];
          break;
        }
        case 'fightOrFlight': e.addStatus('fightOrFlight', 25); return;
        case 'requiescat':
          e.addStatus('requiescat', 30, { stacks: 5 });
          e.removeStatus('bladeOfFaithReady');
          g.blade = null;
          break;
        default:
          return super.resolve(id, e);
      }
      if (potency) {
        const snap = this.snapshot(a, e);
        const after = dot ? () => this.putDot(e, dot[0], dot[1], a, snap) : null;
        e.queueHit(id, potency, snap, a.delay, after);
      }
    }

    proc(id, e) {
      const a = this.actions[id];
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (id === 'atonement') return e.has('swordOath');
      if (id === 'holySpirit' || id === 'confiteor') return e.has('requiescat') || (id === 'confiteor' && (e.has('bladeOfFaithReady') || !!(e.g.blade && e.g.blade.until > e.now)));
      if (BLADES.includes(id)) return true;
      return false;
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Fight or Flight fits ${Math.floor(25 / e.gcdForSpeed(e.stats.speed))} GCDs`; }

    helpHtml(seq) {
      const V = this.V;
      const opener = V.faithReady
        ? ['holySpirit', 'fastBlade', ['fightOrFlight'], 'riotBlade', 'goringBlade', 'fastBlade', ['tincture'], 'riotBlade', ['circleOfScorn'], ['intervene'], 'royalAuthority', ['expiacion'], ['requiescat'],
          'atonement', ['intervene'], 'atonement', 'atonement', 'fastBlade', 'riotBlade', 'goringBlade', 'holySpirit', 'holySpirit', 'holySpirit', 'holySpirit', 'confiteor', ['circleOfScorn'], 'bladeOfFaith', ['expiacion'], 'bladeOfTruth', 'bladeOfValor']
        : ['holySpirit', 'fastBlade', ['fightOrFlight'], 'riotBlade', ['tincture'], 'goringBlade', ['circleOfScorn'], 'fastBlade', ['expiacion'], ['intervene'], 'riotBlade', ['requiescat'], ['intervene'],
          'royalAuthority', 'atonement', 'atonement', 'atonement', 'fastBlade', 'riotBlade', 'goringBlade', 'holySpirit', 'holySpirit', 'holySpirit', ['circleOfScorn'], 'holySpirit', ['expiacion'], 'confiteor', 'bladeOfFaith', 'bladeOfTruth', 'bladeOfValor'];
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 90 Paladin before the 6.3 rework. Two combos share Fast Blade → Riot Blade: finish with <b>Goring Blade</b> (250 and a 65-potency DoT for 21s) or <b>Royal Authority</b> (420 and three <b>Sword Oath</b> stacks for <b>Atonement</b>, 420). Atonement breaks the combo, so spend the stacks between combos; alternate the two so Goring Blade's DoT never drops.</p>
<p><b>Fight or Flight</b> (+25% to physical damage for 25s, 60s) fits about ${V.faithReady ? 'ten' : 'eleven'} weaponskills: two Goring Blades, a Royal Authority and its Atonements, with <b>Expiacion</b> (${V.exp}), <b>Circle of Scorn</b> and both <b>Intervene</b> charges. It doesn't raise spells, so the magic phase comes after it: <b>Requiescat</b> (400) gives five stacks, each an instant <b>Holy Spirit</b> (${V.hs[1]}); use four, then <b>Confiteor</b> (${V.conf.toLocaleString()} to every target), which ends Requiescat, and the Blades: <b>Faith → Truth → Valor</b> (${V.blades.join(' / ')}; Valor's DoT replaces Goring Blade's).${V.spellsBreak ? ' In 6.0 the spells break the Fast Blade combo and the Blades are a combo of their own, so play the whole phase between sword combos without another GCD in it.' : ' From 6.1 spells don\'t break combos, and Requiescat ending grants Blade of Faith Ready (a melee weaponskill ends it from 6.2).'}</p>
<h3>The opener (The Balance${V.faithReady ? ', 6.1x' : ', 6.05'})</h3>
${seq(opener)}
<p>A hardcast Holy Spirit about 2s before the pull. Requiescat goes in late in Fight or Flight so its 30s still covers the magic phase after it.</p>
<p style="color:#a9a3b4">${V.label} numbers: Fast Blade 200, Riot Blade 300 and Royal Authority 420 in combo, Goring Blade 250 + 65 × 21s, Atonement 420, Holy Spirit ${V.hs.join(' / ')}, Holy Circle 130 / 300, Requiescat 400, Confiteor ${V.conf.toLocaleString()}, Blades ${V.blades.join(' / ')} (Valor + 80 × 21s), Expiacion ${V.exp}, Circle of Scorn 100 + 30 × 15s, Intervene 150; auto-attacks 90 at 2.24s.${V.faithReady ? ' Inside 6.1–6.28: 6.1–6.15 had Holy Spirit 270 / 540, Confiteor 900, Expiacion 340 and Blades 420 / 500 / 580; 6.2 had Holy Spirit 280 / 560 and Blades 460 / 540 / 620.' : ' 6.0–6.05 had Expiacion 300 and Blades 250 / 350 / 420.'} How much MP Atonement and the Blades gave back isn't documented (400 here). Gear: The Balance's ${V.faithReady ? '2.50 Abyssos' : '2.45 Asphodelos'} set (Strength ${V.stats.main.toLocaleString()}).</p>`;
    }
  }

  B.registerJob({
    id: 'pld', name: 'Paladin', abbr: 'PLD', role: 'tank', classJob: 19,
    versions: ['ew61', 'ew60'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new PaladinEW60(v) })),
  });
})(window.BLM);

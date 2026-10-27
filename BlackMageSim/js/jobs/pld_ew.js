// Paladin, Endwalker at level 90, after 6.3's rework, in two versions. Built on the Dawntrail class (pld_dt.js): the
// same Fast Blade → Riot Blade → Royal Authority combo, Divine Might Holy Spirit, Fight or Flight (+25%, 20s) and the
// Confiteor chain from Requiescat's four stacks; but Royal Authority grants three Sword Oath stacks for Atonement (no
// Supplication or Sepulchre), Goring Blade is a 60s GCD of its own, Requiescat is the 300-potency attack (Imperator and
// Blade of Honor came in 7.0), and the AoE falloff is 50%.
//  - 6.3–6.38: Atonement 380 breaks the combo; Riot Blade 280 and Royal Authority 380 in combo; Confiteor 900.
//  - 6.4–6.58: Atonement 400 no longer breaks the combo; Riot Blade 300, Royal Authority 400; 6.5 raised the
//    Confiteor chain by 20 and Circle of Scorn to 140.
// Numbers are the game data at 6.38 and 6.58 (xivapi's datamining) and the Lodestone notes; gear is The Balance's set
// for each tier. ref: a scripted bot parses about 6,860 / 8,480 on these.
(function (B) {
  const DT = B.PaladinDT;
  const VERSIONS = {
    ew63: { label: 'Endwalker 6.3–6.38', history: 'EW 6.3–6.38', riot: [120, 280], ra: [120, 380], atone: 380, atoneBreaks: true, scorn: 100, req: 300,
      conf: [400, 900], faith: [200, 700], truth: [300, 800], valor: [400, 900], tincture: 'str7', ref: 7270,
      stats: { hp: 103086, main: 2891, wd: 126, det: 1844, crit: 2377, dh: 1012, speed: 400, ten: 751 },
      note: 'Level 90, the 6.3 rework: Atonement ×3 from Royal Authority (it breaks the combo), Goring Blade a 60s GCD, Requiescat into Confiteor and the Blades; Abyssos gear' },
    ew64: { label: 'Endwalker 6.4–6.58', history: 'EW 6.4–6.58', riot: [140, 300], ra: [140, 400], atone: 400, atoneBreaks: false, scorn: 140, req: 320,
      conf: [420, 920], faith: [220, 720], truth: [320, 820], valor: [420, 920], tincture: 'str', ref: 8985,
      stats: { hp: 122878, main: 3311, wd: 132, det: 2182, crit: 2540, dh: 976, speed: 400, ten: 529 },
      note: 'Level 90: Atonement no longer breaks the combo, Riot Blade 300 and Royal Authority 400, the 6.5 Confiteor chain; Anabaseios gear' },
  };
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };
  const tip = (name, base, dm, req) => `Deals unaspected damage with a potency of ${base}.${dm ? `\nDivine Might Potency: ${dm}` : ''}\nRequiescat Potency: ${req}`;

  class PaladinEW extends DT {
    constructor(version) {
      super();
      const V = VERSIONS[version];
      this.V = V;
      this.level = 90;
      this.levelKey = 90;
      this.model = 'pld-ew';
      this.tinctureKey = V.tincture;
      this.bladeOfHonor = false;
      this.goringReady = false;
      this.maxMp = 10000;
      const A = Object.assign({}, this.actions);
      for (const k of ['supplication', 'sepulchre', 'imperator', 'bladeOfHonor']) delete A[k];
      set(A, 'fastBlade', { potency: 200, desc: 'Delivers an attack with a potency of 200.' });
      set(A, 'riotBlade', { potency: V.riot[0], comboPotency: V.riot[1], desc: `Delivers an attack with a potency of ${V.riot[0]}.\nCombo Action: Fast Blade\nCombo Potency: ${V.riot[1]}\nCombo Bonus: Restores 1,000 MP` });
      set(A, 'royalAuthority', { potency: V.ra[0], comboPotency: V.ra[1], desc: `Delivers an attack with a potency of ${V.ra[0]}.\nCombo Action: Riot Blade\nCombo Potency: ${V.ra[1]}\nCombo Bonus: Grants 3 stacks of Sword Oath and Divine Might\nDuration: 30s` });
      set(A, 'atonement', { potency: V.atone, ready: undefined, breaksCombo: V.atoneBreaks || undefined, desc: `Delivers an attack with a potency of ${V.atone}.\nAdditional Effect: Restores MP\nCan only be executed while under the effect of Sword Oath.${V.atoneBreaks ? '' : '\nDoes not break the Fast Blade combo.'}` });
      set(A, 'goringBlade', { ready: undefined, cd: 60, desc: 'Delivers an attack with a potency of 700.\nRecast: 60s' });
      set(A, 'holySpirit', { potency: 350, dm: 450, req: 650, desc: tip('Holy Spirit', 350, 450, 650) + '\nDivine Might or Requiescat: cast immediately (Divine Might is used first).' });
      set(A, 'holyCircle', { potency: 100, dm: 200, req: 300, desc: tip('Holy Circle', 100, 200, 300) });
      for (const [id, p] of [['confiteor', V.conf], ['bladeOfFaith', V.faith], ['bladeOfTruth', V.truth], ['bladeOfValor', V.valor]]) {
        set(A, id, { potency: p[0], req: p[1], aoe: 0.5, desc: `Deals unaspected damage with a potency of ${p[0]} to target and all enemies nearby it, 50% less for all remaining enemies.\nRequiescat Potency: ${p[1]}${id === 'confiteor' ? '\nCan only be executed while under the effect of Confiteor Ready.\nConfiteor changes to Blade of Faith, Blade of Truth and Blade of Valor.' : ''}` });
      }
      set(A, 'circleOfScorn', { potency: V.scorn, desc: `Delivers an attack with a potency of ${V.scorn} to all nearby enemies.\nAdditional Effect: Damage over time\nPotency: 30\nDuration: 15s` });
      set(A, 'expiacion', { aoe: 0.5 });
      set(A, 'totalEclipse', { potency: 100, desc: 'Delivers an attack with a potency of 100 to all nearby enemies.' });
      set(A, 'prominence', { comboPotency: 170, desc: 'Delivers an attack with a potency of 100 to all nearby enemies.\nCombo Action: Total Eclipse\nCombo Potency: 170\nCombo Bonus: Restores MP\nCombo Bonus: Grants Divine Might\nDuration: 30s' });
      set(A, 'fightOrFlight', { desc: 'Increases damage dealt by 25%.\nDuration: 20s' });
      A.requiescat = { name: 'Requiescat', kind: 'ogcd', recast: 60, potency: V.req, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'gnbZone',
        desc: `Delivers an attack with a potency of ${V.req}.\nAdditional Effect: Grants 4 stacks of Requiescat and Confiteor Ready\nDuration: 30s` };
      A.tincture = B.tincture(V.tincture);
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, { swordOath: { name: 'Sword Oath', self: true, icon: 'st_oath' } });
      this.stats = Object.assign({ mainStat: 'str', jobMod: 100, trait: 100, delay: 2.24 }, V.stats);
      this.selfStatusOrder = ['fightOrFlight', 'requiescat', 'confiteorReady', 'divineMight', 'swordOath', 'ironWill', 'medicated', 'holySheltron',
        'rampart', 'guardian', 'bulwark', 'hallowedGround', 'divineVeil', 'passageOfArms', 'armsLength', 'sprint'];
      this.defaultBars = [
        ['fastBlade', 'riotBlade', 'royalAuthority', 'atonement', 'holySpirit', 'goringBlade', 'confiteor', 'fightOrFlight', 'requiescat', 'expiacion', 'circleOfScorn', 'intervene'],
        ['shieldLob', 'tincture', 'ironWill', 'holySheltron', 'rampart', 'guardian', 'bulwark', 'hallowedGround', 'divineVeil', 'intervention', 'reprisal', 'provoke'],
        ['totalEclipse', 'prominence', 'holyCircle', 'clemency', 'cover', 'passageOfArms', 'shirk', 'lowBlow', 'interject', 'armsLength', 'sprint', null],
      ];
      // Sentinel's 6.x name for Guardian's slot.
      set(A, 'guardian', { name: 'Sentinel', desc: 'Reduces damage taken by 30%.\nDuration: 15s' });
      this.actionGroups = [
        ['Paladin', ['fastBlade', 'riotBlade', 'royalAuthority', 'atonement', 'goringBlade', 'holySpirit', 'confiteor', 'bladeOfFaith', 'bladeOfTruth',
          'bladeOfValor', 'fightOrFlight', 'requiescat', 'expiacion', 'circleOfScorn', 'intervene', 'shieldLob', 'totalEclipse', 'prominence', 'holyCircle',
          'clemency', 'ironWill', 'holySheltron', 'intervention', 'cover', 'guardian', 'bulwark', 'hallowedGround', 'divineVeil', 'passageOfArms']],
        ['Role Actions', ['rampart', 'lowBlow', 'provoke', 'interject', 'reprisal', 'armsLength', 'shirk']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
    }

    resolveId(id, e) {
      const g = e.g;
      if (id === 'confiteor' && g.blade && g.blade.until > e.now) return g.blade.next;
      return id;
    }

    check(id, e) {
      if (id === 'atonement' && !e.has('swordOath')) return 'Unable to execute action. Sword Oath required.';
      return super.check(id, e);
    }

    resolve(id, e) {
      const a = this.actions[id];
      switch (id) {
        case 'royalAuthority': {
          if (e.lastComboHit) { e.addStatus('swordOath', 30, { stacks: 3 }); e.addStatus('divineMight', 30); }
          e.queueHit(id, e.lastComboHit ? a.comboPotency : a.potency, this.snapshot(a, e), a.delay);
          return;
        }
        case 'atonement': {
          const s = e.statuses.swordOath;
          s.stacks = (s.stacks || 1) - 1;
          if (s.stacks <= 0) e.removeStatus('swordOath'); else e.emit('statusStack', { key: 'swordOath' });
          this.gainMp(e, 400);
          e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
          return;
        }
        case 'requiescat':
          e.addStatus('requiescat', 30, { stacks: 4 });
          e.addStatus('confiteorReady', 30);
          e.g.blade = null;
          e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
          return;
      }
      super.resolve(id, e);
    }

    proc(id, e) {
      if (id === 'atonement') return e.has('swordOath');
      if (id === 'goringBlade') return e.has('fightOrFlight');
      return super.proc(id, e);
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 90 Paladin after the 6.3 rework. The combo is <b>Fast Blade → Riot Blade → Royal Authority</b>; Royal Authority's combo grants three <b>Sword Oath</b> stacks for <b>Atonement</b> (${V.atone}) and <b>Divine Might</b> for an instant 450-potency <b>Holy Spirit</b>.${V.atoneBreaks ? ' In 6.3 Atonement breaks the combo, so spend the stacks between combos.' : ' From 6.4 Atonement no longer breaks the combo, so you can hold the stacks for Fight or Flight.'}</p>
<p>Every 60s, <b>Fight or Flight</b> (+25% for 20s) and <b>Requiescat</b> (${V.req}, four stacks and Confiteor Ready) line up with <b>Goring Blade</b> (700, its own 60s GCD), <b>Confiteor → Blade of Faith → Truth → Valor</b> (${V.conf[1]} / ${V.faith[1]} / ${V.truth[1]} / ${V.valor[1]} with Requiescat), <b>Expiacion</b>, <b>Circle of Scorn</b> and both <b>Intervene</b> charges.</p>
<h3>The opener (The Balance)</h3>
${seq(['holySpirit', 'fastBlade', ['tincture'], 'riotBlade', 'royalAuthority', ['fightOrFlight'], ['requiescat'], 'goringBlade', ['circleOfScorn'], ['expiacion'], 'confiteor', ['intervene'], 'bladeOfFaith', ['intervene'], 'bladeOfTruth', 'bladeOfValor', 'holySpirit', 'atonement', 'atonement', 'atonement'])}
<p>A hardcast Holy Spirit about 2s before the pull. ${V.atoneBreaks ? '' : 'Between bursts: Royal Authority, Fast Blade, Riot Blade, the three Atonements and Holy Spirit, held to land inside Fight or Flight.'}</p>
<p style="color:#a9a3b4">${V.label} numbers: Fast Blade 200, Riot Blade ${V.riot[1]} and Royal Authority ${V.ra[1]} in combo, Atonement ${V.atone}, Goring Blade 700, Holy Spirit 350 / 450 / 650, Requiescat ${V.req}, Confiteor ${V.conf.join(' / ')}, Blades ${V.faith.join(' / ')}, ${V.truth.join(' / ')}, ${V.valor.join(' / ')}, Expiacion 450, Circle of Scorn ${V.scorn} + 30 × 15s, Intervene 150; auto-attacks 90 at 2.24s. Gear: The Balance's set for the tier (Strength ${V.stats.main.toLocaleString()}). How much MP Atonement gave back isn't documented (400 here).</p>`;
    }
  }

  B.registerJob({
    id: 'pld', name: 'Paladin', abbr: 'PLD', role: 'tank', classJob: 19,
    versions: ['ew64', 'ew63'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new PaladinEW(v) })),
  });
})(window.BLM);

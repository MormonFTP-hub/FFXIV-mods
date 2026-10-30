// Astrologian, Heavensward (patches 3.4–3.57) at level 60. Built on the Stormblood class (ast_sb.js): the same Draw,
// Spread and Royal Road, with Heavensward's cards (the Balance +20% from 3.4, the Spear −20% ability recast rather than
// crit, cards held 30s and Redraw 30s from 3.4) and no Minor Arcana, Sleeve Draw, Undraw or Earthly Star (all 4.0).
// Damage needs Cleric Stance, a toggle that swaps Mind into Intelligence (+10% attack magic, −20% healing): healer gear
// had no Intelligence. Malefic II (200, 2.5s) and two separate DoTs, Combust (instant) and Combust II (2.5s cast);
// Lightspeed costs 25% damage; Diurnal Sect is 5% faster casts and GCD; Luminiferous Aether is the MP button.
// Numbers are the 3.4–3.5x tooltips and job page the FFXIV wiki and Gamer Escape had before 4.0, and the Lodestone
// notes for 3.05–3.57. Heavensward's damage formula (B.LEVELS.hw60).
(function (B) {
  const SB = B.AstrologianSB;
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const spell = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.8, school: 'astral', sound: 'ruin' }, o);
  const heal = (o) => Object.assign({ kind: 'gcd', potency: 0, school: 'astral', sound: 'paradox' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const FALLOFF = [1, 0.9, 0.8, 0.7, 0.6, 0.5];

  class AstrologianHW extends SB {
    constructor() {
      super('sb405');
      this.V = { label: 'Heavensward 3.4–3.57', spear: 20, ls: { mp: 0.75, potency: 0.75, recast: 150 } };
      this.level = 60;
      this.levelKey = 'hw60';
      this.model = 'ast-hw';
      // MP costs are Heavensward's: a share of level 60's 8,840 (Gamer Escape's MP Base). The pool is fitted to archived
      // 2016 Lodestone profiles, floor(1.20 × (8,840 + 5.389 × (Piety − 218))), at this set's 629 Piety.
      this.maxMp = 13265;
      const S = this.actions;
      const A = {
        malefic: spell({ name: 'Malefic', potency: 150, cast: 2.5, mp: 354, orb: true, desc: 'Deals unaspected damage with a potency of 150.' }),
        malefic2: spell({ name: 'Malefic II', potency: 200, cast: 2.5, mp: 530, orb: true, desc: 'Deals unaspected damage with a potency of 200.' }),
        combust: spell({ name: 'Combust', potency: 0, mp: 354, dot: { potency: 40, duration: 18 }, sound: 'dot', desc: 'Deals unaspected damage over time.\nPotency: 40\nDuration: 18s' }),
        combust2: spell({ name: 'Combust II', potency: 0, cast: 2.5, mp: 619, dot: { potency: 45, duration: 30 }, sound: 'dot', desc: 'Deals unaspected damage over time.\nPotency: 45\nDuration: 30s' }),
        gravity: spell({ name: 'Gravity', potency: 200, cast: 3, mp: 1414, aoe: FALLOFF, delay: 1.0, desc: 'Deals unaspected damage to target and all enemies nearby it with a potency of 200 for the first enemy, 10% less for the second, 20% less for the third, 30% less for the fourth, 40% less for the fifth, and 50% less for all remaining enemies.' }),
        aero: spell({ name: 'Aero', potency: 50, mp: 354, dot: { potency: 25, duration: 18 }, school: 'wind', sound: 'wind', desc: 'Deals wind damage with a potency of 50.\nAdditional Effect: Wind damage over time\nPotency: 25\nDuration: 18s\n(Conjurer cross-class skill)' }),
        benefic: heal({ name: 'Benefic', cast: 2.5, mp: 354, desc: 'Restores target\'s HP.\nCure Potency: 400' }),
        benefic2: heal({ name: 'Benefic II', cast: 2.5, mp: 707, desc: 'Restores target\'s HP.\nCure Potency: 650' }),
        aspectedBenefic: heal({ name: 'Aspected Benefic', mp: 796, desc: 'Restores target\'s HP.\nCure Potency: 200\nDiurnal Sect Effect: Regen. Nocturnal Sect Effect: a barrier.' }),
        helios: heal({ name: 'Helios', cast: 2.5, mp: 1149, desc: 'Restores own HP and the HP of all nearby party members.\nCure Potency: 300' }),
        aspectedHelios: heal({ name: 'Aspected Helios', cast: 3, mp: 1326, desc: 'Restores own HP and the HP of all nearby party members.\nCure Potency: 200\nDiurnal Sect Effect: Regen. Nocturnal Sect Effect: a barrier.' }),
        draw: Object.assign({}, S.draw, { desc: 'Draws a card (arcanum) from your divining deck.\nDuration: 30s\nRecast timer begins once the card is used or its effect ends.\nDraw changes to the card you drew; play it on yourself.' }),
        redraw: Object.assign({}, S.redraw, { desc: 'Draws a different card in place of the one you hold.' }),
        royalRoad: Object.assign({}, S.royalRoad, { desc: 'Returns the drawn card to the deck and enhances the next card played:\nthe Balance or the Bole: Enhanced Royal Road, 150% effect\nthe Arrow or the Spear: Extended Royal Road, double duration\nthe Ewer or the Spire: Expanded Royal Road, an AoE version at half effect (20 yalms)' }),
        spread: S.spread,
        timeDilation: ab({ name: 'Time Dilation', recast: 90, desc: 'Extends the duration of beneficial effects you cast on the target by 15s.\nCannot be used on yourself.' }),
        celestialOpposition: ab({ name: 'Celestial Opposition', recast: 120, desc: 'Stuns nearby enemies.\nDuration: 4s\nAdditional Effect: Extends the duration of beneficial effects on self and nearby party members by 10s.' }),
        luminiferousAether: ab({ name: 'Luminiferous Aether', recast: 120, desc: 'Reduces enmity and grants Refresh.\nRefresh Potency: 80\nDuration: 24s' }),
        disable: ab({ name: 'Disable', recast: 60, target: true, range: 25, desc: 'Reduces target\'s damage dealt by 10%.\nDuration: 6s' }),
        essentialDignity: S.essentialDignity,
        synastry: S.synastry,
        collectiveUnconscious: S.collectiveUnconscious,
        lightspeed: ab({ name: 'Lightspeed', recast: 150, desc: 'Reduces spell MP cost by 25% and cast time by 2.5 seconds, while lowering attack magic potency by 25%.\nDuration: 10s' }),
        diurnalSect: ab({ name: 'Diurnal Sect', recast: 5, cdGroup: 'sect', desc: 'Reduces cast time, recast time and auto-attack delay by 5%, and adds Regen to Aspected spells.\nEffect cannot be removed while in combat.' }),
        nocturnalSect: ab({ name: 'Nocturnal Sect', recast: 5, cdGroup: 'sect', desc: 'Increases healing magic potency by 10% and adds a barrier to Aspected spells.\nEffect cannot be removed while in combat.' }),
        // Conjurer and Thaumaturge cross-class skills.
        clericStance: ab({ name: 'Cleric Stance', recast: 5, role: true, desc: 'Swaps your Mind and Intelligence, increases attack magic potency by 10% and reduces healing magic potency by 20%.\nEffect ends upon reuse.' }),
        swiftcast: S.swiftcast,
        surecast: S.surecast,
        protect: ab({ name: 'Protect', recast: 2.5, role: true, desc: 'Increases the physical and magic defense of nearby party members.\nDuration: 30m' }),
        stoneskin: ab({ name: 'Stoneskin', recast: 2.5, role: true, desc: 'Creates a barrier that nullifies damage up to 10% of maximum HP.\nDuration: 30m' }),
        ...B.GENERAL_ACTIONS,
        tincture: Object.assign({}, B.tincture('mnd3sb'), { name: 'Supramax-Potion of Mind', dur: 15, desc: 'This diluted brew temporarily increases mind.\nMind +20% (Max 154)\nDuration: 15s' }),
      };
      const effect = {
        balance: 'Increases damage dealt by 20%.\nDuration: 30s',
        bole: 'Reduces damage taken by 20%.\nDuration: 30s',
        arrow: 'Reduces weaponskill and spell cast time and recast time, and auto-attack delay by 10%.\nDuration: 30s',
        spear: 'Reduces ability recast time by 20%.\nDuration: 20s',
        ewer: 'Grants Refresh (potency 50).\nDuration: 15s',
        spire: 'Grants TP regeneration.\nDuration: 15s',
      };
      for (const c of ['balance', 'bole', 'arrow', 'spear', 'ewer', 'spire']) {
        A[c] = Object.assign({}, S[c], { desc: effect[c] + '\nPlayed on yourself here.' });
        A['spread' + cap(c)] = Object.assign({}, S['spread' + cap(c)], { desc: effect[c] + '\nPlayed from the Spread.' });
      }
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        combust: { name: 'Combust', self: false, icon: 'st_combust' },
        aero: { name: 'Aero', self: false, icon: 'st_aero' },
        luminiferousAether: { name: 'Luminiferous Aether', self: true, icon: 'st_lucid' },
        swiftcast: { name: 'Swiftcast', self: true, icon: 'st_swiftcast' },
      });
      // A rough 3.5 set (item level ~270 healer gear, the Alexandrian Metal Meter: 115 magic damage), Heavensward-era
      // stats. main is Mind, which Cleric Stance makes your Intelligence; without it you'd hit with about 228.
      // Magick and Mend II: +30% to the healer's damage. No Direct Hit before 4.0.
      this.stats = { hp: 24000, mainStat: 'mnd', main: 1570, int: 228, jobMod: 115, trait: 130, wd: 115, det: 670, crit: 870,
        dh: 354, speed: 640, piety: 629, delay: 3.2 };
      this.selfStatusOrder = ['clericStance', 'theBalance', 'theSpear', 'theArrow', 'theEwer', 'theBole', 'theSpire', 'enhancedRoyalRoad',
        'extendedRoyalRoad', 'expandedRoyalRoad', 'lightspeed', 'swiftcast', 'luminiferousAether', 'medicated', 'diurnalSect', 'nocturnalSect',
        'surecast', 'sprint'];
      this.targetStatusOrder = ['combust2', 'combust', 'aero'];
      this.defaultBars = [
        ['malefic2', 'combust', 'combust2', 'draw', 'royalRoad', 'spread', 'redraw', 'clericStance', 'lightspeed', 'luminiferousAether', 'celestialOpposition', 'swiftcast'],
        ['gravity', 'malefic', 'aero', 'tincture', 'timeDilation', 'diurnalSect', 'nocturnalSect', 'benefic', 'benefic2', 'aspectedBenefic', 'helios', 'aspectedHelios'],
        ['essentialDignity', 'synastry', 'collectiveUnconscious', 'disable', 'surecast', 'protect', 'stoneskin', 'sprint', null, null, null, null],
      ];
      this.actionGroups = [
        ['Astrologian', ['malefic', 'malefic2', 'combust', 'combust2', 'gravity', 'draw', 'redraw', 'royalRoad', 'spread', 'timeDilation',
          'celestialOpposition', 'luminiferousAether', 'disable', 'lightspeed', 'benefic', 'benefic2', 'aspectedBenefic', 'helios', 'aspectedHelios',
          'essentialDignity', 'synastry', 'collectiveUnconscious', 'diurnalSect', 'nocturnalSect']],
        ['Cross-class', ['clericStance', 'swiftcast', 'surecast', 'aero', 'protect', 'stoneskin']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 1700;     // a scripted 3.5 rotation parses about 1,600 over 5 minutes, running short of MP
      this.referenceGcd = 2.27;
    }

    // No Empty Road, Minor Arcana or Earthly Star in Heavensward.
    resolveId(id, e) {
      const g = e.g;
      if (id === 'draw' && g.card) return g.card;
      if (id === 'spread' && g.spread) return 'spread' + cap(g.spread);
      return id;
    }

    check(id, e) {
      if (id === 'timeDilation') return 'Unable to execute action. Invalid target (party members only).';
      return super.check(id, e);
    }

    // The Arrow (10%, 15% Enhanced) and Diurnal Sect (5%) speed casts and the GCD.
    haste(e) {
      return (e.has('theArrow') ? 10 * (e.statuses.theArrow.mag || 1) : 0) + (e.has('diurnalSect') ? 5 : 0);
    }

    // 2% of the pool a tick, plus the Ewer's Refresh (50) and Luminiferous Aether's (80): 8.84 MP a potency point.
    mpRegen(e) {
      const ewer = e.has('theEwer') ? Math.round((this.ewerMp || 442) * (e.statuses.theEwer.mag || 1)) : 0;
      const la = e.has('luminiferousAether') ? 707 : 0;
      return Math.round(this.maxMp * 0.02) + ewer + la;
    }

    snapshot(a, e) {
      let mult = 1;
      if (e.has('theBalance')) mult *= 1 + (this.balanceMag || 0.20) * (e.statuses.theBalance.mag || 1);
      if (e.has('clericStance')) mult *= 1.10;
      if (e.has('lightspeed')) mult *= 0.75;
      const mind = this.stats.main + (e.has('medicated') ? (this.potionCap || 154) : 0);
      return { mult, main: e.has('clericStance') ? mind : this.stats.int, critAdd: 0 };
    }

    ability(id, e) {
      const a = this.actions[id];
      // The Spear: abilities used under it recast 20% faster.
      if (e.has('theSpear') && !a.card) {
        const c = e.cdOf(id);
        if (c && c.nextAt !== null && c.nextAt - e.now > 1) c.nextAt = e.now + (c.nextAt - e.now) * 0.8;
      }
      switch (id) {
        case 'clericStance':
          if (e.has('clericStance')) e.removeStatus('clericStance');
          else e.addStatus('clericStance', 1e9, { permanent: true });
          return;
        case 'luminiferousAether': e.addStatus('luminiferousAether', this.laDur || 24); return;
        case 'disable': case 'protect': case 'stoneskin': return;
      }
      super.ability(id, e);
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)}, ${e.gcdForSpeed(e.stats.speed, 5).toFixed(2)} in Diurnal Sect · ${e.maxMp.toLocaleString()} MP · Heavensward's formula (no Direct Hit)`; }

    // Heavensward had no job gauge; this keeps the Stormblood panel's drawn, spread and Royal Road cards.
    gaugeBuild(root) {
      super.gaugeBuild(root);
      const groups = root.querySelectorAll('svg > g');
      if (groups[3]) groups[3].remove();
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Heavensward 3.4–3.57)</h3>
<p>Level 60 Astrologian on a dummy. Healer gear had no Intelligence, so damage needs <b>Cleric Stance</b>: a toggle that swaps your Mind into Intelligence (+10% attack magic, −20% healing). Keep <b>Combust II</b> (45 a tick for 30s, a 2.5s cast) and <b>Combust</b> (40 for 18s, instant) both up, and fill with <b>Malefic II</b> (200, 2.5s). <b>Diurnal Sect</b> makes casts and the GCD 5% faster. MP is tight: <b>Luminiferous Aether</b> (120s) restores about 700 a tick for 24s, the Ewer about 440, and Malefic (150) is cheaper than Malefic II.</p>
<p><b>Draw</b> (30s from when the card is used) turns into the card; press it to play it on yourself. The Balance is +20% damage for 30s, the Spear −20% to ability recasts for 20s, the Arrow 10% faster casts and GCD, the Ewer MP. <b>Royal Road</b> spends a card to enhance the next one (Balance and Bole: 150%, Arrow and Spear: double length, Ewer and Spire: AoE at half); <b>Spread</b> keeps one for later; <b>Redraw</b> (30s) swaps the card for another. <b>Celestial Opposition</b> adds 10s to your buffs, Luminiferous Aether included. <b>Lightspeed</b> takes 2.5s off casts and 25% off MP, but 25% off your damage too: it's for moving.</p>
<h3>The 3.5 opener</h3>
${seq([['diurnalSect'], ['clericStance'], ['spreadBalance'], 'combust', 'combust2', ['tincture'], 'malefic2', 'malefic2', ['celestialOpposition'], 'malefic2', ['draw'], 'malefic2', 'malefic2', 'malefic2', 'combust', 'malefic2'])}
<p>From the FFXIV wiki's 2017 Astrologian page and Mimi's guide (3.15): Diurnal Sect and Cleric Stance before the pull, a Balance drawn and Spread beforehand (and another card turned into Royal Road), played as you start; Celestial Opposition stretches it.</p>
<p style="color:#a9a3b4">The 3.4–3.5 numbers: Malefic 150, Malefic II 200, Combust 40 × 18s, Combust II 45 × 30s, Gravity 200, Aero 50 + 25 × 18s, the Balance +20% (30% Enhanced), Cleric Stance +10%, Magick and Mend II +30%. Heavensward's damage formula is the community fit (Dervy, 2015–16); gear is approximate (item level ~270, Mind about 1,570). The MP pool is fitted to archived 2016 character profiles. Not documented: whether the Mind potion had to be drunk before Cleric Stance, and the healing spells' exact MP. Cards are drawn at random, 1 in 6 each; Time Dilation couldn't be used on yourself.</p>`;
    }
  }

  B.AstrologianHW = AstrologianHW;
  B.registerJob({
    id: 'ast', name: 'Astrologian', abbr: 'AST', role: 'healer', classJob: 33,
    versions: [{ id: 'hw34', label: 'Heavensward 3.4–3.57', history: 'HW 3.4–3.57', note: 'Level 60. Cleric Stance swaps Mind into Intelligence; Malefic II, Combust and Combust II; the Balance 20%, the Spear −20% ability recast, Spread and Royal Road; Luminiferous Aether, with Heavensward\'s damage formula', create: () => new AstrologianHW() }],
  });
})(window.BLM);

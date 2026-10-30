// Ninja, Shadowbringers 5.1–5.58 at level 80, after 5.1's mudra rework. Spinning Edge → Gust Slash → Aeolian Edge
// (rear) or Armor Crush (flank, +30s Huton); Huton (15% faster weaponskills and auto-attacks, up to 70s) has to stay up.
// Ten, Chi and Jin are 0.5s GCDs sharing two charges (20s each): the first spends a charge, the rest of the sequence is
// free, and Ninjutsu is a flat 1.5s GCD that Huton doesn't shorten. Suiton (or Hide) allows Trick Attack (+5% damage
// taken for 15s); Kassatsu makes one Ninjutsu free and 30% stronger (Hyosho Ranryu); Ten Chi Jin turns the three mudras
// into Fuma → Raiton → Suiton for 6s. Ninki (from weaponskills, Mug and Meisui) goes to Bhavacakra and Bunshin (five
// shadow hits). Numbers are the 5.58 game data (5.4 raised Spinning Edge and Gust Slash) and the Lodestone notes; gear
// is The Balance's 5.58 2.12 set, pre-6.0 stats from the 5.58 Item.csv.
(function (B) {
  const EPS = 1e-6;
  const MUDRA_DUR = 6, HUTON_MAX = 70, NINKI_MAX = 100, TRICK = 1.05, KASSATSU = 1.3;
  const MUDRAS = ['ten', 'chi', 'jin'];
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.5, fx: 'slash' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  // Mudras: 0.5s GCDs; the first of a sequence spends one of two 20s charges, the follow-ups (ten2…) are free.
  const mudra = (o) => ws(Object.assign({ target: false, fixedRecast: 0.5, lock: 0.5, cd: 20, charges: 2, cdGroup: 'mudra', mudra: true, fx: null }, o));
  const mudra2 = (o) => ws(Object.assign({ target: false, fixedRecast: 0.5, lock: 0.5, mudra: true, fx: null }, o));
  const jutsu = (o) => ws(Object.assign({ fixedRecast: 1.5, jutsu: true, school: 'ninjutsu', range: 25, delay: 0.6 }, o));
  const tcj = (o) => jutsu(Object.assign({ fixedRecast: 1.0, tcj: true }, o));
  const mudraTip = (name, sign) => `Make the ritual mudra hand gesture for "${sign}."\nDuration: 6s\nMaximum Charges: 2\nTriggers the cooldown of weaponskills, mudra, and Ninjutsu upon execution.\nOnly the first mudra of a sequence spends a charge.`;

  const ACTIONS = {
    spinningEdge: ws({ name: 'Spinning Edge', potency: 230, comboStart: true, comboNext: true, ninki: 5, desc: 'Delivers an attack with a potency of 230.\nAdditional Effect: Increases Ninki Gauge by 5' }),
    gustSlash: ws({ name: 'Gust Slash', potency: 100, comboPotency: 340, comboFrom: 'spinningEdge', comboNext: true, ninki: 5, fx: 'slash2', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Spinning Edge\nCombo Potency: 340\nCombo Bonus: Increases Ninki Gauge by 5' }),
    aeolianEdge: ws({ name: 'Aeolian Edge', potency: 100, comboPotency: 420, comboFrom: 'gustSlash', positional: 'rear', posBonus: 60, ninki: 10, fx: 'slash3', desc: 'Delivers an attack with a potency of 100.\n160 when executed from a target\'s rear.\nCombo Action: Gust Slash\nCombo Potency: 420\nRear Combo Potency: 480\nCombo Bonus: Increases Ninki Gauge by 10' }),
    armorCrush: ws({ name: 'Armor Crush', potency: 100, comboPotency: 400, comboFrom: 'gustSlash', positional: 'flank', posBonus: 60, ninki: 10, huton: 30, fx: 'slash3', desc: 'Delivers an attack with a potency of 100.\n160 when executed from a target\'s flank.\nCombo Action: Gust Slash\nCombo Potency: 400\nFlank Combo Potency: 460\nCombo Bonus: Extends Huton duration by 30s to a maximum of 70s\nCombo Bonus: Increases Ninki Gauge by 10' }),
    shadowFang: ws({ name: 'Shadow Fang', potency: 200, cd: 70, ninki: 10, dot: { potency: 90, duration: 30 }, fx: 'slash2', desc: 'Delivers an attack with a potency of 200.\nAdditional Effect: Damage over time\nPotency: 90\nDuration: 30s\nAdditional Effect: Increases Ninki Gauge by 10\nRecast: 70s' }),
    throwingDagger: ws({ name: 'Throwing Dagger', potency: 120, range: 20, breaksCombo: true, ninki: 5, shadow: 100, delay: 0.7, desc: 'Delivers a ranged attack with a potency of 120.\nAdditional Effect: Increases Ninki Gauge by 5' }),
    deathBlossom: ws({ name: 'Death Blossom', potency: 120, comboStart: true, comboNext: true, ninki: 5, shadow: 100, target: false, pbaoe: 5, aoe: true, fx: 'slash3', desc: 'Delivers an attack with a potency of 120 to all nearby enemies.\nAdditional Effect: Increases Ninki Gauge by 5' }),
    hakkeMujinsatsu: ws({ name: 'Hakke Mujinsatsu', potency: 100, comboPotency: 140, comboFrom: 'deathBlossom', ninki: 5, huton: 10, shadow: 100, target: false, pbaoe: 5, aoe: true, fx: 'slash3', desc: 'Delivers an attack with a potency of 100 to all nearby enemies.\nCombo Action: Death Blossom\nCombo Potency: 140\nCombo Bonus: Extends Huton duration by 10s to a maximum of 70s\nAdditional Effect: Increases Ninki Gauge by 5' }),
    // Mudras and Ninjutsu.
    ten: mudra({ name: 'Ten', desc: mudraTip('Ten', 'heaven') }),
    chi: mudra({ name: 'Chi', desc: mudraTip('Chi', 'earth') }),
    jin: mudra({ name: 'Jin', desc: mudraTip('Jin', 'man') }),
    ten2: mudra2({ name: 'Ten', desc: 'Make the ritual mudra hand gesture for "heaven."\nThe second or third mudra of a sequence: no charge.' }),
    chi2: mudra2({ name: 'Chi', desc: 'Make the ritual mudra hand gesture for "earth."\nThe second or third mudra of a sequence: no charge.' }),
    jin2: mudra2({ name: 'Jin', desc: 'Make the ritual mudra hand gesture for "man."\nThe second or third mudra of a sequence: no charge.' }),
    ninjutsu: jutsu({ name: 'Ninjutsu', target: false, desc: 'Executes a specific ninjutsu action coinciding with the combination of mudra made immediately beforehand.\nIf any other action is used before the mudra are combined and the ninjutsu executed, Ninjutsu will fail.\nTriggers a 1.5s cooldown of weaponskills, mudra and Ninjutsu, not shortened by Huton.' }),
    fumaShuriken: jutsu({ name: 'Fuma Shuriken', potency: 500, target: true, fx: 'slash', desc: 'Delivers a ranged ninjutsu attack with a potency of 500.\nMudra Combination: Any one of the Ten, Chi, or Jin mudra' }),
    katon: jutsu({ name: 'Katon', potency: 500, target: true, aoe: true, fx: 'slashFire', desc: 'Deals fire damage with a potency of 500 to target and all enemies nearby it.\nMudra Combination: Chi→Ten or Jin→Ten' }),
    raiton: jutsu({ name: 'Raiton', potency: 800, target: true, fx: 'gnbBurst', desc: 'Deals lightning damage with a potency of 800.\nMudra Combination: Ten→Chi or Jin→Chi' }),
    hyoton: jutsu({ name: 'Hyoton', potency: 400, target: true, fx: 'slash2', desc: 'Deals ice damage with a potency of 400.\nAdditional Effect: Bind\nDuration: 15s\nMudra Combination: Ten→Jin or Chi→Jin' }),
    huton: jutsu({ name: 'Huton', target: false, desc: 'Reduces weaponskill recast time and auto-attack delay by 15%.\nDuration: 70s\nMudra Combination: Jin→Chi→Ten or Chi→Jin→Ten' }),
    doton: jutsu({ name: 'Doton', target: false, pbaoe: 5, dot: { potency: 100, duration: 24 }, desc: 'Creates a patch of corrupted earth, dealing damage with a potency of 100 to any enemies who enter.\nDuration: 24s\nAdditional Effect: Heavy +40%\nMudra Combination: Ten→Jin→Chi or Jin→Ten→Chi' }),
    suiton: jutsu({ name: 'Suiton', potency: 600, target: true, fx: 'gnbSlash', desc: 'Deals water damage with a potency of 600.\nAdditional Effect: Grants Suiton\nDuration: 20s\nSuiton Effect: Allows execution of actions which require the effect of Hidden, without being under that effect\nMudra Combination: Ten→Chi→Jin or Chi→Ten→Jin' }),
    gokaMekkyaku: jutsu({ name: 'Goka Mekkyaku', potency: 750, target: true, aoe: true, fx: 'slashFire', desc: 'Deals fire damage with a potency of 750 to target and all enemies nearby it.\nMudra Combination: Chi→Ten or Jin→Ten\nCan only be executed while under the effect of Kassatsu.' }),
    hyoshoRanryu: jutsu({ name: 'Hyosho Ranryu', potency: 1200, target: true, fx: 'gnbZone', desc: 'Deals ice damage with a potency of 1,200.\nMudra Combination: Chi→Jin or Ten→Jin\nCan only be executed while under the effect of Kassatsu.' }),
    rabbitMedium: jutsu({ name: 'Rabbit Medium', target: false, desc: 'Thumpity thump thump, thumpity thump thump...' }),
    // Ten Chi Jin's ninjutsu (1.0s GCDs, the last 1.5s).
    tcjFumaTen: tcj({ name: 'Fuma Shuriken', sign: 'ten', potency: 500, target: true, fx: 'slash', desc: 'Delivers a ranged ninjutsu attack with a potency of 500.\nTen Chi Jin: the first mudra.' }),
    tcjFumaChi: tcj({ name: 'Fuma Shuriken', sign: 'chi', potency: 500, target: true, fx: 'slash', desc: 'Delivers a ranged ninjutsu attack with a potency of 500.\nTen Chi Jin: the first mudra.' }),
    tcjFumaJin: tcj({ name: 'Fuma Shuriken', sign: 'jin', potency: 500, target: true, fx: 'slash', desc: 'Delivers a ranged ninjutsu attack with a potency of 500.\nTen Chi Jin: the first mudra.' }),
    tcjKaton: tcj({ name: 'Katon', sign: 'ten', potency: 500, target: true, aoe: true, fx: 'slashFire', desc: 'Deals fire damage with a potency of 500 to target and all enemies nearby it.\nTen Chi Jin: Ten as the second mudra.' }),
    tcjRaiton: tcj({ name: 'Raiton', sign: 'chi', potency: 800, target: true, fx: 'gnbBurst', desc: 'Deals lightning damage with a potency of 800.\nTen Chi Jin: Chi as the second mudra.' }),
    tcjHyoton: tcj({ name: 'Hyoton', sign: 'jin', potency: 400, target: true, fx: 'slash2', desc: 'Deals ice damage with a potency of 400.\nTen Chi Jin: Jin as the second mudra.' }),
    tcjHuton: tcj({ name: 'Huton', sign: 'ten', fixedRecast: 1.5, target: false, desc: 'Reduces weaponskill recast time and auto-attack delay by 15%.\nDuration: 70s\nTen Chi Jin: Ten as the third mudra.' }),
    tcjDoton: tcj({ name: 'Doton', sign: 'chi', fixedRecast: 1.5, target: false, pbaoe: 5, dot: { potency: 100, duration: 24 }, desc: 'Creates a patch of corrupted earth.\nTen Chi Jin: Chi as the third mudra.' }),
    tcjSuiton: tcj({ name: 'Suiton', sign: 'jin', fixedRecast: 1.5, potency: 600, target: true, fx: 'gnbSlash', desc: 'Deals water damage with a potency of 600.\nAdditional Effect: Grants Suiton\nDuration: 20s\nTen Chi Jin: Jin as the third mudra.' }),
    // Off the GCD.
    trickAttack: ab({ name: 'Trick Attack', potency: 350, positional: 'rear', posBonus: 150, recast: 60, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'slash3', desc: 'Delivers an attack with a potency of 350.\n500 when executed from a target\'s rear.\nAdditional Effect: Increases target\'s damage taken by 5%\nDuration: 15s\nCan only be executed while under the effect of Hidden or Suiton.' }),
    mug: ab({ name: 'Mug', potency: 150, recast: 120, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'slash', desc: 'Delivers an attack with a potency of 150.\nAdditional Effect: Increases Ninki Gauge by 40' }),
    dreamWithinADream: ab({ name: 'Dream Within a Dream', potency: 200, recast: 60, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'slash3', desc: 'Delivers a threefold attack, each hit with a potency of 200.\nAdditional Effect: Grants Assassinate Ready\nDuration: 15s' }),
    assassinate: ab({ name: 'Assassinate', potency: 200, recast: 1, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'slash2', desc: 'Delivers a critical direct hit with a potency of 200.\nCan only be executed when Assassinate Ready.' }),
    bhavacakra: ab({ name: 'Bhavacakra', potency: 300, recast: 1, cdGroup: 'bhava', ninkiCost: 50, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'gnbZone', desc: 'Deals unaspected damage with a potency of 300.\nNinki Gauge Cost: 50\nShares a recast timer with Hellfrog Medium.' }),
    hellfrogMedium: ab({ name: 'Hellfrog Medium', potency: 200, recast: 1, cdGroup: 'bhava', ninkiCost: 50, target: true, range: 25, aoe: true, delay: 0.7, fx: 'slashFire', desc: 'Deals fire damage with a potency of 200 to target and all enemies nearby it.\nNinki Gauge Cost: 50\nShares a recast timer with Bhavacakra.' }),
    bunshin: ab({ name: 'Bunshin', recast: 90, ninkiCost: 50, desc: 'Grants 5 stacks of Bunshin, each stack allowing your shadow to attack enemies each time you execute a weaponskill. Shadow attack potency varies based on the attack executed, but is not affected by combo bonuses.\nMelee Attack Potency: 200\nRanged Attack Potency: 100\nArea Attack Potency: 100\nDuration: 30s\nAdditional Effect: Increases Ninki Gauge by 5 with each shadow attack\nNinki Gauge Cost: 50' }),
    kassatsu: ab({ name: 'Kassatsu', recast: 60, desc: 'Allows the execution of a single ninjutsu without consumption of mudra charges.\nAdditional Effect: Increases damage for the next ninjutsu action by 30%\nDuration: 15s' }),
    tenChiJin: ab({ name: 'Ten Chi Jin', recast: 120, desc: 'Temporarily converts each of the three mudra into a ninjutsu action. Executing one of these actions will convert the remaining mudra into different ninjutsu actions until all three have been executed or the Ten Chi Jin effect expires.\nDuration: 6s\nEffect ends upon moving or using another action.' }),
    meisui: ab({ name: 'Meisui', recast: 120, desc: 'Dispel Suiton, increasing the Ninki Gauge by 50.\nCan only be executed while in combat.' }),
    hide: ab({ name: 'Hide', recast: 20, desc: 'Blend in with your surroundings, making it impossible for most enemies to detect you.\nAdditional Effect: Restores all charges of mudra\nCannot be executed while in combat.' }),
    shukuchi: ab({ name: 'Shukuchi', recast: 60, charges: 2, desc: 'Move quickly to the specified location.\nMaximum Charges: 2' }),
    shadeShift: ab({ name: 'Shade Shift', recast: 120, desc: 'Create shadows that nullify damage up to 20% of maximum HP.\nDuration: 20s' }),
    ...B.ROLE_ACTIONS.melee,
    // 5.x's Feint (6.0 reworded it to physical / magic damage dealt; nin_ew.js puts that back).
    feint: Object.assign({}, B.ROLE_ACTIONS.melee.feint, { desc: 'Lowers target\'s strength and dexterity by 10%, and intelligence and mind by 5%.\nDuration: 10s' }),
    ...B.GENERAL_ACTIONS,
    tincture: B.tincture('dex4'),
    auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
  };

  const STATUSES = {
    huton: { name: 'Huton', self: true, icon: 'st_huton' },
    suiton: { name: 'Suiton', self: true, icon: 'st_suiton' },
    hidden: { name: 'Hidden', self: true, icon: 'st_hidden' },
    mudra: { name: 'Mudra', self: true, icon: 'st_mudra' },
    kassatsu: { name: 'Kassatsu', self: true, icon: 'st_kassatsu' },
    tenChiJin: { name: 'Ten Chi Jin', self: true, icon: 'st_tcj' },
    bunshin: { name: 'Bunshin', self: true, icon: 'st_bunshin' },
    assassinateReady: { name: 'Assassinate Ready', self: true, icon: 'st_assassinate' },
    shadeShift: { name: 'Shade Shift', self: true, icon: 'st_shade' },
    shadowFang: { name: 'Shadow Fang', self: false, icon: 'st_shadowfang' },
    trickAttack: { name: 'Vulnerability Up', self: false, icon: 'st_vuln' },
    doton: { name: 'Doton', self: false, icon: 'st_doton' },
  };

  // The Ninjutsu a run of mudras makes: the last mudra picks it, any repeat makes Rabbit Medium.
  function jutsuFor(seq, kassatsu) {
    if (!seq.length) return null;
    if (seq.length === 1) return 'fumaShuriken';
    if (new Set(seq).size !== seq.length) return 'rabbitMedium';
    const last = seq[seq.length - 1];
    if (seq.length === 2) return last === 'chi' ? 'raiton' : last === 'ten' ? (kassatsu ? 'gokaMekkyaku' : 'katon') : (kassatsu ? 'hyoshoRanryu' : 'hyoton');
    return last === 'ten' ? 'huton' : last === 'jin' ? 'suiton' : 'doton';
  }
  const TCJ1 = { ten: 'tcjFumaTen', chi: 'tcjFumaChi', jin: 'tcjFumaJin' };
  const TCJ2 = { ten: 'tcjKaton', chi: 'tcjRaiton', jin: 'tcjHyoton' };
  const TCJ3 = { ten: 'tcjHuton', chi: 'tcjDoton', jin: 'tcjSuiton' };
  // Actions that don't end Hide (buffs that don't attack).
  const KEEPS_HIDDEN = { hide: 1, kassatsu: 1, tincture: 1, sprint: 1, shadeShift: 1, secondWind: 1, bloodbath: 1, trueNorth: 1, armsLength: 1 };

  class NinjaShB {
    constructor() {
      this.name = 'Ninja';
      this.abbr = 'NIN';
      this.role = 'melee';
      this.level = 80;
      this.levelKey = 'shb80';
      this.model = 'nin-shb';
      this.actions = ACTIONS;
      this.statuses = STATUSES;
      this.comboTime = 15;
      this.stats = { hp: 70000, main: 5543, mainStat: 'dex', jobMod: 110, trait: 100, wd: 134, det: 2574, crit: 3779, dh: 3038, speed: 380, delay: 2.56 };
      this.speedName = 'Skill speed';
      this.tierHaste = 15;          // quoted with Huton up: 2.50 → 2.12
      this.autoAttack = { potency: 110, delay: 2.56, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['huton', 'mudra', 'tenChiJin', 'kassatsu', 'suiton', 'hidden', 'bunshin', 'assassinateReady', 'trueNorth',
        'shadeShift', 'medicated', 'bloodbath', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['trickAttack', 'shadowFang', 'doton', 'feint'];
      this.defaultBars = [
        ['spinningEdge', 'gustSlash', 'aeolianEdge', 'armorCrush', 'shadowFang', 'ten', 'chi', 'jin', 'ninjutsu', 'trickAttack', 'mug', 'bhavacakra'],
        ['dreamWithinADream', 'assassinate', 'kassatsu', 'tenChiJin', 'meisui', 'bunshin', 'trueNorth', 'tincture', 'hide', 'shadeShift', 'feint', 'bloodbath'],
        ['deathBlossom', 'hakkeMujinsatsu', 'hellfrogMedium', 'throwingDagger', 'shukuchi', 'secondWind', 'legSweep', 'armsLength', 'sprint', null, null, null],
      ];
      this.actionGroups = [
        ['Ninja', ['spinningEdge', 'gustSlash', 'aeolianEdge', 'armorCrush', 'shadowFang', 'throwingDagger', 'deathBlossom', 'hakkeMujinsatsu',
          'trickAttack', 'mug', 'dreamWithinADream', 'assassinate', 'bhavacakra', 'hellfrogMedium', 'bunshin', 'kassatsu', 'tenChiJin', 'meisui',
          'hide', 'shukuchi', 'shadeShift']],
        ['Ninjutsu', ['ten', 'chi', 'jin', 'ninjutsu', 'fumaShuriken', 'katon', 'raiton', 'hyoton', 'huton', 'doton', 'suiton', 'gokaMekkyaku', 'hyoshoRanryu']],
        ['Role Actions', ['trueNorth', 'feint', 'bloodbath', 'secondWind', 'armsLength', 'legSweep']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 22120;     // a scripted 5.58 rotation on this gear parses about 20,870 on the dummy
      this.referenceGcd = 2.12;
      this.startDistance = 3.2;
    }

    initGauge() { return { ninki: 0, mudras: [], mudraUntil: 0, broken: false, tcj: null }; }

    haste(e) { return e.has('huton') ? 15 : 0; }
    autoHaste(e) { return this.haste(e); }

    // Mudras turn into their free follow-ups inside a sequence (or under Kassatsu) and into ninjutsu under Ten Chi Jin;
    // the Ninjutsu button into what the mudras made.
    resolveId(id, e) {
      const g = e.g;
      if (MUDRAS.includes(id)) {
        if (g.tcj && e.has('tenChiJin')) {
          if (g.tcj.includes(id)) return id;
          return (g.tcj.length === 0 ? TCJ1 : g.tcj.length === 1 ? TCJ2 : TCJ3)[id];
        }
        return g.mudras.length || e.has('kassatsu') ? id + '2' : id;
      }
      if (id !== 'ninjutsu' || !g.mudras.length) return id;
      return g.broken ? 'rabbitMedium' : jutsuFor(g.mudras, e.has('kassatsu'));
    }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (e.has('tenChiJin') && !a.tcj) return 'Unable to execute action while under the effect of Ten Chi Jin.';
      // Ten Chi Jin's ninjutsu only go off as its next step, from a sign not used yet.
      if (a.tcj) {
        const step = g.tcj && e.has('tenChiJin') ? [TCJ1, TCJ2, TCJ3][g.tcj.length] : null;
        if (!step || step[a.sign] !== id || g.tcj.includes(a.sign)) return 'Unable to execute action.';
      }
      if (id === 'ninjutsu') return 'Unable to execute action. Mudra required.';
      if (a.jutsu && !a.tcj && this.resolveId('ninjutsu', e) !== id) return 'Unable to execute action. Mudra required.';
      if (MUDRAS.includes(id) && g.tcj && e.has('tenChiJin')) return 'Unable to execute action.';
      if (a.mudra && g.mudras.length >= 3) return 'Unable to execute action.';
      if (id === 'trickAttack' && !e.has('suiton') && !e.has('hidden')) return 'Unable to execute action. Hidden or Suiton required.';
      if (id === 'assassinate' && !e.has('assassinateReady')) return 'Unable to execute action. Assassinate Ready required.';
      if (id === 'meisui' && (!e.has('suiton') || !e.inCombat)) return 'Unable to execute action. Suiton required, in combat.';
      if (id === 'hide' && e.inCombat) return 'Unable to execute action while in combat.';
      if (id === 'tenChiJin' && e.has('kassatsu')) return 'Unable to execute action while under the effect of Kassatsu.';
      if (a.ninkiCost && g.ninki < a.ninkiCost) return 'Not enough Ninki.';
      return null;
    }

    snapshot(a, e) {
      let mult = 1;
      if (e.tHas('trickAttack')) mult *= TRICK;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES.dex4.cap : 0);
      return { mult, main };
    }

    ninki(e, n) { e.g.ninki = Math.max(0, Math.min(NINKI_MAX, e.g.ninki + n)); }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      // Any other action before the Ninjutsu spoils the mudras.
      if (g.mudras.length && !a.mudra && !a.jutsu) g.broken = true;
      if (!a.mudra && !a.jutsu && id !== 'trickAttack' && !KEEPS_HIDDEN[id]) e.removeStatus('hidden');
      if (a.mudra) this.mudra(id, e);
      else if (a.tcj) this.tcjJutsu(id, e);
      else if (a.jutsu) this.ninjutsu(id, e);
      else if (a.kind === 'gcd') this.weaponskill(id, e);
      else this.ability(id, e);
    }

    mudra(id, e) {
      const g = e.g;
      if (!g.mudras.length) { g.mudraUntil = e.now + MUDRA_DUR; e.addStatus('mudra', MUDRA_DUR, { stacks: 1 }); }
      g.mudras.push(id.replace('2', ''));
      if (e.statuses.mudra) { e.statuses.mudra.stacks = Math.min(3, g.mudras.length); e.emit('statusStack', { key: 'mudra' }); }
    }
    clearMudras(e) {
      const g = e.g;
      g.mudras = []; g.broken = false; g.mudraUntil = 0;
      e.removeStatus('mudra', true);
    }

    jutsuHit(id, e, mult) {
      const a = this.actions[id];
      const snap = this.snapshot(a, e);
      snap.mult *= mult;
      switch (id) {
        case 'huton': case 'tcjHuton': e.addStatus('huton', HUTON_MAX); return;
        case 'suiton': case 'tcjSuiton': e.queueHit(id, a.potency, snap, a.delay, () => e.addStatus('suiton', 20)); return;
        case 'doton': case 'tcjDoton':
          if (e.distToTarget() - B.DUMMY_RADIUS > a.pbaoe) return;
          e.addTStatus('doton', a.dot.duration, { snap, dot: { potency: a.dot.potency, id } });
          return;
      }
      if (a.potency) e.queueHit(id, a.potency, snap, a.delay);
    }

    ninjutsu(id, e) {
      this.clearMudras(e);
      if (id === 'rabbitMedium') return;
      const kassatsu = e.has('kassatsu');
      if (kassatsu) e.removeStatus('kassatsu');
      this.jutsuHit(id, e, kassatsu ? KASSATSU : 1);
    }

    tcjJutsu(id, e) {
      const g = e.g;
      g.tcj.push(this.actions[id].sign);
      this.jutsuHit(id, e, 1);
      if (g.tcj.length >= 3) { e.removeStatus('tenChiJin'); g.tcj = null; }
    }

    weaponskill(id, e) {
      const a = this.actions[id], g = e.g;
      const combo = !!a.comboFrom && e.lastComboHit;
      const pos = !!a.positional && e.positionalHit(a);
      const potency = (a.comboFrom && combo ? a.comboPotency : a.potency) + (pos ? a.posBonus : 0);
      const snap = this.snapshot(a, e);
      if (a.ninki && (!a.comboFrom || combo)) this.ninki(e, a.ninki);
      if (a.huton && combo && e.has('huton')) {
        const st = e.statuses.huton;
        st.until = Math.min(e.now + HUTON_MAX, st.until + a.huton);
      }
      const after = a.dot ? () => e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }) : null;
      e.queueHit(id, potency, snap, a.delay, after, { positional: a.positional ? (pos ? 'hit' : 'miss') : null });
      // Bunshin: a shadow hit (200 melee, 100 ranged or AoE, no combo bonus) and 5 Ninki for each weaponskill.
      if (e.has('bunshin')) {
        const s = e.statuses.bunshin;
        e.queueHit('bunshin', a.shadow || 200, snap, a.delay + 0.3, null, { aoe: a.aoe ? true : undefined });
        this.ninki(e, 5);
        s.stacks = (s.stacks || 1) - 1;
        if (s.stacks <= 0) e.removeStatus('bunshin'); else e.emit('statusStack', { key: 'bunshin' });
      }
    }

    ability(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.ninkiCost) this.ninki(e, -a.ninkiCost);
      switch (id) {
        case 'trickAttack': {
          const pos = e.positionalHit(a);
          e.removeStatus('suiton'); e.removeStatus('hidden');
          e.queueHit(id, a.potency + (pos ? a.posBonus : 0), this.snapshot(a, e), a.delay, () => e.addTStatus('trickAttack', 15), { positional: pos ? 'hit' : 'miss' });
          return;
        }
        case 'dreamWithinADream': {
          const snap = this.snapshot(a, e);
          for (let k = 0; k < 3; k++) e.queueHit(id, a.potency, snap, a.delay + k * 0.3);
          e.addStatus('assassinateReady', 15);
          return;
        }
        case 'assassinate':
          e.removeStatus('assassinateReady');
          e.queueHit(id, a.potency, this.snapshot(a, e), a.delay, null, { crit: true, dh: true });
          return;
        case 'mug': this.ninki(e, 40); break;
        case 'meisui': e.removeStatus('suiton'); this.ninki(e, 50); return;
        case 'bunshin': e.addStatus('bunshin', 30, { stacks: 5 }); return;
        case 'kassatsu': e.addStatus('kassatsu', 15); return;
        case 'tenChiJin': this.clearMudras(e); e.g.tcj = []; e.addStatus('tenChiJin', 6); return;
        case 'hide': {
          e.addStatus('hidden', 1e9, { permanent: true });
          const c = e.cd('ten'); c.charges = c.max; c.nextAt = null;
          return;
        }
        case 'shukuchi': this.gap(e); return;
        case 'shadeShift': e.addStatus('shadeShift', 20); return;
        default:
          if (B.ROLE_EFFECTS[id]) { B.ROLE_EFFECTS[id](e); return; }
      }
      if (a.potency) e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
    }

    gap(e) {
      const d = e.distToTarget() || 1;
      if (d > 2.6) {
        const from = { x: e.pos.x, z: e.pos.z };
        e.pos.x *= 2.4 / d; e.pos.z *= 2.4 / d;
        e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
      }
    }

    // Mudras left too long run out (the charge is already spent); Ten Chi Jin ends when it runs out or you move.
    nextEvent(e) { return e.g.mudras.length ? e.g.mudraUntil : Infinity; }
    process(e) {
      const g = e.g;
      if (g.mudras.length && e.now >= g.mudraUntil - EPS) this.clearMudras(e);
      if (g.tcj && !e.has('tenChiJin')) g.tcj = null;
    }
    frame(e) {
      if (e.moving && e.has('tenChiJin')) { e.removeStatus('tenChiJin'); e.g.tcj = null; }
    }

    proc(id, e) {
      const a = this.actions[id];
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (id === 'ninjutsu') return e.g.mudras.length > 0;
      if (id === 'trickAttack') return e.has('suiton') || e.has('hidden');
      if (id === 'assassinate') return e.has('assassinateReady');
      if (a.tcj) return true;
      return false;
    }

    mpRegen() { return B.BASE_REGEN; }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)}, ${e.gcdForSpeed(e.stats.speed, 15).toFixed(2)} under Huton · mudras 0.5s, Ninjutsu 1.5s`; }

    // ---------- Huton, Ninki and the mudras ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="150" viewBox="0 0 360 150">
  <defs><linearGradient id="ns-k" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a2a8a"/><stop offset="1" stop-color="#d9a6ff"/></linearGradient></defs>
  <rect x="8" y="10" width="344" height="130" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text x="24" y="34" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">HUTON</text>
  <rect x="24" y="42" width="250" height="10" rx="5" fill="#2a2535" stroke="rgba(0,0,0,.8)"/>
  <rect id="ns-h" x="24" y="42" width="0" height="10" rx="5" fill="#7fd7b0"/>
  <text id="ns-ht" x="336" y="52" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke"></text>
  <text x="24" y="74" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">NINKI</text>
  <rect x="24" y="82" width="250" height="10" rx="5" fill="#2a2535" stroke="rgba(0,0,0,.8)"/>
  <rect id="ns-k" x="24" y="82" width="0" height="10" rx="5" fill="url(#ns-k)"/>
  <line x1="149" y1="78" x2="149" y2="96" stroke="rgba(255,255,255,.5)"/>
  <text id="ns-kt" x="336" y="92" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">0</text>
  ${[0, 1, 2].map(k => `<circle id="ns-m${k}" cx="${44 + k * 40}" cy="118" r="13" fill="#2a2535" stroke="rgba(0,0,0,.8)" stroke-width="1.5"/>
  <text id="ns-mt${k}" x="${44 + k * 40}" y="123" text-anchor="middle" font-family="Noto Sans, sans-serif" font-size="13" font-weight="700" fill="#fff"></text>`).join('')}
  <text id="ns-j" x="336" y="124" text-anchor="end" font-family="Noto Sans, sans-serif" font-size="14" font-weight="600" fill="#ffd27a"></text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.ng = { h: $('#ns-h'), ht: $('#ns-ht'), k: $('#ns-k'), kt: $('#ns-kt'), m: [0, 1, 2].map(k => $('#ns-m' + k)), mt: [0, 1, 2].map(k => $('#ns-mt' + k)), j: $('#ns-j'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.ng, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      const h = e.has('huton') ? Math.max(0, e.statuses.huton.until - e.now) : 0;
      put('h', Math.round(h * 4), () => G.h.setAttribute('width', (250 * Math.min(1, h / HUTON_MAX)).toFixed(1)));
      put('ht', Math.ceil(h), v => { G.ht.textContent = v ? v + 's' : ''; G.h.setAttribute('fill', v > 0 && v < 15 ? '#ff8f6b' : '#7fd7b0'); });
      put('k', g.ninki, v => { G.k.setAttribute('width', String(250 * v / NINKI_MAX)); G.kt.textContent = String(v); });
      const seq = g.tcj && e.has('tenChiJin') ? g.tcj : g.mudras;
      const label = { ten: '天', chi: '地', jin: '人' };
      const col = { ten: '#6fb6ff', chi: '#e8b85a', jin: '#e06a8f' };
      for (let i = 0; i < 3; i++) put('m' + i, seq[i] || '', v => { G.m[i].setAttribute('fill', v ? col[v] : '#2a2535'); G.mt[i].textContent = v ? label[v] : ''; });
      const j = g.tcj && e.has('tenChiJin') ? 'TEN CHI JIN' : g.mudras.length ? this.actions[this.resolveId('ninjutsu', e)].name : '';
      put('j', j, v => { G.j.textContent = v; });
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Shadowbringers 5.1–5.58)</h3>
<p>Level 80 Ninja. Keep <b>Huton</b> up (15% faster weaponskills and auto-attacks, up to 70s): <b>Spinning Edge → Gust Slash → Armor Crush</b> (flank) adds 30s; use it when Huton is under 40s, otherwise finish with <b>Aeolian Edge</b> (rear, 480). <b>Shadow Fang</b> is a weaponskill with its own 70s recast (200 + 90 × 30s).</p>
<p><b>Ten, Chi and Jin</b> are 0.5s GCDs sharing two charges (20s each); only the first mudra of a sequence spends one. The last sign picks the <b>Ninjutsu</b> (a flat 1.5s GCD): one sign Fuma Shuriken; two ending in Chi <b>Raiton</b> (800), in Ten Katon, in Jin Hyoton; three ending in Ten Huton, in Jin <b>Suiton</b> (600, allows Trick Attack), in Chi Doton. A repeated sign, or any other action in between, makes Rabbit Medium. <b>Trick Attack</b> (500 from the rear, +5% damage taken for 15s, any side) goes inside your burst with Raitons, <b>Kassatsu</b> (a free Ninjutsu at +30%: <b>Hyosho Ranryu</b>, 1,200), <b>Dream Within a Dream</b> → <b>Assassinate</b>, and every other minute <b>Ten Chi Jin</b> (the three mudras become Fuma → Raiton → Suiton, 6s, no moving) then <b>Meisui</b> (Suiton into 50 Ninki).</p>
<p>Ninki comes from weaponskills, <b>Mug</b> (+40) and Meisui; spend 50 on <b>Bhavacakra</b> (300) and <b>Bunshin</b> (90s: five shadow hits of 200, 5 Ninki each).</p>
<h3>The opener (The Balance, 5.58)</h3>
${seq(['jin', 'chi', 'ten', 'huton', 'ten', 'jin', 'chi', 'doton', ['hide'], 'ten', 'chi', 'jin', 'suiton', ['kassatsu'], 'spinningEdge', ['tincture'], 'gustSlash', ['mug'], ['bunshin'], 'aeolianEdge', 'spinningEdge', ['trickAttack'], 'shadowFang', ['dreamWithinADream'], 'chi', 'jin', 'hyoshoRanryu', ['assassinate'], 'ten', 'chi', 'raiton', ['tenChiJin'], 'tcjFumaTen', 'tcjRaiton', 'tcjSuiton', ['meisui'], 'gustSlash', ['bhavacakra'], 'aeolianEdge', ['bhavacakra'], 'ten', 'chi', 'raiton'])}
<p>Huton at −11s, Doton at −7s then Hide (which restores both mudra charges), Suiton and Kassatsu at −1s. Doton only hits if the dummy is in it.</p>
<p style="color:#a9a3b4">The 5.58 numbers: Spinning Edge 230, Gust Slash combo 340, Aeolian Edge combo 420 (480 rear), Armor Crush combo 400 (460 flank), Shadow Fang 200 + 90 × 30s, Fuma 500, Katon 500, Raiton 800, Hyoton 400, Suiton 600, Doton 100 × 24s, Goka Mekkyaku 750, Hyosho Ranryu 1,200 (+30% under Kassatsu), Trick Attack 350 (500 rear), Mug 150, Dream Within a Dream 3 × 200, Assassinate 200, Bhavacakra 300, Hellfrog Medium 200, Bunshin shadows 200; auto-attacks 110 at 2.56s. Gear: The Balance's 5.58 "2.12" relic set (Dexterity 5,543, 134 weapon damage), pre-6.0 stats from the 5.58 game data.</p>`;
    }
  }

  B.NinjaShB = NinjaShB;
  B.registerJob({
    id: 'nin', name: 'Ninja', abbr: 'NIN', role: 'melee', classJob: 30,
    versions: [{ id: 'shb51', label: 'Shadowbringers 5.1–5.58', history: 'ShB 5.1–5.58', note: 'Level 80: mudras on two charges, Kassatsu into Hyosho Ranryu, the reworked Ten Chi Jin, Bunshin, Trick Attack\'s 5%, Shadow Fang on its own 70s recast', create: () => new NinjaShB() }],
  });
})(window.BLM);

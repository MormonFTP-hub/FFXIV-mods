// Ninja, Shadowbringers 5.0–5.08 at level 80, before 5.1's mudra rework. Built on the Stormblood class (nin_sb.js) for
// the old Ninjutsu: Ten, Chi and Jin off the GCD, sharing Ninjutsu's 20s recast, and Ten Chi Jin as three free
// Ninjutsu in a row (+150% from 5.08). What Shadowbringers changed: no TP, Duality or Jugulate; Shadow Fang is Spinning
// Edge's second finisher (220 and a 70-potency DoT for 24s); the Ninki Gauge gains 8 for every weaponskill that lands
// (Shukiho II) and 40 from Mug and from Meisui (Suiton's 20s turned into Ninki); 80 Ninki buys Bhavacakra (500),
// Hellfrog Medium (400) or Bunshin, a 15s shadow that repeats each weaponskill (200 melee, 100 ranged or AoE, +4 Ninki
// each). Kassatsu (60s, one charge) resets Ninjutsu and makes the next one 30% stronger, turning Katon and Hyoton into
// Goka Mekkyaku (400) and Hyosho Ranryu (600). Trick Attack: 340 (500 rear) and, from the rear, +10% damage taken for
// 10s. Dream Within a Dream readies Assassinate. Numbers are the game data at 5.08 (xivapi's datamining) checked
// against 5.0 and 5.1; gear is The Balance's 5.58 set (no 5.0x Ninja set survives). ref: a scripted bot parses about
// 19,300 on this.
(function (B) {
  const SB = B.NinjaSB;
  const TRICK = 1.10, KASSATSU = 1.3, NINKI_MAX = 100, SHUKIHO = 8, HUTON_MAX = 70;
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.5, fx: 'slash' }, o);
  const jutsu = (o) => ab(Object.assign({ cdGroup: 'ninjutsu', recast: 20, lock: 0.8, jutsu: true, school: 'ninjutsu', delay: 0.6, target: true, range: 25 }, o));
  const set = B.setAction;     // a version's change to an action (its description's numbers follow the potency)
  const KEEPS_HIDDEN = { hide: 1, kassatsu: 1, tincture: 1, sprint: 1, shadeShift: 1, secondWind: 1, bloodbath: 1, trueNorth: 1, armsLength: 1 };

  // The Ninjutsu a run of mudras makes; under Kassatsu, Katon and Hyoton are upgraded.
  function jutsuFor(seq, kassatsu) {
    if (!seq.length) return null;
    if (seq.length === 1) return 'fumaShuriken';
    if (new Set(seq).size !== seq.length) return 'rabbitMedium';
    const last = seq[seq.length - 1];
    if (seq.length === 2) return last === 'chi' ? 'raiton' : last === 'ten' ? (kassatsu ? 'gokaMekkyaku' : 'katon') : (kassatsu ? 'hyoshoRanryu' : 'hyoton');
    return last === 'ten' ? 'huton' : last === 'jin' ? 'suiton' : 'doton';
  }

  class NinjaShB50 extends SB {
    constructor() {
      super();
      this.level = 80;
      this.levelKey = 'shb80';
      this.model = 'nin-shb';
      this.tp = null;
      this.comboTime = 15;
      this.tcjMult = 2.5;
      const A = Object.assign({}, this.actions);
      for (const k of ['duality', 'jugulate', 'invigorate2', 'goad2', 'secondWind2', 'feint2', 'trueNorth', 'bloodbath', 'armsLength', 'legSweep',
        'shadewalker', 'smokeScreen']) delete A[k];
      Object.assign(A, B.ROLE_ACTIONS.melee);
      set(A, 'spinningEdge', { potency: 220, desc: 'Delivers an attack with a potency of 220.' });
      set(A, 'gustSlash', { comboPotency: 330, desc: 'Delivers an attack with a potency of 100.\nCombo Action: Spinning Edge\nCombo Potency: 330' });
      set(A, 'aeolianEdge', { comboPotency: 400, posBonus: 60, desc: 'Delivers an attack with a potency of 100.\n160 when executed from a target\'s rear.\nCombo Action: Gust Slash\nCombo Potency: 400\nRear Combo Potency: 460' });
      set(A, 'armorCrush', { comboPotency: 380, posBonus: 60, desc: 'Delivers an attack with a potency of 100.\n160 when executed from a target\'s flank.\nCombo Action: Gust Slash\nCombo Potency: 380\nFlank Combo Potency: 440\nCombo Bonus: Extends Huton duration by 30s to a maximum of 70s' });
      set(A, 'shadowFang', { comboFrom: 'spinningEdge', comboNext: false, potency: 100, comboPotency: 220, dot: { potency: 70, duration: 24 },
        desc: 'Delivers an attack with a potency of 100.\nCombo Action: Spinning Edge\nCombo Potency: 220\nCombo Bonus: Damage over time\nPotency: 70\nDuration: 24s' });
      set(A, 'throwingDagger', { range: 20, shadow: 100 });
      set(A, 'deathBlossom', { potency: 120, comboStart: true, comboNext: true, breaksCombo: undefined, shadow: 100, desc: 'Delivers an attack with a potency of 120 to all nearby enemies.' });
      A.hakkeMujinsatsu = ws({ name: 'Hakke Mujinsatsu', potency: 100, comboPotency: 140, comboFrom: 'deathBlossom', huton: 10, shadow: 100, target: false, pbaoe: 5, aoe: true, fx: 'slash3',
        desc: 'Delivers an attack with a potency of 100 to all nearby enemies.\nCombo Action: Death Blossom\nCombo Potency: 140\nCombo Bonus: Extends Huton duration by 10s to a maximum of 70s' });
      set(A, 'fumaShuriken', { potency: 280, range: 25, desc: 'Delivers a ranged ninjutsu attack with a potency of 280.\nMudra Combination: any one of Ten, Chi or Jin' });
      set(A, 'katon', { potency: 250, range: 25, desc: 'Deals fire damage with a potency of 250 to target and all enemies nearby it.\nMudra Combination: Chi→Ten or Jin→Ten' });
      set(A, 'raiton', { potency: 400, range: 25, desc: 'Deals lightning damage with a potency of 400.\nMudra Combination: Ten→Chi or Jin→Chi' });
      set(A, 'hyoton', { potency: 140, range: 25, desc: 'Deals ice damage with a potency of 140.\nAdditional Effect: Bind\nDuration: 15s\nMudra Combination: Ten→Jin or Chi→Jin' });
      set(A, 'huton', { desc: 'Reduces weaponskill recast time and auto-attack delay by 15%.\nDuration: 70s\nMudra Combination: Jin→Chi→Ten or Chi→Jin→Ten' });
      set(A, 'doton', { dot: { potency: 45, duration: 24, aoe: true }, desc: 'Creates a patch of corrupted earth, dealing damage with a potency of 45 to any enemies who enter.\nDuration: 24s\nMudra Combination: Ten→Jin→Chi or Jin→Ten→Chi' });
      set(A, 'suiton', { potency: 130, range: 25, desc: 'Deals water damage with a potency of 130.\nAdditional Effect: Grants Suiton\nDuration: 20s\nSuiton Effect: Allows the execution of Trick Attack without Hidden.\nMudra Combination: Ten→Chi→Jin or Chi→Ten→Jin' });
      A.gokaMekkyaku = jutsu({ name: 'Goka Mekkyaku', potency: 400, aoe: true, fx: 'slashFire', desc: 'Deals fire damage with a potency of 400 to target and all enemies nearby it.\nMudra Combination: Chi→Ten or Jin→Ten\nCan only be executed while under the effect of Kassatsu.' });
      A.hyoshoRanryu = jutsu({ name: 'Hyosho Ranryu', potency: 600, fx: 'gnbZone', desc: 'Deals ice damage with a potency of 600.\nMudra Combination: Chi→Jin or Ten→Jin\nCan only be executed while under the effect of Kassatsu.' });
      set(A, 'trickAttack', { potency: 340, posBonus: 160, desc: 'Delivers an attack with a potency of 340.\n500 when executed from a target\'s rear.\nRear Bonus: Increases target\'s damage taken by 10%\nDuration: 10s\nCan only be executed while under the effect of Hidden or Suiton.' });
      set(A, 'mug', { potency: 150, recast: 110, desc: 'Delivers an attack with a potency of 150.\nAdditional Effect: Increases Ninki Gauge by 40' });
      set(A, 'dreamWithinADream', { potency: 200, recast: 60, desc: 'Delivers a threefold attack, each hit with a potency of 200.\nAdditional Effect: Grants Assassinate Ready\nDuration: 10s' });
      set(A, 'assassinate', { potency: 200, recast: 1, desc: 'Delivers a critical direct hit with a potency of 200.\nCan only be executed while under the effect of Assassinate Ready.' });
      set(A, 'bhavacakra', { potency: 500, recast: 1, cdGroup: 'bhava', desc: 'Deals unaspected damage with a potency of 500.\nNinki Gauge Cost: 80\nShares a recast timer with Hellfrog Medium.' });
      set(A, 'hellfrogMedium', { potency: 400, recast: 1, cdGroup: 'bhava', aoe: 0.5, desc: 'Deals fire damage to target and all enemies nearby it with a potency of 400 for the first enemy, and 50% less for all remaining enemies.\nNinki Gauge Cost: 80\nShares a recast timer with Bhavacakra.' });
      set(A, 'tenChiJin', { recast: 100, ninki: undefined, desc: 'Resets the Ninjutsu recast timer. The next three mudra each execute a Ninjutsu with potency increased by 150%: the first Fuma Shuriken, then the Ninjutsu the signs so far make.\nDuration: 10s\nOnly mudra can be used while it lasts, and the same Ninjutsu can\'t be executed twice.' });
      // One charge (it was Shukuchi that got a second in 5.0).
      set(A, 'kassatsu', { recast: 60, desc: 'Resets the Ninjutsu recast timer while increasing damage for the next Ninjutsu by 30%.\nKaton and Hyoton become Goka Mekkyaku and Hyosho Ranryu.\nDuration: 15s' });
      A.feint = Object.assign({}, A.feint, { desc: 'Lowers target\'s strength and dexterity by 10%.\nDuration: 10s' });     // 5.x's wording
      A.bunshin = ab({ name: 'Bunshin', recast: 110, ninki: 80, desc: 'Your shadow becomes animate, attacking enemies each time you execute a weaponskill. Shadow attack potency varies based on the attack executed, but is not affected by combo bonuses.\nMelee Attack Potency: 200\nRanged Attack Potency: 100\nArea Attack Potency: 100\nNinki Gauge increases by 4 each time your shadow lands an attack.\nDuration: 15s\nNinki Gauge Cost: 80' });
      A.meisui = ab({ name: 'Meisui', recast: 60, desc: 'Dispel Suiton, increasing the Ninki Gauge by 40.\nCan only be executed while in combat.' });
      set(A, 'shukuchi', { charges: 2 });
      A.tincture = B.tincture('dex4');
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        bunshin: { name: 'Bunshin', self: true, icon: 'st_bunshin' },
        assassinateReady: { name: 'Assassinate Ready', self: true, icon: 'st_assassinate' },
        trueNorth: { name: 'True North', self: true, icon: 'st_truenorth' },
      });
      // The Balance's 5.58 2.12 set (Blade's Subtlety: 134 weapon damage, 2.56 delay).
      this.stats = { hp: 70000, main: 5543, mainStat: 'dex', jobMod: 110, trait: 100, wd: 134, det: 2574, crit: 3779, dh: 3038, speed: 380, delay: 2.56 };
      this.autoAttack = { potency: 110, delay: 2.56, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['huton', 'mudra', 'tenChiJin', 'kassatsu', 'suiton', 'hidden', 'bunshin', 'assassinateReady', 'trueNorth', 'shadeShift',
        'bloodbath', 'armsLength', 'medicated', 'sprint'];
      this.targetStatusOrder = ['trickAttack', 'shadowFang', 'doton', 'feint'];
      this.defaultBars = [
        ['spinningEdge', 'gustSlash', 'aeolianEdge', 'armorCrush', 'shadowFang', 'ten', 'chi', 'jin', 'ninjutsu', 'trickAttack', 'mug', 'bhavacakra'],
        ['dreamWithinADream', 'assassinate', 'kassatsu', 'tenChiJin', 'meisui', 'bunshin', 'trueNorth', 'tincture', 'hide', 'shadeShift', 'feint', 'bloodbath'],
        ['deathBlossom', 'hakkeMujinsatsu', 'hellfrogMedium', 'throwingDagger', 'shukuchi', 'secondWind', 'armsLength', 'legSweep', 'sprint', null, null, null],
      ];
      this.actionGroups = [
        ['Ninja', ['spinningEdge', 'gustSlash', 'aeolianEdge', 'armorCrush', 'shadowFang', 'throwingDagger', 'deathBlossom', 'hakkeMujinsatsu',
          'trickAttack', 'mug', 'dreamWithinADream', 'assassinate', 'bhavacakra', 'hellfrogMedium', 'bunshin', 'kassatsu', 'tenChiJin', 'meisui',
          'hide', 'shukuchi', 'shadeShift']],
        ['Ninjutsu', ['ten', 'chi', 'jin', 'ninjutsu']],
        ['Role Actions', ['trueNorth', 'feint', 'bloodbath', 'secondWind', 'armsLength', 'legSweep']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 20460;
      this.referenceGcd = 2.12;
    }

    resolveId(id, e) {
      if (id !== 'ninjutsu') return id;
      const g = e.g;
      if (!g.mudras.length) return id;
      return g.broken ? 'rabbitMedium' : jutsuFor(g.mudras, e.has('kassatsu'));
    }

    check(id, e) {
      if (id === 'assassinate') return e.has('assassinateReady') ? null : 'Unable to execute action. Assassinate Ready required.';
      if (id === 'meisui' && (!e.has('suiton') || !e.inCombat)) return 'Unable to execute action. Suiton required, in combat.';
      if (id === 'tenChiJin' && e.has('kassatsu')) return 'Unable to execute action while under the effect of Kassatsu.';
      if (this.actions[id].jutsu && this.resolveId('ninjutsu', e) !== id) return 'Unable to execute action. Mudra required.';
      return super.check(id, e);
    }

    // Trick Attack for everything; no Dripping Blades or slashing debuff in Shadowbringers.
    snapshot(a, e) {
      const mult = e.tHas('trickAttack') ? TRICK : 1;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES.dex4.cap : 0);
      return { mult, main };
    }

    ninki(e, n) { e.g.ninki = Math.max(0, Math.min(NINKI_MAX, e.g.ninki + n)); }

    resolve(id, e) {
      if (id === 'trueNorth') { e.addStatus('trueNorth', 10); return; }
      super.resolve(id, e);
    }

    ninjutsu(id, e) {
      const a = this.actions[id];
      this.clearMudras(e);
      if (id === 'rabbitMedium') return;
      const snap = this.snapshot(a, e);
      if (e.has('kassatsu') && a.potency) { e.removeStatus('kassatsu'); snap.mult *= KASSATSU; }
      switch (id) {
        case 'huton': e.addStatus('huton', HUTON_MAX); return;
        case 'suiton': e.queueHit(id, a.potency, snap, a.delay, () => e.addStatus('suiton', 20)); return;
        case 'doton':
          if (e.distToTarget() - B.DUMMY_RADIUS > a.pbaoe) return;
          e.addTStatus('doton', a.dot.duration, { snap, dot: { potency: a.dot.potency, id } });
          return;
      }
      if (a.potency) e.queueHit(id, a.potency, snap, a.delay);
    }

    // Every weaponskill that lands adds 8 Ninki (Shukiho II); Bunshin's shadow repeats it for 4 more.
    weaponskill(id, e) {
      const a = this.actions[id];
      const combo = !!a.comboFrom && e.lastComboHit;
      const pos = !!a.positional && e.positionalHit(a);
      const potency = (a.comboFrom && combo ? a.comboPotency : a.potency) + (pos ? a.posBonus : 0);
      const snap = this.snapshot(a, e);
      const huton = id === 'armorCrush' ? 30 : a.huton;
      if (huton && combo && e.has('huton')) { const st = e.statuses.huton; st.until = Math.min(e.now + HUTON_MAX, st.until + huton); }
      const dot = a.dot && combo;
      const after = dot ? () => e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }) : null;
      e.queueHit(id, potency, snap, a.delay, after, { positional: a.positional ? (pos ? 'hit' : 'miss') : null, onResult: () => this.ninki(e, SHUKIHO) });
      if (e.has('bunshin')) e.queueHit('bunshin', a.shadow || 200, snap, a.delay + 0.3, null, { onResult: () => this.ninki(e, 4) });
    }

    ability(id, e) {
      const a = this.actions[id];
      switch (id) {
        case 'mug': this.ninki(e, 10); break;          // Stormblood's resolve already added 30
        case 'dreamWithinADream': {
          const snap = this.snapshot(a, e);
          for (let k = 0; k < 3; k++) e.queueHit(id, a.potency, snap, a.delay + k * 0.3);
          e.addStatus('assassinateReady', 10);
          return;
        }
        case 'assassinate':
          e.removeStatus('assassinateReady');
          e.queueHit(id, a.potency, this.snapshot(a, e), a.delay, null, { crit: true, dh: true });
          return;
        case 'kassatsu': {
          const c = e.cd('ten');
          c.charges = c.max; c.nextAt = null;
          e.addStatus('kassatsu', 15);
          return;
        }
        case 'bunshin': e.addStatus('bunshin', 15); return;
        case 'meisui': e.removeStatus('suiton'); this.ninki(e, 40); return;
        case 'feint': e.addTStatus('feint', 10); return;
        case 'bloodbath': e.addStatus('bloodbath', 20); return;
        case 'armsLength': e.addStatus('armsLength', 6); return;
      }
      super.ability(id, e);
    }

    onHit() {}

    proc(id, e) {
      if (id === 'assassinate') return e.has('assassinateReady');
      if (id === 'meisui') return e.has('suiton') && e.inCombat;
      return super.proc(id, e);
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Shadowbringers 5.0–5.08)</h3>
<p>Level 80 Ninja before the 5.1 rework. Keep <b>Huton</b> up (+15% weaponskill and auto-attack speed, up to 70s): <b>Spinning Edge → Gust Slash → Armor Crush</b> (flank, 440) adds 30s, <b>Aeolian Edge</b> (rear, 460) is the damage finisher, and <b>Shadow Fang</b> (Spinning Edge's other finisher, 220 + 70 × 24s) keeps its DoT up. Every weaponskill that lands adds 8 Ninki.</p>
<p><b>Ten, Chi and Jin</b> are off the GCD and share Ninjutsu's 20s recast: weave the signs, then <b>Ninjutsu</b> (two signs ending in Chi: <b>Raiton</b> 400; three ending in Jin: <b>Suiton</b>, which allows <b>Trick Attack</b> — 500 from the rear and +10% damage taken for 10s). <b>Kassatsu</b> (60s) resets Ninjutsu and makes the next one 30% stronger; Hyoton becomes <b>Hyosho Ranryu</b> (600). <b>Ten Chi Jin</b> (100s) turns the next three signs into three Ninjutsu at +150% (Fuma → Raiton → Suiton). <b>Meisui</b> turns Suiton into 40 Ninki.</p>
<p>80 Ninki buys <b>Bhavacakra</b> (500) or <b>Bunshin</b> (110s): for 15s a shadow repeats each weaponskill at 200 and adds 4 Ninki. <b>Mug</b> (110s) gives 40; <b>Dream Within a Dream</b> (3 × 200) readies <b>Assassinate</b> (200, a critical direct hit).</p>
<h3>The opener</h3>
${seq([['jin'], ['chi'], ['ten'], ['huton'], ['ten'], ['chi'], ['jin'], ['suiton'], 'spinningEdge', ['kassatsu'], 'gustSlash', ['tincture'], 'aeolianEdge', ['mug'], ['bunshin'], 'spinningEdge', ['trickAttack'], ['dreamWithinADream'], 'shadowFang', ['ten'], ['jin'], ['hyoshoRanryu'], ['tenChiJin'], ['ten'], ['chi'], ['jin'], 'spinningEdge', ['assassinate'], ['bhavacakra'], 'gustSlash', 'aeolianEdge'])}
<p>Huton and Suiton before the pull. No 2019 Balance opener survives; this one keeps its usual order: Kassatsu and Mug early, Trick Attack on the fourth GCD with Dream Within a Dream, Hyosho Ranryu and Ten Chi Jin (Fuma → Raiton → Suiton) inside it.</p>
<p style="color:#a9a3b4">The 5.08 numbers (5.0–5.05 had Spinning Edge 200, Gust Slash 250, Aeolian Edge 360 / 420, Armor Crush 330 / 390, Shadow Fang 200 + 50 and Ten Chi Jin +100%): Fuma Shuriken 280, Katon 250, Raiton 400, Hyoton 140, Suiton 130, Doton 45 × 24s, Goka Mekkyaku 400, Hyosho Ranryu 600, Trick Attack 340 / 500, Mug 150, Dream Within a Dream 3 × 200, Assassinate 200, Bhavacakra 500, Hellfrog Medium 400; auto-attacks 110 at 2.56s. Gear: The Balance's 5.58 set (Dexterity 5,543, 134 weapon damage; no 5.0x Ninja set survives), with a Grade 4 Tincture.</p>`;
    }
  }

  B.registerJob({
    id: 'nin', name: 'Ninja', abbr: 'NIN', role: 'melee', classJob: 30,
    versions: [{ id: 'shb50', label: 'Shadowbringers 5.0–5.08', history: 'ShB 5.0–5.08', note: 'Level 80 before the 5.1 rework: mudras off the GCD on Ninjutsu\'s 20s timer, Shadow Fang in the combo, Ninki from every weaponskill for Bhavacakra and a 15s Bunshin, Kassatsu on 60s, Ten Chi Jin +150%', create: () => new NinjaShB50() }],
  });
})(window.BLM);

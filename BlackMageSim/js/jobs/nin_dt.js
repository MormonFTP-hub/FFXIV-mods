// Ninja, Dawntrail at level 100, in two versions. Built on the Endwalker class (nin_ew.js): mudras on two charges,
// Raiton into Raiju, Bunshin and Phantom Kamaitachi, Kassatsu, Ten Chi Jin. Dawntrail made Huton's 15% haste a trait
// (Huton and Suiton are attacks that grant Shadow Walker), let Armor Crush bank two Kazematoi (up to five) that Aeolian
// Edge spends for +100, replaced Trick Attack with Kunai's Bane (your own +10% for 15s, needs Shadow Walker) and Mug with
// Dokumori (+5% damage taken for 20s, +40 Ninki, and Higi: the next Bhavacakra is Zesho Meppo), gave Ten Chi Jin a
// follow-up (Tenri Jindo) and made Meisui +150 to the next Bhavacakra or Zesho Meppo.
//  - 7.0–7.05: Kunai's Bane 600, Dokumori 300, Phantom Kamaitachi 600, Aeolian Edge 380, Armor Crush 420, Bhavacakra
//    380, Dream Within a Dream 3 × 150; the 7.05 savage gear (7.0–7.01 had Raiju 640, Zesho Meppo 550, Tenri Jindo 1,000).
//  - 7.1–7.57: Throwing Dagger 200, Dream Within a Dream 3 × 180; 7.2's finishers (400 / 440) and Bhavacakra 400; 7.3's
//    Kunai's Bane 700, Dokumori 400, Phantom Kamaitachi 700; 7.4's Goka Mekkyaku 850. The 7.4+ savage gear.
// Numbers are the game data at each patch (xivapi's datamining) and the Lodestone notes. ref: a scripted bot parses
// about 24,200 / 36,700 on these.
(function (B) {
  const EW = B.NinjaEW;
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const VERSIONS = {
    dt71: { label: 'Dawntrail 7.1–7.57', history: 'DT 7.1–7.57', ae: [220, 400], ac: [240, 440], bane: 700, doku: 400, pk: 700, bhava: 400, zesho: 700, tenri: 1100, raiju: 700,
      goka: 850, dwad: 180, dagger: 200, tincture: 'dexdt4', ref: 38880,
      stats: { hp: 210000, main: 6494, mainStat: 'dex', jobMod: 110, trait: 100, wd: 158, det: 2527, crit: 3605, dh: 1961, speed: 420, delay: 2.56 },
      note: 'Level 100: Kunai\'s Bane 700, Dokumori 400, Phantom Kamaitachi 700, the 7.2 finishers, Goka Mekkyaku 850; the 7.4+ savage gear' },
    dt70: { label: 'Dawntrail 7.0–7.05', history: 'DT 7.0–7.05', ae: [200, 380], ac: [220, 420], bane: 600, doku: 300, pk: 600, bhava: 380, zesho: 700, tenri: 1100, raiju: 700,
      goka: 600, dwad: 150, dagger: 120, tincture: 'dexdt2', ref: 25650,
      stats: { hp: 150000, main: 4861, mainStat: 'dex', jobMod: 110, trait: 100, wd: 146, det: 2387, crit: 3173, dh: 1842, speed: 420, delay: 2.56 },
      note: 'Level 100: Huton\'s haste a trait, Kazematoi, Kunai\'s Bane, Dokumori into Zesho Meppo, Tenri Jindo; the 7.05 savage gear' },
  };

  class NinjaDT extends EW {
    constructor(version) {
      super('ew61');
      const V = Object.assign({}, this.V, VERSIONS[version], { pkNinki: 10, pkStack: false, raijuDur: 30, raijuPot: [VERSIONS[version].raiju, VERSIONS[version].raiju], trick: 'personal', mugVuln: true });
      this.V = V;
      this.level = 100;
      this.levelKey = 100;
      this.model = 'nin-shb';
      const A = Object.assign({}, this.actions);
      for (const k of ['huraijin', 'trickAttack', 'mug', 'hide']) delete A[k];
      set(A, 'spinningEdge', { potency: 300, desc: 'Delivers an attack with a potency of 300.\nAdditional Effect: Increases Ninki Gauge by 5' });
      set(A, 'gustSlash', { potency: 240, comboPotency: 400, desc: 'Delivers an attack with a potency of 240.\nCombo Action: Spinning Edge\nCombo Potency: 400\nCombo Bonus: Increases Ninki Gauge by 5' });
      set(A, 'aeolianEdge', { potency: V.ae[0], comboPotency: V.ae[1], desc: `Delivers an attack with a potency of ${V.ae[0]}.\n${V.ae[0] + 60} when executed from a target's rear.\nCombo Action: Gust Slash\nCombo Potency: ${V.ae[1]}\nRear Combo Potency: ${V.ae[1] + 60}\nKazematoi Bonus: +100 (uses one stack)\nCombo Bonus: Increases Ninki Gauge by 15` });
      set(A, 'armorCrush', { potency: V.ac[0], comboPotency: V.ac[1], huton: undefined, desc: `Delivers an attack with a potency of ${V.ac[0]}.\n${V.ac[0] + 60} when executed from a target's flank.\nCombo Action: Gust Slash\nCombo Potency: ${V.ac[1]}\nFlank Combo Potency: ${V.ac[1] + 60}\nCombo Bonus: Increases Kazematoi by 2 (up to 5)\nCombo Bonus: Increases Ninki Gauge by 15` });
      set(A, 'throwingDagger', { potency: V.dagger });
      const jp = { fumaShuriken: 500, raiton: 740, suiton: 580, huton: 240, gokaMekkyaku: V.goka, hyoshoRanryu: 1300, tcjFumaTen: 500, tcjFumaChi: 500, tcjFumaJin: 500, tcjRaiton: 740, tcjSuiton: 580, tcjHuton: 240 };
      for (const [id, p] of Object.entries(jp)) if (A[id]) set(A, id, { potency: p, target: true, desc: (A[id].desc || '').replace(/potency of [\d,]+/, `potency of ${p.toLocaleString()}`) });
      set(A, 'huton', { desc: 'Deals wind damage with a potency of 240 to target and all enemies nearby it.\nAdditional Effect: Grants Shadow Walker\nDuration: 20s\nMudra Combination: Jin→Chi→Ten or Chi→Jin→Ten' });
      set(A, 'suiton', { desc: 'Deals water damage with a potency of 580.\nAdditional Effect: Grants Shadow Walker\nDuration: 20s\nMudra Combination: Ten→Chi→Jin or Chi→Ten→Jin' });
      for (const id of ['forkedRaiju', 'fleetingRaiju']) set(A, id, { potency: V.raiju });
      set(A, 'phantomKamaitachi', { potency: V.pk });
      set(A, 'dreamWithinADream', { potency: V.dwad, desc: `Delivers a threefold attack, each hit with a potency of ${V.dwad}.` });
      set(A, 'bhavacakra', { potency: V.bhava, desc: `Deals unaspected damage with a potency of ${V.bhava}.\nMeisui Potency: ${V.bhava + 150}\nNinki Gauge Cost: 50\n※Changes to Zesho Meppo under Higi.` });
      set(A, 'meisui', { desc: 'Dispel Shadow Walker, increasing the Ninki Gauge by 50.\nAdditional Effect: The next Bhavacakra or Zesho Meppo is 150 stronger\nDuration: 30s' });
      set(A, 'tenChiJin', { desc: 'Temporarily converts each of the three mudra into a ninjutsu action.\nDuration: 6s\nAdditional Effect: Grants Tenri Jindo Ready\nDuration: 30s\n※Changes to Tenri Jindo while under Tenri Jindo Ready.' });
      A.kunaisBane = ab({ name: 'Kunai\'s Bane', recast: 60, potency: V.bane, target: true, range: B.MELEE_RANGE, aoe: true, delay: 0.6, fx: 'slash3', desc: `Delivers an attack with a potency of ${V.bane}.\nAdditional Effect: Increases your damage dealt to target by 10%\nDuration: 15s\nCan only be executed while under the effect of Shadow Walker.` });
      A.dokumori = ab({ name: 'Dokumori', recast: 120, potency: V.doku, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'slash', desc: `Delivers an attack with a potency of ${V.doku}.\nAdditional Effect: Increases damage taken by target by 5%\nDuration: 20s\nAdditional Effect: Grants Higi\nDuration: 30s\nAdditional Effect: Increases Ninki Gauge by 40` });
      A.zeshoMeppo = ab({ name: 'Zesho Meppo', recast: 1, cdGroup: 'bhava', potency: V.zesho, ninkiCost: 50, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'gnbZone', desc: `Deals unaspected damage with a potency of ${V.zesho}.\nMeisui Potency: ${V.zesho + 150}\nNinki Gauge Cost: 50\nCan only be executed while under the effect of Higi.` });
      A.tenriJindo = ab({ name: 'Tenri Jindo', recast: 1, potency: V.tenri, target: true, range: 20, aoe: true, delay: 0.7, fx: 'gnbBurst', desc: `Delivers an attack with a potency of ${V.tenri.toLocaleString()} to target and all enemies nearby it.\nCan only be executed while under the effect of Tenri Jindo Ready.` });
      A.tincture = B.tincture(V.tincture);
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        shadowWalker: { name: 'Shadow Walker', self: true, icon: 'st_mudra' },
        kazematoi: { name: 'Kazematoi', self: true, icon: 'st_mudra' },
        higi: { name: 'Higi', self: true, icon: 'st_mudra' },
        tenriJindoReady: { name: 'Tenri Jindo Ready', self: true, icon: 'st_tcj' },
        kunaisBane: { name: 'Kunai\'s Bane', self: false, icon: 'st_trick' },
      });
      this.selfStatusOrder = ['mudra', 'tenChiJin', 'tenriJindoReady', 'kassatsu', 'shadowWalker', 'higi', 'bunshin', 'phantomKamaitachiReady', 'raijuReady', 'meisui',
        'trueNorth', 'shadeShift', 'medicated', 'bloodbath', 'feint', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['kunaisBane', 'mugVuln', 'doton', 'feint'];
      this.stats = V.stats;
      const swap = { trickAttack: 'kunaisBane', mug: 'dokumori', huraijin: 'zeshoMeppo', hide: 'tenriJindo' };
      this.defaultBars = this.defaultBars.map(r => r.map(id => (id && swap[id]) || (id && A[id] ? id : null)));
      this.actionGroups = this.actionGroups.map(([n, ids]) => [n, ids.map(id => swap[id] || id).filter(id => A[id])]);
      this.referenceDps = V.ref;
    }

    haste() { return 15; }
    autoHaste() { return 15; }

    resolveId(id, e) {
      if (id === 'bhavacakra' && e.has('higi')) return 'zeshoMeppo';
      if (id === 'tenChiJin' && e.has('tenriJindoReady')) return 'tenriJindo';
      return super.resolveId(id, e);
    }

    check(id, e) {
      if (id === 'kunaisBane' && !e.has('shadowWalker')) return 'Unable to execute action. Shadow Walker required.';
      if (id === 'meisui') return e.has('shadowWalker') && e.inCombat ? null : 'Unable to execute action. Shadow Walker required, in combat.';
      if (id === 'zeshoMeppo' && (!e.has('higi') || e.g.ninki < 50)) return 'Unable to execute action.';
      if (id === 'tenriJindo' && !e.has('tenriJindoReady')) return 'Unable to execute action.';
      return super.check(id, e);
    }

    snapshot(a, e) {
      let mult = 1;
      if (e.tHas('kunaisBane')) mult *= 1.10;
      if (e.tHas('mugVuln')) mult *= 1.05;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main };
    }

    jutsuHit(id, e, mult) {
      if (id === 'huton' || id === 'tcjHuton' || id === 'suiton' || id === 'tcjSuiton') {
        const a = this.actions[id];
        const snap = this.snapshot(a, e);
        snap.mult *= mult;
        e.queueHit(id, a.potency, snap, a.delay);
        e.addStatus('shadowWalker', 20);
        return;
      }
      super.jutsuHit(id, e, mult);
    }

    tcjJutsu(id, e) {
      super.tcjJutsu(id, e);
      if (!e.g.tcj) e.addStatus('tenriJindoReady', 30);
    }

    weaponskill(id, e) {
      const g = e.g;
      if (id === 'aeolianEdge' && (g.kaze || 0) > 0) {
        g.kaze--;
        let bumped = false;
        e.queueHit = (i, pot, s, d, after, opts) => { if (!bumped && i === 'aeolianEdge') { bumped = true; pot += 100; } return B.Engine.prototype.queueHit.call(e, i, pot, s, d, after, opts); };
        try { super.weaponskill(id, e); } finally { delete e.queueHit; }
        if (g.kaze > 0) e.addStatus('kazematoi', 1e9, { permanent: true, stacks: g.kaze }); else e.removeStatus('kazematoi');
        return;
      }
      const combo = id === 'armorCrush' && e.lastComboHit;
      super.weaponskill(id, e);
      if (combo) { g.kaze = Math.min(5, (g.kaze || 0) + 2); e.addStatus('kazematoi', 1e9, { permanent: true, stacks: g.kaze }); }
    }

    ability(id, e) {
      const a = this.actions[id];
      switch (id) {
        case 'kunaisBane':
          e.removeStatus('shadowWalker');
          e.queueHit(id, a.potency, this.snapshot(a, e), a.delay, () => e.addTStatus('kunaisBane', 15));
          return;
        case 'dokumori':
          this.ninki(e, 40);
          e.addStatus('higi', 30);
          e.queueHit(id, a.potency, this.snapshot(a, e), a.delay, () => e.addTStatus('mugVuln', 20));
          return;
        case 'meisui': e.removeStatus('shadowWalker'); this.ninki(e, 50); e.addStatus('meisui', 30); return;
        case 'bhavacakra': case 'zeshoMeppo':
          this.ninki(e, -50);
          e.queueHit(id, a.potency + (e.has('meisui') ? 150 : 0), this.snapshot(a, e), a.delay);
          e.removeStatus('meisui');
          if (id === 'zeshoMeppo') e.removeStatus('higi');
          return;
        case 'tenriJindo':
          e.removeStatus('tenriJindoReady');
          e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
          return;
      }
      super.ability(id, e);
    }

    proc(id, e) {
      if (id === 'bhavacakra') return e.has('higi') || e.g.ninki >= 50;
      if (id === 'tenChiJin') return e.has('tenriJindoReady');
      if (id === 'kunaisBane') return e.has('shadowWalker');
      return super.proc(id, e);
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed, 15).toFixed(2)} (Huton's 15% is a trait now)`; }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 100 Ninja; the 15% haste is a trait now. <b>Spinning Edge → Gust Slash → Armor Crush</b> (flank, ${V.ac[1] + 60}) banks two <b>Kazematoi</b> (up to five), which <b>Aeolian Edge</b> (rear, ${V.ae[1] + 60}) spends for +100: alternate so you never cap. Mudras on two charges into Ninjutsu: <b>Raiton</b> (740) readies <b>Raiju</b> (${V.raiju}); <b>Suiton</b> (580) or <b>Huton</b> grants <b>Shadow Walker</b> for <b>Kunai's Bane</b> (${V.bane}, your own +10% for 15s) or <b>Meisui</b>. <b>Kassatsu</b> makes Hyoton <b>Hyosho Ranryu</b> (1,300); <b>Ten Chi Jin</b> fires Fuma → Raiton → Suiton and readies <b>Tenri Jindo</b> (${V.tenri.toLocaleString()}).</p>
<p><b>Dokumori</b> (${V.doku}, 120s) adds +5% damage taken for 20s and 40 Ninki and turns the next Bhavacakra into <b>Zesho Meppo</b> (${V.zesho}); Ninki also buys <b>Bhavacakra</b> (${V.bhava}) and <b>Bunshin</b> (five shadow hits, then <b>Phantom Kamaitachi</b>, ${V.pk}); <b>Meisui</b> (+50 Ninki) makes the next one 150 stronger.</p>
<h3>The opener (The Balance, "Standard – 4th GCD")</h3>
${seq([['ten'], ['chi'], ['jin'], ['suiton'], ['kassatsu'], 'spinningEdge', ['tincture'], 'gustSlash', ['dokumori'], ['bunshin'], 'phantomKamaitachi', ['kunaisBane'], 'aeolianEdge', ['dreamWithinADream'], 'ten', 'jin', 'hyoshoRanryu', 'ten', 'chi', 'raiton', ['tenChiJin'], 'fumaShuriken', 'raiton', 'suiton', ['tenriJindo'], ['meisui'], 'fleetingRaiju', ['zeshoMeppo'], 'fleetingRaiju', ['bhavacakra']])}
<p style="color:#a9a3b4">${V.label} numbers: Spinning Edge 300, Gust Slash 400, Aeolian Edge ${V.ae[1]} (${V.ae[1] + 60} rear, +100 Kazematoi), Armor Crush ${V.ac[1]} (${V.ac[1] + 60} flank), Raiju ${V.raiju}, Fuma Shuriken 500, Raiton 740, Suiton 580, Huton 240, Hyosho Ranryu 1,300, Goka Mekkyaku ${V.goka}, Kunai's Bane ${V.bane}, Dokumori ${V.doku}, Bhavacakra ${V.bhava}, Zesho Meppo ${V.zesho} (+150 after Meisui), Tenri Jindo ${V.tenri.toLocaleString()}, Phantom Kamaitachi ${V.pk}, Dream Within a Dream 3 × ${V.dwad}; auto-attacks 90 at 2.56s. Gear: The Balance's set (Dexterity ${V.stats.main.toLocaleString()}).</p>`;
    }
  }

  B.registerJob({
    id: 'nin', name: 'Ninja', abbr: 'NIN', role: 'melee', classJob: 30,
    versions: ['dt71', 'dt70'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new NinjaDT(v) })),
  });
})(window.BLM);

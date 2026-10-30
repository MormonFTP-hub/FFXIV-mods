// Ninja, Endwalker at level 90, in three versions. Built on the Shadowbringers 5.1 class (nin_shb.js): mudras on two
// charges, Kassatsu, Ten Chi Jin, Ninki into Bhavacakra and Bunshin. Endwalker drops Shadow Fang and Assassinate,
// caps Huton at 60s (Huraijin, 200, sets it again), makes Raiton (650) ready Raiju, gives Bunshin (five shadow hits:
// 160, AoE 80) Phantom Kamaitachi (a shadow attack), and Meisui (+50 Ninki) a stronger next Bhavacakra (+100).
//  - 6.0–6.01: each Raiton adds a Forked Raiju stack (15s, up to three) for Forked Raiju (400) → Fleeting Raiju (450);
//    Phantom Kamaitachi (550) only while Bunshin lasts and uses one of its stacks; Trick Attack +5% damage taken.
//  - 6.05–6.08: one Raiju per Raiton, either button, 560, ready for 30s; Phantom Kamaitachi ready for 45s on its own
//    (+10 Ninki); the 6.08 combo numbers.
//  - 6.1–6.58: Trick Attack is your own +10% (the shadow doesn't gain from it); Mug adds +5% damage taken for 20s;
//    Doton 80 × 18s; Bhavacakra 350, Phantom Kamaitachi 600, Spinning Edge 220, Aeolian Edge 380, Armor Crush 360.
// Any Spinning Edge combo weaponskill or Huraijin drops the Raiju stacks. Numbers are the game data at each patch
// (xivapi's datamining) and the Lodestone notes; gear is The Balance's set for each tier (Asphodelos for 6.0x, the
// 6.55 set for 6.1–6.58). ref: a scripted bot parses about 7,360 / 7,970 / 12,410 on these.
(function (B) {
  const SHB = B.NinjaShB;
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.5, fx: 'slash' }, o);
  const COMBO = { spinningEdge: 1, gustSlash: 1, aeolianEdge: 1, armorCrush: 1, huraijin: 1 };
  const VERSIONS = {
    ew61: { label: 'Endwalker 6.1–6.58', history: 'EW 6.1–6.58', se: 220, gs: [160, 320], ae: [140, 380], ac: [140, 360], hakke: 130, hyosho: 1300, doton: [80, 18],
      bhava: 350, pk: 600, pkNinki: 10, pkStack: false, raiju: 'either', raijuPot: [560, 560], raijuDur: 30, trick: 'personal', mugVuln: true, tincture: 'dex8', ref: 13150,
      stats: { hp: 85908, main: 3360, mainStat: 'dex', jobMod: 110, trait: 100, wd: 132, det: 1789, crit: 2554, dh: 1582, speed: 400, delay: 2.56 },
      note: 'Level 90: Trick Attack a personal +10%, Mug +5% damage taken, Doton 80 × 18s, Bhavacakra 350, Phantom Kamaitachi 600; the 6.55 set' },
    ew605: { label: 'Endwalker 6.05–6.08', history: 'EW 6.05–6.08', se: 210, gs: [160, 320], ae: [140, 360], ac: [140, 340], hakke: 120, hyosho: 1300, doton: [70, 24],
      bhava: 400, pk: 550, pkNinki: 10, pkStack: false, raiju: 'either', raijuPot: [560, 560], raijuDur: 30, trick: 'vuln', mugVuln: false, tincture: 'dex6', ref: 8450,
      stats: { hp: 59470, main: 2555, mainStat: 'dex', jobMod: 110, trait: 100, wd: 120, det: 1749, crit: 2283, dh: 1330, speed: 400, delay: 2.56 },
      note: 'Level 90: one Raiju per Raiton (either button, 560), Phantom Kamaitachi ready for 45s; Asphodelos gear' },
    ew60: { label: 'Endwalker 6.0–6.01', history: 'EW 6.0–6.01', se: 200, gs: [140, 300], ae: [120, 340], ac: [120, 320], hakke: 120, hyosho: 1200, doton: [70, 24],
      bhava: 400, pk: 550, pkNinki: 5, pkStack: true, raiju: 'chain', raijuPot: [400, 450], raijuDur: 15, trick: 'vuln', mugVuln: false, tincture: 'dex6', ref: 7800,
      stats: { hp: 59470, main: 2555, mainStat: 'dex', jobMod: 110, trait: 100, wd: 120, det: 1749, crit: 2283, dh: 1330, speed: 400, delay: 2.56 },
      note: 'Level 90 at launch: Forked Raiju → Fleeting Raiju after each Raiton, Phantom Kamaitachi only during Bunshin (using a stack), Trick Attack +5%; Asphodelos gear' },
  };

  class NinjaEW extends SHB {
    constructor(version) {
      super();
      const V = VERSIONS[version];
      this.V = V;
      this.level = 90;
      this.levelKey = 90;
      const A = Object.assign({}, this.actions);
      for (const k of ['shadowFang', 'assassinate']) delete A[k];
      set(A, 'spinningEdge', { potency: V.se, shadow: 160, desc: `Delivers an attack with a potency of ${V.se}.\nAdditional Effect: Increases Ninki Gauge by 5` });
      set(A, 'gustSlash', { potency: V.gs[0], comboPotency: V.gs[1], shadow: 160, desc: `Delivers an attack with a potency of ${V.gs[0]}.\nCombo Action: Spinning Edge\nCombo Potency: ${V.gs[1]}\nCombo Bonus: Increases Ninki Gauge by 5` });
      set(A, 'aeolianEdge', { potency: V.ae[0], comboPotency: V.ae[1], ninki: 15, shadow: 160, desc: `Delivers an attack with a potency of ${V.ae[0]}.\n${V.ae[0] + 60} when executed from a target's rear.\nCombo Action: Gust Slash\nCombo Potency: ${V.ae[1]}\nRear Combo Potency: ${V.ae[1] + 60}\nCombo Bonus: Increases Ninki Gauge by 15` });
      set(A, 'armorCrush', { potency: V.ac[0], comboPotency: V.ac[1], ninki: 15, shadow: 160, desc: `Delivers an attack with a potency of ${V.ac[0]}.\n${V.ac[0] + 60} when executed from a target's flank.\nCombo Action: Gust Slash\nCombo Potency: ${V.ac[1]}\nFlank Combo Potency: ${V.ac[1] + 60}\nCombo Bonus: Extends Huton duration by 30s to a maximum of 60s\nCombo Bonus: Increases Ninki Gauge by 15` });
      set(A, 'throwingDagger', { shadow: 160 });
      set(A, 'deathBlossom', { potency: 100, shadow: 80 });
      set(A, 'hakkeMujinsatsu', { comboPotency: V.hakke, shadow: 80 });
      const jp = { fumaShuriken: 450, katon: 350, raiton: 650, hyoton: 350, suiton: 500, gokaMekkyaku: 600, hyoshoRanryu: V.hyosho, tcjFumaTen: 450, tcjFumaChi: 450, tcjFumaJin: 450, tcjKaton: 350, tcjRaiton: 650, tcjHyoton: 350, tcjSuiton: 500 };
      for (const [id, p] of Object.entries(jp)) if (A[id]) set(A, id, { potency: p, desc: A[id].desc.replace(/potency of [\d,]+/, `potency of ${p.toLocaleString()}`) });
      for (const id of ['doton', 'tcjDoton']) if (A[id]) set(A, id, { dot: { potency: V.doton[0], duration: V.doton[1] } });
      set(A, 'trickAttack', { potency: 300, posBonus: 100, desc: `Delivers an attack with a potency of 300.\n400 when executed from a target's rear.\nAdditional Effect: ${V.trick === 'personal' ? 'Increases your damage dealt to target by 10%' : 'Increases damage taken by target by 5%'}\nDuration: 15s\nCan only be executed while under the effect of Hidden or Suiton.` });
      set(A, 'mug', { desc: `Delivers an attack with a potency of 150.\nAdditional Effect: Increases Ninki Gauge by 40${V.mugVuln ? '\nAdditional Effect: Increases damage taken by target by 5%\nDuration: 20s' : ''}` });
      set(A, 'dreamWithinADream', { potency: 150, desc: 'Delivers a threefold attack, each hit with a potency of 150.' });
      set(A, 'bhavacakra', { potency: V.bhava, desc: `Deals unaspected damage with a potency of ${V.bhava}.\nMeisui Potency: ${V.bhava + 100}\nNinki Gauge Cost: 50` });
      set(A, 'hellfrogMedium', { potency: 160 });
      set(A, 'meisui', { desc: 'Dispel Suiton, increasing the Ninki Gauge by 50.\nAdditional Effect: The next Bhavacakra is 100 stronger\nDuration: 30s' });
      A.huraijin = ws({ name: 'Huraijin', potency: 200, ninki: 5, shadow: 160, fx: 'slash2', desc: 'Delivers an attack with a potency of 200.\nAdditional Effect: Grants Huton (15% faster weaponskills and auto-attacks)\nDuration: 60s\nAdditional Effect: Increases Ninki Gauge by 5' });
      A.forkedRaiju = ws({ name: 'Forked Raiju', potency: V.raijuPot[0], range: 20, ninki: 5, shadow: 160, fx: 'gnbBurst', desc: `Rushes target and delivers a lightning attack with a potency of ${V.raijuPot[0]}.\nAdditional Effect: Increases Ninki Gauge by 5\n${V.raiju === 'chain' ? 'Additional Effect: Grants Fleeting Raiju Ready\nCan only be executed while under the effect of Forked Raiju Ready.' : 'Can only be executed while under the effect of Raiju Ready.'}` });
      A.fleetingRaiju = ws({ name: 'Fleeting Raiju', potency: V.raijuPot[1], ninki: 5, shadow: 160, fx: 'gnbBurst', desc: `Delivers a lightning attack with a potency of ${V.raijuPot[1]}.\nAdditional Effect: Increases Ninki Gauge by 5\nCan only be executed while under the effect of ${V.raiju === 'chain' ? 'Fleeting Raiju Ready' : 'Raiju Ready'}.` });
      A.phantomKamaitachi = ws({ name: 'Phantom Kamaitachi', potency: V.pk, range: 15, aoe: 0.5, ninki: V.pkNinki, fx: 'gnbZone', desc: `Your shadow deals wind damage with a potency of ${V.pk} to target and all enemies nearby it, 50% less for the rest.\nAdditional Effect: Increases Ninki Gauge by ${V.pkNinki}\nAdditional Effect: Extends Huton by 10s\n${V.pkStack ? 'Can only be executed while Bunshin lasts; uses one of its stacks.' : 'Can only be executed while under the effect of Phantom Kamaitachi Ready (45s, from Bunshin).'}` });
      set(A, 'bunshin', { recast: 90, desc: `Grants 5 stacks of Bunshin, each stack allowing your shadow to attack enemies each time you execute a weaponskill (160, or 80 for area attacks).\nNinki Gauge increases by 5 each time your shadow lands an attack.\nDuration: 30s\nAdditional Effect: Grants Phantom Kamaitachi Ready\nNinki Gauge Cost: 50` });
      A.tincture = B.tincture(V.tincture);
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        raijuReady: { name: V.raiju === 'chain' ? 'Forked Raiju Ready' : 'Raiju Ready', self: true, icon: 'st_mudra' },
        fleetingRaijuReady: { name: 'Fleeting Raiju Ready', self: true, icon: 'st_mudra' },
        phantomKamaitachiReady: { name: 'Phantom Kamaitachi Ready', self: true, icon: 'st_bunshin' },
        meisui: { name: 'Meisui', self: true, icon: 'st_mudra' },
        mugVuln: { name: 'Vulnerability Up', self: false, icon: 'st_trick' },
      });
      this.selfStatusOrder = ['huton', 'mudra', 'tenChiJin', 'kassatsu', 'suiton', 'hidden', 'bunshin', 'phantomKamaitachiReady', 'raijuReady', 'fleetingRaijuReady', 'meisui',
        'trueNorth', 'shadeShift', 'medicated', 'bloodbath', 'feint', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['trickAttack', 'mugVuln', 'doton', 'feint'];
      this.stats = V.stats;
      this.defaultBars = this.defaultBars.map(r => r.map(id => id === 'shadowFang' ? 'huraijin' : id === 'assassinate' ? 'phantomKamaitachi' : (id && A[id] ? id : null)));
      const row = this.defaultBars.find(r => r.includes(null));
      if (row) row[row.indexOf(null)] = 'forkedRaiju';
      const row2 = this.defaultBars.find(r => r.includes(null));
      if (row2) row2[row2.indexOf(null)] = 'fleetingRaiju';
      this.actionGroups = this.actionGroups.map(([n, ids]) => [n, n === 'Ninja' ? ids.filter(id => A[id]).concat(['huraijin', 'forkedRaiju', 'fleetingRaiju', 'phantomKamaitachi']) : ids.filter(id => A[id])]);
      this.referenceDps = V.ref;
    }

    check(id, e) {
      const V = this.V;
      if (id === 'forkedRaiju' && !e.has('raijuReady')) return 'Unable to execute action. Raiju Ready required.';
      if (id === 'fleetingRaiju' && !e.has(V.raiju === 'chain' ? 'fleetingRaijuReady' : 'raijuReady')) return 'Unable to execute action. Raiju Ready required.';
      if (id === 'phantomKamaitachi' && !(V.pkStack ? e.has('bunshin') && e.has('phantomKamaitachiReady') : e.has('phantomKamaitachiReady'))) return 'Unable to execute action.';
      return super.check(id, e);
    }

    // shadow: the Bunshin shadow's hits, which the 6.1 Trick Attack doesn't raise.
    snapshot(a, e, shadow) {
      let mult = 1;
      if (e.tHas('trickAttack') && (this.V.trick === 'vuln' || !shadow)) mult *= this.V.trick === 'vuln' ? 1.05 : 1.10;
      if (e.tHas('mugVuln')) mult *= 1.05;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main };
    }

    capHuton(e) { const s = e.statuses.huton; if (s && s.until > e.now + 60) s.until = e.now + 60; }
    clearRaiju(e) { e.removeStatus('raijuReady', true); e.removeStatus('fleetingRaijuReady', true); }

    jutsuHit(id, e, mult) {
      super.jutsuHit(id, e, mult);
      this.capHuton(e);
      if (id === 'raiton' || id === 'tcjRaiton') {
        const n = e.has('raijuReady') ? Math.min(3, (e.statuses.raijuReady.stacks || 1) + 1) : 1;
        e.addStatus('raijuReady', this.V.raijuDur, { stacks: n });
      }
    }

    useRaiju(e) {
      const s = e.statuses.raijuReady;
      s.stacks = (s.stacks || 1) - 1;
      if (s.stacks <= 0) e.removeStatus('raijuReady'); else e.emit('statusStack', { key: 'raijuReady' });
    }

    weaponskill(id, e) {
      const a = this.actions[id], g = e.g, V = this.V;
      if (COMBO[id]) this.clearRaiju(e);
      if (id === 'forkedRaiju') { this.useRaiju(e); if (V.raiju === 'chain') e.addStatus('fleetingRaijuReady', 15); this.gap(e); }
      if (id === 'fleetingRaiju') { if (V.raiju === 'chain') e.removeStatus('fleetingRaijuReady'); else this.useRaiju(e); }
      if (id === 'phantomKamaitachi') {
        e.removeStatus('phantomKamaitachiReady');
        if (V.pkStack) { const s = e.statuses.bunshin; s.stacks = (s.stacks || 1) - 1; if (s.stacks <= 0) e.removeStatus('bunshin'); }
        if (e.has('huton')) e.statuses.huton.until += 10;
        this.capHuton(e);
        this.ninki(e, a.ninki);
        e.queueHit(id, a.potency, this.snapshot(a, e, true), a.delay);
        return;
      }
      const combo = !!a.comboFrom && e.lastComboHit;
      const pos = !!a.positional && e.positionalHit(a);
      const potency = (a.comboFrom && combo ? a.comboPotency : a.potency) + (pos ? a.posBonus : 0);
      if (a.ninki && (!a.comboFrom || combo)) this.ninki(e, a.ninki);
      if (a.huton && combo && e.has('huton')) e.statuses.huton.until += a.huton;
      if (id === 'huraijin') e.addStatus('huton', 60);
      this.capHuton(e);
      e.queueHit(id, potency, this.snapshot(a, e), a.delay, null, { positional: a.positional ? (pos ? 'hit' : 'miss') : null });
      if (e.has('bunshin')) {
        const s = e.statuses.bunshin;
        e.queueHit('bunshin', a.shadow || 160, this.snapshot(a, e, true), a.delay + 0.3, null, { aoe: a.aoe ? true : undefined });
        this.ninki(e, 5);
        s.stacks = (s.stacks || 1) - 1;
        if (s.stacks <= 0) { e.removeStatus('bunshin'); if (V.pkStack) e.removeStatus('phantomKamaitachiReady'); } else e.emit('statusStack', { key: 'bunshin' });
      }
    }

    ability(id, e) {
      const a = this.actions[id], V = this.V;
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
          return;
        }
        case 'mug':
          if (V.mugVuln) e.addTStatus('mugVuln', 20);
          break;
        case 'meisui': e.removeStatus('suiton'); this.ninki(e, 50); e.addStatus('meisui', 30); return;
        case 'bhavacakra':
          this.ninki(e, -a.ninkiCost);
          e.queueHit(id, a.potency + (e.has('meisui') ? 100 : 0), this.snapshot(a, e), a.delay);
          e.removeStatus('meisui');
          return;
        case 'bunshin':
          this.ninki(e, -a.ninkiCost);
          e.addStatus('bunshin', 30, { stacks: 5 });
          e.addStatus('phantomKamaitachiReady', V.pkStack ? 30 : 45);
          return;
      }
      super.ability(id, e);
    }

    proc(id, e) {
      if (id === 'forkedRaiju') return e.has('raijuReady');
      if (id === 'fleetingRaiju') return e.has(this.V.raiju === 'chain' ? 'fleetingRaijuReady' : 'raijuReady');
      if (id === 'phantomKamaitachi') return e.has('phantomKamaitachiReady');
      return super.proc(id, e);
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 90 Ninja. Keep <b>Huton</b> up (15% faster weaponskills and auto-attacks, up to 60s): <b>Spinning Edge → Gust Slash → Armor Crush</b> (flank) adds 30s, <b>Aeolian Edge</b> (rear, ${V.ae[1] + 60}) is the damage finisher; <b>Huraijin</b> sets it again if it drops. Mudras on two charges into Ninjutsu: <b>Raiton</b> (650) readies <b>Raiju</b> ${V.raiju === 'chain' ? '(a Forked Raiju 400 → Fleeting Raiju 450 pair; up to three, 15s)' : '(560 on either button; up to three, 30s)'}, which any Spinning Edge combo weaponskill throws away; <b>Suiton</b> allows <b>Trick Attack</b> (${V.trick === 'personal' ? 'your own +10% for 15s' : '+5% damage taken for 15s'}). <b>Kassatsu</b> makes Hyoton <b>Hyosho Ranryu</b> (${V.hyosho.toLocaleString()}); <b>Ten Chi Jin</b> fires Fuma → Raiton → Suiton.</p>
<p>Ninki from the combo (+5 / +5 / +15), Raiju, <b>Mug</b> (+40${V.mugVuln ? ', and +5% damage taken for 20s' : ''}) and <b>Meisui</b> (+50, and a Bhavacakra 100 stronger) goes to <b>Bhavacakra</b> (${V.bhava}) and <b>Bunshin</b> (90s): five shadow hits (160) and <b>Phantom Kamaitachi</b> (${V.pk}${V.pkStack ? ', while Bunshin lasts, using one of its stacks' : ', within 45s'}).</p>
<h3>The opener (The Balance)</h3>
${seq([['ten'], ['chi'], ['jin'], ['suiton'], ['kassatsu'], 'spinningEdge', ['tincture'], 'gustSlash', ['mug'], ['bunshin'], 'phantomKamaitachi', ['trickAttack'], 'aeolianEdge', ['dreamWithinADream'], 'ten', 'jin', 'hyoshoRanryu', 'ten', 'chi', 'raiton', ['tenChiJin'], 'fumaShuriken', 'raiton', 'suiton', ['meisui'], 'forkedRaiju', ['bhavacakra'], 'fleetingRaiju', ['bhavacakra']])}
<p style="color:#a9a3b4">${V.label} numbers: Spinning Edge ${V.se}, Gust Slash ${V.gs[1]}, Aeolian Edge ${V.ae[1]} (${V.ae[1] + 60} rear), Armor Crush ${V.ac[1]} (${V.ac[1] + 60} flank), Huraijin 200, Raiju ${V.raijuPot.join(' / ')}, Fuma Shuriken 450, Raiton 650, Suiton 500, Hyosho Ranryu ${V.hyosho.toLocaleString()}, Doton ${V.doton[0]} × ${V.doton[1]}s, Trick Attack 300 / 400, Mug 150, Dream Within a Dream 3 × 150, Bhavacakra ${V.bhava} (+100 after Meisui), Phantom Kamaitachi ${V.pk}, Bunshin's shadow 160; auto-attacks 90 at 2.56s. Gear: The Balance's set for the tier (Dexterity ${V.stats.main.toLocaleString()}).</p>`;
    }
  }

  B.NinjaEW = NinjaEW;
  B.registerJob({
    id: 'nin', name: 'Ninja', abbr: 'NIN', role: 'melee', classJob: 30,
    versions: ['ew61', 'ew605', 'ew60'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new NinjaEW(v) })),
  });
})(window.BLM);

// Viper, Dawntrail 7.0–7.01 at level 100: the launch kit, before 7.05's rework. Built on the 7.05 class (vpr_dt.js).
// No Honed buffs: the second step-one button is Dread Fangs (140), which afflicts the target with Noxious Gnash (+10%
// to your damage against it, 20s a time up to 40s), as do Dreadwinder (450, Vicewinder's launch name), Dread Maw and
// Pit of Dread. Lower numbers across the kit: Stings 260, finishers 300 (+60 positional, +100 with their venom, which
// lasts 40s), Death Rattle 250, Coils 500, the Twin bites 100 / 150, Uncoiled Fury 600, Reawaken 700, the Generations
// 400 / 600, Ouroboros 1,050 and the Legacies 250. 7.01 only widened a few ranges. Game data at 7.0 and 7.01 (xivapi's
// datamining) and the Lodestone notes; gear is The Balance's launch pre-savage set at 2.48. ref: a scripted bot
// parses about 22,580 on this.
(function (B) {
  const DT = B.ViperDT;
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };
  const VENOMS = ['flankstungVenom', 'flanksbaneVenom', 'hindstungVenom', 'hindsbaneVenom'];
  const GNASH = 1.10;

  class ViperDT70 extends DT {
    constructor() {
      super();
      const A = Object.assign({}, this.actions);
      set(A, 'steelFangs', { potency: 200, desc: 'Delivers an attack with a potency of 200.\n※This action cannot be assigned to a hotbar.\nSteel Fangs and Dread Fangs change to Hunter\'s Sting and Swiftskin\'s Sting.' });
      set(A, 'reavingFangs', { name: 'Dread Fangs', potency: 140, gnash: true, desc: 'Delivers an attack with a potency of 140.\nAdditional Effect: Afflicts target with Noxious Gnash, increasing your damage dealt to it by 10%\nDuration: 20s (extends up to 40s)' });
      for (const id of ['huntersSting', 'swiftskinsSting']) set(A, id, { potency: 260, desc: A[id].desc.replace('potency of 300', 'potency of 260') });
      for (const id of ['flankstingStrike', 'flanksbaneFang', 'hindstingStrike', 'hindsbaneFang']) set(A, id, { potency: 300, desc: A[id].desc.replace(/potency of 340/g, 'potency of 300').replace(/400/g, '360').replace(/440/g, '400').replace(/500/g, '460') });
      set(A, 'deathRattle', { potency: 250, desc: 'Delivers an attack with a potency of 250.\nCan only be executed after a dual-wield finisher.' });
      set(A, 'vicewinder', { name: 'Dreadwinder', potency: 450, gnash: true, desc: 'Delivers an attack with a potency of 450.\nAdditional Effect: Afflicts target with Noxious Gnash (+10% to your damage, 20s, up to 40s)\nAdditional Effect: Grants a Rattling Coil\nMaximum Charges: 2\nShares a recast timer with Pit of Dread.' });
      for (const id of ['huntersCoil', 'swiftskinsCoil']) set(A, id, { potency: 500, desc: A[id].desc.replace(/potency of 630/g, 'potency of 500').replace(/680/g, '550') });
      for (const id of ['twinfangBite', 'twinbloodBite', 'uncoiledTwinfang', 'uncoiledTwinblood']) set(A, id, { potency: 100, venomPotency: 150, desc: A[id].desc.replace(/120/g, '100').replace(/170/g, '150') });
      set(A, 'uncoiledFury', { potency: 600, aoe: 0.5, desc: 'Delivers a ranged attack with a potency of 600 to target and all enemies nearby it, 50% less for the rest.\nRattling Coil Cost: 1\nAdditional Effect: Grants Poised for Twinfang' });
      set(A, 'reawaken', { potency: 700, aoe: 0.4, desc: 'Delivers an attack with a potency of 700 to all nearby enemies, 60% less for the rest.\nAdditional Effect: Grants Reawakened and five Anguine Tribute\nSerpent Offerings Gauge Cost: 50' });
      for (const id of ['firstGeneration', 'secondGeneration', 'thirdGeneration', 'fourthGeneration']) set(A, id, { potency: 400, seqPotency: 600, aoe: 0.4, desc: A[id].desc.replace('480', '400').replace('680', '600') });
      set(A, 'ouroboros', { potency: 1050, aoe: 0.4, desc: 'Delivers an attack with a potency of 1,050 to target and all enemies nearby it, 60% less for the rest.\nCan only be executed after Fourth Generation.' });
      for (const id of ['firstLegacy', 'secondLegacy', 'thirdLegacy', 'fourthLegacy']) set(A, id, { potency: 250, aoe: 0.4, desc: A[id].desc.replace('320', '250') });
      set(A, 'steelMaw', { potency: 100 });
      set(A, 'reavingMaw', { name: 'Dread Maw', potency: 80, gnash: true, desc: 'Delivers an attack with a potency of 80 to all nearby enemies.\nAdditional Effect: Afflicts all enemies hit with Noxious Gnash (+10% to your damage, 20s, up to 40s)' });
      set(A, 'huntersBite', { potency: 120 });
      set(A, 'swiftskinsBite', { potency: 120 });
      set(A, 'jaggedMaw', { potency: 140, venomBonus: 20 });
      set(A, 'bloodiedMaw', { potency: 140, venomBonus: 20 });
      set(A, 'lastLash', { potency: 100 });
      set(A, 'vicepit', { name: 'Pit of Dread', potency: 200, gnash: true });
      set(A, 'huntersDen', { potency: 250 });
      set(A, 'swiftskinsDen', { potency: 250 });
      A.tincture = B.tincture('dexdt1');
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, { noxiousGnash: { name: 'Noxious Gnash', self: false, icon: 'st_venom' } });
      this.selfStatusOrder = this.selfStatusOrder.filter(k => k !== 'honedSteel' && k !== 'honedReavers');
      this.targetStatusOrder = ['noxiousGnash'].concat(this.targetStatusOrder || []);
      // The Balance's launch "Pre-Savage 2.48" set (141 weapon damage).
      this.stats = { hp: 129836, main: 4346, mainStat: 'dex', jobMod: 110, trait: 100, wd: 141, det: 2308, crit: 2158, dh: 2222, speed: 582, delay: 2.64 };
      this.referenceDps = 23940;
    }

    snapshot(a, e) {
      const mult = (e.has('huntersInstinct') ? 1.10 : 1) * (e.tHas('noxiousGnash') ? GNASH : 1);
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES.dexdt1.cap : 0);
      return { mult, main };
    }

    // Venoms last 40s at launch.
    venom(e, key, next) {
      for (const k of VENOMS) if (k !== next) e.removeStatus(k, true);
      if (key) e.removeStatus(key, true);
      if (next) e.addStatus(next, 40);
    }

    gnash(e) {
      const left = e.tHas('noxiousGnash') ? e.tStatuses.noxiousGnash.until - e.now : 0;
      e.addTStatus('noxiousGnash', Math.min(40, left + 20));
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      // Step one without the Honed buffs.
      if (a.honed) {
        g.tw = null;
        if (a.pbaoe) { g.aw = { stage: 1, until: e.now + 30 }; g.dw = null; } else { g.dw = { stage: 1, until: e.now + 30 }; g.aw = null; }
        if (a.gnash) this.gnash(e);
        e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
        return;
      }
      if (a.gnash) this.gnash(e);
      super.resolve(id, e);
      if (a.aoeFinisher) { const v = a.next; if (e.has(v)) e.addStatus(v, 40); }
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Dawntrail 7.0–7.01)</h3>
<p>Level 100 Viper at launch. The dual-wield combo: <b>Steel Fangs</b> (200) or <b>Dread Fangs</b> (140, and <b>Noxious Gnash</b> on the target: +10% to all your damage against it, 20s a time up to 40s), then <b>Hunter's Sting</b> (+10% damage) or <b>Swiftskin's Sting</b> (15% haste), 260 each, then the flank or rear finisher the venom cycle picks (300, +60 from the right side, +100 with its venom), which readies <b>Death Rattle</b> (250). Keep Noxious Gnash up with Dread Fangs and <b>Dreadwinder</b> (450, two charges, which also opens Hunter's and Swiftskin's <b>Coil</b>, 500 each, with their Twin bites).</p>
<p><b>Uncoiled Fury</b> (600) spends a Rattling Coil. At 50 Serpent Offerings (or after Serpent's Ire), <b>Reawaken</b> (700): First to Fourth Generation (400, 600 in order), each with its Legacy (250), then <b>Ouroboros</b> (1,050).</p>
<h3>The opener (The Balance, 7.0 "Tentative Standard")</h3>
${seq(['reavingFangs', ['serpentsIre'], 'swiftskinsSting', 'vicewinder', ['tincture'], 'huntersCoil', ['twinfangBite'], ['twinbloodBite'], 'swiftskinsCoil', ['twinbloodBite'], ['twinfangBite'], 'reawaken', 'firstGeneration', ['firstLegacy'], 'secondGeneration', ['secondLegacy'], 'thirdGeneration', ['thirdLegacy'], 'fourthGeneration', ['fourthLegacy'], 'ouroboros', 'uncoiledFury', ['uncoiledTwinfang'], ['uncoiledTwinblood']])}
<p style="color:#a9a3b4">The 7.0 numbers: Steel Fangs 200, Dread Fangs 140, Stings 260, finishers 300 / 360 / 400 / 460, Death Rattle 250, Dreadwinder 450, Coils 500 / 550, Twinfang / Twinblood Bite 100 / 150, Uncoiled Fury 600, Reawaken 700, Generations 400 / 600, Legacies 250, Ouroboros 1,050; auto-attacks 90 at 2.64s. Gear: The Balance's launch pre-savage set at 2.48 (Dexterity 4,346, 141 weapon damage), with a Grade 1 Gemdraught.</p>`;
    }
  }

  B.registerJob({
    id: 'vpr', name: 'Viper', abbr: 'VPR', role: 'melee', classJob: 41,
    versions: [{ id: 'dt70', label: 'Dawntrail 7.0–7.01', history: 'DT 7.0–7.01', note: 'The launch Viper: Dread Fangs and Dreadwinder for Noxious Gnash (+10% to your damage) instead of the Honed buffs, 40s venoms, lower potencies; pre-savage gear', create: () => new ViperDT70() }],
  });
})(window.BLM);

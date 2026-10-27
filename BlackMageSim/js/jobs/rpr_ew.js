// Reaper, Endwalker 6.0–6.58 at level 90: the launch kit. Built on the Dawntrail class (rpr_dt.js), without what 7.0
// added: Gluttony gives two Soul Reavers (no Executioner), Enshroud has no Oblatio or Sacrificium, Plentiful Harvest
// gives 50 Shroud instead of Ideal Host and Perfectio. Enshroud recasts in 15s. The 6.58 numbers (6.2 raised the Slice
// combo, 6.28 Communio, Plentiful Harvest and Lemure's Slice, 6.5 Gluttony and Lemure's Slice) from the game data at
// each patch and the Lodestone notes; gear is The Balance's 6.4 Anabaseios set at 2.49.
(function (B) {
  const DT = B.ReaperDT;
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };

  class ReaperEW extends DT {
    constructor() {
      super('dt70');
      this.V = Object.assign({}, this.V, { label: 'Endwalker 6.0–6.58', reaping: [460, 520], gluttony: 520, enshroudRecast: 15, tincture: 'str' });
      this.level = 90;
      this.levelKey = 90;
      this.model = 'rpr-dt';
      const A = Object.assign({}, this.actions);
      for (const k of ['executionersGibbet', 'executionersGallows', 'executionersGuillotine', 'sacrificium', 'perfectio']) delete A[k];
      set(A, 'slice', { potency: 320, desc: 'Delivers an attack with a potency of 320.\nAdditional Effect: Increases Soul Gauge by 10' });
      set(A, 'waxingSlice', { potency: 160, comboPotency: 400, desc: 'Delivers an attack with a potency of 160.\nCombo Action: Slice\nCombo Potency: 400\nCombo Bonus: Increases Soul Gauge by 10' });
      set(A, 'infernalSlice', { potency: 180, comboPotency: 500, desc: 'Delivers an attack with a potency of 180.\nCombo Action: Waxing Slice\nCombo Potency: 500\nCombo Bonus: Increases Soul Gauge by 10' });
      set(A, 'soulSlice', { potency: 460, desc: 'Delivers an attack with a potency of 460.\nAdditional Effect: Increases Soul Gauge by 50\nMaximum Charges: 2' });
      for (const k of ['gibbet', 'gallows']) set(A, k, { potency: 400, enhanced: 460, desc: A[k].desc.replace('500', '400').replace(/560 \(620/, '460 (520').replace('\n560 when', '\n460 when') });
      for (const k of ['voidReaping', 'crossReaping']) set(A, k, { potency: 460, enhanced: 520, desc: A[k].desc.replace('540', '460').replace('600', '520') });
      set(A, 'unveiledGibbet', { potency: 400, desc: A.unveiledGibbet.desc.replace('440', '400') });
      set(A, 'unveiledGallows', { potency: 400, desc: A.unveiledGallows.desc.replace('440', '400') });
      set(A, 'lemuresSlice', { potency: 240, desc: 'Delivers an attack with a potency of 240.\nVoid Shroud Cost: 2' });
      set(A, 'harvestMoon', { potency: 600, desc: 'Delivers an attack with a potency of 600 to target and all enemies nearby it.\nAdditional Effect: Increases Soul Gauge by 10\nCan only be executed while under the effect of Soulsow.' });
      set(A, 'gluttony', { potency: 520, desc: 'Delivers an attack with a potency of 520 to target and all enemies nearby it.\nAdditional Effect: Grants 2 stacks of Soul Reaver\nDuration: 30s\nSoul Gauge Cost: 50' });
      set(A, 'plentifulHarvest', { desc: 'Delivers an attack with a potency of 720 (+40 per Immortal Sacrifice stack after the first, up to 1,000) to target and all enemies nearby it, 60% less for the rest.\nAdditional Effect: Increases Shroud Gauge by 50\nCan only be executed while under the effect of Immortal Sacrifice, after Bloodsown Circle ends.' });
      set(A, 'enshroud', { recast: 15, desc: 'Grants Enshrouded and 5 stacks of Lemure Shroud.\nDuration: 30s\nShroud Gauge Cost: 50\nRecast: 15s\nWhile Enshrouded, Gibbet and Gallows become Void and Cross Reaping, Blood Stalk Lemure\'s Slice and Enshroud Communio.' });
      A.tincture = B.tincture('str');
      this.actions = A;
      this.stats = Object.assign({}, this.stats, { main: 3379, wd: 132, det: 1762, crit: 2567, dh: 1468, speed: 436, hp: 80000 });
      this.defaultBars = this.defaultBars.map(r => r.map(id => (id && A[id] ? id : null)));
      this.actionGroups = this.actionGroups.map(([n, ids]) => [n, ids.filter(id => A[id])]);
      this.referenceDps = 13390;     // a scripted 6.4 rotation on this gear parses about 12,630 on the dummy
    }

    resolveId(id, e) {
      const r = super.resolveId(id, e);
      return this.actions[r] ? r : id;
    }

    resolve(id, e) {
      const a = this.actions[id];
      if (id === 'gluttony') {
        this.soul(e, -50);
        e.addStatus('soulReaver', 30, { stacks: 2 });
        e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
        return;
      }
      if (id === 'plentifulHarvest') {
        e.removeStatus('immortalSacrifice');
        this.shroud(e, 50);
        e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
        return;
      }
      super.resolve(id, e);
      if (id === 'enshroud') e.removeStatus('oblatio', true);
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Endwalker 6.0–6.58)</h3>
<p>Level 90 Reaper, the launch kit. Keep <b>Death's Design</b> up with <b>Shadow of Death</b> (+10% to all your damage). <b>Slice → Waxing Slice → Infernal Slice</b> and <b>Soul Slice</b> build Soul; at 50, <b>Blood Stalk</b> (or Unveiled Gibbet / Gallows) gives one Soul Reaver and <b>Gluttony</b> (60s) two, for <b>Gibbet</b> (flank) and <b>Gallows</b> (rear), each enhancing the other and adding 10 Shroud.</p>
<p>At 50 Shroud, <b>Enshroud</b> (15s recast): alternate <b>Void</b> and <b>Cross Reaping</b> (460, 520 enhanced), <b>Lemure's Slice</b> for every two, and <b>Communio</b> (1,100) to finish. <b>Arcane Circle</b> (+3%, 120s) leads to <b>Plentiful Harvest</b> (720 alone), which gives 50 Shroud for the second Enshroud of the two-minute window.</p>
<h3>The opener (The Balance, early Enshroud)</h3>
${seq(['harpe', 'shadowOfDeath', ['arcaneCircle'], 'soulSlice', 'soulSlice', ['tincture'], 'plentifulHarvest', ['enshroud'], 'voidReaping', 'crossReaping', ['lemuresSlice'], 'voidReaping', 'crossReaping', ['lemuresSlice'], 'communio', ['gluttony'], 'gibbet', 'gallows', ['unveiledGibbet'], 'gibbet'])}
<p style="color:#a9a3b4">The 6.58 numbers: Slice 320, Waxing 400, Infernal 500 in combo, Shadow of Death 300, Soul Slice 460, Gibbet / Gallows 400 (460 positional or enhanced, 520 both), Blood Stalk 340, Unveiled 400, Gluttony 520, Void / Cross Reaping 460 / 520, Lemure's Slice 240, Communio 1,100, Plentiful Harvest 720 (one Immortal Sacrifice stack alone), Harvest Moon 600; auto-attacks 90 at 3.20s. Gear: The Balance's 6.4 set (Strength 3,379); shown in the Dawntrail Reaper's model.</p>`;
    }
  }

  B.registerJob({
    id: 'rpr', name: 'Reaper', abbr: 'RPR', role: 'melee', classJob: 39,
    versions: [{ id: 'ew60', label: 'Endwalker 6.0–6.58', history: 'EW 6.0–6.58', note: 'Level 90, the launch Reaper: Gluttony into two Soul Reavers, Enshroud on 15s with Void / Cross Reaping and Communio, Plentiful Harvest into 50 Shroud; Anabaseios gear', create: () => new ReaperEW() }],
  });
})(window.BLM);

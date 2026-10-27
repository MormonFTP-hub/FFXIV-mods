// Summoner, Stormblood 4.0–4.06 at level 70: Summon Bahamut's first months. Built on the 4.1–4.58 class
// (smn_sb.js) with what 4.1 and 4.2 changed: Ruin III was 150 and kept its cast in Dreadwyrm Trance, summons took 6s,
// Wyrmwave was 160 and Painflare 200. Numbers are the 4.06 game data (xivapi's datamining) and the wiki's patch
// histories.
(function (B) {
  const SB = B.SummonerSB;

  class SummonerSB40 extends SB {
    constructor() {
      super();
      const A = Object.assign({}, this.actions);
      const set = (id, o) => { A[id] = Object.assign({}, A[id], o); };
      set('ruin3', { potency: 150, desc: 'Deals unaspected damage with a potency of 150.' });
      set('summon', { cast: 6 });
      set('summon3', { cast: 6 });
      set('wyrmwave', { potency: 160 });
      set('painflare', { potency: 200, desc: 'Deals unaspected damage with a potency of 200 to target and all enemies nearby it.\nAetherflow Gauge Cost: 1\nAdditional Effect: Aethertrail Attunement +1' });
      set('dreadwyrmTrance', { desc: 'Increases magic damage dealt by 10% and reduces Ruin III\'s cast time.\nAdditional Effect: Resets Tri-disaster recast time\nAdditional Effect: Grants Dreadwyrm Aether when the effect ends\nCan only be executed while in possession of 3 stacks of Aethertrail Attunement.' });
      this.actions = A;
      this.cfg = Object.assign({}, this.cfg, { instantRuin3: false });
      this.referenceDps = 5600;
    }

    helpHtml(seq) {
      return super.helpHtml(seq).replace('How it plays (Stormblood 4.1–4.58)', 'How it plays (Stormblood 4.0–4.06)')
        .replace('16s of +10% magic damage, instant Ruin III', 'Dreadwyrm Trance: +10% magic damage, Ruin III still cast')
        + `<p style="color:#a9a3b4">4.0–4.06 differences: Ruin III 150 with its cast kept in Trance (4.1 made it instant and 130, 4.2 120), 6s summons (4.1 made them 3s), Wyrmwave 160 and Painflare 200 (4.2 lowered both).</p>`;
    }
  }

  B.registerJob({
    id: 'smn', name: 'Summoner', abbr: 'SMN', role: 'caster', classJob: 27,
    versions: [{ id: 'sb40', label: 'Stormblood 4.0–4.06', history: 'SB 4.0–4.06', note: 'Level 70. Summon Bahamut\'s debut: Ruin III 150 and cast even in Trance, 6s summons, Wyrmwave 160', create: () => new SummonerSB40() }],
  });
})(window.BLM);

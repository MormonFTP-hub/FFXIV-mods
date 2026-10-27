// Summoner, Stormblood 4.0–4.06 at level 70: Summon Bahamut's first months. Built on the 4.1–4.58 class
// (smn_sb.js) with what 4.1 and 4.2 changed: Ruin III was 150 and kept its cast in Dreadwyrm Trance (which only made
// it cheaper), Further Ruin turned Ruin III (not Ruin II) into a Ruin IV with a cast, Tri-bind had a 3s cast and no
// Trance bonus, summons took 6s and 2,400 MP, Devotion gave one party member 5%, Wyrmwave was 160 and Painflare 200.
// There's no 4.06 game data (xivapi's datamining starts at 4.11), so these come from 4.11's data, the wiki's
// pre-4.1 page revisions and the 4.1 and 4.2 patch-note histories.
(function (B) {
  const SB = B.SummonerSB;

  class SummonerSB40 extends SB {
    constructor() {
      super();
      const A = Object.assign({}, this.actions);
      const set = (id, o) => { A[id] = Object.assign({}, A[id], o); };
      set('ruin3', { potency: 150, mp: 480, desc: 'Deals unaspected damage with a potency of 150.\nRuin III changes to Ruin IV while under the effect of Further Ruin.\nDreadwyrm Trance Bonus: Reduces MP cost.' });
      set('ruin2', { desc: 'Deals unaspected damage with a potency of 100.' });
      set('ruin4', { cast: 2.5, desc: 'Deals unaspected damage with a potency of 200.\nCan only be executed while under the effect of Further Ruin.' });
      set('triBind', { cast: 3, trancePotency: 30, desc: 'Deals unaspected damage with a potency of 30 to target and all enemies nearby it.\nAdditional Effect: Bind\nDuration: 20s' });
      set('summon', { cast: 6, mp: 2400 });
      set('summon3', { cast: 6, mp: 2400 });
      set('wyrmwave', { potency: 160 });
      set('painflare', { potency: 200, desc: 'Deals unaspected damage with a potency of 200 to target and all enemies nearby it.\nAetherflow Gauge Cost: 1\nAdditional Effect: Aethertrail Attunement +1' });
      set('dreadwyrmTrance', { desc: 'Increases magic damage dealt by 10% while lowering the MP cost of Ruin III.\nDuration: 16s\nAdditional Effect: Resets Tri-disaster recast time\nAdditional Effect: Grants Dreadwyrm Aether when the effect ends\nCan only be executed while in possession of 3 stacks of Aethertrail Attunement.' });
      set('aetherpact', { desc: 'Orders pet to use Devotion: increases the attack and healing potency of the party member closest to the pet by 5%, and reduces their damage taken by 5%.\nDuration: 15s' });
      this.actions = A;
      this.cfg = Object.assign({}, this.cfg, { instantRuin3: false, devotion: 1.05 });
      this.referenceDps = 5850;     // a scripted 4.06 rotation parses about 5,500 on the dummy
    }

    // Further Ruin lights up Ruin III, not Ruin II.
    resolveId(id, e) { return id === 'ruin3' && e.has('furtherRuin') ? 'ruin4' : id; }

    // Trance only made Ruin III cheaper (by how much isn't recorded; half here), and did nothing for Tri-bind.
    mpCost(id, e) {
      const a = this.actions[id];
      if (id === 'ruin3' && e.has('dreadwyrmTrance')) return Math.round(a.mp / 2);
      return a.mp || 0;
    }

    helpHtml(seq) {
      return super.helpHtml(seq)
        .replace('How it plays (Stormblood 4.1–4.58)', 'How it plays (Stormblood 4.0–4.06)')
        .replace('gives 16s of +10% magic damage, instant Ruin III and a fresh Tri-disaster', 'gives 16s of +10% magic damage, cheaper Ruin III (still cast) and a fresh Tri-disaster')
        .replace('which turns Ruin II into <b>Ruin IV</b> (200, instant)', 'which turns Ruin III into <b>Ruin IV</b> (200, still a 2.5s cast)')
        + `<p style="color:#a9a3b4">What 4.1 and 4.2 changed from this version: Ruin III 150 → 130 → 120, cheaper, and instant in Trance; Ruin IV made instant and moved to Ruin II; Tri-bind 3s → 2.5s with a Trance bonus; summons 6s → 3s; Devotion made party-wide at 2%; Wyrmwave 160 → 150 and Painflare 200 → 180 (4.2). There's no 4.06 game data: Ruin III's MP here (480, half in Trance) is a reconstruction (the wiki's 1,440 can't be sustained for a single minute), and the egi numbers are 4.11's.</p>`;
    }
  }

  B.registerJob({
    id: 'smn', name: 'Summoner', abbr: 'SMN', role: 'caster', classJob: 27,
    versions: [{ id: 'sb40', label: 'Stormblood 4.0–4.06', history: 'SB 4.0–4.06', note: 'Level 70. Summon Bahamut\'s debut: Ruin III 150 and still cast in Trance, Ruin IV with a cast in place of Ruin III, 6s summons, Devotion 5% on one player', create: () => new SummonerSB40() }],
  });
})(window.BLM);

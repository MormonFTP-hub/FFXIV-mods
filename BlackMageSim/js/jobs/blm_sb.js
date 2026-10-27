// Black Mage, Stormblood (patches 4.2–4.58) at level 70. Built on the Shadowbringers class (blm_shb.js), which
// already has Enochian as a button. What changes before 5.0: a 13s Astral Fire / Umbral Ice, one Polyglot (spent on
// Foul; no Xenoglossy), no Despair or Umbral Soul, Convert instead of Manafont, a 60s Sharpcast, an 8s Transpose,
// Stormblood's level-based MP pool and costs, and the caster role-action pool. Level 70 uses Stormblood's formula
// (B.LEVELS.sb70). Numbers are the final 4.5x values (FFXIV wiki revisions from before 5.0; 4.x patch notes).
(function (B) {
  const ShB = B.BlackMageShB;

  class BlackMageSB extends ShB {
    constructor() {
      super();
      const S = B.BLM_SB;
      this.level = 70;
      this.levelKey = 'sb70';
      this.model = 'blm-sb';
      this.maxMp = S.maxMp;
      this.actions = S.actions();
      this.cfg = Object.assign({}, this.cfg, S.cfg);
      this.stats = S.stats;
      this.selfStatusOrder = ['enochian', 'circleOfPower', 'leyLines', 'triplecast', 'swiftcast', 'sharpcast', 'firestarter',
        'thundercloud', 'medicated', 'lucidDreaming', 'manaward', 'surecast', 'sprint'];
      this.defaultBars = [
        ['fire3', 'fire4', 'fire', 'blizzard3', 'blizzard4', 'blizzard', 'thunder3', 'foul', 'scathe', null, null, null],
        ['enochian', 'sharpcast', 'triplecast', 'swiftcast', 'leyLines', 'betweenTheLines', 'convert', 'transpose', 'lucidDreaming', 'tincture', 'addle', 'manaward'],
        ['surecast', 'sprint', null, null, null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Black Mage', ['fire', 'fire3', 'fire4', 'blizzard', 'blizzard3', 'blizzard4', 'thunder3', 'foul', 'scathe', 'enochian', 'transpose', 'sharpcast', 'triplecast', 'convert', 'leyLines', 'betweenTheLines', 'manaward']],
        ['Role Actions', ['swiftcast', 'lucidDreaming', 'addle', 'surecast']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = S.referenceDps;
      this.referenceGcd = S.referenceGcd;
      this.startDistance = 10;
    }

    check(id, e) {
      const g = e.g;
      if (id === 'foul' && !g.enochian) return 'Unable to execute action. Enochian required.';
      return super.check(id, e);
    }

    resolveAbility(id, e) {
      if (id === 'convert') {
        const before = e.mp;
        e.mp = Math.min(e.maxMp, e.mp + Math.floor(e.maxMp * this.cfg.convertMp));
        e.hp = Math.max(1, e.hp - Math.floor(e.maxHp * 0.2));
        e.emit('mpGain', { amount: e.mp - before, source: 'manafont' });
        return;
      }
      super.resolveAbility(id, e);
    }

    // MP costs in Stormblood were fixed numbers per spell at level 70 (from the table), with the same Astral Fire /
    // Umbral Ice rules.
    mpCost(id, e) { return super.mpCost(id, e); }

    proc(id, e) { return (id === 'fire3' && e.has('firestarter')) || (id === 'thunder3' && e.has('thundercloud')) || (id === 'enochian' && !e.g.enochian && e.g.element !== 0); }

    speedInfo(e) {
      return `Fire IV ${e.speedScale(this.actions.fire4.cast).toFixed(2)}s · Fire III ${e.speedScale(3.5).toFixed(2)}s · ${e.maxMp.toLocaleString()} MP`;
    }

    helpHtml(seq) { return B.BLM_SB.help(seq); }
  }

  B.registerJob({
    id: 'blm', name: 'Black Mage', abbr: 'BLM', role: 'caster', classJob: 25,
    versions: [{ id: 'sb42', label: 'Stormblood 4.2–4.58', history: 'SB 4.2–4.58', note: 'Level 70. One Polyglot for Foul, 13s Astral Fire, Convert, 60s Sharpcast, Enochian as a button, Stormblood MP', create: () => new BlackMageSB() }],
  });
})(window.BLM);

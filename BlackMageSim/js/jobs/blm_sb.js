// Black Mage, Stormblood (patches 4.2–4.58) at level 70. Built on the Shadowbringers class (blm_shb.js), which
// already has Enochian as a button. What changes before 5.0: a 13s Astral Fire / Umbral Ice, one Polyglot (spent on
// Foul; no Xenoglossy), no Despair or Umbral Soul, Convert instead of Manafont, a 60s Sharpcast, an 8s Transpose,
// Stormblood's level-based MP pool and costs, and the caster role-action pool. Level 70 uses Stormblood's formula
// (B.LEVELS.sb70). Numbers are the final 4.5x values (FFXIV wiki revisions from before 5.0; 4.x patch notes).
(function (B) {
  const ShB = B.BlackMageShB;

  // Stormblood's MP: a level-70 pool (12,000 × Black Mage's 129% MP modifier, with no Piety gear), costs from the
  // level-70 tooltips, and Umbral Ice ticks of about 32/47/62% of max MP.
  const MAX_MP = 15480;
  const AF_ICE = { 1: 0.5, 2: 0.25, 3: 0.25 };      // no free spells at three stacks until Aspect Mastery (5.0)
  const UI_FIRE = { 1: 0.5, 2: 0.25, 3: 0.25 };

  B.BLM_SB = {
    maxMp: MAX_MP,
    cfg: {
      enochian: 1.10, polyMax: 1, fsDur: 18, tcDur: 18, sharpDur: 15, tincture: 'int3sb', marker: 'ENOCHIAN',
      elementDur: 13, convertMp: 0.3, lucid: 960, baseRegen: Math.round(MAX_MP * 0.02),
      uiRegen: [0.32, 0.47, 0.62].map(k => Math.round(MAX_MP * k)),
    },
    // A rough 4.5 best-in-slot set (Alphascape item level 400–405, the Omega Rod) at the 2.40 GCD; level-70 stats.
    stats: { hp: 33000, main: 3300, mainStat: 'int', jobMod: 115, trait: 130, wd: 108, det: 1450, crit: 2350,
      dh: 1900, speed: 1040, delay: 3.28 },
    referenceDps: 6400,     // a scripted 4.5x rotation at 2.40 parses about 5,500–6,100 on the dummy
    referenceGcd: 2.4,
    actions() {
      const shb = new ShB().actions;
      const A = {};
      const keep = ['fire', 'blizzard', 'fire3', 'blizzard3', 'thunder3', 'fire4', 'blizzard4', 'foul', 'scathe', 'enochian',
        'transpose', 'sharpcast', 'triplecast', 'leyLines', 'betweenTheLines', 'manaward', 'swiftcast', 'addle', 'surecast', 'sprint'];
      for (const k of keep) A[k] = Object.assign({}, shb[k]);
      const set = (id, o) => { A[id] = Object.assign({}, A[id], o); };
      set('fire', { mp: 1200 });
      set('blizzard', { mp: 480 });
      set('fire3', { mp: 2400 });
      set('blizzard3', { mp: 1440 });
      set('thunder3', { mp: 1920 });
      set('fire4', { mp: 1200, potency: 300 });
      set('blizzard4', { mp: 960, potency: 260, desc: 'Deals ice damage with a potency of 260.\nAdditional Effect: Grants 3 Umbral Hearts\nUmbral Heart Bonus: Nullifies Astral Fire\'s MP cost increase for Fire spells and reduces MP cost for Flare by one-third\nCan only be executed while under the effects of both Umbral Ice and Enochian.' });
      set('foul', { desc: 'Deals unaspected damage to target and all enemies nearby it with a potency of 650 for the first enemy, and 10% less for each remaining enemy.\nCan only be executed while under the effect of Polyglot.' });
      set('scathe', { mp: 960 });
      set('enochian', { desc: 'Increases magic damage dealt by 10%. Also allows the casting of Blizzard IV and Fire IV.\nAdditional Effect: Grants Polyglot if Enochian is maintained for 30s\nCan only be executed while under the effect of Astral Fire or Umbral Ice. Effect is canceled if Astral Fire or Umbral Ice end.' });
      set('transpose', { recast: 8 });
      set('sharpcast', { recast: 60 });
      set('surecast', { recast: 30, desc: 'Spells can be cast without interruption.\nAdditional Effect: Nullifies most knockback and draw-in effects\nDuration: 5s' });
      A.convert = { name: 'Convert', kind: 'ogcd', recast: 180, desc: 'Sacrifices 20% of maximum HP to restore 30% of MP.\nCannot be executed while HP is below 20%.' };
      A.lucidDreaming = { name: 'Lucid Dreaming', kind: 'ogcd', recast: 120, role: true, desc: 'Reduces enmity by half.\nAdditional Effect: Refresh\nPotency: 80\nDuration: 21s' };
      A.tincture = B.tincture('int3sb');
      return A;
    },
    help(seq) {
      return `
<h3>How it plays (Stormblood 4.2–4.58)</h3>
<p>Level 70 Black Mage. <b>Enochian</b> is a button (30s recast): press it once you're in Astral Fire or Umbral Ice. It gives +10% damage and unlocks Fire IV and Blizzard IV, and it ends if the element drops. Astral Fire and Umbral Ice last only <b>13s</b> here, so Fire has to refresh it in the middle of every fire phase. Every 30s of Enochian gives a Polyglot, and you can hold only one, spent on <b>Foul</b> (650, 2.5s cast). There's no Despair, Xenoglossy or Umbral Soul yet.</p>
<p>MP works the Stormblood way: about 15,480 MP, and spells cost more. Fire IV costs 1,200 (2,400 in Astral Fire without Umbral Hearts), and Fire III from Umbral Ice III still costs a quarter. <b>Convert</b> trades 20% of your HP for 30% of your MP. Thunder III is 70 plus 40 a tick for 24s, and its Thundercloud procs last 18s, like Firestarter.</p>
<h3>Standard rotation</h3>
${seq(['blizzard3', 'blizzard4', 'fire3', 'fire4', 'fire4', 'fire4', 'fire', 'fire4', 'fire4', 'fire4', 'blizzard3'])}
<p>Refresh Thunder III in Umbral Ice. Use Foul before Polyglot would overcap. Convert after the last Fire IV buys another Fire IV or two.</p>
<h3>An opener for this version</h3>
${seq(['blizzard3', ['enochian'], 'thunder3', 'blizzard4', 'fire3', ['leyLines'], 'fire4', ['triplecast'], 'fire4', 'fire4', 'fire', ['sharpcast'], 'fire4', 'fire4', 'fire4', ['convert'], 'fire', 'fire4', 'blizzard3', 'blizzard4', 'foul'])}
<p>Blizzard III lands as the countdown ends, then Enochian. With a 13s timer, Fire IV never refreshes Astral Fire, so count your casts: after each Fire, three Fire IVs and then Blizzard III, or a Fire first if Convert gave you the MP. This follows the version's rules; it isn't copied from a published guide.</p>
<p style="color:#a9a3b4">The 4.5x numbers: Fire IV 300 (4.4), Fire III and Blizzard III 240, Blizzard IV 260, Foul 650, Thunder III 70 + 40 per tick for 24s, Enochian ×1.10, Astral Fire III ×1.8, 13s Astral Fire and Umbral Ice, Transpose 8s, Sharpcast 60s, Convert 180s. MP costs at level 70: Fire 1,200, Fire III 2,400, Fire IV 1,200, Blizzard 480, Blizzard III 1,440, Blizzard IV 960, Thunder III 1,920. Gear stats are approximate.</p>`;
    },
  };

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
      if (id === 'convert' && e.hp < e.maxHp * 0.2) return 'Unable to execute action. Not enough HP.';
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

    // Stormblood MP costs: Astral Fire doubles fire spells (Umbral Hearts cancel it); Umbral Ice halves or quarters
    // fire spells and Astral Fire does the same to ice spells, with nothing free at three stacks yet.
    mpCost(id, e) {
      const a = this.actions[id], el = e.g.element;
      if (id === 'thunder3') return e.has('thundercloud') ? 0 : a.mp;
      if (id === 'fire3' && e.has('firestarter')) return 0;
      if (!a.mp) return 0;
      if (a.school === 'fire') {
        if (el > 0) return e.g.hearts > 0 ? a.mp : a.mp * 2;
        if (el < 0) return Math.round(a.mp * UI_FIRE[-el]);
      }
      if (a.school === 'ice' && el > 0) return Math.round(a.mp * AF_ICE[el]);
      return a.mp;
    }

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

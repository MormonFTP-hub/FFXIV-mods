// Black Mage, Shadowbringers (patches 5.0–5.58) at level 80. Built on the Endwalker class (blm_ew.js), with what
// played differently before 6.0: Enochian is a button (30s recast, needs Astral Fire or Umbral Ice, lost when they
// drop, and Fire IV and Blizzard IV need it), Polyglot builds while Enochian is up, no Paradox or Amplifier, one
// charge each of Sharpcast and Triplecast, an 18s Firestarter and Thundercloud, and Foul still has a cast. Numbers
// are the final 5.5x values from the FFXIV wiki's patch histories.
(function (B) {
  const EW = B.BlackMageEW;

  const ACTIONS = {
    fire: {
      name: 'Fire', kind: 'gcd', school: 'fire', potency: 180, mp: 800, cast: 2.5, delay: 0.8, target: true,
      desc: 'Deals fire damage with a potency of 180.\nAdditional Effect: Grants Astral Fire or removes Umbral Ice\nDuration: 15s\nAdditional Effect: 40% chance next Fire III will cost no MP and have no cast time\nDuration: 18s',
    },
    blizzard: {
      name: 'Blizzard', kind: 'gcd', school: 'ice', potency: 180, mp: 400, cast: 2.5, delay: 0.8, target: true,
      desc: 'Deals ice damage with a potency of 180.\nAdditional Effect: Grants Umbral Ice or removes Astral Fire\nDuration: 15s',
    },
    fire3: {
      name: 'Fire III', kind: 'gcd', school: 'fire', potency: 240, mp: 2000, cast: 3.5, delay: 1.3, target: true,
      desc: 'Deals fire damage with a potency of 240.\nAdditional Effect: Grants Astral Fire III and removes Umbral Ice\nDuration: 15s',
    },
    blizzard3: {
      name: 'Blizzard III', kind: 'gcd', school: 'ice', potency: 240, mp: 800, cast: 3.5, delay: 0.9, target: true,
      desc: 'Deals ice damage with a potency of 240.\nAdditional Effect: Grants Umbral Ice III and removes Astral Fire\nDuration: 15s',
    },
    thunder3: {
      name: 'Thunder III', kind: 'gcd', school: 'thunder', potency: 70, mp: 400, cast: 2.5, delay: 0.8, target: true,
      dot: { potency: 50, duration: 24 },
      desc: 'Deals lightning damage with a potency of 70.\nAdditional Effect: Lightning damage over time\nPotency: 50\nDuration: 24s\nAdditional Effect: 10% chance after each tick that the next Thunder spell will add its full damage over time amount to its initial damage, have no cast time, and cost no MP\nDuration: 18s',
    },
    fire4: {
      name: 'Fire IV', kind: 'gcd', school: 'fire', potency: 300, mp: 800, cast: 2.8, delay: 1.16, target: true,
      desc: 'Deals fire damage with a potency of 300.\nCan only be executed while under the effects of both Astral Fire and Enochian.',
    },
    blizzard4: {
      name: 'Blizzard IV', kind: 'gcd', school: 'ice', potency: 300, mp: 800, cast: 2.5, delay: 1.16, target: true,
      desc: 'Deals ice damage with a potency of 300.\nAdditional Effect: Grants 3 Umbral Hearts\nUmbral Heart Bonus: Nullifies Astral Fire\'s MP cost increase for Fire spells and reduces MP cost for Flare by one-third\nCan only be executed while under the effects of both Umbral Ice and Enochian.',
    },
    despair: {
      name: 'Despair', kind: 'gcd', school: 'fire', potency: 380, mp: 800, cast: 3.0, delay: 0.56, target: true,
      desc: 'Deals fire damage with a potency of 380.\nAdditional Effect: Grants Astral Fire III\nDuration: 15s\nCan only be executed while under the effect of Astral Fire.\nRequires at least 800 MP and consumes all remaining MP.',
    },
    xenoglossy: {
      name: 'Xenoglossy', kind: 'gcd', school: 'none', potency: 750, mp: 0, cast: 0, delay: 0.63, target: true,
      desc: 'Deals unaspected damage with a potency of 750.\nPolyglot Cost: 1',
    },
    foul: {
      name: 'Foul', kind: 'gcd', school: 'none', potency: 650, mp: 0, cast: 2.5, delay: 1.16, target: true,
      desc: 'Deals unaspected damage to target and all enemies nearby it with a potency of 650 for the first enemy, and 10% less for all remaining enemies.\nPolyglot Cost: 1',
    },
    scathe: {
      name: 'Scathe', kind: 'gcd', school: 'none', potency: 100, mp: 800, cast: 0, delay: 0.67, target: true,
      desc: 'Deals unaspected damage with a potency of 100.\nAdditional Effect: 20% chance potency will double',
    },
    umbralSoul: {
      name: 'Umbral Soul', kind: 'gcd', school: 'none', potency: 0, mp: 0, cast: 0,
      desc: 'Grants Umbral Ice and 1 Umbral Heart.\nDuration: 15s\nCan only be executed while under the effects of both Umbral Ice and Enochian.',
    },
    enochian: {
      name: 'Enochian', kind: 'ogcd', recast: 30,
      desc: 'Increases magic damage dealt by 15%. Also allows the casting of Blizzard IV and Fire IV.\nAdditional Effect: Grants Polyglot if Enochian is maintained for 30s\nCan only be executed while under the effect of Astral Fire or Umbral Ice. Effect is canceled if Astral Fire or Umbral Ice end.',
    },
    transpose: {
      name: 'Transpose', kind: 'ogcd', recast: 5,
      desc: 'Swaps Astral Fire with a single Umbral Ice, or Umbral Ice with a single Astral Fire.\nDuration: 15s',
    },
    sharpcast: {
      name: 'Sharpcast', kind: 'ogcd', recast: 30,
      desc: 'Ensures the next Scathe, Fire, or Thunder spell cast will, for the first hit, trigger Scathe\'s additional effect, Firestarter, or Thundercloud.\nDuration: 15s',
    },
    triplecast: {
      name: 'Triplecast', kind: 'ogcd', recast: 60,
      desc: 'The next three spells will require no cast time.\nDuration: 15s',
    },
    manafont: {
      name: 'Manafont', kind: 'ogcd', recast: 180,
      desc: 'Restores 30% of maximum MP.',
    },
    leyLines: {
      name: 'Ley Lines', kind: 'ogcd', recast: 90,
      desc: 'Connects naturally occurring ley lines to create a circle of power which, while standing within it, reduces spell cast time and recast time, and auto-attack delay by 15%.\nDuration: 30s',
    },
    betweenTheLines: {
      name: 'Between the Lines', kind: 'ogcd', recast: 3,
      desc: 'Move instantly to Ley Lines drawn by you.\nCannot be executed while bound.',
    },
    manaward: {
      name: 'Manaward', kind: 'ogcd', recast: 120,
      desc: 'Creates a barrier that nullifies damage totaling up to 30% of maximum HP.\nDuration: 20s',
    },
    ...B.ROLE_ACTIONS.caster,
    ...B.GENERAL_ACTIONS,
    tincture: B.tincture('int4'),
  };

  class BlackMageShB extends EW {
    constructor() {
      super();
      this.level = 80;
      this.model = 'blm-shb';
      this.actions = ACTIONS;
      this.statuses = Object.assign({}, this.statuses, { enochian: { name: 'Enochian', self: true, icon: 'st_enochian' } });
      this.cfg = { enochian: 1.15, polyMax: 2, fsDur: 18, tcDur: 18, sharpDur: 15, manafont: 3000, tincture: 'int4', marker: 'ENOCHIAN' };
      // A rough 5.5 best-in-slot set (item level 535, Eden's Promise and augmented Crystarium); spell speed in Settings.
      this.stats = { hp: 52000, main: 2412, mainStat: 'int', jobMod: 115, trait: 130, wd: 120, det: 1636, crit: 2214,
        dh: 1448, speed: 1100, delay: 3.28 };
      this.selfStatusOrder = ['enochian', 'circleOfPower', 'leyLines', 'triplecast', 'swiftcast', 'sharpcast', 'firestarter',
        'thundercloud', 'medicated', 'lucidDreaming', 'manaward', 'surecast', 'sprint'];
      this.defaultBars = [
        ['fire3', 'fire4', 'despair', 'fire', 'blizzard3', 'blizzard4', 'blizzard', 'thunder3', 'xenoglossy', 'foul', 'umbralSoul', 'scathe'],
        ['enochian', 'sharpcast', 'triplecast', 'swiftcast', 'leyLines', 'betweenTheLines', 'manafont', 'transpose', 'lucidDreaming', 'tincture', 'addle', 'manaward'],
        ['surecast', 'sprint', null, null, null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Black Mage', ['fire', 'fire3', 'fire4', 'despair', 'blizzard', 'blizzard3', 'blizzard4', 'thunder3', 'xenoglossy', 'foul', 'scathe', 'umbralSoul', 'enochian', 'transpose', 'sharpcast', 'triplecast', 'manafont', 'leyLines', 'betweenTheLines', 'manaward']],
        ['Role Actions', ['swiftcast', 'lucidDreaming', 'addle', 'surecast']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 9000;
      this.referenceGcd = 2.4;
      this.startDistance = 10;
    }

    initGauge() { return Object.assign(super.initGauge(), { enochian: false }); }

    // No Paradox in Shadowbringers: Fire and Blizzard stay themselves.
    resolveId(id) { return id; }

    enochianActive(e) { return e.g.enochian; }
    markerOn(e) { return e.g.enochian; }

    check(id, e) {
      const g = e.g;
      switch (id) {
        case 'fire4': if (g.element <= 0 || !g.enochian) return g.element <= 0 ? 'Unable to execute action. Astral Fire required.' : 'Unable to execute action. Enochian required.'; break;
        case 'blizzard4': case 'umbralSoul': if (g.element >= 0 || !g.enochian) return g.element >= 0 ? 'Unable to execute action. Umbral Ice required.' : 'Unable to execute action. Enochian required.'; break;
        case 'enochian': if (g.element === 0) return 'Unable to execute action. Astral Fire or Umbral Ice required.'; break;
      }
      return super.check(id, e);
    }

    checkCompletion(id, e) {
      if ((id === 'fire4' || id === 'blizzard4') && !e.g.enochian) return 'Interrupted';
      return super.checkCompletion(id, e);
    }

    // Losing Astral Fire or Umbral Ice ends Enochian and its Polyglot timer.
    setElement(e, next) {
      super.setElement(e, next);
      const g = e.g;
      g.paradox = false;
      if (next === 0) this.dropEnochian(e);
      else if (!g.enochian) g.enoStart = null;
    }

    dropEnochian(e) {
      const g = e.g;
      if (g.enochian) { g.enochian = false; e.removeStatus('enochian'); }
      g.enoStart = null;
    }

    process(e) {
      super.process(e);
      if (e.g.element === 0 && e.g.enochian) this.dropEnochian(e);
    }

    resolveAbility(id, e) {
      if (id === 'enochian') {
        const g = e.g;
        if (!g.enochian) { g.enochian = true; g.enoStart = e.now; }
        e.addStatus('enochian', 1e9, { permanent: true });
        return;
      }
      super.resolveAbility(id, e);
    }

    // Thunder III is the only Thunder in this kit, so Sharpcast only proc Thundercloud from it (as in 6.x).
    proc(id, e) { return (id === 'fire3' && e.has('firestarter')) || (id === 'thunder3' && e.has('thundercloud')) || (id === 'enochian' && !e.g.enochian && e.g.element !== 0); }

    speedInfo(e) {
      return `Fire IV ${e.speedScale(2.8).toFixed(2)}s · Despair ${e.speedScale(3).toFixed(2)}s · Fire III ${e.speedScale(3.5).toFixed(2)}s`;
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Shadowbringers 5.0–5.58)</h3>
<p>The level 80 Black Mage many players call the job's best. <b>Enochian</b> is a button here: press it once you're in Astral Fire or Umbral Ice, and it stays up (+15% damage, and Fire IV and Blizzard IV unlocked) until the element drops. Let Astral Fire or Umbral Ice run out and Enochian goes with it. Then you're stuck with no Fire IV until you get back into an element and its 30s recast is ready. Every 30s of Enochian gives a Polyglot (max 2) for Xenoglossy or Foul.</p>
<p>No Paradox or Amplifier yet, and Sharpcast and Triplecast have one charge each. Firestarter and Thundercloud last only 18s, so use them quickly. Foul still has a 2.5s cast; Xenoglossy is instant. Thunder III's DoT lasts 24s.</p>
<h3>Standard rotation</h3>
${seq(['blizzard3', 'blizzard4', 'fire3', 'fire4', 'fire4', 'fire4', 'fire', 'fire4', 'fire4', 'fire4', 'despair'])}
<p>Fire (once in the middle) refreshes Astral Fire's 15s timer. Keep Thunder III up, using Thundercloud procs when they come. Use Xenoglossy for movement or before Polyglot overcaps, and Manafont after Despair for another Fire IV and Despair.</p>
<h3>A typical 5.x opener</h3>
${seq(['fire3', ['enochian'], 'thunder3', 'fire4', ['triplecast'], 'fire4', 'fire4', 'fire4', ['leyLines'], 'fire4', ['sharpcast'], 'fire', 'fire4', 'fire4', 'despair', ['manafont'], 'fire4', 'despair', 'blizzard3', 'blizzard4', 'thunder3', 'fire3'])}
<p>Start Fire III so it lands as the countdown ends, and press Enochian straight after. Stand in Ley Lines for the 15% cast and GCD speed.</p>
<p style="color:#a9a3b4">The 5.5 numbers: Fire IV 300, Despair 380, Xenoglossy 750, Foul 650, Fire III and Blizzard III 240, Thunder III 70 + 50 per tick for 24s, Astral Fire III ×1.8, Enochian ×1.15, Manafont +3000 MP (180s), Ley Lines 90s.</p>`;
    }
  }

  B.registerJob({
    id: 'blm', name: 'Black Mage', abbr: 'BLM', role: 'caster', classJob: 25,
    versions: [{ id: 'shb', label: 'Shadowbringers 5.0–5.58', history: 'ShB 5.0–5.58', note: 'Enochian as a button, Xenoglossy 750, Despair 380, one-charge Sharpcast and Triplecast, level 80', create: () => new BlackMageShB() }],
  });
})(window.BLM);

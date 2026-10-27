// Black Mage, Endwalker (patch 6.5x) at level 90: actions, the Elemental Gauge, MP rules, procs, the gauge display
// and the help page. Numbers from the FFXIV wiki's patch histories (consolegameswiki). Older Black Mage versions
// (blm_shb.js) extend this class: they swap the action table and this.cfg and override what played differently.
(function (B) {
  const FIRE_MULT = { 1: 1.4, 2: 1.6, 3: 1.8, '-1': 0.9, '-2': 0.8, '-3': 0.7 };
  const ICE_MULT = { 1: 0.9, 2: 0.8, 3: 0.7 };
  const AF_ICE_COST = { 1: 0.5, 2: 0.25, 3: 0 };
  const UI_FIRE_COST = { 1: 0.5, 2: 0.25, 3: 0 };
  const ELEMENT_DURATION = 15;
  const POLYGLOT_TIME = 30;
  const UI_REGEN = [3200, 4700, 6200];
  const EPS = 1e-6;

  // kind: gcd | ogcd | item. school drives Astral Fire / Umbral Ice math. delay: when the hit lands after the
  // spell resolves. fx: which effect the scene plays on the dummy (defaults to the id).
  const ACTIONS = {
    fire: {
      name: 'Fire', kind: 'gcd', school: 'fire', potency: 180, mp: 800, cast: 2.5, delay: 0.8, target: true,
      desc: 'Deals fire damage with a potency of 180.\nAdditional Effect: Grants Astral Fire or removes Umbral Ice\nDuration: 15s\nAdditional Effect: 40% chance next Fire III will cost no MP and have no cast time\nDuration: 30s',
    },
    blizzard: {
      name: 'Blizzard', kind: 'gcd', school: 'ice', potency: 180, mp: 400, cast: 2.5, delay: 0.8, target: true,
      desc: 'Deals ice damage with a potency of 180.\nAdditional Effect: Grants Umbral Ice or removes Astral Fire\nDuration: 15s',
    },
    fire3: {
      name: 'Fire III', kind: 'gcd', school: 'fire', potency: 260, mp: 2000, cast: 3.5, delay: 1.3, target: true,
      desc: 'Deals fire damage with a potency of 260.\nAdditional Effect: Grants Astral Fire III and removes Umbral Ice\nDuration: 15s',
    },
    blizzard3: {
      name: 'Blizzard III', kind: 'gcd', school: 'ice', potency: 260, mp: 800, cast: 3.5, delay: 0.9, target: true,
      desc: 'Deals ice damage with a potency of 260.\nAdditional Effect: Grants Umbral Ice III and removes Astral Fire\nDuration: 15s',
    },
    thunder3: {
      name: 'Thunder III', kind: 'gcd', school: 'thunder', potency: 50, mp: 400, cast: 2.5, delay: 0.8, target: true,
      thunder: true, tcChance: 0.1, dot: { potency: 35, duration: 30 },
      desc: 'Deals lightning damage with a potency of 50.\nAdditional Effect: Lightning damage over time\nPotency: 35\nDuration: 30s\nAdditional Effect: 10% chance after each tick that the next Thunder spell will add its full damage over time amount to its initial damage, have no cast time, and cost no MP\nDuration: 40s\nOnly one Thunder spell-induced damage over time effect per caster can be inflicted upon a single target.',
    },
    fire4: {
      name: 'Fire IV', kind: 'gcd', school: 'fire', potency: 310, mp: 800, cast: 2.8, delay: 1.16, target: true,
      desc: 'Deals fire damage with a potency of 310.\nCan only be executed while under the effect of Astral Fire.',
    },
    blizzard4: {
      name: 'Blizzard IV', kind: 'gcd', school: 'ice', potency: 310, mp: 800, cast: 2.5, delay: 1.16, target: true,
      desc: 'Deals ice damage with a potency of 310.\nAdditional Effect: Grants 3 Umbral Hearts\nUmbral Heart Bonus: Nullifies Astral Fire\'s MP cost increase for Fire spells and reduces MP cost for Flare by one-third\nCan only be executed while under the effect of Umbral Ice.',
    },
    despair: {
      name: 'Despair', kind: 'gcd', school: 'fire', potency: 340, mp: 800, cast: 3.0, delay: 0.56, target: true,
      desc: 'Deals fire damage with a potency of 340.\nAdditional Effect: Grants Astral Fire III\nDuration: 15s\nCan only be executed while under the effect of Astral Fire.\nRequires at least 800 MP and consumes all remaining MP.',
    },
    paradox: {
      name: 'Paradox', kind: 'gcd', school: 'none', potency: 500, mp: 1600, cast: 2.5, delay: 0.62, target: true,
      desc: 'Deals unaspected damage with a potency of 500.\nAstral Fire Bonus: Extends Astral Fire duration to maximum. 40% chance next Fire III will cost no MP and have no cast time.\nUmbral Ice Bonus: Cast immediately, costs no MP, and extends Umbral Ice duration to maximum.\nOnly available while the Paradox marker is active.',
    },
    xenoglossy: {
      name: 'Xenoglossy', kind: 'gcd', school: 'none', potency: 880, mp: 0, cast: 0, delay: 0.63, target: true,
      desc: 'Deals unaspected damage with a potency of 880.\nPolyglot Cost: 1',
    },
    foul: {
      name: 'Foul', kind: 'gcd', school: 'none', potency: 600, mp: 0, cast: 0, delay: 1.16, target: true, aoe: 0.4,
      desc: 'Deals unaspected damage to target and all enemies nearby it with a potency of 600 for the first enemy, and 60% less for all remaining enemies.\nPolyglot Cost: 1',
    },
    scathe: {
      name: 'Scathe', kind: 'gcd', school: 'none', potency: 100, mp: 800, cast: 0, delay: 0.67, target: true,
      desc: 'Deals unaspected damage with a potency of 100.\nAdditional Effect: 20% chance potency will double',
    },
    // AoE (6.5x): High Fire II and High Blizzard II set the element at three stacks, Freeze needs Umbral Ice and
    // gives an Umbral Heart, Flare needs Astral Fire and spends all MP (a third less with Umbral Hearts, which it
    // uses up), and Thunder IV's DoT replaces Thunder III's.
    highFire2: {
      name: 'High Fire II', kind: 'gcd', school: 'fire', potency: 140, mp: 1500, cast: 3, delay: 1.0, target: true, aoe: true, look: 'fire3',
      desc: 'Deals fire damage with a potency of 140 to target and all enemies nearby it.\nAdditional Effect: Grants Astral Fire III and removes Umbral Ice\nDuration: 15s\nAstral Fire Bonus: Grants Enhanced Flare\nEffect is canceled if Astral Fire ends.',
    },
    highBlizzard2: {
      name: 'High Blizzard II', kind: 'gcd', school: 'ice', potency: 140, mp: 800, cast: 3, delay: 1.0, target: true, aoe: true, look: 'blizzard3',
      desc: 'Deals ice damage with a potency of 140 to target and all enemies nearby it.\nAdditional Effect: Grants Umbral Ice III and removes Astral Fire\nDuration: 15s',
    },
    freeze: {
      name: 'Freeze', kind: 'gcd', school: 'ice', potency: 120, mp: 1000, cast: 2.8, delay: 1.0, target: true, aoe: true, look: 'blizzard4',
      grantsUI3: true, hearts: 1, needsUI: true,
      desc: 'Deals ice damage with a potency of 120 to target and all enemies nearby it.\nAdditional Effect: Grants Umbral Ice III and removes Astral Fire\nDuration: 15s\nAdditional Effect: Grants 1 Umbral Heart\nUmbral Heart Bonus: Nullifies Astral Fire\'s MP cost increase for Fire spells and reduces MP cost for Flare by one-third\nCan only be executed while under the effect of Umbral Ice.',
    },
    flare: {
      name: 'Flare', kind: 'gcd', school: 'fire', potency: 220, enhancedPotency: 280, mp: 800, cast: 4, delay: 1.1, target: true, aoe: 0.6, look: 'despair',
      needsAF: true,
      desc: 'Deals fire damage to a target and all enemies nearby it with a potency of 220 for the first enemy, and 40% less for all remaining enemies.\nEnhanced Flare Potency: 280\nAdditional Effect: Grants Astral Fire III\nDuration: 15s\nCan only be executed while under the effect of Astral Fire.\nRequires at least 800 MP and consumes all remaining MP.',
    },
    thunder4: {
      name: 'Thunder IV', kind: 'gcd', school: 'thunder', potency: 50, mp: 800, cast: 2.5, delay: 0.8, target: true, aoe: true, look: 'thunder3',
      thunder: true, tcChance: 0.03, dot: { potency: 20, duration: 18, aoe: true },
      desc: 'Deals lightning damage with a potency of 50 to target and all enemies nearby it.\nAdditional Effect: Lightning damage over time\nPotency: 20\nDuration: 18s\nAdditional Effect: 3% chance after each tick that the next Thunder spell of any grade will add its full damage over time amount to its initial damage, have no cast time, and cost no MP\nDuration: 40s\nOnly one Thunder spell-induced damage over time effect per caster can be inflicted upon a single target.',
    },
    umbralSoul: {
      name: 'Umbral Soul', kind: 'gcd', school: 'none', potency: 0, mp: 0, cast: 0,
      desc: 'Grants Umbral Ice and 1 Umbral Heart.\nDuration: 15s\nCan only be executed while under the effect of Umbral Ice.',
    },
    transpose: {
      name: 'Transpose', kind: 'ogcd', recast: 5,
      desc: 'Swaps Astral Fire with a single Umbral Ice, or Umbral Ice with a single Astral Fire.\nDuration: 15s',
    },
    sharpcast: {
      name: 'Sharpcast', kind: 'ogcd', recast: 30, charges: 2,
      desc: 'Ensures the next Scathe, Fire, Paradox, or Thunder spell cast will, for the first hit, trigger Scathe\'s additional effect, Firestarter, or Thundercloud.\nDuration: 30s\nMaximum Charges: 2',
    },
    triplecast: {
      name: 'Triplecast', kind: 'ogcd', recast: 60, charges: 2,
      desc: 'The next three spells will require no cast time.\nDuration: 15s\nMaximum Charges: 2',
    },
    manafont: {
      name: 'Manafont', kind: 'ogcd', recast: 120,
      desc: 'Restores 30% of maximum MP.',
    },
    amplifier: {
      name: 'Amplifier', kind: 'ogcd', recast: 120,
      desc: 'Grants a Polyglot.\nCan only be executed while under the effect of Astral Fire or Umbral Ice.',
    },
    leyLines: {
      name: 'Ley Lines', kind: 'ogcd', recast: 120,
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
    tincture: B.tincture('int'),
  };

  const STATUSES = {
    firestarter: { name: 'Firestarter', self: true, icon: 'st_firestarter' },
    thundercloud: { name: 'Thundercloud', self: true, icon: 'st_thundercloud' },
    sharpcast: { name: 'Sharpcast', self: true, icon: 'st_sharpcast' },
    triplecast: { name: 'Triplecast', self: true, icon: 'st_triplecast' },
    leyLines: { name: 'Ley Lines', self: true, icon: 'st_leylines' },
    circleOfPower: { name: 'Circle of Power', self: true, icon: 'st_circle' },
    manaward: { name: 'Manaward', self: true, icon: 'st_manaward' },
    thunder3: { name: 'Thunder III', self: false, icon: 'st_thunder3' },
    thunder4: { name: 'Thunder IV', self: false, icon: 'st_thunder4' },
  };

  class BlackMageEW {
    constructor() {
      this.name = 'Black Mage';
      this.abbr = 'BLM';
      this.role = 'caster';
      this.actions = ACTIONS;
      this.statuses = STATUSES;
      // What older versions change: Enochian's bonus (Enhanced Enochian III after 6.4), Polyglot cap, proc and
      // Sharpcast durations, Manafont's MP, the tincture, and the label on the gauge's marker.
      this.cfg = { enochian: 1.23, polyMax: 2, fsDur: 30, tcDur: 40, sharpDur: 30, manafont: 3000, tincture: 'int', marker: 'PARADOX', lucid: B.LUCID_REGEN };
      // Rough 6.5 best-in-slot stats; spell speed is typed in Settings.
      this.stats = { hp: 74210, main: 3375, mainStat: 'int', jobMod: 115, trait: 130, wd: 132, det: 1886, crit: 2541,
        dh: 1435, speed: 1160, delay: 3.28 };
      this.speedName = 'Spell speed';
      this.selfStatusOrder = ['circleOfPower', 'leyLines', 'triplecast', 'swiftcast', 'sharpcast', 'firestarter',
        'thundercloud', 'medicated', 'lucidDreaming', 'manaward', 'surecast', 'sprint'];
      this.targetStatusOrder = ['thunder3', 'thunder4', 'addle'];
      this.defaultBars = [
        ['fire3', 'fire4', 'despair', 'fire', 'blizzard3', 'blizzard4', 'blizzard', 'thunder3', 'xenoglossy', 'foul', 'umbralSoul', 'scathe'],
        ['sharpcast', 'triplecast', 'swiftcast', 'leyLines', 'betweenTheLines', 'amplifier', 'manafont', 'transpose', 'lucidDreaming', 'tincture', 'addle', 'manaward'],
        ['surecast', 'sprint', 'highBlizzard2', 'freeze', 'thunder4', 'highFire2', 'flare', null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Black Mage', ['fire', 'fire3', 'fire4', 'despair', 'blizzard', 'blizzard3', 'blizzard4', 'thunder3', 'paradox', 'xenoglossy', 'foul', 'scathe', 'umbralSoul',
          'highFire2', 'highBlizzard2', 'freeze', 'flare', 'thunder4', 'transpose', 'sharpcast', 'triplecast', 'manafont', 'amplifier', 'leyLines', 'betweenTheLines', 'manaward']],
        ['Role Actions', ['swiftcast', 'lucidDreaming', 'addle', 'surecast']],
        ['General', ['sprint', 'tincture']],
      ];
      // A scripted bot playing the 6.x loop averages ~13.5k at 2.37 over 5 minutes.
      this.referenceDps = 14300;
      this.referenceGcd = 2.37;
      this.startDistance = 10;
    }

    initGauge() {
      return { element: 0, elementUntil: 0, hearts: 0, polyglot: 0, enoStart: null, paradox: false, enhancedFlare: false };
    }

    // Fire and Blizzard turn into Paradox while the marker is lit.
    resolveId(id, e) {
      if ((id === 'fire' || id === 'blizzard') && e.g.paradox) return 'paradox';
      return id;
    }

    haste(e) { return e.inCircle() ? 15 : 0; }

    castTime(id, e) {
      const a = this.actions[id], g = e.g;
      if (id === 'paradox' && g.element < 0) return 0;
      if (id === 'fire3' && e.has('firestarter')) return 0;
      if (a.thunder && e.has('thundercloud')) return 0;
      if (e.has('swiftcast') || e.has('triplecast')) return 0;
      let base = a.cast;
      if (a.school === 'fire' && g.element === -3) base /= 2;
      if (a.school === 'ice' && g.element === 3) base /= 2;
      return e.speedScale(base, this.haste(e));
    }

    mpCost(id, e) {
      const a = this.actions[id], el = e.g.element;
      switch (id) {
        case 'despair': return e.mp;
        case 'paradox': return el < 0 ? 0 : 1600;
        case 'flare': return this.flareCost(e);
        case 'fire3': if (e.has('firestarter')) return 0; break;
      }
      if (a.thunder) return e.has('thundercloud') ? 0 : a.mp;
      if (!a.mp) return 0;
      if (a.school === 'fire') {
        if (el > 0) return e.g.hearts > 0 ? a.mp : a.mp * 2;
        if (el < 0) return a.mp * UI_FIRE_COST[-el];
      }
      if (a.school === 'ice') {
        if (el > 0) return a.mp * AF_ICE_COST[el];
        if (el < 0) return 0;
      }
      return a.mp;
    }

    // Flare spends all MP, a third less while Umbral Hearts are up.
    flareCost(e) { return e.g.hearts > 0 ? Math.round(e.mp * 2 / 3) : e.mp; }

    check(id, e) {
      const g = e.g, a = this.actions[id];
      if (id === 'flare') {
        if (a.needsAF && g.element <= 0) return 'Unable to execute action. Astral Fire required.';
        if (e.mp < 800) return 'Not enough MP.';
      }
      if (id === 'freeze' && a.needsUI && g.element >= 0) return 'Unable to execute action. Umbral Ice required.';
      switch (id) {
        case 'fire4': if (g.element <= 0) return 'Unable to execute action. Astral Fire required.'; break;
        case 'despair':
          if (g.element <= 0) return 'Unable to execute action. Astral Fire required.';
          if (e.mp < 800) return 'Not enough MP.';
          break;
        case 'blizzard4': if (g.element >= 0) return 'Unable to execute action. Umbral Ice required.'; break;
        case 'umbralSoul': if (g.element >= 0) return 'Unable to execute action. Umbral Ice required.'; break;
        case 'paradox': if (!g.paradox) return 'Unable to execute action.'; break;
        case 'xenoglossy': case 'foul': if (g.polyglot < 1) return 'Unable to execute action. Polyglot required.'; break;
        case 'transpose': if (g.element === 0) return 'Unable to execute action.'; break;
        case 'amplifier': if (g.element === 0) return 'Unable to execute action. Astral Fire or Umbral Ice required.'; break;
        case 'betweenTheLines': if (!(e.leyLines && e.leyLines.until > e.now)) return 'Unable to execute action. Ley Lines required.'; break;
      }
      return null;
    }

    // The gauge or MP can change under a cast; the game cancels it at the end if so.
    checkCompletion(id, e) {
      const g = e.g;
      switch (id) {
        case 'fire4': case 'despair': if (g.element <= 0) return 'Interrupted'; break;
        case 'blizzard4': if (g.element >= 0) return 'Interrupted'; break;
        case 'paradox': if (!g.paradox) return 'Interrupted'; break;
      }
      if (e.mp < this.mpCost(id, e) || ((id === 'despair' || id === 'flare') && e.mp < 800)) return 'Not enough MP.';
      return null;
    }

    // Spells with a cast time that went off instantly eat the buff that made them instant.
    consumeInstant(id, e) {
      const a = this.actions[id];
      if (!a.cast) return;
      if (id === 'paradox' && e.g.element < 0) return;
      if (id === 'fire3' && e.has('firestarter')) return;       // eaten in resolve
      if (a.thunder && e.has('thundercloud')) return;   // eaten in resolve
      if (e.has('triplecast')) {
        const s = e.statuses.triplecast;
        s.stacks--;
        if (s.stacks <= 0) e.removeStatus('triplecast');
        else e.emit('statusStack', { key: 'triplecast' });
        return;
      }
      if (e.has('swiftcast')) e.removeStatus('swiftcast');
    }

    setElement(e, next) {
      const g = e.g, prev = g.element;
      // Aspect Mastery V: AF3 -> Umbral Ice, or UI3 with 3 hearts -> Astral Fire, lights Paradox.
      if (prev === 3 && next < 0) g.paradox = true;
      if (prev === -3 && g.hearts === 3 && next > 0) g.paradox = true;
      g.element = next;
      if (next <= 0) g.enhancedFlare = false;
      if (next === 0) {
        g.elementUntil = 0;
        g.enoStart = null;
      } else {
        g.elementUntil = e.now + (this.cfg.elementDur || ELEMENT_DURATION);
        if (prev === 0) g.enoStart = e.now;
      }
      if (prev !== next) e.emit('element', { prev, next });
    }

    // Enochian is up whenever there's Astral Fire or Umbral Ice in Endwalker (it was a button before 6.0).
    enochianActive(e) { return e.g.element !== 0; }

    snapshot(a, e) {
      const g = e.g;
      let mult = 1;
      if (this.enochianActive(e)) mult *= this.cfg.enochian;
      if (a.school === 'fire' && g.element !== 0) mult *= FIRE_MULT[g.element];
      if (a.school === 'ice' && g.element > 0) mult *= ICE_MULT[g.element];
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.cfg.tincture].cap : 0);
      return { mult, main };
    }

    resolve(id, e) {
      const a = this.actions[id];
      if (a.kind === 'gcd') this.resolveSpell(id, e);
      else this.resolveAbility(id, e);
    }

    resolveSpell(id, e) {
      const a = this.actions[id], g = e.g;
      const cost = this.mpCost(id, e);
      if (e.mp < cost) { e.emit('error', { msg: 'Not enough MP.' }); return; }
      // Hearts cover the doubled cost of fire spells under Astral Fire.
      if (a.school === 'fire' && id !== 'despair' && id !== 'flare' && g.element > 0 && g.hearts > 0 && cost > 0) {
        g.hearts--;
        e.emit('hearts', { n: g.hearts });
      }
      e.mp -= cost;

      const snap = this.snapshot(a, e);
      let potency = a.potency;
      const sharp = e.has('sharpcast');
      const procFirestarter = () => {
        if (sharp || Math.random() < 0.4) e.addStatus('firestarter', this.cfg.fsDur);
      };

      switch (id) {
        case 'fire':
          if (sharp) e.removeStatus('sharpcast');
          if (g.element < 0) this.setElement(e, 0);
          else this.setElement(e, Math.min(3, g.element + 1));
          procFirestarter();
          break;
        case 'blizzard':
          if (g.element > 0) this.setElement(e, 0);
          else this.setElement(e, Math.max(-3, g.element - 1));
          break;
        case 'fire3':
          if (e.has('firestarter')) e.removeStatus('firestarter');
          this.setElement(e, 3);
          break;
        case 'blizzard3':
          this.setElement(e, -3);
          break;
        case 'blizzard4':
          g.hearts = 3;
          e.emit('hearts', { n: 3 });
          break;
        case 'despair':
          this.setElement(e, 3);
          break;
        case 'paradox':
          g.paradox = false;
          if (g.element > 0) {
            g.elementUntil = e.now + (this.cfg.elementDur || ELEMENT_DURATION);
            if (sharp) e.removeStatus('sharpcast');
            procFirestarter();
          } else if (g.element < 0) {
            g.elementUntil = e.now + (this.cfg.elementDur || ELEMENT_DURATION);
          }
          e.emit('paradox', { active: false });
          break;
        case 'thunder3': case 'thunder4':
          if (e.has('thundercloud')) {
            e.removeStatus('thundercloud');
            potency += a.dot.potency * a.dot.duration / 3;
          }
          break;
        // Fire II and Blizzard II before 6.0 (and Freeze in Stormblood) move the element one step.
        case 'fire2':
          if (g.element < 0) this.setElement(e, 0);
          else this.setElement(e, Math.min(3, g.element + 1));
          break;
        case 'blizzard2':
          if (g.element > 0) this.setElement(e, 0);
          else this.setElement(e, Math.max(-3, g.element - 1));
          break;
        case 'highFire2': {
          const inFire = g.element > 0;
          this.setElement(e, 3);
          if (inFire) g.enhancedFlare = true;
          break;
        }
        case 'highBlizzard2':
          this.setElement(e, -3);
          break;
        case 'freeze':
          if (a.grantsUI3) {
            this.setElement(e, -3);
            g.hearts = Math.min(3, g.hearts + (a.hearts || 0));
            e.emit('hearts', { n: g.hearts });
          } else if (g.element > 0) this.setElement(e, 0);
          else this.setElement(e, Math.max(-3, g.element - 1));
          break;
        case 'flare':
          if (a.enhancedPotency && g.enhancedFlare) potency = a.enhancedPotency;
          g.enhancedFlare = false;
          if (g.hearts) { g.hearts = 0; e.emit('hearts', { n: 0 }); }
          this.setElement(e, 3);
          break;
        case 'xenoglossy': case 'foul':
          g.polyglot--;
          e.emit('polyglot', { n: g.polyglot });
          break;
        case 'scathe':
          if (sharp) e.removeStatus('sharpcast');
          if (sharp || Math.random() < 0.2) potency *= 2;
          break;
        case 'umbralSoul':
          this.setElement(e, Math.max(-3, g.element - 1));
          g.elementUntil = e.now + (this.cfg.elementDur || ELEMENT_DURATION);
          g.hearts = Math.min(3, g.hearts + 1);
          e.emit('hearts', { n: g.hearts });
          break;
      }

      if (a.thunder) {
        if (sharp) e.removeStatus('sharpcast');
        e.queueHit(id, potency, snap, a.delay, () => {
          // One Thunder DoT per caster: Thunder IV's replaces Thunder III's and the other way round.
          for (const k of Object.keys(e.tStatuses)) {
            if (k !== id && this.actions[k] && this.actions[k].thunder) { delete e.tStatuses[k]; e.emit('statusLose', { key: k, self: false }); }
          }
          e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } });
          if (sharp) e.addStatus('thundercloud', this.cfg.tcDur);
        });
      } else if (a.potency) {
        e.queueHit(id, potency, snap, a.delay);
      }
    }

    resolveAbility(id, e) {
      const g = e.g;
      switch (id) {
        case 'transpose':
          if (g.element > 0) this.setElement(e, -1);
          else if (g.element < 0) this.setElement(e, 1);
          return;
        case 'sharpcast': e.addStatus('sharpcast', this.cfg.sharpDur); return;
        case 'triplecast': e.addStatus('triplecast', 15, { stacks: 3 }); return;
        case 'manafont': {
          const before = e.mp;
          e.mp = Math.min(e.maxMp, e.mp + this.cfg.manafont);
          e.emit('mpGain', { amount: e.mp - before, source: 'manafont' });
          return;
        }
        case 'amplifier':
          g.polyglot = Math.min(this.cfg.polyMax, g.polyglot + 1);
          e.emit('polyglot', { n: g.polyglot });
          return;
        case 'leyLines':
          e.leyLines = { x: e.pos.x, z: e.pos.z, until: e.now + 30, start: e.now };
          e.addStatus('leyLines', 30);
          return;
        case 'betweenTheLines': {
          const from = { x: e.pos.x, z: e.pos.z };
          e.pos.x = e.leyLines.x; e.pos.z = e.leyLines.z;
          e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
          return;
        }
        case 'manaward': e.addStatus('manaward', 20); return;
      }
      if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
    }

    // MP on the next server tick: nothing in Astral Fire, a lot in Umbral Ice.
    mpRegen(e) {
      const el = e.g.element;
      if (el > 0) return 0;
      return el < 0 ? (this.cfg.uiRegen || UI_REGEN)[-el - 1] : (this.cfg.baseRegen || B.BASE_REGEN);
    }
    // Lucid Dreaming ticks on its own (the status tick) and, like every other MP gain, not in Astral Fire.
    lucidGain(e) { return e.g.element > 0 ? 0 : this.cfg.lucid; }
    mpTickNote(e) { return e.g.element > 0 ? 'no regen in Astral Fire' : null; }

    nextEvent(e) {
      const g = e.g;
      let t = Infinity;
      if (g.element !== 0) t = Math.min(t, g.elementUntil);
      if (g.enoStart !== null) t = Math.min(t, g.enoStart + POLYGLOT_TIME);
      return t;
    }

    process(e) {
      const g = e.g, now = e.now;
      // Element timer runs out: the gauge empties and Enochian progress resets.
      if (g.element !== 0 && now >= g.elementUntil - EPS) {
        const prev = g.element;
        g.element = 0; g.elementUntil = 0; g.enoStart = null;
        e.emit('element', { prev, next: 0, expired: true });
      }
      if (g.enoStart !== null && now >= g.enoStart + POLYGLOT_TIME - EPS) {
        g.enoStart += POLYGLOT_TIME;
        if (g.polyglot < this.cfg.polyMax) {
          g.polyglot++;
          e.emit('polyglot', { n: g.polyglot, gained: true });
        }
      }
    }

    onDotTick(key, e) {
      const a = this.actions[key];
      if (a && a.thunder && Math.random() < (a.tcChance || 0.1)) e.addStatus('thundercloud', this.cfg.tcDur);
    }

    frame(e) {
      const inside = e.inCircle();
      if (inside && !e.has('circleOfPower')) e.addStatus('circleOfPower', 999, { permanent: true });
      else if (!inside && e.statuses.circleOfPower) e.removeStatus('circleOfPower');
      if (e.statuses.circleOfPower) e.statuses.circleOfPower.until = e.now + 999;
    }

    // Hotbar borders: Firestarter on Fire III, Thundercloud on Thunder III, Paradox while lit.
    proc(id, e) {
      return (id === 'fire3' && e.has('firestarter')) || (this.actions[id].thunder && e.has('thundercloud')) || id === 'paradox' ||
        (id === 'flare' && e.g.enhancedFlare);
    }

    // Element colour for the scene (embers or snow around the mage).
    aura(e) { return e.g.element; }

    speedInfo(e) {
      return `Fire IV ${e.speedScale(2.8).toFixed(2)}s · Despair ${e.speedScale(3).toFixed(2)}s · Fire III ${e.speedScale(3.5).toFixed(2)}s`;
    }

    // ---------- Elemental Gauge ----------
    gaugeBuild(root) {
      const C = 2 * Math.PI * 78;
      this.enoC = C;
      const heart = 'M0 6 C-10 -2 -9 -12 -3 -12 C-1 -12 0 -10 0 -9 C0 -10 1 -12 3 -12 C9 -12 10 -2 0 6 Z';
      const cryst = 'M0 -16 L8 -2 L0 16 L-8 -2 Z';
      root.innerHTML = `
<svg width="360" height="220" viewBox="0 0 360 220">
  <defs>
    <radialGradient id="oAF" cx="45%" cy="38%" r="70%"><stop offset="0" stop-color="#ffe2a8"/><stop offset=".35" stop-color="#ff7a2a"/><stop offset="1" stop-color="#5a0b04"/></radialGradient>
    <radialGradient id="oUI" cx="45%" cy="38%" r="70%"><stop offset="0" stop-color="#eaffff"/><stop offset=".35" stop-color="#5fb8ff"/><stop offset="1" stop-color="#06204a"/></radialGradient>
    <radialGradient id="oNo" cx="45%" cy="38%" r="70%"><stop offset="0" stop-color="#5a5468"/><stop offset="1" stop-color="#121018"/></radialGradient>
    <linearGradient id="eno" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2d0ff"/><stop offset="1" stop-color="#8d3cff"/></linearGradient>
    <radialGradient id="poly" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#fbe9ff"/><stop offset=".5" stop-color="#b860ff"/><stop offset="1" stop-color="#3d0a6e"/></radialGradient>
    <linearGradient id="para" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7b7b"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#6fb8ff"/></linearGradient>
    <filter id="gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <path d="M110 18 L330 18 Q346 18 346 34 L346 184 Q346 200 330 200 L110 200" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <circle cx="110" cy="109" r="92" fill="#0b0912" stroke="rgba(230,196,122,.55)" stroke-width="2"/>
  <circle cx="110" cy="109" r="78" fill="none" stroke="#221b33" stroke-width="10"/>
  <circle id="g-eno" cx="110" cy="109" r="78" fill="none" stroke="url(#eno)" stroke-width="10" stroke-dasharray="0 ${C}" transform="rotate(-90 110 109)" filter="url(#gl)"/>
  <circle id="g-orb" cx="110" cy="109" r="64" fill="url(#oNo)" stroke="rgba(0,0,0,.8)" stroke-width="2"/>
  <g id="g-flame" opacity="0" transform="translate(110 100) scale(1.15)"><path d="M0 -38 C4 -26 18 -18 18 -2 C18 12 10 22 0 22 C-10 22 -18 12 -18 0 C-18 -10 -12 -14 -10 -22 C-7 -16 -5 -12 -3 -10 C-2 -20 -4 -28 0 -38 Z" fill="#fff4cf" opacity=".85"/></g>
  <g id="g-ice" opacity="0" transform="translate(110 100) scale(1.1)"><path d="M0 -38 L11 -6 L0 26 L-11 -6 Z" fill="#f2fdff" opacity=".9"/><path d="M-20 -14 L-11 -6 L-16 8 Z M20 -14 L11 -6 L16 8 Z" fill="#dff7ff" opacity=".7"/></g>
  <text id="g-time" class="eltime" x="110" y="122" text-anchor="middle"></text>
  ${[0, 1, 2].map(k => `<path id="g-stk${k}" d="M0 -10 L7 0 L0 10 L-7 0 Z" transform="translate(${82 + k * 28} ${k === 1 ? 187 : 182})" fill="#2a2535" stroke="rgba(0,0,0,.8)" stroke-width="1.5"/>`).join('')}
  ${[0, 1].map(k => `<g transform="translate(${226 + k * 36} 66)"><path id="g-poly${k}" d="${cryst}" fill="#251d33" stroke="rgba(255,255,255,.25)" stroke-width="1.5"/></g>`).join('')}
  <g transform="translate(314 66)"><rect id="g-para" x="-12" y="-12" width="24" height="24" transform="rotate(45)" fill="#251d33" stroke="rgba(255,255,255,.25)" stroke-width="1.5"/></g>
  ${[0, 1, 2].map(k => `<g transform="translate(${226 + k * 34} 152) scale(1.35)"><path id="g-ht${k}" d="${heart}" fill="#1c2233" stroke="rgba(255,255,255,.25)" stroke-width="1.1"/></g>`).join('')}
  <text x="244" y="104" text-anchor="middle" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">POLYGLOT</text>
  <text x="314" y="104" text-anchor="middle" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">${this.cfg.marker}</text>
  <text x="260" y="186" text-anchor="middle" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">UMBRAL HEARTS</text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.gg = {
        eno: $('#g-eno'), orb: $('#g-orb'), flame: $('#g-flame'), ice: $('#g-ice'), time: $('#g-time'),
        stk: [0, 1, 2].map(k => $('#g-stk' + k)), poly: [0, 1].map(k => $('#g-poly' + k)), para: $('#g-para'),
        ht: [0, 1, 2].map(k => $('#g-ht' + k)), cache: {},
      };
    }

    // The gauge's diamond: Paradox in Endwalker (older versions show Enochian there).
    markerOn(e) { return e.g.paradox; }

    gaugeUpdate(e) {
      const G = this.gg, c = G.cache, g = e.g;
      const el = g.element;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      put('orb', el > 0 ? 'af' : el < 0 ? 'ui' : 'no', v => G.orb.setAttribute('fill', v === 'af' ? 'url(#oAF)' : v === 'ui' ? 'url(#oUI)' : 'url(#oNo)'));
      put('fl', el > 0 ? 1 : 0, v => G.flame.setAttribute('opacity', v * 0.95));
      put('ic', el < 0 ? 1 : 0, v => G.ice.setAttribute('opacity', v * 0.95));
      const left = el !== 0 ? Math.max(0, g.elementUntil - e.now) : 0;
      put('t', el !== 0 ? String(Math.ceil(left - 1e-6)) : '', v => { G.time.textContent = v; });
      put('tc', left > 0 && left < 4 ? 'warn' : 'ok', v => G.time.setAttribute('fill', v === 'warn' ? '#ffd36b' : '#fff'));
      for (let k = 0; k < 3; k++) {
        const on = Math.abs(el) > k;
        put('s' + k, on ? (el > 0 ? 'f' : 'i') : 'n', v => {
          G.stk[k].setAttribute('fill', v === 'f' ? '#ff6a3d' : v === 'i' ? '#6cc6ff' : '#2a2535');
          G.stk[k].setAttribute('filter', v === 'n' ? '' : 'url(#gl)');
        });
        put('h' + k, g.hearts > k, v => { G.ht[k].setAttribute('fill', v ? '#8fd8ff' : '#1c2233'); G.ht[k].setAttribute('filter', v ? 'url(#gl)' : ''); });
      }
      for (let k = 0; k < 2; k++) put('p' + k, g.polyglot > k, v => { G.poly[k].setAttribute('fill', v ? 'url(#poly)' : '#251d33'); G.poly[k].setAttribute('filter', v ? 'url(#gl)' : ''); });
      put('para', this.markerOn(e), v => { G.para.setAttribute('fill', v ? 'url(#para)' : '#251d33'); G.para.setAttribute('filter', v ? 'url(#gl)' : ''); });
      const prog = g.enoStart !== null ? Math.min(1, (e.now - g.enoStart) / POLYGLOT_TIME) : 0;
      const dash = (prog * this.enoC).toFixed(1);
      put('eno', dash, v => G.eno.setAttribute('stroke-dasharray', `${v} ${this.enoC}`));
    }

    // ---------- help ----------
    helpHtml(seq) {
      return `
<h3>How it plays (Endwalker 6.5)</h3>
<p>Spells share a 2.5s GCD (faster with spell speed). Abilities like Triplecast and Manafont are oGCDs: weave them after instant spells. Fire spells cost double MP in Astral Fire unless you have Umbral Hearts. Astral Fire and Umbral Ice last 15s; let them drop and you lose Enochian (the 23% damage bonus) and the Polyglot timer resets. Every 30s in Enochian gives a Polyglot (max 2) for Xenoglossy.</p>
<p>Paradox lights up when you swap from Astral Fire III into ice, or from Umbral Ice III with 3 Umbral Hearts into fire. Fire and Blizzard become Paradox. In ice it's instant and free; in fire it refreshes Astral Fire and can proc Firestarter. Thunder III ticks can proc Thundercloud (instant Thunder III with the whole DoT added up front).</p>
<h3>Standard rotation</h3>
${seq(['blizzard3', 'blizzard4', 'paradox', 'fire3', 'fire4', 'fire4', 'fire4', 'paradox', 'fire4', 'fire4', 'fire4', 'despair'])}
<p>Keep Thunder III up (refresh around every 30s, ideally with Thundercloud), spend Polyglot on Xenoglossy before it overcaps, and use Sharpcast on Thunder III or Paradox. Manafont after Despair buys one more Fire IV and Despair.</p>
<h3>A typical 6.x opener</h3>
${seq(['sharpcast', 'fire3', 'thunder3', 'fire4', ['triplecast'], 'fire4', 'fire4', ['amplifier'], 'fire4', ['leyLines'], ['swiftcast'], 'despair', ['manafont'], 'fire4', 'despair', 'blizzard3', 'xenoglossy', 'paradox', 'blizzard4', 'fire3'])}
<p>Sharpcast about 15s before the pull, then start Fire III so it lands as the countdown ends (around −3.3s at 2.37). Use the Tincture around then too. Stand in Ley Lines for the 15% cast and GCD speed.</p>
<p style="color:#a9a3b4">The 6.5 numbers: Fire IV 310, Despair 340, Paradox 500, Xenoglossy 880, Thunder III 50 + 35 per tick for 30s, Astral Fire III ×1.8, Enochian ×1.23, Manafont +3000 MP, Umbral Ice III regen 6200 MP per tick.</p>`;
    }
  }

  B.BlackMageEW = BlackMageEW;

  B.registerJob({
    id: 'blm', name: 'Black Mage', abbr: 'BLM', role: 'caster', classJob: 25,
    versions: [{ id: 'ew65', label: 'Endwalker 6.5', history: 'EW 6.0–6.58', note: 'Paradox, Sharpcast and Triplecast with 2 charges, Enochian 23%', create: () => new BlackMageEW() }],
  });
})(window.BLM);

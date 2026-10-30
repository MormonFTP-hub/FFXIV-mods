// Black Mage, Dawntrail at level 100, in four versions. Built on the Endwalker class (blm_ew.js) for the Elemental
// Gauge, Umbral Hearts, Enochian, Polyglot (now three), Triplecast and the MP rules. What Dawntrail changed:
// Sharpcast, Thundercloud and Scathe are gone. Thunder only comes from Thunderhead, which you get each time you gain
// Astral Fire or Umbral Ice from neither or swap between them (and from Manafont): High Thunder is then instant and
// free (one Thunderhead at a time). Each Fire IV adds an Astral Soul (Flare three); six buy Flare Star. Manafont fills
// your MP, gives Astral Fire III, three Umbral Hearts, Thunderhead and Paradox, every 100s. Umbral Ice no longer speeds
// up MP ticks: each ice spell under Umbral Ice gives 2,500 / 5,000 / 10,000 MP. Paradox is instant, and in Astral Fire
// it always gives Firestarter. Retrace moves Ley Lines to you; Swiftcast is 40s.
//  - 7.0–7.01: Paradox only from Umbral Ice III with three hearts into Astral Fire (and Manafont), usable only in fire;
//    Fire IV / Blizzard IV 310, Despair 340 (a 3s cast), Paradox 500, High Thunder 200 + 55 × 30s, Enochian ×1.30.
//  - 7.05: Paradox from Astral Fire III into ice as well, in both elements (in ice: free, +1 Umbral Ice); Fire IV /
//    Blizzard IV 320, Despair 350, Paradox 520, High Thunder 150 + 60, Enochian ×1.33; Flare 30% less for the rest.
//  - 7.1–7.18: Despair instant, Flare a 3s cast, Ley Lines two charges (not while one is down), Enochian ×1.32.
//  - 7.2–7.57: Astral Fire, Umbral Ice, Firestarter and Thunderhead never run out; Fire, Blizzard, Fire IV, Blizzard IV,
//    Freeze, Flare and Flare Star 2s casts; Fire IV / Blizzard IV 300, Fire III / Blizzard III 290, Xenoglossy 890,
//    Paradox 540 (no element change), Flare Star 500, Foul 25% less for the rest, Ley Lines 20s, Enochian ×1.27.
// Numbers are the game data at 7.0, 7.01, 7.05, 7.1, 7.2 and 7.57 (xivapi's datamining) and the Lodestone notes; gear
// is The Balance's set for each tier. ref: a scripted bot parses about 37,900 / 24,200 / 25,000 / 19,800 on these.
(function (B) {
  const EW = B.BlackMageEW;
  const ICE_MP = [2500, 5000, 10000];
  const set = B.setAction;     // a version's change to an action (its description's numbers follow the potency)

  const VERSIONS = {
    dt72: { label: 'Dawntrail 7.2–7.57', history: 'DT 7.2–7.57', timers: false, fast: true, f4: 300, f3: 290, despair: 350, despairCast: 0, para: 540,
      paraFromAF: true, paraUi: false, xeno: 890, foulAoe: 0.75, flareCast: 2, flareAoe: 0.7, fs: 500, fsCast: 2, ht: [150, 60], eno: 1.27, ley: [2, 20],
      tincture: 'intdt4', ref: 40200, stats: { hp: 205237, main: 6512, wd: 158, det: 1951, crit: 1227, dh: 1968, speed: 3367 },
      gear: 'The Balance\'s 7.4 2.15 high spell speed set (Intelligence 6,512, 158 weapon damage), with a Grade 4 Gemdraught',
      note: 'Level 100: Astral Fire and Umbral Ice never run out; 2s casts, Flare Star 500, Paradox 540, Ley Lines 20s with two charges; the 7.4 savage set' },
    dt71: { label: 'Dawntrail 7.1–7.18', history: 'DT 7.1–7.18', timers: true, fast: false, f4: 320, f3: 280, despair: 350, despairCast: 0, para: 520,
      paraFromAF: true, paraUi: true, xeno: 880, foulAoe: 0.4, flareCast: 3, flareAoe: 0.7, fs: 400, fsCast: 3, ht: [150, 60], eno: 1.32, ley: [2, 30],
      tincture: 'intdt2', ref: 25700, stats: { hp: 135496, main: 4882, wd: 146, det: 2050, crit: 3271, dh: 1508, speed: 1047 },
      gear: 'The Balance\'s 7.15 2.42 set with Chaotic gear and the FRU weapon (Intelligence 4,882, 146 weapon damage), with a Grade 2 Gemdraught',
      note: 'Level 100: an instant Despair, Flare a 3s cast, Ley Lines with two charges, Paradox in both elements; 7.05 savage gear with the FRU weapon' },
    dt705: { label: 'Dawntrail 7.05–7.05', history: 'DT 7.05–7.05', timers: true, fast: false, f4: 320, f3: 280, despair: 350, despairCast: 3, para: 520,
      paraFromAF: true, paraUi: true, xeno: 880, foulAoe: 0.4, flareCast: 4, flareAoe: 0.7, fs: 400, fsCast: 3, ht: [150, 60], eno: 1.33, ley: [1, 30],
      tincture: 'intdt2', ref: 26500, stats: { hp: 135496, main: 4882, wd: 146, det: 1572, crit: 3321, dh: 1882, speed: 1047 },
      gear: 'The Balance\'s 7.05 2.42 set (Intelligence 4,882, 146 weapon damage), with a Grade 2 Gemdraught',
      note: 'Level 100: Paradox from ice as well as fire (free and instant in Umbral Ice), Fire IV 320, Enochian ×1.33; the 7.05 savage set' },
    dt70: { label: 'Dawntrail 7.0–7.01', history: 'DT 7.0–7.01', timers: true, fast: false, f4: 310, f3: 280, despair: 340, despairCast: 3, para: 500,
      paraFromAF: false, paraUi: false, xeno: 880, foulAoe: 0.4, flareCast: 4, flareAoe: 0.6, fs: 400, fsCast: 3, ht: [200, 55], eno: 1.30, ley: [1, 30],
      tincture: 'intdt1', ref: 21000, stats: { hp: 120596, main: 4432, wd: 141, det: 2249, crit: 2881, dh: 2230, speed: 1046 },
      gear: 'The Balance\'s pentamelded i710 set at 2.42 (Intelligence 4,432, 141 weapon damage), with a Grade 1 Gemdraught',
      note: 'Level 100 at launch: Thunderhead and High Thunder, Astral Soul into Flare Star, Paradox only in Astral Fire, Manafont every 100s; i710 gear' },
  };

  class BlackMageDT extends EW {
    constructor(v) {
      super();
      const V = this.V = VERSIONS[v];
      this.level = 100;
      this.levelKey = 100;
      this.cfg = Object.assign({}, this.cfg, { enochian: V.eno, polyMax: 3, fsDur: V.timers ? 30 : 1e9, elementDur: V.timers ? 15 : Infinity, tincture: V.tincture });
      const A = Object.assign({}, this.actions);
      for (const k of ['sharpcast', 'thunder3', 'thunder4', 'scathe']) delete A[k];
      const c = (n) => (V.fast ? 2 : n);
      set(A, 'fire', { cast: c(2.5) });
      set(A, 'blizzard', { cast: c(2.5) });
      set(A, 'fire3', { potency: V.f3, desc: A.fire3.desc.replace('260', String(V.f3)) });
      set(A, 'blizzard3', { potency: V.f3, desc: A.blizzard3.desc.replace('260', String(V.f3)) });
      set(A, 'fire4', { potency: V.f4, cast: c(2.8), desc: `Deals fire damage with a potency of ${V.f4}.\nAdditional Effect: Grants Astral Soul\nCan only be executed while under the effect of Astral Fire.` });
      set(A, 'blizzard4', { potency: V.f4, cast: c(2.5), desc: A.blizzard4.desc.replace('310', String(V.f4)) });
      set(A, 'despair', { potency: V.despair, cast: V.despairCast, desc: A.despair.desc.replace('340', String(V.despair)) });
      set(A, 'paradox', { potency: V.para, cast: 0, desc: `Deals unaspected damage with a potency of ${V.para}.\nAstral Fire Bonus: ${V.timers ? 'Refreshes Astral Fire. ' : ''}Grants Firestarter.${V.paraUi ? `\nUmbral Ice Bonus: Costs no MP${V.timers ? ', grants Umbral Ice +1 and refreshes it' : ''}.` : '\nCan only be executed while under the effect of Astral Fire.'}\nOnly available while the Paradox marker is active.` });
      set(A, 'xenoglossy', { potency: V.xeno, desc: A.xenoglossy.desc.replace('880', String(V.xeno)) });
      set(A, 'foul', { aoe: V.foulAoe, desc: `Deals unaspected damage to target and all enemies nearby it with a potency of 600 for the first enemy, and ${Math.round((1 - V.foulAoe) * 100)}% less for all remaining enemies.\nPolyglot Cost: 1` });
      set(A, 'highFire2', { potency: 100, desc: 'Deals fire damage with a potency of 100 to target and all enemies nearby it.\nAdditional Effect: Grants Astral Fire III and removes Umbral Ice' });
      set(A, 'highBlizzard2', { potency: 100, desc: 'Deals ice damage with a potency of 100 to target and all enemies nearby it.\nAdditional Effect: Grants Umbral Ice III and removes Astral Fire' });
      set(A, 'freeze', { cast: c(2.8), hearts: 3, desc: 'Deals ice damage with a potency of 120 to target and all enemies nearby it.\nAdditional Effect: Grants 3 Umbral Hearts\nCan only be executed while under the effect of Umbral Ice.' });
      set(A, 'flare', { potency: 240, enhancedPotency: undefined, cast: V.flareCast, aoe: V.flareAoe, desc: `Deals fire damage to a target and all enemies nearby it with a potency of 240 for the first enemy, and ${Math.round((1 - V.flareAoe) * 100)}% less for all remaining enemies.\nAdditional Effect: Grants Astral Fire III and 3 Astral Soul\nCan only be executed while under the effect of Astral Fire.\nRequires at least 800 MP and consumes all remaining MP.` });
      A.flareStar = { name: 'Flare Star', kind: 'gcd', school: 'fire', potency: V.fs, mp: 0, cast: V.fsCast, delay: 1.1, target: true, aoe: 0.35, look: 'despair',
        desc: `Deals fire damage to a target and all enemies nearby it with a potency of ${V.fs} for the first enemy, and 65% less for all remaining enemies.\nAstral Soul Cost: 6\nCan only be executed while under the effect of Astral Fire.` };
      A.highThunder = { name: 'High Thunder', kind: 'gcd', school: 'thunder', potency: V.ht[0], mp: 0, cast: 0, delay: 0.8, target: true, look: 'thunder3', thunder: true,
        dot: { potency: V.ht[1], duration: 30 },
        desc: `Deals lightning damage with a potency of ${V.ht[0]}.\nAdditional Effect: Lightning damage over time\nPotency: ${V.ht[1]}\nDuration: 30s\nCan only be executed while under the effect of Thunderhead.\nOnly one Thunder spell-induced damage over time effect per caster can be inflicted upon a single target.` };
      A.highThunder2 = { name: 'High Thunder II', kind: 'gcd', school: 'thunder', potency: 100, mp: 0, cast: 0, delay: 0.8, target: true, aoe: true, look: 'thunder3', thunder: true,
        dot: { potency: 40, duration: 24, aoe: true },
        desc: 'Deals lightning damage with a potency of 100 to target and all enemies nearby it.\nAdditional Effect: Lightning damage over time\nPotency: 40\nDuration: 24s\nCan only be executed while under the effect of Thunderhead.' };
      set(A, 'manafont', { recast: 100, desc: 'Fully restores MP.\nAdditional Effect: Grants Astral Fire III, 3 Umbral Hearts, Thunderhead and Paradox\nCan only be executed while under the effect of Astral Fire.' });
      set(A, 'leyLines', Object.assign({ desc: `Connects naturally occurring ley lines to create a circle of power which, while standing within it, reduces spell cast time and recast time, and auto-attack delay by 15%.\nDuration: ${V.ley[1]}s${V.ley[0] > 1 ? '\nMaximum Charges: 2\nCannot be executed while under the effect of Ley Lines.' : ''}` }, V.ley[0] > 1 ? { charges: 2 } : {}));
      A.retrace = { name: 'Retrace', kind: 'ogcd', recast: 40, desc: 'Connects to the ley lines beneath you, moving your Ley Lines circle here.\nCan only be executed while under the effect of Ley Lines.' };
      set(A, 'swiftcast', { recast: 40 });
      A.tincture = B.tincture(V.tincture);
      this.actions = B.blmTimerText(A, this.cfg);     // 7.2: no Duration lines, as nothing runs out
      this.statuses = Object.assign({}, this.statuses, {
        thunderhead: { name: 'Thunderhead', self: true, icon: 'st_thunderhead' },
        highThunder: { name: 'High Thunder', self: false, icon: 'st_highThunder' },
        highThunder2: { name: 'High Thunder II', self: false, icon: 'st_highThunder2' },
      });
      this.stats = Object.assign({}, this.stats, V.stats);
      this.selfStatusOrder = ['circleOfPower', 'leyLines', 'triplecast', 'swiftcast', 'firestarter', 'thunderhead', 'medicated', 'lucidDreaming', 'manaward', 'surecast', 'sprint'];
      this.targetStatusOrder = ['highThunder', 'highThunder2', 'addle'];
      this.defaultBars = [
        ['fire3', 'fire4', 'despair', 'fire', 'blizzard3', 'blizzard4', 'blizzard', 'highThunder', 'xenoglossy', 'flareStar', 'umbralSoul', 'foul'],
        ['triplecast', 'swiftcast', 'leyLines', 'betweenTheLines', 'retrace', 'amplifier', 'manafont', 'transpose', 'lucidDreaming', 'tincture', 'addle', 'manaward'],
        ['surecast', 'sprint', 'highBlizzard2', 'freeze', 'highThunder2', 'highFire2', 'flare', null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Black Mage', ['fire', 'fire3', 'fire4', 'despair', 'flareStar', 'blizzard', 'blizzard3', 'blizzard4', 'highThunder', 'paradox', 'xenoglossy', 'foul', 'umbralSoul',
          'highFire2', 'highBlizzard2', 'freeze', 'flare', 'highThunder2', 'transpose', 'triplecast', 'manafont', 'amplifier', 'leyLines', 'betweenTheLines', 'retrace', 'manaward']],
        ['Role Actions', ['swiftcast', 'lucidDreaming', 'addle', 'surecast']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = V.fast ? 2.15 : 2.42;
    }

    initGauge() { return Object.assign(super.initGauge(), { soul: 0 }); }

    // 7.0: only Fire turns into Paradox.
    resolveId(id, e) {
      if (id === 'blizzard' && !this.V.paraUi) return id;
      return super.resolveId(id, e);
    }

    check(id, e) {
      const g = e.g;
      switch (id) {
        case 'highThunder': case 'highThunder2': if (!e.has('thunderhead')) return 'Unable to execute action. Thunderhead required.'; break;
        case 'flareStar':
          if (g.element <= 0) return 'Unable to execute action. Astral Fire required.';
          if (g.soul < 6) return 'Unable to execute action. Astral Soul required.';
          break;
        case 'paradox': if (!this.V.paraUi && g.element <= 0) return 'Unable to execute action. Astral Fire required.'; break;
        case 'manafont': if (g.element <= 0) return 'Unable to execute action. Astral Fire required.'; break;
        case 'leyLines': if (this.V.ley[0] > 1 && e.leyLines && e.leyLines.until > e.now) return 'Unable to execute action while under the effect of Ley Lines.'; break;
        case 'retrace': if (!(e.leyLines && e.leyLines.until > e.now)) return 'Unable to execute action. Ley Lines required.'; break;
      }
      return super.check(id, e);
    }

    addTimed(e, key, dur) {
      if (this.V.timers) e.addStatus(key, dur);
      else e.addStatus(key, 1e9, { permanent: true });
    }

    setElement(e, next) {
      const g = e.g, prev = g.element, had = g.paradox;
      super.setElement(e, next);
      // 7.0 lit Paradox only from Umbral Ice III with three hearts.
      if (!this.V.paraFromAF && prev === 3 && next < 0 && !had) g.paradox = false;
      // Thunderhead whenever you gain an element from neither, or swap fire for ice or ice for fire.
      if (next !== 0 && Math.sign(prev) !== Math.sign(next)) this.addTimed(e, 'thunderhead', 30);
      if (next <= 0 && g.soul) { g.soul = 0; e.emit('soul', { n: 0 }); }
    }

    resolveSpell(id, e) {
      const a = this.actions[id], g = e.g, V = this.V;
      if (id === 'paradox') {
        e.mp -= this.mpCost(id, e);
        g.paradox = false;
        if (g.element > 0) {
          if (V.timers) g.elementUntil = e.now + 15;
          this.addTimed(e, 'firestarter', 30);
        } else if (g.element < 0 && V.timers) this.setElement(e, Math.max(-3, g.element - 1));
        e.emit('paradox', { active: false });
        e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
        return;
      }
      if (id === 'flareStar') {
        const snap = this.snapshot(a, e);
        g.soul = 0;
        e.emit('soul', { n: 0 });
        e.queueHit(id, a.potency, snap, a.delay);
        return;
      }
      if (a.thunder) e.removeStatus('thunderhead');
      super.resolveSpell(id, e);
      if (id === 'fire4') g.soul = Math.min(6, g.soul + 1);
      if (id === 'flare') g.soul = Math.min(6, g.soul + 3);
      // Ice spells under Umbral Ice restore MP (Umbral Soul too).
      if ((a.school === 'ice' || id === 'umbralSoul') && g.element < 0) {
        const before = e.mp;
        e.mp = Math.min(e.maxMp, e.mp + ICE_MP[-g.element - 1]);
        if (e.mp > before) e.emit('mpGain', { amount: e.mp - before, source: 'umbral' });
      }
      if (!V.timers && e.statuses.firestarter) e.statuses.firestarter.permanent = true;
    }

    resolveAbility(id, e) {
      const g = e.g;
      switch (id) {
        case 'manafont': {
          const before = e.mp;
          e.mp = e.maxMp;
          e.emit('mpGain', { amount: e.mp - before, source: 'manafont' });
          this.setElement(e, 3);
          this.addTimed(e, 'thunderhead', 30);
          g.hearts = 3; e.emit('hearts', { n: 3 });
          g.paradox = true; e.emit('paradox', { active: true });
          return;
        }
        case 'leyLines': {
          const d = this.V.ley[1];
          e.leyLines = { x: e.pos.x, y: e.pos.y || 0, z: e.pos.z, until: e.now + d, start: e.now };
          e.addStatus('leyLines', d);
          return;
        }
        case 'retrace':
          e.leyLines.x = e.pos.x; e.leyLines.z = e.pos.z;
          e.emit('teleport', { from: { x: e.pos.x, z: e.pos.z }, to: { x: e.pos.x, z: e.pos.z } });
          return;
      }
      super.resolveAbility(id, e);
    }

    // No faster MP ticks in Umbral Ice any more (ice spells give the MP).
    mpRegen(e) { return e.g.element > 0 ? 0 : (this.cfg.baseRegen || B.BASE_REGEN); }

    process(e) {
      const g = e.g, prev = g.element;
      super.process(e);
      // An element running out takes the Paradox marker and the Astral Soul with it.
      if (prev !== 0 && g.element === 0) { g.paradox = false; g.soul = 0; }
    }

    onDotTick() {}

    proc(id, e) {
      const g = e.g;
      if (id === 'highThunder' || id === 'highThunder2') return e.has('thunderhead');
      if (id === 'flareStar') return g.soul >= 6 && g.element > 0;
      if (id === 'paradox') return g.paradox && (this.V.paraUi || g.element > 0);
      return (id === 'fire3' && e.has('firestarter'));
    }

    speedInfo(e) {
      return `Fire IV ${e.speedScale(this.actions.fire4.cast).toFixed(2)}s · Fire III ${e.speedScale(3.5).toFixed(2)}s · GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)}`;
    }

    // The gauge: three Polyglots and six Astral Soul pips.
    gaugeBuild(root) {
      super.gaugeBuild(root);
      const svg = root.querySelector('svg');
      svg.insertAdjacentHTML('beforeend', [0, 1, 2, 3, 4, 5].map(k => `<circle id="g-soul${k}" cx="${214 + k * 20}" cy="126" r="6" fill="#2a1a18" stroke="rgba(0,0,0,.8)" stroke-width="1.2"/>`).join(''));
      this.gg.soul = [0, 1, 2, 3, 4, 5].map(k => root.querySelector('#g-soul' + k));
    }
    gaugeUpdate(e) {
      super.gaugeUpdate(e);
      const G = this.gg, c = G.cache, g = e.g;
      for (let k = 0; k < 6; k++) {
        const v = g.soul > k;
        if (c['so' + k] !== v) { c['so' + k] = v; G.soul[k].setAttribute('fill', v ? '#ff8a4a' : '#2a1a18'); G.soul[k].setAttribute('filter', v ? 'url(#gl)' : ''); }
      }
    }

    helpHtml(seq) {
      const V = this.V;
      const opener = V.timers
        ? ['fire3', 'highThunder', ['swiftcast'], ['amplifier'], 'fire4', ['tincture'], 'fire4', 'xenoglossy', ['triplecast'], ['leyLines'], 'fire4', 'fire4', 'despair', ['manafont'], ['triplecast'], 'fire4', 'fire4', 'flareStar', 'fire4', 'highThunder', 'paradox', 'fire4', 'fire4', 'fire4', 'despair']
        : ['fire3', 'highThunder', ['swiftcast'], ['amplifier'], 'fire4', ['tincture'], ['leyLines'], 'fire4', 'fire4', 'fire4', 'fire4', 'xenoglossy', ['manafont'], 'fire4', 'flareStar', 'fire4', 'fire4', 'highThunder', 'fire4', 'fire4', 'fire4', 'fire4', 'flareStar', 'despair', ['transpose'], ['triplecast'], 'blizzard3', 'blizzard4', 'paradox', ['transpose'], 'paradox', 'fire3'];
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 100 Black Mage. In <b>Astral Fire</b>: Fire IV (${V.f4}) until MP runs low, each one an <b>Astral Soul</b>; at six, <b>Flare Star</b> (${V.fs}); finish with <b>Despair</b> (${V.despair}, all your MP${V.despairCast ? '' : ', instant'}). Then <b>Blizzard III</b> into Umbral Ice III: every ice spell there refills MP (2,500 / 5,000 / 10,000 at one / two / three stacks), so Blizzard III and <b>Blizzard IV</b> (three Umbral Hearts) are all you need before <b>Fire III</b>.${V.timers ? ' Astral Fire and Umbral Ice last 15s: let them drop and you lose Enochian and its Polyglot timer.' : ' Astral Fire and Umbral Ice never run out, nor do Firestarter and Thunderhead.'}</p>
<p><b>Paradox</b> (${V.para}, instant) lights ${V.paraFromAF ? 'when you swap from Astral Fire III to ice, or from Umbral Ice III with three hearts to fire' : 'only when you go from Umbral Ice III with three hearts into fire'}; in fire it always gives <b>Firestarter</b> (a free, instant Fire III)${V.paraUi ? `, in ice it's free${V.timers ? ' and adds a stack' : ''}` : ', and it can only be cast in fire'}. Each swap into an element gives <b>Thunderhead</b>: <b>High Thunder</b> (${V.ht[0]} + ${V.ht[1]} × 30s) is then instant and free. <b>Manafont</b> (100s) refills you in fire and gives Astral Fire III, three hearts, Thunderhead and Paradox. Polyglot every 30s (three at most) for <b>Xenoglossy</b> (${V.xeno}). <b>Ley Lines</b> (${V.ley[1]}s${V.ley[0] > 1 ? ', two charges' : ''}) is 15% faster casts; Retrace moves it to you.</p>
<h3>The opener (The Balance)</h3>
${seq(opener)}
<p>Fire III about 4s before the pull.</p>
<p style="color:#a9a3b4">${V.label} numbers: Fire IV and Blizzard IV ${V.f4}, Fire III and Blizzard III ${V.f3}, Despair ${V.despair}, Paradox ${V.para}, Flare Star ${V.fs}, Xenoglossy ${V.xeno}, Foul 600, High Thunder ${V.ht[0]} + ${V.ht[1]} × 30s, Flare 240, Astral Fire III ×1.8, Enochian ×${V.eno}. Gear: ${V.gear}.</p>`;
    }
  }

  B.registerJob({
    id: 'blm', name: 'Black Mage', abbr: 'BLM', role: 'caster', classJob: 25,
    versions: ['dt72', 'dt71', 'dt705', 'dt70'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new BlackMageDT(v) })),
  });
})(window.BLM);

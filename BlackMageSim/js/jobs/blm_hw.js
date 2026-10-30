// Black Mage, Heavensward at level 60, in two versions. Built on the Stormblood class (blm_sb.js) for Astral Fire and
// Umbral Ice, their MP tables, Firestarter, Thundercloud, Convert and Ley Lines, with Heavensward's Enochian: a button
// (60s) giving +5% and Fire IV / Blizzard IV for 30s, not tied to the element. Each Blizzard IV refreshes it to 5s less
// than the last refresh (30 → 25 → 20…), and pressing Enochian again starts back at 30s. No Umbral Hearts (Fire spells
// in Astral Fire always cost double), no Polyglot or Foul, no Triplecast. Three single-target Thunders: Thunder (30 +
// 40 × 18s, 2.5s), Thunder II (50 + 40 × 21s) and Thunder III (70 + 40 × 24s, 3.5s); every tick has a 10% chance of
// Thundercloud, which makes the next Thunder instant, free and adds the whole DoT to its hit. Fire IV and Blizzard IV
// are 280 on 3.0s casts. Raging Strikes (Archer, +20%) is the cross-class burst. Heavensward's damage formula (hw60).
//  - 3.2–3.57: Astral Fire and Umbral Ice last 12s.
//  - 3.05–3.15: they last 10s.
//  - 3.0–3.01: also 10s; Thundercloud 5%, Thunder DoTs 35 a tick, Thunder III 60; pressing Enochian again while it's up
//    doesn't reset it but continues Blizzard IV's chain (5s shorter); the i190 gear before Savage.
//  - A Realm Reborn 2.0–2.57 (level 50, the same formula as arr50): no Enochian, Fire IV, Blizzard IV, Sharpcast or Ley
//    Lines; Fire and Blizzard 170 (150 before 2.3), Fire III and Blizzard III 240, the Thunders tick for 35 with a 5%
//    Thundercloud; Astral Fire and Umbral Ice last 10s. MP is the clock: a 3,637 pool (the 2015 sim's fit at 240 Piety,
//    which gives the guide's "four Fires, five at Piety 251") with every cost a share of level 50's 2,660. Flare needs
//    266 MP. Ariyala's 2015 Dreadwyrm set and the X-Potion of Intelligence. ref: a scripted bot parses about 596 on it.
// Numbers are the official job guide's 3.57 tooltips (Wayback, June 2017), the FFXIV wiki's and Gamer Escape's pre-4.0
// revisions and the 3.05 / 3.2 patch notes. MP costs are Heavensward's (88.4 MP a percent at level 60); the pool
// (11,400) is an estimate, as no Heavensward Black Mage profile survives. Gear: an Alexander: Creator Savage set
// (Alexandrian Metal Rod: 115 magic damage) and, for 3.05–3.15, a Gordias set (105).
(function (B) {
  const SB = B.BlackMageSB;
  const EWp = B.BlackMageEW.prototype;
  const EPS = 1e-6;
  const MAX_MP = 11400;
  const VERSIONS = {
    arr20: { label: 'A Realm Reborn 2.0–2.57', history: 'ARR 2.0–2.57', arr: true, elementDur: 10, potion: ['X-Potion of Intelligence', 84], ref: 630,
      tc: 0.05, tdot: 35, t3: 60,
      stats: { hp: 7000, main: 665, wd: 82, det: 213, crit: 555, dh: 341, speed: 584 },
      gear: 'Ariyala\'s 2015 Final Coil set with the Dreadwyrm Staff (Intelligence 665, 82 magic damage)',
      note: 'Level 50: Fire, Fire III, Blizzard III and the Thunders, Astral Fire and Umbral Ice for 10s, MP as the clock (no Enochian), Convert, Raging Strikes; Dreadwyrm gear' },
    hw32: { label: 'Heavensward 3.2–3.57', history: 'HW 3.2–3.57', elementDur: 12, potion: ['Supramax-Potion of Intelligence', 154], ref: 2510,
      stats: { hp: 17500, main: 1591, wd: 114, det: 828, crit: 870, speed: 1047 },
      gear: 'an Alexander: Creator Savage set with the Shire rod at 2.23 (Intelligence 1,591, 114 magic damage)',
      note: 'Level 60: Enochian on a 30s timer that Blizzard IV refreshes 5s shorter each time, 12s Astral Fire and Umbral Ice, three Thunders and Thundercloud, Convert; Creator gear' },
    hw305: { label: 'Heavensward 3.05–3.15', history: 'HW 3.05–3.15', elementDur: 10, potion: ['Draconian Potion of Intelligence', 105], ref: 1130,
      stats: { hp: 15000, main: 1055, wd: 105, det: 450, crit: 698, speed: 671 },
      gear: 'an Alexander: Gordias Savage set (Intelligence 1,055, 105 magic damage)',
      note: 'Level 60: re-pressing Enochian resets it to 30s, Thundercloud 10%, and only 10s of Astral Fire and Umbral Ice; Gordias gear' },
    hw30: { label: 'Heavensward 3.0–3.01', history: 'HW 3.0–3.01', elementDur: 10, potion: ['Draconian Potion of Intelligence', 105], ref: 920,
      tc: 0.05, tdot: 35, t3: 60, chain: true,
      stats: { hp: 14000, main: 935, wd: 100, det: 448, crit: 700, speed: 495 },
      gear: 'a Prototype Gordian set (i190) with the Hive Longpole (Intelligence 935, 100 magic damage)',
      note: 'The launch: Enochian refreshed only by Blizzard IV, 5s shorter each time (pressing it again doesn’t reset it), Thundercloud 5%, Thunder DoTs 35; i190 gear' },
  };
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };

  class BlackMageHW extends SB {
    constructor(version) {
      super();
      const V = VERSIONS[version];
      this.V = V;
      this.level = V.arr ? 50 : 60;
      this.levelKey = V.arr ? 'arr50' : 'hw60';
      this.model = 'blm-hw';
      this.maxMp = V.arr ? 3637 : MAX_MP;
      this.potionCap = V.potion[1];
      const A = Object.assign({}, this.actions);
      for (const k of ['foul', 'thunder4', 'triplecast', 'betweenTheLines', 'lucidDreaming', 'addle']) delete A[k];
      const pot = (id, p, o) => set(A, id, Object.assign({ potency: p, desc: (A[id].desc || '').replace(/potency of \d+/, `potency of ${p}`) }, o));
      pot('fire', 180, { mp: 1061 });
      pot('blizzard', 180, { mp: 354 });
      pot('fire3', 240, { mp: 1768 });
      pot('blizzard3', 240, { mp: 1061 });
      pot('fire4', 280, { mp: 884, cast: 3.0, desc: 'Deals fire damage with a potency of 280.\nCan only be executed while under the effects of both Enochian and Astral Fire.' });
      pot('blizzard4', 280, { mp: 884, cast: 3.0, desc: 'Deals ice damage with a potency of 280.\nAdditional Effect: Refreshes Enochian, 5s less each time (30s, 25s, 20s…)\nCan only be executed while under the effects of both Enochian and Umbral Ice.' });
      pot('scathe', 100, { mp: 707 });
      pot('fire2', 100, { mp: 1326, cast: 3.0, desc: 'Deals fire damage with a potency of 100 to target and all enemies nearby it.\nAdditional Effect: Grants Astral Fire or removes Umbral Ice\nDuration: 12s' });
      pot('blizzard2', 50, { mp: 707, cast: 2.0 });
      pot('freeze', 100, { mp: 1768 });
      set(A, 'flare', { potency: 260, cast: 4.0, aoe: [1, 0.9, 0.8, 0.7, 0.6, 0.5] });
      const tc = V.tc || 0.1, tdot = V.tdot || 40;
      const thunder = (name, p, mp, cast, dur) => Object.assign({}, A.thunder3, {
        name, potency: p, mp, cast, tcChance: tc, dot: { potency: tdot, duration: dur }, look: 'thunder3',
        desc: `Deals lightning damage with a potency of ${p}.\nAdditional Effect: Lightning damage over time\nPotency: ${tdot}\nDuration: ${dur}s\nAdditional Effect: ${tc * 100}% chance after each tick that the next Thunder spell will add its full damage over time to the hit, cost no MP and be instant\nDuration: 12s` });
      A.thunder = thunder('Thunder', 30, 707, 2.5, 18);
      A.thunder2 = thunder('Thunder II', 50, 1061, 3.0, 21);
      A.thunder3 = Object.assign(thunder('Thunder III', V.t3 || 70, 1414, 3.5, 24), { look: undefined });
      set(A, 'enochian', { recast: 60, desc: `Increases magic damage dealt by 5% and allows the casting of Fire IV and Blizzard IV.\nDuration: 30s\n${V.chain ? 'Pressing it again while active continues Blizzard IV’s chain (5s shorter) instead of resetting it.' : 'Pressing it again while active resets the duration to 30s.'}\nCan only be executed while under the effect of Astral Fire or Umbral Ice.` });
      set(A, 'transpose', { recast: 12 });
      set(A, 'sharpcast', { recast: 60, desc: 'Ensures the next Scathe, Fire or Thunder spell will, for the first hit, trigger its additional effect.\nDuration: 10s' });
      set(A, 'leyLines', { recast: 90 });
      set(A, 'surecast', { recast: 30, desc: 'The next spell is cast without interruption.\nDuration: 10s' });
      A.ragingStrikes = { name: 'Raging Strikes', kind: 'ogcd', recast: 180, role: true, desc: 'Increases damage dealt by 20%.\nDuration: 20s' };
      A.tincture = Object.assign({}, B.tincture('int3sb'), { name: V.potion[0], dur: 15, desc: `This diluted brew temporarily increases intelligence.\nIntelligence +20% (Max ${V.potion[1]})\nDuration: 15s` });
      if (V.arr) {
        // Level 50: no Enochian line; every MP cost is the same share of 2,660 as Heavensward's of 8,840.
        for (const k of ['fire4', 'blizzard4', 'enochian', 'sharpcast', 'leyLines']) delete A[k];
        const k = 2660 / 8840;
        for (const id of ['fire', 'blizzard', 'fire3', 'blizzard3', 'thunder', 'thunder2', 'thunder3', 'scathe', 'blizzard2']) if (A[id] && A[id].mp) set(A, id, { mp: Math.round(A[id].mp * k) });
        set(A, 'fire', { potency: 170, desc: 'Deals fire damage with a potency of 170.\nAdditional Effect: Grants Astral Fire or removes Umbral Ice\nDuration: 10s\nAdditional Effect: 40% chance next Fire III will cost no MP and have no cast time' });
        set(A, 'blizzard', { potency: 170, desc: 'Deals ice damage with a potency of 170.\nAdditional Effect: Grants Umbral Ice or removes Astral Fire\nDuration: 10s' });
        set(A, 'fire2', { mp: 426 }); set(A, 'freeze', { mp: 532 });
        set(A, 'flare', { desc: 'Deals fire damage to a target and all enemies nearby it with a potency of 260.\nAdditional Effect: Grants Astral Fire III\nConsumes all remaining MP (at least 266).' });
        set(A, 'surecast', { recast: 30 }); set(A, 'convert', { recast: 180 });
        this.flareMin = 266;
      }
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        thunder: { name: 'Thunder', self: false, icon: 'st_thunder' },
        thunder2: { name: 'Thunder II', self: false, icon: 'st_thunder2' },
        ragingStrikes: { name: 'Raging Strikes', self: true, icon: 'st_raging' },
      });
      this.cfg = Object.assign({}, this.cfg, {
        enochian: 1.05, polyMax: 0, fsDur: 12, tcDur: 12, sharpDur: 10, elementDur: V.elementDur, convertMp: 0.3, lucid: 0,
        baseRegen: Math.round(MAX_MP * 0.02), uiRegen: [0.32, 0.47, 0.62].map(k => Math.round(MAX_MP * k)),
      });
      if (V.arr) this.cfg = Object.assign({}, this.cfg, { enochian: 1.0, baseRegen: 73, uiRegen: [1164, 1709, 2255] });
      this.stats = Object.assign({ mainStat: 'int', jobMod: 115, trait: 130, dh: 354, delay: 3.28 }, V.stats);
      this.selfStatusOrder = ['enochian', 'circleOfPower', 'leyLines', 'ragingStrikes', 'swiftcast', 'sharpcast', 'firestarter', 'thundercloud',
        'medicated', 'manaward', 'surecast', 'sprint'];
      this.targetStatusOrder = ['thunder3', 'thunder2', 'thunder'];
      this.defaultBars = [
        ['fire3', 'fire4', 'fire', 'blizzard3', 'blizzard4', 'blizzard', 'thunder', 'thunder3', 'thunder2', 'scathe', 'flare', null],
        ['enochian', 'sharpcast', 'swiftcast', 'leyLines', 'ragingStrikes', 'convert', 'transpose', 'tincture', 'manaward', 'surecast', 'sprint', null],
        ['fire2', 'blizzard2', 'freeze', null, null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Black Mage', ['fire', 'fire3', 'fire4', 'blizzard', 'blizzard3', 'blizzard4', 'thunder', 'thunder2', 'thunder3', 'scathe', 'fire2', 'blizzard2', 'freeze',
          'flare', 'enochian', 'transpose', 'sharpcast', 'convert', 'leyLines', 'manaward']],
        ['Cross-class', ['swiftcast', 'surecast', 'ragingStrikes']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = 2.23;
      if (V.arr) {
        this.defaultBars = [
          ['fire3', 'fire', 'blizzard3', 'blizzard', 'thunder', 'thunder2', 'thunder3', 'scathe', 'flare', 'convert', 'transpose', 'swiftcast'],
          ['ragingStrikes', 'tincture', 'manaward', 'surecast', 'sprint', 'fire2', 'blizzard2', 'freeze', null, null, null, null],
          [null, null, null, null, null, null, null, null, null, null, null, null],
        ];
        this.actionGroups = [
          ['Black Mage', ['fire', 'fire3', 'blizzard', 'blizzard3', 'thunder', 'thunder2', 'thunder3', 'scathe', 'fire2', 'blizzard2', 'freeze', 'flare', 'transpose', 'convert', 'manaward']],
          ['Cross-class', ['swiftcast', 'surecast', 'ragingStrikes']],
          ['General', ['sprint', 'tincture']],
        ];
        this.referenceGcd = 2.26;
      }
    }

    // A Realm Reborn's Flare needs only 266 MP.
    check(id, e) {
      if (id === 'flare' && this.flareMin) return e.mp < this.flareMin ? 'Not enough MP.' : null;
      return super.check(id, e);
    }
    checkCompletion(id, e) {
      if (id === 'flare' && this.flareMin) return e.mp < this.flareMin ? 'Not enough MP.' : null;
      return super.checkCompletion(id, e);
    }

    initGauge(e) { return Object.assign(super.initGauge(e), { enoUntil: 0, enoLen: 30 }); }

    snapshot(a, e) {
      const s = super.snapshot(a, e);
      if (e.has('ragingStrikes')) s.mult *= 1.20;
      s.main = this.stats.main + (e.has('medicated') ? this.potionCap : 0);
      return s;
    }

    // Enochian isn't tied to the element in Heavensward, and there's no Polyglot timer.
    setElement(e, next) {
      EWp.setElement.call(this, e, next);
      e.g.enoStart = null;
      e.g.paradox = false;
    }
    nextEvent(e) {
      const t = EWp.nextEvent.call(this, e);
      return e.g.enochian ? Math.min(t, e.g.enoUntil) : t;
    }
    process(e) {
      const g = e.g;
      g.enoStart = null;
      EWp.process.call(this, e);
      if (g.enochian && e.now >= g.enoUntil - EPS) this.dropEnochian(e);
    }

    resolveAbility(id, e) {
      const g = e.g;
      if (id === 'enochian') {
        // 3.0–3.01: pressing it while it's up continues the chain instead of starting over.
        g.enoLen = this.V.chain && g.enochian ? Math.max(0, g.enoLen - 5) : 30;
        g.enochian = true; g.enoUntil = e.now + g.enoLen; g.enoStart = null;
        e.addStatus('enochian', g.enoLen);
        return;
      }
      if (id === 'ragingStrikes') { e.addStatus('ragingStrikes', 20); return; }
      super.resolveAbility(id, e);
    }

    resolveSpell(id, e) {
      const g = e.g, a = this.actions[id];
      // Thunder and Thunder II with Thundercloud: free, instant, and the whole DoT on the hit (as Thunder III).
      if ((id === 'thunder' || id === 'thunder2') && e.has('thundercloud')) {
        this.actions[id] = Object.assign({}, a, { potency: a.potency + a.dot.potency * a.dot.duration / 3 });
        super.resolveSpell(id, e);
        this.actions[id] = a;
        e.removeStatus('thundercloud');
        return;
      }
      super.resolveSpell(id, e);
      if (id === 'blizzard4') {
        // No Umbral Hearts; Enochian refreshed to 5s less than its last refresh.
        if (g.hearts) { g.hearts = 0; e.emit('hearts', { n: 0 }); }
        if (g.enochian) {
          g.enoLen = Math.max(0, g.enoLen - 5);
          g.enoUntil = e.now + g.enoLen;
          e.addStatus('enochian', g.enoLen);
        }
      }
    }

    proc(id, e) {
      if (id === 'enochian') return e.g.element !== 0 && (!e.g.enochian || e.g.enoUntil - e.now < 8);
      return super.proc(id, e);
    }

    speedInfo(e) {
      return `Fire IV ${e.speedScale(3).toFixed(2)}s · Fire III ${e.speedScale(3.5).toFixed(2)}s · ${e.maxMp.toLocaleString()} MP · Heavensward's formula (no Direct Hit)`;
    }

    helpHtml(seq) {
      const V = this.V;
      if (V.arr) return `
<h3>How it plays (${V.label})</h3>
<p>Level 50 Black Mage, and MP is the clock. <b>Fire III</b> into Astral Fire, then <b>Fire</b> (170, which refreshes Astral Fire's ${V.elementDur}s and has a 40% chance of Firestarter, a free instant Fire III) until about four casts have drained the pool, then <b>Blizzard III</b> into Umbral Ice, <b>Thunder II</b> or Thunder (35 a tick; each tick a 5% chance of Thundercloud for a free instant Thunder III with its DoT on the hit) and Blizzard until Umbral Ice III has filled you back up. <b>Convert</b> (30% MP for 20% HP) buys two more Fires; <b>Raging Strikes</b> (+20%), Swiftcast and the X-Potion go together.</p>
<h3>An opener (from the ARR guides)</h3>
${seq(['thunder2', ['swiftcast'], 'fire3', ['ragingStrikes'], ['tincture'], 'fire', 'fire', 'fire', 'fire', ['convert'], 'fire', 'fire', 'blizzard3', 'thunder2', 'blizzard', 'fire3', 'fire', 'fire', 'fire', 'fire', 'blizzard3'])}
<p style="color:#a9a3b4">The 2.3–2.57 numbers: Fire and Blizzard 170, Fire III and Blizzard III 240, Thunder 30 + 35 × 18s, Thunder II 50 + 35 × 21s, Thunder III 60 + 35 × 24s, Scathe 100, Flare 260; MP costs 319 (Fire), 532 (Fire III), 319 (Blizzard III), 319 (Thunder II), doubled for fire spells in Astral Fire. A 3,637 MP pool, 2% a tick, Umbral Ice III 62%. Astral Fire III is ×1.8 here as in Heavensward (no source gives an ARR value). Gear: ${V.gear}, with the ${V.potion[0]} (max ${V.potion[1]}).</p>`;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 60 Black Mage. <b>Enochian</b> (60s) gives +5% and unlocks Fire IV and Blizzard IV for <b>30s</b>, whatever the element does. Each <b>Blizzard IV</b> refreshes it, but 5s shorter than the time before (25s, then 20s…), so press Enochian again when it comes back to start over at 30s. Astral Fire and Umbral Ice last only <b>${V.elementDur}s</b>: <b>Fire</b> (or a Firestarter Fire III) refreshes Astral Fire, Fire IV doesn't.</p>
<p>No Umbral Hearts yet: every fire spell costs double in Astral Fire, so the phase is <b>Fire III → Fire IV ×2 → Fire → Fire IV ×2</b> until the MP runs out, then <b>Blizzard III → Thunder → Blizzard IV</b> while Umbral Ice III refills it (about 62% a tick). <b>Thunder</b> (30 + ${V.tdot || 40} × 18s) is the usual DoT; every tick has a ${(V.tc || 0.1) * 100}% chance of <b>Thundercloud</b>, which makes the next Thunder free and instant with its whole DoT on the hit (Thunder III then hits for ${(V.t3 || 70) + (V.tdot || 40) * 8}). Sharpcast guarantees Firestarter or Thundercloud. <b>Convert</b> gives 30% MP for 20% HP; <b>Raging Strikes</b> (+20%), Ley Lines (15% faster casts in the circle), Swiftcast and the potion go together.</p>
<h3>The opener (the FFXIV wiki's 3.x Black Mage page)</h3>
${seq(['sharpcast', 'fire', ['leyLines'], ['enochian'], ['ragingStrikes'], 'fire3', ['tincture'], 'fire4', 'fire4', 'fire4', 'fire', ['swiftcast'], 'fire4', ['convert'], 'fire4', 'fire4', 'blizzard3', 'thunder', 'blizzard4'])}
<p>Fire before the pull with Sharpcast for a free Fire III, then Enochian. Thunder in Umbral Ice; use Thundercloud procs in Astral Fire in place of a Fire IV.</p>
<p style="color:#a9a3b4">${V.chain ? 'As 3.57 but Thunder DoTs 35 and Thunder III 60;' : 'The 3.57 numbers:'} Fire 180, Blizzard 180, Fire III and Blizzard III 240, Fire IV and Blizzard IV 280, Thunder 30 + 40 × 18s, Thunder II 50 + 40 × 21s, Thunder III 70 + 40 × 24s, Scathe 100, Flare 260, Enochian ×1.05, Astral Fire III ×1.8. MP costs are Heavensward's; the 11,400 MP pool is an estimate. Heavensward's formula is the community fit (Dervy, 2015–16). Gear: ${V.gear}, with the ${V.potion[0]} (max ${V.potion[1]}).</p>`;
    }
  }

  B.registerJob({
    id: 'blm', name: 'Black Mage', abbr: 'BLM', role: 'caster', classJob: 25,
    versions: ['hw32', 'hw305', 'hw30', 'arr20'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new BlackMageHW(v) })),
  });
})(window.BLM);

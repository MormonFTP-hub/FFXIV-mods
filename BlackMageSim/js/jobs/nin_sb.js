// Ninja, Stormblood 4.0–4.58 at level 70. Built on the Heavensward class (nin_hw.js) for Huton, the mudras off the GCD
// with Ninjutsu's 20s recast and Rabbit Medium, Suiton into Trick Attack, Kassatsu and Duality. What Stormblood changed:
// Kiss of the Viper, Dancing Edge, Mutilate and Sneak Attack are gone; Dripping Blades II makes physical actions 20%
// stronger instead (not the magic Ninjutsu, Bhavacakra or Hellfrog Medium); Shadow Fang comes from Gust Slash and also
// lowers slashing resistance 10%; the Ninki Gauge fills from auto-attacks (+6) and Mug (+30) and pays 80 for Bhavacakra
// (600), Hellfrog Medium (400) or Ten Chi Jin, which turns the next three mudras into Ninjutsu at double potency, one
// after another (Fuma → a two-sign → a three-sign; 1s each, nothing else usable, no repeats). Duality's second hit can
// crit since 4.0. The 4.1–4.58 numbers (4.05 cut Gust Slash's combo to 200, 4.06 made Aeolian Edge 280 / 340 rear,
// 4.1 Doton 45); True North is 150s, as it was until 4.5. Numbers are the game data at 4.11–4.58 (xivapi's datamining)
// and the Lodestone notes; gear is a rough Alphascape Savage set, pre-6.0 stats from the 4.58 Item.csv.
(function (B) {
  const EPS = 1e-6;
  const NINKI_MAX = 100, TCJ_DUR = 10;
  const HW = B.NinjaHW;
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const set = B.setAction;     // a version's change to an action (its description's numbers follow the potency)

  function jutsuFor(seq) {
    if (!seq.length) return null;
    if (seq.length === 1) return 'fumaShuriken';
    if (new Set(seq).size !== seq.length) return 'rabbitMedium';
    const last = seq[seq.length - 1];
    if (seq.length === 2) return last === 'chi' ? 'raiton' : last === 'ten' ? 'katon' : 'hyoton';
    return last === 'ten' ? 'huton' : last === 'jin' ? 'suiton' : 'doton';
  }

  class NinjaSB extends HW {
    constructor() {
      super();
      this.level = 70;
      this.levelKey = 'sb70';
      this.model = 'nin-sb';
      const A = Object.assign({}, this.actions);
      for (const k of ['dancingEdge', 'mutilate', 'sneakAttack', 'kissOfTheWasp', 'kissOfTheViper', 'internalRelease', 'bloodForBlood',
        'featherfoot', 'mantra', 'keenFlurry', 'feint', 'invigorate', 'secondWind', 'goad']) delete A[k];
      set(A, 'aeolianEdge', { comboPotency: 280, posBonus: 60, tp: 40, desc: 'Delivers an attack with a potency of 100.\n160 when executed from a target\'s rear.\nCombo Action: Gust Slash\nCombo Potency: 280\nRear Combo Potency: 340' });
      set(A, 'armorCrush', { comboPotency: 240, posBonus: 60, tp: 40, desc: 'Delivers an attack with a potency of 100.\n160 when executed from a target\'s flank.\nCombo Action: Gust Slash\nCombo Potency: 240\nFlank Combo Potency: 300\nCombo Bonus: Extends Huton duration by 30s to a maximum of 70s' });
      set(A, 'shadowFang', { comboFrom: 'gustSlash', tp: 40, dot: { potency: 40, duration: 21 }, desc: 'Delivers an attack with a potency of 100.\nCombo Action: Gust Slash\nCombo Potency: 200\nCombo Bonus: Damage over time\nPotency: 40\nDuration: 21s\nCombo Bonus: Reduces target\'s slashing resistance by 10%\nDuration: 21s' });
      set(A, 'trickAttack', { desc: 'Delivers an attack with a potency of 240.\n400 when executed from a target\'s rear.\nRear Bonus: Increases damage taken by target by 10%\nDuration: 10s\nCan only be executed while under the effect of Hidden or Suiton.' });
      set(A, 'mug', { desc: 'Delivers an attack with a potency of 140.\nAdditional Effect: Steal an item from target\nAdditional Effect: Increases Ninki Gauge by 30' });
      set(A, 'jugulate', { desc: 'Delivers an attack with a potency of 80.\nAdditional Effect: Silence\nDuration: 1s' });
      set(A, 'dreamWithinADream', { potency: 150, recast: 60, desc: 'Delivers a threefold attack, each hit with a potency of 150.' });
      set(A, 'duality', { desc: 'The next single-target weaponskill strikes twice. Combo bonuses and additional effects apply only once.\nDuration: 10s' });
      set(A, 'doton', { dot: { potency: 45, duration: 24, aoe: true }, desc: A.doton.desc.replace('potency of 40', 'potency of 45') });
      for (const k of ['fumaShuriken', 'katon', 'raiton', 'hyoton', 'suiton', 'doton']) set(A, k, { magic: k !== 'fumaShuriken' });
      A.bhavacakra = ab({ name: 'Bhavacakra', potency: 600, recast: 50, ninki: 80, magic: true, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'gnbBurst', desc: 'Deals unaspected damage with a potency of 600.\nNinki Gauge Cost: 80' });
      A.hellfrogMedium = ab({ name: 'Hellfrog Medium', potency: 400, recast: 1, ninki: 80, magic: true, target: true, range: 25, aoe: true, delay: 0.7, fx: 'slashFire', desc: 'Deals fire damage with a potency of 400 to target and all enemies nearby it.\nNinki Gauge Cost: 80' });
      A.tenChiJin = ab({ name: 'Ten Chi Jin', recast: 100, ninki: 80, desc: 'Resets the Ninjutsu recast timer. The next three mudra each execute a Ninjutsu at double potency: the first is Fuma Shuriken, the next two the Ninjutsu the signs so far make.\nDuration: 10s\nOnly mudra can be used during the effect, and the same Ninjutsu can\'t be executed twice. Ninjutsu\'s recast starts when the effect ends.\nNinki Gauge Cost: 80' });
      // Stormblood's melee role actions (five could be slotted).
      A.trueNorth = ab({ name: 'True North', recast: 150, role: true, desc: 'Nullifies all action direction requirements.\nDuration: 15s' });
      A.invigorate2 = ab({ name: 'Invigorate', recast: 120, role: true, desc: 'Instantly restores 400 TP.' });
      A.feint2 = ab({ name: 'Feint', recast: 120, role: true, target: true, range: 10, desc: 'Lowers target\'s strength and dexterity by 10%.\nDuration: 10s' });
      A.bloodbath = ab({ name: 'Bloodbath', recast: 90, role: true, desc: 'Converts a portion of physical damage dealt into HP.\nDuration: 20s' });
      A.secondWind2 = ab({ name: 'Second Wind', recast: 120, role: true, desc: 'Instantly restores own HP.\nCure Potency: 500' });
      A.armsLength = ab({ name: 'Arm\'s Length', recast: 60, role: true, desc: 'Creates a barrier nullifying most knockback and draw-in effects.\nDuration: 5s' });
      A.legSweep = ab({ name: 'Leg Sweep', recast: 40, role: true, target: true, range: 3, desc: 'Stuns target.\nDuration: 3s' });
      A.goad2 = ab({ name: 'Goad', recast: 180, role: true, desc: 'Refreshes TP of a party member.\nDuration: 30s\nCannot be used on yourself.' });
      A.tincture = B.tincture('dex3sb');
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        tenChiJin: { name: 'Ten Chi Jin', self: true, icon: 'st_tcj' },
        trueNorth: { name: 'True North', self: true, icon: 'st_truenorth' },
        bloodbath: { name: 'Bloodbath', self: true, icon: 'st_bloodbath' },
        armsLength: { name: 'Arm\'s Length', self: true, icon: 'st_armslength' },
        feint: { name: 'Feint', self: false, icon: 'st_feint' },
        shadowFangSlash: { name: 'Slashing Resistance Down', self: false, icon: 'st_slash' },
      });
      // A rough 4.5 Alphascape set (the Omega Sickles: 109 weapon damage, 2.56 delay), no Skill Speed: 2.50, 2.12 under
      // Huton. Ninja's Dexterity modifier is 110; Dripping Blades II is in the snapshot (physical only).
      this.stats = { hp: 31000, main: 3202, mainStat: 'dex', jobMod: 110, trait: 100, wd: 109, det: 1948, crit: 2426, dh: 1625, speed: 364, delay: 2.56 };
      this.autoAttack = { potency: 110, delay: 2.56, range: B.MELEE_RANGE };
      this.comboTime = 10;
      this.selfStatusOrder = ['huton', 'mudra', 'tenChiJin', 'kassatsu', 'suiton', 'hidden', 'duality', 'trueNorth', 'shadeShift', 'shadewalker',
        'bloodbath', 'armsLength', 'medicated', 'sprint'];
      this.targetStatusOrder = ['trickAttack', 'shadowFangSlash', 'shadowFang', 'doton', 'feint'];
      this.defaultBars = [
        ['spinningEdge', 'gustSlash', 'aeolianEdge', 'armorCrush', 'shadowFang', 'ten', 'chi', 'jin', 'ninjutsu', 'trickAttack', 'bhavacakra', 'tenChiJin'],
        ['mug', 'jugulate', 'dreamWithinADream', 'duality', 'kassatsu', 'hellfrogMedium', 'trueNorth', 'invigorate2', 'tincture', 'shadeShift', 'bloodbath', 'feint2'],
        ['deathBlossom', 'throwingDagger', 'assassinate', 'hide', 'shukuchi', 'shadewalker', 'smokeScreen', 'goad2', 'secondWind2', 'armsLength', 'legSweep', 'sprint'],
      ];
      this.actionGroups = [
        ['Ninja', ['spinningEdge', 'gustSlash', 'aeolianEdge', 'armorCrush', 'shadowFang', 'deathBlossom', 'throwingDagger', 'trickAttack', 'mug',
          'jugulate', 'dreamWithinADream', 'assassinate', 'bhavacakra', 'hellfrogMedium', 'tenChiJin', 'duality', 'kassatsu', 'hide', 'shukuchi',
          'shadeShift', 'shadewalker', 'smokeScreen']],
        ['Ninjutsu', ['ten', 'chi', 'jin', 'ninjutsu']],
        ['Role Actions', ['trueNorth', 'invigorate2', 'feint2', 'bloodbath', 'secondWind2', 'armsLength', 'legSweep', 'goad2']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 6620;     // a scripted rotation parses about 6,250 on the dummy
      this.referenceGcd = 2.12;
    }

    initGauge() { return { mudras: [], mudraUntil: 0, broken: false, ninki: 0, tcj: false }; }

    check(id, e) {
      const a = this.actions[id];
      if (e.has('tenChiJin') && !a.mudra && id !== 'sprint') return 'Unable to execute action during Ten Chi Jin.';
      if (a.ninki && e.g.ninki < a.ninki) return 'Not enough Ninki.';
      return super.check(id, e);
    }

    // Dripping Blades II (+20%) and Shadow Fang's slashing debuff (+10%) for physical actions; Trick Attack for all.
    snapshot(a, e) {
      let mult = 1;
      const physical = !a || (!a.magic && !a.auto);
      if (physical) mult *= 1.20;
      if ((!a || !a.magic) && e.tHas('shadowFangSlash')) mult *= 1.10;
      if (e.tHas('trickAttack')) mult *= 1.10;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES.dex3sb.cap : 0);
      return { mult, main };
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.ninki) g.ninki -= a.ninki;
      if (a.mudra && e.has('tenChiJin')) { this.tcjMudra(id, e); return; }
      if (g.mudras.length && !a.mudra && !a.jutsu) g.broken = true;
      switch (id) {
        case 'tenChiJin': {
          this.clearMudras(e);
          const c = e.cd('ten'); c.charges = c.max; c.nextAt = null;
          g.tcj = true;
          e.addStatus('tenChiJin', TCJ_DUR);
          return;
        }
        case 'mug': g.ninki = Math.min(NINKI_MAX, g.ninki + 30); break;
        case 'trueNorth': e.addStatus('trueNorth', 15); return;
        case 'bloodbath': e.addStatus('bloodbath', 20); return;
        case 'armsLength': e.addStatus('armsLength', 5); return;
        case 'feint2': e.addTStatus('feint', 10); return;
        case 'invigorate2': e.tp = Math.min(this.tp.max, e.tp + 400); return;
      }
      super.resolve(id, e);
    }

    // As Heavensward's, without Dancing Edge; Shadow Fang's combo also lowers slashing resistance, and Duality's second
    // hit can crit (4.0 on).
    weaponskill(id, e) {
      const a = this.actions[id];
      const combo = !!a.comboFrom && e.lastComboHit;
      const pos = !!a.positional && e.positionalHit(a);
      const potency = (a.comboFrom && combo ? a.comboPotency : a.potency) + (pos ? a.posBonus : 0);
      const snap = this.snapshot(a, e);
      if (id === 'armorCrush' && combo && e.has('huton')) {
        const st = e.statuses.huton;
        st.until = Math.min(e.now + 70, st.until + 30);
      }
      const dot = a.dot && (id !== 'shadowFang' || combo);
      const after = dot ? () => { e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }); e.addTStatus('shadowFangSlash', 21); } : null;
      const opts = { positional: a.positional ? (pos ? 'hit' : 'miss') : null };
      if (e.has('duality') && !a.aoe && !a.role) {
        e.removeStatus('duality');
        e.queueHit(id, potency, snap, a.delay, after, opts);
        e.queueHit(id, potency, snap, a.delay + 0.25, null, opts);
        return;
      }
      e.queueHit(id, potency, snap, a.delay, after, opts);
    }

    // Under Ten Chi Jin each mudra is its Ninjutsu, at double potency, with a 1s lock.
    tcjMudra(id, e) {
      const g = e.g;
      g.mudras.push(id);
      const jutsu = jutsuFor(g.mudras);
      e.lockUntil = Math.max(e.lockUntil, e.now + 1.0);
      e.emit('use', { id: jutsu, gcd: false, t: e.now });
      if (jutsu !== 'rabbitMedium') {
        const a = this.actions[jutsu];
        const crit = e.has('kassatsu');
        if (crit && a.potency) e.removeStatus('kassatsu');
        const snap = this.snapshot(a, e);
        snap.mult *= this.tcjMult || 2;
        if (jutsu === 'huton') e.addStatus('huton', 70);
        else if (jutsu === 'doton') {
          if (e.distToTarget() - B.DUMMY_RADIUS <= a.pbaoe) e.addTStatus('doton', a.dot.duration, { snap, dot: { potency: a.dot.potency, id: jutsu } });
        } else e.queueHit(jutsu, a.potency, snap, a.delay, jutsu === 'suiton' ? () => e.addStatus('suiton', 10) : null, { crit });
      }
      if (g.mudras.length >= 3 || jutsu === 'rabbitMedium') this.endTcj(e);
      else e.addStatus('mudra', TCJ_DUR, { stacks: g.mudras.length });
    }
    endTcj(e) {
      e.g.tcj = false;
      e.removeStatus('tenChiJin');
      this.clearMudras(e);
      e.startCd('ten');
    }

    // Shukiho: each auto-attack that lands adds 6 Ninki.
    onHit(h, r, e) { if (h.auto && !h.extra) e.g.ninki = Math.min(NINKI_MAX, e.g.ninki + 6); }

    nextEvent(e) {
      if (e.g.tcj) return e.has('tenChiJin') ? e.statuses.tenChiJin.until : e.now;
      return super.nextEvent(e);
    }
    process(e) {
      if (e.g.tcj && !e.has('tenChiJin')) { this.endTcj(e); return; }
      if (!e.g.tcj) super.process(e);
    }

    proc(id, e) {
      const a = this.actions[id];
      if (a.ninki) return e.g.ninki >= a.ninki;
      return super.proc(id, e);
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)}, ${e.gcdForSpeed(e.stats.speed, 15).toFixed(2)} under Huton`; }

    // ---------- Huton, the mudras and the Ninki Gauge ----------
    gaugeBuild(root) {
      super.gaugeBuild(root);
      const svg = root.querySelector('svg');
      svg.setAttribute('height', '150'); svg.setAttribute('viewBox', '0 0 360 150');
      svg.querySelector('rect').setAttribute('height', '130');
      svg.insertAdjacentHTML('beforeend', `
  <text x="24" y="128" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">NINKI</text>
  <rect x="74" y="118" width="200" height="12" rx="6" fill="#2a2535" stroke="rgba(0,0,0,.8)"/>
  <rect id="nn-k" x="74" y="118" width="0" height="12" rx="6" fill="#c05bd6"/>
  <text id="nn-kt" x="336" y="130" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">0</text>`);
      this.ng.k = root.querySelector('#nn-k'); this.ng.kt = root.querySelector('#nn-kt');
    }
    gaugeUpdate(e) {
      super.gaugeUpdate(e);
      const G = this.ng, c = G.cache, n = e.g.ninki;
      if (c.k !== n) {
        c.k = n;
        G.k.setAttribute('width', String(200 * n / NINKI_MAX));
        G.k.setAttribute('fill', n >= 80 ? '#e88bff' : '#c05bd6');
        G.kt.textContent = String(n);
      }
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Stormblood 4.0–4.58)</h3>
<p>Level 70 Ninja on TP. Keep <b>Huton</b> up (+15% weaponskill and auto-attack speed, 70s): <b>Spinning Edge → Gust Slash → Armor Crush</b> (flank, 300) adds 30s. <b>Shadow Fang</b> (Gust Slash's third finisher: 200 + 40 × 21s) also lowers the dummy's slashing resistance 10%, for your physical hits; otherwise finish with <b>Aeolian Edge</b> from the rear (340). Dripping Blades II makes physical actions 20% stronger.</p>
<p><b>Ten, Chi and Jin</b> are off the GCD and share Ninjutsu's 20s recast: weave the signs and press <b>Ninjutsu</b> (two signs ending in Chi: <b>Raiton</b> 360; three ending in Jin: <b>Suiton</b>, which allows <b>Trick Attack</b>: 400 from the rear, then +10% damage taken for 10s). Any other action between them, or a repeat, makes Rabbit Medium. <b>Kassatsu</b> resets Ninjutsu with a sure crit; <b>Duality</b> makes the next weaponskill (Aeolian Edge) hit twice.</p>
<p>The <b>Ninki Gauge</b> fills from auto-attacks (+6) and <b>Mug</b> (+30) and spends 80 on <b>Bhavacakra</b> (600, 50s), <b>Hellfrog Medium</b> (400) or <b>Ten Chi Jin</b> (100s): the next three signs each fire a Ninjutsu at double potency, Fuma Shuriken (480) then Raiton (720) then Suiton (360) for Ten → Chi → Jin, with nothing else usable until it ends.</p>
<h3>The opener (Kyo's 4.4 guide, "5th GCD Trick Attack")</h3>
${seq([['jin'], ['chi'], ['ten'], ['huton'], ['hide'], ['ten'], ['chi'], ['jin'], ['suiton'], 'spinningEdge', ['kassatsu'], 'gustSlash', ['tincture'], 'shadowFang', ['mug'], 'spinningEdge', ['jugulate'], 'gustSlash', ['trickAttack'], 'aeolianEdge', ['ten'], ['raiton'], 'spinningEdge', ['dreamWithinADream'], 'gustSlash', ['duality'], 'aeolianEdge', ['bhavacakra']])}
<p>Huton and Hide about 10s before the pull, Suiton just before it. Kyo's guide puts Fuma Shuriken after Kassatsu; a critical Raiton inside Trick Attack is the usual choice. Use Ten Chi Jin (Fuma → Raiton → Suiton) when Trick Attack is a GCD away, for the Suiton.</p>
<p style="color:#a9a3b4">The 4.1–4.58 numbers: Spinning Edge 150, Gust Slash combo 200, Aeolian Edge combo 280 (340 rear), Armor Crush combo 240 (300 flank), Shadow Fang combo 200 + 40 × 21s, Trick Attack 240 (400 rear), Mug 140, Jugulate 80, Dream Within a Dream 3 × 150, Bhavacakra 600, Hellfrog Medium 400, Fuma Shuriken 240, Katon 250, Raiton 360, Suiton 180, Doton 45 × 24s. Whether Shadow Fang's slashing debuff raised the Ninja's own damage isn't settled; here it does, for physical hits. Mudra and Ninjutsu animation locks are estimates. Gear: a rough Alphascape set (Dexterity 3,202, 109 weapon damage) with the Grade 3 Infusion.</p>`;
    }
  }

  B.NinjaSB = NinjaSB;
  B.registerJob({
    id: 'nin', name: 'Ninja', abbr: 'NIN', role: 'melee', classJob: 30,
    versions: [{ id: 'sb40', label: 'Stormblood 4.0–4.58', history: 'SB 4.0–4.58', note: 'Level 70. The Ninki Gauge from auto-attacks and Mug for Bhavacakra and Ten Chi Jin, Huton, Suiton into Trick Attack, Kassatsu, Duality, Shadow Fang\'s slashing debuff; the 4.1 numbers and Alphascape gear', create: () => new NinjaSB() }],
  });
})(window.BLM);

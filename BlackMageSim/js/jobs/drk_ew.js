// Dark Knight, Endwalker at level 90 (three versions) and Dawntrail at level 100. Built on the Shadowbringers class
// (drk_shb.js): Hard Slash → Syphon Strike (MP) → Souleater (+20 Blood), Bloodspiller, Edge of Shadow for Darkside
// (+10%, 30s a time up to 60s), Living Shadow. Endwalker adds Shadowbringer (600, two charges, under Darkside), Salt
// and Darkness (500, inside Salted Earth), a 1s Edge recast, a 60s Delirium with three free Bloodspillers, and Carve
// and Spit sharing its 60s with Abyssal Drain.
//  - 6.0–6.08: Blood Weapon is a 10s window (+10 Blood and 600 MP a GCD); Living Shadow 24s, seven attacks.
//  - 6.1–6.18: Blood Weapon is five stacks for 15s, one per weaponskill or spell.
//  - 6.2–6.58: Abyssal Drain 240; Living Shadow 20s, six attacks of 350 (Shadowbringer 500), no Quietus.
//  - Dawntrail 7.0–7.57: Delirium also grants three Blood Weapon stacks (the button is gone), and under it Bloodspiller
//    plays Scarlet Delirium → Comeuppance → Torcleaver; Living Shadow costs nothing and grants Scorn for Disesteem
//    (1,000); Shadowstride replaces Plunge with no damage. 7.2–7.57's numbers (7.4's 22s Living Shadow).
// Numbers are the game data at 6.0, 6.1, 6.2, 6.58, 7.05, 7.1, 7.2 and 7.57 (xivapi's datamining) and the Lodestone
// notes; gear is The Balance's set for each tier. Living Shadow's attacks are counted, as in Shadowbringers, at 1.2× your
// potency without Darkside. ref: a scripted bot parses about 5,550 / 5,420 / 8,570 / 25,370 on these.
(function (B) {
  const ShB = B.DarkKnightShB;
  const VERSIONS = {
    ew60: { label: 'Endwalker 6.0–6.08', history: 'EW 6.0–6.08', shadowWall: 15, reprisal: 10, tincture: 'str6', gcd: 2.45, drain: 150, bwStacks: 0, ref: 5890,
      shadow: { dur: 24, hits: [300, 300, 300, 450, 300, 300, 300] },
      stats: { hp: 85094, main: 2521, wd: 120, det: 1680, crit: 2319, dh: 1012, speed: 650, ten: 527 },
      gear: 'The Balance\'s 6.05 Asphodelos set at 2.45 (Strength 2,521), with a Grade 6 Tincture',
      note: 'Level 90 at launch: Shadowbringer, Salt and Darkness, a 60s three-stack Delirium, Blood Weapon a 10s window, a 24s Living Shadow; Asphodelos gear' },
    ew61: { label: 'Endwalker 6.1–6.18', history: 'EW 6.1–6.18', shadowWall: 15, reprisal: 10, tincture: 'str6', gcd: 2.5, drain: 150, bwStacks: 5, ref: 5750,
      shadow: { dur: 24, hits: [300, 300, 300, 450, 300, 300, 300] },
      stats: { hp: 85406, main: 2528, wd: 120, det: 1845, crit: 2206, dh: 904, speed: 400, ten: 802 },
      gear: 'The Balance\'s 6.1 Asphodelos set at 2.50 (Strength 2,528), with a Grade 6 Tincture',
      note: 'Level 90: Blood Weapon becomes five stacks for 15s, so a 2.50 GCD loses nothing; Asphodelos gear' },
    ew62: { label: 'Endwalker 6.2–6.58', history: 'EW 6.2–6.58', shadowWall: 15, reprisal: 10, tincture: 'str', gcd: 2.5, drain: 240, bwStacks: 5, ref: 9080,
      shadow: { dur: 20, hits: [350, 350, 500, 350, 350, 350] },
      stats: { hp: 122878, main: 3330, wd: 132, det: 2182, crit: 2576, dh: 940, speed: 400, ten: 529 },
      gear: 'The Balance\'s 6.4 Anabaseios set at 2.50 (Strength 3,330), with a Grade 8 Tincture',
      note: 'Level 90: Abyssal Drain 240, a 20s Living Shadow of six 350-potency attacks (Shadowbringer 500); Anabaseios gear' },
    dt70: { label: 'Dawntrail 7.0–7.57', history: 'DT 7.0–7.57', shadowWall: 15, reprisal: 10, tincture: 'strdt4', gcd: 2.5, drain: 240, bwStacks: 3, ref: 26890,
      shadow: { dur: 22, hits: [420, 570, 420, 620], at: [6, 11, 13.5, 16] },
      stats: { hp: 325262, main: 6472, wd: 158, det: 3066, crit: 3595, dh: 1230, speed: 420, ten: 622 },
      gear: 'The Balance\'s 7.55 savage set at 2.50 (Strength 6,472, 158 weapon damage), with a Grade 4 Gemdraught',
      note: 'Level 100: Delirium into Scarlet Delirium, Comeuppance and Torcleaver with three Blood Weapon stacks, a free Living Shadow and Disesteem; 7.2–7.57\'s numbers' },
  };
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.55, fx: 'gnbSlash' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const set = B.setAction;     // a version's change to an action (its description's numbers follow the potency)
  const CHAIN = ['scarletDelirium', 'comeuppance', 'torcleaver'];

  class DarkKnightEW extends ShB {
    constructor(version) {
      super('shb51');
      const V = VERSIONS[version];
      this.V = V;
      this.level = 90;
      this.levelKey = 90;
      this.model = 'drk-ew';
      this.autoAttack = { potency: 90, delay: 2.96, range: B.MELEE_RANGE };
      const A = Object.assign({}, this.actions);
      set(A, 'hardSlash', { potency: 170, desc: 'Delivers an attack with a potency of 170.' });
      set(A, 'syphonStrike', { potency: 120, comboPotency: 260, desc: 'Delivers an attack with a potency of 120.\nCombo Action: Hard Slash\nCombo Potency: 260\nCombo Bonus: Restores 600 MP' });
      set(A, 'souleater', { potency: 120, comboPotency: 340, desc: 'Delivers an attack with a potency of 120.\nCombo Action: Syphon Strike\nCombo Potency: 340\nCombo Bonus: Restores own HP\nCombo Bonus: Increases Blood Gauge by 20' });
      set(A, 'bloodspiller', { potency: 500, desc: 'Delivers an attack with a potency of 500.\nBlood Gauge Cost: 50\nDelirium: no cost, and restores MP.' });
      set(A, 'quietus', { potency: 200, desc: 'Delivers an attack with a potency of 200 to all nearby enemies.\nBlood Gauge Cost: 50\nDelirium: no cost, and restores MP.' });
      set(A, 'unleash', { potency: 120, desc: 'Deals unaspected damage with a potency of 120 to all nearby enemies.' });
      set(A, 'stalwartSoul', { comboPotency: 140, desc: 'Deals unaspected damage with a potency of 100 to all nearby enemies.\nCombo Action: Unleash\nCombo Potency: 140\nCombo Bonus: Restores 600 MP\nCombo Bonus: Increases Blood Gauge by 20' });
      set(A, 'edgeOfShadow', { recast: 1, potency: 460, desc: 'Deals unaspected damage with a potency of 460.\nAdditional Effect: Grants Darkside, increasing damage dealt by 10%\nDuration: 30s (extends up to 60s)\nMP Cost: 3,000\nShares a recast timer with Flood of Shadow.' });
      set(A, 'floodOfShadow', { recast: 1, potency: 160, desc: 'Deals unaspected damage with a potency of 160 to all enemies in a straight line before you.\nAdditional Effect: Grants Darkside\nMP Cost: 3,000\nShares a recast timer with Edge of Shadow.' });
      set(A, 'carveAndSpit', { potency: 510, cdGroup: 'carve', desc: 'Delivers a threefold attack with a potency of 510.\nAdditional Effect: Restores 600 MP\nShares a recast timer with Abyssal Drain.' });
      set(A, 'abyssalDrain', { potency: V.drain, cdGroup: 'carve', desc: `Deals unaspected damage with a potency of ${V.drain} to target and all enemies nearby it.\nAdditional Effect: Restores own HP and 600 MP\nShares a recast timer with Carve and Spit.` });
      set(A, 'plunge', { potency: 150, desc: 'Delivers a jumping attack with a potency of 150.\nMaximum Charges: 2\nCannot be executed while bound.' });
      set(A, 'saltedEarth', { potency: 50, dot: { potency: 50, duration: 15 }, desc: 'Creates a patch of salted earth, dealing unaspected damage with a potency of 50 to any enemies who enter.\nDuration: 15s\nSalted Earth changes to Salt and Darkness while it is active.' });
      A.saltAndDarkness = ab({ name: 'Salt and Darkness', recast: 20, potency: 500, target: true, range: B.MELEE_RANGE, aoe: 0.5, delay: 0.6, fx: 'gnbBow', desc: 'Deals unaspected damage with a potency of 500 to all enemies in your Salted Earth.\nCan only be executed while Salted Earth is active.' });
      A.shadowbringer = ab({ name: 'Shadowbringer', recast: 60, charges: 2, potency: 600, target: true, range: 10, aoe: 0.5, delay: 0.6, fx: 'gnbZone', desc: 'Deals unaspected damage to all enemies in a straight line before you with a potency of 600 for the first enemy, and 50% less for all remaining enemies.\nMaximum Charges: 2\nCan only be executed while under the effect of Darkside.' });
      A.oblation = ab({ name: 'Oblation', recast: 60, charges: 2, desc: 'Reduces damage taken by target party member or self by 10%.\nDuration: 10s\nMaximum Charges: 2' });
      set(A, 'bloodWeapon', { desc: V.bwStacks ? `Grants ${V.bwStacks} stacks of Blood Weapon: each weaponskill or spell that lands uses one, increasing Blood Gauge by 10 and restoring 600 MP.\nDuration: 15s` : 'Increases Blood Gauge by 10 and restores 600 MP upon landing weaponskills or spells.\nDuration: 10s' });
      set(A, 'delirium', { recast: 60, desc: 'Grants 3 stacks of Delirium: Bloodspiller and Quietus cost no Blood, each using one and restoring MP.\nDuration: 15s' });
      set(A, 'livingShadow', { desc: `Conjure a simulacrum of your darkside to fight alongside you.\nSimulacrum Attack Potency: ${V.shadow.hits[0]}\nDuration: ${V.shadow.dur}s\nBlood Gauge Cost: 50` });
      A.tincture = B.tincture(V.tincture);
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, { oblation: { name: 'Oblation', self: true, icon: 'st_wall' } });
      this.stats = Object.assign({ mainStat: 'str', jobMod: 105, trait: 100, delay: 2.96 }, V.stats);
      this.selfStatusOrder = ['darkside', 'bloodWeapon', 'delirium', 'darkArts', 'blackestNight', 'grit', 'medicated', 'rampart', 'shadowWall',
        'darkMind', 'oblation', 'livingDead', 'darkMissionary', 'armsLength', 'sprint'];
      this.defaultBars = [
        ['hardSlash', 'syphonStrike', 'souleater', 'bloodspiller', 'edgeOfShadow', 'bloodWeapon', 'delirium', 'livingShadow', 'carveAndSpit', 'shadowbringer', 'plunge', 'saltedEarth'],
        ['unmend', 'tincture', 'grit', 'theBlackestNight', 'rampart', 'shadowWall', 'darkMind', 'oblation', 'livingDead', 'darkMissionary', 'reprisal', 'provoke'],
        ['unleash', 'stalwartSoul', 'quietus', 'floodOfShadow', 'abyssalDrain', 'saltAndDarkness', 'shirk', 'lowBlow', 'interject', 'armsLength', 'sprint', null],
      ];
      this.actionGroups = [
        ['Dark Knight', ['hardSlash', 'syphonStrike', 'souleater', 'bloodspiller', 'quietus', 'unleash', 'stalwartSoul', 'unmend', 'edgeOfShadow',
          'floodOfShadow', 'shadowbringer', 'bloodWeapon', 'delirium', 'livingShadow', 'carveAndSpit', 'abyssalDrain', 'plunge', 'saltedEarth',
          'saltAndDarkness', 'theBlackestNight', 'grit', 'shadowWall', 'darkMind', 'oblation', 'livingDead', 'darkMissionary']],
        ['Role Actions', ['rampart', 'lowBlow', 'provoke', 'interject', 'reprisal', 'armsLength', 'shirk']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = V.gcd;
    }

    // Salted Earth's button becomes Salt and Darkness while the patch is down.
    resolveId(id, e) {
      if (id === 'saltedEarth' && e.tHas('saltedEarth')) return 'saltAndDarkness';
      return id;
    }

    check(id, e) {
      if (id === 'shadowbringer' && !e.has('darkside')) return 'Unable to execute action. Darkside required.';
      if (id === 'saltAndDarkness' && !e.tHas('saltedEarth')) return 'Unable to execute action. Salted Earth required.';
      return super.check(id, e);
    }

    useStack(e, key) {
      const s = e.statuses[key];
      if (!s) return;
      s.stacks = (s.stacks || 1) - 1;
      if (s.stacks <= 0) e.removeStatus(key); else e.emit('statusStack', { key });
    }

    livingShadow(e) {
      const S = this.V.shadow, g = e.g;
      g.shadowUntil = e.now + S.dur;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      S.hits.forEach((p, k) => e.queueHit('livingShadow', p, { mult: 1.2, main }, S.at ? S.at[k] : 6 + k * 2.5));
    }

    resolve(id, e) {
      const a = this.actions[id], V = this.V;
      switch (id) {
        case 'bloodWeapon':
          if (V.bwStacks) e.addStatus('bloodWeapon', 15, { stacks: V.bwStacks }); else e.addStatus('bloodWeapon', 10.6);
          return;
        case 'delirium': e.addStatus('delirium', 15, { stacks: 3 }); return;
        case 'livingShadow': if (a.cost) this.blood(e, -a.cost); this.livingShadow(e); return;
        case 'oblation': e.addStatus('oblation', 10); return;
      }
      const delUse = !!(a.cost && a.delirium && e.has('delirium'));
      const bwUse = !!(V.bwStacks && a.kind === 'gcd' && a.potency && e.has('bloodWeapon'));
      super.resolve(id, e);
      if (delUse) this.useStack(e, 'delirium');
      if (bwUse) this.useStack(e, 'bloodWeapon');
      if (id === 'abyssalDrain') this.gainMp(e, 600);
    }

    proc(id, e) {
      if (id === 'shadowbringer') return e.has('darkside');
      if (id === 'saltedEarth') return e.tHas('saltedEarth');
      return super.proc(id, e);
    }

    speedInfo(e) {
      const t = e.gcdForSpeed(e.stats.speed);
      return this.V.bwStacks ? `GCD ${t.toFixed(2)}` : `GCD ${t.toFixed(2)} · Blood Weapon fits ${Math.floor(10 / t) + 1} GCDs when used late`;
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 90 Dark Knight. <b>Hard Slash → Syphon Strike → Souleater</b>: Syphon Strike's combo restores 600 MP, Souleater's adds 20 Blood. Spend 3,000 MP on <b>Edge of Shadow</b> (460, a 1s recast now), which keeps <b>Darkside</b> up (+10% damage; each Edge adds 30s, up to 60s), and 50 Blood on <b>Bloodspiller</b> (500). <b>Shadowbringer</b> (600, two charges, 60s) needs Darkside.</p>
<p>Every minute: <b>Blood Weapon</b> (${V.bwStacks ? 'five stacks for 15s: each weaponskill or spell that lands uses one for 10 Blood and 600 MP' : 'a 10s window: 10 Blood and 600 MP for every GCD that lands; weave it late so five fit'}), <b>Delirium</b> (three free Bloodspillers within 15s, each restoring 200 MP), <b>Carve and Spit</b> (510, sharing its 60s with Abyssal Drain), and Edges and Shadowbringer inside. <b>Salted Earth</b> (90s) turns its button into <b>Salt and Darkness</b> (500) while it's down. Every two minutes, 50 Blood summons <b>Living Shadow</b> (${V.shadow.dur}s, ${V.shadow.hits.length} attacks).</p>
<h3>The opener (The Balance)</h3>
${seq(['bloodWeapon', 'hardSlash', ['edgeOfShadow'], ['delirium'], 'syphonStrike', ['tincture'], 'souleater', ['livingShadow'], ['saltedEarth'], 'hardSlash', ['shadowbringer'], ['edgeOfShadow'], 'bloodspiller', ['carveAndSpit'], ['plunge'], 'bloodspiller', ['shadowbringer'], ['edgeOfShadow'], 'bloodspiller', ['saltAndDarkness'], ['edgeOfShadow'], 'syphonStrike', ['plunge'], ['edgeOfShadow']])}
<p>Blood Weapon just before the pull (and The Blackest Night at -3s in a fight, for a free Edge when it breaks).</p>
<p style="color:#a9a3b4">${V.label} numbers: Hard Slash 170, Syphon Strike 260 and Souleater 340 in combo, Bloodspiller 500, Quietus 200, Edge of Shadow 460, Flood of Shadow 160, Shadowbringer 600, Carve and Spit 510, Abyssal Drain ${V.drain}, Plunge 150, Salted Earth 50 × 15s, Salt and Darkness 500, Living Shadow ${V.shadow.hits.join(' / ')} (counted at 1.2× your potency, without Darkside); auto-attacks 90 at 2.96s. How much MP a free Bloodspiller restores isn't in the tooltip (200 here). Gear: ${V.gear}.</p>`;
    }
  }

  class DarkKnightDT extends DarkKnightEW {
    constructor(version) {
      super(version);
      const V = this.V;
      this.level = 100;
      this.levelKey = 100;
      this.model = 'drk-dt';
      const A = Object.assign({}, this.actions);
      delete A.bloodWeapon; delete A.plunge; delete A.shadowWall;
      set(A, 'hardSlash', { potency: 300, desc: 'Delivers an attack with a potency of 300.' });
      set(A, 'syphonStrike', { potency: 240, comboPotency: 380, desc: 'Delivers an attack with a potency of 240.\nCombo Action: Hard Slash\nCombo Potency: 380\nCombo Bonus: Restores 600 MP' });
      set(A, 'souleater', { potency: 260, comboPotency: 480, desc: 'Delivers an attack with a potency of 260.\nCombo Action: Syphon Strike\nCombo Potency: 480\nCombo Bonus: Restores own HP\nCombo Bonus: Increases Blood Gauge by 20' });
      set(A, 'bloodspiller', { potency: 600, desc: 'Delivers an attack with a potency of 600.\nBlood Gauge Cost: 50\n※Changes to Scarlet Delirium, Comeuppance and Torcleaver under Delirium.' });
      set(A, 'quietus', { potency: 240, desc: 'Delivers an attack with a potency of 240 to all nearby enemies.\nBlood Gauge Cost: 50\n※Changes to Impalement under Delirium.' });
      set(A, 'stalwartSoul', { potency: 120, comboPotency: 160, desc: 'Deals unaspected damage with a potency of 120 to all nearby enemies.\nCombo Action: Unleash\nCombo Potency: 160\nCombo Bonus: Restores 600 MP\nCombo Bonus: Increases Blood Gauge by 20' });
      set(A, 'carveAndSpit', { potency: 540, desc: 'Delivers a threefold attack with a potency of 540.\nAdditional Effect: Restores 600 MP\nShares a recast timer with Abyssal Drain.' });
      for (const id of ['shadowbringer', 'saltAndDarkness']) set(A, id, { aoe: 0.75, desc: A[id].desc.replace('50% less', '25% less') });
      set(A, 'saltedEarth', { desc: 'Creates a patch of salted earth, dealing unaspected damage with a potency of 50 to any enemies who enter.\nDuration: 15s' });
      A.scarletDelirium = ws({ name: 'Scarlet Delirium', potency: 620, fx: 'gnbDouble', desc: 'Delivers an attack with a potency of 620.\nAdditional Effect: Restores 200 MP\nCan only be executed while under the effect of Delirium.' });
      A.comeuppance = ws({ name: 'Comeuppance', potency: 720, fx: 'gnbDouble', desc: 'Delivers an attack with a potency of 720.\nCombo Action: Scarlet Delirium\nAdditional Effect: Restores 200 MP' });
      A.torcleaver = ws({ name: 'Torcleaver', potency: 820, fx: 'gnbFang3', desc: 'Delivers an attack with a potency of 820.\nCombo Action: Comeuppance\nAdditional Effect: Restores 200 MP' });
      A.impalement = ws({ name: 'Impalement', potency: 300, target: false, pbaoe: 5, aoe: true, desc: 'Delivers an attack with a potency of 300 to all nearby enemies.\nAdditional Effect: Restores 500 MP\nCan only be executed while under the effect of Delirium.' });
      A.disesteem = ws({ name: 'Disesteem', potency: 1000, range: 10, aoe: 0.75, fx: 'gnbZone', desc: 'Deals unaspected damage to all enemies in a straight line before you with a potency of 1,000 for the first enemy, and 25% less for all remaining enemies.\nCan only be executed while under the effect of Scorn.' });
      A.shadowstride = ab({ name: 'Shadowstride', recast: 30, charges: 2, target: true, range: 20, desc: 'Move quickly to the specified target.\nMaximum Charges: 2\nCannot be executed while bound.' });
      A.shadowedVigil = ab({ name: 'Shadowed Vigil', recast: 120, desc: 'Reduces damage taken by 40%.\nDuration: 15s\nAdditional Effect: Vigilant (heals when HP falls low)' });
      set(A, 'delirium', { desc: 'Grants 3 stacks of Delirium and 3 stacks of Blood Weapon.\nDelirium: Bloodspiller plays Scarlet Delirium → Comeuppance → Torcleaver and Quietus plays Impalement, all without Blood.\nBlood Weapon: each weaponskill or spell that lands increases Blood Gauge by 10 and restores 600 MP.\nDuration: 15s' });
      set(A, 'livingShadow', { cost: undefined, desc: `Conjure a simulacrum of your darkside to fight alongside you.\nSimulacrum Attack Potency: 420\nDuration: ${V.shadow.dur}s\nAdditional Effect: Grants Scorn\nDuration: 30s` });
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        scorn: { name: 'Scorn', self: true, icon: 'st_delirium' },
        shadowedVigil: { name: 'Shadowed Vigil', self: true, icon: 'st_wall' },
      });
      this.selfStatusOrder = ['darkside', 'bloodWeapon', 'delirium', 'scorn', 'darkArts', 'blackestNight', 'grit', 'medicated', 'rampart', 'shadowedVigil',
        'darkMind', 'oblation', 'livingDead', 'darkMissionary', 'armsLength', 'sprint'];
      this.defaultBars = [
        ['hardSlash', 'syphonStrike', 'souleater', 'bloodspiller', 'edgeOfShadow', 'delirium', 'livingShadow', 'disesteem', 'carveAndSpit', 'shadowbringer', 'saltedEarth', 'saltAndDarkness'],
        ['unmend', 'tincture', 'grit', 'theBlackestNight', 'rampart', 'shadowedVigil', 'darkMind', 'oblation', 'livingDead', 'darkMissionary', 'reprisal', 'provoke'],
        ['unleash', 'stalwartSoul', 'quietus', 'floodOfShadow', 'abyssalDrain', 'shadowstride', 'shirk', 'lowBlow', 'interject', 'armsLength', 'sprint', null],
      ];
      this.actionGroups = [
        ['Dark Knight', ['hardSlash', 'syphonStrike', 'souleater', 'bloodspiller', 'scarletDelirium', 'comeuppance', 'torcleaver', 'quietus', 'impalement',
          'disesteem', 'unleash', 'stalwartSoul', 'unmend', 'edgeOfShadow', 'floodOfShadow', 'shadowbringer', 'delirium', 'livingShadow', 'carveAndSpit',
          'abyssalDrain', 'shadowstride', 'saltedEarth', 'saltAndDarkness', 'theBlackestNight', 'grit', 'shadowedVigil', 'darkMind', 'oblation',
          'livingDead', 'darkMissionary']],
        ['Role Actions', ['rampart', 'lowBlow', 'provoke', 'interject', 'reprisal', 'armsLength', 'shirk']],
        ['General', ['sprint', 'tincture']],
      ];
    }

    // Under Delirium, Bloodspiller plays the three-step chain (one per stack) and Quietus plays Impalement.
    resolveId(id, e) {
      if (e.has('delirium')) {
        if (id === 'bloodspiller') return CHAIN[3 - Math.min(3, e.statuses.delirium.stacks || 1)];
        if (id === 'quietus') return 'impalement';
      }
      return id;
    }

    check(id, e) {
      if ((CHAIN.includes(id) || id === 'impalement') && !e.has('delirium')) return 'Unable to execute action. Delirium required.';
      if (id === 'disesteem' && !e.has('scorn')) return 'Unable to execute action. Scorn required.';
      return super.check(id, e);
    }

    resolve(id, e) {
      switch (id) {
        case 'delirium':
          e.addStatus('delirium', 15, { stacks: 3 });
          e.addStatus('bloodWeapon', 15, { stacks: 3 });
          return;
        case 'livingShadow': e.addStatus('scorn', 30); this.livingShadow(e); return;
        case 'disesteem': e.removeStatus('scorn'); break;
        case 'shadowedVigil': e.addStatus('shadowedVigil', 15); return;
        case 'shadowstride': {
          const d = e.distToTarget() || 1;
          if (d > 2.6) {
            const from = { x: e.pos.x, z: e.pos.z };
            e.pos.x *= 2.4 / d; e.pos.z *= 2.4 / d;
            e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
          }
          return;
        }
      }
      if (CHAIN.includes(id) || id === 'impalement') { this.useStack(e, 'delirium'); this.gainMp(e, id === 'impalement' ? 500 : 200); }
      super.resolve(id, e);
    }

    proc(id, e) {
      if (id === 'bloodspiller') return e.g.blood >= 50 || e.has('delirium');
      if (id === 'disesteem') return e.has('scorn');
      return super.proc(id, e);
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)}`; }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 100 Dark Knight. <b>Hard Slash → Syphon Strike → Souleater</b> (600 MP, then 20 Blood); 50 Blood for <b>Bloodspiller</b> (600); 3,000 MP for <b>Edge of Shadow</b> (460), which keeps <b>Darkside</b> up (+10%, up to 60s). <b>Shadowbringer</b> (600, two charges) needs Darkside.</p>
<p><b>Delirium</b> (60s) gives three Delirium stacks and three Blood Weapon stacks: Bloodspiller plays <b>Scarlet Delirium → Comeuppance → Torcleaver</b> (620 / 720 / 820, free, 200 MP each) and each landing GCD adds 10 Blood and 600 MP. <b>Living Shadow</b> (120s, free) fights for ${V.shadow.dur}s and grants <b>Scorn</b> for <b>Disesteem</b> (1,000). <b>Carve and Spit</b> (540) shares its 60s with Abyssal Drain; <b>Salted Earth</b> (90s) enables <b>Salt and Darkness</b> (500). Shadowstride is just a dash now.</p>
<h3>The opener (The Balance, 7.01)</h3>
${seq(['unmend', ['tincture'], 'hardSlash', ['edgeOfShadow'], ['livingShadow'], 'syphonStrike', 'souleater', ['delirium'], 'disesteem', ['saltedEarth'], ['edgeOfShadow'], 'scarletDelirium', ['shadowbringer'], ['edgeOfShadow'], 'comeuppance', ['carveAndSpit'], ['edgeOfShadow'], 'torcleaver', ['shadowbringer'], ['edgeOfShadow'], 'bloodspiller', ['saltAndDarkness']])}
<p>The Blackest Night at -3s, Unmend at -1s to start on time; Disesteem goes before the Delirium chain so the MP doesn't overcap.</p>
<p style="color:#a9a3b4">${V.label} numbers (7.2–7.57): Hard Slash 300, Syphon Strike 380 and Souleater 480 in combo, Bloodspiller 600, Scarlet Delirium 620, Comeuppance 720, Torcleaver 820, Quietus 240, Impalement 300, Disesteem 1,000, Edge of Shadow 460, Shadowbringer 600, Carve and Spit 540, Abyssal Drain 240, Salted Earth 50 × 15s, Salt and Darkness 500; Living Shadow's Abyssal Drain 420, Shadowbringer 570, Bloodspiller 420 and Disesteem 620 (counted at 1.2× your potency). 7.0–7.01 had Hard Slash 260, the combo 360 / 460, Bloodspiller 580, the Delirium chain 600 / 700 / 800, Carve and Spit 510 and Disesteem 800; 7.05 raised the combo, Carve and Spit and Disesteem, 7.1 the Delirium chain. Gear: ${V.gear}.</p>`;
    }
  }

  B.registerJob({
    id: 'drk', name: 'Dark Knight', abbr: 'DRK', role: 'tank', classJob: 32,
    versions: [
      { id: 'dt70', label: VERSIONS.dt70.label, history: VERSIONS.dt70.history, note: VERSIONS.dt70.note, create: () => new DarkKnightDT('dt70') },
      ...['ew62', 'ew61', 'ew60'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new DarkKnightEW(v) })),
    ],
  });
})(window.BLM);

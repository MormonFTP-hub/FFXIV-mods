// Pictomancer, Dawntrail at level 100, in two versions. Fire in Red → Aero in Green → Water in Blue (each step opens the
// next for 30s); Water adds 25 to the Palette Gauge and a White Paint. At 50, Subtractive Palette gives three stacks of
// Blizzard in Cyan → Stone in Yellow → Thunder in Magenta (stronger, slower) and turns a White Paint Black. White Paint
// is Holy in White, Black is Comet in Black. Motifs (3s casts, instant out of combat) paint a creature (Pom → Wing →
// Claw → Maw), a hammer and a starry sky; Living Muse (three charges) summons the creature and builds Mog of the Ages
// and Retribution of the Madeen; Striking Muse readies three Hammer strikes (critical direct hits); Starry Muse (+5% for
// 20s) gives five Hyperphantasia stacks (25% faster spells), then Rainbow Bright (an instant Rainbow Drip) and Star Prism.
//  - 7.0–7.05: the launch potencies; you paint every motif yourself before the pull.
//  - 7.1–7.57: a pom, a hammer and a starry sky are already painted when a duty starts (and after a reset); the 7.2
//    rework and 7.3's partial revert give the 7.57 numbers.
// Numbers are the game data at 7.05 and 7.57 and the Lodestone notes; gear is The Balance's set for each tier. ref: a
// scripted bot parses about 32,180 / 23,320 on these.
(function (B) {
  const EPS = 1e-6;
  const VERSIONS = {
    dt71: { label: 'Dawntrail 7.1–7.57', history: 'DT 7.1–7.57', rgb: [490, 530, 570], cym: [860, 900, 940], holy: 570, comet: 940, hammer: [560, 580, 600],
      muse: 800, mog: 1000, madeen: 1100, prism: 1100, painted: true, tincture: 'intdt4', ref: 34110,
      stats: { hp: 115000, main: 6513, wd: 158, det: 2287, crit: 3576, dh: 2230, speed: 420 },
      gear: 'The Balance\'s 7.4 xivgear set with the savage brush (Intelligence 6,513, 158 magic damage)',
      note: 'Level 100: motifs already painted when a duty starts, the 7.2 rework with 7.3\'s revert; Heavyweight gear' },
    dt70: { label: 'Dawntrail 7.0–7.05', history: 'DT 7.0–7.05', rgb: [440, 480, 520], cym: [800, 840, 880], holy: 520, comet: 880, hammer: [560, 620, 680],
      muse: 1100, mog: 1300, madeen: 1400, prism: 1400, painted: false, tincture: 'intdt2', ref: 24720,
      stats: { hp: 95000, main: 4883, wd: 146, det: 2269, crit: 3140, dh: 1993, speed: 420 },
      gear: 'The Balance\'s 7.05 set (Intelligence 4,883, 146 magic damage)',
      note: 'Level 100, the painter\'s debut: every motif painted by hand before the pull, the launch potencies; Light-heavyweight gear' },
  };
  const spell = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.7, spell: true, school: 'magic', sound: 'paradox', fx: 'gnbBurst' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const motif = (name, canvas, desc) => spell({ name, potency: 0, target: false, cast: 3, recast: 4, mp: 0, motif: canvas, fx: null, desc: `${desc}\nCast 3s, recast 4s; instant out of combat.` });
  const CREATURES = ['pom', 'wing', 'claw', 'maw'];
  const HYPER = { fireInRed: 1, aeroInGreen: 1, waterInBlue: 1, blizzardInCyan: 1, stoneInYellow: 1, thunderInMagenta: 1, holyInWhite: 1, cometInBlack: 1, starPrism: 1 };

  function buildActions(V) {
    // Single-target, all six (Fire II in Red and the rest of the AoE line aren't in the kit).
    const rgb = (name, p, hue, extra) => spell(Object.assign({ name, potency: p, cast: 1.5, mp: 300, hue, desc: `Deals damage with a potency of ${p}.` }, extra));
    const cym = (name, p, hue, extra) => spell(Object.assign({ name, potency: p, cast: 2.3, recast: 3.3, mp: 400, hue, sub: true, desc: `Deals damage with a potency of ${p}.\nCan only be executed under Subtractive Palette.` }, extra));
    return {
      fireInRed: rgb('Fire in Red', V.rgb[0], 0, { desc: `Deals fire damage with a potency of ${V.rgb[0]}.\nAdditional Effect: Grants Aetherhues (30s)\n※Changes to Aero in Green, then Water in Blue.` }),
      aeroInGreen: rgb('Aero in Green', V.rgb[1], 1, { desc: `Deals wind damage with a potency of ${V.rgb[1]}.\nAdditional Effect: Grants Aetherhues II (30s)\n※Changes to Water in Blue.` }),
      waterInBlue: rgb('Water in Blue', V.rgb[2], 2, { desc: `Deals water damage with a potency of ${V.rgb[2]}.\nAdditional Effect: Increases the Palette Gauge by 25 and White Paint by 1` }),
      blizzardInCyan: cym('Blizzard in Cyan', V.cym[0], 0, { desc: `Deals ice damage with a potency of ${V.cym[0]}.\nCast 2.3s, recast 3.3s\nCan only be executed under Subtractive Palette.\n※Changes to Stone in Yellow, then Thunder in Magenta.` }),
      stoneInYellow: cym('Stone in Yellow', V.cym[1], 1, { desc: `Deals earth damage with a potency of ${V.cym[1]}.\nCan only be executed under Subtractive Palette.\n※Changes to Thunder in Magenta.` }),
      thunderInMagenta: cym('Thunder in Magenta', V.cym[2], 2, { desc: `Deals lightning damage with a potency of ${V.cym[2]}.\nAdditional Effect: Increases White Paint by 1\nCan only be executed under Subtractive Palette.` }),
      holyInWhite: spell({ name: 'Holy in White', potency: V.holy, mp: 300, aoe: 0.35, fx: 'gnbZone', desc: `Deals unaspected damage with a potency of ${V.holy} to target and all enemies nearby it.\nWhite Paint Cost: 1\n※Changes to Comet in Black with Black Paint.` }),
      cometInBlack: spell({ name: 'Comet in Black', potency: V.comet, mp: 400, recast: 3.3, aoe: 0.35, fx: 'gnbDouble', desc: `Deals darkness damage with a potency of ${V.comet} to target and all enemies nearby it.\nBlack Paint Cost: 1\nRecast: 3.3s` }),
      rainbowDrip: spell({ name: 'Rainbow Drip', potency: 1000, cast: 4, recast: 6, mp: 400, aoe: 0.15, fx: 'gnbZone', desc: 'Deals unaspected damage with a potency of 1,000 to all enemies in a straight line before you, 85% less for the rest.\nAdditional Effect: Increases White Paint by 1\nCast 4s, recast 6s (instant and 2.5s under Rainbow Bright).' }),
      starPrism: spell({ name: 'Star Prism', potency: V.prism, mp: 0, aoe: 0.3, ready: 'starstruck', fx: 'gnbZone', desc: `Deals unaspected damage with a potency of ${V.prism} to target and all enemies nearby it.\nCan only be executed while under the effect of Starstruck.` }),
      hammerStamp: spell({ name: 'Hammer Stamp', potency: V.hammer[0], mp: 0, hammer: true, aoe: 0.3, fx: 'gnbDouble', desc: `Delivers a critical direct hit with a potency of ${V.hammer[0]}.\nCan only be executed while under the effect of Hammer Time.\n※Changes to Hammer Brush (${V.hammer[1]}), then Polishing Hammer (${V.hammer[2]}).` }),
      hammerBrush: spell({ name: 'Hammer Brush', potency: V.hammer[1], mp: 0, hammer: true, aoe: 0.3, fx: 'gnbDouble', desc: `Delivers a critical direct hit with a potency of ${V.hammer[1]}.` }),
      polishingHammer: spell({ name: 'Polishing Hammer', potency: V.hammer[2], mp: 0, hammer: true, aoe: 0.3, fx: 'gnbDouble', desc: `Delivers a critical direct hit with a potency of ${V.hammer[2]}.` }),
      creatureMotif: motif('Creature Motif', 'creature', 'Paints the next creature on your canvas: Pom, then Wing, Claw and Maw.'),
      pomMotif: motif('Pom Motif', 'creature', 'Paints a moogle on your canvas.'), wingMotif: motif('Wing Motif', 'creature', 'Paints a pair of wings on your canvas.'),
      clawMotif: motif('Claw Motif', 'creature', 'Paints a claw on your canvas.'), mawMotif: motif('Maw Motif', 'creature', 'Paints a maw on your canvas.'),
      hammerMotif: motif('Hammer Motif', 'weapon', 'Paints a hammer on your canvas.'),
      starrySkyMotif: motif('Starry Sky Motif', 'landscape', 'Paints a starry sky on your canvas.'),
      livingMuse: ab({ name: 'Living Muse', recast: 40, charges: 3, cdGroup: 'livingMuse', desc: 'Summons the creature on your canvas.\nMaximum Charges: 3' }),
      pomMuse: ab({ name: 'Pom Muse', recast: 40, charges: 3, cdGroup: 'livingMuse', potency: V.muse, target: true, range: 25, aoe: 0.3, delay: 0.8, fx: 'gnbBurst', desc: `Deals unaspected damage with a potency of ${V.muse} to target and all enemies nearby it.\nAdditional Effect: Adds a Pom depiction` }),
      wingedMuse: ab({ name: 'Winged Muse', recast: 40, charges: 3, cdGroup: 'livingMuse', potency: V.muse, target: true, range: 25, aoe: 0.3, delay: 0.8, fx: 'gnbBurst', desc: `Deals unaspected damage with a potency of ${V.muse} to target and all enemies nearby it.\nAdditional Effect: Completes the Moogle Portrait (Mog of the Ages)` }),
      clawedMuse: ab({ name: 'Clawed Muse', recast: 40, charges: 3, cdGroup: 'livingMuse', potency: V.muse, target: true, range: 25, aoe: 0.3, delay: 0.8, fx: 'gnbBurst', desc: `Deals unaspected damage with a potency of ${V.muse} to target and all enemies nearby it.\nAdditional Effect: Adds a Claw depiction` }),
      fangedMuse: ab({ name: 'Fanged Muse', recast: 40, charges: 3, cdGroup: 'livingMuse', potency: V.muse, target: true, range: 25, aoe: 0.3, delay: 0.8, fx: 'gnbBurst', desc: `Deals unaspected damage with a potency of ${V.muse} to target and all enemies nearby it.\nAdditional Effect: Completes the Madeen Portrait (Retribution of the Madeen)` }),
      mogOfTheAges: ab({ name: 'Mog of the Ages', recast: 30, cdGroup: 'portrait', potency: V.mog, target: true, range: 25, aoe: 0.3, delay: 0.9, fx: 'gnbZone', desc: `Deals unaspected damage with a potency of ${V.mog} to all enemies in a straight line before you.\nCan only be executed while the Moogle Portrait is ready.\nShares a recast timer with Retribution of the Madeen.` }),
      retributionOfTheMadeen: ab({ name: 'Retribution of the Madeen', recast: 30, cdGroup: 'portrait', potency: V.madeen, target: true, range: 25, aoe: 0.3, delay: 0.9, fx: 'gnbZone', desc: `Deals unaspected damage with a potency of ${V.madeen} to all enemies in a straight line before you.\nCan only be executed while the Madeen Portrait is ready.` }),
      strikingMuse: ab({ name: 'Striking Muse', recast: 60, charges: 2, desc: 'Grants 3 stacks of Hammer Time, for Hammer Stamp, Hammer Brush and Polishing Hammer.\nDuration: 30s\nRequires a painted hammer; in combat only.\nMaximum Charges: 2' }),
      starryMuse: ab({ name: 'Starry Muse', recast: 120, desc: 'Increases damage dealt by self and nearby party members by 5%.\nDuration: 20s\nAdditional Effect: Grants Subtractive Spectrum and 5 stacks of Hyperphantasia (paint spells cast and recast 25% faster)\nDuration: 30s\nAdditional Effect: Grants Rainbow Bright (30s) and Starstruck (20s) once all 5 stacks are spent\nRequires a painted starry sky; in combat only.' }),
      subtractivePalette: ab({ name: 'Subtractive Palette', recast: 1, desc: 'Grants 3 stacks of Subtractive Palette: Fire / Aero / Water become Blizzard in Cyan / Stone in Yellow / Thunder in Magenta.\nAdditional Effect: Grants Monochrome Tones (a White Paint becomes Black)\nPalette Gauge Cost: 50 (none under Subtractive Spectrum)' }),
      temperaCoat: ab({ name: 'Tempera Coat', recast: 120, desc: 'Creates a barrier around self that absorbs damage totaling 20% of maximum HP.\nDuration: 10s' }),
      smudge: ab({ name: 'Smudge', recast: 20, desc: 'Dashes 15 yalms forward.' }),
      ...B.ROLE_ACTIONS.caster,
      swiftcast: ab({ name: 'Swiftcast', recast: 40, role: true, desc: 'Next spell is cast immediately.\nDuration: 10s' }),
      lucidDreaming: ab({ name: 'Lucid Dreaming', recast: 60, role: true, desc: 'Gradually restores own MP.\nPotency: 55\nDuration: 21s' }),
      ...B.GENERAL_ACTIONS,
      tincture: B.tincture(V.tincture),
    };
  }

  const STATUSES = {
    aetherhues: { name: 'Aetherhues', self: true, icon: 'st_hues' },
    subtractivePalette: { name: 'Subtractive Palette', self: true, icon: 'st_subtractive' },
    monochromeTones: { name: 'Monochrome Tones', self: true, icon: 'st_mono' },
    hammerTime: { name: 'Hammer Time', self: true, icon: 'st_hammer' },
    starryMuse: { name: 'Starry Muse', self: true, icon: 'st_starry' },
    subtractiveSpectrum: { name: 'Subtractive Spectrum', self: true, icon: 'st_spectrum' },
    hyperphantasia: { name: 'Hyperphantasia', self: true, icon: 'st_hyper' },
    rainbowBright: { name: 'Rainbow Bright', self: true, icon: 'st_rainbow' },
    starstruck: { name: 'Starstruck', self: true, icon: 'st_starstruck' },
    temperaCoat: { name: 'Tempera Coat', self: true, icon: 'st_tempera' },
  };

  class PictomancerDT {
    constructor(version) {
      const V = VERSIONS[version];
      this.V = V;
      this.name = 'Pictomancer';
      this.abbr = 'PCT';
      this.role = 'caster';
      this.level = 100;
      this.levelKey = 100;
      this.model = 'pct-dt';
      this.maxMp = 10000;
      this.actions = buildActions(V);
      this.statuses = STATUSES;
      this.stats = Object.assign({ mainStat: 'int', jobMod: 115, trait: 130, delay: 2.96 }, V.stats);
      this.speedName = 'Spell speed';
      this.tierHaste = 0;
      this.selfStatusOrder = ['starryMuse', 'hyperphantasia', 'subtractivePalette', 'monochromeTones', 'aetherhues', 'hammerTime', 'subtractiveSpectrum',
        'rainbowBright', 'starstruck', 'swiftcast', 'medicated', 'lucidDreaming', 'temperaCoat', 'surecast', 'sprint'];
      this.targetStatusOrder = ['addle'];
      this.defaultBars = [
        ['fireInRed', 'blizzardInCyan', 'holyInWhite', 'subtractivePalette', 'creatureMotif', 'livingMuse', 'mogOfTheAges', 'hammerMotif', 'strikingMuse', 'hammerStamp', 'starrySkyMotif', 'starryMuse'],
        ['rainbowDrip', 'starPrism', 'swiftcast', 'lucidDreaming', 'tincture', 'temperaCoat', 'smudge', 'addle', 'surecast', 'sprint', null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Pictomancer', ['fireInRed', 'aeroInGreen', 'waterInBlue', 'blizzardInCyan', 'stoneInYellow', 'thunderInMagenta', 'holyInWhite', 'cometInBlack', 'rainbowDrip',
          'starPrism', 'hammerStamp', 'hammerBrush', 'polishingHammer', 'creatureMotif', 'hammerMotif', 'starrySkyMotif', 'livingMuse', 'mogOfTheAges',
          'retributionOfTheMadeen', 'strikingMuse', 'starryMuse', 'subtractivePalette', 'temperaCoat', 'smudge']],
        ['Role Actions', ['swiftcast', 'lucidDreaming', 'surecast', 'addle']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = 2.5;
      this.startDistance = 12;
    }

    // 7.1+: a pom, a hammer and a starry sky are on the canvas when a duty starts.
    initGauge() {
      const p = this.V.painted;
      return { palette: 0, white: 0, black: false, hue: 0, hueUntil: 0, creature: p ? 'pom' : null, next: p ? 1 : 0, weapon: p, landscape: p,
        depict: 0, portrait: null };
    }

    resolveId(id, e) {
      const g = e.g;
      const hue = g.hueUntil > e.now ? g.hue : 0;
      switch (id) {
        case 'fireInRed': return ['fireInRed', 'aeroInGreen', 'waterInBlue'][hue];
        case 'blizzardInCyan': return ['blizzardInCyan', 'stoneInYellow', 'thunderInMagenta'][hue];
        case 'holyInWhite': return g.black ? 'cometInBlack' : id;
        case 'creatureMotif': return ['pomMotif', 'wingMotif', 'clawMotif', 'mawMotif'][g.next % 4];
        case 'livingMuse': return g.creature ? { pom: 'pomMuse', wing: 'wingedMuse', claw: 'clawedMuse', maw: 'fangedMuse' }[g.creature] : id;
        case 'mogOfTheAges': return g.portrait === 'madeen' ? 'retributionOfTheMadeen' : id;
        case 'hammerStamp': {
          const n = e.has('hammerTime') ? e.statuses.hammerTime.stacks || 0 : 0;
          return n === 2 ? 'hammerBrush' : n === 1 ? 'polishingHammer' : id;
        }
      }
      return id;
    }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.hue !== undefined) {
        if (!!a.sub !== e.has('subtractivePalette')) return 'Unable to execute action.';
      }
      if (a.ready && !e.has(a.ready)) return 'Unable to execute action.';
      if (id === 'holyInWhite' && (g.white < 1 || e.has('monochromeTones'))) return 'Unable to execute action. White Paint required.';
      if (id === 'cometInBlack' && !g.black) return 'Unable to execute action. Black Paint required.';
      if (a.hammer && !e.has('hammerTime')) return 'Unable to execute action. Hammer Time required.';
      if (a.motif === 'creature' && g.creature) return 'Unable to execute action. The canvas is already painted.';
      if (a.motif === 'weapon' && (g.weapon || e.has('hammerTime'))) return 'Unable to execute action.';
      if (a.motif === 'landscape' && g.landscape) return 'Unable to execute action. The canvas is already painted.';
      if (id === 'livingMuse' || ((id === 'pomMuse' || id === 'wingedMuse' || id === 'clawedMuse' || id === 'fangedMuse') && !g.creature)) return 'Unable to execute action. Creature Motif required.';
      if ((id === 'mogOfTheAges' && g.portrait !== 'mog') || (id === 'retributionOfTheMadeen' && g.portrait !== 'madeen')) return 'Unable to execute action. Portrait required.';
      if (id === 'strikingMuse' && (!g.weapon || !e.inCombat)) return 'Unable to execute action.';
      if (id === 'starryMuse' && (!g.landscape || !e.inCombat)) return 'Unable to execute action.';
      if (id === 'subtractivePalette' && (e.has('subtractivePalette') || (g.palette < 50 && !e.has('subtractiveSpectrum')))) return 'Not enough Palette Gauge.';
      return null;
    }

    // Hyperphantasia: 25% faster casts and recasts for the paint spells.
    haste(e, id) { return id && HYPER[id] && e.has('hyperphantasia') ? 25 : 0; }

    castTime(id, e) {
      const a = this.actions[id];
      if (!a.cast) return 0;
      if (a.motif && !e.inCombat) return 0;
      if (id === 'rainbowDrip' && e.has('rainbowBright')) return 0;
      if (e.has('swiftcast')) return 0;
      return e.speedScale(a.cast, this.haste(e, id));
    }
    consumeInstant(id, e) {
      const a = this.actions[id];
      if (!a.cast || (a.motif && !e.inCombat) || (id === 'rainbowDrip' && e.has('rainbowBright'))) return;
      if (e.has('swiftcast')) e.removeStatus('swiftcast');
    }
    gcdRecastFor(id, e) { return id === 'rainbowDrip' && e.has('rainbowBright') ? 2.5 : null; }

    snapshot(a, e) {
      const mult = e.has('starryMuse') ? 1.05 : 1;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main };
    }

    white(e) {
      const g = e.g;
      if (e.has('monochromeTones') && !g.black) { g.black = true; return; }
      g.white = Math.min(5, g.white + 1);
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.kind === 'gcd') e.mp -= a.mp || 0;
      let potency = a.potency || 0, opts = {};
      if (a.hue !== undefined) {
        g.hue = a.hue === 2 ? 0 : a.hue + 1;
        g.hueUntil = a.hue === 2 ? 0 : e.now + 30;
        if (g.hue) e.addStatus('aetherhues', 30); else e.removeStatus('aetherhues', true);
        if (id === 'waterInBlue') { g.palette = Math.min(100, g.palette + 25); this.white(e); }
        if (id === 'thunderInMagenta') this.white(e);
        if (a.sub) {
          const s = e.statuses.subtractivePalette;
          s.stacks = (s.stacks || 1) - 1;
          if (s.stacks <= 0) e.removeStatus('subtractivePalette'); else e.emit('statusStack', { key: 'subtractivePalette' });
        }
      }
      if (HYPER[id] && e.has('hyperphantasia')) {
        const s = e.statuses.hyperphantasia;
        s.stacks = (s.stacks || 1) - 1;
        if (s.stacks <= 0) { e.removeStatus('hyperphantasia'); e.addStatus('rainbowBright', 30); e.addStatus('starstruck', 20); }
        else e.emit('statusStack', { key: 'hyperphantasia' });
      }
      if (a.hammer) {
        const s = e.statuses.hammerTime;
        s.stacks = (s.stacks || 1) - 1;
        if (s.stacks <= 0) e.removeStatus('hammerTime'); else e.emit('statusStack', { key: 'hammerTime' });
        opts = { crit: true, dh: true, dhDet: true };
      }
      if (a.ready) e.removeStatus(a.ready);
      if (a.motif === 'creature') { g.creature = CREATURES[g.next % 4]; g.next++; }
      if (a.motif === 'weapon') g.weapon = true;
      if (a.motif === 'landscape') g.landscape = true;
      switch (id) {
        case 'holyInWhite': g.white--; break;
        case 'cometInBlack': g.black = false; e.removeStatus('monochromeTones'); break;
        case 'rainbowDrip': if (e.has('rainbowBright')) e.removeStatus('rainbowBright'); this.white(e); break;
        case 'pomMuse': case 'wingedMuse': case 'clawedMuse': case 'fangedMuse':
          g.creature = null; g.depict++;
          if (id === 'wingedMuse') g.portrait = 'mog';
          if (id === 'fangedMuse') { g.portrait = 'madeen'; g.depict = 0; }
          break;
        case 'mogOfTheAges': case 'retributionOfTheMadeen': g.portrait = null; break;
        case 'strikingMuse': g.weapon = false; e.addStatus('hammerTime', 30, { stacks: 3 }); break;
        case 'starryMuse':
          g.landscape = false;
          e.addStatus('starryMuse', 20); e.addStatus('subtractiveSpectrum', 30); e.addStatus('hyperphantasia', 30, { stacks: 5 });
          break;
        case 'subtractivePalette':
          if (e.has('subtractiveSpectrum')) e.removeStatus('subtractiveSpectrum'); else g.palette -= 50;
          e.addStatus('subtractivePalette', 1e9, { stacks: 3, permanent: true });
          e.addStatus('monochromeTones', 1e9, { permanent: true });
          if (g.white > 0 && !g.black) { g.white--; g.black = true; }
          break;
        case 'temperaCoat': e.addStatus('temperaCoat', 10); break;
        case 'smudge': {
          const from = { x: e.pos.x, z: e.pos.z };
          const d = Math.hypot(e.pos.x, e.pos.z) || 1;
          const s = Math.min(15, Math.max(0, d - 2.4));
          e.pos.x -= e.pos.x / d * s; e.pos.z -= e.pos.z / d * s;
          e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
          break;
        }
        default:
          if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
      }
      if (potency) e.queueHit(id, potency, this.snapshot(a, e), a.delay, null, opts);
    }

    proc(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.ready) return e.has(a.ready);
      if (a.hammer) return e.has('hammerTime');
      if (id === 'cometInBlack') return g.black;
      if (id === 'mogOfTheAges' || id === 'retributionOfTheMadeen') return !!g.portrait;
      if (id === 'rainbowDrip') return e.has('rainbowBright');
      return false;
    }

    mpRegen() { return B.BASE_REGEN; }
    lucidGain() { return 550; }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Blizzard in Cyan ${e.speedScale(3.3).toFixed(2)}s · ${e.gcdForSpeed(e.stats.speed, 25).toFixed(2)} under Hyperphantasia`; }

    // ---------- the Palette Gauge and canvases ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="150" viewBox="0 0 360 150">
  <defs><linearGradient id="pc-p" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e05a5a"/><stop offset=".5" stop-color="#5ad07a"/><stop offset="1" stop-color="#5a8ae0"/></linearGradient></defs>
  <rect x="8" y="10" width="344" height="130" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text x="24" y="34" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">PALETTE</text>
  <rect x="24" y="42" width="250" height="12" rx="6" fill="#2a2535" stroke="rgba(0,0,0,.8)"/>
  <rect id="pc-b" x="24" y="42" width="0" height="12" rx="6" fill="url(#pc-p)"/>
  <line x1="149" y1="38" x2="149" y2="58" stroke="rgba(255,255,255,.5)"/>
  <text id="pc-t" x="336" y="54" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">0</text>
  ${[0, 1, 2, 3, 4].map(k => `<circle id="pc-w${k}" cx="${36 + k * 24}" cy="80" r="8" fill="#2a2535" stroke="rgba(255,255,255,.3)"/>`).join('')}
  <circle id="pc-k" cx="166" cy="80" r="9" fill="#2a2535" stroke="rgba(255,255,255,.3)"/>
  <text id="pc-c" x="24" y="118" font-family="Noto Sans, sans-serif" font-size="12" font-weight="600" fill="#ffd98a" letter-spacing="1"></text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.pg = { b: $('#pc-b'), t: $('#pc-t'), w: [0, 1, 2, 3, 4].map(k => $('#pc-w' + k)), k: $('#pc-k'), c: $('#pc-c'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.pg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      put('p', g.palette, v => { G.b.setAttribute('width', String(250 * v / 100)); G.t.textContent = String(v); });
      for (let i = 0; i < 5; i++) put('w' + i, g.white > i, v => G.w[i].setAttribute('fill', v ? '#f4f4ff' : '#2a2535'));
      put('k', g.black, v => G.k.setAttribute('fill', v ? '#3a2a5a' : '#2a2535'));
      const canvas = [g.creature ? g.creature.toUpperCase() : '', g.weapon ? 'HAMMER' : '', g.landscape ? 'STARRY SKY' : '', g.portrait ? (g.portrait === 'mog' ? 'MOOGLE PORTRAIT' : 'MADEEN PORTRAIT') : ''].filter(Boolean).join(' · ');
      put('c', canvas, v => { G.c.textContent = v ? 'CANVAS: ' + v : 'CANVAS: EMPTY'; });
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 100 Pictomancer. <b>Fire in Red → Aero in Green → Water in Blue</b> (${V.rgb.join(' / ')}; each opens the next for 30s) is the filler; Water adds 25 Palette and a White Paint. At 50 Palette, <b>Subtractive Palette</b> turns the next three into <b>Blizzard in Cyan → Stone in Yellow → Thunder in Magenta</b> (${V.cym.join(' / ')}, 2.3s casts on a 3.3s GCD) and a White Paint into Black. Spend White on <b>Holy in White</b> (${V.holy}, instant: use it to move) and Black on <b>Comet in Black</b> (${V.comet}).</p>
<p>Motifs (3s casts, instant out of combat) paint the canvases. A creature (Pom → Wing → Claw → Maw) is summoned with <b>Living Muse</b> (${V.muse}, three charges); Wing completes <b>Mog of the Ages</b> (${V.mog}), Maw <b>Retribution of the Madeen</b> (${V.madeen}). A hammer for <b>Striking Muse</b>: three Hammer strikes (${V.hammer.join(' / ')}), each a critical direct hit. A starry sky for <b>Starry Muse</b> (120s): +5% for 20s, a free Subtractive Palette, and five Hyperphantasia stacks (25% faster paint spells); using them all gives <b>Rainbow Bright</b> (an instant <b>Rainbow Drip</b>, 1,000) and <b>Star Prism</b> (${V.prism}). Repaint motifs during downtime or after the burst.${V.painted ? ' From 7.1 a pom, a hammer and a starry sky are already on the canvas when the duty starts.' : ' In 7.0 you paint them yourself before the pull.'}</p>
<h3>The opener (The Balance)</h3>
${seq(['rainbowDrip', 'strikingMuse', 'holyInWhite', ['tincture'], ['livingMuse'], 'creatureMotif', ['starryMuse'], 'hammerStamp', ['subtractivePalette'], 'blizzardInCyan', 'blizzardInCyan', 'blizzardInCyan', 'holyInWhite', ['livingMuse'], ['mogOfTheAges'], 'starPrism', 'hammerStamp', 'hammerStamp', 'rainbowDrip', 'fireInRed', ['swiftcast'], 'creatureMotif', ['livingMuse']])}
<p>${V.painted ? 'Rainbow Drip hardcast at −4.5s; the motifs are already painted.' : 'Paint the creature, hammer and starry sky motifs before the pull (instant out of combat), then Rainbow Drip at −4.5s.'} The Cyan button plays Blizzard, Stone and Thunder in turn, the Hammer button Stamp, Brush and Polishing, and Holy becomes Comet with Black Paint.</p>
<p style="color:#a9a3b4">The ${V.painted ? '7.57' : '7.05'} numbers: Fire / Aero / Water ${V.rgb.join(' / ')}, Blizzard / Stone / Thunder ${V.cym.join(' / ')}, Holy in White ${V.holy}, Comet in Black ${V.comet}, Rainbow Drip 1,000, Star Prism ${V.prism}, Hammers ${V.hammer.join(' / ')}, Muses ${V.muse}, Mog of the Ages ${V.mog}, Madeen ${V.madeen}; Maim and Mend II +30%. Gear: ${V.gear}.</p>`;
    }
  }

  B.registerJob({
    id: 'pct', name: 'Pictomancer', abbr: 'PCT', role: 'caster', classJob: 42,
    versions: ['dt71', 'dt70'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new PictomancerDT(v) })),
  });
})(window.BLM);

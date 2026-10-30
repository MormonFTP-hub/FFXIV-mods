// Summoner, Dawntrail at level 100, in two versions. No DoTs and no egi left out: every minute a demi-summon (an instant
// GCD on a 60s recast that follows spell speed) comes out for 15s, in the order Solar Bahamut → Demi-Bahamut → Solar
// Bahamut → Demi-Phoenix. In it Ruin III becomes the demi's instant Impulse (Umbral Impulse, Astral Impulse, Fountain of
// Fire), Astral Flow its big oGCD (Sunflare, Deathflare; Phoenix heals), Enkindle its pet nuke (Exodus, Akh Morn,
// Revelation), and the demi hits once for each GCD you use. The demi leaves Ruby, Topaz and Emerald Arcanum: Summon
// Titan II (four Topaz Rites, each readying Mountain Buster), Garuda II (Slipstream, four quick Emerald Rites) and
// Ifrit II (Crimson Cyclone → Crimson Strike, two cast Ruby Rites), each primal hitting once as it arrives. Energy Drain
// (60s) gives two Aetherflow for Necrotize and Further Ruin for Ruin IV; Searing Light (+5%, 120s) readies Searing Flash.
//  - 7.0–7.05: Crimson Strike only as the GCD straight after Crimson Cyclone; primal summons 750 (a bug: the tooltip said
//    800); 60% less to other targets on the big nukes; the 7.05 numbers (Necrotize 440, Umbral Impulse 620).
//  - 7.1–7.57: Crimson Cyclone readies Crimson Strike (Ruby Rites can go between); the 7.5 numbers (Ruby Rite 620,
//    Crimson Cyclone and Strike 560, Necrotize 500; 7.41's Sunflare 1,000 and Searing Flash 700).
// Pets hit with your stats but a 100 job modifier in the weapon term (about 3% less). Numbers are the game data at 7.05
// and 7.57 and the Lodestone notes; gear is The Balance's set for each tier. ref: a scripted bot parses about
// 37,760 / 23,420 on these.
//  - Endwalker 6.0–6.08 and 6.1–6.58 (level 90): Demi-Bahamut and Demi-Phoenix alternate, no Solar Bahamut; Fester (300,
//    340 from 6.28) in place of Necrotize; Searing Light +3% for 30s with no Searing Flash (in 6.0 Carbuncle cast it, so
//    not while a demi is out); Ruin III 310, Ruin IV 430, Astral Impulse 440, Fountain of Fire 540, primal summons 700
//    (750 from 6.28), Ruby Rite 450 on a 2.5s recast (510 and 3s from 6.1), Topaz Rite 330, Emerald Rite 230, Crimson
//    Cyclone and Strike 430, Slipstream 430, Mountain Buster 150; Swiftcast 60s. The Balance's 6.05 and 6.55 sets. The
//    same bot parses about 11,990 / 7,810 on these.
(function (B) {
  const EPS = 1e-6;
  const DEMI = 15;
  const CYCLE = ['solar', 'bahamut', 'solar', 'phoenix'];
  const VERSIONS = {
    ew61: { label: 'Endwalker 6.1–6.58', history: 'EW 6.1–6.58', ew: true, strikeReady: false, ruin3: 310, ruin4: 430, summon: 750, summonAoe: 0.4, big: 0.4,
      astral: 440, fountain: 540, brand: 240, ruby: 510, rubyRecast: 3.0, rubyCat: 210, topaz: 330, emerald: 230, cyclone: 430, slip: 430, primalAoe: 0.35,
      umbral: [0, 0], sunflare: 0, exodus: 0, flash: 0, buster: 0.3, busterP: 150, necrotize: 340, painflare: 150, searing: 0.03, searingDur: 30, swift: 60, tincture: 'int', ref: 12700,
      stats: { hp: 77848, main: 3379, wd: 132, det: 1871, crit: 2514, dh: 1438, speed: 502 },
      gear: 'The Balance\'s 6.55 set at 2.48 (Intelligence 3,379, 132 magic damage)',
      note: 'Level 90: Demi-Bahamut and Demi-Phoenix in turn, the primals\' Rites, Fester from Energy Drain, Searing Light +3% for 30s; Anabaseios gear' },
    ew60: { label: 'Endwalker 6.0–6.08', history: 'EW 6.0–6.08', ew: true, strikeReady: false, ruin3: 310, ruin4: 430, summon: 700, summonAoe: 0.4, big: 0.4,
      astral: 440, fountain: 540, brand: 240, ruby: 450, rubyRecast: 2.5, rubyCat: 180, topaz: 330, emerald: 230, cyclone: 430, slip: 430, primalAoe: 0.35,
      umbral: [0, 0], sunflare: 0, exodus: 0, flash: 0, buster: 0.3, busterP: 150, necrotize: 300, painflare: 150, searing: 0.03, searingDur: 30, searingCarbuncle: true, swift: 60, tincture: 'int6', ref: 8300,
      stats: { hp: 53937, main: 2575, wd: 120, det: 1688, crit: 2296, dh: 1289, speed: 489 },
      gear: 'The Balance\'s 6.05 set at 2.48 (Intelligence 2,575, 120 magic damage)',
      note: 'Level 90 at launch of the rework: Ruby Rite 450 on a 2.5s recast, Fester 300, primal summons 700, Searing Light cast by Carbuncle (not while a demi is out); Asphodelos gear' },
    dt71: { label: 'Dawntrail 7.1–7.57', history: 'DT 7.1–7.57', strikeReady: true, ruin3: 400, ruin4: 520, summon: 800, big: 0.5,
      umbral: [640, 300], sunflare: 1000, exodus: 1500, ruby: 620, emerald: 280, cyclone: 560, slip: 520, primalAoe: 0.4, buster: 0.4,
      necrotize: 500, painflare: 220, flash: 700, tincture: 'intdt4', ref: 40020,
      stats: { hp: 205237, main: 6513, wd: 158, det: 2287, crit: 3576, dh: 2122, speed: 528 },
      gear: 'The Balance\'s 7.4 savage set at 2.48 (Intelligence 6,513, 158 magic damage)',
      note: 'Level 100: Crimson Strike Ready instead of a combo, primal summons 800, the 7.5 potencies (Ruby Rite 620, Sunflare 1,000, Necrotize 500); Heavyweight gear' },
    dt70: { label: 'Dawntrail 7.0–7.05', history: 'DT 7.0–7.05', strikeReady: false, ruin3: 360, ruin4: 490, summon: 750, big: 0.4,
      umbral: [620, 280], sunflare: 700, exodus: 1400, ruby: 540, emerald: 240, cyclone: 490, slip: 490, primalAoe: 0.35, buster: 0.3,
      necrotize: 440, painflare: 150, flash: 600, tincture: 'intdt2', ref: 24820,
      stats: { hp: 135496, main: 4883, wd: 146, det: 2108, crit: 3061, dh: 2125, speed: 528 },
      gear: 'The Balance\'s 7.05 set at 2.48 (Intelligence 4,883, 146 magic damage)',
      note: 'Level 100 at launch: Solar Bahamut, Searing Flash, Necrotize; primal summons still 750 (a bug); Crimson Strike a combo; Light-heavyweight gear' },
  };
  const spell = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.7, spell: true, school: 'magic', sound: 'paradox', fx: 'gnbBurst' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const pet = (o) => Object.assign({ kind: 'pet', pet: true, delay: 0.8 }, o);

  function buildActions(V) {
    const big = V.big, less = Math.round((1 - big) * 100);
    const demiGcd = (name, demi, p, aoe, extra) => spell(Object.assign({ name, potency: p, mp: 300, demi, aoe: aoe ? true : undefined, fx: demi === 'phoenix' ? 'slashFire' : 'gnbBurst',
      desc: `Deals damage with a potency of ${p}${aoe ? ' to target and all enemies nearby it' : ''}.\nCan only be executed while ${{ solar: 'Solar Bahamut', bahamut: 'Demi-Bahamut', phoenix: 'Demi-Phoenix' }[demi]} is summoned.` }, extra));
    const rite = (name, prim, p, extra) => spell(Object.assign({ name, potency: p, attune: prim, mp: prim === 'ifrit' ? 300 : 0,
      desc: `Deals damage with a potency of ${p}.\nCan only be executed while ${{ ifrit: 'Fire', titan: 'Earth', garuda: 'Wind' }[prim]} Attunement is active.` }, extra));
    const cat = (name, prim, p, extra) => rite(name, prim, p, Object.assign({ aoe: true, desc: `Deals damage with a potency of ${p} to target and all enemies nearby it.\nCan only be executed while ${{ ifrit: 'Fire', titan: 'Earth', garuda: 'Wind' }[prim]} Attunement is active.` }, extra));
    const summon = (name, prim, stacks, petId, extra) => spell(Object.assign({ name, potency: 0, primal: prim, petId, fx: null,
      desc: `Summons ${name.replace('Summon ', '').replace(' II', '')}, who strikes for ${V.summon} (${less}% less for other enemies).\nAdditional Effect: ${{ ifrit: 'Fire', titan: 'Earth', garuda: 'Wind' }[prim]} Attunement ×${stacks} (30s)${prim === 'titan' ? '' : `\nAdditional Effect: Grants ${prim === 'ifrit' ? 'Ifrit\'s' : 'Garuda\'s'} Favor`}\nCan only be executed with ${{ ifrit: 'Ruby', titan: 'Topaz', garuda: 'Emerald' }[prim]} Arcanum and no demi-summon out.` }, extra));
    const demiSummon = (name, demi, desc) => spell(Object.assign({ name, potency: 0, cd: 60, cdScales: true, cdGroup: 'demi', demiSummon: demi, fx: null, desc }));
    return {
      ruin3: spell({ name: 'Ruin III', potency: V.ruin3, cast: 1.5, mp: 300, desc: `Deals unaspected damage with a potency of ${V.ruin3}.\n※Changes to ${V.ew ? '' : 'Umbral Impulse, '}Astral Impulse or Fountain of Fire while a demi-summon is out.` }),
      triDisaster: spell({ name: 'Tri-disaster', potency: 120, cast: 1.5, mp: 300, aoe: true, iconOf: 'triDisaster2', desc: 'Deals unaspected damage with a potency of 120 to target and all enemies nearby it.\n※Action changes to the demi-summon\'s Flare while one is out.' }),
      ruin4: spell({ name: 'Ruin IV', potency: V.ruin4, mp: 400, aoe: 0.4, ready: 'furtherRuinDt', fx: 'slashFire', desc: `Deals unaspected damage with a potency of ${V.ruin4} to target and all enemies nearby it, 60% less for the rest.\nCan only be executed while under the effect of Further Ruin.` }),
      umbralImpulse: demiGcd('Umbral Impulse', 'solar', V.umbral[0]),
      umbralFlare: demiGcd('Umbral Flare', 'solar', V.umbral[1], true),
      astralImpulse: demiGcd('Astral Impulse', 'bahamut', V.astral || 500),
      astralFlare: demiGcd('Astral Flare', 'bahamut', 180, true),
      fountainOfFire: demiGcd('Fountain of Fire', 'phoenix', V.fountain || 580),
      brandOfPurgatory: demiGcd('Brand of Purgatory', 'phoenix', V.brand || 240, true),
      summonSolarBahamut: demiSummon('Summon Solar Bahamut', 'solar', `Summons Solar Bahamut for 15s; Ruin III becomes Umbral Impulse and Astral Flow Sunflare.\nAdditional Effect: Grants Ruby, Topaz and Emerald Arcanum, and Refulgent Lux (30s)\nRecast: 60s (follows spell speed), shared with the other demi-summons.\n※Every second demi-summon is Solar Bahamut.`),
      summonBahamut: demiSummon('Summon Bahamut', 'bahamut', `Summons Demi-Bahamut for 15s; Ruin III becomes Astral Impulse and Astral Flow Deathflare.\nAdditional Effect: Grants Ruby, Topaz and Emerald Arcanum\nRecast: 60s, shared with the other demi-summons.\n※This button summons whichever demi is next: Solar Bahamut, Demi-Bahamut, Solar Bahamut, Demi-Phoenix.`),
      summonPhoenix: demiSummon('Summon Phoenix', 'phoenix', `Summons Demi-Phoenix for 15s; Ruin III becomes Fountain of Fire and Astral Flow Rekindle (a heal).\nAdditional Effect: Grants Ruby, Topaz and Emerald Arcanum\nRecast: 60s, shared with the other demi-summons.`),
      sunflare: ab({ name: 'Sunflare', recast: 20, cdGroup: 'astralFlow', potency: V.sunflare, target: true, range: 25, aoe: big, delay: 0.8, demi: 'solar', fx: 'gnbZone', desc: `Deals unaspected damage with a potency of ${V.sunflare} to target and all enemies nearby it, ${less}% less for the rest.\nCan only be executed while Solar Bahamut is summoned.` }),
      deathflare: ab({ name: 'Deathflare', recast: 20, cdGroup: 'astralFlow', potency: 500, target: true, range: 25, aoe: big, delay: 0.8, demi: 'bahamut', fx: 'gnbZone', desc: `Deals unaspected damage with a potency of 500 to target and all enemies nearby it, ${less}% less for the rest.\nCan only be executed while Demi-Bahamut is summoned.` }),
      rekindle: ab({ name: 'Rekindle', recast: 20, cdGroup: 'astralFlow', target: false, demi: 'phoenix', desc: 'Restores HP of target party member with a healing potency of 400.\nAdditional Effect: Grants Undying Flame (heals 200 when it ends)\nCan only be executed while Demi-Phoenix is summoned.' }),
      astralFlow: ab({ name: 'Astral Flow', recast: 1, target: false, desc: 'Becomes Sunflare, Deathflare or Rekindle while a demi-summon is out, and Crimson Cyclone, Crimson Strike, Mountain Buster or Slipstream under a primal\'s Favor.' }),
      enkindleSolarBahamut: ab({ name: 'Enkindle Solar Bahamut', recast: 20, cdGroup: 'enkindle', target: true, range: 25, demi: 'solar', petAction: 'exodus', desc: `Commands Solar Bahamut to use Exodus: ${V.exodus} to target and all enemies nearby it, ${less}% less for the rest.` }),
      enkindleBahamut: ab({ name: 'Enkindle Bahamut', recast: 20, cdGroup: 'enkindle', target: true, range: 25, demi: 'bahamut', petAction: 'akhMorn', desc: `Commands Demi-Bahamut to use Akh Morn: 1,300 to target and all enemies nearby it, ${less}% less for the rest.\n※This button commands whichever demi is out.` }),
      enkindlePhoenix: ab({ name: 'Enkindle Phoenix', recast: 20, cdGroup: 'enkindle', target: true, range: 25, demi: 'phoenix', petAction: 'revelation', desc: `Commands Demi-Phoenix to use Revelation: 1,300 to target and all enemies nearby it, ${less}% less for the rest.` }),
      exodus: pet({ name: 'Exodus', potency: V.exodus, aoe: big, delay: 1.0, demiHit: true }),
      akhMorn: pet({ name: 'Akh Morn', potency: 1300, aoe: big, delay: 1.0, demiHit: true }),
      revelation: pet({ name: 'Revelation', potency: 1300, aoe: big, delay: 1.0, demiHit: true }),
      luxwave: pet({ name: 'Luxwave', potency: 160, aoe: true, delay: 0.6, demiHit: true }),
      wyrmwave: pet({ name: 'Wyrmwave', potency: 150, delay: 0.6, demiHit: true }),
      scarletFlame: pet({ name: 'Scarlet Flame', potency: 150, delay: 0.6, demiHit: true }),
      luxSolaris: ab({ name: 'Lux Solaris', recast: 60, target: false, ready: 'refulgentLux', desc: 'Restores own HP and the HP of all nearby party members with a healing potency of 500.\nCan only be executed while under the effect of Refulgent Lux.' }),
      summonIfrit2: summon('Summon Ifrit II', 'ifrit', 2, 'inferno2'),
      summonTitan2: summon('Summon Titan II', 'titan', 4, 'earthenFury'),
      summonGaruda2: summon('Summon Garuda II', 'garuda', 4, 'aerialBlast2'),
      inferno2: pet({ name: 'Inferno', potency: V.summon, aoe: V.summonAoe || 1 - (V.summon === 750 ? 0.6 : 0.5), iconOf: 'summonIfrit2' }),
      earthenFury: pet({ name: 'Earthen Fury', potency: V.summon, aoe: V.summonAoe || 1 - (V.summon === 750 ? 0.6 : 0.5), iconOf: 'summonTitan2' }),
      aerialBlast2: pet({ name: 'Aerial Blast', potency: V.summon, aoe: V.summonAoe || 1 - (V.summon === 750 ? 0.6 : 0.5), iconOf: 'summonGaruda2' }),
      gemshine: spell({ name: 'Gemshine', potency: 0, target: true, desc: 'Becomes Ruby Rite, Topaz Rite or Emerald Rite with the primal you have attuned.' }),
      preciousBrilliance: spell({ name: 'Precious Brilliance', potency: 0, target: true, desc: 'Becomes Ruby, Topaz or Emerald Catastrophe with the primal you have attuned.' }),
      rubyRite: rite('Ruby Rite', 'ifrit', V.ruby, { cast: 2.8, recast: V.rubyRecast || 3.0, fx: 'slashFire' }),
      topazRite: rite('Topaz Rite', 'titan', V.topaz || 340, { desc: `Deals earth damage with a potency of ${V.topaz || 340}.\nAdditional Effect: Grants Titan's Favor (Mountain Buster)\nCan only be executed while Earth Attunement is active.` }),
      emeraldRite: rite('Emerald Rite', 'garuda', V.emerald, { recast: 1.5, fx: 'gnbFang' }),
      rubyCatastrophe: cat('Ruby Catastrophe', 'ifrit', V.rubyCat || 210, { cast: 2.8, recast: V.rubyRecast || 3.0, fx: 'slashFire' }),
      topazCatastrophe: cat('Topaz Catastrophe', 'titan', 140),
      emeraldCatastrophe: cat('Emerald Catastrophe', 'garuda', 100, { recast: 1.5 }),
      crimsonCyclone: spell({ name: 'Crimson Cyclone', potency: V.cyclone, range: 20, aoe: V.primalAoe, ready: 'ifritsFavor', iconOf: 'crimsonCyclone2', fx: 'slashFire',
        desc: `Rushes forward and deals fire damage with a potency of ${V.cyclone} to the target and all enemies nearby it, ${Math.round((1 - V.primalAoe) * 100)}% less for the rest.\nCan only be executed while under the effect of Ifrit's Favor.\n${V.strikeReady ? 'Additional Effect: Grants Crimson Strike Ready' : 'Combo: Crimson Strike, as the very next GCD'}` }),
      crimsonStrike: spell({ name: 'Crimson Strike', potency: V.cyclone, range: 3, aoe: V.primalAoe, fx: 'slashFire', ready: V.strikeReady ? 'crimsonStrikeReady' : undefined,
        desc: `Deals fire damage with a potency of ${V.cyclone} to the target and all enemies nearby it, ${Math.round((1 - V.primalAoe) * 100)}% less for the rest.\n${V.strikeReady ? 'Can only be executed while under the effect of Crimson Strike Ready.' : 'Combo Action: Crimson Cyclone (the very next GCD)'}` }),
      slipstream: spell({ name: 'Slipstream', potency: V.slip, cast: 3.0, recast: 3.5, aoe: V.primalAoe, ready: 'garudasFavor', fx: 'gnbFang3',
        desc: `Deals wind damage with a potency of ${V.slip} to the target and all enemies nearby it, ${Math.round((1 - V.primalAoe) * 100)}% less for the rest.\nAdditional Effect: Creates a windstorm (potency 30 every 3s for 15s)\nCan only be executed while under the effect of Garuda's Favor.` }),
      mountainBuster: ab({ name: 'Mountain Buster', recast: 1, potency: V.busterP || 160, target: true, range: 25, aoe: V.buster, delay: 0.6, ready: 'titansFavor', fx: 'gnbZone',
        desc: `Deals earth damage with a potency of ${V.busterP || 160} to the target and all enemies nearby it, ${Math.round((1 - V.buster) * 100)}% less for the rest.\nCan only be executed while under the effect of Titan's Favor.` }),
      energyDrain: ab({ name: 'Energy Drain', recast: 60, cdGroup: 'energyDrain', potency: 200, target: true, range: 25, delay: 0.6, iconOf: 'energyDrain2', fx: 'gnbCont',
        desc: 'Deals unaspected damage with a potency of 200.\nAdditional Effect: Aetherflow II (2 stacks)\nAdditional Effect: Grants Further Ruin\nDuration: 60s\nShares a recast timer with Energy Siphon.' }),
      energySiphon: ab({ name: 'Energy Siphon', recast: 60, cdGroup: 'energyDrain', potency: 100, target: true, range: 25, aoe: true, delay: 0.6, fx: 'gnbCont',
        desc: 'Deals unaspected damage with a potency of 100 to target and all enemies nearby it.\nAdditional Effect: Aetherflow II (2 stacks)\nAdditional Effect: Grants Further Ruin\nDuration: 60s' }),
      necrotize: ab({ name: 'Necrotize', recast: 1, potency: V.necrotize, target: true, range: 25, delay: 0.6, flow: true, fx: 'gnbCont',
        desc: `Deals unaspected damage with a potency of ${V.necrotize}.\nAetherflow Gauge Cost: 1` }),
      painflare: ab({ name: 'Painflare', recast: 1, potency: V.painflare, target: true, range: 25, aoe: true, delay: 0.6, flow: true, fx: 'gnbCont',
        desc: `Deals unaspected damage with a potency of ${V.painflare} to target and all enemies nearby it.\nAetherflow Gauge Cost: 1` }),
      searingLight: ab({ name: 'Searing Light', recast: 120, target: false, desc: V.ew
        ? `${V.searingCarbuncle ? 'Orders Carbuncle to execute Searing Light: increases' : 'Increases'} damage dealt by self, your pets and nearby party members by 3%.\nDuration: 30s${V.searingCarbuncle ? '\nCan only be executed while Carbuncle is summoned.' : ''}`
        : 'Increases damage dealt by self, your pets and nearby party members by 5%.\nDuration: 20s\nAdditional Effect: Grants Ruby\'s Glimmer (Searing Flash)\nDuration: 30s' }),
      searingFlash: ab({ name: 'Searing Flash', recast: 1, potency: V.flash, target: true, range: 25, aoe: true, delay: 0.6, ready: 'rubysGlimmer', fx: 'gnbBow',
        desc: `Deals unaspected damage with a potency of ${V.flash} to target and all enemies nearby it.\nCan only be executed while under the effect of Ruby's Glimmer.` }),
      radiantAegis: ab({ name: 'Radiant Aegis', recast: 60, charges: 2, target: false, desc: 'Orders Carbuncle to shield you for 20% of your maximum HP.\nDuration: 30s\nMaximum Charges: 2' }),
      ...B.ROLE_ACTIONS.caster,
      swiftcast: ab({ name: 'Swiftcast', recast: V.swift || 40, role: true, desc: 'Next spell is cast immediately.\nDuration: 10s' }),
      lucidDreaming: ab({ name: 'Lucid Dreaming', recast: 60, role: true, desc: 'Gradually restores own MP.\nPotency: 55\nDuration: 21s' }),
      ...B.GENERAL_ACTIONS,
      tincture: B.tincture(V.tincture),
    };
  }

  const STATUSES = {
    searingLight: { name: 'Searing Light', self: true, icon: 'st_searingLight' },
    rubysGlimmer: { name: 'Ruby\'s Glimmer', self: true, icon: 'st_rubysGlimmer' },
    refulgentLux: { name: 'Refulgent Lux', self: true, icon: 'st_refulgentLux' },
    furtherRuinDt: { name: 'Further Ruin', self: true, icon: 'st_furtherRuinDt' },
    ifritsFavor: { name: 'Ifrit\'s Favor', self: true, icon: 'st_ifritsFavor' },
    titansFavor: { name: 'Titan\'s Favor', self: true, icon: 'st_titansFavor' },
    garudasFavor: { name: 'Garuda\'s Favor', self: true, icon: 'st_garudasFavor' },
    crimsonStrikeReady: { name: 'Crimson Strike Ready', self: true, icon: 'st_crimsonStrikeReady' },
    radiantAegis: { name: 'Radiant Aegis', self: true, icon: 'st_radiantAegis' },
    slipstream: { name: 'Slipstream', self: false, icon: 'st_slipstream' },
    ...B.COMMON_STATUSES,
  };
  const DEMI_NAME = { solar: 'SOLAR BAHAMUT', bahamut: 'DEMI-BAHAMUT', phoenix: 'DEMI-PHOENIX' };
  const PRIMAL = { ifrit: ['summonIfrit2', 'ruby'], titan: ['summonTitan2', 'topaz'], garuda: ['summonGaruda2', 'emerald'] };

  class SummonerDT {
    constructor(version) {
      const V = VERSIONS[version];
      this.V = V;
      this.name = 'Summoner';
      this.abbr = 'SMN';
      this.role = 'caster';
      this.level = V.ew ? 90 : 100;
      this.levelKey = V.ew ? 90 : 100;
      this.model = 'smn-dt';
      this.maxMp = 10000;
      this.cycle = V.ew ? ['bahamut', 'phoenix'] : CYCLE;
      this.actions = buildActions(V);
      if (V.ew) {
        const A = this.actions;
        for (const k of ['summonSolarBahamut', 'umbralImpulse', 'umbralFlare', 'sunflare', 'enkindleSolarBahamut', 'exodus', 'luxwave', 'luxSolaris', 'searingFlash']) delete A[k];
        A.necrotize = Object.assign({}, A.necrotize, { name: 'Fester', iconOf: 'fester', desc: `Deals unaspected damage with a potency of ${V.necrotize}.\nAetherflow Gauge Cost: 1` });
        A.summonBahamut = Object.assign({}, A.summonBahamut, { desc: 'Summons Demi-Bahamut for 15s; Ruin III becomes Astral Impulse and Astral Flow Deathflare.\nAdditional Effect: Grants Ruby, Topaz and Emerald Arcanum\nRecast: 60s (follows spell speed).\n※Becomes Summon Phoenix when Demi-Bahamut returns.' });
        A.enkindleBahamut = Object.assign({}, A.enkindleBahamut, { desc: A.enkindleBahamut.desc.replace(/\n※.*$/, '') });
      }
      this.statuses = STATUSES;
      this.stats = Object.assign({ mainStat: 'int', jobMod: 115, trait: 130, delay: 3.12 }, V.stats);
      // Pets use a job modifier of 100 in the weapon-damage term.
      const baseMain = V.ew ? 390 : 440;
      this.petK = (Math.floor(baseMain * 100 / 1000) + V.stats.wd) / (Math.floor(baseMain * 115 / 1000) + V.stats.wd);
      this.speedName = 'Spell speed';
      this.tierHaste = 0;
      this.selfStatusOrder = ['searingLight', 'rubysGlimmer', 'furtherRuinDt', 'ifritsFavor', 'crimsonStrikeReady', 'titansFavor', 'garudasFavor', 'refulgentLux',
        'swiftcast', 'medicated', 'lucidDreaming', 'radiantAegis', 'surecast', 'sprint'];
      this.targetStatusOrder = ['slipstream', 'addle'];
      this.defaultBars = [
        ['ruin3', 'summonBahamut', 'astralFlow', 'enkindleBahamut', 'gemshine', 'summonTitan2', 'summonGaruda2', 'summonIfrit2', 'ruin4', 'energyDrain', 'necrotize', 'searingLight'],
        ['searingFlash', 'swiftcast', 'lucidDreaming', 'tincture', 'luxSolaris', 'radiantAegis', 'addle', 'surecast', 'sprint', null, null, null],
        ['triDisaster', 'preciousBrilliance', 'energySiphon', 'painflare', null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Summoner', ['ruin3', 'triDisaster', 'ruin4', 'summonSolarBahamut', 'summonBahamut', 'summonPhoenix', 'umbralImpulse', 'umbralFlare', 'astralImpulse',
          'astralFlare', 'fountainOfFire', 'brandOfPurgatory', 'astralFlow', 'sunflare', 'deathflare', 'rekindle', 'enkindleSolarBahamut', 'enkindleBahamut',
          'enkindlePhoenix', 'luxSolaris', 'summonIfrit2', 'summonTitan2', 'summonGaruda2', 'gemshine', 'preciousBrilliance', 'rubyRite', 'topazRite',
          'emeraldRite', 'rubyCatastrophe', 'topazCatastrophe', 'emeraldCatastrophe', 'crimsonCyclone', 'crimsonStrike', 'mountainBuster', 'slipstream',
          'energyDrain', 'energySiphon', 'necrotize', 'painflare', 'searingLight', 'searingFlash', 'radiantAegis']],
        ['Role Actions', ['swiftcast', 'lucidDreaming', 'surecast', 'addle']],
        ['General', ['sprint', 'tincture']],
      ];
      if (V.ew) {
        const A = this.actions;
        this.defaultBars = this.defaultBars.map(r => r.map(x => (x && A[x] ? x : null)));
        this.actionGroups = this.actionGroups.map(([n, ids]) => [n, ids.filter(x => A[x])]);
        this.selfStatusOrder = this.selfStatusOrder.filter(k => k !== 'rubysGlimmer' && k !== 'refulgentLux');
      }
      this.referenceDps = V.ref;
      this.referenceGcd = 2.5;
      this.startDistance = 12;
    }

    initGauge(e) {
      if (e) e.pet = null;
      return { demi: null, demiUntil: 0, next: 0, ruby: false, topaz: false, emerald: false, attune: null, stacks: 0, attuneUntil: 0, flow: 0, strike: false };
    }

    demiOut(e) { return e.g.demi && e.g.demiUntil > e.now + EPS ? e.g.demi : null; }
    attuned(e) { return e.g.attune && e.g.stacks > 0 && e.g.attuneUntil > e.now + EPS ? e.g.attune : null; }

    resolveId(id, e) {
      const d = this.demiOut(e), at = this.attuned(e);
      switch (id) {
        case 'ruin3': return d ? { solar: 'umbralImpulse', bahamut: 'astralImpulse', phoenix: 'fountainOfFire' }[d] : id;
        case 'triDisaster': return d ? { solar: 'umbralFlare', bahamut: 'astralFlare', phoenix: 'brandOfPurgatory' }[d] : id;
        case 'summonBahamut': case 'summonSolarBahamut': case 'summonPhoenix':
          return { solar: 'summonSolarBahamut', bahamut: 'summonBahamut', phoenix: 'summonPhoenix' }[this.cycle[e.g.next % this.cycle.length]];
        case 'enkindleBahamut': case 'enkindleSolarBahamut': case 'enkindlePhoenix':
          return d ? { solar: 'enkindleSolarBahamut', bahamut: 'enkindleBahamut', phoenix: 'enkindlePhoenix' }[d] : id;
        case 'gemshine': return at ? { ifrit: 'rubyRite', titan: 'topazRite', garuda: 'emeraldRite' }[at] : id;
        case 'preciousBrilliance': return at ? { ifrit: 'rubyCatastrophe', titan: 'topazCatastrophe', garuda: 'emeraldCatastrophe' }[at] : id;
        case 'astralFlow':
          if (this.strikeOk(e)) return 'crimsonStrike';
          if (e.has('ifritsFavor')) return 'crimsonCyclone';
          if (e.has('garudasFavor')) return 'slipstream';
          if (e.has('titansFavor')) return 'mountainBuster';
          return d ? { solar: 'sunflare', bahamut: 'deathflare', phoenix: 'rekindle' }[d] : id;
      }
      return id;
    }

    strikeOk(e) { return this.V.strikeReady ? e.has('crimsonStrikeReady') : e.g.strike; }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.ready && !e.has(a.ready)) return 'Unable to execute action.';
      if (a.demi && this.demiOut(e) !== a.demi) return 'Unable to execute action. The demi-summon isn\'t out.';
      if (a.attune && this.attuned(e) !== a.attune) return 'Unable to execute action. No attunement.';
      if (a.primal) {
        if (!g[PRIMAL[a.primal][1]]) return 'Unable to execute action. Arcanum required.';
        if (this.demiOut(e)) return 'Unable to execute action while a demi-summon is out.';
      }
      if (a.flow && g.flow < 1) return 'Unable to execute action. Aetherflow required.';
      if (id === 'crimsonStrike' && !this.strikeOk(e)) return 'Unable to execute action.';
      if (id === 'searingLight' && this.V.searingCarbuncle && this.demiOut(e)) return 'Unable to execute action. Carbuncle required.';
      if (id === 'astralFlow' || id === 'gemshine' || id === 'preciousBrilliance') return 'Unable to execute action.';
      return null;
    }

    castTime(id, e) {
      const a = this.actions[id];
      if (!a.cast) return 0;
      if (e.has('swiftcast')) return 0;
      return e.speedScale(a.cast);
    }
    consumeInstant(id, e) {
      if (this.actions[id].cast && e.has('swiftcast')) e.removeStatus('swiftcast');
    }

    snapshot(a, e) {
      const mult = e.has('searingLight') ? 1 + (this.V.searing || 0.05) : 1;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main };
    }

    // A pet's hit: your stats with the pet's weapon term; a demi's hits that land after it has gone do nothing.
    petAct(e, id) {
      const a = this.actions[id];
      e.emit('petUse', { id });
      e.queueHit(id, a.potency * this.petK, this.snapshot(a, e), a.delay, null, a.demiHit ? { expires: e.g.demiUntil } : null);
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.kind === 'gcd') {
        e.mp -= a.mp || 0;
        // 7.0–7.05: any GCD but Crimson Cyclone closes Crimson Strike's window.
        if (!this.V.strikeReady) g.strike = id === 'crimsonCyclone';
        // The demi hits once for every GCD you use while it's out.
        const d = this.demiOut(e);
        if (d && !a.demiSummon) this.petAct(e, { solar: 'luxwave', bahamut: 'wyrmwave', phoenix: 'scarletFlame' }[d]);
      }
      if (a.attune) {
        g.stacks--;
        if (g.stacks <= 0) { g.attune = null; g.stacks = 0; }
        if (id === 'topazRite' || id === 'topazCatastrophe') e.addStatus('titansFavor', 30);
      }
      if (a.ready && id !== 'crimsonStrike') e.removeStatus(a.ready);
      if (a.flow) g.flow--;
      if (a.demiSummon) {
        g.demi = a.demiSummon; g.demiUntil = e.now + DEMI; g.next++;
        g.ruby = g.topaz = g.emerald = true;
        g.attune = null; g.stacks = 0;
        e.pet = { kind: 'bahamut' };
        if (a.demiSummon === 'solar') e.addStatus('refulgentLux', 30);
        this.petAct(e, { solar: 'luxwave', bahamut: 'wyrmwave', phoenix: 'scarletFlame' }[a.demiSummon]);
      }
      if (a.primal) {
        const [, gem] = PRIMAL[a.primal];
        g[gem] = false;
        g.attune = a.primal; g.stacks = a.primal === 'ifrit' ? 2 : 4; g.attuneUntil = e.now + 30;
        for (const k of ['ifritsFavor', 'titansFavor', 'garudasFavor', 'crimsonStrikeReady']) e.removeStatus(k, true);
        g.strike = false;
        if (a.primal !== 'titan') e.addStatus(a.primal === 'ifrit' ? 'ifritsFavor' : 'garudasFavor', 30);
        e.pet = { kind: a.primal };
        this.petAct(e, a.petId);
      }
      if (a.petAction) this.petAct(e, a.petAction);
      switch (id) {
        case 'crimsonCyclone': {
          const d = e.distToTarget() || 1;
          if (d > 2.6) {
            const from = { x: e.pos.x, z: e.pos.z };
            e.pos.x *= 2.4 / d; e.pos.z *= 2.4 / d;
            e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
          }
          if (this.V.strikeReady) e.addStatus('crimsonStrikeReady', 30);
          break;
        }
        case 'crimsonStrike': if (this.V.strikeReady) e.removeStatus('crimsonStrikeReady'); g.strike = false; break;
        case 'energyDrain': case 'energySiphon': g.flow = 2; e.addStatus('furtherRuinDt', 60); break;
        case 'searingLight':
          e.addStatus('searingLight', this.V.searingDur || 20);
          if (!this.V.ew) e.addStatus('rubysGlimmer', 30);
          break;
        case 'radiantAegis': e.addStatus('radiantAegis', 30); break;
        default:
          if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
      }
      if (a.potency && a.kind !== 'pet') {
        const snap = this.snapshot(a, e);
        const after = id === 'slipstream' ? () => e.addTStatus('slipstream', 15, { snap: Object.assign({}, snap), dot: { potency: 30, id } }) : null;
        e.queueHit(id, a.potency, snap, a.delay, after);
      }
    }

    // The demi leaves after 15s (Carbuncle comes back); an attunement runs out after 30s.
    nextEvent(e) {
      const g = e.g;
      return Math.min(g.demi ? g.demiUntil : Infinity, g.attune ? g.attuneUntil : Infinity);
    }
    process(e) {
      const g = e.g;
      if (g.demi && e.now >= g.demiUntil - EPS) { g.demi = null; g.demiUntil = 0; e.pet = null; }
      if (g.attune && e.now >= g.attuneUntil - EPS) { g.attune = null; g.stacks = 0; }
    }

    proc(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.ready) return e.has(a.ready);
      if (a.demi) return this.demiOut(e) === a.demi;
      if (a.attune) return this.attuned(e) === a.attune;
      if (a.primal) return !!g[PRIMAL[a.primal][1]] && !this.demiOut(e);
      if (a.flow) return g.flow > 0;
      switch (id) {
        case 'ruin3': case 'triDisaster': case 'enkindleBahamut': return !!this.demiOut(e);
        case 'gemshine': case 'preciousBrilliance': return !!this.attuned(e);
        case 'astralFlow': return this.resolveId(id, e) !== id;
        case 'crimsonStrike': return this.strikeOk(e);
      }
      return false;
    }

    mpRegen() { return B.BASE_REGEN; }
    lucidGain() { return 550; }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · demi-summon every ${e.speedScale(60).toFixed(2)}s · Ruby Rite ${e.speedScale(2.8).toFixed(2)}s cast`; }

    // ---------- the Trance Gauge ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="150" viewBox="0 0 360 150">
  <defs><linearGradient id="sd-bar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6a4ad8"/><stop offset="1" stop-color="#ffd27a"/></linearGradient></defs>
  <rect x="8" y="10" width="344" height="130" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text id="sd-lbl" x="24" y="36" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">TRANCE GAUGE</text>
  <text id="sd-t" x="336" y="38" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="20" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke"></text>
  <rect x="24" y="46" width="312" height="14" rx="7" fill="#1d1a2a" stroke="rgba(255,255,255,.2)"/>
  <rect id="sd-bar" x="24" y="46" width="0" height="14" rx="7" fill="url(#sd-bar)"/>
  ${[['ruby', '#ff6a4a'], ['topaz', '#f0c060'], ['emerald', '#5ae08a']].map(([k], i) => `<polygon id="sd-${k}" points="${44 + i * 40},76 ${56 + i * 40},88 ${44 + i * 40},100 ${32 + i * 40},88" fill="#2a2535" stroke="rgba(255,255,255,.35)"/>`).join('')}
  <text id="sd-at" x="168" y="94" font-family="Noto Sans, sans-serif" font-size="12" font-weight="700" fill="#ffd98a" letter-spacing="1"></text>
  <text x="24" y="126" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">AETHERFLOW</text>
  ${[0, 1].map(k => `<circle id="sd-f${k}" cx="${130 + k * 24}" cy="122" r="8" fill="#2a2535" stroke="rgba(255,255,255,.3)"/>`).join('')}
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.sg = { lbl: $('#sd-lbl'), t: $('#sd-t'), bar: $('#sd-bar'), at: $('#sd-at'), gems: { ruby: $('#sd-ruby'), topaz: $('#sd-topaz'), emerald: $('#sd-emerald') },
        f: [0, 1].map(k => $('#sd-f' + k)), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.sg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      const d = this.demiOut(e), at = this.attuned(e);
      const left = d ? g.demiUntil - e.now : at ? g.attuneUntil - e.now : 0;
      put('lbl', d ? DEMI_NAME[d] : at ? `${at.toUpperCase()} ATTUNED` : 'NEXT: ' + DEMI_NAME[this.cycle[g.next % this.cycle.length]], v => { G.lbl.textContent = v; });
      put('t', Math.round(left * 10), () => { G.bar.setAttribute('width', String(312 * Math.min(1, left / (d ? DEMI : 30)))); G.t.textContent = left > 0 ? left.toFixed(1) : ''; });
      const col = { ruby: '#ff6a4a', topaz: '#f0c060', emerald: '#5ae08a' };
      for (const k of ['ruby', 'topaz', 'emerald']) put(k, g[k], v => G.gems[k].setAttribute('fill', v ? col[k] : '#2a2535'));
      put('at', at ? `${{ ifrit: 'FIRE', titan: 'EARTH', garuda: 'WIND' }[at]} ×${g.stacks}` : '', v => { G.at.textContent = v; });
      for (let i = 0; i < 2; i++) put('f' + i, g.flow > i, v => G.f[i].setAttribute('fill', v ? '#d070ff' : '#2a2535'));
    }

    helpHtml(seq) {
      const V = this.V;
      if (V.ew) return `
<h3>How it plays (${V.label})</h3>
<p>Level 90 Summoner. Every minute <b>Summon Bahamut</b> (an instant GCD on a 60s recast that follows spell speed) brings out <b>Demi-Bahamut</b>, and the next time <b>Demi-Phoenix</b>, for 15s. Ruin III becomes its instant Impulse (Astral Impulse ${V.astral}, Fountain of Fire ${V.fountain}) for six GCDs, <b>Astral Flow</b> is Deathflare (500; Phoenix's Rekindle heals), <b>Enkindle</b> is Akh Morn or Revelation (1,300), and the demi hits once for each GCD (Wyrmwave / Scarlet Flame 150).</p>
<p>Then the primals from its Arcanum: <b>Titan II</b> (four Topaz Rites, ${V.topaz}, each readying Mountain Buster ${V.busterP}), <b>Garuda II</b> (Slipstream ${V.slip} and four Emerald Rites ${V.emerald}) and <b>Ifrit II</b> (Crimson Cyclone → Crimson Strike, ${V.cyclone} each, the strike only as the very next GCD; two Ruby Rites ${V.ruby}, 2.8s casts on a ${V.rubyRecast}s recast). Each primal hits for ${V.summon} as it arrives. Fill with <b>Ruin III</b> (${V.ruin3}) and <b>Ruin IV</b> (${V.ruin4}). <b>Energy Drain</b> (60s) gives two Aetherflow for <b>Fester</b> (${V.necrotize}) and Further Ruin. <b>Searing Light</b> is +3% for 30s every 120s${V.searingCarbuncle ? ', and Carbuncle casts it, so not while a demi is out: press it just before Summon Bahamut' : ', inside Bahamut'}. No Solar Bahamut until Dawntrail.</p>
<h3>The opener (The Balance)</h3>
${seq(V.searingCarbuncle
    ? ['ruin3', ['searingLight'], 'ruin3', 'summonBahamut', ['tincture'], 'astralImpulse', ['energyDrain'], 'astralImpulse', ['enkindleBahamut'], ['necrotize'], 'astralImpulse', ['deathflare'], ['necrotize'], 'astralImpulse', 'astralImpulse', 'astralImpulse', 'summonTitan2', 'topazRite', ['mountainBuster'], 'topazRite', ['mountainBuster'], 'topazRite', ['mountainBuster'], 'topazRite', ['mountainBuster'], 'summonGaruda2', ['swiftcast'], 'slipstream', 'emeraldRite', 'emeraldRite', 'emeraldRite', 'emeraldRite', 'summonIfrit2', 'crimsonCyclone', 'crimsonStrike', 'rubyRite', 'rubyRite', 'ruin4', 'ruin3']
    : ['ruin3', 'summonBahamut', ['searingLight'], 'astralImpulse', ['tincture'], 'astralImpulse', 'astralImpulse', ['energyDrain'], ['enkindleBahamut'], 'astralImpulse', ['deathflare'], ['necrotize'], 'astralImpulse', ['necrotize'], 'astralImpulse', 'summonTitan2', 'topazRite', ['mountainBuster'], 'topazRite', ['mountainBuster'], 'topazRite', ['mountainBuster'], 'topazRite', ['mountainBuster'], 'summonGaruda2', ['swiftcast'], 'slipstream', 'emeraldRite', 'emeraldRite', 'emeraldRite', 'emeraldRite', 'summonIfrit2', 'crimsonCyclone', 'crimsonStrike', 'rubyRite', 'rubyRite', 'ruin4', 'ruin3'])}
<p>Ruin III is hardcast at −1.5s.</p>
<p style="color:#a9a3b4">${V.label} numbers: Ruin III ${V.ruin3}, Ruin IV ${V.ruin4}, Astral Impulse ${V.astral}, Fountain of Fire ${V.fountain}, Deathflare 500, Akh Morn and Revelation 1,300, primal summons ${V.summon}, Ruby Rite ${V.ruby}, Topaz Rite ${V.topaz}, Emerald Rite ${V.emerald}, Crimson Cyclone and Strike ${V.cyclone}, Slipstream ${V.slip}, Mountain Buster ${V.busterP}, Fester ${V.necrotize}, Energy Drain 200. Gear: ${V.gear}.</p>`;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 100 Summoner, built around a one-minute loop. <b>Summon Bahamut</b> (one button: an instant GCD every 60s, faster with spell speed) brings out <b>Solar Bahamut</b>, <b>Demi-Bahamut</b>, Solar Bahamut, <b>Demi-Phoenix</b> in turn for 15s. While it's out, Ruin III is its instant Impulse (Umbral Impulse ${V.umbral[0]}, Astral Impulse 500, Fountain of Fire 580) for six GCDs, <b>Astral Flow</b> is its big oGCD (Sunflare ${V.sunflare.toLocaleString()}, Deathflare 500; Phoenix's Rekindle heals) and <b>Enkindle</b> its pet nuke (Exodus ${V.exodus.toLocaleString()}, Akh Morn / Revelation 1,300). The demi also hits once for every GCD you use (Luxwave 160, Wyrmwave / Scarlet Flame 150).</p>
<p>The demi leaves Ruby, Topaz and Emerald Arcanum. <b>Summon Titan II</b>: four <b>Topaz Rites</b> (340, instant), each readying <b>Mountain Buster</b> (160) on Astral Flow. <b>Summon Garuda II</b>: <b>Slipstream</b> (${V.slip}, a 3s cast, a windstorm of 30 a tick) and four <b>Emerald Rites</b> (${V.emerald}, 1.5s recast). <b>Summon Ifrit II</b>: <b>Crimson Cyclone</b> (${V.cyclone}, a dash) then <b>Crimson Strike</b> (${V.cyclone}, melee range${V.strikeReady ? '; Ruby Rites can go between' : ', and only as the very next GCD'}) and two cast <b>Ruby Rites</b> (${V.ruby}, 2.8s). Each primal hits for ${V.summon} as it arrives. Fill with <b>Ruin III</b> (${V.ruin3}) and <b>Ruin IV</b> (${V.ruin4}, from Further Ruin).</p>
<p><b>Energy Drain</b> (60s) gives two Aetherflow for <b>Necrotize</b> (${V.necrotize}) and Further Ruin. <b>Searing Light</b> (+5% for you and your pets, 120s) goes on Solar Bahamut every two minutes and readies <b>Searing Flash</b> (${V.flash}). Swiftcast is for Slipstream or Ruby Rite.</p>
<h3>The opener (The Balance, 2.48)</h3>
${seq(['ruin3', 'summonSolarBahamut', ['tincture'], 'umbralImpulse', ['searingLight'], 'umbralImpulse', 'umbralImpulse', ['energyDrain'], 'umbralImpulse', ['enkindleSolarBahamut'], ['necrotize'], 'umbralImpulse', ['sunflare'], ['necrotize'], 'umbralImpulse', ['searingFlash'], 'summonTitan2', 'topazRite', ['mountainBuster'], 'topazRite', ['mountainBuster'], 'topazRite', ['mountainBuster'], 'topazRite', ['mountainBuster'], 'summonGaruda2', ['swiftcast'], 'slipstream', 'emeraldRite', 'emeraldRite', 'emeraldRite', 'emeraldRite', 'summonIfrit2', 'crimsonCyclone', 'crimsonStrike', 'rubyRite', 'rubyRite', 'ruin4', 'ruin3'])}
<p>Ruin III is hardcast at −1.5s (or summon at 0). Carbuncle is out from the start here.</p>
<p style="color:#a9a3b4">${V.label} numbers: Ruin III ${V.ruin3}, Ruin IV ${V.ruin4}, Umbral Impulse ${V.umbral[0]}, Astral Impulse 500, Fountain of Fire 580, Sunflare ${V.sunflare.toLocaleString()}, Deathflare 500, Exodus ${V.exodus.toLocaleString()}, Akh Morn and Revelation 1,300, primal summons ${V.summon}, Ruby Rite ${V.ruby}, Topaz Rite 340, Emerald Rite ${V.emerald}, Crimson Cyclone and Strike ${V.cyclone}, Slipstream ${V.slip}, Mountain Buster 160, Necrotize ${V.necrotize}, Energy Drain 200, Searing Flash ${V.flash}. Pets use your stats with a 100 job modifier in the weapon term. How often a demi hits is a guess (once per GCD you use, as on the tooltip's "targets attacked by you"). Gear: ${V.gear}.</p>`;
    }
  }

  B.registerJob({
    id: 'smn', name: 'Summoner', abbr: 'SMN', role: 'caster', classJob: 27,
    versions: ['dt71', 'dt70', 'ew61', 'ew60'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new SummonerDT(v) })),
  });
})(window.BLM);

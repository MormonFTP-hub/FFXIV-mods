// Endwalker (patch 6.5x) Black Mage at level 90: actions, numbers and default layout.
window.BLM = window.BLM || {};

(function (B) {
  // Rough 6.5 best-in-slot stats. Spell speed is typed in settings (it sets the GCD).
  B.BASE_STATS = { int: 3375, wd: 132, det: 1886, crit: 2541, dh: 1435 };
  B.SPS_MIN = 400;   // level 90 base
  B.SPS_MAX = 4000;

  B.MAX_MP = 10000;
  B.ENOCHIAN = 1.23;           // Enhanced Enochian III after 6.4
  B.TRAIT = 130;               // Maim and Mend II
  B.ELEMENT_DURATION = 15;
  B.POLYGLOT_TIME = 30;
  B.POLYGLOT_MAX = 2;
  B.UI_REGEN = [3200, 4700, 6200];
  B.BASE_REGEN = 200;
  B.LUCID_REGEN = 550;
  B.QUEUE_WINDOW = 0.5;
  B.CASTER_TAX = 0.1;
  B.BASE_LOCK = 0.6;          // server-side animation lock for most actions
  B.PING_MAX = 500;
  B.SLIDECAST = 0.5;
  B.TINCTURE_INT = 262;        // Grade 8 Tincture of Intelligence cap
  B.RANGE = 25;
  B.DUMMY_RADIUS = 0.8;

  // kind: gcd | ogcd | item. school drives Astral Fire / Umbral Ice math.
  // delay is how long after the cast resolves the damage lands.
  B.ACTIONS = {
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
      dot: { potency: 35, duration: 30 },
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
      name: 'Foul', kind: 'gcd', school: 'none', potency: 600, mp: 0, cast: 0, delay: 1.16, target: true,
      desc: 'Deals unaspected damage to target and all enemies nearby it with a potency of 600 for the first enemy, and 60% less for all remaining enemies.\nPolyglot Cost: 1',
    },
    scathe: {
      name: 'Scathe', kind: 'gcd', school: 'none', potency: 100, mp: 800, cast: 0, delay: 0.67, target: true,
      desc: 'Deals unaspected damage with a potency of 100.\nAdditional Effect: 20% chance potency will double',
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
    swiftcast: {
      name: 'Swiftcast', kind: 'ogcd', recast: 60, role: true,
      desc: 'Next spell is cast immediately.\nDuration: 10s',
    },
    lucidDreaming: {
      name: 'Lucid Dreaming', kind: 'ogcd', recast: 60, role: true,
      desc: 'Gradually restores MP.\nPotency: 55\nDuration: 21s',
    },
    addle: {
      name: 'Addle', kind: 'ogcd', recast: 90, role: true, target: true,
      desc: 'Lowers target\'s physical damage dealt by 5% and magic damage dealt by 10%.\nDuration: 10s',
    },
    surecast: {
      name: 'Surecast', kind: 'ogcd', recast: 120, role: true,
      desc: 'Spells can be cast without interruption.\nAdditional Effect: Nullifies most knockback and draw-in effects\nDuration: 6s',
    },
    sprint: {
      name: 'Sprint', kind: 'ogcd', recast: 60,
      desc: 'Increases movement speed.\nDuration: 10s',
    },
    tincture: {
      name: 'Grade 8 Tincture of Intelligence', short: 'Tincture', kind: 'item', recast: 270, lock: 1.1,
      desc: 'This diluted brew temporarily increases intelligence for twice the duration of similar potions.\nIntelligence +10% (Max 262)\nDuration: 30s',
    },
  };

  // Status display info. self: true sits on the player, false on the target.
  B.STATUSES = {
    firestarter: { name: 'Firestarter', self: true, icon: 'st_firestarter' },
    thundercloud: { name: 'Thundercloud', self: true, icon: 'st_thundercloud' },
    sharpcast: { name: 'Sharpcast', self: true, icon: 'st_sharpcast' },
    triplecast: { name: 'Triplecast', self: true, icon: 'st_triplecast' },
    swiftcast: { name: 'Swiftcast', self: true, icon: 'st_swiftcast' },
    leyLines: { name: 'Ley Lines', self: true, icon: 'st_leylines' },
    circleOfPower: { name: 'Circle of Power', self: true, icon: 'st_circle' },
    lucidDreaming: { name: 'Lucid Dreaming', self: true, icon: 'st_lucid' },
    manaward: { name: 'Manaward', self: true, icon: 'st_manaward' },
    surecast: { name: 'Surecast', self: true, icon: 'st_surecast' },
    sprint: { name: 'Sprint', self: true, icon: 'st_sprint' },
    medicated: { name: 'Medicated', self: true, icon: 'st_medicated' },
    thunder3: { name: 'Thunder III', self: false, icon: 'st_thunder3' },
    addle: { name: 'Addle', self: false, icon: 'st_addle' },
  };

  // Order matters for the buff row, like the game's own sort.
  B.SELF_STATUS_ORDER = ['circleOfPower', 'leyLines', 'triplecast', 'swiftcast', 'sharpcast', 'firestarter',
    'thundercloud', 'medicated', 'lucidDreaming', 'manaward', 'surecast', 'sprint'];

  B.DEFAULT_BARS = [
    ['fire3', 'fire4', 'despair', 'fire', 'blizzard3', 'blizzard4', 'blizzard', 'thunder3', 'xenoglossy', 'foul', 'umbralSoul', 'scathe'],
    ['sharpcast', 'triplecast', 'swiftcast', 'leyLines', 'betweenTheLines', 'amplifier', 'manafont', 'transpose', 'lucidDreaming', 'tincture', 'addle', 'manaward'],
    ['surecast', 'sprint', null, null, null, null, null, null, null, null, null, null],
  ];

  const ROW = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'];
  B.DEFAULT_BINDS = [
    ROW.slice(),
    ROW.map(k => 'Shift+' + k),
    ['KeyQ', 'KeyE', 'KeyR', 'KeyF', 'KeyT', 'KeyG', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyY'],
  ];

  B.DEFAULT_SETTINGS = {
    name: 'Warrior of Light',
    sps: 1160,            // 2.37 GCD
    ping: 70,             // ms; the vanilla client adds it to every lock
    latencyComp: false,   // NoClippy / XivAlexander
    volume: 0.5,
    pullLength: 0,        // seconds, 0 = until you stop
    countdown: 15,
    showMpCost: true,
    slidecastMarker: true,
    showTimeline: true,
  };

  // Rough dummy colour bands for a single target parse with no raid buffs.
  B.PARSE_BANDS = [
    { min: 0, color: '#9d9d9d' },
    { min: 0.75, color: '#1eff00' },
    { min: 0.85, color: '#0070ff' },
    { min: 0.92, color: '#a335ee' },
    { min: 0.97, color: '#ff8000' },
    { min: 1.0, color: '#e268a8' },
    { min: 1.02, color: '#e5cc80' },
  ];
})(window.BLM);

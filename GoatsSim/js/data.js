// Heroes, numbers and lines for the late-2018 GOATS meta (around patch 1.30): Reinhardt, Zarya, D.Va,
// Lucio, Brigitte and Zenyatta on both sides. Numbers are the live values of that era where they matter
// to the fight (health pools, ult effects, cooldowns); ult costs are tuned so a fight plays out with the
// rotations it did then rather than copied exactly.
(function (G) {
  G.TEAM = { BLUE: 0, RED: 1 };

  G.HEROES = {
    reinhardt: {
      name: 'Reinhardt', short: 'REIN', color: '#a9b7c2', hp: 300, armor: 200, shields: 0,
      speed: 5.5, radius: 0.75, height: 2.45, eye: 2.05, ultCost: 1540, ult: 'Earthshatter',
      model: 'reinhardt',
      hammer: { dmg: 75, range: 5, arc: 0.9, period: 0.9, hitAt: 0.32 },
      barrier: { hp: 2000, regen: 195, regenDelay: 2, brokenCd: 5, slow: 0.7, radius: 2.7, halfArc: 0.95, height: 3.0 },
      charge: { speed: 16.5, dur: 2.4, cd: 10, pin: 300, bump: 50, turn: 1.1 },
      fireStrike: { dmg: 100, speed: 25, range: 40, cd: 6, windup: 0.4, radius: 0.9 },
      shatter: { dmg: 50, range: 20, halfAngle: 0.33, stun: 2.5, windup: 0.62 },
    },
    zarya: {
      name: 'Zarya', short: 'ZARYA', color: '#e978b7', hp: 200, armor: 0, shields: 200,
      speed: 5.5, radius: 0.5, height: 1.95, eye: 1.7, ultCost: 1680, ult: 'Graviton Surge',
      model: 'zarya',
      beam: { dps: 95, range: 15 }, alt: { dmg: 47, speed: 25, splash: 2, period: 0.65 },
      bubble: { hp: 200, dur: 2, selfCd: 10, allyCd: 8 },
      grav: { radius: 6, dur: 4, dps: 22, range: 30, speed: 22 },
    },
    dva: {
      name: 'D.Va', short: 'D.VA', color: '#f59fc9', hp: 400, armor: 200, shields: 0,
      speed: 5.5, radius: 0.85, height: 2.3, eye: 1.95, ultCost: 1540, ult: 'Self-Destruct',
      model: 'dva_mech',
      guns: { pellet: 2, pellets: 11, period: 0.15, range: 15, slow: 0.5 },
      matrix: { dur: 3, range: 10, regen: 0.33, delay: 1 },
      boosters: { speed: 12, dur: 2, cd: 5, dmg: 25 },
      missiles: { dmg: 6, count: 18, cd: 8 },
      bomb: { dmg: 1000, radius: 20, fuse: 3, launch: 9 },
      baby: { hp: 150, speed: 5.5, gun: 14, period: 0.14, model: 'dva_pilot' },
    },
    lucio: {
      name: 'Lucio', short: 'LUCIO', color: '#8fd14f', hp: 200, armor: 0, shields: 0,
      speed: 5.5, radius: 0.45, height: 1.7, eye: 1.5, ultCost: 2380, ult: 'Sound Barrier',
      model: 'lucio',
      gun: { dmg: 20, shots: 4, period: 0.9, speed: 50 },
      wave: { dmg: 25, range: 8, cd: 4, push: 9 },
      song: { heal: 16.25, speed: 0.3, radius: 10 }, amp: { dur: 3, cd: 12, heal: 3.25, speed: 0.7 },
      beat: { shields: 750, decay: 6, radius: 30 },
    },
    brigitte: {
      name: 'Brigitte', short: 'BRIG', color: '#e8a23a', hp: 150, armor: 50, shields: 0,
      speed: 5.5, radius: 0.5, height: 1.75, eye: 1.55, ultCost: 1820, ult: 'Rally',
      model: 'brigitte',
      flail: { dmg: 35, range: 6, period: 0.6, arc: 1.0 },
      whip: { dmg: 70, range: 20, cd: 4, push: 10 },
      pack: { heal: 150, dur: 2, charges: 3, recharge: 6, range: 30 },
      shield: { hp: 200, regen: 100 }, bash: { dmg: 5, stun: 0.75, range: 7, cd: 5 },
      inspire: { hps: 16, dur: 5, radius: 15 },
      rally: { dur: 10, armor: 100, rate: 15, radius: 15, speed: 0.3 },
    },
    zenyatta: {
      name: 'Zenyatta', short: 'ZEN', color: '#f4d35e', hp: 50, armor: 0, shields: 150,
      speed: 5.5, radius: 0.45, height: 1.75, eye: 1.6, ultCost: 2100, ult: 'Transcendence',
      model: 'zenyatta',
      orb: { dmg: 46, period: 0.4, speed: 90 },
      harmony: { hps: 30, range: 40 }, discord: { amp: 0.3, range: 40 },
      trans: { hps: 300, dur: 3, radius: 10, speed: 1.0 },
    },
  };

  // Ult charge: points per damage dealt / healing done, scaled so one fight lets each side bring
  // one or two more ults online, the way a long brawl did.
  G.ULT = { perDamage: 0.55, perBarrier: 0.25, perHeal: 0.55, passive: 5 };

  G.COMP = ['reinhardt', 'zarya', 'dva', 'lucio', 'brigitte', 'zenyatta'];

  // Fictional battletags. The player is the blue Reinhardt.
  G.NAMES = [
    { reinhardt: 'You', zarya: 'Bubbles', dva: 'NerfThis', lucio: 'DropTheBeat', brigitte: 'Rallycat', zenyatta: 'Iris' },
    { reinhardt: 'Krusher', zarya: 'Siberia', dva: 'MEKA', lucio: 'Frogger', brigitte: 'Svensk', zenyatta: 'Monk' },
  ];

  // Ult voice lines: what you hear from your own side and from the other side.
  G.ULT_LINES = {
    reinhardt: ['Hammer DOWN!', 'Hammer DOWN!'],
    zarya: ['Fire at will!', 'Огонь по готовности!'],
    dva: ['Nerf this!', 'Nerf this!'],
    lucio: ["Oh, let's break it down!", "Oh, let's break it down!"],
    brigitte: ['Everyone, rally to me!', 'Alla, samlas hos mig!'],
    zenyatta: ['Experience tranquility.', 'Pass into the Iris.'],
  };

  // Team comms. Keys are events; a line is picked at random. {t} is the target hero's name.
  G.COMMS = {
    ultReady: {
      zarya: ['Grav is up.', 'I have Graviton.'], dva: ['Bomb is ready.', 'I have bomb.'],
      lucio: ['Beat is ready.', 'Sound Barrier up.'], brigitte: ['Rally is ready.'],
      zenyatta: ['Trans is ready.', 'I have Transcendence.'],
    },
    engage: { lucio: ['Speed in, speed in!', 'Amping, GO GO GO!', 'Speed boost, go!'] },
    grav: { zarya: ['GRAV! Grav is down!', 'Graviton on {n}!'] },
    gravBomb: { dva: ['Bombing the grav!', 'Bomb going in!'] },
    bomb: { dva: ['Bomb out, play behind it!', 'Bombing, watch the angle!'] },
    trans: { zenyatta: ['Trans! Stay with me!', 'Transcending!'] },
    beat: { lucio: ['Dropping the beat!', 'Beat! Beat!'] },
    rally: { brigitte: ['Rallying, let\'s go!', 'Rally! Brawl it out!'] },
    shatter: { zarya: ['Rein, shatter!', 'Shatter landed, kill them!'] },
    enemyUlt: {
      zarya: ['Their grav is gone!', 'Zarya used grav.'], dva: ['Their bomb is used!', 'Bomb is down!'],
      lucio: ['Their beat is down! Go!', 'Beat used!'], zenyatta: ['Trans is down, they have no saves!', 'Their Zen used trans!'],
      brigitte: ['Their Brig rallied.'], reinhardt: ['Their Rein shattered!'],
    },
    bubble: { zarya: ['Bubble on you, {t}!', 'Bubbled!'] },
    discord: { zenyatta: ['Discord on the {t}.', 'Discord {t}, focus!'] },
    dive: { dva: ['Diving their Zen.', 'On the Zen!'] },
    kill: {
      zarya: ['Got one.', 'Zarya down.'], dva: ['Easy.', 'GG EZ.'], lucio: ['Yeah!', 'Got him!'],
      brigitte: ['One down!'], zenyatta: ['Their {t} is down.'],
    },
    death: { any: ['I\'m down.', 'Dead, sorry.', 'I died.'] },
    lowShield: { brigitte: ['Rein, your shield is low!'], zenyatta: ['Shield is cracking.'] },
    hold: { zenyatta: ['Hold, wait for speed.', 'Don\'t go yet.'], lucio: ['Hold, hold...'] },
  };

  G.COLORS = { blue: '#4fc3ff', red: '#ff4a5a', blueDim: 'rgba(79,195,255,0.35)', redDim: 'rgba(255,74,90,0.35)' };
})(window.G = window.G || {});

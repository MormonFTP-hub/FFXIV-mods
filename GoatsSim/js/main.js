// The game: loads everything, sets up a fight at Hanamura's first point, runs the simulation and the
// render loop, and keeps score across fights. Your team attacks through the main gate; the bots on both
// sides play GOATS; the fight ends when a team is wiped, the point is taken, or time runs out.
(function (G) {
  const T = THREE;
  const $ = (id) => document.getElementById(id);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // Hanamura, first point (three.js space: x east, z south). Taken from the map renders and nav data.
  // The town (attackers) is east and low; the plaza in front of the gate is x 30-39; the gate opening is
  // at x 26-29, z -6..-2; inside, a platform steps down into Point A's courtyard (x 6-18) by the bell temple.
  // The defenders set up on the point; the attackers walk in through the gate, take the platform above
  // the courtyard (stage) and fight down off the stairs.
  const MAP = {
    point: [12, -1.0, -8.5], pointR: 5.5,
    gate: [28, 0, -4],
    plaza: [35, 0, 0],
    hold: [13.5, -1, -6],
    stage: [23.5, 0, -3],
    spawn: [[58, -1, 12], [2, 0, -6]],
    blueStart: [[36, 0, 0], [35, 0, 2.5], [35.5, 0, -2.5], [38.5, 0, 1.5], [38, 0, -1], [39, 0, 3]],
    redStart: [[13.5, -1, -6], [12, -1, -9], [12.5, -1, -2.5], [9.5, -1, -7], [11, -1, -4.5], [6.5, -1, -8]],
  };

  // Who walks in with which ults. Your own Shatter isn't set here: you start the first fight at 0% and
  // whatever charge you end a fight with carries into the next one.
  const SCENARIOS = [
    { name: 'Even fight', brief: 'Both teams walk in with their ults; your Shatter you build yourself. Whoever wins the trade wins the fight: make them use their saves first.',
      blue: { zarya: 1, dva: 1, lucio: 1, brigitte: 1, zenyatta: 1 }, red: { zarya: 1, dva: 1, lucio: 1, brigitte: 1, zenyatta: 1, reinhardt: 1 } },
    { name: 'Ult advantage', brief: 'You hold Grav and Bomb. They hold Trans and Beat. Bait a save out before you commit the combo.',
      blue: { zarya: 1, dva: 1, lucio: 0.5, brigitte: 0.7, zenyatta: 0.6 }, red: { zarya: 0.5, dva: 0.55, lucio: 1, brigitte: 0.6, zenyatta: 1, reinhardt: 0.7 } },
    { name: 'They have the combo', brief: 'They hold Grav and Bomb. You hold Trans and Beat. Keep your shield on the bomb and make them waste ults.',
      blue: { zarya: 0.45, dva: 0.5, lucio: 1, brigitte: 0.8, zenyatta: 1 }, red: { zarya: 1, dva: 1, lucio: 0.5, brigitte: 1, zenyatta: 0.6, reinhardt: 0.6 } },
    { name: 'Their Shatter', brief: 'Their Reinhardt walks in with Shatter. Don’t swing in front of him with your shield down; make him throw it into your barrier.',
      blue: { zarya: 0.7, dva: 0.6, lucio: 1, brigitte: 1, zenyatta: 0.7 }, red: { zarya: 0.7, dva: 0.7, lucio: 0.8, brigitte: 1, zenyatta: 1, reinhardt: 1 } },
  ];

  class Game {
    constructor() {
      this.world = new G.World($('scene'));
      this.time = 0;
      this.state = 'loading';
      this.units = [];
      this.projectiles = [];
      this.gravs = [];
      this.bombs = [];
      this.timers = [];
      this.listeners = {};
      this.usedAt = {};
      this.blue = 0;
      this.red = 1;
      this.fightNo = 0;
      this.record = { won: 0, lost: 0 };
      this.skill = 0.85;
      this.capture = 0;
      this.pointState = 'ATTACK';
      this.log = [];
    }

    // ---------------------------------------------------------------- helpers used everywhere
    team(t) { return this.units.filter((u) => u.team === t); }
    enemiesOf(t) { return this.units.filter((u) => u.team !== t); }
    alliesOf(t) { return this.units.filter((u) => u.team === t); }
    byHero(t, h) { return this.units.filter((u) => u.team === t && u.hero === h); }
    later(s, fn) { this.timers.push({ at: this.time + s, fn }); }
    on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
    emit(ev, data) { for (const fn of this.listeners[ev] || []) fn(data); }
    running() { return this.state === 'fight' || this.state === 'countdown'; }
    vec(a) {
      const p = new T.Vector3(a[0], a[1], a[2]);
      const g = this.world.groundAt(p.x, p.z, p.y + 2);
      if (!isNaN(g)) p.y = g;
      return p;
    }

    // team voice comms: you only hear your own team
    comms(u, key, vars) {
      const set = G.COMMS[key];
      if (!set || u.team !== this.blue) return;
      let lines = set[u.hero] || set.any;
      if (key === 'enemyUlt' && vars) lines = G.COMMS.enemyUlt[vars.hero];
      if (!lines) return;
      let text = pick(lines);
      if (vars) text = text.replace('{t}', vars.t || '').replace('{n}', vars.n || '');
      this.hud.comm(u, text);
      if (u.team === this.blue) this.audio.say(text, true);
    }

    makeRig(model) {
      const r = new G.Rig(G.Assets.gltf[model]);
      this.world.scene.add(r.root);
      return r;
    }

    // ---------------------------------------------------------------- setup
    async init() {
      const bar = $('load-bar').firstElementChild;
      try {
        await G.Assets.load((txt, p) => { $('load-state').textContent = txt; bar.style.width = Math.round(p * 100) + '%'; });
      } catch (err) {
        $('load-state').innerHTML = `Couldn't load the models (${err.message}).<br>Run the export tools first (see README), and serve the folder: <code>python -m http.server 8803 --directory GoatsSim</code>`;
        throw err;
      }
      const W = this.world;
      W.addMap(G.Assets.gltf.hanamura);
      W.loadNav(G.Assets.nav);
      this.map = {
        point: new T.Vector3(...MAP.point), pointR: MAP.pointR, gate: new T.Vector3(...MAP.gate), hold: new T.Vector3(...MAP.hold), plaza: new T.Vector3(...MAP.plaza), stage: new T.Vector3(...MAP.stage),
      };
      W.buildReach([this.map.point, new T.Vector3(...MAP.blueStart[0]), new T.Vector3(...MAP.redStart[0])].map((p) => p.clone().setY(p.y + 1)));
      for (const k of ['point', 'gate', 'hold', 'plaza', 'stage']) this.map[k] = this.vec(this.map[k].toArray());
      this.map.spawn = MAP.spawn.map((s) => this.vec(s));
      this.fx = new G.FX(this);
      this.audio = new G.Audio(this);
      this.hud = new G.HUD(this);
      this.buildPointMarker();
      for (const team of [this.blue, this.red]) {
        for (const hero of G.COMP) {
          const u = new G.Unit(this, team, hero);
          if (hero === 'dva') {
            u.rigs = { mech: this.makeRig('dva_mech'), pilot: this.makeRig('dva_pilot') };
            this.world.scene.add(u.rigs.pilot.addWeapon(G.Assets.gltf.lightgun, 'lightgun'));
          } else {
            u.rig = this.makeRig(hero);
            const ws = { reinhardt: ['hammer'], zarya: ['cannon'], lucio: ['amp'], brigitte: ['flail', 'shield'] }[hero] || [];
            for (const w of ws) this.world.scene.add(u.rig.addWeapon(G.Assets.gltf[w], w));
          }
          this.units.push(u);
        }
      }
      this.playerUnit = this.units.find((u) => u.team === this.blue && u.hero === 'reinhardt');
      this.player = new G.Player(this, this.playerUnit);
      this.directors = [new G.Director(this, this.blue, 'attack'), new G.Director(this, this.red, 'defense')];
      for (const u of this.units) new G.Brain(u, this.directors[u.team]);
      this.autopilot = /[?&]auto/.test(location.search);
      this.hud.buildTeams();
      this.hud.bindNarration();
      this.bindEvents();
      this.bindUI();
      this.setupFight(true);
      this.state = 'menu';
      $('load-state').textContent = 'Ready. Click Play.';
      $('b-play').disabled = false;
      $('b-watch').disabled = false;
      let last = performance.now();
      const frame = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        this.frame(dt);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }

    buildPointMarker() {
      const p = this.map.point, r = this.map.pointR;
      const ring = new T.Mesh(new T.RingGeometry(r - 0.25, r, 64), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, side: T.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(p.x, p.y + 0.08, p.z);
      const disc = new T.Mesh(new T.CircleGeometry(r - 0.25, 64), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, depthWrite: false, side: T.DoubleSide }));
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(p.x, p.y + 0.06, p.z);
      this.world.scene.add(ring, disc);
      this.pointRing = ring;
      this.pointDisc = disc;
    }

    setupFight(quiet) {
      this.fightNo += quiet ? 0 : 1;
      const sc = this.fightNo <= 1 ? SCENARIOS[0] : pick(SCENARIOS);
      this.scenario = sc;
      this.time = 0;
      this.projectiles = []; this.gravs = []; this.bombs = []; this.timers = [];
      this.usedAt = {};
      this.capture = 0;
      this.log = [];
      this.result = null;
      this.lopsided = 0;
      this.lastDamageAt = 0;
      for (const d of this.directors) { d.phase = 'setup'; d.phaseAt = 0; d.enemyUsed = {}; d.saveAt = -99; d.called = {}; d.bombAt = -99; d.lastUlt = -99; d.nextThink = 0; }
      const starts = { [this.blue]: MAP.blueStart, [this.red]: MAP.redStart };
      const order = G.COMP;
      for (const u of this.units) {
        u.reset();
        u.stats = { dmg: 0, heal: 0, blocked: 0, kills: 0, deaths: 0, ults: 0, hits: 0 };
        G.Kits[u.hero].init(u);
        const s = starts[u.team][order.indexOf(u.hero)];
        u.pos.copy(this.vec([s[0] + rnd(-0.5, 0.5), s[1], s[2] + rnd(-0.5, 0.5)]));
        if (!this.world.reachable(u.pos)) u.pos.copy(this.world.nearestReachable(u.pos));
        u.yaw = u.team === this.blue ? -Math.PI / 2 : Math.PI / 2;
        u.bodyYaw = u.yaw;
        u.pitch = 0;
        if (u === this.playerUnit) u.ult = Math.min(u.ultCost, this.carryUlt || 0);
        else {
          const frac = (u.team === this.blue ? sc.blue : sc.red)[u.hero] || 0.7;
          u.ult = Math.min(u.ultCost, u.ultCost * frac * rnd(0.97, 1.03));
          if (frac >= 1) u.ult = u.ultCost;
        }
        u.readyAt = -10;
        if (u.anim) { u.anim.last.copy(u.pos); u.anim.fall = 0; u.anim.alpha = 1; }
        if (u.rig) { u.rig.setOpacity(1); u.rig.root.visible = true; }
        if (u.rigs) for (const k in u.rigs) { u.rigs[k].setOpacity(1); }
        if (u.brain) Object.assign(u.brain, { path: null, pathAt: -99, pathGoal: null, waitSave: 0, target: null, errAt: 0, speedUntil: 0 });
      }
      this.player.third = 0;
      this.roundEnd = 5 + 100;
      this.state = quiet ? 'menu' : 'countdown';
      this.countEnd = 5;
    }

    startFight(watch) {
      if (watch !== undefined) this.autopilot = watch;
      $('menu').classList.add('hidden');
      $('result').classList.add('hidden');
      $('pause').classList.add('hidden');
      this.hud.show(true);
      this.audio.start();
      this.setupFight(false);
      this.hud.reset();
      this.player.specPos = null;
      this.player.specAngle = undefined;
      this.hud.center(`FIGHT ${this.fightNo} · ${this.scenario.name.toUpperCase()}`, 3.5, 'big');
      $('coach-text').textContent = this.autopilot ? `Watching: ${this.scenario.brief}` : this.scenario.brief;
      this.hud.coachText = this.scenario.brief;
      this.hud.coachUntil = 6;
      this.hud.coachPrio = 5;
      if (!this.autopilot) this.lockMouse();
    }

    // newer browsers return a promise that rejects when the lock isn't allowed (no click yet, embedded page)
    lockMouse() {
      const p = this.world.renderer.domElement.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    }

    pause(on) {
      if (on && this.running()) {
        this.paused = this.state;
        this.state = 'paused';
        $('pause').classList.remove('hidden');
      } else if (!on && this.state === 'paused') {
        this.state = this.paused;
        $('pause').classList.add('hidden');
        this.lockMouse();
      }
    }

    // ---------------------------------------------------------------- events
    bindEvents() {
      const P = () => this.playerUnit;
      this.on('damage', (e) => {
        if (e.amount > 0) this.lastDamageAt = this.time;
        if (e.src === P() && e.amount > 0) { this.hud.hit(false); this.audio.play('hit'); }
        if (e.unit === P() && e.amount > 0) { this.hud.hurtFrom(e.src); if (Math.random() < 0.3) this.audio.play('hurt'); }
        if (e.kind === 'Rocket Hammer' && e.src) this.audio.play('hammerHit', e.unit.pos);
      });
      this.on('barrierHit', (e) => { if (Math.random() < 0.3) this.audio.play('shieldHit', e.barrier.owner.pos); });
      this.on('kill', (e) => {
        this.hud.kill(e);
        if (e.killer === P()) { this.hud.hit(true); this.audio.play('kill'); }
        this.logEvent(`${e.killer ? this.who(e.killer) + ' killed ' : ''}${this.who(e.unit)}${e.kind ? ' (' + e.kind + ')' : ''}`, e.unit.team === this.blue ? 'bad' : 'good');
        if (e.unit.team === this.blue && !e.unit.isPlayer && Math.random() < 0.6) this.later(0.3, () => this.comms(e.unit, 'death'));
        if (e.killer && e.killer.team === this.blue && !e.killer.isPlayer && Math.random() < 0.4) this.later(0.4, () => e.killer.alive && this.comms(e.killer, 'kill', { t: e.unit.H.name }));
      });
      this.on('demech', (e) => {
        this.hud.kill({ unit: e.unit, killer: e.killer, kind: e.kind, mech: true });
        this.logEvent(`${this.who(e.unit)}'s mech went down`, e.unit.team === this.blue ? 'bad' : 'good');
      });
      this.on('ultReady', (e) => {
        const u = e.unit;
        u.readyAt = this.time;
        if (u === P()) { this.audio.play('ultReady'); this.hud.center('EARTHSHATTER READY — Q', 1.6); }
        else if (u.team === this.blue && this.state === 'fight') this.later(rnd(0.5, 1.5), () => u.alive && this.directors[u.team].say(u.hero, 'ultReady', null, 20));
      });
      this.on('ult', (e) => {
        const u = e.unit, ally = u.team === this.blue;
        this.usedAt[u.id] = this.time;
        const line = G.ULT_LINES[u.hero][ally ? 0 : 1];
        this.hud.ultLine(u, line, ally);
        this.directors[1 - u.team].noteEnemyUlt(u, e.kind);
        this.directors[u.team].noteOwnUlt(u, e.kind);
        const what = { shatter: 'Earthshatter', grav: 'Graviton Surge', bomb: 'Self-Destruct', beat: 'Sound Barrier', trans: 'Transcendence', rally: 'Rally' }[e.kind];
        this.logEvent(`${this.who(u)} used ${what}`, ally ? 'ult' : 'eult');
      });
      this.on('gravLanded', (e) => { if (e.count) this.logEvent(`Grav caught ${e.count}`, e.unit.team === this.blue ? 'good' : 'bad'); });
      this.on('bombExploded', (e) => {
        const killed = e.victims.filter((v) => !v.alive || (v.hero === 'dva' && !v.mech)).length;
        this.logEvent(`Bomb hit ${e.victims.length}${killed ? ', killed ' + killed : ''}`, e.bomb.team === this.blue ? 'good' : 'bad');
        if (e.bomb.team === this.red) this.result_bombBlocked = (this.result_bombBlocked || 0) + (P().barrier.lastHit > this.time - 0.1 ? 1 : 0);
      });
      this.on('shatterLanded', (e) => {
        this.logEvent(`Shatter knocked down ${e.hits.length}`, e.unit.team === this.blue ? (e.hits.length ? 'good' : 'bad') : (e.hits.length ? 'bad' : 'good'));
        if (e.unit === P()) this.shatterHits = (this.shatterHits || 0) + e.hits.length;
      });
      this.on('shatterBlocked', (e) => { if (e.unit === P()) this.shatterBlocked = true; });
      this.on('barrierBreak', (e) => { if (e.barrier.owner === P()) this.hud.center('BARRIER BROKEN', 1.2, 'warn'); });
      this.on('pin', (e) => { if (e.unit === P()) this.logEvent(`You pinned ${this.who(e.target)}`, 'good'); });
      this.on('engage', (e) => this.logEvent(e.team === this.blue ? 'Your team engaged' : 'They engaged', 'info'));
    }

    who(u) { return (u.team === this.blue ? '' : 'Enemy ') + (u.isPlayer ? 'You' : u.H.name); }
    logEvent(text, kind) {
      const t = Math.max(0, this.time - this.countEnd);
      this.log.push({ t, text, kind });
    }

    // ---------------------------------------------------------------- UI
    bindUI() {
      $('b-play').onclick = () => this.startFight(false);
      $('b-watch').onclick = () => this.startFight(true);
      $('b-howto').onclick = () => { $('menu').classList.add('hidden'); $('howto').classList.remove('hidden'); };
      $('b-howto-close').onclick = () => { $('howto').classList.add('hidden'); $('menu').classList.remove('hidden'); };
      $('b-resume').onclick = () => this.pause(false);
      $('b-restart').onclick = () => { this.fightNo--; this.startFight(); };
      $('b-quit').onclick = () => this.toMenu();
      $('b-next').onclick = () => this.startFight(this.autopilot);
      $('b-res-menu').onclick = () => this.toMenu();
      const sens = $('s-sens'), fov = $('s-fov'), coach = $('s-coach'), voice = $('s-voice'), skill = $('s-skill');
      const load = (k, d) => { try { const v = localStorage.getItem('goats.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
      const save = (k, v) => { try { localStorage.setItem('goats.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };
      sens.value = load('sens', 1); fov.value = load('fov', 90); coach.checked = load('coach', true); voice.checked = load('voice', false); skill.value = load('skill', '0.85');
      const apply = () => {
        this.player.sens = +sens.value;
        this.world.camera.fov = +fov.value * 0.75;   // Overwatch's FOV is horizontal; three's is vertical
        this.world.camera.updateProjectionMatrix();
        this.hud.coachOn = coach.checked;
        this.audio.voice = voice.checked;
        this.skill = +skill.value;
        save('sens', +sens.value); save('fov', +fov.value); save('coach', coach.checked); save('voice', voice.checked); save('skill', skill.value);
      };
      for (const el of [sens, fov, coach, voice, skill]) el.onchange = el.oninput = apply;
      apply();
      addEventListener('keydown', (e) => {
        if (e.code === 'Escape' && this.state === 'paused') { e.preventDefault(); }
        if (e.code === 'Enter' && this.state === 'result') this.startFight(this.autopilot);
        if (e.code === 'Escape' && this.autopilot && this.running()) this.toMenu();
      });
      addEventListener('resize', () => this.world.resize());
    }

    toMenu() {
      this.state = 'menu';
      this.carryUlt = 0;
      this.fightNo = 0;
      this.record = { won: 0, lost: 0 };
      document.exitPointerLock && document.exitPointerLock();
      for (const id of ['result', 'pause', 'howto']) $(id).classList.add('hidden');
      $('menu').classList.remove('hidden');
      this.hud.show(false);
      this.setupFight(true);
    }

    // ---------------------------------------------------------------- loop
    frame(dt) {
      if (this.state === 'countdown' || this.state === 'fight') this.tick(dt);
      for (const u of this.units) {
        if (u.rigs) {
          u.rig = u.mech ? u.rigs.mech : u.rigs.pilot;
          u.rigs.mech.root.visible = u.mech && u.alive || (!u.alive && u.rig === u.rigs.mech);
          u.rigs.pilot.root.visible = !u.mech;
          for (const w of u.rigs.pilot.weapons) w.visible = !u.mech;
        }
        if (u.rig) G.Anim.pose(u, u.rig, this.state === 'paused' ? 0 : dt);
      }
      this.fx.update(this.state === 'paused' ? 0 : dt);
      if (this.state === 'menu' || this.state === 'loading') this.menuCamera(dt);
      else this.player.updateCamera(dt);
      this.pointDisc.material.color.set(this.pointState === 'CONTESTED' ? 0xffd040 : (this.capture > 0 ? 0x56c8ff : 0xffffff));
      this.world.renderer.render(this.world.scene, this.world.camera);
      if (this.state !== 'menu' && this.state !== 'loading') this.hud.update(dt);
    }

    menuCamera(dt) {
      this.menuT = (this.menuT || 0) + dt * 0.06;
      const c = this.map.point.clone().add(new T.Vector3(6, 2, 2));
      const a = this.menuT;
      const cam = this.world.camera;
      cam.position.set(c.x + Math.cos(a) * 20, c.y + 16, c.z + Math.sin(a) * 20);
      cam.lookAt(c);
    }

    tick(dt) {
      this.time += dt;
      const t = this.time;
      for (const tm of this.timers.splice(0)) { if (tm.at <= t) tm.fn(); else this.timers.push(tm); }
      if (this.state === 'countdown') {
        const left = this.countEnd - t;
        if (left <= 0) { this.state = 'fight'; this.hud.center('FIGHT!', 1.2, 'big'); }
        else if (Math.ceil(left) !== this.lastCount) { this.lastCount = Math.ceil(left); if (left < 3.5) this.hud.center(String(Math.ceil(left)), 0.9, 'big'); }
      }
      if (!this.autopilot) this.player.update(dt);
      for (const d of this.directors) d.update(dt);
      for (const u of this.units) if (u.brain && (!u.isPlayer || this.autopilot)) u.brain.think(dt);
      for (const u of this.units) this.physics(u, dt);
      for (const u of this.units) if (u.alive || u.hero === 'brigitte') G.Kits[u.hero].tick(u, dt);
      G.Combat.tickProjectiles(this, dt);
      G.Kits.zarya.tickGravs(this, dt);
      G.Kits.dva.tickBombs(this, dt);
      if (this.state === 'fight') { this.objective(dt); this.checkEnd(); }
    }

    physics(u, dt) {
      const t = this.time, W = this.world;
      u.recentDmg *= Math.exp(-dt / 1.2);
      if (!u.alive) return;
      if (this.state === 'fight') u.addUlt(G.ULT.passive * dt);
      // body faces the aim
      let d = u.yaw - u.bodyYaw;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      u.bodyYaw += d * Math.min(1, dt * (u.isPlayer ? 20 : 12));
      // ongoing heals / decays
      if (u.st.pack && u.st.pack.until > t) {
        const before = u.hp + u.armor + u.shields;
        const healed = u.heal(75 * dt, u.st.pack.src);
        const over = 75 * dt - healed;
        if (over > 0 && before >= u.maxTotal() - 1) u.tempArmor = Math.min(75, u.tempArmor + over);
      }
      if (u.temp > 0) u.temp = Math.max(0, u.temp - G.HEROES.lucio.beat.shields / G.HEROES.lucio.beat.decay * dt);
      if (u.has('pinned') || u.has('grav') || u.has('charging') || u.st.bashing > t || u.st.boost > t) {
        if (u.st.boost > t) { u.vel.set(0, 0, 0); }
        if (u.has('grav') || u.st.boost > t) return;
        return;
      }
      const knocked = u.st.knocked > t;
      const speed = (u.hero === 'dva' && !u.mech ? u.H.baby.speed : u.H.speed) * u.speedMul();
      const want = u.canMove() ? u.move.clone().multiplyScalar(speed) : new T.Vector3();
      const accel = knocked ? 0 : (u.onGround ? 60 : 12);
      const dvx = want.x - u.vel.x, dvz = want.z - u.vel.z, dl = Math.hypot(dvx, dvz), step = accel * dt;
      if (dl > 0) { const k = Math.min(1, step / dl); u.vel.x += dvx * k; u.vel.z += dvz * k; }
      if (knocked) { u.vel.x *= Math.exp(-dt * 1.5); u.vel.z *= Math.exp(-dt * 1.5); }
      if (!u.onGround) u.vel.y -= 15 * dt;
      const air = !u.onGround;
      const r = W.slide(u.pos, u.vel.x * dt, u.vel.z * dt, air);
      if (r.blocked && knocked) { u.vel.x *= -0.2; u.vel.z *= -0.2; }
      u.pos.x = r.x; u.pos.z = r.z;
      const ground = isNaN(r.g) ? W.groundAt(u.pos.x, u.pos.z, u.pos.y) : r.g;
      if (u.onGround) {
        if (!isNaN(ground) && ground < u.pos.y - 0.75) u.onGround = false;
        else if (!isNaN(ground)) u.pos.y += (ground - u.pos.y) * Math.min(1, dt * 18);
        if (u.vel.y > 0) u.onGround = false;
      }
      if (!u.onGround) {
        u.pos.y += u.vel.y * dt;
        if (!isNaN(ground) && u.pos.y <= ground) { u.pos.y = ground; u.vel.y = 0; u.onGround = true; }
      }
      // a hero knocked onto a floor that isn't connected to the fight steps back onto one
      if (u.onGround && !u.isPlayer && (u.stuckCheck = (u.stuckCheck || 0) + dt) > 1) {
        u.stuckCheck = 0;
        if (!W.reachable(u.pos)) { const p = W.nearestReachable(u.pos, 6); if (p.distanceTo(u.pos) < 4) u.pos.copy(p); }
      }
      // never lose a hero off the map: back to the last good spot
      if (!isNaN(ground) && u.onGround) (u.safe = u.safe || new T.Vector3()).copy(u.pos);
      else if (u.pos.y < (u.safe ? u.safe.y - 12 : -20)) { u.pos.copy(u.safe || this.map.spawn[u.team]); u.vel.set(0, 0, 0); u.onGround = true; }
    }

    objective(dt) {
      const p = this.map.point, R = this.map.pointR;
      const on = (team) => this.team(team).filter((u) => u.alive && Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < R && Math.abs(u.pos.y - p.y) < 2.5).length;
      const a = on(this.blue), d = on(this.red);
      if (a && d) this.pointState = 'CONTESTED';
      else if (a) { this.pointState = 'CAPTURING'; this.capture = Math.min(1, this.capture + dt / 11 * (a >= 2 ? 1.25 : 1)); }
      else this.pointState = this.capture > 0 ? 'ATTACK · ' + Math.floor(this.capture * 100) + '%' : 'ATTACK';
    }

    checkEnd() {
      const t = this.time;
      if (this.result) { if (t >= this.result.at) this.showResult(); return; }
      const nBlue = this.team(this.blue).filter((u) => u.alive).length, nRed = this.team(this.red).filter((u) => u.alive).length;
      const blueAlive = nBlue > 0, redAlive = nRed > 0;
      if ((nBlue <= 1 && nRed >= 3) || (nRed <= 1 && nBlue >= 3)) this.lopsided = this.lopsided || t; else this.lopsided = 0;
      let res = null;
      if (!redAlive) res = { won: true, why: 'Team kill. They\'re wiped and the point is yours.' };
      else if (this.capture >= 1) res = { won: true, why: 'Point A captured.' };
      else if (!blueAlive) res = { won: false, why: 'Your team was wiped.' };
      else if (nBlue <= 1 && nRed >= 3 && t - (this.lopsided || t) > 4) res = { won: false, why: 'Your team was picked apart. The last one standing falls back to spawn.' };
      else if (nRed <= 1 && nBlue >= 3 && t - (this.lopsided || t) > 4) res = { won: true, why: 'Their last hero ran. The point is yours.' };
      else if (t >= this.roundEnd) res = { won: false, why: 'Time ran out. They held the point.' };
      if (res) {
        res.at = t + 2.5;
        this.result = res;
        this.hud.center(res.won ? 'FIGHT WON' : 'FIGHT LOST', 2.4, res.won ? 'big win' : 'big lose');
        this.audio.play(res.won ? 'win' : 'lose');
        if (res.won) this.record.won++; else this.record.lost++;
      }
    }

    showResult() {
      this.state = 'result';
      this.carryUlt = this.playerUnit.ult;
      document.exitPointerLock && document.exitPointerLock();
      const r = this.result, p = this.playerUnit;
      $('res-kicker').textContent = `FIGHT ${this.fightNo} · ${this.scenario.name.toUpperCase()} · RECORD ${this.record.won}–${this.record.lost}`;
      $('res-title').textContent = r.won ? 'Fight won' : 'Fight lost';
      $('res-title').className = r.won ? 'win' : 'lose';
      const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      const log = this.log.filter((l) => l.kind !== 'info' || true).map((l) => `<li class="${l.kind}"><span>${fmt(l.t)}</span>${l.text}</li>`).join('');
      const notes = this.review();
      const st = p.stats;
      $('res-body').innerHTML = `<p class="why">${r.why}</p>
        <div class="res-grid">
          <div><h3>The fight</h3><ol class="log">${log || '<li>Nothing happened.</li>'}</ol></div>
          <div><h3>Your Reinhardt</h3>
            <table class="mine"><tr><td>Damage blocked</td><td>${Math.round(st.blocked)}</td></tr><tr><td>Damage dealt</td><td>${Math.round(st.dmg)}</td></tr>
            <tr><td>Eliminations</td><td>${st.kills}</td></tr><tr><td>Deaths</td><td>${st.deaths}</td></tr><tr><td>Shatter targets</td><td>${this.shatterHits || 0}</td></tr></table>
            <h3>Coach's notes</h3><ul class="notes">${notes.map((n) => `<li>${n}</li>`).join('')}</ul>
            <p class="carry">Earthshatter going into the next fight: <b>${p.ultPct()}%</b></p></div>
        </div>`;
      this.shatterHits = 0; this.shatterBlocked = false; this.result_bombBlocked = 0;
      $('result').classList.remove('hidden');
      this.hud.showScore(false);
    }

    review() {
      const p = this.playerUnit, notes = [], st = p.stats;
      const blueUlts = this.log.filter((l) => l.kind === 'ult').length, redUlts = this.log.filter((l) => l.kind === 'eult').length;
      if (this.shatterHits >= 3) notes.push(`Your Shatter hit ${this.shatterHits}. That's the fight-winner in GOATS.`);
      else if (this.shatterBlocked) notes.push('Your Shatter went into their shield. Wait for their Rein to drop it, turn, or swing.');
      else if (p.ultReady()) notes.push('You ended the fight holding Shatter. Using it after their saves were gone would have swung it.');
      if (this.result_bombBlocked) notes.push('You ate a bomb with your shield. Exactly right.');
      if (st.blocked < 1500 && st.deaths) notes.push('Low damage blocked. In poke, the shield is your job; drop it only on top of them.');
      if (st.blocked > 4000) notes.push(`${Math.round(st.blocked)} damage blocked. Strong shield discipline.`);
      if (redUlts > blueUlts + 1) notes.push('They used more ults than you. The side that runs out of ults first loses the next fight.');
      if (!notes.length) notes.push('Clean fight. Next one: watch their Zen and Lucio. Once Trans and Beat are gone, go.');
      return notes;
    }
  }

  G.Game = Game;
  const game = new Game();
  G.game = game;
  game.init();
})(window.G = window.G || {});

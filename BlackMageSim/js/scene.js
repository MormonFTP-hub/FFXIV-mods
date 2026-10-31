// Canvas scene: a dusk training ground, the striking dummy, the player's
// Black Mage and spell effects. A simple perspective camera rides behind
// the player looking at the dummy, the way the game's camera usually sits.
(function (B) {
  const A = B.ACTIONS;
  const ELEMENT_COLORS = {
    fire: ['255,140,50', '255,70,20', '255,230,150'],
    ice: ['140,210,255', '80,160,255', '235,250,255'],
    thunder: ['200,150,255', '255,240,120', '255,255,255'],
    none: ['230,170,255', '170,90,255', '255,240,255'],
    iai: ['255,225,150', '255,255,255', '255,150,110'],
    aether: ['120,255,200', '60,200,170', '230,255,245'],
    bahamut: ['150,120,255', '90,60,220', '230,220,255'],
    astral: ['150,190,255', '255,230,150', '255,255,255'],
  };
  // Summoner pets, drawn as glowing billboards: glow, wings, body, and the colour of what they throw.
  const PET_COLORS = {
    garuda: { glow: '110,255,160', wing: '80,210,130', body: '200,255,215', fx: ['150,255,190', '60,200,120'] },
    ifrit: { glow: '255,120,60', wing: '200,60,30', body: '255,210,160', fx: ['255,150,80', '220,60,20'] },
    titan: { glow: '230,190,110', wing: '150,110,60', body: '240,220,170', fx: ['240,210,140', '160,120,60'] },
    bahamut: { glow: '140,110,255', wing: '60,40,120', body: '200,190,255', fx: ['170,140,255', '80,50,220'] },
    rook: { glow: '120,180,255', wing: '90,100,120', body: '200,210,230', fx: ['160,210,255', '80,140,255'] },
    eos: { glow: '255,190,230', wing: '190,255,220', body: '255,240,250', fx: ['255,200,235', '200,255,220'] },
    selene: { glow: '150,200,255', wing: '200,230,255', body: '235,245,255', fx: ['170,210,255', '230,240,255'] },
  };
  const FAERIES = ['eos', 'selene'];

  function rng(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const norm = (a) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };

  class Scene {
    // canvas: sky, ground and anything behind the figures; fxCanvas: spell effects drawn over them.
    constructor(canvas, engine, fxCanvas) {
      this.c = canvas;
      this.bgCtx = canvas.getContext('2d');
      this.fxc = fxCanvas;
      this.fxCtx = fxCanvas.getContext('2d');
      this.ctx = this.bgCtx;
      this.models = null;
      this.e = engine;
      this.particles = [];
      this.fx = [];
      this.time = 0;
      this.camYaw = 0;
      this.camPitch = 0.33;      // radians above the horizon
      this.camZoom = 1;
      this.dragging = false;     // a mouse button is turning the camera
      this.mouselook = false;    // right button held: the character faces the way the camera looks
      this.shake = 0;
      this.dummyFlash = 0;
      this.dummyWobble = 0;
      this.release = 0;
      this.walkPhase = 0;
      this.sprites = {};
      this.buildDecor();
      this.buildStars();
      this.resize();
      this.updateCamera(0);
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.W = window.innerWidth; this.H = window.innerHeight;
      this.dpr = dpr;
      for (const [c, ctx] of [[this.c, this.bgCtx], [this.fxc, this.fxCtx]]) {
        c.width = Math.round(this.W * dpr); c.height = Math.round(this.H * dpr);
        c.style.width = this.W + 'px'; c.style.height = this.H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      if (this.models) this.models.resize(this.W, this.H, dpr);
      if (this.map) this.map.resize(this.W, this.H, dpr);
      if (this.cam) this.updateCamera(0);
    }

    buildDecor() {
      const r = rng(90);
      this.decor = [];
      for (let i = 0; i < 160; i++) {
        const a = r() * Math.PI * 2, d = 11 + r() * 40;
        this.decor.push({ kind: 'grass', x: Math.cos(a) * d, z: Math.sin(a) * d, h: 0.25 + r() * 0.35, hue: r() });
      }
      for (let i = 0; i < 14; i++) {
        const a = r() * Math.PI * 2, d = 14 + r() * 30;
        this.decor.push({ kind: 'rock', x: Math.cos(a) * d, z: Math.sin(a) * d, h: 0.4 + r() * 0.9, w: 0.6 + r() * 1.2, seed: r() });
      }
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2 + 0.2;
        this.decor.push({ kind: 'lantern', x: Math.cos(a) * 11.5, z: Math.sin(a) * 11.5 });
      }
    }

    buildStars() {
      const r = rng(7);
      this.stars = [];
      for (let i = 0; i < 140; i++) this.stars.push({ u: r(), v: r() * 0.8, s: r() * 1.4 + 0.3, tw: r() * 6 });
    }

    // ---------- camera ----------
    // Like the game's camera: it orbits your character, turned by dragging with either mouse button, tilted by
    // dragging up and down, and zoomed with the wheel. It stays where you put it unless "Camera follows the
    // dummy" is on in Settings, which swings it round behind you toward the dummy.
    updateCamera(dt) {
      const p = this.e.pos;
      const d = Math.hypot(p.x, p.z);
      if (this.e.settings.cameraFollow && !this.dragging && d > 2.2) {
        const want = Math.atan2(-p.x, -p.z);
        let diff = want - this.camYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.camYaw += diff * Math.min(1, dt * 6);
      }
      const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
      const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
      // The game's models are life-size (about 1.9 tall with the hat), so the camera sits closer to them,
      // about where the game's own default zoom puts it. It aims a little above the head, which keeps you in
      // the lower half of the screen with the dummy ahead.
      const m = this.modelsOn();
      const dist = (m ? 8 : 12.5) * this.camZoom, pivotY = (m ? 1.6 : 2.0) + this.jumpY() * 0.3, lift = m ? 0.55 : 0.8;
      const ch = Math.cos(this.camPitch), sh = Math.sin(this.camPitch);
      const py = p.y || 0;      // the floor you stand on (the game's map)
      const cam = { x: p.x - fx * dist * ch + sx, y: py + Math.max(0.35, pivotY + dist * sh) + sy, z: p.z - fz * dist * ch };
      const look = { x: p.x, y: py + pivotY + lift, z: p.z };
      // Right-handed like three.js and the game, so the 2D scene and the 3D models line up.
      const f = norm(sub(look, cam));
      const r = norm(cross(f, { x: 0, y: 1, z: 0 }));
      const u = cross(r, f);
      this.cam = { pos: cam, look, f, r, u };
      this.F = this.H * 0.95;
    }

    // Mouse drags (pixels) turn and tilt the camera; the wheel zooms.
    turnCamera(dx, dy) {
      const k = 0.0042 * (this.e.settings.mouseSpeed || 1);
      this.camYaw -= dx * k;      // drag right, look right
      this.camPitch = Math.max(-0.2, Math.min(1.35, this.camPitch + dy * k * 0.8));
    }
    zoomCamera(delta) {
      this.camZoom = Math.max(0.35, Math.min(2, this.camZoom * Math.pow(1.1, Math.sign(delta) * Math.min(3, Math.abs(delta) / 100))));
    }
    // Behind you, looking at the dummy, at the default tilt and zoom.
    resetCamera() {
      const p = this.e.pos;
      this.camYaw = Math.atan2(-p.x, -p.z);
      this.camPitch = 0.33;
      this.camZoom = 1;
      this.updateCamera(0);
    }

    // Movement keys are relative to the camera, like standard controls.
    moveBasis() {
      const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
      return { fx, fz, rx: -fz, rz: fx };
    }

    modelsOn() { return !!(this.models && this.models.active()); }
    mapOn() { return !!(this.map && this.map.active()); }
    fightOn() { return !!(this.app && this.app.fight && this.mapOn()); }

    toCam(x, y, z) {
      const d = { x: x - this.cam.pos.x, y: y - this.cam.pos.y, z: z - this.cam.pos.z };
      return { x: dot(d, this.cam.r), y: dot(d, this.cam.u), z: dot(d, this.cam.f) };
    }
    fromCam(c) { return { x: this.W / 2 + c.x * this.F / c.z, y: this.H / 2 - c.y * this.F / c.z, s: this.F / c.z, z: c.z }; }
    project(x, y, z) {
      const c = this.toCam(x, y, z);
      if (c.z < 0.3) return null;
      return this.fromCam(c);
    }

    clipPoly(pts, near) {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const ain = a.z >= near, bin = b.z >= near;
        if (ain) out.push(a);
        if (ain !== bin) {
          const t = (near - a.z) / (b.z - a.z);
          out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: near });
        }
      }
      return out;
    }

    groundPath(cx, cz, radius, n, y) {
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2;
        pts.push(this.toCam(cx + Math.cos(a) * radius, y || 0, cz + Math.sin(a) * radius));
      }
      const clipped = this.clipPoly(pts, 0.3);
      if (clipped.length < 3) return false;
      const ctx = this.ctx;
      ctx.beginPath();
      clipped.forEach((c, i) => { const p = this.fromCam(c); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
      ctx.closePath();
      return true;
    }

    // ---------- particles ----------
    sprite(rgb) {
      if (this.sprites[rgb]) return this.sprites[rgb];
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, `rgba(${rgb},1)`);
      grd.addColorStop(0.35, `rgba(${rgb},0.6)`);
      grd.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
      return (this.sprites[rgb] = c);
    }

    emit(n, o) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
        const sp = (o.speed || 2) * (0.4 + Math.random() * 0.8);
        this.particles.push({
          x: o.x + (Math.random() - 0.5) * (o.spread || 0),
          y: o.y + (Math.random() - 0.5) * (o.spreadY || o.spread || 0),
          z: o.z + (Math.random() - 0.5) * (o.spread || 0),
          vx: Math.cos(a) * Math.cos(b) * sp + (o.vx || 0),
          vy: Math.sin(b) * sp * (o.flatY || 1) + (o.vy || 0),
          vz: Math.sin(a) * Math.cos(b) * sp + (o.vz || 0),
          life: (o.life || 0.8) * (0.6 + Math.random() * 0.6),
          age: 0,
          size: (o.size || 0.3) * (0.6 + Math.random() * 0.8),
          color: o.colors[Math.floor(Math.random() * o.colors.length)],
          grav: o.grav || 0,
          drag: o.drag || 0,
        });
      }
    }

    addFx(f) { f.t0 = this.time; this.fx.push(f); }

    // ---------- effect hooks ----------
    onCastStart(id) { this.castId = id; }

    onRelease(id) {
      this.release = 0.45;
      const a = A[id];
      if (!a) return;
      if (!B.isCaster(this.e.job)) { this.onMeleeRelease(id, a); return; }
      const school = a.school && ELEMENT_COLORS[a.school] ? a.school : 'none';
      const p = this.e.pos;
      const tip = this.staffTip();
      const col = ELEMENT_COLORS[school];
      if (a.kind === 'gcd') {
        this.emit(14, { x: tip.x, y: tip.y, z: tip.z, speed: 2.5, life: 0.4, size: 0.25, colors: col });
        if (a.orb || ['xenoglossy', 'foul', 'scathe', 'paradox'].includes(id)) {
          this.addFx({ type: 'orb', from: tip, dur: a.delay * 0.9, color: col, size: id === 'xenoglossy' ? 0.55 : 0.4 });
        }
      } else {
        const colors = {
          sharpcast: ['240,170,255', '255,255,255'], triplecast: ['255,120,80', '100,180,255', '255,230,90'],
          swiftcast: ['150,255,200', '255,255,255'], manafont: ['90,170,255', '200,240,255'],
          amplifier: ['200,120,255', '255,220,255'], lucidDreaming: ['140,150,255', '255,250,200'],
          tincture: ['255,120,190', '255,220,240'], manaward: ['170,140,255', '255,255,255'],
          surecast: ['220,190,255'], sprint: ['255,220,120'], transpose: ['255,90,60', '80,160,255'],
          addle: ['230,180,120'], leyLines: ['200,140,255', '255,230,255'], betweenTheLines: ['200,140,255'],
        }[id] || ['230,200,255'];
        if (id === 'manafont') {
          this.emit(50, { x: p.x, y: 0.2, z: p.z, spread: 1.2, spreadY: 0.1, speed: 0.6, vy: 4.5, life: 0.9, size: 0.25, colors, grav: -1 });
        } else if (id === 'addle') {
          this.emit(20, { x: 0, y: 2.2, z: 0, spread: 0.8, speed: 0.6, vy: -1.5, life: 0.8, size: 0.3, colors });
        } else {
          this.emit(26, { x: p.x, y: 1.0, z: p.z, spread: 0.6, speed: 2.2, flatY: 0.3, vy: 1.5, life: 0.7, size: 0.22, colors });
          this.addFx({ type: 'ring', x: p.x, z: p.z, r0: 0.4, r1: 2.0, dur: 0.5, color: colors[0] });
        }
      }
    }

    // Melee abilities flare at the player; weaponskills draw at the dummy when they land (onHit).
    onMeleeRelease(id, a) {
      const p = this.e.pos;
      if (a.kind === 'gcd') {
        if (a.school === 'iai') this.emit(18, { x: p.x, y: 1.1, z: p.z, spread: 0.5, speed: 2.5, flatY: 0.4, life: 0.4, size: 0.2, colors: ELEMENT_COLORS.iai });
        if (id === 'meditate') {
          this.emit(30, { x: p.x, y: 0.3, z: p.z, spread: 1.2, spreadY: 0.1, speed: 0.4, vy: 1.6, life: 1.2, size: 0.2, colors: ['255,220,140', '255,250,220'] });
          this.addFx({ type: 'ring', x: p.x, z: p.z, r0: 1.6, r1: 0.4, dur: 0.8, color: '255,210,120' });
        }
        return;
      }
      if (a.potency) return;
      const colors = {
        kaiten: ['255,80,50', '255,200,110', '255,255,230'], ikishoten: ['255,200,90', '255,110,60', '255,255,220'],
        meikyoShisui: ['150,200,255', '255,255,255', '200,230,255'], hagakure: ['200,230,255', '255,255,255'],
        thirdEye: ['255,255,255', '200,220,255'], trueNorth: ['150,255,200', '255,255,255'], bloodbath: ['220,40,60', '255,120,120'],
        feint: ['230,180,120'], secondWind: ['150,255,170', '255,255,255'], armsLength: ['200,200,255'], legSweep: ['255,230,150'],
        tincture: ['255,120,190', '255,220,240'], sprint: ['255,220,120'],
        noMercy: ['120,170,255', '255,255,255', '170,150,255'], bloodfest: ['220,40,60', '255,120,90', '255,220,150'],
        royalGuard: ['150,190,255', '255,255,255'], camouflage: ['170,190,220'], nebula: ['130,110,255', '200,190,255'],
        aurora: ['120,255,200', '200,255,240'], superbolide: ['255,240,180', '255,255,255', '255,200,120'],
        heartOfLight: ['255,240,200', '255,255,255'], heartOfCorundum: ['170,200,255', '255,255,255'],
        rampart: ['220,200,150', '255,255,255'], reprisal: ['230,180,120'], lowBlow: ['255,230,150'], interject: ['255,230,150'],
        provoke: ['255,120,80'], shirk: ['200,200,220'],
      }[id] || ['255,220,180'];
      if (id === 'bloodfest') {
        this.emit(40, { x: 0, y: 1.3, z: 0, spread: 0.6, speed: 0.8, life: 0.9, size: 0.3, colors });
        this.addFx({ type: 'ring', x: p.x, z: p.z, r0: 2.2, r1: 0.4, dur: 0.6, color: colors[0] });
        return;
      }
      if (id === 'ikishoten' || id === 'kaiten' || id === 'noMercy' || id === 'superbolide') {
        this.emit(id === 'ikishoten' ? 60 : 34, { x: p.x, y: 0.2, z: p.z, spread: 1.0, spreadY: 0.1, speed: 0.6, vy: id === 'ikishoten' ? 5 : 3.5, life: 0.8, size: 0.24, colors, grav: -1 });
        this.addFx({ type: 'ring', x: p.x, z: p.z, r0: 0.4, r1: id === 'ikishoten' ? 3 : 2, dur: 0.5, color: colors[0] });
      } else if (id === 'feint' || id === 'legSweep' || id === 'reprisal' || id === 'lowBlow' || id === 'interject' || id === 'provoke') {
        this.emit(20, { x: 0, y: 1.8, z: 0, spread: 0.8, speed: 0.6, vy: -1.5, life: 0.8, size: 0.3, colors });
      } else {
        this.emit(26, { x: p.x, y: 1.0, z: p.z, spread: 0.6, speed: 2.2, flatY: 0.3, vy: 1.5, life: 0.7, size: 0.22, colors });
        this.addFx({ type: 'ring', x: p.x, z: p.z, r0: 0.4, r1: 2.0, dur: 0.5, color: colors[0] });
      }
    }

    onTeleport(from, to) {
      const colors = B.isCaster(this.e.job) ? ['200,140,255', '255,255,255'] : ['255,230,180', '255,255,255'];
      this.emit(30, { x: from.x, y: 1, z: from.z, spread: 0.8, speed: 2, vy: 1, life: 0.6, size: 0.25, colors });
      this.emit(30, { x: to.x, y: 1, z: to.z, spread: 0.8, speed: 2, vy: 1, life: 0.6, size: 0.25, colors });
    }

    // A hit on one of the extra dummies: a smaller burst over it.
    onExtraHit(ev) {
      const d = B.EXTRA_DUMMIES[ev.extra - 1];
      if (!d) return;
      const colors = ev.dot ? ['255,240,120', '220,180,255'] : (ELEMENT_COLORS[A[ev.id] && A[ev.id].school] || ['255,230,190', '255,255,255']);
      this.emit(ev.dot ? 5 : 14, { x: d.x, y: 1.3, z: d.z, spread: 0.5, speed: ev.dot ? 1.5 : 2.6, life: 0.4, size: 0.2, colors });
    }

    onHit(ev) {
      // New spells borrow an older one's look (Fire II looks like Fire III, Freeze like Blizzard IV).
      const id = (A[ev.id] && A[ev.id].look) || ev.id;
      const big = ev.crit ? 1.25 : 1;
      this.dummyFlash = 0.18;
      this.dummyWobble = Math.min(1, this.dummyWobble + (ev.dot ? 0.15 : 0.6));
      const T = { x: 0, y: 1.3, z: 0 };
      const fx = A[id] && A[id].fx;
      if (ev.dot) {
        const colors = fx === 'higanbana' ? ['255,60,60', '255,170,150'] : fx && fx.startsWith('gnb') ? ['110,170,255', '220,235,255'] : ['255,240,120', '220,180,255'];
        this.emit(8, { x: T.x, y: T.y, z: T.z, spread: 0.6, speed: 2, life: 0.3, size: 0.15, colors });
        return;
      }
      if (fx) { this.weaponHit(fx, ev, big); return; }
      switch (id) {
        case 'fire': case 'fire3': case 'fire4': {
          const k = id === 'fire' ? 1 : id === 'fire3' ? 1.4 : 1.7;
          this.emit(Math.round(40 * k * big), { ...T, spread: 0.5, speed: 3.2 * k, life: 0.7, size: 0.45 * k, colors: ELEMENT_COLORS.fire, grav: -2, drag: 2 });
          this.emit(Math.round(18 * k), { ...T, spread: 0.6, speed: 1, vy: 2.5, life: 1.3, size: 0.5 * k, colors: ['90,40,30', '60,30,30'], grav: -0.6, drag: 1 });
          this.addFx({ type: 'flash', ...T, r: 1.6 * k, dur: 0.3, color: '255,190,90' });
          if (id === 'fire4') this.addFx({ type: 'pillar', x: 0, z: 0, h: 4.5, w: 1.3, dur: 0.6, color: '255,110,40' });
          if (id === 'fire3') this.addFx({ type: 'ring', x: 0, z: 0, r0: 0.5, r1: 3.5, dur: 0.5, color: '255,150,60' });
          this.shake = Math.max(this.shake, id === 'fire4' ? 0.08 : 0.04);
          break;
        }
        case 'despair':
          this.emit(Math.round(120 * big), { ...T, spread: 0.8, speed: 5, life: 0.9, size: 0.6, colors: ['200,20,40', '255,60,40', '255,180,120', '120,0,30'], grav: -2.5, drag: 1.8 });
          this.emit(40, { ...T, spread: 1, speed: 1.2, vy: 3, life: 1.6, size: 0.7, colors: ['40,0,10', '70,10,20'], grav: -0.5, drag: 1 });
          this.addFx({ type: 'pillar', x: 0, z: 0, h: 9, w: 2.2, dur: 0.9, color: '230,30,50' });
          this.addFx({ type: 'flash', ...T, r: 3.2, dur: 0.45, color: '255,80,80' });
          this.addFx({ type: 'ring', x: 0, z: 0, r0: 0.5, r1: 5, dur: 0.6, color: '255,60,60' });
          this.shake = 0.16;
          break;
        case 'blizzard': case 'blizzard3': case 'blizzard4': {
          const k = id === 'blizzard' ? 1 : id === 'blizzard3' ? 1.4 : 1.6;
          this.emit(Math.round(36 * k * big), { ...T, spread: 0.5, speed: 3.5 * k, life: 0.7, size: 0.3 * k, colors: ELEMENT_COLORS.ice, grav: 4, drag: 1.5 });
          this.addFx({ type: 'spikes', n: id === 'blizzard' ? 3 : id === 'blizzard3' ? 6 : 9, h: 1.6 * k, dur: 0.9, seed: Math.random() });
          this.addFx({ type: 'flash', ...T, r: 1.5 * k, dur: 0.3, color: '200,240,255' });
          this.shake = Math.max(this.shake, 0.04);
          break;
        }
        case 'thunder3':
          this.addFx({ type: 'bolt', dur: 0.35, seed: Math.random() });
          this.addFx({ type: 'flash', ...T, r: 2.5, dur: 0.25, color: '255,250,200' });
          this.emit(30, { ...T, spread: 0.4, speed: 4, life: 0.5, size: 0.2, colors: ELEMENT_COLORS.thunder });
          this.shake = Math.max(this.shake, 0.06);
          this.screenFlash = 0.12;
          break;
        case 'xenoglossy':
          this.emit(Math.round(80 * big), { ...T, spread: 0.6, speed: 4, life: 0.9, size: 0.5, colors: ['170,60,255', '230,170,255', '80,0,160', '255,255,255'], drag: 2 });
          this.addFx({ type: 'flash', ...T, r: 3, dur: 0.45, color: '190,110,255' });
          this.addFx({ type: 'ring', x: 0, z: 0, r0: 0.6, r1: 4.5, dur: 0.6, color: '200,130,255' });
          this.addFx({ type: 'runes', x: 0, z: 0, r: 2.4, dur: 0.9, color: '210,150,255' });
          this.shake = 0.12;
          break;
        case 'foul':
          this.emit(70, { ...T, spread: 1.2, speed: 2.5, life: 1.1, size: 0.55, colors: ['120,40,200', '60,10,110', '200,140,255'], grav: -0.5, drag: 1.5 });
          this.addFx({ type: 'flash', ...T, r: 2.8, dur: 0.5, color: '150,70,230' });
          this.shake = 0.08;
          break;
        case 'paradox':
          this.emit(60, { ...T, spread: 0.5, speed: 3.5, life: 0.8, size: 0.35, colors: ['255,120,120', '120,190,255', '255,255,255', '255,190,240'], drag: 2 });
          this.addFx({ type: 'flash', ...T, r: 2.2, dur: 0.4, color: '255,210,245' });
          this.addFx({ type: 'runes', x: 0, z: 0, r: 1.8, dur: 0.7, color: '255,200,240' });
          break;
        case 'scathe':
          this.emit(24, { ...T, spread: 0.4, speed: 2.5, life: 0.5, size: 0.3, colors: ['160,120,220', '60,30,90'] });
          break;
        default: {
          // Anything else (a Summoner's spells, a pet's attacks): a burst in its element's colour, bigger for the
          // big ones (a.big: Deathflare, Akh Morn, Enkindle).
          const a = A[id];
          if (!a) break;
          const cols = ELEMENT_COLORS[a.school] || ELEMENT_COLORS.none;
          const k = a.big ? 1.8 : 1;
          this.emit(Math.round(28 * k * big), { ...T, spread: 0.5, speed: 3 * k, life: 0.6, size: 0.35 * k, colors: cols, drag: 2 });
          this.addFx({ type: 'flash', ...T, r: 1.6 * k, dur: 0.3, color: cols[0] });
          if (a.big) { this.addFx({ type: 'pillar', x: 0, z: 0, h: 7, w: 2, dur: 0.8, color: cols[0] }); this.shake = Math.max(this.shake, 0.12); }
        }
      }
    }

    // Sword arcs and the rest of a melee hit. Each slash is an arc in front of the dummy (drawSlash).
    weaponHit(fx, ev, big) {
      const T = { x: 0, y: 1.3, z: 0 };
      const S = (o) => {
        const f = Object.assign({ type: 'slash', r: 1.3, y: 1.3, w: 0.3, dur: 0.42, color: '220,235,255', tilt: 0, a0: 2.7, a1: -0.5 }, o);
        this.addFx(f);
        if (o.delay) f.t0 += o.delay;
      };
      const sparks = (n, colors, o) => this.emit(Math.round(n * big), Object.assign({ ...T, spread: 0.4, speed: 3.5, life: 0.45, size: 0.18, colors, drag: 2.5 }, o));
      const flash = (r, color) => this.addFx({ type: 'flash', ...T, r, dur: 0.3, color });
      const petals = (n, colors) => this.emit(n, { ...T, spread: 1.2, speed: 1.6, vy: 1.5, life: 1.6, size: 0.16, colors, grav: 1.2, drag: 1.2 });
      switch (fx) {
        case 'auto':
          S({ r: 1.0, w: 0.12, dur: 0.26, color: '190,200,220', tilt: (Math.random() - 0.5) * 1.4 });
          sparks(5, ['255,240,210']);
          break;
        case 'slash':
          S({ tilt: -0.45 });
          sparks(14, ['255,255,255', '200,220,255']);
          this.shake = Math.max(this.shake, 0.03);
          break;
        case 'slash2':
          S({ tilt: 0.5, a0: -0.5, a1: 2.7 });
          S({ tilt: -0.35, delay: 0.09 });
          sparks(18, ['255,255,255', '200,220,255']);
          this.shake = Math.max(this.shake, 0.035);
          break;
        case 'slash3':   // Gekko: the moon
          S({ tilt: 0.7, r: 1.5, w: 0.42, color: '170,165,255' });
          S({ tilt: -0.6, r: 1.2, delay: 0.1, color: '220,220,255' });
          flash(1.8, '190,190,255');
          sparks(24, ['200,200,255', '255,255,255', '140,130,255']);
          this.shake = Math.max(this.shake, 0.05);
          break;
        case 'slashFire':   // Kasha: the flower, in flame
          S({ tilt: -0.7, r: 1.5, w: 0.42, color: '255,120,70' });
          S({ tilt: 0.5, r: 1.2, delay: 0.1, color: '255,200,140' });
          flash(1.8, '255,150,90');
          sparks(26, ELEMENT_COLORS.fire, { grav: -2, speed: 3 });
          this.shake = Math.max(this.shake, 0.05);
          break;
        case 'slashIce':   // Yukikaze: the snow
          S({ tilt: 0.1, r: 1.45, w: 0.4, color: '150,215,255' });
          flash(1.6, '200,240,255');
          sparks(30, ELEMENT_COLORS.ice, { grav: 2.5, speed: 2.8, life: 0.8 });
          this.shake = Math.max(this.shake, 0.04);
          break;
        case 'enpi':
          S({ tilt: 1.3, r: 0.9, w: 0.22, dur: 0.3, color: '255,220,170' });
          flash(1.2, '255,210,150');
          sparks(14, ['255,230,180', '255,255,255']);
          break;
        case 'higanbana':
          S({ tilt: -0.2, r: 1.6, w: 0.45, color: '255,60,60' });
          flash(2, '255,70,70');
          petals(36, ['255,40,50', '230,20,40', '255,150,150']);
          this.addFx({ type: 'ring', x: 0, z: 0, r0: 0.5, r1: 3, dur: 0.6, color: '255,70,70' });
          this.shake = Math.max(this.shake, 0.06);
          break;
        case 'tenka':
          for (let i = 0; i < 4; i++) S({ tilt: -0.9 + i * 0.6, r: 1.4 + i * 0.1, w: 0.32, delay: i * 0.05, color: i % 2 ? '255,220,140' : '255,245,220' });
          flash(2.2, '255,220,140');
          sparks(40, ['255,220,140', '255,255,255', '255,180,90']);
          this.shake = Math.max(this.shake, 0.07);
          break;
        case 'midare': {
          const k = ev.id === 'kaeshiSetsugekka' ? 1.2 : 1;
          S({ tilt: -0.6, r: 1.7 * k, w: 0.5, color: '140,200,255' });
          S({ tilt: 0.65, r: 1.6 * k, w: 0.5, delay: 0.07, color: '180,150,255' });
          S({ tilt: 0.02, r: 1.9 * k, w: 0.6, delay: 0.14, color: '255,110,90', a0: 3.0, a1: -0.8 });
          flash(3 * k, '255,240,230');
          petals(30, ['255,90,90', '255,220,230']);
          sparks(Math.round(50 * k), ['150,210,255', '255,255,255', '200,170,255'], { speed: 5 });
          this.addFx({ type: 'ring', x: 0, z: 0, r0: 0.6, r1: 4.5 * k, dur: 0.6, color: '255,230,220' });
          this.shake = 0.13 * k;
          if (k > 1) this.screenFlash = 0.1;
          break;
        }
        case 'ogi': {
          const k = ev.id === 'kaeshiNamikiri' ? 1.25 : 1;
          S({ tilt: 0.04, r: 2.6 * k, w: 0.75, dur: 0.55, color: '150,190,255', a0: 3.3, a1: -0.2 });
          S({ tilt: -0.08, r: 2.2 * k, w: 0.4, dur: 0.5, delay: 0.06, color: '255,255,255', a0: 3.2, a1: -0.1 });
          if (k > 1) S({ tilt: 0.12, r: 2.9, w: 0.5, dur: 0.6, delay: 0.12, color: '120,160,255', a0: -0.2, a1: 3.3 });
          flash(3.4 * k, '170,200,255');
          sparks(Math.round(70 * k), ['160,200,255', '255,255,255', '90,140,255'], { speed: 6, spread: 1 });
          this.addFx({ type: 'ring', x: 0, z: 0, r0: 0.6, r1: 5.5 * k, dur: 0.7, color: '150,190,255' });
          this.shake = 0.15 * k;
          this.screenFlash = 0.08 * k;
          break;
        }
        case 'shinten':
          S({ tilt: 0.9, r: 1.2, w: 0.26, dur: 0.3, color: '255,210,120' });
          sparks(16, ['255,220,140', '255,255,255']);
          this.shake = Math.max(this.shake, 0.035);
          break;
        case 'senei':
          S({ tilt: 0.85, r: 1.8, w: 0.55, color: '255,90,60' });
          S({ tilt: -0.85, r: 1.8, w: 0.55, delay: 0.1, color: '255,200,110' });
          flash(2.8, '255,140,80');
          sparks(60, ['255,90,60', '255,210,120', '255,255,255'], { speed: 5 });
          this.shake = 0.12;
          break;
        // Gunbreaker: blue-white gunblade arcs, and a powder blast whenever a cartridge goes off.
        case 'gnbSlash':
          S({ tilt: -0.4, color: '170,205,255' });
          sparks(12, ['200,225,255', '255,255,255']);
          this.shake = Math.max(this.shake, 0.03);
          break;
        case 'gnbSlash2':
          S({ tilt: 0.5, a0: -0.5, a1: 2.7, color: '150,190,255' });
          sparks(14, ['200,225,255', '255,255,255']);
          this.shake = Math.max(this.shake, 0.035);
          break;
        case 'gnbBarrel':
          S({ tilt: 0.05, r: 1.5, w: 0.45, color: '120,170,255' });
          flash(1.6, '150,190,255');
          sparks(20, ['160,200,255', '255,255,255', '255,220,140']);
          this.shake = Math.max(this.shake, 0.05);
          break;
        case 'gnbShot':
          flash(1.2, '150,200,255');
          sparks(18, ['150,200,255', '255,255,255'], { speed: 4.5 });
          break;
        case 'gnbBurst':
          S({ tilt: -0.2, r: 1.6, w: 0.5, color: '255,200,110' });
          this.addFx({ type: 'flash', ...T, r: 2.4, dur: 0.35, color: '255,190,90' });
          sparks(40, ['255,210,120', '255,140,60', '255,255,255'], { speed: 5, grav: -1 });
          this.emit(16, { ...T, spread: 0.6, speed: 1, vy: 2, life: 1.2, size: 0.5, colors: ['70,60,70', '50,45,55'], grav: -0.6, drag: 1 });
          this.shake = Math.max(this.shake, 0.08);
          break;
        case 'gnbFang': case 'gnbFang2': case 'gnbFang3': {
          const k = fx === 'gnbFang' ? 1 : fx === 'gnbFang2' ? 1.1 : 1.25;
          S({ tilt: 0.8, r: 1.4 * k, w: 0.32, color: '140,120,255' });
          S({ tilt: 0.55, r: 1.25 * k, w: 0.28, delay: 0.05, color: '190,170,255' });
          S({ tilt: 0.3, r: 1.1 * k, w: 0.24, delay: 0.1, color: '120,170,255' });
          flash(1.8 * k, '170,150,255');
          sparks(Math.round(30 * k), ['170,150,255', '255,255,255', '120,170,255'], { speed: 4.5 });
          this.shake = Math.max(this.shake, 0.06 * k);
          break;
        }
        case 'gnbSonic':
          S({ tilt: 0.02, r: 1.8, w: 0.6, color: '120,180,255', a0: 3.0, a1: -0.6 });
          flash(2.2, '150,200,255');
          this.addFx({ type: 'ring', x: 0, z: 0, r0: 0.5, r1: 4, dur: 0.6, color: '140,190,255' });
          sparks(40, ['140,190,255', '255,255,255'], { speed: 5, flatY: 0.3 });
          this.shake = Math.max(this.shake, 0.07);
          break;
        case 'gnbDouble':
          S({ tilt: 0.6, r: 2.0, w: 0.6, color: '255,190,90' });
          S({ tilt: -0.6, r: 2.0, w: 0.6, delay: 0.12, color: '120,170,255' });
          this.addFx({ type: 'flash', ...T, r: 3.4, dur: 0.45, color: '255,210,150' });
          this.addFx({ type: 'ring', x: 0, z: 0, r0: 0.6, r1: 6, dur: 0.7, color: '255,200,120' });
          this.addFx({ type: 'pillar', x: 0, z: 0, h: 6, w: 1.8, dur: 0.6, color: '255,170,80' });
          sparks(80, ['255,210,120', '255,140,60', '255,255,255', '140,190,255'], { speed: 6, spread: 1 });
          this.emit(24, { ...T, spread: 1, speed: 1.2, vy: 2.5, life: 1.4, size: 0.6, colors: ['70,60,70', '50,45,55'], grav: -0.5, drag: 1 });
          this.shake = 0.16;
          this.screenFlash = 0.08;
          break;
        case 'gnbCont':
          flash(1.1, '255,210,140');
          sparks(16, ['255,220,150', '255,255,255', '140,190,255'], { speed: 4 });
          this.shake = Math.max(this.shake, 0.03);
          break;
        case 'gnbZone':
          S({ tilt: 0.9, r: 1.7, w: 0.5, color: '120,170,255' });
          S({ tilt: -0.9, r: 1.7, w: 0.5, delay: 0.08, color: '170,150,255' });
          this.addFx({ type: 'pillar', x: 0, z: 0, h: 5, w: 1.4, dur: 0.5, color: '130,170,255' });
          flash(2.6, '160,190,255');
          sparks(50, ['140,180,255', '255,255,255', '180,160,255'], { speed: 5 });
          this.shake = 0.11;
          break;
        case 'gnbBow': {
          const p = this.e.pos;
          this.addFx({ type: 'ring', x: p.x, z: p.z, r0: 0.5, r1: 5, dur: 0.6, color: '150,190,255' });
          this.addFx({ type: 'ring', x: p.x, z: p.z, r0: 0.3, r1: 3.5, dur: 0.5, color: '255,220,160' });
          flash(1.8, '150,190,255');
          sparks(30, ['150,190,255', '255,255,255'], { speed: 4 });
          this.shake = Math.max(this.shake, 0.07);
          break;
        }
        case 'shoha':
          S({ tilt: 0.3, r: 1.5, w: 0.4, color: '255,220,120' });
          S({ tilt: -0.5, r: 1.4, w: 0.4, delay: 0.08, color: '140,180,255' });
          this.addFx({ type: 'flash', ...T, r: 2.6, dur: 0.45, color: '170,190,255' });
          sparks(50, ['140,180,255', '255,220,120', '255,255,255'], { speed: 4.5 });
          this.addFx({ type: 'ring', x: 0, z: 0, r0: 0.5, r1: 4, dur: 0.6, color: '170,190,255' });
          this.shake = 0.09;
          break;
      }
    }

    staffTip() {
      if (this.modelsOn()) return this.models.staffTip();
      const p = this.e.pos;
      const b = this.moveBasis();
      const up = this.e.casting || this.release > 0 ? 2.35 : 1.9;
      return { x: p.x + b.rx * 0.55 + b.fx * 0.15, y: (p.y || 0) + up + this.jumpY(), z: p.z + b.rz * 0.55 + b.fz * 0.15 };
    }

    jumpY() {
      const left = this.e.jumpUntil - this.e.now;
      if (left <= 0) return 0;
      const k = 1 - left / 0.75;
      return Math.sin(k * Math.PI) * 0.9;
    }

    // ---------- update ----------
    update(dt, moving) {
      this.time += dt;
      this.updateCamera(dt);
      this.shake = Math.max(0, this.shake - dt * 0.6);
      this.dummyFlash = Math.max(0, this.dummyFlash - dt);
      this.dummyWobble = Math.max(0, this.dummyWobble - dt * 1.6);
      this.release = Math.max(0, this.release - dt);
      this.screenFlash = Math.max(0, (this.screenFlash || 0) - dt);
      if (moving) this.walkPhase += dt * 9;

      const e = this.e;
      // A summoner's pet keeps a step behind and to the side; Demi-Bahamut hovers higher, further back.
      if (e.pet) {
        const d = Math.hypot(e.pos.x, e.pos.z) || 1, fx = -e.pos.x / d, fz = -e.pos.z / d;
        const big = e.pet.kind === 'bahamut';
        // Ifrit-Egi fights in melee, at the dummy's side facing you.
        const melee = e.pet.kind === 'ifrit';
        const tx = melee ? fx * -1.9 + fz * 1.2 : e.pos.x - fx * (big ? 2.4 : 1.0) + fz * (big ? 0 : 1.5);
        const tz = melee ? fz * -1.9 - fx * 1.2 : e.pos.z - fz * (big ? 2.4 : 1.0) - fx * (big ? 0 : 1.5);
        if (!this.petPos || this.petKind !== e.pet.kind) {
          this.petPos = { x: tx, z: tz }; this.petKind = e.pet.kind;
          const col = PET_COLORS[this.petKind] || PET_COLORS.garuda;
          this.emit(big ? 80 : 40, { x: tx, y: big ? 2.6 : 1, z: tz, spread: big ? 2 : 1, speed: 2, life: 0.9, size: 0.3, colors: [col.glow, col.body] });
          this.addFx({ type: 'ring', x: tx, z: tz, r0: 0.3, r1: big ? 4 : 2, dur: 0.6, color: col.glow });
        }
        const k = Math.min(1, dt * 3);
        this.petPos.x += (tx - this.petPos.x) * k; this.petPos.z += (tz - this.petPos.z) * k;
        if (Math.random() < dt * 12) {
          const col = PET_COLORS[this.petKind] || PET_COLORS.garuda;
          this.particles.push({ x: this.petPos.x + (Math.random() - 0.5), y: (big ? 2.4 : 0.8) + Math.random(), z: this.petPos.z + (Math.random() - 0.5),
            vx: 0, vy: -0.3, vz: 0, life: 0.6, age: 0, size: 0.12, color: col.glow, grav: 0, drag: 0 });
        }
      } else { this.petPos = null; this.petKind = null; }
      // Casting: motes drift up into the staff.
      if (e.casting) {
        const a = A[e.casting.id];
        const col = ELEMENT_COLORS[a.school] || ELEMENT_COLORS.none;
        if (Math.random() < dt * 40) {
          const ang = Math.random() * Math.PI * 2;
          this.particles.push({ x: e.pos.x + Math.cos(ang) * 1.2, y: (e.pos.y || 0) + 0.1, z: e.pos.z + Math.sin(ang) * 1.2, vx: -Math.cos(ang) * 0.8, vy: 2.2, vz: -Math.sin(ang) * 0.8, life: 0.7, age: 0, size: 0.16, color: col[0], grav: 0, drag: 0 });
        }
      }
      // Astral Fire embers or Umbral Ice snow around the mage.
      const aura = e.job.aura ? e.job.aura(e) : 0;
      if (aura !== 0 && Math.random() < dt * 6 * Math.abs(aura)) {
        const fire = aura > 0;
        this.particles.push({
          x: e.pos.x + (Math.random() - 0.5) * 1.2, y: (e.pos.y || 0) + (fire ? 0.4 + Math.random() : 2 + Math.random() * 0.5), z: e.pos.z + (Math.random() - 0.5) * 1.2,
          vx: 0, vy: fire ? 1.1 : -0.7, vz: 0, life: 1.4, age: 0, size: 0.1,
          color: fire ? '255,140,60' : '200,235,255', grav: 0, drag: 0,
        });
      }
      // Ley Lines glitter.
      if (e.leyLines && Math.random() < dt * 14) {
        const ang = Math.random() * Math.PI * 2, rr = Math.random() * 3;
        this.particles.push({ x: e.leyLines.x + Math.cos(ang) * rr, y: 0.05, z: e.leyLines.z + Math.sin(ang) * rr, vx: 0, vy: 0.8 + Math.random(), vz: 0, life: 1.2, age: 0, size: 0.1, color: '210,150,255', grav: 0, drag: 0 });
      }

      for (const p of this.particles) {
        p.age += dt;
        p.vy -= p.grav * dt;
        const dr = Math.max(0, 1 - p.drag * dt);
        p.vx *= dr; p.vy *= dr; p.vz *= dr;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.02) { p.y = 0.02; p.vy *= -0.3; }
      }
      this.particles = this.particles.filter(p => p.age < p.life);
      if (this.particles.length > 2500) this.particles.splice(0, this.particles.length - 2500);
      this.fx = this.fx.filter(f => this.time - f.t0 < f.dur);
    }

    // ---------- drawing ----------
    draw() {
      const W = this.W, H = this.H;
      const models = this.modelsOn();
      this.ctx = this.bgCtx;
      const far = this.toCam(this.cam.pos.x + Math.sin(this.camYaw) * 1e4, 0, this.cam.pos.z + Math.cos(this.camYaw) * 1e4);
      const horizon = this.fromCam(far).y;
      // With the game's map drawn below, this canvas keeps only what lies on the ground.
      const mapOn = this.mapOn();
      if (mapOn) {
        this.ctx.clearRect(0, 0, W, H);
        this.drawGroundMarks();
      } else {
        this.drawSky(horizon);
        this.drawGround(horizon);
      }

      // Billboards sorted far to near. With the game's models drawn in 3D between the two canvases, decor nearer
      // than the mage goes on the effects canvas so it still covers him.
      const p = this.e.pos;
      const pc = this.toCam(p.x, (p.y || 0) + this.jumpY(), p.z);
      const back = [], front = [];
      for (const d of mapOn ? [] : this.decor) {
        const c = this.toCam(d.x, 0, d.z);
        if (c.z > 0.5 && c.z < 70) (models && c.z < pc.z - 0.6 ? front : back).push({ z: c.z, draw: () => this.drawDecor(d, this.fromCam(c)) });
      }
      if (this.petPos) {
        const kc = this.toCam(this.petPos.x, 0, this.petPos.z);
        if (kc.z > 0.5) (models && kc.z < pc.z - 0.3 ? front : back).push({ z: kc.z, draw: () => this.drawPet(this.petKind, this.petPos) });
      }
      if (!models) {
        const dc = this.toCam(0, 0, 0);
        if (dc.z > 0.5) back.push({ z: dc.z, draw: () => this.drawDummy(this.fromCam(dc)) });
        for (let k = 1; k < this.e.targets; k++) {
          const d = B.EXTRA_DUMMIES[k - 1], xc = this.toCam(d.x, 0, d.z);
          if (xc.z > 0.5) back.push({ z: xc.z, draw: () => this.drawDummy(this.fromCam(xc)) });
        }
        if (pc.z > 0.5) back.push({ z: pc.z, draw: () => this.drawPlayer(this.fromCam(pc)) });
      }
      back.sort((a, b) => b.z - a.z).forEach(it => it.draw());

      this.ctx = this.fxCtx;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, W, H);
      front.sort((a, b) => b.z - a.z).forEach(it => it.draw());
      this.drawFx();
      this.drawParticles();

      if (this.screenFlash > 0) {
        ctx.fillStyle = `rgba(255,250,220,${this.screenFlash * 1.2})`;
        ctx.fillRect(0, 0, W, H);
      }
      // Vignette.
      const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      this.ctx = this.bgCtx;
    }

    drawSky(horizon) {
      const ctx = this.ctx, W = this.W;
      const g = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizon));
      g.addColorStop(0, '#070818');
      g.addColorStop(0.45, '#1d1940');
      g.addColorStop(0.8, '#563068');
      g.addColorStop(1, '#b35d6e');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, Math.max(0, horizon) + 2);

      // Stars wheel with the camera.
      const off = this.camYaw / (Math.PI * 2);
      for (const s of this.stars) {
        let u = (s.u + off) % 1; if (u < 0) u += 1;
        const x = u * W * 1.6 - W * 0.3, y = s.v * horizon * 0.85;
        const a = 0.35 + 0.35 * Math.sin(this.time * 1.5 + s.tw);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(x, y, s.s, s.s);
      }
      // Moon.
      let mu = (0.68 + off) % 1; if (mu < 0) mu += 1;
      const mx = mu * W * 1.6 - W * 0.3, my = horizon * 0.32;
      const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 120);
      mg.addColorStop(0, 'rgba(255,240,220,0.35)'); mg.addColorStop(1, 'rgba(255,240,220,0)');
      ctx.fillStyle = mg; ctx.fillRect(mx - 120, my - 120, 240, 240);
      ctx.fillStyle = '#f4ead8';
      ctx.beginPath(); ctx.arc(mx, my, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(200,180,170,0.45)';
      ctx.beginPath(); ctx.arc(mx - 7, my - 5, 6, 0, Math.PI * 2); ctx.arc(mx + 9, my + 7, 4, 0, Math.PI * 2); ctx.fill();

      // Two mountain ranges for parallax.
      this.drawRange(horizon, off * 1.0, 70, '#2a1d3f', 3.1);
      this.drawRange(horizon, off * 1.6, 40, '#1b1630', 5.7);
    }

    drawRange(horizon, off, amp, color, seed) {
      const ctx = this.ctx, W = this.W;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, horizon + 2);
      for (let x = 0; x <= W; x += 8) {
        const u = x / W - off;
        const h = Math.sin(u * 11 + seed) * 0.45 + Math.sin(u * 27 + seed * 2) * 0.25 + Math.sin(u * 61 + seed) * 0.1 + 0.6;
        ctx.lineTo(x, horizon - h * amp * (this.H / 1080));
      }
      ctx.lineTo(W, horizon + 2);
      ctx.closePath();
      ctx.fill();
    }

    drawGround(horizon) {
      const ctx = this.ctx, W = this.W, H = this.H;
      const g = ctx.createLinearGradient(0, horizon, 0, H);
      g.addColorStop(0, '#1c2324');
      g.addColorStop(0.3, '#243326');
      g.addColorStop(1, '#3a4b2f');
      ctx.fillStyle = g;
      ctx.fillRect(0, horizon, W, H - horizon);
      // Haze along the horizon.
      const hz = ctx.createLinearGradient(0, horizon - 30, 0, horizon + 60);
      hz.addColorStop(0, 'rgba(179,93,110,0)'); hz.addColorStop(0.4, 'rgba(150,90,120,0.35)'); hz.addColorStop(1, 'rgba(60,50,70,0)');
      ctx.fillStyle = hz; ctx.fillRect(0, horizon - 30, W, 90);

      // Stone dais around the dummy.
      if (this.groundPath(0, 0, 9.6, 72)) { ctx.fillStyle = '#3c3a44'; ctx.fill(); }
      if (this.groundPath(0, 0, 9, 72)) {
        const c = this.project(0, 0, 0);
        const grd = c ? ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 9 * c.s * 1.2) : null;
        if (grd) { grd.addColorStop(0, '#77727e'); grd.addColorStop(1, '#55515e'); }
        ctx.fillStyle = grd || '#5d5966';
        ctx.fill();
      }
      ctx.lineWidth = 1.5;
      for (const rr of [3, 6]) {
        if (this.groundPath(0, 0, rr, 64)) { ctx.strokeStyle = 'rgba(30,26,40,0.55)'; ctx.stroke(); }
      }
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        const p1 = this.project(Math.cos(a) * 3, 0, Math.sin(a) * 3), p2 = this.project(Math.cos(a) * 9, 0, Math.sin(a) * 9);
        if (p1 && p2) { ctx.strokeStyle = 'rgba(30,26,40,0.4)'; ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); }
      }
      // Faint rune ring on the dais.
      ctx.save();
      ctx.lineWidth = 2;
      if (this.groundPath(0, 0, 7.5, 72)) { ctx.strokeStyle = 'rgba(170,140,255,0.18)'; ctx.stroke(); }
      ctx.restore();

      this.drawGroundMarks();
    }

    drawGroundMarks() {
      this.drawLeyLines();
      this.drawCastCircle();
      this.drawTargetRing();

      // Shadows.
      this.shadow(0, 0, 0.9);
      this.shadow(this.e.pos.x, this.e.pos.z, 0.55 * (1 - this.jumpY() * 0.4), this.e.pos.y || 0);
    }

    // Melee range around the dummy, split into its rear and flank quarters (the dummy faces -Z). The quarter
    // you're standing in lights up; True North lights them all.
    drawPositionals() {
      const ctx = this.ctx, e = this.e;
      const R = B.MELEE_RANGE + B.DUMMY_RADIUS;
      const side = e.side(), tn = e.has('trueNorth');
      const arc = (a0, a1, r) => {
        let open = false;
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) {
          const a = a0 + (a1 - a0) * i / 24;
          const q = this.project(Math.cos(a) * r, 0.02, Math.sin(a) * r);
          if (!q) { open = false; continue; }
          if (open) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
          open = true;
        }
      };
      const d = Math.PI / 180;
      const inRange = e.distToTarget() - B.DUMMY_RADIUS <= B.MELEE_RANGE;
      for (const [k, a0, a1] of [['rear', 45, 135], ['flank', -45, 45], ['flank', 135, 225], ['front', 225, 315]]) {
        const on = k !== 'front' && (tn || side === k);
        arc((a0 + 3) * d, (a1 - 3) * d, R);
        ctx.strokeStyle = on ? (inRange ? 'rgba(255,214,110,0.85)' : 'rgba(255,214,110,0.4)') : k === 'front' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.22)';
        ctx.lineWidth = on ? 3 : 1.5;
        ctx.stroke();
      }
    }

    shadow(x, z, r, y) {
      const ctx = this.ctx;
      if (this.groundPath(x, z, r, 24, y || 0)) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); }
    }

    drawLeyLines() {
      const ll = this.e.leyLines;
      if (!ll) return;
      const ctx = this.ctx, ly = (ll.y || 0) + 0.01;
      const left = ll.until - this.e.now, age = this.e.now - ll.start;
      const a = Math.min(1, age * 3, left * 2);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (this.groundPath(ll.x, ll.z, 3, 64, ly)) {
        ctx.fillStyle = `rgba(140,60,220,${0.18 * a})`; ctx.fill();
        ctx.strokeStyle = `rgba(220,170,255,${0.85 * a})`; ctx.lineWidth = 3; ctx.stroke();
      }
      if (this.groundPath(ll.x, ll.z, 2.4, 64, ly)) { ctx.strokeStyle = `rgba(200,140,255,${0.5 * a})`; ctx.lineWidth = 1.5; ctx.stroke(); }
      // Rotating rune marks.
      const rot = this.time * 0.5;
      for (let i = 0; i < 12; i++) {
        const ang = rot + i / 12 * Math.PI * 2;
        const p1 = this.project(ll.x + Math.cos(ang) * 2.45, ly, ll.z + Math.sin(ang) * 2.45);
        const p2 = this.project(ll.x + Math.cos(ang + 0.12) * 2.95, ly, ll.z + Math.sin(ang + 0.12) * 2.95);
        if (p1 && p2) {
          ctx.strokeStyle = `rgba(240,210,255,${0.8 * a})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        }
      }
      // Star in the middle.
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const ang = -rot + i * Math.PI * 2 / 6 * 2;
        pts.push(this.project(ll.x + Math.cos(ang) * 2.3, ly, ll.z + Math.sin(ang) * 2.3));
      }
      if (pts.every(Boolean)) {
        ctx.strokeStyle = `rgba(200,140,255,${0.4 * a})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); ctx.stroke();
      }
      ctx.restore();
    }

    drawCastCircle() {
      const e = this.e;
      if (!e.casting) return;
      const a = A[e.casting.id];
      const col = (ELEMENT_COLORS[a.school] || ELEMENT_COLORS.none)[0];
      const k = (e.now - e.casting.start) / (e.casting.end - e.casting.start);
      const ctx = this.ctx;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const r = 1.3;
      const gy = (e.pos.y || 0) + 0.02;
      if (this.groundPath(e.pos.x, e.pos.z, r, 40, gy)) {
        ctx.strokeStyle = `rgba(${col},0.9)`; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = `rgba(${col},0.12)`; ctx.fill();
      }
      if (this.groundPath(e.pos.x, e.pos.z, r * 0.75, 40, gy)) { ctx.strokeStyle = `rgba(${col},0.6)`; ctx.lineWidth = 1.2; ctx.stroke(); }
      // Progress sweep.
      const steps = Math.max(2, Math.round(40 * k));
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const ang = -Math.PI / 2 + i / 40 * Math.PI * 2;
        const q = this.project(e.pos.x + Math.cos(ang) * r * 1.12, gy, e.pos.z + Math.sin(ang) * r * 1.12);
        if (q) i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
      }
      ctx.strokeStyle = `rgba(255,255,255,0.8)`; ctx.lineWidth = 2; ctx.stroke();
      const rot = this.time * 2;
      for (let i = 0; i < 3; i++) {
        const ang = rot + i * Math.PI * 2 / 3;
        const q1 = this.project(e.pos.x + Math.cos(ang) * r * 0.75, gy, e.pos.z + Math.sin(ang) * r * 0.75);
        const q2 = this.project(e.pos.x + Math.cos(ang + 2.1) * r * 0.75, gy, e.pos.z + Math.sin(ang + 2.1) * r * 0.75);
        if (q1 && q2) { ctx.strokeStyle = `rgba(${col},0.7)`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.stroke(); }
      }
      ctx.restore();
    }

    drawTargetRing() {
      if (!this.e.targeted) return;
      const ctx = this.ctx;
      ctx.save();
      if (this.e.job.role === 'melee') this.drawPositionals();
      if (this.groundPath(0, 0, 1.6, 48, 0.02)) { ctx.strokeStyle = 'rgba(255,90,60,0.9)'; ctx.lineWidth = 2.5; ctx.stroke(); }
      if (this.groundPath(0, 0, 1.75, 48, 0.02)) { ctx.strokeStyle = 'rgba(255,170,120,0.35)'; ctx.lineWidth = 1; ctx.stroke(); }
      const rot = this.time * 0.6;
      ctx.fillStyle = 'rgba(255,120,80,0.95)';
      for (let i = 0; i < 4; i++) {
        const ang = rot + i * Math.PI / 2;
        const tip = this.project(Math.cos(ang) * 1.85, 0.02, Math.sin(ang) * 1.85);
        const l = this.project(Math.cos(ang - 0.13) * 2.2, 0.02, Math.sin(ang - 0.13) * 2.2);
        const r = this.project(Math.cos(ang + 0.13) * 2.2, 0.02, Math.sin(ang + 0.13) * 2.2);
        if (tip && l && r) { ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(l.x, l.y); ctx.lineTo(r.x, r.y); ctx.closePath(); ctx.fill(); }
      }
      ctx.restore();
    }

    drawDecor(d, p) {
      const ctx = this.ctx, s = p.s;
      if (d.kind === 'grass') {
        const h = d.h * s, w = 0.25 * s;
        ctx.strokeStyle = d.hue > 0.5 ? '#3f5a35' : '#4c6a3a';
        ctx.lineWidth = Math.max(1, s * 0.04);
        ctx.beginPath();
        for (let i = -2; i <= 2; i++) {
          ctx.moveTo(p.x + i * w * 0.25, p.y);
          ctx.quadraticCurveTo(p.x + i * w * 0.4, p.y - h * 0.6, p.x + i * w * 0.7 + Math.sin(this.time + d.x) * w * 0.2, p.y - h);
        }
        ctx.stroke();
      } else if (d.kind === 'rock') {
        const w = d.w * s, h = d.h * s;
        ctx.fillStyle = '#3a3742';
        ctx.beginPath();
        ctx.moveTo(p.x - w / 2, p.y);
        ctx.lineTo(p.x - w * 0.35, p.y - h * 0.8);
        ctx.lineTo(p.x + w * (d.seed - 0.5) * 0.4, p.y - h);
        ctx.lineTo(p.x + w * 0.4, p.y - h * 0.6);
        ctx.lineTo(p.x + w / 2, p.y);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath(); ctx.moveTo(p.x - w * 0.35, p.y - h * 0.8); ctx.lineTo(p.x + w * (d.seed - 0.5) * 0.4, p.y - h); ctx.lineTo(p.x, p.y - h * 0.4); ctx.closePath(); ctx.fill();
      } else if (d.kind === 'lantern') {
        const h = 2.2 * s, w = 0.18 * s;
        ctx.fillStyle = '#231d2a';
        ctx.fillRect(p.x - w / 2, p.y - h, w, h);
        ctx.fillRect(p.x - w * 1.6, p.y - h - w * 2.2, w * 3.2, w * 2.4);
        const flick = 0.8 + Math.sin(this.time * 9 + d.x) * 0.1 + Math.sin(this.time * 23 + d.z) * 0.05;
        const gx = p.x, gy = p.y - h - w;
        const g = this.ctx.createRadialGradient(gx, gy, 0, gx, gy, w * 9);
        g.addColorStop(0, `rgba(255,190,110,${0.55 * flick})`); g.addColorStop(1, 'rgba(255,190,110,0)');
        ctx.fillStyle = g; ctx.fillRect(gx - w * 9, gy - w * 9, w * 18, w * 18);
        ctx.fillStyle = `rgba(255,220,150,${flick})`;
        ctx.fillRect(p.x - w, p.y - h - w * 1.8, w * 2, w * 1.6);
      }
    }

    // A pet: Garuda-Egi or Ifrit-Egi at shoulder height, Demi-Bahamut large and high, with beating wings.
    drawPet(kind, w) {
      const ctx = this.ctx, t = this.time;
      if (kind === 'rook') { this.drawTurret(w); return; }
      const big = kind === 'bahamut', fairy = FAERIES.includes(kind);
      const C = PET_COLORS[kind] || PET_COLORS.garuda;
      const p = this.project(w.x, (big ? 2.7 : fairy ? 1.9 : 1.0) + Math.sin(t * 2.2) * (fairy ? 0.25 : 0.12), w.z);
      if (!p) return;
      const U = p.s * (big ? 1.5 : fairy ? 0.32 : 0.6);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, U * 1.8);
      g.addColorStop(0, `rgba(${C.glow},0.5)`); g.addColorStop(1, `rgba(${C.glow},0)`);
      ctx.fillStyle = g; ctx.fillRect(-U * 1.8, -U * 1.8, U * 3.6, U * 3.6);
      ctx.globalCompositeOperation = 'source-over';
      const flap = Math.sin(t * (big ? 3 : fairy ? 16 : 7)) * 0.25;
      ctx.fillStyle = `rgba(${C.wing},0.9)`;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(s * 0.12 * U, -0.25 * U);
        ctx.quadraticCurveTo(s * 0.9 * U, (-1.0 - flap) * U, s * 1.35 * U, (-0.4 - flap) * U);
        ctx.quadraticCurveTo(s * 0.85 * U, -0.15 * U, s * 1.05 * U, (0.25 - flap * 0.5) * U);
        ctx.quadraticCurveTo(s * 0.5 * U, 0.05 * U, s * 0.12 * U, 0.15 * U);
        ctx.closePath(); ctx.fill();
      }
      if (big) {
        // Tail and horns for the dragon.
        ctx.strokeStyle = `rgba(${C.wing},0.95)`; ctx.lineWidth = 0.12 * U; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0.4 * U); ctx.quadraticCurveTo(0.3 * U, 1.0 * U, -0.2 * U + Math.sin(t * 2) * 0.1 * U, 1.4 * U); ctx.stroke();
      }
      const bg = ctx.createRadialGradient(0, -0.1 * U, 0, 0, 0, 0.5 * U);
      bg.addColorStop(0, `rgb(${C.body})`); bg.addColorStop(1, `rgba(${C.glow},0.9)`);
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.ellipse(0, 0, 0.28 * U, 0.5 * U, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -0.62 * U, 0.2 * U, 0, Math.PI * 2); ctx.fill();
      if (big || kind === 'ifrit') {
        ctx.fillStyle = `rgba(${C.wing},1)`;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 0.1 * U, -0.75 * U); ctx.lineTo(s * 0.35 * U, -1.05 * U); ctx.lineTo(s * 0.18 * U, -0.68 * U); ctx.fill(); }
      }
      ctx.restore();
    }

    // Machinist's Rook Autoturret: a tripod with a turning head and a glowing lens.
    drawTurret(w) {
      const ctx = this.ctx, C = PET_COLORS.rook;
      const base = this.project(w.x, 0, w.z), head = this.project(w.x, 1.1, w.z);
      if (!base || !head) return;
      const U = base.s * 0.5;
      ctx.save();
      ctx.strokeStyle = `rgb(${C.wing})`; ctx.lineWidth = Math.max(1.5, U * 0.08); ctx.lineCap = 'round';
      for (const dx of [-0.6, 0, 0.6]) { ctx.beginPath(); ctx.moveTo(head.x, head.y + U * 0.3); ctx.lineTo(base.x + dx * U, base.y); ctx.stroke(); }
      const g = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, U * 0.9);
      g.addColorStop(0, `rgb(${C.body})`); g.addColorStop(1, `rgb(${C.wing})`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(head.x, head.y, U * 0.6, U * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgb(${C.wing})`; ctx.fillRect(head.x - U * 0.12, head.y - U * 0.05, U * 0.9, U * 0.16);
      ctx.globalCompositeOperation = 'lighter';
      const l = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, U * 0.5);
      l.addColorStop(0, `rgba(${C.glow},${0.8 + Math.sin(this.time * 6) * 0.2})`); l.addColorStop(1, `rgba(${C.glow},0)`);
      ctx.fillStyle = l; ctx.beginPath(); ctx.arc(head.x, head.y, U * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // The pet acts: what it throws flies from it to the dummy (the hit itself comes through onHit).
    onPetUse(id) {
      if (!this.petPos) return;
      const a = A[id] || {};
      const big = this.petKind === 'bahamut';
      const C = PET_COLORS[this.petKind] || PET_COLORS.garuda;
      const from = { x: this.petPos.x, y: big ? 2.7 : 1.0, z: this.petPos.z };
      this.addFx({ type: 'orb', from, dur: (a.delay || 0.6) * 0.9, color: C.fx, size: a.big ? 0.8 : 0.32 });
      if (a.big) this.addFx({ type: 'flash', ...from, r: 2.2, dur: 0.5, color: C.fx[0] });
    }

    drawDummy(p) {
      const ctx = this.ctx, s = p.s;
      ctx.save();
      ctx.translate(p.x, p.y);
      const wob = Math.sin(this.time * 28) * this.dummyWobble * 0.06;
      ctx.rotate(wob);
      const U = s; // pixels per yalm
      // Feet.
      ctx.fillStyle = '#4a3020';
      ctx.fillRect(-0.55 * U, -0.12 * U, 1.1 * U, 0.12 * U);
      // Post.
      ctx.fillStyle = '#5b3a24';
      ctx.fillRect(-0.09 * U, -2.2 * U, 0.18 * U, 2.2 * U);
      // Arms.
      ctx.save();
      ctx.translate(0, -1.55 * U);
      ctx.rotate(-wob * 2);
      ctx.fillStyle = '#6a4429';
      ctx.fillRect(-0.85 * U, -0.07 * U, 1.7 * U, 0.14 * U);
      ctx.fillStyle = '#c9a45c';
      ctx.beginPath(); ctx.ellipse(-0.85 * U, 0, 0.14 * U, 0.12 * U, 0, 0, Math.PI * 2); ctx.ellipse(0.85 * U, 0, 0.14 * U, 0.12 * U, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // Straw body.
      const bg = ctx.createLinearGradient(-0.45 * U, 0, 0.45 * U, 0);
      bg.addColorStop(0, '#9b7838'); bg.addColorStop(0.45, '#d8b56a'); bg.addColorStop(1, '#8a6a30');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.ellipse(0, -1.15 * U, 0.42 * U, 0.62 * U, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(80,50,20,0.55)'; ctx.lineWidth = Math.max(1, 0.03 * U);
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath(); ctx.moveTo(i * 0.1 * U, -1.7 * U); ctx.quadraticCurveTo(i * 0.14 * U, -1.15 * U, i * 0.1 * U, -0.6 * U); ctx.stroke();
      }
      // Rope bands.
      ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = Math.max(1.5, 0.06 * U);
      for (const y of [-1.45, -0.85]) { ctx.beginPath(); ctx.ellipse(0, y * U, 0.38 * U, 0.06 * U, 0, 0, Math.PI); ctx.stroke(); }
      // Target circle painted on the chest.
      ctx.strokeStyle = '#8b1e1e'; ctx.lineWidth = Math.max(1, 0.05 * U);
      ctx.beginPath(); ctx.arc(0, -1.2 * U, 0.2 * U, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#8b1e1e'; ctx.beginPath(); ctx.arc(0, -1.2 * U, 0.07 * U, 0, Math.PI * 2); ctx.fill();
      // Sack head.
      const hg = ctx.createRadialGradient(-0.08 * U, -2.05 * U, 0, 0, -1.98 * U, 0.3 * U);
      hg.addColorStop(0, '#e9d6a6'); hg.addColorStop(1, '#a88c58');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.ellipse(0, -2.0 * U, 0.27 * U, 0.3 * U, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9a7a44';
      ctx.beginPath(); ctx.moveTo(-0.1 * U, -2.28 * U); ctx.lineTo(0.1 * U, -2.28 * U); ctx.lineTo(0, -2.45 * U); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3b2a18'; ctx.lineWidth = Math.max(1, 0.035 * U);
      for (const ex of [-0.1, 0.1]) {
        ctx.beginPath(); ctx.moveTo((ex - 0.04) * U, -2.06 * U); ctx.lineTo((ex + 0.04) * U, -1.98 * U);
        ctx.moveTo((ex + 0.04) * U, -2.06 * U); ctx.lineTo((ex - 0.04) * U, -1.98 * U); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(-0.08 * U, -1.88 * U); ctx.lineTo(0.08 * U, -1.88 * U); ctx.stroke();

      if (this.dummyFlash > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,255,255,${this.dummyFlash * 2})`;
        ctx.beginPath(); ctx.ellipse(0, -1.15 * U, 0.45 * U, 0.65 * U, 0, 0, Math.PI * 2); ctx.ellipse(0, -2.0 * U, 0.28 * U, 0.31 * U, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    drawMage(p) {
      const ctx = this.ctx, U = p.s;
      const e = this.e;
      const casting = !!e.casting;
      const raise = casting ? 1 : this.release > 0 ? this.release / 0.45 : 0;
      const bob = Math.abs(Math.sin(this.walkPhase)) * 0.04 * U;
      ctx.save();
      ctx.translate(p.x, p.y - bob);

      // Element glow behind the mage.
      const aura = e.job.aura ? e.job.aura(e) : 0;
      if (aura !== 0) {
        const col = aura > 0 ? '255,110,40' : '100,180,255';
        const g = ctx.createRadialGradient(0, -1 * U, 0, 0, -1 * U, 1.4 * U);
        g.addColorStop(0, `rgba(${col},${0.12 * Math.abs(aura)})`); g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g; ctx.fillRect(-1.5 * U, -2.5 * U, 3 * U, 3 * U);
      }

      // Staff (held in the right hand; raised while casting).
      const handX = 0.42 * U, handY = (-1.05 - raise * 0.45) * U;
      ctx.strokeStyle = '#4a2d1a'; ctx.lineWidth = Math.max(2, 0.07 * U); ctx.lineCap = 'round';
      const topX = handX + (0.12 - raise * 0.05) * U, topY = handY - (0.95 + raise * 0.1) * U;
      const botX = handX - 0.05 * U, botY = handY + 0.9 * U * (1 - raise * 0.4);
      ctx.beginPath(); ctx.moveTo(botX, botY); ctx.lineTo(topX, topY); ctx.stroke();
      // Staff head.
      ctx.strokeStyle = '#c9a44a'; ctx.lineWidth = Math.max(1.5, 0.04 * U);
      ctx.beginPath(); ctx.arc(topX, topY - 0.1 * U, 0.11 * U, 0, Math.PI * 2); ctx.stroke();
      let orb = '170,110,255';
      if (e.casting) {
        const sc = A[e.casting.id].school;
        orb = sc === 'fire' ? '255,120,40' : sc === 'ice' ? '120,200,255' : sc === 'thunder' ? '255,240,140' : '220,150,255';
      }
      const glowR = (0.18 + raise * 0.25) * U;
      const og = ctx.createRadialGradient(topX, topY - 0.1 * U, 0, topX, topY - 0.1 * U, glowR * 2);
      og.addColorStop(0, `rgba(255,255,255,0.95)`); og.addColorStop(0.25, `rgba(${orb},0.9)`); og.addColorStop(1, `rgba(${orb},0)`);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = og; ctx.beginPath(); ctx.arc(topX, topY - 0.1 * U, glowR * 2, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      // Robe.
      const rg = ctx.createLinearGradient(-0.5 * U, 0, 0.5 * U, 0);
      rg.addColorStop(0, '#0f0c1c'); rg.addColorStop(0.5, '#28213f'); rg.addColorStop(1, '#0f0c1c');
      ctx.fillStyle = rg;
      const sway = Math.sin(this.walkPhase) * 0.04 * U;
      ctx.beginPath();
      ctx.moveTo(-0.3 * U, -1.5 * U);
      ctx.quadraticCurveTo(-0.42 * U, -0.8 * U, -0.55 * U + sway, -0.02 * U);
      ctx.lineTo(0.55 * U + sway, -0.02 * U);
      ctx.quadraticCurveTo(0.42 * U, -0.8 * U, 0.3 * U, -1.5 * U);
      ctx.closePath(); ctx.fill();
      // Hem and spine trim.
      ctx.strokeStyle = '#c9a44a'; ctx.lineWidth = Math.max(1, 0.035 * U);
      ctx.beginPath(); ctx.moveTo(-0.55 * U + sway, -0.08 * U); ctx.lineTo(0.55 * U + sway, -0.08 * U); ctx.stroke();
      ctx.strokeStyle = 'rgba(130,90,210,0.8)';
      ctx.beginPath(); ctx.moveTo(0, -1.45 * U); ctx.lineTo(sway * 0.5, -0.1 * U); ctx.stroke();
      // Sash.
      ctx.fillStyle = '#6b2d8f';
      ctx.fillRect(-0.34 * U, -1.0 * U, 0.68 * U, 0.09 * U);

      // Left arm hangs, right arm holds the staff.
      ctx.fillStyle = '#1c1730';
      ctx.beginPath();
      ctx.moveTo(-0.3 * U, -1.45 * U); ctx.lineTo(-0.48 * U, -0.85 * U); ctx.lineTo(-0.36 * U, -0.8 * U); ctx.lineTo(-0.22 * U, -1.3 * U);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0.28 * U, -1.45 * U); ctx.lineTo(handX + 0.05 * U, handY + 0.05 * U); ctx.lineTo(handX - 0.08 * U, handY + 0.12 * U); ctx.lineTo(0.2 * U, -1.28 * U);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e0c2a0';
      ctx.beginPath(); ctx.arc(handX, handY, 0.055 * U, 0, Math.PI * 2); ctx.fill();

      // Shoulders and collar.
      ctx.fillStyle = '#1a1530';
      ctx.beginPath(); ctx.ellipse(0, -1.48 * U, 0.33 * U, 0.12 * U, 0, 0, Math.PI * 2); ctx.fill();

      // The hat: wide brim, tall cone that bends over at the tip.
      ctx.fillStyle = '#120e1d';
      ctx.beginPath(); ctx.ellipse(0, -1.72 * U, 0.52 * U, 0.14 * U, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(201,164,74,0.8)'; ctx.lineWidth = Math.max(1, 0.025 * U);
      ctx.beginPath(); ctx.ellipse(0, -1.72 * U, 0.52 * U, 0.14 * U, 0, 0, Math.PI * 2); ctx.stroke();
      const hg = ctx.createLinearGradient(-0.25 * U, 0, 0.25 * U, 0);
      hg.addColorStop(0, '#0d0a16'); hg.addColorStop(0.5, '#241d38'); hg.addColorStop(1, '#0d0a16');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.moveTo(-0.24 * U, -1.76 * U);
      ctx.quadraticCurveTo(-0.16 * U, -2.3 * U, -0.02 * U, -2.55 * U);
      ctx.quadraticCurveTo(0.12 * U, -2.62 * U, 0.3 * U, -2.48 * U);
      ctx.quadraticCurveTo(0.12 * U, -2.4 * U, 0.06 * U, -2.3 * U);
      ctx.quadraticCurveTo(0.14 * U, -2.0 * U, 0.24 * U, -1.76 * U);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6b2d8f';
      ctx.fillRect(-0.23 * U, -1.86 * U, 0.46 * U, 0.07 * U);
      ctx.restore();
    }

    drawPlayer(p) {
      if (this.e.job.id === 'sam') this.drawSamurai(p);
      else if (this.e.job.id === 'gnb') this.drawSamurai(p, { pants: '#1a1c24', top: '#2a2f3d', trim: '#5f86c9', belt: '#3a2c22', sleeve: '#232733', sheath: false, blade: 1.2, bladeW: 0.06 });
      else this.drawMage(p);
    }

    // The drawn Samurai, for when the game's models aren't loaded: hakama, kimono, the katana and its sheath.
    // Iaijutsu holds the blade sheathed with a hand on the hilt; a weaponskill swings it up.
    drawSamurai(p, look) {
      const L = Object.assign({ pants: '#1c2133', top: '#d8d0bf', trim: '#a3262a', belt: '#8c1c20', sleeve: '#c9c1af', sheath: true, blade: 1.05, bladeW: 0.035 }, look);
      const ctx = this.ctx, U = p.s, e = this.e;
      const iai = !!e.casting;
      const swing = this.release > 0 ? this.release / 0.45 : 0;
      const bob = Math.abs(Math.sin(this.walkPhase)) * 0.04 * U;
      const sway = Math.sin(this.walkPhase) * 0.05 * U;
      ctx.save();
      ctx.translate(p.x, p.y - bob);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';

      // Sheath at the left hip, angled back.
      if (L.sheath) {
        ctx.strokeStyle = '#1a0f0c'; ctx.lineWidth = Math.max(2, 0.075 * U);
        ctx.beginPath(); ctx.moveTo(-0.12 * U, -0.98 * U); ctx.lineTo(-0.82 * U, -0.62 * U); ctx.stroke();
        ctx.strokeStyle = '#b8902f'; ctx.lineWidth = Math.max(1, 0.02 * U);
        ctx.beginPath(); ctx.moveTo(-0.7 * U, -0.68 * U); ctx.lineTo(-0.74 * U, -0.6 * U); ctx.stroke();
      }

      // Hakama: wide pleated trousers.
      ctx.fillStyle = L.pants;
      ctx.beginPath();
      ctx.moveTo(-0.27 * U, -0.98 * U);
      ctx.lineTo(-0.52 * U + sway, -0.02 * U); ctx.lineTo(-0.06 * U + sway * 0.5, -0.02 * U);
      ctx.lineTo(0, -0.55 * U);
      ctx.lineTo(0.06 * U - sway * 0.5, -0.02 * U); ctx.lineTo(0.52 * U - sway, -0.02 * U);
      ctx.lineTo(0.27 * U, -0.98 * U);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(120,130,170,0.35)'; ctx.lineWidth = Math.max(1, 0.015 * U);
      for (const x of [-0.3, -0.16, 0.16, 0.3]) { ctx.beginPath(); ctx.moveTo(x * 0.7 * U, -0.9 * U); ctx.lineTo(x * 1.4 * U, -0.05 * U); ctx.stroke(); }

      // Kimono top with a red collar, and the obi.
      ctx.fillStyle = L.top;
      ctx.beginPath();
      ctx.moveTo(-0.31 * U, -1.5 * U); ctx.lineTo(-0.34 * U, -0.94 * U); ctx.lineTo(0.34 * U, -0.94 * U); ctx.lineTo(0.31 * U, -1.5 * U);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = L.trim; ctx.lineWidth = Math.max(1.5, 0.04 * U);
      ctx.beginPath(); ctx.moveTo(-0.15 * U, -1.5 * U); ctx.lineTo(0.03 * U, -1.1 * U); ctx.lineTo(0.15 * U, -1.5 * U); ctx.stroke();
      ctx.fillStyle = L.belt;
      ctx.fillRect(-0.34 * U, -1.04 * U, 0.68 * U, 0.11 * U);

      // Right arm and the katana. Iaijutsu: hand on the hilt at the hip. Otherwise the blade is out, low and
      // forward, and swings up after a weaponskill.
      const shX = 0.29 * U, shY = -1.44 * U;
      let handX, handY, tipX, tipY;
      if (iai) {
        handX = -0.08 * U; handY = -1.02 * U;
        tipX = handX + 0.22 * U; tipY = handY - 0.08 * U;
      } else {
        const ang = -0.35 - swing * 1.9;   // from horizontal; negative is up
        handX = (0.46 + swing * 0.08) * U; handY = (-1.0 - swing * 0.35) * U;
        tipX = handX + Math.cos(ang) * L.blade * U; tipY = handY + Math.sin(ang) * L.blade * U;
        ctx.strokeStyle = '#c9ced8'; ctx.lineWidth = Math.max(1.5, L.bladeW * U);
        ctx.beginPath(); ctx.moveTo(handX, handY); ctx.lineTo(tipX, tipY); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = Math.max(1, 0.012 * U);
        ctx.beginPath(); ctx.moveTo(handX, handY); ctx.lineTo(tipX, tipY); ctx.stroke();
      }
      // Hilt and guard.
      const hx = handX - (tipX - handX) * 0.2, hy = handY - (tipY - handY) * 0.2;
      ctx.strokeStyle = '#2a1a14'; ctx.lineWidth = Math.max(2, 0.05 * U);
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(handX, handY); ctx.stroke();
      ctx.fillStyle = '#b8902f';
      ctx.beginPath(); ctx.arc(handX, handY, 0.04 * U, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = L.sleeve;
      ctx.beginPath();
      ctx.moveTo(shX, shY); ctx.lineTo(handX + 0.05 * U, handY - 0.02 * U); ctx.lineTo(handX - 0.04 * U, handY + 0.08 * U); ctx.lineTo(0.22 * U, -1.26 * U);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e0c2a0';
      ctx.beginPath(); ctx.arc(handX, handY + 0.02 * U, 0.05 * U, 0, Math.PI * 2); ctx.fill();
      // Left arm hangs by the sheath.
      ctx.fillStyle = L.sleeve;
      ctx.beginPath();
      ctx.moveTo(-0.29 * U, -1.44 * U); ctx.lineTo(-0.44 * U, -0.92 * U); ctx.lineTo(-0.33 * U, -0.88 * U); ctx.lineTo(-0.2 * U, -1.26 * U);
      ctx.closePath(); ctx.fill();

      // Head: face, dark hair tied up in a topknot.
      ctx.fillStyle = '#e3c4a2';
      ctx.beginPath(); ctx.ellipse(0, -1.68 * U, 0.15 * U, 0.18 * U, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#16121a';
      ctx.beginPath(); ctx.ellipse(0, -1.76 * U, 0.165 * U, 0.12 * U, 0, Math.PI, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0.02 * U, -1.93 * U, 0.06 * U, 0.08 * U, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#a3262a'; ctx.lineWidth = Math.max(1, 0.025 * U);
      ctx.beginPath(); ctx.moveTo(-0.04 * U, -1.88 * U); ctx.lineTo(0.08 * U, -1.86 * U); ctx.stroke();
      ctx.restore();
    }

    drawFx() {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const f of this.fx) {
        const k = (this.time - f.t0) / f.dur;
        if (k < 0) continue;
        const fade = 1 - k;
        if (f.type === 'slash') {
          this.drawSlash(f, k);
        } else if (f.type === 'flash') {
          const p = this.project(f.x, f.y, f.z);
          if (!p) continue;
          const r = f.r * p.s * (0.5 + k * 0.8);
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          g.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`); g.addColorStop(0.3, `rgba(${f.color},${0.6 * fade})`); g.addColorStop(1, `rgba(${f.color},0)`);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        } else if (f.type === 'ring') {
          const r = f.r0 + (f.r1 - f.r0) * Math.sqrt(k);
          if (this.groundPath(f.x, f.z, r, 48, 0.03)) { ctx.strokeStyle = `rgba(${f.color},${fade})`; ctx.lineWidth = 3 * fade + 1; ctx.stroke(); }
        } else if (f.type === 'pillar') {
          const b = this.project(f.x, 0, f.z), t = this.project(f.x, f.h, f.z);
          if (!b || !t) continue;
          const w = f.w * b.s * (k < 0.2 ? k / 0.2 : 1) * (0.6 + fade * 0.4);
          const g = ctx.createLinearGradient(b.x - w, 0, b.x + w, 0);
          g.addColorStop(0, `rgba(${f.color},0)`); g.addColorStop(0.5, `rgba(255,230,200,${0.9 * fade})`); g.addColorStop(1, `rgba(${f.color},0)`);
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(b.x - w, b.y); ctx.lineTo(t.x - w * 0.3, t.y); ctx.lineTo(t.x + w * 0.3, t.y); ctx.lineTo(b.x + w, b.y); ctx.closePath(); ctx.fill();
        } else if (f.type === 'spikes') {
          const r = rng(Math.floor(f.seed * 1e6));
          const grow = Math.min(1, k * 5);
          for (let i = 0; i < f.n; i++) {
            const ang = r() * Math.PI * 2, d = 0.2 + r() * 1.1, h = f.h * (0.5 + r() * 0.6) * grow;
            const x = Math.cos(ang) * d, z = Math.sin(ang) * d;
            const lean = (r() - 0.5) * 0.6;
            const b1 = this.project(x - 0.18, 0, z), b2 = this.project(x + 0.18, 0, z), t = this.project(x + lean, h, z);
            if (!b1 || !b2 || !t) continue;
            ctx.fillStyle = `rgba(150,215,255,${0.75 * fade})`;
            ctx.beginPath(); ctx.moveTo(b1.x, b1.y); ctx.lineTo(t.x, t.y); ctx.lineTo(b2.x, b2.y); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = `rgba(240,252,255,${0.9 * fade})`; ctx.lineWidth = 1.2; ctx.stroke();
          }
        } else if (f.type === 'bolt') {
          const r = rng(Math.floor(f.seed * 1e6));
          const pts = [];
          let x = (r() - 0.5) * 3, y = 16, z = (r() - 0.5) * 3;
          while (y > 1.3) {
            pts.push(this.project(x, y, z));
            y -= 0.9 + r() * 1.2;
            x = x * 0.75 + (r() - 0.5) * 1.2; z = z * 0.75 + (r() - 0.5) * 1.2;
          }
          pts.push(this.project(0, 1.3, 0));
          if (pts.some(q => !q)) continue;
          const flick = k < 0.3 ? 1 : (Math.sin(k * 60) > 0 ? fade : fade * 0.3);
          for (const [w, c] of [[14, `rgba(180,140,255,${0.25 * flick})`], [6, `rgba(255,240,170,${0.7 * flick})`], [2, `rgba(255,255,255,${flick})`]]) {
            ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineJoin = 'round';
            ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.stroke();
          }
        } else if (f.type === 'runes') {
          const rot = k * 2;
          for (let i = 0; i < 8; i++) {
            const ang = rot + i / 8 * Math.PI * 2;
            const q = this.project(f.x + Math.cos(ang) * f.r, 1.3 + Math.sin(ang * 2) * 0.3, f.z + Math.sin(ang) * f.r);
            if (!q) continue;
            ctx.fillStyle = `rgba(${f.color},${fade})`;
            ctx.font = `${Math.round(q.s * 0.45)}px Georgia, serif`;
            ctx.fillText('ᚠᚢᚦᚨᚱᚲᚷᚹ'[i], q.x, q.y);
          }
        } else if (f.type === 'orb') {
          const t = this.project(0, 1.3, 0);
          const ease = k * k;
          const x = f.from.x + (0 - f.from.x) * ease, y = f.from.y + (1.3 - f.from.y) * ease + Math.sin(k * Math.PI) * 0.8, z = f.from.z + (0 - f.from.z) * ease;
          const q = this.project(x, y, z);
          if (!q || !t) continue;
          const r = f.size * q.s;
          const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 2);
          g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, `rgba(${f.color[0]},0.9)`); g.addColorStop(1, `rgba(${f.color[1]},0)`);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, r * 2, 0, Math.PI * 2); ctx.fill();
          if (Math.random() < 0.6) this.particles.push({ x, y, z, vx: 0, vy: 0, vz: 0, life: 0.35, age: 0, size: f.size * 0.6, color: f.color[0], grav: 0, drag: 0 });
        }
      }
      ctx.restore();
    }

    // A sword trail: an arc around the dummy in a plane facing the camera, leaned back so it bulges toward you.
    // The head sweeps from a0 to a1, the tail follows, and the trail thins out behind the head.
    drawSlash(f, k) {
      const ctx = this.ctx, C = this.cam;
      const ct = Math.cos(f.tilt), st = Math.sin(f.tilt);
      const U = { x: C.r.x * ct, y: C.r.y * ct + st, z: C.r.z * ct };
      const V0 = { x: -C.r.x * st, y: -C.r.y * st + ct, z: -C.r.z * st };
      const V = { x: V0.x * 0.4 - C.f.x * 0.85, y: V0.y * 0.4 - C.f.y * 0.85, z: V0.z * 0.4 - C.f.z * 0.85 };
      const c0 = { x: -C.f.x * 0.5, y: f.y, z: -C.f.z * 0.5 };
      const head = Math.min(1, k / 0.3), tail = Math.max(0, (k - 0.25) / 0.75);
      if (head - tail < 0.02) return;
      const at = (s, r) => {
        const t = f.a0 + (f.a1 - f.a0) * s;
        const cs = Math.cos(t), sn = Math.sin(t);
        return this.project(c0.x + r * (cs * U.x + sn * V.x), c0.y + r * (cs * U.y + sn * V.y), c0.z + r * (cs * U.z + sn * V.z));
      };
      const n = 26;
      const band = (wk, style) => {
        const outer = [], inner = [];
        for (let i = 0; i <= n; i++) {
          const s = tail + (head - tail) * i / n;
          const w = f.w * wk * Math.pow(i / n, 0.7);
          const o = at(s, f.r + w / 2), q = at(s, f.r - w / 2);
          if (!o || !q) return;
          outer.push(o); inner.push(q);
        }
        ctx.fillStyle = style;
        ctx.beginPath();
        outer.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
        for (let i = inner.length - 1; i >= 0; i--) ctx.lineTo(inner[i].x, inner[i].y);
        ctx.closePath(); ctx.fill();
      };
      const alpha = k < 0.3 ? 1 : 1 - (k - 0.3) / 0.7;
      band(1.6, `rgba(${f.color},${0.22 * alpha})`);
      band(1, `rgba(${f.color},${0.65 * alpha})`);
      band(0.3, `rgba(255,255,255,${0.95 * alpha})`);
    }

    drawParticles() {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of this.particles) {
        const q = this.project(p.x, p.y, p.z);
        if (!q) continue;
        const k = p.age / p.life;
        const r = p.size * q.s * (1 - k * 0.5);
        if (r < 0.3) continue;
        ctx.globalAlpha = Math.max(0, 1 - k);
        ctx.drawImage(this.sprite(p.color), q.x - r, q.y - r, r * 2, r * 2);
      }
      ctx.restore();
    }

    // Screen point where flytext for the dummy starts.
    dummyHead(k) {
      const d = k ? B.EXTRA_DUMMIES[k - 1] : null;
      return d ? this.project(d.x, 2.5, d.z) : this.project(0, 2.7, 0);
    }
    mageHead() { const p = this.e.pos; return this.project(p.x, (p.y || 0) + (this.modelsOn() ? 2.4 : 2.9) + this.jumpY(), p.z); }

    hitDummy(x, y) {
      const b = this.project(0, 0, 0), t = this.project(0, 2.5, 0);
      if (!b || !t) return false;
      const w = Math.max(30, b.s * 1.1);
      return x > b.x - w && x < b.x + w && y > t.y - 10 && y < b.y + 10;
    }
  }

  B.Scene = Scene;
})(window.BLM);

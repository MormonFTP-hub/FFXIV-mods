// Visual effects: barriers and bubbles with a hex pattern, Graviton Surge, the D.Va bomb, Earthshatter,
// Zarya's beam, projectiles, tracers, Lucio's song rings, Zenyatta's orbs, and hit sparks. Everything is
// simple additive geometry so a 12-hero brawl stays cheap.
(function (G) {
  const T = THREE;
  const TEAMC = [new T.Color(0x56c8ff), new T.Color(0xff5a5a)];

  function hexTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#fff'; g.lineWidth = 3;
    const r = 18, h = r * Math.sqrt(3);
    for (let y = -1; y < 9; y++) for (let x = -1; x < 10; x++) {
      const cx = x * r * 1.5, cy = y * h + (x % 2 ? h / 2 : 0);
      g.beginPath();
      for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI * 2; g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      g.stroke();
    }
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }

  function glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    return new T.CanvasTexture(c);
  }

  const HEX = hexTexture(), GLOW = glowTexture();

  function shieldMat(color, rep = [6, 2]) {
    return new T.ShaderMaterial({
      uniforms: { color: { value: color.clone() }, opacity: { value: 1 }, hex: { value: HEX }, rep: { value: new T.Vector2(...rep) }, flash: { value: 0 }, time: { value: 0 } },
      vertexShader: `varying vec3 vN; varying vec3 vV; varying vec2 vUv;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vUv = uv; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 color; uniform float opacity; uniform sampler2D hex; uniform vec2 rep; uniform float flash; uniform float time; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
        void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
          float h = texture2D(hex, vUv * rep + vec2(0.0, time * 0.05)).r;
          float edge = smoothstep(0.92, 1.0, max(abs(vUv.x - 0.5) * 2.0, vUv.y));
          float a = (0.10 + f * 0.45 + h * 0.22 + edge * 0.5 + flash * 0.4) * opacity;
          gl_FragColor = vec4(color * (0.6 + h * 0.6 + flash), a); }`,
      transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    });
  }

  const add = (color, opacity = 1) => new T.MeshBasicMaterial({ color, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false });
  const SPHERE = new T.SphereGeometry(1, 20, 14), SMALL = new T.SphereGeometry(1, 8, 6), RING = new T.RingGeometry(0.92, 1, 48), CONE = new T.ConeGeometry(0.5, 1, 5);

  class FX {
    constructor(game) {
      this.g = game;
      this.scene = game.world.scene;
      this.items = [];        // { obj, life, max, update(dt, k) }
      this.proj = new Map();
      this.unitFx = new Map();
      this.shakeAmt = 0;
    }

    spawn(obj, life, update) {
      this.scene.add(obj);
      const it = { obj, life, max: life, update };
      this.items.push(it);
      return it;
    }

    sprite(color, size, opacity = 1) {
      const m = new T.SpriteMaterial({ map: GLOW, color, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false });
      const s = new T.Sprite(m);
      s.scale.setScalar(size);
      return s;
    }

    // per-unit persistent effects (barriers, bubbles, orbs, auras)
    forUnit(u) {
      let f = this.unitFx.get(u);
      if (f) return f;
      f = {};
      const team = TEAMC[u.team === this.g.blue ? 0 : 1];
      if (u.barrier) {
        const s = u.barrier.spec, arc = s.halfArc * 2;
        const geo = new T.CylinderGeometry(s.radius, s.radius, s.height, 24, 1, true, -s.halfArc, arc);
        geo.translate(0, s.height / 2 - 0.2, 0);
        f.barrier = new T.Mesh(geo, shieldMat(team, u.hero === 'reinhardt' ? [7, 3] : [3, 2]));
        f.barrier.visible = false;
        this.scene.add(f.barrier);
      }
      f.bubble = new T.Mesh(SPHERE, shieldMat(new T.Color(0x7fb8ff), [8, 6]));
      f.bubble.visible = false;
      this.scene.add(f.bubble);
      f.temp = new T.Mesh(SPHERE, shieldMat(new T.Color(0x59ffd8), [10, 6]));
      f.temp.visible = false;
      this.scene.add(f.temp);
      if (u.hero === 'zenyatta') {
        f.harm = this.sprite(0xffe36a, 0.55); f.harm.visible = false;
        f.disc = this.sprite(0xb05cff, 0.55); f.disc.visible = false;
        f.transRing = new T.Mesh(RING, add(0xffd36a, 0.5)); f.transRing.rotation.x = -Math.PI / 2; f.transRing.visible = false;
        f.transGlow = this.sprite(0xffcf60, 4, 0.6); f.transGlow.visible = false;
        this.scene.add(f.harm, f.disc, f.transRing, f.transGlow);
      }
      if (u.hero === 'lucio') {
        f.aura = new T.Mesh(RING, add(0x8dff5a, 0.35)); f.aura.rotation.x = -Math.PI / 2;
        this.scene.add(f.aura);
      }
      if (u.hero === 'zarya') {
        f.beam = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 1, 6, 1, true), add(0xff6ad5, 0.9));
        f.beamCore = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 1, 8, 1, true), add(0xb74dff, 0.35));
        f.beam.visible = f.beamCore.visible = false;
        this.scene.add(f.beam, f.beamCore);
      }
      if (u.hero === 'dva') {
        f.matrix = new T.Mesh(new T.ConeGeometry(2.8, 10, 24, 1, true), add(0x9cffb0, 0.12));
        f.matrix.geometry.translate(0, -5, 0);
        f.matrix.geometry.rotateX(-Math.PI / 2);
        f.matrix.visible = false;
        this.scene.add(f.matrix);
      }
      if (u.hero === 'brigitte') {
        f.rally = new T.Mesh(RING, add(0xffa040, 0.45)); f.rally.rotation.x = -Math.PI / 2; f.rally.visible = false;
        this.scene.add(f.rally);
      }
      this.unitFx.set(u, f);
      return f;
    }

    update(dt) {
      const g = this.g, t = g.time;
      // per-unit
      for (const u of g.units) {
        const f = this.forUnit(u);
        if (f.barrier) {
          const b = u.barrier;
          f.barrier.visible = b.up && u.alive;
          if (f.barrier.visible) {
            f.barrier.position.copy(u.pos);
            f.barrier.rotation.y = u.yaw;
            const m = f.barrier.material.uniforms;
            m.opacity.value = 0.55 + 0.45 * (b.hp / b.maxHp) + (b.hp / b.maxHp < 0.25 ? Math.sin(t * 30) * 0.2 : 0);
            m.flash.value = Math.max(0, 1 - (t - b.lastHit) * 5);
            m.time.value = t;
          }
        }
        const bub = u.st.bubble && u.st.bubble.until > t && u.alive;
        f.bubble.visible = !!bub;
        if (bub) {
          f.bubble.position.copy(u.center(f.bubble.position));
          f.bubble.scale.setScalar(Math.max(1.0, u.height * 0.62));
          f.bubble.material.uniforms.time.value = t;
          f.bubble.material.uniforms.flash.value = Math.max(0, (f.bubble.userData.hit || 0) - t) * 4;
        }
        f.temp.visible = u.alive && (u.temp > 1 || u.tempArmor > 1);
        if (f.temp.visible) {
          const m = f.temp.material.uniforms;
          m.color.value.set(u.temp > 1 ? 0x59ffd8 : 0xffb340);
          m.opacity.value = u.temp > 1 ? 0.35 + 0.4 * Math.min(1, u.temp / 750) : 0.25;
          m.time.value = t;
          f.temp.position.copy(u.center(f.temp.position));
          f.temp.scale.setScalar(u.height * 0.52);
        }
        if (f.harm) {
          const h = u.alive && u.harmonyT, d = u.alive && u.discordT;
          f.harm.visible = !!h; f.disc.visible = !!d;
          if (h) f.harm.position.set(h.pos.x + Math.sin(t * 3) * 0.3, h.pos.y + h.height + 0.35, h.pos.z + Math.cos(t * 3) * 0.3);
          if (d) f.disc.position.set(d.pos.x + Math.sin(t * 3) * 0.3, d.pos.y + d.height + 0.35, d.pos.z + Math.cos(t * 3) * 0.3);
          const tr = u.alive && u.has('trans');
          f.transRing.visible = f.transGlow.visible = tr;
          if (tr) {
            f.transRing.position.set(u.pos.x, u.pos.y + 0.08, u.pos.z);
            f.transRing.scale.setScalar(G.HEROES.zenyatta.trans.radius);
            f.transGlow.position.copy(u.center(f.transGlow.position));
          }
        }
        if (f.aura) {
          f.aura.visible = u.alive;
          f.aura.position.set(u.pos.x, u.pos.y + 0.06, u.pos.z);
          const amp = u.has('amp');
          f.aura.scale.setScalar(1.2 + (amp ? Math.sin(t * 12) * 0.15 : Math.sin(t * 4) * 0.08));
          f.aura.material.color.set(u.song === 'heal' ? 0x7dff5a : 0xffe04a);
          f.aura.material.opacity = amp ? 0.7 : 0.3;
        }
        if (f.beam) {
          const on = u.alive && u.beamTo && u.st.beaming > t;
          f.beam.visible = f.beamCore.visible = !!on;
          if (on) {
            const a = u.eye(new T.Vector3()).add(new T.Vector3(0, -0.35, 0)).addScaledVector(u.fwd(new T.Vector3()), 0.6);
            for (const m of [f.beam, f.beamCore]) this.stretch(m, a, u.beamTo);
            f.beamCore.scale.x = f.beamCore.scale.z = 1 + (u.energy || 0) / 60 + Math.sin(t * 50) * 0.15;
          }
        }
        if (f.matrix) {
          const on = u.alive && u.mech && u.st.matrix > t;
          f.matrix.visible = !!on;
          if (on) {
            f.matrix.position.copy(u.eye(f.matrix.position));
            f.matrix.lookAt(u.eye(new T.Vector3()).add(u.aimDir(new T.Vector3())));
          }
        }
        if (f.rally) {
          const on = u.alive && u.has('rally');
          f.rally.visible = on;
          if (on) { f.rally.position.set(u.pos.x, u.pos.y + 0.07, u.pos.z); f.rally.scale.setScalar(G.HEROES.brigitte.rally.radius * (0.95 + Math.sin(t * 3) * 0.05)); }
        }
      }
      // projectiles
      for (const [p, o] of this.proj) {
        if (p.dead) { this.scene.remove(o); this.proj.delete(p); continue; }
        o.position.copy(p.pos);
        if (p.kind === 'fireStrike') o.rotation.y = Math.atan2(p.vel.x, p.vel.z);
      }
      // transient
      for (const it of this.items) {
        it.life -= dt;
        const k = 1 - Math.max(0, it.life) / it.max;
        if (it.update) it.update(dt, k, it);
      }
      for (const it of this.items) if (it.life <= 0) { this.scene.remove(it.obj); if (it.dispose) it.dispose(); }
      this.items = this.items.filter((it) => it.life > 0);
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2);
    }

    stretch(m, a, b) {
      const d = a.distanceTo(b);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.scale.y = d;
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    }

    // ---------------------------------------------------------------- one-shots
    projectile(p) {
      let o;
      if (p.kind === 'fireStrike') {
        o = new T.Group();
        const arc = new T.Mesh(new T.TorusGeometry(0.9, 0.18, 6, 16, Math.PI), add(0xff8a20, 0.9));
        arc.rotation.x = Math.PI / 2;
        arc.rotation.z = Math.PI;
        o.add(arc, this.sprite(0xff6a10, 2.4, 0.8));
      } else if (p.kind === 'grav') {
        o = new T.Group();
        const core = new T.Mesh(SMALL, new T.MeshBasicMaterial({ color: 0x1a0030 }));
        core.scale.setScalar(0.3);
        o.add(core, this.sprite(0xa04dff, 1.4));
      } else {
        o = this.sprite(p.color || 0xffffff, p.kind === 'orb' ? 0.7 : p.kind === 'zaryaAlt' ? 0.9 : 0.45);
      }
      o.position.copy(p.pos);
      this.scene.add(o);
      this.proj.set(p, o);
    }

    impact(p, color, size = 0.4) {
      const s = this.sprite(color, size);
      s.position.copy(p);
      this.spawn(s, 0.18, (dt, k) => { s.scale.setScalar(size * (1 + k * 1.5)); s.material.opacity = 1 - k; });
    }

    burst(p, color, radius) {
      const m = new T.Mesh(SPHERE, add(color, 0.5));
      m.position.copy(p);
      this.spawn(m, 0.35, (dt, k) => { m.scale.setScalar(0.2 + radius * k); m.material.opacity = 0.5 * (1 - k); });
    }

    tracer(u, target, color, n = 1) {
      const a = u.eye(new T.Vector3()).add(new T.Vector3(0, -0.3, 0)).addScaledVector(u.fwd(new T.Vector3()), 0.8);
      for (let i = 0; i < n; i++) {
        const b = target.center(new T.Vector3()).add(new T.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1, (Math.random() - 0.5) * 1.2));
        const geo = new T.BufferGeometry().setFromPoints([a, b]);
        const l = new T.Line(geo, new T.LineBasicMaterial({ color, transparent: true, opacity: 0.8, blending: T.AdditiveBlending }));
        const it = this.spawn(l, 0.06, (dt, k) => { l.material.opacity = 0.8 * (1 - k); });
        it.dispose = () => geo.dispose();
      }
    }

    matrixEat(d, p) { this.impact(p, 0x9cffb0, 0.5); }
    bubble(u) { const f = this.forUnit(u); f.bubble.userData.hit = this.g.time + 0.1; }
    bubbleHit(u) { const f = this.forUnit(u); f.bubble.userData.hit = this.g.time + 0.12; }
    bubblePop(u) { this.burst(u.center(new T.Vector3()), 0x7fb8ff, u.height * 0.8); this.g.audio.play('pop', u.pos); }

    grav(field) {
      const grp = new T.Group();
      const core = new T.Mesh(SPHERE, new T.MeshBasicMaterial({ color: 0x0a0014 }));
      core.scale.setScalar(0.55);
      const halo = new T.Mesh(SPHERE, shieldMat(new T.Color(0xa04dff), [6, 4]));
      const glow = this.sprite(0xb060ff, 3.5, 0.9);
      const n = 260, pos = new Float32Array(n * 3), seeds = [];
      for (let i = 0; i < n; i++) seeds.push([Math.random() * 6.28, Math.random() * 6.28, 0.5 + Math.random() * 5.5, 0.6 + Math.random() * 1.6]);
      const pg = new T.BufferGeometry();
      pg.setAttribute('position', new T.BufferAttribute(pos, 3));
      const pts = new T.Points(pg, new T.PointsMaterial({ color: 0xc58aff, size: 0.12, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      grp.add(core, halo, glow, pts);
      grp.position.copy(field.pos);
      const R = G.HEROES.zarya.grav.radius, dur = G.HEROES.zarya.grav.dur;
      const it = this.spawn(grp, dur, (dt, k) => {
        const tt = this.g.time;
        halo.scale.setScalar(R * (k < 0.06 ? k / 0.06 : 1) * (0.95 + Math.sin(tt * 6) * 0.03));
        halo.material.uniforms.time.value = tt * 4;
        halo.material.uniforms.opacity.value = 0.6 * (1 - Math.max(0, k - 0.85) / 0.15);
        for (let i = 0; i < n; i++) {
          const s = seeds[i], r = ((s[2] - tt * s[3] * 2) % R + R) % R;
          const a = s[0] + tt * s[3] * 2, b = s[1];
          pos[i * 3] = Math.cos(a) * Math.sin(b) * r; pos[i * 3 + 1] = Math.cos(b) * r * 0.7; pos[i * 3 + 2] = Math.sin(a) * Math.sin(b) * r;
        }
        pg.attributes.position.needsUpdate = true;
      });
      it.dispose = () => pg.dispose();
    }

    bomb(b) {
      const mech = this.g.makeRig('dva_mech');
      mech.setTint(new T.Color(1, 0.4, 0.75), 0.4);
      const grp = new T.Group();
      grp.add(mech.root);
      const glow = this.sprite(0xff5ab0, 3.5, 0.8);
      glow.position.y = 1.2;
      grp.add(glow);
      const ring = new T.Mesh(RING, add(0xff3a8a, 0.6));
      ring.rotation.x = -Math.PI / 2;
      this.scene.add(ring);
      mech.root.rotation.y = b.owner.yaw;
      this.spawn(grp, G.HEROES.dva.bomb.fuse, (dt, k) => {
        grp.position.set(b.pos.x, b.pos.y - 0.9, b.pos.z);
        const beep = Math.sin(this.g.time * (8 + k * 30)) > 0;
        glow.material.opacity = beep ? 1 : 0.4;
        glow.scale.setScalar(3 + k * 3);
        mech.setTint(new T.Color(1, 0.3, 0.7), 0.3 + k * 0.6);
        ring.position.set(b.pos.x, b.pos.y - 0.85, b.pos.z);
        ring.scale.setScalar(G.HEROES.dva.bomb.radius * k);
        if (k > 0.98) this.scene.remove(ring);
      });
    }

    explosion(p, radius) {
      const s = new T.Mesh(SPHERE, add(0xff7ad0, 0.8));
      s.position.copy(p);
      this.spawn(s, 0.8, (dt, k) => { s.scale.setScalar(radius * Math.sqrt(k)); s.material.opacity = 0.8 * (1 - k); });
      const flash = this.sprite(0xffffff, radius * 1.5, 1);
      flash.position.copy(p);
      this.spawn(flash, 0.4, (dt, k) => { flash.material.opacity = 1 - k; });
      const ring = new T.Mesh(RING, add(0xffb0e0, 0.8));
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(p).y -= 0.8;
      this.spawn(ring, 0.7, (dt, k) => { ring.scale.setScalar(radius * 1.2 * k); ring.material.opacity = 0.8 * (1 - k); });
      this.shake(null, 1.0);
    }

    shatter(u, range, half) {
      const n = 26, yaw = u.yaw, rocks = [];
      const grp = new T.Group();
      for (let i = 0; i < n; i++) {
        const d = 1.5 + (i / n) * range, sp = (Math.random() - 0.5) * 2 * (half * d + 0.8);
        const x = u.pos.x + Math.sin(yaw) * d + Math.cos(yaw) * sp, z = u.pos.z + Math.cos(yaw) * d - Math.sin(yaw) * sp;
        const gy = this.g.world.groundAt(x, z, u.pos.y + 1.5);
        const rock = new T.Mesh(CONE, new T.MeshLambertMaterial({ color: 0x8a7a68 }));
        rock.position.set(x, (isNaN(gy) ? u.pos.y : gy) - 0.6, z);
        rock.rotation.set((Math.random() - 0.5) * 0.6, Math.random() * 6, (Math.random() - 0.5) * 0.6);
        rock.userData = { delay: d / range * 0.35, h: 0.8 + Math.random() * 1.2 };
        rock.scale.set(0.7, 0.01, 0.7);
        grp.add(rock); rocks.push(rock);
      }
      const it = this.spawn(grp, 1.8, (dt, k) => {
        const tt = k * 1.8;
        for (const r of rocks) {
          const a = Math.max(0, Math.min(1, (tt - r.userData.delay) / 0.12));
          const fade = Math.max(0, (tt - 1.2) / 0.6);
          r.scale.y = r.userData.h * a * (1 - fade);
        }
      });
      it.dispose = () => rocks.forEach((r) => r.material.dispose());
      const wave = new T.Mesh(new T.RingGeometry(0.9, 1, 32, 1, -half + Math.PI / 2, half * 2), add(0xffc070, 0.6));
      wave.rotation.set(-Math.PI / 2, 0, 0);
      const wgrp = new T.Group(); wgrp.add(wave);
      wgrp.position.set(u.pos.x, u.pos.y + 0.15, u.pos.z);
      wgrp.rotation.y = yaw + Math.PI;
      wave.rotation.z = Math.PI;
      this.spawn(wgrp, 0.5, (dt, k) => { wave.scale.setScalar(range * k); wave.material.opacity = 0.7 * (1 - k); });
      this.shake(u, 0.9);
    }

    slam(p, wall) { this.burst(p.clone().add(new T.Vector3(0, 1, 0)), 0xffd8a0, wall ? 2.5 : 1.5); }

    wave(u) {
      const r = new T.Mesh(RING, add(0x9cff5a, 0.7));
      const grp = new T.Group(); grp.add(r);
      grp.position.copy(u.eye(new T.Vector3()));
      grp.rotation.y = u.yaw;
      this.spawn(grp, 0.3, (dt, k) => { r.position.z = k * 4; r.scale.setScalar(0.5 + k * 3); r.material.opacity = 0.7 * (1 - k); });
    }

    beat(u, saved) {
      const s = new T.Mesh(SPHERE, add(0x59ffd8, 0.5));
      s.position.copy(u.center(new T.Vector3()));
      this.spawn(s, 0.8, (dt, k) => { s.scale.setScalar(2 + 28 * k); s.material.opacity = 0.5 * (1 - k); });
      const rise = this.sprite(0x9cfff0, 5, 1);
      rise.position.copy(u.center(new T.Vector3())).y += 3;
      this.spawn(rise, 0.9, (dt, k) => { rise.position.y = u.pos.y + 3 + k * 3; rise.material.opacity = 1 - k; });
    }

    trans(u) { this.burst(u.center(new T.Vector3()), 0xffd36a, 4); }
    rally(u) { this.burst(u.center(new T.Vector3()), 0xffa040, 4); }

    whip(u, to) {
      const a = u.eye(new T.Vector3()).add(new T.Vector3(0, -0.4, 0));
      const geo = new T.BufferGeometry().setFromPoints([a, to]);
      const l = new T.Line(geo, new T.LineBasicMaterial({ color: 0xffc070, transparent: true, opacity: 1 }));
      const it = this.spawn(l, 0.25, (dt, k) => { l.material.opacity = 1 - k; });
      it.dispose = () => geo.dispose();
    }

    pack(u, ally) {
      const s = this.sprite(0x7dff7d, 0.6);
      const a = u.eye(new T.Vector3());
      this.spawn(s, 0.3, (dt, k) => {
        const b = ally.center(new T.Vector3());
        s.position.lerpVectors(a, b, k).y += Math.sin(k * Math.PI) * 1.2;
        if (k > 0.95) this.burst(b, 0x7dff7d, 1);
      });
    }

    shake(u, amt) { if (!u || u.isPlayer) this.shakeAmt = Math.max(this.shakeAmt, amt); }
  }

  G.FX = FX;
  G.TEAMC = TEAMC;
})(window.G = window.G || {});

// The game's own models, drawn with three.js on a transparent layer between the 2D scene's ground and its effects:
// the current job's character (skinned, playing the game's animations for each action) with its weapons on their
// bones, and a housing striking dummy. Data comes from work/game-models.js (tools/export_models.py); without it,
// without three.js, or for a job it has no character for, the scene keeps drawing its own figures.
(function (B) {
  const FADE = 0.18;
  const ELEMENT_LIGHT = { fire: 0xff7a30, ice: 0x6cc6ff, thunder: 0xc8a0ff, iai: 0xffd890, none: 0xd8a8ff };

  class ModelLayer {
    constructor(canvas, engine, scene, settings) {
      this.canvas = canvas;
      this.e = engine;
      this.sc = scene;
      this.settings = settings;
      this.ch = null;
      this.ok = !!(window.THREE && B.GAME_MODELS && B.GAME_MODELS.jobs);
      if (this.ok) {
        try { this.build(); } catch (err) { console.error('Game models failed to load:', err); this.ok = false; }
      }
      this.canvas.style.display = this.active() ? '' : 'none';
    }

    active() { return this.ok && this.settings.gameModels !== false && !!this.ch; }

    // Show the current job's character, building it the first time.
    setJob() {
      if (!this.ok) return;
      const id = B.jobId, G = B.GAME_MODELS;
      if (this.ch) this.ch.group.visible = false;
      this.ch = null;
      if (G.jobs[id]) {
        try {
          this.chars[id] = this.chars[id] || this.buildCharacter(G.jobs[id]);
          this.ch = this.chars[id];
          this.ch.group.visible = true;
          this.play(this.ch.anims.basic.idle, true);
        } catch (err) { console.error(`Game model for ${id} failed to load:`, err); }
      }
      this.setEnabled();
    }

    setEnabled() {
      this.canvas.style.display = this.active() ? '' : 'none';
      if (this.ok) this.showDummy(this.settings.dummy);
    }

    view(spec) {
      const [kind, off, n] = spec;
      const C = { f32: Float32Array, i16: Int16Array, u16: Uint16Array, u32: Uint32Array, u8: Uint8Array }[kind];
      return new C(this.buf, off, n);
    }

    // ---------- building ----------
    build() {
      const T = THREE, G = B.GAME_MODELS;
      const bin = atob(G.bin), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      this.buf = bytes.buffer;

      this.renderer = new T.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.outputEncoding = T.sRGBEncoding;
      this.scene3 = new T.Scene();
      this.camera = new T.PerspectiveCamera(55, 1, 0.1, 300);

      // Dusk: cool moonlight from behind the camera, violet sky fill, a warm bounce from the lanterns.
      this.scene3.add(new T.HemisphereLight(0x9c8fd0, 0x2e3a26, 0.85));
      this.key = new T.DirectionalLight(0xdfe4ff, 1.15);
      this.scene3.add(this.key, this.key.target);
      this.warm = new T.DirectionalLight(0xffb27a, 0.45);
      this.scene3.add(this.warm, this.warm.target);
      this.castLight = new T.PointLight(0xff7a30, 0, 6, 2);
      this.scene3.add(this.castLight);

      this.texLoader = new T.TextureLoader();
      this.textures = {};
      this.chars = {};
      this.dummies = {};
      for (const [k, d] of Object.entries(G.dummies)) {
        const grp = new T.Group();
        const mats = d.materials.map((m) => this.material(m, false));
        for (const me of d.meshes) grp.add(new T.Mesh(this.geometry(me, false), mats[me.material]));
        grp.visible = false;
        grp.userData.mats = mats;
        this.scene3.add(grp);
        this.dummies[k] = grp;
      }
      this.showDummy(this.settings.dummy);
      this.tipWorld = new T.Vector3();
      this.wire();
      this.setJob();
    }

    // Textures are shared between materials and characters (G.textures holds each once).
    texture(index, srgb) {
      const key = index + (srgb ? 's' : 'l');
      if (this.textures[key]) return this.textures[key];
      const t = this.texLoader.load(B.GAME_MODELS.textures[index]);
      t.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      return (this.textures[key] = t);
    }

    material(m, skinning) {
      const T = THREE;
      const mat = new T.MeshStandardMaterial({
        map: this.texture(m.color, true), roughness: 0.78, metalness: 0, skinning,
        side: m.doubleSided ? T.DoubleSide : T.FrontSide,
      });
      if (m.normal !== null && m.normal !== undefined) { mat.normalMap = this.texture(m.normal, false); mat.normalScale = new T.Vector2(1, -1); }
      if (m.alpha) {              // as PMP Viewer's preview treats the game's alpha
        if (m.transparent) { mat.transparent = true; mat.depthWrite = !m.alphaTest; mat.alphaTest = Math.min(m.alphaTest || 0.02, 0.5); }
        else mat.alphaTest = m.alphaTest > 0 ? m.alphaTest : 0.5;
      }
      return mat;
    }

    geometry(me, skinned) {
      const T = THREE, g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(this.view(me.pos), 3));
      g.setAttribute('normal', new T.BufferAttribute(this.view(me.nrm), 3, true));
      g.setAttribute('uv', new T.BufferAttribute(this.view(me.uv), 2));
      if (skinned) {
        g.setAttribute('skinIndex', new T.BufferAttribute(this.view(me.skinIndex), 4));
        g.setAttribute('skinWeight', new T.BufferAttribute(this.view(me.skinWeight), 4, true));
      }
      g.setIndex(new T.BufferAttribute(this.view(me.idx), 1));
      return g;
    }

    buildCharacter(J) {
      const T = THREE, sk = J.skeleton;
      const ch = { group: new T.Group(), anims: J.anims, cur: null, prev: null, after: null, fade0: 0 };
      this.scene3.add(ch.group);
      const world = sk.world.map((w) => new T.Matrix4().fromArray(w));
      const inv = world.map((m) => m.clone().invert());
      ch.nb = sk.names.length;
      ch.boneIndex = Object.fromEntries(sk.names.map((n, i) => [n, i]));
      ch.bones = sk.names.map((n) => { const b = new T.Bone(); b.name = n; return b; });
      ch.bindP = new Float32Array(ch.nb * 3);
      ch.bindQ = new Float32Array(ch.nb * 4);
      sk.parents.forEach((p, i) => {
        const local = p >= 0 ? inv[p].clone().multiply(world[i]) : world[i].clone();
        const pos = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
        local.decompose(pos, q, s);
        ch.bones[i].position.copy(pos); ch.bones[i].quaternion.copy(q); ch.bones[i].scale.copy(s);
        ch.bindP.set([pos.x, pos.y, pos.z], i * 3);
        ch.bindQ.set([q.x, q.y, q.z, q.w], i * 4);
        (p >= 0 ? ch.bones[p] : ch.group).add(ch.bones[i]);
      });
      ch.skeleton = new T.Skeleton(ch.bones, inv);
      const mats = J.materials.map((m) => this.material(m, true));
      for (const me of J.meshes) {
        const mesh = new T.SkinnedMesh(this.geometry(me, true), mats[me.material]);
        mesh.frustumCulled = false;
        ch.group.add(mesh);
        mesh.bind(ch.skeleton, new T.Matrix4());
      }
      // Weapons ride their bones (the staff or katana in the right hand, the scabbard at the left hip).
      ch.weapons = J.weapons.map((w) => {
        const grp = new T.Group();
        const wm = w.materials.map((m) => this.material(m, false));
        for (const me of w.meshes) {
          const mesh = new T.Mesh(this.geometry(me, false), wm[me.material]);
          mesh.frustumCulled = false;
          grp.add(mesh);
        }
        const bone = ch.bones[ch.boneIndex[w.bone]];
        (bone || ch.group).add(grp);
        return { label: w.label, group: grp, tip: new T.Vector3(...w.tip) };
      });
      ch.poseA = { p: new Float32Array(ch.nb * 3), q: new Float32Array(ch.nb * 4) };
      ch.poseB = { p: new Float32Array(ch.nb * 3), q: new Float32Array(ch.nb * 4) };
      ch.facing = Math.atan2(-this.e.pos.x, -this.e.pos.z);
      ch.lastPos = { x: this.e.pos.x, z: this.e.pos.z };
      ch.group.visible = false;
      return ch;
    }

    showDummy(key) {
      if (!this.dummies) return;
      const keys = Object.keys(this.dummies);
      const pick = this.dummies[key] ? key : keys[0];
      for (const k of keys) this.dummies[k].visible = k === pick;
      this.dummy = this.dummies[pick];
    }

    // ---------- animation ----------
    // Each track stores its translation then its rotation (x, y, z; w >= 0 is rebuilt), every frame or once when
    // it doesn't change.
    prep(a) {
      if (a._prep) return a;
      const d = this.view(a.data), tracks = [];
      let off = 0;
      a.tracks.forEach((name, k) => {
        const tc = !!a.tConst[k], qc = !!a.qConst[k];
        const tOff = off; off += (tc ? 1 : a.frames) * 3;
        const qOff = off; off += (qc ? 1 : a.frames) * 3;
        tracks.push({ name, tOff, tc, qOff, qc });
      });
      a._prep = { d, tracks, bones: new WeakMap() };
      return a;
    }

    // Bone indices for an animation's tracks on this character (animations are shared between jobs).
    trackBones(a, ch) {
      let bi = a._prep.bones.get(ch);
      if (!bi) {
        bi = a._prep.tracks.map((tr) => ch.boneIndex[tr.name] ?? -1);
        a._prep.bones.set(ch, bi);
      }
      return bi;
    }

    play(anim, loop, after) {
      const ch = this.ch;
      if (!anim || !ch) return;
      if (ch.cur && ch.cur.anim === anim && loop && ch.cur.loop) return;
      ch.prev = ch.cur;
      ch.cur = { anim: this.prep(anim), t0: this.e.now, loop };
      ch.fade0 = this.e.now;
      ch.after = after || null;
    }

    sample(state, pose) {
      const ch = this.ch;
      pose.p.set(ch.bindP);
      pose.q.set(ch.bindQ);
      const a = state.anim, { d, tracks } = a._prep, ts = a.tScale, qs = 1 / 32767;
      const bis = this.trackBones(a, ch);
      const t = Math.max(0, this.e.now - state.t0);
      let f = t * a.fps, i0, i1, u;
      if (state.loop) {
        f %= a.frames; i0 = Math.floor(f); i1 = (i0 + 1) % a.frames; u = f - i0;
      } else {
        f = Math.min(f, a.frames - 1); i0 = Math.floor(f); i1 = Math.min(i0 + 1, a.frames - 1); u = f - i0;
      }
      const W = (x, y, z) => Math.sqrt(Math.max(0, 1 - x * x - y * y - z * z));
      tracks.forEach((tr, k) => {
        const bi = bis[k];
        if (bi < 0) return;
        const pi = bi * 3, qi = bi * 4;
        const t0 = tr.tOff + (tr.tc ? 0 : i0 * 3), t1 = tr.tOff + (tr.tc ? 0 : i1 * 3);
        for (let c = 0; c < 3; c++) pose.p[pi + c] = (d[t0 + c] + (d[t1 + c] - d[t0 + c]) * u) * ts;
        const q0 = tr.qOff + (tr.qc ? 0 : i0 * 3), q1 = tr.qOff + (tr.qc ? 0 : i1 * 3);
        const x0 = d[q0] * qs, y0 = d[q0 + 1] * qs, z0 = d[q0 + 2] * qs, w0 = W(x0, y0, z0);
        let x1 = d[q1] * qs, y1 = d[q1 + 1] * qs, z1 = d[q1 + 2] * qs, w1 = W(x1, y1, z1);
        if (x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1 < 0) { x1 = -x1; y1 = -y1; z1 = -z1; w1 = -w1; }
        const x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u, z = z0 + (z1 - z0) * u, w = w0 + (w1 - w0) * u;
        const l = Math.hypot(x, y, z, w) || 1;
        pose.q[qi] = x / l; pose.q[qi + 1] = y / l; pose.q[qi + 2] = z / l; pose.q[qi + 3] = w / l;
      });
    }

    applyPose() {
      const ch = this.ch, A = ch.poseA, Bp = ch.poseB;
      this.sample(ch.cur, Bp);
      let w = 1;
      if (ch.prev && this.e.now - ch.fade0 < FADE) {
        this.sample(ch.prev, A);
        w = (this.e.now - ch.fade0) / FADE;
      }
      for (let i = 0; i < ch.nb; i++) {
        const b = ch.bones[i], pi = i * 3, qi = i * 4;
        if (w < 1) {
          b.position.set(A.p[pi] + (Bp.p[pi] - A.p[pi]) * w, A.p[pi + 1] + (Bp.p[pi + 1] - A.p[pi + 1]) * w, A.p[pi + 2] + (Bp.p[pi + 2] - A.p[pi + 2]) * w);
          let x1 = Bp.q[qi], y1 = Bp.q[qi + 1], z1 = Bp.q[qi + 2], w1 = Bp.q[qi + 3];
          const x0 = A.q[qi], y0 = A.q[qi + 1], z0 = A.q[qi + 2], w0 = A.q[qi + 3];
          if (x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1 < 0) { x1 = -x1; y1 = -y1; z1 = -z1; w1 = -w1; }
          b.quaternion.set(x0 + (x1 - x0) * w, y0 + (y1 - y0) * w, z0 + (z1 - z0) * w, w0 + (w1 - w0) * w).normalize();
        } else {
          b.position.set(Bp.p[pi], Bp.p[pi + 1], Bp.p[pi + 2]);
          b.quaternion.set(Bp.q[qi], Bp.q[qi + 1], Bp.q[qi + 2], Bp.q[qi + 3]);
        }
      }
    }

    actionAnims(id) { return (this.ch && this.ch.anims.actions && this.ch.anims.actions[id]) || {}; }

    wire() {
      const e = this.e;
      this.faceUntil = 0;
      e.on('use', () => { this.faceUntil = e.now + 0.8; });
      e.on('castStart', (ev) => {
        if (!this.ch) return;
        const a = this.actionAnims(ev.id);
        if (a.start) this.play(a.start, false, a.loop ? () => this.play(a.loop, true) : null);
        else if (a.loop) this.play(a.loop, true);
      });
      e.on('resolve', (ev) => {
        if (!this.ch) return;
        const kind = B.ACTIONS[ev.id].kind;
        const a = ev.id === 'tincture' ? { release: this.ch.anims.basic.item } : this.actionAnims(ev.id);
        if (!a.release) return;
        if (kind !== 'gcd' && e.moving) return;       // running keeps the run; the game layers this, we don't
        this.play(a.release, false);
      });
      e.on('interrupt', () => this.ch && this.play(this.ch.anims.basic.idle, true));
      e.on('reset', () => this.ch && this.play(this.ch.anims.basic.idle, true));
    }

    stateMachine() {
      const e = this.e, ch = this.ch, basic = ch.anims.basic;
      const cur = ch.cur;
      if (e.moving && !e.casting) {
        if (cur.anim !== basic.run) this.play(basic.run, true);
        return;
      }
      if (!e.moving && cur.anim === basic.run) { this.play(basic.idle, true); return; }
      if (!cur.loop && e.now - cur.t0 >= cur.anim.seconds) {
        if (ch.after) { const f = ch.after; ch.after = null; f(); }
        else this.play(e.casting ? (this.actionAnims(e.casting.id).loop || basic.idle) : basic.idle, true);
      }
    }

    // ---------- frame ----------
    resize(w, h, dpr) {
      if (!this.ok) return;
      this.renderer.setPixelRatio(Math.min(dpr, 1.5));
      this.renderer.setSize(w, h, false);
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
    }

    update(dt) {
      if (!this.active()) return;
      const e = this.e, sc = this.sc, ch = this.ch;

      // Facing, as in the game: with the right mouse button held you face the way the camera looks (and strafe
      // or backpedal); otherwise you turn to the way you run. Using an action turns you to the dummy, and
      // standing still keeps whatever way you were facing.
      const vx = e.pos.x - ch.lastPos.x, vz = e.pos.z - ch.lastPos.z;
      ch.lastPos.x = e.pos.x; ch.lastPos.z = e.pos.z;
      const toDummy = Math.atan2(-e.pos.x, -e.pos.z);
      const step = Math.hypot(vx, vz);
      let want = ch.facing, rate = 14;
      if (sc.mouselook) { want = sc.camYaw; rate = 30; }
      else if (e.moving && !e.casting && step > 1e-4) want = Math.atan2(vx, vz);
      else if (e.casting || e.now < this.faceUntil) want = toDummy;
      if (step > 1.5) want = toDummy;     // dashes and backsteps (Gyoten, Yaten) keep you facing the dummy
      let diff = want - ch.facing;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      ch.facing += diff * Math.min(1, dt * rate);
      ch.group.position.set(e.pos.x, sc.jumpY(), e.pos.z);
      ch.group.rotation.y = ch.facing;

      this.stateMachine();
      this.applyPose();

      // The dummy turns to face you and rocks when hit.
      if (this.dummy) {
        this.dummy.rotation.y = Math.atan2(e.pos.x, e.pos.z);
        this.dummy.rotation.x = Math.sin(sc.time * 28) * sc.dummyWobble * 0.035;
        const flash = sc.dummyFlash * 2.2;
        for (const m of this.dummy.userData.mats) m.emissive.setRGB(flash, flash, flash);
      }

      // A glow at the weapon while casting, in the spell's colour.
      ch.group.updateMatrixWorld(true);
      const w = ch.weapons[0];
      if (w) this.tipWorld.copy(w.tip).applyMatrix4(w.group.matrixWorld);
      else this.tipWorld.set(e.pos.x, 1.6, e.pos.z);
      const school = e.casting ? (B.ACTIONS[e.casting.id].school || 'none') : null;
      const target = school ? 2.2 : sc.release > 0 && e.job.role === 'caster' ? 1.2 : 0;
      this.castLight.intensity += (target - this.castLight.intensity) * Math.min(1, dt * 10);
      if (school) this.castLight.color.setHex(ELEMENT_LIGHT[school] || ELEMENT_LIGHT.none);
      this.castLight.position.copy(this.tipWorld);

      // Camera and lights follow the 2D scene's camera exactly.
      const c = sc.cam;
      this.camera.position.set(c.pos.x, c.pos.y, c.pos.z);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(c.look.x, c.look.y, c.look.z);
      this.camera.fov = 2 * Math.atan(sc.H / 2 / sc.F) * 180 / Math.PI;
      this.camera.aspect = sc.W / sc.H;
      this.camera.updateProjectionMatrix();
      this.key.position.set(c.pos.x - c.r.x * 4, c.pos.y + 6, c.pos.z - c.r.z * 4);
      this.key.target.position.set(e.pos.x, 1, e.pos.z);
      this.warm.position.set(c.pos.x + c.r.x * 6 + c.f.x * 20, 3, c.pos.z + c.r.z * 6 + c.f.z * 20);
      this.warm.target.position.set(e.pos.x, 1, e.pos.z);
      this.renderer.render(this.scene3, this.camera);
    }

    staffTip() { return { x: this.tipWorld.x, y: this.tipWorld.y, z: this.tipWorld.z }; }
  }

  B.ModelLayer = ModelLayer;
})(window.BLM);

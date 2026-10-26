// The game's own models, drawn with three.js on a transparent layer between the 2D scene's ground and its spell
// effects: the Black Mage (skinned, playing the game's animations for each action), the staff in his right hand,
// and a housing striking dummy. Data comes from work/game-models.js (tools/export_models.py); without it, or
// without three.js, the scene keeps drawing its own figures.
(function (B) {
  const FADE = 0.18;
  const ELEMENT_LIGHT = { fire: 0xff7a30, ice: 0x6cc6ff, thunder: 0xc8a0ff, none: 0xd8a8ff };

  class ModelLayer {
    constructor(canvas, engine, scene, settings) {
      this.canvas = canvas;
      this.e = engine;
      this.sc = scene;
      this.settings = settings;
      this.ok = !!(window.THREE && B.GAME_MODELS);
      if (this.ok) {
        try { this.build(); } catch (err) { console.error('Game models failed to load:', err); this.ok = false; }
      }
      this.canvas.style.display = this.active() ? '' : 'none';
    }

    active() { return this.ok && this.settings.gameModels !== false; }

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
      this.buildMage(G);
      this.buildStaff(G);
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

      this.anims = G.anims;
      this.cur = null; this.prev = null; this.after = null;
      this.poseA = { p: new Float32Array(this.nb * 3), q: new Float32Array(this.nb * 4) };
      this.poseB = { p: new Float32Array(this.nb * 3), q: new Float32Array(this.nb * 4) };
      this.facing = Math.atan2(-this.e.pos.x, -this.e.pos.z);
      this.lastPos = { x: this.e.pos.x, z: this.e.pos.z };
      this.play(this.anims.basic.idle, true);
      this.wire();
    }

    texture(url, srgb) {
      const t = this.texLoader.load(url);
      t.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      return t;
    }

    material(m, skinning) {
      const T = THREE;
      const mat = new T.MeshStandardMaterial({
        map: this.texture(m.color, true), roughness: 0.78, metalness: 0, skinning,
        side: m.doubleSided ? T.DoubleSide : T.FrontSide,
      });
      if (m.normal) { mat.normalMap = this.texture(m.normal, false); mat.normalScale = new T.Vector2(1, -1); }
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

    buildMage(G) {
      const T = THREE, sk = G.mage.skeleton;
      this.mage = new T.Group();
      this.scene3.add(this.mage);
      const world = sk.world.map((w) => new T.Matrix4().fromArray(w));
      const inv = world.map((m) => m.clone().invert());
      this.nb = sk.names.length;
      this.boneIndex = Object.fromEntries(sk.names.map((n, i) => [n, i]));
      this.bones = sk.names.map((n) => { const b = new T.Bone(); b.name = n; return b; });
      this.bindP = new Float32Array(this.nb * 3);
      this.bindQ = new Float32Array(this.nb * 4);
      sk.parents.forEach((p, i) => {
        const local = p >= 0 ? inv[p].clone().multiply(world[i]) : world[i].clone();
        const pos = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
        local.decompose(pos, q, s);
        this.bones[i].position.copy(pos); this.bones[i].quaternion.copy(q); this.bones[i].scale.copy(s);
        this.bindP.set([pos.x, pos.y, pos.z], i * 3);
        this.bindQ.set([q.x, q.y, q.z, q.w], i * 4);
        (p >= 0 ? this.bones[p] : this.mage).add(this.bones[i]);
      });
      this.skeleton = new T.Skeleton(this.bones, inv);
      const mats = G.mage.materials.map((m) => this.material(m, true));
      for (const me of G.mage.meshes) {
        const mesh = new T.SkinnedMesh(this.geometry(me, true), mats[me.material]);
        mesh.frustumCulled = false;
        this.mage.add(mesh);
        mesh.bind(this.skeleton, new T.Matrix4());
      }
    }

    buildStaff(G) {
      const T = THREE, s = G.staff;
      this.staff = new T.Group();
      const mats = s.materials.map((m) => this.material(m, false));
      for (const me of s.meshes) {
        const mesh = new T.Mesh(this.geometry(me, false), mats[me.material]);
        mesh.frustumCulled = false;
        this.staff.add(mesh);
      }
      const bone = this.bones[this.boneIndex[s.bone]];
      (bone || this.mage).add(this.staff);
      this.tipLocal = new T.Vector3(...s.tip);
      this.tipWorld = new T.Vector3();
    }

    showDummy(key) {
      if (!this.dummies) return;
      const keys = Object.keys(this.dummies);
      const pick = this.dummies[key] ? key : keys[0];
      for (const k of keys) this.dummies[k].visible = k === pick;
      this.dummy = this.dummies[pick];
    }

    // ---------- animation ----------
    prep(a) {
      if (a._prep) return a;
      const d = this.view(a.data), tracks = [];
      let off = 0;
      a.tracks.forEach((name, k) => {
        const c = a.const[k];
        tracks.push({ bi: this.boneIndex[name] ?? -1, off, c });
        off += (c ? 1 : a.frames) * 7;
      });
      a._prep = { d, tracks };
      return a;
    }

    play(anim, loop, after) {
      if (!anim) return;
      if (this.cur && this.cur.anim === anim && loop && this.cur.loop) return;
      this.prev = this.cur;
      this.cur = { anim: this.prep(anim), t0: this.e.now, loop };
      this.fade0 = this.e.now;
      this.after = after || null;
    }

    sample(state, pose) {
      pose.p.set(this.bindP);
      pose.q.set(this.bindQ);
      const a = state.anim, { d, tracks } = a._prep, ts = a.tScale;
      const t = Math.max(0, this.e.now - state.t0);
      let f = t * a.fps, i0, i1, u;
      if (state.loop) {
        f %= a.frames; i0 = Math.floor(f); i1 = (i0 + 1) % a.frames; u = f - i0;
      } else {
        f = Math.min(f, a.frames - 1); i0 = Math.floor(f); i1 = Math.min(i0 + 1, a.frames - 1); u = f - i0;
      }
      for (const tr of tracks) {
        if (tr.bi < 0) continue;
        const o0 = tr.off + (tr.c ? 0 : i0 * 7), o1 = tr.off + (tr.c ? 0 : i1 * 7);
        const pi = tr.bi * 3, qi = tr.bi * 4;
        for (let k = 0; k < 3; k++) pose.p[pi + k] = (d[o0 + k] + (d[o1 + k] - d[o0 + k]) * u) * ts;
        let x0 = d[o0 + 3], y0 = d[o0 + 4], z0 = d[o0 + 5], w0 = d[o0 + 6];
        let x1 = d[o1 + 3], y1 = d[o1 + 4], z1 = d[o1 + 5], w1 = d[o1 + 6];
        if (x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1 < 0) { x1 = -x1; y1 = -y1; z1 = -z1; w1 = -w1; }
        const x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u, z = z0 + (z1 - z0) * u, w = w0 + (w1 - w0) * u;
        const l = Math.hypot(x, y, z, w) || 1;
        pose.q[qi] = x / l; pose.q[qi + 1] = y / l; pose.q[qi + 2] = z / l; pose.q[qi + 3] = w / l;
      }
    }

    applyPose() {
      const A = this.poseA, Bp = this.poseB;
      this.sample(this.cur, Bp);
      let w = 1;
      if (this.prev && this.e.now - this.fade0 < FADE) {
        this.sample(this.prev, A);
        w = (this.e.now - this.fade0) / FADE;
      }
      for (let i = 0; i < this.nb; i++) {
        const b = this.bones[i], pi = i * 3, qi = i * 4;
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

    actionAnims(id) { return (this.anims.actions && this.anims.actions[id]) || {}; }

    wire() {
      const e = this.e;
      e.on('castStart', (ev) => {
        const a = this.actionAnims(ev.id);
        if (a.start) this.play(a.start, false, a.loop ? () => this.play(a.loop, true) : null);
        else if (a.loop) this.play(a.loop, true);
      });
      e.on('resolve', (ev) => {
        const kind = B.ACTIONS[ev.id].kind;
        const a = ev.id === 'tincture' ? { release: this.anims.basic.item } : this.actionAnims(ev.id);
        if (!a.release) return;
        if (kind !== 'gcd' && e.moving) return;       // running keeps the run; the game layers this, we don't
        this.play(a.release, false);
      });
      e.on('interrupt', () => this.play(this.anims.basic.idle, true));
      e.on('reset', () => this.play(this.anims.basic.idle, true));
    }

    stateMachine() {
      const e = this.e, basic = this.anims.basic;
      const cur = this.cur;
      if (e.moving && !e.casting) {
        if (cur.anim !== basic.run) this.play(basic.run, true);
        return;
      }
      if (!e.moving && cur.anim === basic.run) { this.play(basic.idle, true); return; }
      if (!cur.loop && e.now - cur.t0 >= cur.anim.seconds) {
        if (this.after) { const f = this.after; this.after = null; f(); }
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
      const e = this.e, sc = this.sc;

      // Face the way you run; face the dummy while casting or standing.
      const vx = e.pos.x - this.lastPos.x, vz = e.pos.z - this.lastPos.z;
      this.lastPos.x = e.pos.x; this.lastPos.z = e.pos.z;
      let want = Math.atan2(-e.pos.x, -e.pos.z);
      if (e.moving && !e.casting && Math.hypot(vx, vz) > 1e-4) want = Math.atan2(vx, vz);
      let diff = want - this.facing;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      this.facing += diff * Math.min(1, dt * 14);
      this.mage.position.set(e.pos.x, sc.jumpY(), e.pos.z);
      this.mage.rotation.y = this.facing;

      this.stateMachine();
      this.applyPose();

      // The dummy turns to face you and rocks when hit.
      if (this.dummy) {
        this.dummy.rotation.y = Math.atan2(e.pos.x, e.pos.z);
        this.dummy.rotation.x = Math.sin(sc.time * 28) * sc.dummyWobble * 0.035;
        const flash = sc.dummyFlash * 2.2;
        for (const m of this.dummy.userData.mats) m.emissive.setRGB(flash, flash, flash);
      }

      // A glow at the staff while casting, in the spell's colour.
      this.mage.updateMatrixWorld(true);
      this.tipWorld.copy(this.tipLocal).applyMatrix4(this.staff.matrixWorld);
      const school = e.casting ? (B.ACTIONS[e.casting.id].school || 'none') : null;
      const target = school ? 2.2 : sc.release > 0 ? 1.2 : 0;
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

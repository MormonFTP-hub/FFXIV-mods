// Procedural animation for the ripped Overwatch skeletons. The rips have no animations, but every hero
// uses Overwatch's shared bone ids (bone_0002 pelvis, bone_0011 head, bone_000D left upper arm, ...), so one
// bone map drives everyone. Poses are rotations in model space (x left, y up, z forward) applied on top of
// the rest pose; arms reach their weapon grips with two-bone IK; weapons are separate meshes placed at the
// hands every frame.
(function (G) {
  const T = THREE;
  const BONES = {
    hips: 'bone_0002', spine1: 'bone_0003', spine2: 'bone_0004', chest: 'bone_0005',
    neck: 'bone_0010', head: 'bone_0011',
    lClav: 'bone_0050', lUpper: 'bone_000D', lFore: 'bone_000E', lHand: 'bone_001C',
    rClav: 'bone_0035', rUpper: 'bone_0036', rFore: 'bone_0037', rHand: 'bone_003A',
    lThigh: 'bone_0055', lCalf: 'bone_0059', lFoot: 'bone_005A',
    rThigh: 'bone_005F', rCalf: 'bone_0063', rFoot: 'bone_0064',
  };
  const CHAIN = { lUpper: ['hips', 'spine1', 'spine2', 'chest', 'lClav'], rUpper: ['hips', 'spine1', 'spine2', 'chest', 'rClav'] };

  const X = new T.Vector3(1, 0, 0), Y = new T.Vector3(0, 1, 0), Z = new T.Vector3(0, 0, 1);
  const qa = (axis, a) => new T.Quaternion().setFromAxisAngle(axis, a);
  const tmpQ = new T.Quaternion(), tmpQ2 = new T.Quaternion(), tmpV = new T.Vector3(), tmpV2 = new T.Vector3(), tmpM = new T.Matrix4();

  // How each weapon mesh sits: its grip is at the origin; fwd is the barrel / shaft direction and up its
  // top side, in the GLB's own axes.
  // grip: where the main hand holds it, in the GLB's axes (the hammer's origin sits under its head, so
  // Reinhardt's right hand goes most of the way down the shaft).
  const WEAPON_AXES = {
    hammer: { fwd: new T.Vector3(0, 1, 0), up: new T.Vector3(0, 0, 1), grip: new T.Vector3(0, -1.55, 0), off: new T.Vector3(0, -0.7, 0) },
    cannon: { fwd: new T.Vector3(0, 0, 1), up: new T.Vector3(0, 1, 0), grip: new T.Vector3(0, 0, 0.05), off: new T.Vector3(0, -0.12, 0.55) },
    amp: { fwd: new T.Vector3(0, 0, 1), up: new T.Vector3(0, 1, 0), grip: new T.Vector3(0, 0, 0) },
    lightgun: { fwd: new T.Vector3(0, 0, 1), up: new T.Vector3(0, 1, 0), grip: new T.Vector3(0, 0, 0) },
    flail: { fwd: new T.Vector3(0, 1, 0), up: new T.Vector3(0, 0, 1), grip: new T.Vector3(0, -0.3, 0) },
    shield: { fwd: new T.Vector3(0, 0, -1), up: new T.Vector3(0, 1, 0), grip: new T.Vector3(0, 0, 0) },
  };

  function basis(fwd, up) {
    const f = fwd.clone().normalize();
    const r = new T.Vector3().crossVectors(up, f).normalize();
    const u = new T.Vector3().crossVectors(f, r).normalize();
    return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(r, u, f));
  }

  function prepMaterials(root, tint) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      const src = o.material;
      const m = new T.MeshLambertMaterial({
        map: src.map || null, color: src.map ? 0xffffff : src.color, skinning: !!o.isSkinnedMesh,
        emissive: src.emissive && src.emissive.getHex() ? src.emissive : 0x000000,
        emissiveMap: src.emissiveMap || null, alphaTest: src.name && src.name.endsWith('_mask') ? 0.5 : 0,
        side: src.name && src.name.endsWith('_mask') ? T.DoubleSide : T.FrontSide,
      });
      if (m.map) m.map.encoding = T.sRGBEncoding;
      if (m.emissiveMap) { m.emissiveMap.encoding = T.sRGBEncoding; m.emissive = new T.Color(1, 1, 1); }
      o.material = m;
    });
  }

  class Rig {
    constructor(gltf) {
      this.root = T.SkeletonUtils.clone(gltf.scene);
      prepMaterials(this.root);
      this.mats = [];
      this.root.traverse((o) => { if (o.isMesh) this.mats.push(o.material); });
      this.b = {};
      for (const k in BONES) this.b[k] = this.root.getObjectByName(BONES[k]) || null;
      this.root.updateMatrixWorld(true);
      const rootInv = new T.Matrix4().copy(this.root.matrixWorld).invert();
      this.rest = {};
      for (const k in this.b) {
        const bone = this.b[k];
        if (!bone) continue;
        const wp = new T.Quaternion(), w = new T.Quaternion(), p = new T.Vector3();
        bone.parent.getWorldQuaternion(wp);
        bone.getWorldQuaternion(w);
        bone.getWorldPosition(p).applyMatrix4(rootInv);
        this.rest[k] = { local: bone.quaternion.clone(), wp, wpInv: wp.clone().invert(), w, pos: p, lpos: bone.position.clone() };
      }
      const R = this.rest, dir = (a, b) => (R[a] && R[b] ? R[b].pos.clone().sub(R[a].pos) : null);
      this.dirs = {
        lUpper: dir('lUpper', 'lFore'), lFore: dir('lFore', 'lHand'),
        rUpper: dir('rUpper', 'rFore'), rFore: dir('rFore', 'rHand'),
      };
      this.len = {};
      for (const k in this.dirs) if (this.dirs[k]) this.len[k] = this.dirs[k].length();
      // overall size (for hit volumes and nameplates)
      const box = new T.Box3().setFromObject(this.root);
      this.size = box.getSize(new T.Vector3());
      this.minY = box.min.y;
      this.hipsY = R.hips ? R.hips.pos.y : this.size.y * 0.5;
      this.pose = {};
      this.weapons = [];
      this.flash = 0;
    }

    addWeapon(gltf, name) {
      const w = T.SkeletonUtils.clone(gltf.scene);
      prepMaterials(w);
      w.traverse((o) => { if (o.isMesh) this.mats.push(o.material); });
      const ax = WEAPON_AXES[name];
      const wrap = new T.Group();
      wrap.add(w);
      wrap.userData.fix = basis(ax.fwd, ax.up).invert();
      wrap.userData.ax = ax;
      wrap.userData.name = name;
      wrap.matrixAutoUpdate = false;
      this.weapons.push(wrap);
      return wrap;
    }

    // place a weapon: main-hand grip at p (world), barrel/shaft along fwd, top toward up (world vectors).
    // Returns the world position of the off-hand grip, if the weapon has one.
    placeWeapon(wrap, p, fwd, up) {
      const q = basis(fwd, up).multiply(wrap.userData.fix);
      const ax = wrap.userData.ax;
      const origin = p.clone().sub(ax.grip.clone().applyQuaternion(q));
      wrap.matrix.compose(origin, q, new T.Vector3(1, 1, 1));
      wrap.matrixWorldNeedsUpdate = true;
      return ax.off ? origin.clone().add(ax.off.clone().applyQuaternion(q)) : null;
    }

    // world position of a point given in a weapon's own axes (muzzle, hammer head, ...)
    weaponPoint(wrap, local) {
      return local.clone().applyMatrix4(wrap.matrix);
    }

    // set a bone's model-space rotation delta (applied about the bone, relative to its parent's pose)
    set(k, q) { this.pose[k] = q; }
    rot(k, axis, a) {
      if (!this.b[k]) return;
      this.pose[k] = this.pose[k] ? this.pose[k].multiply(qa(axis, a)) : qa(axis, a);
    }

    total(chain) {
      const q = new T.Quaternion();
      for (const k of chain) if (this.pose[k]) q.multiply(this.pose[k]);
      return q;
    }

    applyFK() {
      for (const k in this.b) {
        const bone = this.b[k];
        if (!bone) continue;
        const r = this.rest[k], d = this.pose[k];
        if (d) bone.quaternion.copy(r.wpInv).multiply(d).multiply(r.wp).multiply(r.local);
        else bone.quaternion.copy(r.local);
      }
      this.root.updateMatrixWorld(true);
    }

    // world position of a bone
    bonePos(k, out = new T.Vector3()) { return this.b[k] ? this.b[k].getWorldPosition(out) : out.copy(this.root.position); }

    // model-space <-> world helpers
    toWorld(v) { return v.clone().applyMatrix4(this.root.matrixWorld); }
    toModelDir(v) { return v.clone().applyQuaternion(this.root.getWorldQuaternion(tmpQ).invert()); }

    // Two-bone IK: put the hand of `side` ('l' | 'r') at world target, elbow toward world pole.
    reach(side, target, pole) {
      const up = side + 'Upper', fo = side + 'Fore';
      if (!this.b[up] || !this.b[fo] || !this.dirs[up]) return;
      const inv = new T.Matrix4().copy(this.root.matrixWorld).invert();
      const S = this.bonePos(up, new T.Vector3()).applyMatrix4(inv);
      const Tm = target.clone().applyMatrix4(inv), P = pole.clone().applyMatrix4(inv);
      const a = this.len[up], b = this.len[fo];
      let d = Tm.clone().sub(S);
      const dist = Math.min(d.length(), (a + b) * 0.999);
      d.normalize();
      const cosA = (a * a + dist * dist - b * b) / (2 * a * dist);
      const ang = Math.acos(Math.max(-1, Math.min(1, cosA)));
      const pv = P.clone().sub(S);
      const perp = pv.sub(d.clone().multiplyScalar(pv.dot(d))).normalize();
      const E = S.clone().add(d.clone().multiplyScalar(Math.cos(ang) * a)).add(perp.multiplyScalar(Math.sin(ang) * a));
      const H = S.clone().add(d.multiplyScalar(dist));
      const Qp = this.total(CHAIN[up]);
      const want1 = E.clone().sub(S).applyQuaternion(Qp.clone().invert()).normalize();
      const Qu = new T.Quaternion().setFromUnitVectors(this.dirs[up].clone().normalize(), want1);
      const Qpu = Qp.clone().multiply(Qu);
      const want2 = H.clone().sub(E).applyQuaternion(Qpu.clone().invert()).normalize();
      const Qf = new T.Quaternion().setFromUnitVectors(this.dirs[fo].clone().normalize(), want2);
      this.pose[up] = Qu;
      this.pose[fo] = Qf;
    }

    // re-apply just the arm bones after IK
    applyArms() {
      for (const k of ['lUpper', 'lFore', 'rUpper', 'rFore']) {
        const bone = this.b[k];
        if (!bone) continue;
        const r = this.rest[k], d = this.pose[k];
        if (d) bone.quaternion.copy(r.wpInv).multiply(d).multiply(r.wp).multiply(r.local);
      }
      this.root.updateMatrixWorld(true);
    }

    setTint(color, amount) {
      for (const m of this.mats) {
        if (!m.userData.baseEmissive) m.userData.baseEmissive = m.emissive.clone();
        m.emissive.copy(m.userData.baseEmissive).lerp(color, amount);
      }
    }

    setOpacity(a) {
      for (const m of this.mats) { m.transparent = a < 1; m.opacity = a; m.depthWrite = a >= 1; }
    }
  }

  G.Rig = Rig;
  G.RigUtil = { qa, X, Y, Z, basis };
})(window.G = window.G || {});

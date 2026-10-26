// Poses every hero each frame from what the unit is doing: a walk cycle from how fast it actually moved,
// the spine bent toward the aim, and an upper-body pose per hero and action (Reinhardt's swings, barrier
// stance, Fire Strike and Shatter slam; Zarya's cannon; Brigitte's flail and shield; Zenyatta's orbs ...).
// Hands are placed with IK on the weapon grips, so the weapons stay in the hands whatever the body does.
(function (G) {
  const T = THREE;
  const { X, Y, Z } = G.RigUtil;
  const UP = new T.Vector3(0, 1, 0);
  const ease = (x) => x * x * (3 - 2 * x);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // aim frame at the shoulders: l (left), u (up), f (forward, with pitch)
  function aimFrame(u, rig, pitchScale = 1) {
    const L = rig.bonePos('lUpper', new T.Vector3()), R = rig.bonePos('rUpper', new T.Vector3());
    const o = L.clone().add(R).multiplyScalar(0.5);
    const p = u.pitch * pitchScale;
    const f = new T.Vector3(Math.sin(u.yaw) * Math.cos(p), Math.sin(p), Math.cos(u.yaw) * Math.cos(p));
    const l = new T.Vector3().crossVectors(UP, f).normalize();
    const up = new T.Vector3().crossVectors(f, l).normalize();
    const w = L.distanceTo(R);
    const P = (x, y, z) => o.clone().addScaledVector(l, x * w).addScaledVector(up, y * w).addScaledVector(f, z * w);
    const D = (x, y, z) => new T.Vector3().addScaledVector(l, x).addScaledVector(up, y).addScaledVector(f, z).normalize();
    return { o, f, l, u: up, w, P, D };
  }

  function legs(u, rig, a, speed, dt) {
    const big = u.hero === 'reinhardt' || (u.hero === 'dva' && u.mech);
    const stride = big ? 2.3 : 1.7;
    a.phase = (a.phase || 0) + speed * dt / stride * Math.PI;
    const amp = clamp(speed / 6, 0, 1) * (u.hero === 'lucio' ? 0.35 : 0.55);
    // swing axis from the move direction in model space
    const mv = a.moveLocal || Z;
    const axis = new T.Vector3().crossVectors(UP, mv).normalize();
    if (!axis.lengthSq()) axis.copy(X);
    const s = Math.sin(a.phase);
    rig.rot('lThigh', axis, -amp * s);
    rig.rot('rThigh', axis, amp * s);
    const kneeBase = u.hero === 'lucio' ? 0.35 : 0;
    rig.rot('lCalf', X, kneeBase + amp * 1.2 * Math.max(0, Math.cos(a.phase)));
    rig.rot('rCalf', X, kneeBase + amp * 1.2 * Math.max(0, -Math.cos(a.phase)));
    if (kneeBase) { rig.rot('lThigh', X, -kneeBase * 0.6); rig.rot('rThigh', X, -kneeBase * 0.6); }
    return Math.abs(Math.cos(a.phase)) * amp * (big ? 0.07 : 0.05);
  }

  function spine(u, rig, pitch, yawOff, lean = 0) {
    for (const k of ['spine1', 'spine2', 'chest']) {
      if (!rig.b[k]) continue;
      rig.rot(k, Y, yawOff / 3);
      rig.rot(k, X, -pitch * 0.28 + lean / 3);
    }
    if (rig.b.neck) rig.rot('neck', X, -pitch * 0.15);
  }

  const Anim = {
    pose(u, rig, dt) {
      const g = u.game, t = g.time;
      const a = u.anim || (u.anim = { last: u.pos.clone(), speed: 0, phase: 0, fall: 0, alpha: 1 });
      // how fast it really moved
      const dx = u.pos.x - a.last.x, dz = u.pos.z - a.last.z;
      const sp = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
      a.speed += (Math.min(sp, 20) - a.speed) * Math.min(1, dt * 10);
      if (sp > 0.3) {
        const c = Math.cos(-u.bodyYaw), s = Math.sin(-u.bodyYaw);
        const lx = dx * c + dz * s, lz = -dx * s + dz * c;   // world -> model (rotate by -yaw about y)
        a.moveLocal = new T.Vector3(lx, 0, lz).normalize();
      }
      a.last.copy(u.pos);

      rig.pose = {};
      const root = rig.root;
      root.position.copy(u.pos);
      root.rotation.set(0, u.bodyYaw, 0);

      // ---- dead / disabled bodies
      if (!u.alive) {
        a.fall = Math.min(1, a.fall + dt * 2.5);
        root.rotation.set(-ease(a.fall) * 1.45, u.bodyYaw, 0, 'YXZ');
        const since = t - u.deadAt;
        a.alpha = since > 2.5 ? Math.max(0, 1 - (since - 2.5) / 1.5) : 1;
        rig.setOpacity(a.alpha);
        root.visible = a.alpha > 0.01;
        rig.applyFK();
        return;
      }
      if (a.fall) { a.fall = 0; rig.setOpacity(1); root.visible = true; }

      let lift = 0;
      if (u.has('knock')) {
        root.rotation.set(-1.4, u.bodyYaw, 0, 'YXZ');
        root.position.y += 0.25;
      } else if (u.has('grav')) {
        root.rotation.set(Math.sin(t * 2.3 + u.id) * 0.6, u.bodyYaw + t * 0.8, Math.cos(t * 1.7 + u.id) * 0.5, 'YXZ');
        rig.rot('lUpper', Z, 0.8); rig.rot('rUpper', Z, -0.8);
        rig.rot('lThigh', X, -0.5 + Math.sin(t * 5) * 0.3); rig.rot('rThigh', X, -0.2 - Math.sin(t * 5) * 0.3);
        rig.applyFK();
        Anim.weapons(u, rig, 'limp');
        return;
      } else if (u.has('pinned')) {
        root.rotation.set(-1.2, u.bodyYaw, 0, 'YXZ');
      } else if (u.has('stun')) {
        root.rotation.set(0, u.bodyYaw, Math.sin(t * 9) * 0.12, 'YXZ');
      }

      const yawOff = 0;
      const moving = a.speed;
      if (u.hero === 'zenyatta') {
        const hover = 0.12 + Math.sin(t * 2 + u.id) * 0.06 + (u.has('trans') ? 0.9 : 0);
        root.position.y += hover;
        const lean = clamp(moving / 7, 0, 1) * 0.25;
        spine(u, rig, u.pitch, yawOff, lean);
      } else {
        lift = u.onGround ? legs(u, rig, a, moving, dt) : 0;
        if (!u.onGround) { rig.rot('lThigh', X, -0.4); rig.rot('rThigh', X, 0.1); rig.rot('lCalf', X, 0.6); rig.rot('rCalf', X, 0.3); }
        root.position.y += lift;
        let lean = clamp(moving / 7, 0, 1) * 0.12;
        if (u.has('charging')) lean = 0.45;
        if (u.st.boost > t) lean = 0.35;
        spine(u, rig, u.hero === 'dva' && u.mech ? 0 : u.pitch, yawOff, lean);
      }
      rig.applyFK();
      const fn = Anim[u.hero === 'dva' ? (u.mech ? 'mech' : 'pilot') : u.hero];
      if (fn) fn(u, rig, a, t);
      // hit flash / ult glows
      const hurt = clamp(1 - (t - u.lastHurt) * 6, 0, 1);
      if (u.has('trans')) rig.setTint(new T.Color(1, 0.85, 0.4), 0.55);
      else if (u.has('rally')) rig.setTint(new T.Color(1, 0.55, 0.25), 0.2);
      else if (hurt > 0) rig.setTint(new T.Color(1, 0.2, 0.15), hurt * 0.45);
      else rig.setTint(new T.Color(0, 0, 0), 0);
    },

    // weapons dangling when a body is disabled
    weapons(u, rig, mode) {
      const R = rig.bonePos('rHand', new T.Vector3()), L = rig.bonePos('lHand', new T.Vector3());
      const f = new T.Vector3(Math.sin(u.bodyYaw), 0, Math.cos(u.bodyYaw));
      rig.weapons.forEach((w, i) => rig.placeWeapon(w, i === 1 ? L : R, i === 1 ? f : UP, i === 1 ? UP : f));
    },

    reinhardt(u, rig, a, t) {
      const F = aimFrame(u, rig, 0.6), H = u.H, hammer = rig.weapons[0];
      let grip, dir, face, left = null, leftPole = null;
      const act = u.action;
      if (u.barrierUp() || u.has('charging')) {
        grip = F.P(-0.65, -0.95, 0.05);
        dir = F.D(-0.25, -1, -0.45);
        face = F.f.clone();
        left = F.P(0.25, 0.25, 1.05);
        leftPole = F.P(1.2, -0.6, 0.2);
      } else if (act && act.name === 'swing') {
        const k = clamp(act.t / 0.55, 0, 1), e = ease(k);
        const th = (act.dir > 0 ? 1 : -1) * (-2.0 + 4.0 * e);
        grip = F.P(-0.15 + 0.3 * Math.sin(th) * 0.5, -0.55, 0.45);
        dir = F.D(Math.sin(th), 0.25, Math.cos(th));
        face = F.D(Math.sin(th + Math.PI / 2 * act.dir), 0, Math.cos(th + Math.PI / 2 * act.dir));
      } else if (act && act.name === 'fire') {
        const k = clamp(act.t / 0.55, 0, 1), e = ease(k);
        const th = -2.2 + 3.4 * e;   // from behind-up to forward-down
        grip = F.P(-0.45, -0.25, 0.35);
        dir = F.D(-0.2, Math.cos(th), Math.sin(th) + 0.2);
        face = new T.Vector3().crossVectors(F.l, dir).normalize();
      } else if (act && act.name === 'shatter') {
        const w = H.shatter.windup;
        if (act.t < w) {
          const e = ease(clamp(act.t / w, 0, 1));
          grip = F.P(-0.1, -0.3 + 0.9 * e, 0.3 - 0.2 * e);
          dir = F.D(0, 0.4 + 0.6 * e, -0.9 * e + 0.3);
        } else {
          const e = ease(clamp((act.t - w) / 0.15, 0, 1));
          grip = F.P(0, 0.6 - 1.2 * e, 0.6 * e + 0.1);
          dir = F.D(0, 1 - 2.2 * e, 1.2 * e - 0.6);
        }
        face = new T.Vector3().crossVectors(F.l, dir).normalize();
      } else {
        grip = F.P(-0.35, -0.85, 0.55);
        dir = F.D(-0.35, 1, 0.3);
        face = F.f.clone();
      }
      rig.reach('r', grip, F.P(-1.5, -0.8, -0.4));
      rig.applyArms();
      const R = rig.bonePos('rHand', new T.Vector3());
      const off = rig.placeWeapon(hammer, R, dir, face);
      rig.reach('l', left || off, leftPole || F.P(1.5, -0.8, -0.4));
      rig.applyArms();
    },

    zarya(u, rig, a, t) {
      const F = aimFrame(u, rig), w = rig.weapons[0];
      const kick = u.st.beaming > t ? Math.sin(t * 40) * 0.01 : 0;
      rig.reach('r', F.P(-0.35, -0.55 + kick, 0.45), F.P(-1.5, -1, -0.5));
      rig.applyArms();
      const off = rig.placeWeapon(w, rig.bonePos('rHand', new T.Vector3()), F.f, F.u);
      rig.reach('l', off, F.P(1.5, -1, -0.3));
      rig.applyArms();
    },

    lucio(u, rig, a, t) {
      const F = aimFrame(u, rig), w = rig.weapons[0];
      const fired = clamp(1 - (t - (u.cd.gun || -9) + u.H.gun.period) * 5, 0, 1);
      const waving = u.cd.wave && t < u.cd.wave - u.H.wave.cd + 0.3;
      rig.reach('r', F.P(-0.45, -0.35, waving ? 1.1 : 0.75 - fired * 0.1), F.P(-1.5, -1, -0.3));
      rig.reach('l', F.P(0.7, -0.9, 0.1), F.P(1.5, 0, -0.5));
      rig.applyArms();
      rig.placeWeapon(w, rig.bonePos('rHand', new T.Vector3()), F.f, F.u);
    },

    brigitte(u, rig, a, t) {
      const F = aimFrame(u, rig, 0.6), flail = rig.weapons[0], shield = rig.weapons[1];
      const act = u.action;
      let grip, dir, face;
      if (act && act.name === 'flail') {
        const e = ease(clamp(act.t / 0.35, 0, 1));
        const th = (act.dir > 0 ? 1 : -1) * (-1.8 + 3.6 * e);
        grip = F.P(-0.2 + Math.sin(th) * 0.4, -0.35, 0.7);
        dir = F.D(Math.sin(th), 0.2, Math.cos(th));
        face = UP;
      } else if (u.cd.whip && t < u.cd.whip - u.H.whip.cd + 0.35) {
        grip = F.P(-0.3, -0.1, 1.0);
        dir = F.f.clone();
        face = UP;
      } else {
        grip = F.P(-0.65, -0.95, 0.55);
        dir = F.D(-0.1, 1, 0.6);
        face = F.f.clone();
      }
      const up = u.barrierUp() || u.st.bashing > t;
      rig.reach('r', grip, F.P(-1.5, -1, -0.4));
      rig.reach('l', up ? F.P(0.2, -0.15, 0.95) : F.P(0.75, -0.75, 0.45), F.P(1.5, -1, -0.4));
      rig.applyArms();
      rig.placeWeapon(flail, rig.bonePos('rHand', new T.Vector3()), dir, face);
      const L = rig.bonePos('lHand', new T.Vector3());
      rig.placeWeapon(shield, L, up ? F.f : F.D(0.6, 0, 0.8), UP);
    },

    zenyatta(u, rig, a, t) {
      const F = aimFrame(u, rig);
      const since = t - (u.castT || -9), alt = Math.floor((u.castT || 0) / 0.4) % 2;
      const thrust = since < 0.25 ? Math.sin(since / 0.25 * Math.PI) : 0;
      if (u.has('trans')) {
        rig.reach('r', F.P(-1.2, 0.2, 0.3), F.P(-1.5, -1, -0.5));
        rig.reach('l', F.P(1.2, 0.2, 0.3), F.P(1.5, -1, -0.5));
      } else {
        rig.reach('r', F.P(-0.45, -0.45, 0.55 + (alt ? thrust * 0.5 : 0)), F.P(-1.5, -1, -0.4));
        rig.reach('l', F.P(0.45, -0.45, 0.55 + (!alt ? thrust * 0.5 : 0)), F.P(1.5, -1, -0.4));
      }
      rig.applyArms();
    },

    mech(u, rig, a, t) {
      const p = clamp(u.pitch, -0.6, 0.7);
      const recoil = u.st.firing > t ? Math.sin(t * 45) * 0.03 : 0;
      for (const s of ['l', 'r']) {
        if (u.st.matrix > t && s === 'l') { rig.rot('lUpper', X, -0.9 - p); continue; }
        rig.rot(s + 'Upper', X, -p * 0.9 - 0.15 + recoil);
      }
      rig.applyArms();
    },

    pilot(u, rig, a, t) {
      const F = aimFrame(u, rig), w = rig.weapons[0];
      rig.reach('r', F.P(-0.4, -0.3, 0.9), F.P(-1.5, -1, -0.3));
      rig.reach('l', F.P(0.7, -0.9, 0.1), F.P(1.5, 0, -0.5));
      rig.applyArms();
      if (w) rig.placeWeapon(w, rig.bonePos('rHand', new T.Vector3()), F.f, F.u);
    },
  };

  G.Anim = Anim;
})(window.G = window.G || {});

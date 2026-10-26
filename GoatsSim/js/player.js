// You: the blue Reinhardt. Mouse look with pointer lock, Overwatch's default keys, first-person hammer
// view, and the game's third-person camera while the barrier is up, during Charge and Earthshatter, when
// knocked down, and when dead (spectating a teammate).
(function (G) {
  const T = THREE;
  const ease = (x) => x * x * (3 - 2 * x);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  class Player {
    constructor(game, unit) {
      this.g = game;
      this.u = unit;
      unit.isPlayer = true;
      this.keys = {};
      this.mouse = { l: false, r: false };
      this.sens = 1;
      this.locked = false;
      this.third = 0;          // 0 first person .. 1 third person
      this.camPos = new T.Vector3();
      this.spectate = null;
      this.bindInput();
      this.buildViewModel();
    }

    bindInput() {
      const c = this.g.world.renderer.domElement;
      addEventListener('keydown', (e) => {
        if (e.repeat && !['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) return;
        this.keys[e.code] = true;
        if (!this.g.running()) return;
        if (e.code === 'Tab') { e.preventDefault(); this.g.hud.showScore(true); }
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') G.Kits.reinhardt.charge(this.u);
        if (e.code === 'KeyE') G.Kits.reinhardt.fireStrike(this.u);
        if (e.code === 'KeyQ') G.Kits.reinhardt.shatter(this.u);
        if (e.code === 'Space') this.jump = true;
        if (e.code === 'KeyH') this.g.hud.toggleCoach();
      });
      addEventListener('keyup', (e) => {
        this.keys[e.code] = false;
        if (e.code === 'Tab') this.g.hud.showScore(false);
      });
      c.addEventListener('mousedown', (e) => {
        if (!this.locked && this.g.running()) { c.requestPointerLock(); return; }
        if (e.button === 0) this.mouse.l = true;
        if (e.button === 2) this.mouse.r = true;
      });
      addEventListener('mouseup', (e) => {
        if (e.button === 0) this.mouse.l = false;
        if (e.button === 2) this.mouse.r = false;
      });
      c.addEventListener('contextmenu', (e) => e.preventDefault());
      document.addEventListener('pointerlockchange', () => {
        this.locked = document.pointerLockElement === c;
        if (!this.locked) { this.mouse.l = this.mouse.r = false; if (this.g.running()) this.g.pause(true); }
      });
      addEventListener('mousemove', (e) => {
        if (!this.locked) return;
        const u = this.u, k = 0.0022 * this.sens;
        let dy = e.movementX * k;
        if (u.has('charging')) dy = clamp(dy, -u.H.charge.turn * 0.03, u.H.charge.turn * 0.03);
        this.lookYaw = (this.lookYaw || 0) + dy;
        this.lookPitch = (this.lookPitch || 0) - e.movementY * k;
      });
    }

    buildViewModel() {
      // the hammer in first person, parented to the camera
      const g = this.g, cam = g.world.camera;
      const w = T.SkeletonUtils.clone(G.Assets.gltf.hammer.scene);
      w.traverse((o) => {
        if (!o.isMesh) return;
        const m = new T.MeshLambertMaterial({ map: o.material.map || null, color: o.material.map ? 0xffffff : o.material.color });
        if (m.map) m.map.encoding = T.sRGBEncoding;
        m.depthTest = true;
        o.material = m;
        o.renderOrder = 10;
        o.frustumCulled = false;
      });
      this.vmInner = w;
      this.vm = new T.Group();
      this.vmPivot = new T.Group();
      this.vmPivot.add(w);
      this.vm.add(this.vmPivot);
      cam.add(this.vm);
      this.vmLight = new T.PointLight(0xffffff, 0.4, 3);
      cam.add(this.vmLight);
    }

    update(dt) {
      const g = this.g, u = this.u, R = G.Kits.reinhardt;
      // look
      if (this.lookYaw || this.lookPitch) {
        u.yaw -= this.lookYaw || 0;
        u.pitch = clamp(u.pitch + (this.lookPitch || 0), -1.45, 1.45);
        this.lookYaw = this.lookPitch = 0;
      }
      u.move.set(0, 0, 0);
      if (u.alive && g.state === 'fight') {
        const f = new T.Vector3(Math.sin(u.yaw), 0, Math.cos(u.yaw)), r = new T.Vector3(-Math.cos(u.yaw), 0, Math.sin(u.yaw));
        if (this.keys.KeyW) u.move.add(f);
        if (this.keys.KeyS) u.move.sub(f);
        if (this.keys.KeyD) u.move.add(r);
        if (this.keys.KeyA) u.move.sub(r);
        if (u.move.lengthSq()) u.move.normalize();
        if (this.jump && u.onGround && u.canMove()) { u.vel.y = 5.6; u.onGround = false; }
        if (this.mouse.r) R.shield(u, true); else R.shield(u, false);
        if (this.mouse.l && !this.mouse.r) R.swing(u);
      } else if (u.barrier) R.shield(u, false);
      this.jump = false;
    }

    // watch mode: an elevated camera behind your team that frames the whole fight
    spectatorCamera(dt) {
      const g = this.g, cam = g.world.camera;
      const cen = (team) => {
        const a = g.team(team).filter((x) => x.alive);
        if (!a.length) return null;
        return a.reduce((s, x) => s.add(x.pos), new T.Vector3()).multiplyScalar(1 / a.length);
      };
      const b = cen(g.blue) || g.map.point, r = cen(g.red) || g.map.point;
      const mid = b.clone().lerp(r, 0.5);
      const across = r.clone().sub(b).setY(0);
      const len = across.length();
      if (len > 0.1) across.normalize(); else across.set(-1, 0, 0);
      const side = new T.Vector3(across.z, 0, -across.x);
      // behind your team, a little above head height; pull in along the line of sight when a wall is in the way
      const look = mid.clone().add(new T.Vector3(0, 1.2, 0));
      let want = null, best = -1;
      for (const [s, h] of [[4, 6], [-4, 6], [0, 7.5], [8, 6], [-8, 6], [0, 4.5]]) {
        const p = mid.clone().addScaledVector(across, -(10 + len * 0.5)).addScaledVector(side, s).add(new T.Vector3(0, h, 0));
        const dir = p.clone().sub(look), dl = dir.length();
        dir.normalize();
        const free = Math.min(dl, g.world.rayDist(look, dir, dl) - 0.6);
        if (free > best) { best = free; want = look.clone().addScaledVector(dir, Math.max(3, free)); }
        if (free >= dl - 0.01) break;
      }
      this.specPos = this.specPos || want.clone();
      this.specLook = this.specLook || mid.clone();
      const k = Math.min(1, dt * 1.5);
      this.specPos.lerp(want, k);
      this.specLook.lerp(look, k);
      cam.position.copy(this.specPos);
      cam.lookAt(this.specLook);
      this.vm.visible = false;
      for (const x of g.units) if (x.rig) { x.rig.root.visible = !x.anim || x.anim.alpha > 0.01; for (const w of x.rig.weapons) w.visible = true; }
      this.third = 1;
    }

    // camera and the first-person hammer
    updateCamera(dt) {
      const g = this.g, u = this.u, cam = g.world.camera, t = g.time;
      if (g.autopilot) { this.spectatorCamera(dt); return; }
      let subject = u;
      if (!u.alive) {
        if (!this.spectate || !this.spectate.alive) this.spectate = g.team(u.team).find((x) => x.alive && x !== u) || null;
        if (this.spectate) subject = this.spectate;
      } else this.spectate = null;
      const act = u.action;
      const wantThird = g.autopilot || !u.alive || u.barrierUp() || u.has('charging') || (act && act.name === 'shatter') || u.has('knock') || u.has('grav') || u.has('pinned');
      this.third += ((wantThird ? 1 : 0) - this.third) * Math.min(1, dt * 9);
      const yaw = subject === u ? u.yaw : subject.yaw, pitch = subject === u ? u.pitch : 0.1;
      const eye = subject.eye(new T.Vector3());
      if (subject === u && u.has('knock')) eye.y = u.pos.y + 0.6;
      const fwd = new T.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      const right = new T.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
      const back = subject === u ? 4.4 : 5.5;
      let tp = eye.clone().addScaledVector(fwd, -back).addScaledVector(right, 0.8).add(new T.Vector3(0, 0.9, 0));
      // keep the camera out of walls: when a wall is close behind, swing up over the shoulder instead
      let dir = tp.clone().sub(eye), dl = dir.length();
      dir.normalize();
      let free = g.world.rayDist(eye, dir, dl);
      if (free < dl) {
        const high = eye.clone().addScaledVector(fwd, -back * 0.6).add(new T.Vector3(0, 2.4, 0));
        const d2 = high.clone().sub(eye), l2 = d2.length();
        const f2 = g.world.rayDist(eye, d2.normalize(), l2);
        tp = f2 >= l2 ? high : eye.clone().addScaledVector(dir, Math.max(0.6, free - 0.3));
      }
      const pos = eye.clone().lerp(tp, ease(this.third));
      const shake = g.fx.shakeAmt;
      if (shake > 0) pos.add(new T.Vector3((Math.random() - 0.5) * shake * 0.3, (Math.random() - 0.5) * shake * 0.3, 0));
      cam.position.copy(pos);
      cam.rotation.set(pitch, yaw + Math.PI, 0, 'YXZ');
      // show the body in third person
      if (u.rig) {
        const show = this.third > 0.35 || !u.alive;
        u.rig.root.visible = show && (u.anim ? u.anim.alpha > 0.01 : true);
        for (const w of u.rig.weapons) w.visible = show;
      }
      // viewmodel
      this.vm.visible = this.third < 0.35 && u.alive;
      if (this.vm.visible) this.poseViewModel(dt);
    }

    poseViewModel(dt) {
      const u = this.u, g = this.g, t = g.time, act = u.action, H = u.H;
      const vm = this.vm, pv = this.vmPivot, w = this.vmInner;
      const speed = u.anim ? u.anim.speed : 0;
      const bob = Math.sin((u.anim ? u.anim.phase : 0) * 2) * Math.min(1, speed / 6) * 0.025;
      // rest: hammer held up on the right, head high, shaft running out of the bottom-right corner.
      // The vm group's origin is the middle of the hammer head.
      const R = [0.8, -0.3 + bob, -2.2, -0.15, -0.5, 0.45];
      let [px, py, pz, rx, ry, rz] = R;
      if (act && act.name === 'swing') {
        // a flat sweep across the screen, head first, alternating right-to-left and left-to-right
        const k = clamp(act.t / 0.42, 0, 1), e = ease(k), d = act.dir > 0 ? 1 : -1;
        const th = d * (-1.35 + 2.7 * e);
        const S = [-Math.sin(th) * 1.0, -0.42, -1.85 + Math.abs(Math.sin(th)) * 0.3, -0.1, th * 0.7, d * 1.35];
        const wind = clamp(act.t / 0.08, 0, 1);                  // snap from rest into the swing
        const back = clamp((act.t - 0.42) / 0.4, 0, 1);         // and settle back after it
        [px, py, pz, rx, ry, rz] = S.map((v, i) => R[i] + (v - R[i]) * wind * (1 - ease(back)));
      } else if (act && act.name === 'fire') {
        const k = clamp(act.t / 0.5, 0, 1), e = ease(k);
        px = 0.45 - 0.35 * e; py = -0.1 - 0.35 * e; pz = -1.9;
        rx = -1.3 + 2.3 * e; ry = -0.2; rz = 0.2;
      }
      vm.position.set(px, py, pz);
      vm.rotation.set(rx, ry, rz, 'YXZ');
      w.position.set(0, -0.6, 0);
      w.rotation.set(0, Math.PI / 2, 0);
      pv.rotation.set(0, 0, 0);
    }
  }

  G.Player = Player;
})(window.G = window.G || {});

// The map: renderer, sky and sun, the Hanamura mesh, and the navigation layers built by tools/build_nav.py.
// Game space is three.js space (y up). The nav data is in Blender space (z up, y north): blender (x, y, z)
// is three (x, z, -y). A cell can hold up to four standable floors; a unit stands on one of them and
// moves to a neighbour's floor only if it is within a step of its own.
(function (G) {
  const STEP = 0.65;       // max step up between neighbouring cells (m)
  const DROP = 3.5;        // max drop when walking off a ledge

  class World {
    constructor(canvas) {
      const T = THREE;
      this.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      this.renderer.outputEncoding = T.sRGBEncoding;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      this.renderer.shadowMap.enabled = false;
      this.scene = new T.Scene();
      this.camera = new T.PerspectiveCamera(70, 1, 0.05, 2500);
      this.scene.add(this.camera);

      // Hanamura's late-afternoon light: warm sun from the west, pale blue sky, soft fill.
      const skyTop = new T.Color(0x6fa6dc), skyLow = new T.Color(0xd9e6f0);
      this.scene.background = this.skyTexture(skyTop, skyLow);
      this.scene.fog = new T.Fog(0xcfdbe6, 90, 900);
      this.hemi = new T.HemisphereLight(0xdfeeff, 0x5a4c3e, 0.62);
      this.sun = new T.DirectionalLight(0xfff0d8, 0.95);
      this.sun.position.set(-60, 90, 40);
      this.scene.add(this.hemi, this.sun);
      this.ambient = new T.AmbientLight(0xffffff, 0.04);
      this.scene.add(this.ambient);
      this.resize();
    }

    skyTexture(top, low) {
      const c = document.createElement('canvas');
      c.width = 2; c.height = 256;
      const g = c.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 256);
      grd.addColorStop(0, '#' + top.getHexString());
      grd.addColorStop(0.55, '#' + low.getHexString());
      grd.addColorStop(1, '#e8dcc8');
      g.fillStyle = grd; g.fillRect(0, 0, 2, 256);
      const t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      return t;
    }

    resize() {
      const w = window.innerWidth, h = window.innerHeight;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    addMap(gltf) {
      const root = gltf.scene;
      root.traverse((o) => {
        if (!o.isMesh) return;
        const m = o.material;
        // flat palette colours + baked AO in vertex colours, matte. The palette was picked as sRGB.
        const color = m.color.clone();
        if (!m.map) color.convertSRGBToLinear();
        o.material = new THREE.MeshLambertMaterial({
          color, map: m.map || null, vertexColors: !!o.geometry.attributes.color,
          alphaTest: m.name && m.name.endsWith('_mask') ? 0.5 : 0, side: THREE.DoubleSide,
        });
        if (o.material.map) o.material.map.encoding = THREE.sRGBEncoding;
        o.matrixAutoUpdate = false;
        o.updateMatrix();
      });
      root.updateMatrixWorld(true);
      this.scene.add(root);
      this.map = root;
    }

    // ---------------------------------------------------------------- navigation
    loadNav(nav) {
      const m = nav.meta;
      this.nm = m;
      const nCells = m.nx * m.ny * m.layers;
      this.floors = new Uint8Array(nav.bin, 0, nCells);
      this.solid = new Uint8Array(nav.bin, nCells);
      this.S = m.solid;
      // reachable[(cell*L)+l]: floors connected to the fight area; rooftops and closed rooms drop out
      this.reach = new Uint8Array(nCells);
    }

    // floor height (three y) of layer l in cell, or NaN
    fh(ix, iy, l) {
      const m = this.nm;
      if (ix < 0 || iy < 0 || ix >= m.nx || iy >= m.ny) return NaN;
      const v = this.floors[(ix * m.ny + iy) * m.layers + l];
      return v === 255 ? NaN : v * m.dz + m.z0;
    }

    cellX(x) { return Math.floor((x - this.nm.x0) / this.nm.cell); }
    cellY(z) { return Math.floor((-z - this.nm.y0) / this.nm.cell); }
    cellCenter(ix, iy) { return { x: this.nm.x0 + (ix + 0.5) * this.nm.cell, z: -(this.nm.y0 + (iy + 0.5) * this.nm.cell) }; }

    // Flood-fill the floors you can walk to from the seeds (three-space points on the ground).
    buildReach(seeds) {
      const m = this.nm, L = m.layers, R = this.reach;
      R.fill(0);
      const q = new Int32Array(m.nx * m.ny * L);
      let qh = 0, qt = 0;
      for (const s of seeds) {
        const ix = this.cellX(s.x), iy = this.cellY(s.z);
        const l = this.layerNear(ix, iy, s.y, true);
        if (l < 0) continue;
        const k = (ix * m.ny + iy) * L + l;
        if (!R[k]) { R[k] = 1; q[qt++] = k; }
      }
      while (qh < qt) {
        const k = q[qh++], l = k % L, c = (k - l) / L, ix = Math.floor(c / m.ny), iy = c % m.ny;
        const h = this.fh(ix, iy, l);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          if (!dx && !dy) continue;
          const jx = ix + dx, jy = iy + dy;
          if (jx < 0 || jy < 0 || jx >= m.nx || jy >= m.ny) continue;
          for (let l2 = 0; l2 < L; l2++) {
            const h2 = this.fh(jx, jy, l2);
            if (isNaN(h2) || Math.abs(h2 - h) > STEP) continue;
            if (dx && dy && (!this.passable(ix + dx, iy, h) || !this.passable(ix, iy + dy, h))) continue;
            const k2 = (jx * m.ny + jy) * L + l2;
            if (!R[k2]) { R[k2] = 1; q[qt++] = k2; }
          }
        }
      }
      let n = 0;
      for (let i = 0; i < R.length; i++) n += R[i];
      this.reachCount = n;
    }

    passable(ix, iy, h) {
      for (let l = 0; l < this.nm.layers; l++) {
        const h2 = this.fh(ix, iy, l);
        if (!isNaN(h2) && Math.abs(h2 - h) <= STEP) return true;
      }
      return false;
    }

    // index of the floor in a cell that a unit at height y would stand on (highest floor at most a step
    // above y, preferring reachable floors), or -1
    layerNear(ix, iy, y, any) {
      let best = -1, bh = -Infinity;
      for (let l = 0; l < this.nm.layers; l++) {
        const h = this.fh(ix, iy, l);
        if (isNaN(h) || h > y + STEP || h < y - 40) continue;
        if (!any && !this.reach[(ix * this.nm.ny + iy) * this.nm.layers + l]) continue;
        if (h > bh) { bh = h; best = l; }
      }
      return best;
    }

    // ground height under (x, z) for something at height y, or NaN if that spot is a wall / off the map
    groundAt(x, z, y) {
      const ix = this.cellX(x), iy = this.cellY(z);
      const l = this.layerNear(ix, iy, y, false);
      return l < 0 ? NaN : this.fh(ix, iy, l);
    }

    // Move a point horizontally by (dx, dz), sliding along walls. Returns the new {x, z, ground}.
    // airborne units may enter cells whose floor is below them (landing) but not walls above.
    slide(p, dx, dz, airborne) {
      const tryAt = (x, z) => {
        const g = this.groundAt(x, z, p.y + (airborne ? 0.2 : 0));
        if (isNaN(g)) return NaN;
        if (!airborne && g < p.y - DROP) return NaN;
        return g;
      };
      const r = 0.35;
      const ok = (x, z) => {
        const g = tryAt(x, z);
        if (isNaN(g)) return NaN;
        // keep a little clearance from walls: probe ahead along the move
        const len = Math.hypot(x - p.x, z - p.z) || 1;
        const px = x + (x - p.x) / len * r, pz = z + (z - p.z) / len * r;
        return isNaN(tryAt(px, pz)) ? NaN : g;
      };
      let g = ok(p.x + dx, p.z + dz);
      if (!isNaN(g)) return { x: p.x + dx, z: p.z + dz, g };
      g = ok(p.x + dx, p.z);
      if (!isNaN(g) && Math.abs(dx) > 1e-4) return { x: p.x + dx, z: p.z, g };
      g = ok(p.x, p.z + dz);
      if (!isNaN(g) && Math.abs(dz) > 1e-4) return { x: p.x, z: p.z + dz, g };
      return { x: p.x, z: p.z, g: this.groundAt(p.x, p.z, p.y), blocked: true };
    }

    // ---------------------------------------------------------------- line of sight
    solidAt(x, y, z) {
      const S = this.S, m = this.nm;
      const ix = Math.floor((x - m.x0) / S.cell), iy = Math.floor((-z - m.y0) / S.cell), iz = Math.floor((y - m.z0) / S.dz);
      if (ix < 0 || iy < 0 || iz < 0 || ix >= S.nx || iy >= S.ny || iz >= S.nz) return false;
      const bit = (ix * S.ny + iy) * S.nz + iz;
      return (this.solid[bit >> 3] >> (7 - (bit & 7))) & 1;
    }

    // true if nothing solid lies between a and b (skipping the ends, where the units themselves stand)
    los(a, b, skip = 0.9) {
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz);
      if (d < 2 * skip) return true;
      const n = Math.ceil(d / 0.45);
      for (let i = 0; i <= n; i++) {
        const t = i / n, s = t * d;
        if (s < skip || s > d - skip) continue;
        if (this.solidAt(a.x + dx * t, a.y + dy * t, a.z + dz * t)) return false;
      }
      return true;
    }

    // distance along the ray until something solid (or max)
    rayDist(a, dir, max) {
      for (let s = 0.6; s < max; s += 0.4) {
        if (this.solidAt(a.x + dir.x * s, a.y + dir.y * s, a.z + dir.z * s)) return s;
      }
      return max;
    }

    // ---------------------------------------------------------------- pathfinding (A* over reachable floors)
    findPath(from, to, maxNodes = 9000) {
      const m = this.nm, L = m.layers;
      const sx = this.cellX(from.x), sy = this.cellY(from.z), tx = this.cellX(to.x), ty = this.cellY(to.z);
      let sl = this.layerNear(sx, sy, from.y + 0.1, false);
      let tl = this.layerNear(tx, ty, to.y + 0.1, false);
      if (sl < 0 || tl < 0) return null;
      const key = (x, y, l) => (x * m.ny + y) * L + l;
      const start = key(sx, sy, sl), goal = key(tx, ty, tl);
      const open = new Heap(), came = new Map(), gs = new Map();
      gs.set(start, 0);
      open.push(start, 0);
      let n = 0;
      while (open.size && n++ < maxNodes) {
        const k = open.pop();
        if (k === goal) break;
        const l = k % L, c = (k - l) / L, ix = Math.floor(c / m.ny), iy = c % m.ny, h = this.fh(ix, iy, l);
        const gk = gs.get(k);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          if (!dx && !dy) continue;
          const jx = ix + dx, jy = iy + dy;
          for (let l2 = 0; l2 < L; l2++) {
            const k2 = key(jx, jy, l2);
            if (jx < 0 || jy < 0 || jx >= m.nx || jy >= m.ny || !this.reach[k2]) continue;
            const h2 = this.fh(jx, jy, l2);
            if (Math.abs(h2 - h) > STEP) continue;
            const g2 = gk + (dx && dy ? 1.414 : 1) + Math.abs(h2 - h) * 0.5;
            if (g2 < (gs.has(k2) ? gs.get(k2) : Infinity)) {
              gs.set(k2, g2); came.set(k2, k);
              open.push(k2, g2 + Math.hypot(tx - jx, ty - jy));
            }
          }
        }
      }
      if (!came.has(goal)) return null;
      const pts = [];
      for (let k = goal; k !== start; k = came.get(k)) {
        const l = k % L, c = (k - l) / L, ix = Math.floor(c / m.ny), iy = c % m.ny;
        const cc = this.cellCenter(ix, iy);
        pts.push(new THREE.Vector3(cc.x, this.fh(ix, iy, l), cc.z));
      }
      pts.reverse();
      // thin the path: keep points where walking straight would leave the floor
      const out = [];
      let anchor = new THREE.Vector3(from.x, from.y, from.z);
      for (let i = 0; i < pts.length; i++) {
        if (i === pts.length - 1 || !this.walkable(anchor, pts[i + 1])) { out.push(pts[i]); anchor = pts[i]; }
      }
      return out;
    }

    // can you walk in a straight line from a to b?
    walkable(a, b) {
      const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / 0.35);
      let y = a.y;
      for (let i = 1; i <= n; i++) {
        const t = i / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
        const g = this.groundAt(x, z, y);
        if (isNaN(g) || g < y - 1.2) return false;
        y = g;
      }
      return true;
    }
  }

  class Heap {
    constructor() { this.k = []; this.p = []; }
    get size() { return this.k.length; }
    push(k, p) {
      const K = this.k, P = this.p;
      K.push(k); P.push(p);
      let i = K.length - 1;
      while (i > 0) {
        const j = (i - 1) >> 1;
        if (P[j] <= p) break;
        K[i] = K[j]; P[i] = P[j]; i = j;
      }
      K[i] = k; P[i] = p;
    }
    pop() {
      const K = this.k, P = this.p, top = K[0], lk = K.pop(), lp = P.pop();
      if (K.length) {
        let i = 0;
        for (;;) {
          let j = 2 * i + 1;
          if (j >= K.length) break;
          if (j + 1 < K.length && P[j + 1] < P[j]) j++;
          if (P[j] >= lp) break;
          K[i] = K[j]; P[i] = P[j]; i = j;
        }
        K[i] = lk; P[i] = lp;
      }
      return top;
    }
  }

  G.World = World;
})(window.G = window.G || {});

// Walking on the game's map: its own collision (the zone's .pcb triangles, from tools/export_map.py) decides what you
// stand on and what you bump into. You keep to the highest floor under your feet within a step's height (stairs and
// ramps carry you up, small drops down), slide along walls and railings, fall off ledges, and can't walk onto the
// water: nothing below the waterline (the seabed, the pilings) counts as floor. The engine moves through it when the
// map is on (engine.world).
(function (B) {
  const CELL = 2;                  // grid cell, yalms
  const STEP = 0.55;               // the highest step you walk up
  const WALK = 0.55;               // a floor's normal is at least this upright (about 57 degrees of slope)
  const BODY = [0.8, 1.45];        // the heights of the two spheres that bump into walls
  const RADIUS = 0.35;
  const GRAVITY = 28;
  const SUB = 0.2;                 // longest sub-step, so a thin wall can't be skipped

  class MapWorld {
    // tris: Float32Array of triangles, 9 numbers each, in the sim's frame; sea: the water's height (or null).
    constructor(tris, sea) {
      this.lowest = typeof sea === 'number' ? sea + 0.3 : -Infinity;
      const n = tris.length / 9;
      this.t = tris;
      this.n = new Float32Array(n * 3);
      this.cells = new Map();
      this.stamp = new Uint32Array(n);
      this.mark = 0;
      for (let i = 0; i < n; i++) {
        const o = i * 9;
        const ax = tris[o + 3] - tris[o], ay = tris[o + 4] - tris[o + 1], az = tris[o + 5] - tris[o + 2];
        const bx = tris[o + 6] - tris[o], by = tris[o + 7] - tris[o + 1], bz = tris[o + 8] - tris[o + 2];
        let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        const l = Math.hypot(nx, ny, nz) || 1;
        this.n[i * 3] = nx / l; this.n[i * 3 + 1] = ny / l; this.n[i * 3 + 2] = nz / l;
        const x0 = Math.floor(Math.min(tris[o], tris[o + 3], tris[o + 6]) / CELL), x1 = Math.floor(Math.max(tris[o], tris[o + 3], tris[o + 6]) / CELL);
        const z0 = Math.floor(Math.min(tris[o + 2], tris[o + 5], tris[o + 8]) / CELL), z1 = Math.floor(Math.max(tris[o + 2], tris[o + 5], tris[o + 8]) / CELL);
        for (let cx = x0; cx <= x1; cx++) {
          for (let cz = z0; cz <= z1; cz++) {
            const k = this.key(cx, cz);
            let c = this.cells.get(k);
            if (!c) this.cells.set(k, (c = []));
            c.push(i);
          }
        }
      }
      this.vy = 0;
      this.good = null;
    }

    key(cx, cz) { return (cx + 32768) * 65536 + (cz + 32768); }

    // The triangles whose cells touch the square of half-size r around (x, z), each once.
    near(x, z, r) {
      const out = [];
      this.mark++;
      const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
      const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cz = z0; cz <= z1; cz++) {
          const c = this.cells.get(this.key(cx, cz));
          if (!c) continue;
          for (const i of c) if (this.stamp[i] !== this.mark) { this.stamp[i] = this.mark; out.push(i); }
        }
      }
      return out;
    }

    // The highest floor under (x, z) no higher than `top`, or null (the water, or off the map).
    floor(x, z, top) {
      const t = this.t;
      let best = null;
      for (const i of this.near(x, z, 0)) {
        if (Math.abs(this.n[i * 3 + 1]) < WALK) continue;
        const o = i * 9;
        const x0 = t[o], z0 = t[o + 2], x1 = t[o + 3], z1 = t[o + 5], x2 = t[o + 6], z2 = t[o + 8];
        const d = (z1 - z2) * (x0 - x2) + (x2 - x1) * (z0 - z2);
        if (Math.abs(d) < 1e-9) continue;
        const a = ((z1 - z2) * (x - x2) + (x2 - x1) * (z - z2)) / d;
        const b = ((z2 - z0) * (x - x2) + (x0 - x2) * (z - z2)) / d;
        const c = 1 - a - b;
        if (a < -1e-4 || b < -1e-4 || c < -1e-4) continue;
        const y = a * t[o + 1] + b * t[o + 4] + c * t[o + 7];
        if (y <= top + 1e-3 && y >= this.lowest && (best === null || y > best)) best = y;
      }
      return best;
    }

    // Moves (x, z) out of any wall the body spheres at height y touch; returns the new point.
    pushOut(x, z, y) {
      const t = this.t, q = { x: 0, y: 0, z: 0 };
      for (let it = 0; it < 3; it++) {
        let moved = false;
        for (const i of this.near(x, z, RADIUS + 0.05)) {
          if (Math.abs(this.n[i * 3 + 1]) >= WALK) continue;      // floors aren't walls
          for (const h of BODY) {
            const cy = y + h;
            closest(t, i * 9, x, cy, z, q);
            const dx = x - q.x, dy = cy - q.y, dz = z - q.z;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 >= RADIUS * RADIUS) continue;
            let hx = dx, hz = dz, hl = Math.hypot(hx, hz);
            if (hl < 1e-5) { hx = this.n[i * 3]; hz = this.n[i * 3 + 2]; hl = Math.hypot(hx, hz); }
            if (hl < 1e-6) continue;
            const push = RADIUS - Math.sqrt(d2);
            x += hx / hl * push; z += hz / hl * push;
            moved = true;
          }
        }
        if (!moved) break;
      }
      return { x, z };
    }

    // One small step toward (x, z): out of the walls, onto the floor there. False where there's no floor to stand on.
    stepTo(pos, x, z) {
      const p = this.pushOut(x, z, pos.y);
      const f = this.floor(p.x, p.z, pos.y + STEP);
      if (f === null) return false;
      pos.x = p.x; pos.z = p.z;
      if (this.vy === 0 && f >= pos.y - STEP) pos.y = f;     // up the stairs, down a small step; off a ledge you fall
      return true;
    }

    // Walking (dx, dz) this frame, in small steps, sliding along whatever blocks the way.
    walk(pos, dx, dz) {
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / SUB));
      const sx = dx / steps, sz = dz / steps;
      for (let k = 0; k < steps; k++) {
        if (!this.stepTo(pos, pos.x + sx, pos.z + sz) && !this.stepTo(pos, pos.x + sx, pos.z)) this.stepTo(pos, pos.x, pos.z + sz);
      }
    }

    // Every frame: gravity down to the floor. A dash that ends over the water puts you back where you last stood.
    fall(pos, dt) {
      if (typeof pos.y !== 'number') pos.y = 0;
      const f = this.floor(pos.x, pos.z, pos.y + STEP);      // a little under the surface counts as on it
      if (f === null) {
        const g = this.good || { x: 0, y: 0, z: -10 };
        pos.x = g.x; pos.y = g.y; pos.z = g.z;
        this.vy = 0;
        return;
      }
      if (pos.y > f + 1e-3) {
        this.vy -= GRAVITY * dt;
        pos.y = Math.max(f, pos.y + this.vy * dt);
        if (pos.y <= f) this.vy = 0;
      } else {
        pos.y = f;
        this.vy = 0;
      }
      if (this.vy === 0) this.good = { x: pos.x, y: pos.y, z: pos.z };
    }
  }

  // The closest point on triangle (t at o) to p, into q (Ericson, Real-Time Collision Detection 5.1.5).
  function closest(t, o, px, py, pz, q) {
    const ax = t[o], ay = t[o + 1], az = t[o + 2], bx = t[o + 3], by = t[o + 4], bz = t[o + 5], cx = t[o + 6], cy = t[o + 7], cz = t[o + 8];
    const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az;
    const apx = px - ax, apy = py - ay, apz = pz - az;
    const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
    if (d1 <= 0 && d2 <= 0) { q.x = ax; q.y = ay; q.z = az; return; }
    const bpx = px - bx, bpy = py - by, bpz = pz - bz;
    const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) { q.x = bx; q.y = by; q.z = bz; return; }
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); q.x = ax + v * abx; q.y = ay + v * aby; q.z = az + v * abz; return; }
    const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
    const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
    if (d6 >= 0 && d5 <= d6) { q.x = cx; q.y = cy; q.z = cz; return; }
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); q.x = ax + w * acx; q.y = ay + w * acy; q.z = az + w * acz; return; }
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
      const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
      q.x = bx + w * (cx - bx); q.y = by + w * (cy - by); q.z = bz + w * (cz - bz); return;
    }
    const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
    q.x = ax + abx * v + acx * w; q.y = ay + aby * v + acy * w; q.z = az + abz * v + acz * w;
  }

  B.MapWorld = MapWorld;
})(window.BLM);

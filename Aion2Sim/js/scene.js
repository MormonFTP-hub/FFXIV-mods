// The training ground, drawn on a 2D canvas in a slight top-down tilt: the dummy at the centre facing the camera,
// its back half shaded (where back attacks land), you, and the hits. World units are metres; +y is towards the camera.
(function () {
  'use strict';
  const A2 = window.A2 = window.A2 || {};
  const TILT = 0.62;          // vertical squash of the ground plane
  const ARENA = 15;           // radius of the platform, m

  const S = A2.Scene = {
    cv: null, c: null, w: 0, h: 0, dpr: 1, scale: 30, cx: 0, cy: 0,
    floats: [], slashes: [], trails: [], t: 0, ground: null, hue: 270,
  };

  S.init = function (canvas) {
    S.cv = canvas;
    S.c = canvas.getContext('2d');
    S.resize();
    window.addEventListener('resize', S.resize);
  };

  S.resize = function () {
    const r = S.cv.getBoundingClientRect();
    S.dpr = Math.min(2, window.devicePixelRatio || 1);
    S.w = Math.max(1, r.width);
    S.h = Math.max(1, r.height);
    S.cv.width = Math.round(S.w * S.dpr);
    S.cv.height = Math.round(S.h * S.dpr);
    // Fit about 18 m across the short side, a bit closer on wide screens.
    S.scale = Math.max(16, Math.min(S.w / 20, S.h / (13 * TILT + 6)));
    S.cx = S.w / 2;
    S.cy = S.h * (S.w < 760 ? 0.44 : 0.5);
    S.ground = null;
  };

  S.toScreen = (x, y, z) => [S.cx + x * S.scale, S.cy + y * S.scale * TILT - (z || 0) * S.scale];
  S.toWorld = (sx, sy) => [(sx - S.cx) / S.scale, (sy - S.cy) / (S.scale * TILT)];
  S.pick = function (clientX, clientY) {
    const r = S.cv.getBoundingClientRect();
    return S.toWorld(clientX - r.left, clientY - r.top);
  };

  // --- effects the sim asks for -----------------------------------------------------------

  S.onDamage = function (ev, sim) {
    const [x, y] = S.toScreen(sim.tg.x + (Math.random() - 0.5) * 1.2, sim.tg.y, 2.3 + Math.random() * 0.4);
    S.floats.push({x, y, t: 0, life: ev.crit ? 1.25 : 1.0, txt: A2.int(ev.amt), crit: ev.crit, back: ev.back,
                   multi: ev.multi, dot: ev.dot, proc: ev.proc, hue: ev.hue});
    if (S.floats.length > 60) S.floats.shift();
    if (!ev.dot && !ev.proc) S.slashes.push({t: 0, a: Math.random() * Math.PI, hue: ev.hue == null ? S.hue : ev.hue, big: ev.crit});
  };
  S.onMove = function (from, to) {
    S.trails.push({from: from.slice(), to: to.slice(), t: 0});
  };
  S.onText = function (txt, color) {
    const [x, y] = S.toScreen(0, 0, 3.4);
    S.floats.push({x, y, t: 0, life: 1.3, txt, label: true, color});
  };
  S.reset = function () { S.floats = []; S.slashes = []; S.trails = []; };

  // --- drawing ---------------------------------------------------------------------------

  function paintGround() {
    const g = document.createElement('canvas');
    g.width = S.cv.width; g.height = S.cv.height;
    const c = g.getContext('2d');
    c.scale(S.dpr, S.dpr);
    const sky = c.createLinearGradient(0, 0, 0, S.h);
    sky.addColorStop(0, '#0a0e1c');
    sky.addColorStop(1, '#101631');
    c.fillStyle = sky;
    c.fillRect(0, 0, S.w, S.h);
    // drifting aether motes
    const rnd = A2.rng(7);
    for (let i = 0; i < 90; i++) {
      c.fillStyle = `hsla(${200 + rnd() * 80} 80% 75% / ${0.08 + rnd() * 0.25})`;
      c.beginPath();
      c.arc(rnd() * S.w, rnd() * S.h, 0.6 + rnd() * 1.6, 0, 6.29);
      c.fill();
    }
    // the platform: a disc with its rim and carved rings
    const [cx, cy] = S.toScreen(0, 0);
    const R = ARENA * S.scale;
    c.save();
    c.translate(cx, cy);
    c.scale(1, TILT);
    c.fillStyle = '#0a0f20';
    c.beginPath(); c.arc(0, 14 / TILT, R + 6, 0, 6.29); c.fill();          // the rim's side
    const floor = c.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
    floor.addColorStop(0, '#1d2747');
    floor.addColorStop(0.7, '#151d38');
    floor.addColorStop(1, '#111830');
    c.fillStyle = floor;
    c.beginPath(); c.arc(0, 0, R, 0, 6.29); c.fill();
    c.strokeStyle = 'rgba(230,187,106,0.35)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, R - 2, 0, 6.29); c.stroke();
    c.strokeStyle = 'rgba(140,160,230,0.10)';
    c.lineWidth = 1;
    for (const k of [0.25, 0.5, 0.75]) { c.beginPath(); c.arc(0, 0, R * k, 0, 6.29); c.stroke(); }
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      c.beginPath(); c.moveTo(Math.cos(a) * R * 0.25, Math.sin(a) * R * 0.25); c.lineTo(Math.cos(a) * R * 0.97, Math.sin(a) * R * 0.97); c.stroke();
    }
    // rune ticks on the rim
    c.fillStyle = 'rgba(230,187,106,0.25)';
    for (let i = 0; i < 48; i++) {
      const a = i * Math.PI / 24;
      c.save(); c.rotate(a); c.fillRect(R - 12, -1.5, i % 4 ? 5 : 9, 3); c.restore();
    }
    c.restore();
    S.ground = g;
  }

  function wedge(c, x, y, r, a0, a1, fill) {
    c.save();
    c.translate(x, y);
    c.scale(1, TILT);
    c.fillStyle = fill;
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, a0, a1); c.closePath(); c.fill();
    c.restore();
  }

  function ring(c, x, y, r, stroke, w, dash) {
    c.save();
    c.translate(x, y);
    c.scale(1, TILT);
    c.strokeStyle = stroke;
    c.lineWidth = w;
    if (dash) c.setLineDash(dash);
    c.beginPath(); c.arc(0, 0, r, 0, 6.29); c.stroke();
    c.restore();
  }

  function shadow(c, x, y, r) {
    c.save();
    c.translate(x, y);
    c.scale(1, TILT * 0.8);
    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.beginPath(); c.arc(0, 0, r, 0, 6.29); c.fill();
    c.restore();
  }

  function drawDummy(c, sim) {
    const tg = sim.tg;
    const [x, y] = S.toScreen(tg.x, tg.y);
    const k = S.scale;
    const broken = sim.t < tg.brokenUntil;
    const hitShake = Math.max(0, tg.flash) * 3;
    const ox = (Math.random() - 0.5) * hitShake;
    // back-attack zone: the half (or the arc set by the engine) behind the dummy
    const back = tg.face + Math.PI;
    const half = sim.BACK_ARC / 2;
    wedge(c, x, y, k * (tg.r + 4.2), back - half, back + half, sim.isBack() ? 'rgba(230,187,106,0.20)' : 'rgba(230,187,106,0.09)');
    ring(c, x, y, k * (tg.r + 4), 'rgba(230,187,106,0.28)', 1, [4, 6]);
    shadow(c, x, y + 2, k * 0.9);
    // post, arms, head
    c.save();
    c.translate(x + ox, y);
    const wood = c.createLinearGradient(-k * 0.3, 0, k * 0.3, 0);
    wood.addColorStop(0, '#5b4632'); wood.addColorStop(0.5, '#8a6a49'); wood.addColorStop(1, '#4a3828');
    c.fillStyle = wood;
    c.fillRect(-k * 0.22, -k * 2.0, k * 0.44, k * 2.0);
    c.fillStyle = '#3a2c20';
    c.fillRect(-k * 0.9, -k * 1.55, k * 1.8, k * 0.22);
    c.fillStyle = broken ? '#f2d58c' : '#a3815a';
    c.beginPath(); c.ellipse(0, -k * 1.05, k * 0.55, k * 0.7, 0, 0, 6.29); c.fill();     // straw body
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 2;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(-k * 0.5, -k * 1.05 + i * k * 0.2); c.lineTo(k * 0.5, -k * 1.05 + i * k * 0.2); c.stroke(); }
    c.fillStyle = '#c9a77a';
    c.beginPath(); c.arc(0, -k * 2.15, k * 0.34, 0, 6.29); c.fill();
    // facing mark: a painted target on its chest when it faces the camera
    const fy = Math.sin(tg.face);
    if (fy > 0) {
      c.strokeStyle = `rgba(196,65,59,${0.4 + fy * 0.5})`;
      c.lineWidth = 3;
      c.beginPath(); c.arc(Math.cos(tg.face) * k * 0.2, -k * 1.05, k * 0.22, 0, 6.29); c.stroke();
    }
    if (tg.flash > 0) {
      c.fillStyle = `rgba(255,255,255,${tg.flash * 0.35})`;
      c.beginPath(); c.ellipse(0, -k * 1.05, k * 0.6, k * 0.75, 0, 0, 6.29); c.fill();
    }
    c.restore();
    // facing arrow on the ground
    const [ax, ay] = S.toScreen(tg.x + Math.cos(tg.face) * (tg.r + 0.6), tg.y + Math.sin(tg.face) * (tg.r + 0.6));
    c.fillStyle = 'rgba(196,65,59,0.8)';
    c.beginPath();
    const a = Math.atan2(Math.sin(tg.face) * TILT, Math.cos(tg.face));
    c.moveTo(ax + Math.cos(a) * 9, ay + Math.sin(a) * 9);
    c.lineTo(ax + Math.cos(a + 2.4) * 7, ay + Math.sin(a + 2.4) * 7);
    c.lineTo(ax + Math.cos(a - 2.4) * 7, ay + Math.sin(a - 2.4) * 7);
    c.fill();
    // stack pips (Insignia and the like) over its head
    const pips = sim.cls.pips ? sim.cls.pips(sim) : null;
    if (pips && pips.max) {
      const [hx, hy] = S.toScreen(tg.x, tg.y, 2.75);
      for (let i = 0; i < pips.max; i++) {
        const px = hx + (i - (pips.max - 1) / 2) * 15;
        c.save();
        c.translate(px, hy);
        c.rotate(Math.PI / 4);
        c.fillStyle = i < pips.n ? pips.color : 'rgba(255,255,255,0.12)';
        c.strokeStyle = 'rgba(0,0,0,0.6)';
        c.lineWidth = 1.5;
        c.fillRect(-5, -5, 10, 10);
        c.strokeRect(-5, -5, 10, 10);
        c.restore();
      }
    }
  }

  function drawPlayer(c, sim) {
    const p = sim.p;
    const [x, y] = S.toScreen(p.x, p.y);
    const k = S.scale;
    const hue = sim.cls.hue == null ? 270 : sim.cls.hue;
    shadow(c, x, y + 1, k * 0.5);
    const face = Math.atan2(sim.tg.y - p.y, sim.tg.x - p.x);
    // facing wedge on the ground
    c.save();
    c.translate(x, y);
    c.scale(1, TILT);
    c.fillStyle = `hsla(${hue} 90% 70% / 0.35)`;
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, k * 0.95, face - 0.45, face + 0.45); c.closePath(); c.fill();
    c.restore();
    const bob = p.moving ? Math.sin(S.t * 14) * 1.5 : 0;
    c.save();
    c.translate(x, y + bob);
    if (sim.p.stealth > sim.t) c.globalAlpha = 0.45;
    const body = c.createLinearGradient(0, -k * 1.7, 0, 0);
    body.addColorStop(0, `hsl(${hue} 50% 62%)`);
    body.addColorStop(1, `hsl(${hue} 45% 26%)`);
    c.fillStyle = body;
    c.beginPath();
    c.moveTo(-k * 0.32, 0); c.lineTo(-k * 0.38, -k * 1.1); c.quadraticCurveTo(0, -k * 1.45, k * 0.38, -k * 1.1); c.lineTo(k * 0.32, 0);
    c.closePath(); c.fill();
    c.fillStyle = '#e8d3c0';
    c.beginPath(); c.arc(0, -k * 1.55, k * 0.24, 0, 6.29); c.fill();
    // wings of light while a buff that raises combat speed is up (every Daeva's favourite look)
    if (sim.p.speedBuff) {
      c.fillStyle = `hsla(${hue} 90% 80% / 0.35)`;
      for (const s of [-1, 1]) {
        c.beginPath(); c.moveTo(0, -k * 1.15);
        c.quadraticCurveTo(s * k * 1.2, -k * 2.0, s * k * 1.1, -k * 0.7);
        c.quadraticCurveTo(s * k * 0.6, -k * 0.9, 0, -k * 0.9);
        c.fill();
      }
    }
    c.restore();
    // cast/animation tick over the head
    const lock = sim.p.lockUntil - sim.t;
    if (lock > 0 && sim.p.lockLen > 0) {
      const f = 1 - lock / sim.p.lockLen;
      c.strokeStyle = 'rgba(230,187,106,0.8)';
      c.lineWidth = 3;
      c.beginPath(); c.arc(x, y - k * 2.05, 7, -Math.PI / 2, -Math.PI / 2 + f * 6.283); c.stroke();
    }
    // click-to-move marker
    if (p.goal) {
      const [gx, gy] = S.toScreen(p.goal[0], p.goal[1]);
      ring(c, gx, gy, 8, 'rgba(108,210,255,0.6)', 2);
    }
  }

  function drawFx(c, sim, dt) {
    const [tx, ty] = S.toScreen(sim.tg.x, sim.tg.y, 1.1);
    for (const s of S.slashes) {
      s.t += dt;
      const f = s.t / 0.22;
      if (f > 1) continue;
      c.save();
      c.translate(tx, ty);
      c.rotate(s.a);
      c.strokeStyle = `hsla(${s.hue} 95% ${s.big ? 85 : 75}% / ${1 - f})`;
      c.lineWidth = (s.big ? 5 : 3) * (1 - f) + 1;
      c.beginPath();
      c.arc(0, 0, S.scale * (0.8 + f * 0.6), -0.9, 0.9);
      c.stroke();
      c.restore();
    }
    S.slashes = S.slashes.filter((s) => s.t < 0.22);
    for (const tr of S.trails) {
      tr.t += dt;
      const f = tr.t / 0.35;
      const [x1, y1] = S.toScreen(tr.from[0], tr.from[1], 0.8);
      const [x2, y2] = S.toScreen(tr.to[0], tr.to[1], 0.8);
      c.strokeStyle = `hsla(${S.hue} 90% 75% / ${0.7 * (1 - f)})`;
      c.lineWidth = 6 * (1 - f);
      c.lineCap = 'round';
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    }
    S.trails = S.trails.filter((tr) => tr.t < 0.35);
    c.textAlign = 'center';
    for (const f of S.floats) {
      f.t += dt;
      const k = f.t / f.life;
      if (k >= 1) continue;
      const rise = f.label ? 26 * k : 46 * k;
      const alpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      c.globalAlpha = alpha;
      const size = f.label ? 15 : f.crit ? 26 : f.dot || f.proc ? 15 : 19;
      c.font = `700 ${size}px 'Barlow Semi Condensed', 'Barlow', sans-serif`;
      c.lineWidth = 4;
      c.strokeStyle = 'rgba(0,0,0,0.85)';
      const color = f.label ? (f.color || '#e6bb6a') : f.crit ? '#ffcf5c' : f.dot ? '#8fe0a7' : f.proc ? '#c7b8ff' : '#f2f4fb';
      const txt = f.txt + (f.crit && !f.label ? '!' : '');
      const yy = f.y - rise;
      const pop = f.crit && k < 0.12 ? 1 + (0.12 - k) * 3 : 1;
      c.save();
      c.translate(f.x, yy);
      c.scale(pop, pop);
      c.strokeText(txt, 0, 0);
      c.fillStyle = color;
      c.fillText(txt, 0, 0);
      if (f.back || f.multi) {
        c.font = `600 11px 'Barlow Semi Condensed', sans-serif`;
        const tag = [f.back ? 'BACK' : '', f.multi ? `×${f.multi}` : ''].filter(Boolean).join(' ');
        c.strokeText(tag, 0, 13);
        c.fillStyle = f.back ? '#e6bb6a' : '#6cd2ff';
        c.fillText(tag, 0, 13);
      }
      c.restore();
      c.globalAlpha = 1;
    }
    S.floats = S.floats.filter((f) => f.t < f.life);
  }

  S.draw = function (sim, dt) {
    S.t += dt;
    if (!S.ground) paintGround();
    const c = S.c;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(S.ground, 0, 0);
    c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    S.hue = sim.cls.hue == null ? 270 : sim.cls.hue;
    sim.tg.flash = Math.max(0, (sim.tg.flash || 0) - dt * 5);
    // draw whichever of the two is further from the camera first
    if (sim.p.y < sim.tg.y) { drawPlayer(c, sim); drawDummy(c, sim); } else { drawDummy(c, sim); drawPlayer(c, sim); }
    drawFx(c, sim, dt);
  };
})();

// Drawn skill icons: a glyph on a tinted plate, so the sim needs no game art. A skill names its glyph and hue
// (`icon: 'slash'`, `hue: 270`); A2.icon() draws it once at 96 px and caches the canvas.
(function () {
  'use strict';
  const A2 = window.A2 = window.A2 || {};
  const S = 96;
  const cache = {};

  const G = {
    slash(c) { arc(c, 48, 60, 40, -2.6, -0.5, 7); arc(c, 40, 70, 30, -2.4, -0.6, 4); },
    cross(c) { line(c, 22, 22, 74, 74, 9); line(c, 74, 22, 22, 74, 9); },
    dagger(c) { poly(c, [[48, 10], [56, 58], [48, 66], [40, 58]]); rect(c, 30, 62, 36, 7); rect(c, 44, 69, 8, 18); },
    twin(c) { c.save(); c.translate(48, 48); c.rotate(-0.5); poly(c, [[-12, -36], [-6, 14], [-18, 14]]); c.rotate(1); poly(c, [[12, -36], [18, 14], [6, 14]]); c.restore(); },
    fang(c) { poly(c, [[20, 20], [40, 76], [48, 34], [56, 76], [76, 20], [48, 44]]); },
    roar(c) { for (let i = 0; i < 3; i++) arc(c, 30, 48, 18 + i * 14, -0.9, 0.9, 6); dot(c, 26, 48, 7); },
    burst(c) { star(c, 48, 48, 38, 14, 8); },
    star(c) { star(c, 48, 48, 36, 16, 5); },
    shadow(c) { c.beginPath(); c.arc(48, 48, 32, 0.6, 5.7); c.arc(62, 44, 26, 5.4, 0.9, true); c.closePath(); c.fill(); },
    step(c) { poly(c, [[16, 70], [36, 26], [46, 26], [30, 70]]); poly(c, [[44, 70], [64, 26], [80, 26], [60, 70]]); },
    dash(c) { for (let i = 0; i < 3; i++) line(c, 16 + i * 6, 32 + i * 14, 54 + i * 6, 32 + i * 14, 5); poly(c, [[60, 22], [84, 48], [60, 74]]); },
    whirl(c) { for (let i = 0; i < 3; i++) arc(c, 48, 48, 12 + i * 11, i * 2.1, i * 2.1 + 3.6, 6); },
    eye(c) { c.beginPath(); c.moveTo(12, 48); c.quadraticCurveTo(48, 12, 84, 48); c.quadraticCurveTo(48, 84, 12, 48); c.fill(); hole(c, 48, 48, 13); },
    clone(c) { c.globalAlpha = 0.45; figure(c, 34); c.globalAlpha = 1; figure(c, 56); },
    smoke(c) { dot(c, 34, 56, 18); dot(c, 54, 46, 22); dot(c, 64, 64, 15); dot(c, 42, 36, 12); },
    poison(c) { c.beginPath(); c.moveTo(48, 12); c.bezierCurveTo(70, 44, 74, 54, 74, 62); c.arc(48, 62, 26, 0, Math.PI); c.bezierCurveTo(22, 54, 26, 44, 48, 12); c.fill(); hole(c, 56, 64, 7); },
    wing(c) { for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(48 - i * 2, 30 + i * 12, 34 - i * 5, 7, -0.35, 0, 6.29); c.fill(); } },
    shield(c) { c.beginPath(); c.moveTo(48, 12); c.lineTo(80, 24); c.quadraticCurveTo(78, 64, 48, 86); c.quadraticCurveTo(18, 64, 16, 24); c.closePath(); c.fill(); },
    sword(c) { poly(c, [[48, 8], [55, 20], [53, 64], [43, 64], [41, 20]]); rect(c, 28, 64, 40, 7); rect(c, 44, 71, 8, 16); },
    axe(c) { rect(c, 45, 14, 7, 72); c.beginPath(); c.moveTo(50, 18); c.quadraticCurveTo(86, 22, 82, 54); c.quadraticCurveTo(66, 40, 50, 46); c.fill(); },
    hammer(c) { rect(c, 45, 34, 7, 54); rect(c, 22, 14, 52, 26); },
    bow(c) { arc(c, 30, 48, 38, -1.2, 1.2, 6); line(c, 43, 13, 43, 83, 2); line(c, 20, 48, 84, 48, 4); poly(c, [[84, 48], [72, 40], [72, 56]]); },
    arrow(c) { line(c, 14, 82, 70, 26, 6); poly(c, [[82, 14], [60, 22], [74, 36]]); line(c, 14, 82, 24, 62, 4); line(c, 14, 82, 34, 72, 4); },
    flame(c) { c.beginPath(); c.moveTo(48, 10); c.bezierCurveTo(78, 40, 76, 60, 70, 70); c.arc(48, 64, 24, 0.2, Math.PI - 0.2); c.bezierCurveTo(20, 60, 22, 46, 34, 34); c.bezierCurveTo(36, 46, 42, 50, 46, 50); c.bezierCurveTo(40, 34, 44, 22, 48, 10); c.fill(); },
    ice(c) { for (let i = 0; i < 3; i++) { c.save(); c.translate(48, 48); c.rotate(i * Math.PI / 3); rect(c, -4, -38, 8, 76); c.restore(); } },
    bolt(c) { poly(c, [[56, 8], [24, 54], [44, 54], [36, 88], [72, 38], [52, 38]]); },
    orb(c) { dot(c, 48, 48, 30); hole(c, 40, 40, 9); },
    spirit(c) { c.beginPath(); c.arc(48, 40, 24, Math.PI, 0); c.lineTo(72, 78); c.lineTo(62, 70); c.lineTo(54, 80); c.lineTo(48, 70); c.lineTo(40, 80); c.lineTo(32, 70); c.lineTo(24, 78); c.closePath(); c.fill(); hole(c, 40, 42, 5); hole(c, 56, 42, 5); },
    rock(c) { poly(c, [[20, 74], [26, 40], [44, 22], [66, 30], [78, 58], [70, 76]]); },
    wind(c) { for (let i = 0; i < 3; i++) { c.lineWidth = 6; c.beginPath(); c.moveTo(14, 30 + i * 18); c.lineTo(62 - i * 8, 30 + i * 18); c.arc(62 - i * 8, 22 + i * 18, 8, Math.PI / 2, -Math.PI / 2, true); c.stroke(); } },
    leaf(c) { c.beginPath(); c.moveTo(18, 78); c.quadraticCurveTo(18, 18, 80, 16); c.quadraticCurveTo(78, 76, 18, 78); c.fill(); line(c, 18, 78, 60, 36, 3, true); },
    heal(c) { rect(c, 40, 16, 16, 64); rect(c, 16, 40, 64, 16); },
    light(c) { star(c, 48, 48, 40, 8, 12); dot(c, 48, 48, 14); },
    chain(c) { for (let i = 0; i < 3; i++) { c.lineWidth = 7; c.beginPath(); c.ellipse(26 + i * 22, 48 + (i % 2 ? -8 : 8), 14, 9, 0.5, 0, 6.29); c.stroke(); } },
    note(c) { dot(c, 32, 70, 12); dot(c, 66, 62, 12); rect(c, 40, 20, 6, 50); rect(c, 74, 14, 6, 48); poly(c, [[40, 20], [80, 12], [80, 24], [40, 32]]); },
    staff(c) { line(c, 26, 86, 62, 26, 7); dot(c, 66, 22, 12); },
    mace(c) { line(c, 26, 86, 56, 40, 7); star(c, 62, 32, 22, 12, 8); },
    fist(c) { rect(c, 24, 30, 48, 36); for (let i = 0; i < 4; i++) rect(c, 26 + i * 12, 22, 10, 12); rect(c, 18, 44, 10, 22); },
    target(c) { c.lineWidth = 6; for (const r of [34, 20]) { c.beginPath(); c.arc(48, 48, r, 0, 6.29); c.stroke(); } dot(c, 48, 48, 7); },
    break(c) { poly(c, [[48, 10], [58, 40], [86, 44], [62, 58], [70, 86], [48, 68], [26, 86], [34, 58], [10, 44], [38, 40]]); hole(c, 48, 50, 9); },
    rune(c) { c.lineWidth = 6; c.beginPath(); c.arc(48, 48, 32, 0, 6.29); c.stroke(); poly(c, [[48, 22], [66, 58], [30, 58]]); hole(c, 48, 48, 6); },
    up(c) { poly(c, [[48, 14], [80, 48], [60, 48], [60, 82], [36, 82], [36, 48], [16, 48]]); },
    clock(c) { c.lineWidth = 7; c.beginPath(); c.arc(48, 48, 32, 0, 6.29); c.stroke(); line(c, 48, 48, 48, 26, 6); line(c, 48, 48, 64, 56, 6); },
  };

  function line(c, x1, y1, x2, y2, w, dark) {
    c.save(); if (dark) c.strokeStyle = 'rgba(0,0,0,0.45)';
    c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.restore();
  }
  function arc(c, x, y, r, a0, a1, w) { c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.arc(x, y, r, a0, a1); c.stroke(); }
  function poly(c, pts) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); }
  function rect(c, x, y, w, h) { c.fillRect(x, y, w, h); }
  function dot(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, 6.29); c.fill(); }
  function hole(c, x, y, r) { c.save(); c.globalCompositeOperation = 'destination-out'; dot(c, x, y, r); c.restore(); }
  function star(c, x, y, R, r, n) {
    c.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / n, d = i % 2 ? r : R;
      c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
    c.closePath(); c.fill();
  }
  function figure(c, x) { dot(c, x, 28, 10); poly(c, [[x - 14, 84], [x - 10, 44], [x + 10, 44], [x + 14, 84]]); }

  A2.icon = function (glyph, hue, tone) {
    const key = `${glyph}|${hue}|${tone || ''}`;
    if (cache[key]) return cache[key];
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d');
    const h = hue == null ? 40 : hue;
    const g = c.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, `hsl(${h} 55% ${tone === 'stigma' ? 30 : 24}%)`);
    g.addColorStop(1, `hsl(${(h + 30) % 360} 60% 9%)`);
    c.fillStyle = g;
    c.fillRect(0, 0, S, S);
    // a faint ring, brighter for stigmas
    c.strokeStyle = `hsla(${h} 80% 75% / ${tone === 'stigma' ? 0.55 : 0.22})`;
    c.lineWidth = 3;
    c.strokeRect(3, 3, S - 6, S - 6);
    const art = document.createElement('canvas');
    art.width = art.height = S;
    const a = art.getContext('2d');
    a.fillStyle = a.strokeStyle = `hsl(${h} 85% 82%)`;
    (G[glyph] || G.star)(a);
    c.shadowColor = `hsla(${h} 90% 60% / 0.9)`;
    c.shadowBlur = 10;
    c.drawImage(art, 0, 0);
    c.shadowBlur = 0;
    const shine = c.createLinearGradient(0, 0, 0, S);
    shine.addColorStop(0, 'rgba(255,255,255,0.14)');
    shine.addColorStop(0.5, 'rgba(255,255,255,0)');
    c.fillStyle = shine;
    c.fillRect(0, 0, S, S);
    cache[key] = cv;
    return cv;
  };

  /** Draw a cached icon into a canvas element of any size. */
  A2.paintIcon = function (canvas, glyph, hue, tone) {
    const ic = A2.icon(glyph, hue, tone);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 48;
    canvas.width = canvas.height = Math.round(w * dpr);
    canvas.getContext('2d').drawImage(ic, 0, 0, canvas.width, canvas.height);
  };
})();

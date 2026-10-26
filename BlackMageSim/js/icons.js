// Hand-drawn SVG icons in the spirit of the game's, turned into data URLs so
// gradient ids never clash between copies.
(function (B) {
  const cache = {};

  const FLAME = 'M32 5 C35 15 47 21 48 37 C49 50 41 59 32 59 C23 59 15 51 16 40 C17 31 22 27 24 18 C27 24 28 28 30 31 C31 22 29 14 32 5 Z';
  const CRYSTAL = 'M32 4 L42 26 L32 60 L22 26 Z';
  const BOLT = 'M37 4 L18 34 L30 34 L24 60 L46 26 L34 26 L42 4 Z';

  function flame(x, y, s, c1, c2, c3) {
    const t = (k) => `transform="translate(${x} ${y}) scale(${s * k}) translate(-32 -40)"`;
    return `<path d="${FLAME}" fill="${c1}" ${t(1)}/>` +
      `<path d="${FLAME}" fill="${c2}" ${t(0.66)} opacity=".95"/>` +
      `<path d="${FLAME}" fill="${c3}" ${t(0.34)}/>`;
  }
  function crystal(x, y, s, rot, c1, c2) {
    return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s}) translate(-32 -32)">` +
      `<path d="${CRYSTAL}" fill="${c1}" stroke="#ffffff" stroke-opacity=".7" stroke-width="1.5"/>` +
      `<path d="M32 4 L42 26 L32 60 Z" fill="${c2}" opacity=".55"/></g>`;
  }
  function bolt(x, y, s, c1, c2) {
    return `<g transform="translate(${x} ${y}) scale(${s}) translate(-32 -32)">` +
      `<path d="${BOLT}" fill="${c1}" stroke="${c2}" stroke-width="2" stroke-linejoin="round"/></g>`;
  }
  function numeral(txt) {
    return `<text x="58" y="60" text-anchor="end" font-family="Georgia,serif" font-weight="bold" font-size="15" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke" opacity=".92">${txt}</text>`;
  }
  function star(cx, cy, r1, r2, n, fill) {
    let d = '';
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? r2 : r1;
      const a = Math.PI * i / n - Math.PI / 2;
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(1) + ' ' + (cy + Math.sin(a) * r).toFixed(1);
    }
    return `<path d="${d}Z" fill="${fill}"/>`;
  }
  function sparkles(fill) {
    return star(14, 14, 5, 1.5, 4, fill) + star(50, 18, 4, 1.2, 4, fill) + star(48, 50, 3, 1, 4, fill);
  }

  // [inner bg colour, outer bg colour, glyph svg]
  const ART = {
    fire: ['#ff9b3d', '#5a0d05', () => flame(32, 40, 0.9, '#ff6a00', '#ffb347', '#fff3b0')],
    fire3: ['#ff6b2d', '#4a0606', () => `<circle cx="32" cy="36" r="22" fill="none" stroke="#ffcf66" stroke-width="3" stroke-dasharray="26 8" opacity=".8"/>` + flame(32, 41, 1.0, '#ff3d00', '#ff9a1f', '#fff1a8') + numeral('III')],
    fire4: ['#ff4d6d', '#2a0418', () => flame(20, 44, 0.62, '#d4145a', '#ff6a00', '#ffe08a') + flame(44, 44, 0.62, '#d4145a', '#ff6a00', '#ffe08a') + flame(32, 38, 0.92, '#ff2d2d', '#ffa22b', '#fffbe0') + numeral('IV')],
    despair: ['#8b1030', '#0b0006', () => `<circle cx="32" cy="34" r="24" fill="#000" opacity=".35"/>` + flame(32, 40, 1.05, '#4a0016', '#b3002d', '#ff5a7a') + `<circle cx="32" cy="40" r="5" fill="#ffd0e0"/>`],
    blizzard: ['#9fe3ff', '#0b3a6b', () => crystal(32, 33, 0.8, 0, '#bff0ff', '#4aa3e0')],
    blizzard3: ['#7fd0ff', '#082c5a', () => crystal(32, 32, 0.78, 0, '#c9f3ff', '#3d8fd6') + crystal(17, 40, 0.48, -28, '#a8e6ff', '#3d8fd6') + crystal(47, 40, 0.48, 28, '#a8e6ff', '#3d8fd6') + numeral('III')],
    blizzard4: ['#5fb4ff', '#04173d', () => crystal(32, 30, 0.95, 0, '#dff8ff', '#2c6fc4') + crystal(14, 44, 0.42, -40, '#b8ecff', '#2c6fc4') + crystal(50, 44, 0.42, 40, '#b8ecff', '#2c6fc4') + crystal(32, 52, 0.3, 90, '#e6fbff', '#2c6fc4') + numeral('IV')],
    thunder3: ['#b98cff', '#1d0a3d', () => `<ellipse cx="32" cy="15" rx="22" ry="9" fill="#3b2a5c"/><ellipse cx="22" cy="14" rx="10" ry="8" fill="#4b3a70"/><ellipse cx="40" cy="12" rx="11" ry="8" fill="#4b3a70"/>` + bolt(32, 36, 0.85, '#fff36b', '#ffffff') + numeral('III')],
    paradox: ['#ffd6f0', '#5a1a4d', () => `<g transform="translate(32 32) rotate(45)"><rect x="-15" y="-15" width="30" height="30" fill="#ff5a5a"/><rect x="-15" y="-15" width="30" height="15" fill="#5ab4ff" transform="rotate(90)"/><rect x="-15" y="-15" width="30" height="30" fill="none" stroke="#fff" stroke-width="3"/></g><circle cx="32" cy="32" r="5" fill="#fff"/>` + sparkles('#fff')],
    xenoglossy: ['#c06cff', '#1a0430', () => `<path d="M10 46 L32 40 L54 46 L54 22 L32 16 L10 22 Z" fill="#2b0f45" stroke="#e7c4ff" stroke-width="2"/><path d="M32 16 L32 40" stroke="#e7c4ff" stroke-width="2"/>` + `<path d="M16 26 L27 23 M16 31 L27 28 M37 23 L48 26 M37 28 L48 31 M16 36 L27 33 M37 33 L48 36" stroke="#d29bff" stroke-width="2"/>` + `<circle cx="32" cy="10" r="5" fill="#f3d9ff"/>` + star(32, 10, 9, 2, 4, '#ffffff')],
    foul: ['#9a5cff', '#14002a', () => `<circle cx="32" cy="36" r="16" fill="#5b1d99" stroke="#d6a6ff" stroke-width="2"/><circle cx="20" cy="22" r="7" fill="#7a33c7" stroke="#d6a6ff" stroke-width="1.5"/><circle cx="46" cy="20" r="5" fill="#7a33c7" stroke="#d6a6ff" stroke-width="1.5"/><circle cx="27" cy="31" r="4" fill="#f0dcff" opacity=".8"/>`],
    scathe: ['#7d5fa8', '#120b1e', () => `<path d="M14 50 C24 34 34 24 50 12" stroke="#e9d6ff" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M22 54 C30 42 40 32 54 24" stroke="#b28ae6" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M10 40 C18 30 26 22 38 12" stroke="#b28ae6" stroke-width="3" fill="none" stroke-linecap="round"/>`],
    umbralSoul: ['#8fd3ff', '#0a2347', () => `<path d="M32 10 C44 22 46 36 40 46 C36 52 28 52 24 46 C20 40 24 32 30 32 C34 32 36 36 34 40" fill="none" stroke="#e8f8ff" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="10" r="4" fill="#fff"/>`],
    transpose: ['#d0a0ff', '#1d1030', () => `<path d="M32 10 A22 22 0 0 0 32 54 Z" fill="#e8463c"/><path d="M32 10 A22 22 0 0 1 32 54 Z" fill="#3c8ee8"/><path d="M18 18 A20 20 0 0 1 46 16" fill="none" stroke="#fff" stroke-width="3"/><path d="M46 16 L40 12 M46 16 L42 22" stroke="#fff" stroke-width="3"/><path d="M46 48 A20 20 0 0 1 18 48" fill="none" stroke="#fff" stroke-width="3"/><path d="M18 48 L24 52 M18 48 L22 42" stroke="#fff" stroke-width="3"/>`],
    sharpcast: ['#f0a8ff', '#2a0838', () => star(32, 32, 26, 6, 8, '#ffe3ff') + star(32, 32, 14, 4, 8, '#c35bff') + `<circle cx="32" cy="32" r="4" fill="#fff"/>`],
    triplecast: ['#b58cff', '#180a33', () => `<circle cx="32" cy="17" r="9" fill="#ff6a3d" stroke="#fff" stroke-width="2"/><circle cx="18" cy="42" r="9" fill="#4fb6ff" stroke="#fff" stroke-width="2"/><circle cx="46" cy="42" r="9" fill="#ffe14d" stroke="#fff" stroke-width="2"/><path d="M32 26 L22 35 M32 26 L42 35 M27 42 L37 42" stroke="#fff" stroke-width="2" opacity=".7"/>`],
    manafont: ['#7fc8ff', '#06213f', () => `<path d="M32 8 C40 22 46 30 46 38 C46 47 40 53 32 53 C24 53 18 47 18 38 C18 30 24 22 32 8 Z" fill="#3aa0ff" stroke="#e6f6ff" stroke-width="2"/><path d="M26 38 C26 44 30 47 34 47" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M10 58 L54 58" stroke="#9fd8ff" stroke-width="3"/>`],
    amplifier: ['#d39bff', '#200838', () => `<circle cx="32" cy="34" r="22" fill="none" stroke="#e8c8ff" stroke-width="2" opacity=".6"/><circle cx="32" cy="34" r="15" fill="none" stroke="#e8c8ff" stroke-width="2" opacity=".8"/><path d="M32 18 L40 34 L32 50 L24 34 Z" fill="#b35cff" stroke="#fff" stroke-width="2"/><path d="M32 4 L38 12 L26 12 Z" fill="#fff"/>`],
    leyLines: ['#c28bff', '#16052c', () => `<ellipse cx="32" cy="40" rx="25" ry="12" fill="none" stroke="#f0d8ff" stroke-width="3"/><ellipse cx="32" cy="40" rx="17" ry="8" fill="none" stroke="#c48bff" stroke-width="2"/><path d="M32 8 L32 34" stroke="#f0d8ff" stroke-width="3"/>` + star(32, 10, 7, 2, 4, '#fff') + star(14, 26, 4, 1, 4, '#e0c0ff') + star(50, 24, 4, 1, 4, '#e0c0ff')],
    betweenTheLines: ['#c28bff', '#16052c', () => `<ellipse cx="32" cy="46" rx="25" ry="11" fill="none" stroke="#f0d8ff" stroke-width="3"/><path d="M32 8 L32 38" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M22 28 L32 40 L42 28" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`],
    manaward: ['#b9a2ff', '#1a1040', () => `<path d="M32 6 L52 14 C52 34 46 48 32 58 C18 48 12 34 12 14 Z" fill="#6a4fd0" stroke="#efe8ff" stroke-width="2.5"/><path d="M32 14 L32 50 M20 26 L44 26" stroke="#efe8ff" stroke-width="2" opacity=".7"/>`],
    swiftcast: ['#9ee6c8', '#0d3326', () => `<path d="M10 46 C22 40 30 30 36 12 C40 26 44 34 54 40 C40 40 30 46 22 56 Z" fill="#e9fff6" stroke="#2f8f6a" stroke-width="2"/><path d="M14 52 L44 22" stroke="#2f8f6a" stroke-width="2"/>`],
    lucidDreaming: ['#7c8cff', '#0b0f33', () => `<path d="M38 8 A22 22 0 1 0 54 42 A18 18 0 1 1 38 8 Z" fill="#fff6c8"/>` + star(18, 18, 4, 1.2, 4, '#fff') + star(14, 40, 3, 1, 4, '#fff') + star(28, 12, 2.5, .8, 4, '#fff')],
    addle: ['#d9b48f', '#3a2210', () => `<circle cx="32" cy="24" r="14" fill="#f2d7bb" stroke="#5a3418" stroke-width="2"/><path d="M24 22 C28 16 36 16 40 22 M26 28 C30 24 34 24 38 28" stroke="#b07a4e" stroke-width="2" fill="none"/><path d="M32 40 L32 58 M24 50 L32 58 L40 50" stroke="#ff6b4a" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`],
    surecast: ['#e3c7ff', '#2a1846', () => `<path d="M32 6 L50 14 C50 32 45 46 32 56 C19 46 14 32 14 14 Z" fill="#8e6ad8" stroke="#fff" stroke-width="2"/><rect x="24" y="28" width="16" height="13" rx="2" fill="#fff"/><path d="M27 28 L27 23 A5 5 0 0 1 37 23 L37 28" stroke="#fff" stroke-width="3" fill="none"/>`],
    sprint: ['#ffd27a', '#5a3200', () => `<path d="M12 16 L28 32 L12 48" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 16 L46 32 L30 48" fill="none" stroke="#fff3c4" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`],
    tincture: ['#ffc48a', '#3a1d08', () => `<path d="M26 8 L38 8 L38 20 C48 24 52 32 52 40 C52 52 43 58 32 58 C21 58 12 52 12 40 C12 32 16 24 26 20 Z" fill="#cfe9ff" fill-opacity=".35" stroke="#fff" stroke-width="2"/><path d="M14 40 C20 36 44 36 50 40 C50 50 43 56 32 56 C21 56 14 50 14 40 Z" fill="#7a3cff"/><rect x="24" y="4" width="16" height="6" rx="2" fill="#a0622d"/>`],
  };

  // Status icons reuse the art with their own colours where the game's differ.
  const STATUS_ART = {
    st_firestarter: ['#ffcf4d', '#6b2200', () => flame(32, 40, 0.9, '#ff7b00', '#ffd23f', '#ffffff')],
    st_thundercloud: ['#ffe86b', '#2a2060', () => `<ellipse cx="32" cy="22" rx="24" ry="12" fill="#5b4c92"/><ellipse cx="22" cy="18" rx="12" ry="10" fill="#7466b2"/><ellipse cx="42" cy="16" rx="12" ry="10" fill="#7466b2"/>` + bolt(32, 44, 0.6, '#fff36b', '#fff')],
    st_sharpcast: ART.sharpcast,
    st_triplecast: ART.triplecast,
    st_swiftcast: ART.swiftcast,
    st_leylines: ART.leyLines,
    st_circle: ['#e2b8ff', '#2b0a52', () => `<circle cx="32" cy="32" r="22" fill="none" stroke="#fff" stroke-width="4"/><circle cx="32" cy="32" r="14" fill="#c27bff" opacity=".7"/>` + star(32, 32, 9, 3, 6, '#fff')],
    st_lucid: ART.lucidDreaming,
    st_manaward: ART.manaward,
    st_surecast: ART.surecast,
    st_sprint: ART.sprint,
    st_medicated: ['#ff9dd0', '#4a0d2e', () => `<path d="M26 8 L38 8 L38 20 C48 24 52 32 52 40 C52 52 43 58 32 58 C21 58 12 52 12 40 C12 32 16 24 26 20 Z" fill="#fff" fill-opacity=".25" stroke="#fff" stroke-width="2"/><path d="M14 40 C20 36 44 36 50 40 C50 50 43 56 32 56 C21 56 14 50 14 40 Z" fill="#ff4fa0"/>`],
    st_thunder3: ['#c7a4ff', '#24104a', () => bolt(32, 32, 0.95, '#fff36b', '#fff')],
    st_addle: ART.addle,
  };

  function build(art, w, h, radius) {
    const [c1, c2, glyph] = art;
    const sx = w / 64, sy = h / 64;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<defs><radialGradient id="g" cx="50%" cy="38%" r="78%"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>` +
      `<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
      `<filter id="f" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="#000" flood-opacity=".6"/></filter></defs>` +
      `<rect width="${w}" height="${h}" rx="${radius}" fill="url(#g)"/>` +
      `<g filter="url(#f)" transform="scale(${Math.min(sx, sy)}) translate(${(w / Math.min(sx, sy) - 64) / 2} ${(h / Math.min(sx, sy) - 64) / 2})">${glyph()}</g>` +
      `<rect width="${w}" height="${h}" rx="${radius}" fill="url(#s)"/>` +
      `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="${radius}" fill="none" stroke="#000" stroke-opacity=".55"/></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  // The game's own icons, when tools/extract_icons.py has pulled them from an install
  // (work/game-icons.js sets BLM.GAME_ICONS). Otherwise the drawn ones below.
  const gameIcon = (k) => (B.GAME_ICONS && B.GAME_ICONS[k]) || null;

  B.icon = function (id) {
    const g = gameIcon(id);
    if (g) return g;
    if (cache[id]) return cache[id];
    const art = ART[id] || ART.scathe;
    return (cache[id] = build(art, 64, 64, 7));
  };

  // Stacking statuses (Triplecast) have one game icon per stack count, with the number drawn in.
  B.statusHasStackArt = (key, stacks) => !!(stacks && gameIcon(`st:${key}:${stacks}`));

  B.statusIcon = function (key, stacks) {
    const g = (stacks && gameIcon(`st:${key}:${stacks}`)) || gameIcon('st:' + key);
    if (g) return g;
    const k = 'st:' + key;
    if (cache[k]) return cache[k];
    const st = B.STATUSES[key];
    const art = STATUS_ART[st ? st.icon : ''] || ART.scathe;
    return (cache[k] = build(art, 48, 64, 5));
  };

  // Black Mage job crest: the pointed hat.
  B.jobIcon = function () {
    if (gameIcon('job')) return gameIcon('job');
    if (cache.job) return cache.job;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
      `<defs><radialGradient id="j" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#7b5cc4"/><stop offset="1" stop-color="#1c1035"/></radialGradient></defs>` +
      `<circle cx="32" cy="32" r="30" fill="url(#j)" stroke="#d9c7ff" stroke-width="2"/>` +
      `<path d="M30 8 C34 18 40 26 44 40 L20 40 C24 28 26 20 30 8 Z" fill="#14081f" stroke="#e5d8ff" stroke-width="1.5"/>` +
      `<path d="M30 8 C26 10 22 12 20 16" fill="none" stroke="#e5d8ff" stroke-width="1.5"/>` +
      `<ellipse cx="32" cy="42" rx="22" ry="6" fill="#14081f" stroke="#e5d8ff" stroke-width="1.5"/>` +
      `<circle cx="27" cy="48" r="2.4" fill="#ffd84d"/><circle cx="37" cy="48" r="2.4" fill="#ffd84d"/></svg>`;
    return (cache.job = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  };
})(window.BLM);

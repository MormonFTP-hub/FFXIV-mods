// Dummy Sim Lab's report: turns a finished run (B.Sim.finish) into the page's sections, SimulationCraft's report in
// spirit: the DPS with its error, the spread, DPS over time with the raid-buff windows, damage by action, stat weights,
// uptimes and the sample sequence. Charts are inline SVG drawn to one scale each; colours come from css/sim.css.
(function (B) {
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d = 0) => (x === undefined || x === null || Number.isNaN(x) ? '–' : Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const pct = (x, d = 1) => (x * 100).toFixed(d) + '%';
  const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  function niceTicks(lo, hi, want) {
    const span = Math.max(1e-9, hi - lo);
    const raw = span / Math.max(1, want);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(k => k * mag).find(s => s >= raw) || 10 * mag;
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
    return out;
  }
  const kfmt = (v) => (Math.abs(v) >= 1000 ? (v / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'k' : fmt(v));

  // ---------- charts ----------
  function histogram(R) {
    const W = 640, H = 200, L = 14, Rm = 14, T = 22, Bm = 30;
    const { lo, hi, bins } = R.hist;
    const S = R.summary;
    const span = Math.max(1, hi - lo);
    const x = (v) => L + (v - lo) / span * (W - L - Rm);
    const maxC = Math.max(1, ...bins);
    const bw = (W - L - Rm) / bins.length;
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="DPS distribution over ${S.n} iterations">`;
    s += `<line class="axis" x1="${L}" x2="${W - Rm}" y1="${H - Bm}" y2="${H - Bm}"/>`;
    bins.forEach((c, i) => {
      if (!c) return;
      const h = c / maxC * (H - T - Bm);
      const from = lo + i * span / bins.length;
      s += `<rect class="bar" x="${(L + i * bw + 0.5).toFixed(1)}" y="${(H - Bm - h).toFixed(1)}" width="${Math.max(1, bw - 1).toFixed(1)}" height="${h.toFixed(1)}" rx="1"><title>${fmt(from)}–${fmt(from + span / bins.length)}: ${c} iterations</title></rect>`;
    });
    for (const v of niceTicks(lo, hi, 5)) {
      s += `<line class="tick" x1="${x(v).toFixed(1)}" x2="${x(v).toFixed(1)}" y1="${H - Bm}" y2="${H - Bm + 4}"/>`;
      s += `<text class="lbl" x="${x(v).toFixed(1)}" y="${H - Bm + 17}" text-anchor="middle">${kfmt(v)}</text>`;
    }
    const mx = x(S.mean);
    s += `<line class="mean" x1="${mx.toFixed(1)}" x2="${mx.toFixed(1)}" y1="${T - 6}" y2="${H - Bm}"/>`;
    s += `<text class="lbl strong" x="${mx.toFixed(1)}" y="${T - 10}" text-anchor="${mx > W - 90 ? 'end' : mx < 90 ? 'start' : 'middle'}">mean ${fmt(S.mean)}</text>`;
    return s + '</svg>';
  }

  function overTime(R) {
    const W = 640, H = 220, L = 46, Rm = 12, T = 14, Bm = 28;
    const raw = R.timeline;
    const n = Math.max(2, Math.floor(R.fight));
    // A centred 5-second average: single seconds jump with every big hit.
    const sm = [];
    for (let i = 0; i < n; i++) {
      let sum = 0, k = 0;
      for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) { sum += raw[j] || 0; k++; }
      sm.push(sum / k);
    }
    const top = Math.max(1, ...sm) * 1.08;
    const x = (t) => L + t / n * (W - L - Rm);
    const y = (v) => H - Bm - v / top * (H - T - Bm);
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="DPS over the fight">`;
    for (const [a, b] of R.windows || []) {
      if (a >= n) continue;
      s += `<rect class="window" x="${x(a).toFixed(1)}" y="${T}" width="${(x(Math.min(n, b)) - x(a)).toFixed(1)}" height="${H - T - Bm}"><title>Raid buffs ${mmss(a)}–${mmss(b)}</title></rect>`;
    }
    for (const v of niceTicks(0, top, 4)) {
      if (v > top) continue;
      s += `<line class="grid" x1="${L}" x2="${W - Rm}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`;
      s += `<text class="lbl" x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${kfmt(v)}</text>`;
    }
    const every = n > 400 ? 120 : n > 150 ? 60 : 30;
    for (let t = 0; t <= n; t += every) s += `<text class="lbl" x="${x(t).toFixed(1)}" y="${H - Bm + 17}" text-anchor="middle">${mmss(t)}</text>`;
    let d = `M${x(0).toFixed(1)} ${y(0).toFixed(1)}`;
    sm.forEach((v, i) => { d += ` L${x(i + 0.5).toFixed(1)} ${y(v).toFixed(1)}`; });
    d += ` L${x(n).toFixed(1)} ${y(0).toFixed(1)} Z`;
    s += `<path class="area" d="${d}"/>`;
    let line = '';
    sm.forEach((v, i) => { line += `${i ? 'L' : 'M'}${x(i + 0.5).toFixed(1)} ${y(v).toFixed(1)} `; });
    s += `<path class="line" d="${line}"/>`;
    const my = y(R.summary.mean);
    s += `<line class="mean" x1="${L}" x2="${W - Rm}" y1="${my.toFixed(1)}" y2="${my.toFixed(1)}"/>`;
    s += `<line class="axis" x1="${L}" x2="${W - Rm}" y1="${H - Bm}" y2="${H - Bm}"/>`;
    return s + '</svg>';
  }

  // Up to 60 characters of a name that fit `px` at the lane's font size.
  const fit = (name, px) => {
    const n = Math.floor(px / 6.1);
    if (n < 2) return '';
    return name.length <= n ? name : name.slice(0, Math.max(1, n - 1)) + '…';
  };
  function sequence(R) {
    const seq = R.seq || [];
    if (!seq.length) return '<p class="muted">No sample sequence.</p>';
    const PX = 26, T0 = Math.min(0, seq[0].t);
    const end = Math.max(R.fight, seq[seq.length - 1].t + 3);
    const W = Math.ceil((end - T0) * PX) + 40;
    const H = 132, gY = 70, gH = 30;
    const x = (t) => 20 + (t - T0) * PX;
    let s = `<svg class="seq" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sample sequence of iteration one">`;
    for (const [a, b] of R.windows || []) s += `<rect class="window" x="${x(a).toFixed(1)}" y="4" width="${((b - a) * PX).toFixed(1)}" height="${H - 24}"/>`;
    for (let t = Math.ceil(T0 / 10) * 10; t <= end; t += 10) {
      s += `<line class="grid" x1="${x(t)}" x2="${x(t)}" y1="4" y2="${H - 20}"/>`;
      s += `<text class="lbl" x="${x(t) + 3}" y="${H - 6}">${t < 0 ? '−' + mmss(-t) : mmss(t)}</text>`;
    }
    const gcds = seq.filter(q => q.gcd);
    gcds.forEach((q, i) => {
      const next = gcds[i + 1] ? gcds[i + 1].t : q.t + R.gcd;
      const w = Math.max(4, (next - q.t) * PX - 2);
      s += `<g><rect class="gcd${i % 2 ? ' alt' : ''}" x="${x(q.t).toFixed(1)}" y="${gY}" width="${w.toFixed(1)}" height="${gH}" rx="3"/>`;
      s += `<text class="gtxt" x="${(x(q.t) + 4).toFixed(1)}" y="${gY + 19}">${esc(fit(q.name, w - 6))}</text>`;
      s += `<title>${q.t.toFixed(2)}s  ${esc(q.name)}  (APL line ${q.line})</title></g>`;
    });
    let lane = 0, lastX = [-1e9, -1e9];
    for (const q of seq.filter(q => !q.gcd)) {
      const px = x(q.t);
      lane = px - lastX[0] > 70 ? 0 : px - lastX[1] > 70 ? 1 : (lane + 1) % 2;
      lastX[lane] = px;
      const yy = lane ? 40 : 14;
      s += `<g><line class="ogcdstem" x1="${px.toFixed(1)}" x2="${px.toFixed(1)}" y1="${yy + 6}" y2="${gY}"/><circle class="ogcd" cx="${px.toFixed(1)}" cy="${yy + 6}" r="4"/>`;
      s += `<text class="otxt" x="${(px + 7).toFixed(1)}" y="${yy + 10}">${esc(fit(q.name, 64))}</text>`;
      s += `<title>${q.t.toFixed(2)}s  ${esc(q.name)}  (APL line ${q.line})</title></g>`;
    }
    return s + '</svg>';
  }

  // ---------- sections ----------
  function abilityTable(R) {
    const maxShare = Math.max(...R.abilities.map(a => a.share), 0.0001);
    const rows = R.abilities.map(a => `<tr>
      <th scope="row">${esc(a.name)}${a.dot ? ' <span class="tag">DoT</span>' : ''}</th>
      <td class="num">${fmt(a.dps)}</td>
      <td class="share"><span class="sbar"><i style="width:${(a.share / maxShare * 100).toFixed(1)}%"></i></span><span class="num">${pct(a.share)}</span></td>
      <td class="num">${a.casts ? fmt(a.casts, 1) : '–'}</td>
      <td class="num">${fmt(a.hits, 1)}</td>
      <td class="num">${fmt(a.avg)}</td>
      <td class="num">${pct(a.crit, 0)}</td>
      <td class="num">${pct(a.dh, 0)}</td></tr>`).join('');
    const other = R.uses.filter(u => !R.abilities.some(a => a.id === u.id));
    return `<div class="scroll"><table class="tbl">
      <thead><tr><th scope="col">Action</th><th scope="col" class="num">DPS</th><th scope="col">Share</th><th scope="col" class="num">Casts</th><th scope="col" class="num">Hits</th><th scope="col" class="num">Avg hit</th><th scope="col" class="num">Crit</th><th scope="col" class="num">DH</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
      ${other.length ? `<p class="muted small">No damage of their own, per fight: ${other.map(u => `${esc(u.name)} ×${fmt(u.count, 1)}`).join(' · ')}</p>` : ''}`;
  }

  const STAT_LABEL = { main: 'Main stat', wd: 'Weapon damage', det: 'Determination', crit: 'Critical hit', dh: 'Direct hit', speed: 'Speed', ten: 'Tenacity' };
  function weights(R, speedName) {
    if (!R.weights.length) return '';
    const max = Math.max(...R.weights.filter(w => w.stat !== 'wd').map(w => Math.abs(w.norm || 0)), 0.001);
    const rows = R.weights.map(w => {
      const label = w.stat === 'speed' ? speedName : STAT_LABEL[w.stat];
      const bar = w.stat === 'wd' ? '' : `<span class="wbar"><i style="width:${Math.min(100, Math.abs(w.norm || 0) / max * 100).toFixed(1)}%"></i></span>`;
      return `<tr><th scope="row">${esc(label)}</th><td>${bar}</td><td class="num strong">${w.norm !== null ? w.norm.toFixed(3) : '–'}</td>
        <td class="num">${w.perPoint.toFixed(3)}</td><td class="num muted">±${w.err.toFixed(3)}</td><td class="num muted">+${w.delta}</td></tr>`;
    }).join('');
    const pawn = R.weights.filter(w => w.norm !== null).map(w => `${w.stat}=${w.norm.toFixed(3)}`).join(', ');
    return `<section class="card"><h2>Stat weights</h2>
      <p class="muted small">Each stat raised on its own with the same random rolls as the base run (common random numbers); DPS per point, normalised to the main stat. Speed comes in tiers, so its weight is an average over the step tried.</p>
      <div class="scroll"><table class="tbl weights"><thead><tr><th scope="col">Stat</th><th scope="col"></th><th scope="col" class="num">Normalised</th><th scope="col" class="num">DPS / point</th><th scope="col" class="num">95%</th><th scope="col" class="num">Step</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
      <p class="pawn"><span class="muted small">As a string</span> <code>${esc(pawn)}</code></p></section>`;
  }

  function uptimes(R) {
    const self = R.buffs.filter(b => b.self), tgt = R.buffs.filter(b => !b.self);
    const list = (bs) => bs.map(b => `<li><span class="uname">${esc(b.name)}</span><span class="ubar"><i style="width:${Math.min(100, b.uptime * 100).toFixed(1)}%"></i></span><span class="num">${pct(b.uptime, 1)}</span></li>`).join('');
    return `<section class="card"><h2>Uptime</h2><div class="cols2">
      <div><h3>Your statuses</h3><ul class="uptime">${list(self) || '<li class="muted">None</li>'}</ul></div>
      <div><h3>On the target</h3><ul class="uptime">${list(tgt) || '<li class="muted">None</li>'}</ul></div></div></section>`;
  }

  function sets(R, rows) {
    if (!rows || !rows.length) return '';
    const all = [{ name: 'Base profile', mean: R.summary.mean, delta: 0, err: 0, base: true }].concat(rows);
    const max = Math.max(...all.map(r => r.mean));
    const min = Math.min(...all.map(r => r.mean));
    const lo = Math.max(0, min - (max - min) * 1.5 - max * 0.01);
    const body = all.sort((a, b) => b.mean - a.mean).map(r => `<tr${r.base ? ' class="base"' : ''}><th scope="row">${esc(r.name)}</th>
      <td><span class="wbar"><i style="width:${((r.mean - lo) / Math.max(1, max - lo) * 100).toFixed(1)}%"></i></span></td>
      <td class="num strong">${fmt(r.mean)}</td>
      <td class="num ${r.delta > 0 ? 'good' : r.delta < 0 ? 'bad' : 'muted'}">${r.base ? '–' : (r.delta >= 0 ? '+' : '−') + fmt(Math.abs(r.delta))}</td>
      <td class="num muted">${r.base ? '' : '±' + fmt(r.err)}</td>
      <td class="muted small">${esc(r.desc || '')}</td></tr>`).join('');
    return `<section class="card"><h2>Profile sets</h2>
      <p class="muted small">Each set ran the same iterations with the same rolls as the base; the change is paired iteration by iteration.</p>
      <div class="scroll"><table class="tbl sets"><thead><tr><th scope="col">Set</th><th scope="col"></th><th scope="col" class="num">DPS</th><th scope="col" class="num">Change</th><th scope="col" class="num">95%</th><th scope="col">Stats</th></tr></thead>
      <tbody>${body}</tbody></table></div></section>`;
  }

  function render(R, extra) {
    extra = extra || {};
    const S = R.summary, st = R.stats;
    const speedName = extra.speedName || 'Speed';
    const mainName = extra.mainName || 'Main';
    const role = R.role === 'tank' ? 'tank' : R.role === 'healer' ? 'healer' : 'dps';
    const set = R.settings;
    const fightDesc = `${set.style === 'movement' ? `Movement every ${set.moveEvery || 30}s` : 'Patchwerk'} · ${mmss(R.fight)} average${set.variance ? ` (±${Math.round(set.variance * 100)}%)` : ''} · ${set.targets || 1} target${(set.targets || 1) > 1 ? 's' : ''}`;
    const warn = R.warnings.length ? `<div class="notice" role="status"><b>Warnings</b><ul>${R.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : '';
    return `
<section class="headline card">
  <div class="who"><span class="jobchip ${role}">${esc(R.abbr)}</span>
    <div><h2 class="jobname">${esc(R.jobName)}</h2><p class="muted">${esc(R.versionLabel)} · live ${esc(R.patch)}</p></div></div>
  <div class="dpsfig"><span class="big">${fmt(S.mean)}</span><span class="unit">DPS</span><span class="err">±${fmt(S.err)} <abbr title="95% confidence interval of the mean">(95%)</abbr></span></div>
  <dl class="facts">
    <div><dt>Iterations</dt><dd>${fmt(S.n)}</dd></div>
    <div><dt>Fight</dt><dd>${esc(fightDesc)}</dd></div>
    <div><dt>Party</dt><dd>${R.party.length ? esc(R.party.join(', ')) : 'Solo, no raid buffs'}</dd></div>
    <div><dt>Range</dt><dd>${fmt(S.min)} – ${fmt(S.max)} <span class="muted">(median ${fmt(S.median)}, sd ${fmt(S.sd)})</span></dd></div>
    <div><dt>Stats</dt><dd class="statline">${esc(mainName)} ${fmt(st.main)} · WD ${st.wd} · CRT ${fmt(st.crit)} · DET ${fmt(st.det)} · DH ${fmt(st.dh)} · ${esc(extra.speedAbbr || 'SPD')} ${fmt(st.speed)}${st.ten ? ` · TEN ${fmt(st.ten)}` : ''}</dd></div>
    <div><dt>Pace</dt><dd>${R.gcdsPerMin.toFixed(2)} GCDs a minute · base GCD ${R.gcd.toFixed(2)} · ping ${set.latencyComp ? 'compensated' : (set.ping || 0) + ' ms'} · idle ${pct(R.idle)}</dd></div>
  </dl>
  ${warn}
</section>
<div class="pair">
  <section class="card"><h2>DPS distribution</h2>${histogram(R)}
    <p class="muted small">${fmt(S.n)} iterations · 5th percentile ${fmt(S.p5)}, 95th ${fmt(S.p95)}.</p></section>
  <section class="card"><h2>DPS over time</h2>${overTime(R)}
    <p class="muted small">Average of every iteration, smoothed over 5s${(R.windows || []).length ? '; shaded: the party\'s two-minute raid buffs' : ''}.</p></section>
</div>
${sets(R, extra.sets)}
<section class="card"><h2>Damage by action</h2>${abilityTable(R)}</section>
${weights(R, speedName)}
${uptimes(R)}
<section class="card"><h2>Sample sequence</h2>
  <p class="muted small">Iteration one, from the pre-pull. Weaponskills and spells along the bottom, abilities above; hover for the time and the action-list line that chose it.</p>
  <div class="scroll seqwrap">${sequence(R)}</div>
  <details class="seqlist"><summary>As a list</summary><ol>${(R.seq || []).map(q => `<li><span class="num">${q.t.toFixed(2)}</span> ${q.gcd ? '' : '<span class="tag">oGCD</span> '}${esc(q.name)} <span class="muted">line ${q.line}</span></li>`).join('')}</ol></details>
</section>`;
  }

  // Plain text for pasting into Discord: the headline and the top of the breakdown.
  function text(R) {
    const S = R.summary;
    const lines = [`${R.jobName} (${R.versionLabel}, live ${R.patch}) — ${fmt(S.mean)} DPS ±${fmt(S.err)}`,
      `${fmt(S.n)} iterations, ${mmss(R.fight)} fights, ${R.party.length ? 'party: ' + R.party.join(', ') : 'solo'}`,
      `main ${R.stats.main} WD ${R.stats.wd} CRT ${R.stats.crit} DET ${R.stats.det} DH ${R.stats.dh} speed ${R.stats.speed}${R.stats.ten ? ' TEN ' + R.stats.ten : ''}`];
    for (const a of R.abilities.slice(0, 10)) lines.push(`  ${a.name.padEnd(26)} ${fmt(a.dps).padStart(7)}  ${pct(a.share).padStart(6)}`);
    if (R.weights.length) lines.push('weights: ' + R.weights.filter(w => w.norm !== null).map(w => `${w.stat} ${w.norm.toFixed(3)}`).join(', '));
    return lines.join('\n');
  }

  function rankings(rows, cfg) {
    if (!rows.length) return '<p class="muted">No results.</p>';
    const W = 640, rowH = 26, L = 112, Rm = 74, T = 8;
    const H = T + rows.length * rowH + 26;
    const top = Math.max(...rows.map(r => r.mean + r.err)) * 1.02;
    const x = (v) => L + v / top * (W - L - Rm);
    let s = `<svg class="chart rank" viewBox="0 0 ${W} ${H}" role="img" aria-label="DPS by job">`;
    for (const v of niceTicks(0, top, 5)) {
      if (v > top) continue;
      s += `<line class="grid" x1="${x(v).toFixed(1)}" x2="${x(v).toFixed(1)}" y1="${T}" y2="${H - 22}"/>`;
      s += `<text class="lbl" x="${x(v).toFixed(1)}" y="${H - 6}" text-anchor="middle">${kfmt(v)}</text>`;
    }
    rows.forEach((r, i) => {
      const y = T + i * rowH;
      const role = r.role === 'tank' ? 'tank' : r.role === 'healer' ? 'healer' : 'dps';
      s += `<g><text class="lbl name" x="${L - 8}" y="${y + 17}" text-anchor="end">${esc(r.name)}</text>`;
      s += `<rect class="rbar ${role}" x="${L}" y="${y + 5}" width="${(x(r.mean) - L).toFixed(1)}" height="${rowH - 10}" rx="2"/>`;
      s += `<line class="whisk" x1="${x(r.mean - r.err).toFixed(1)}" x2="${x(r.mean + r.err).toFixed(1)}" y1="${y + rowH / 2}" y2="${y + rowH / 2}"/>`;
      s += `<text class="lbl strong" x="${(x(r.mean + r.err) + 6).toFixed(1)}" y="${y + 17}">${fmt(r.mean)}</text>`;
      s += `<title>${esc(r.name)} ${esc(r.version)}: ${fmt(r.mean)} ±${fmt(r.err)} DPS, base GCD ${r.gcd.toFixed(2)}</title></g>`;
    });
    s += '</svg>';
    const best = rows[0].mean;
    const table = rows.map((r, i) => `<tr><td class="num muted">${i + 1}</td><th scope="row"><span class="jobchip sm ${r.role === 'tank' ? 'tank' : r.role === 'healer' ? 'healer' : 'dps'}">${esc(r.abbr || '')}</span> ${esc(r.name)}</th>
      <td class="num strong">${fmt(r.mean)}</td><td class="num muted">±${fmt(r.err)}</td><td class="num">${pct(r.mean / best, 1)}</td>
      <td class="num">${fmt(r.min)} – ${fmt(r.max)}</td><td class="num">${r.gcd.toFixed(2)}</td><td class="muted small">${esc(r.version)}</td></tr>`).join('');
    return `${s}<div class="scroll"><table class="tbl rank"><thead><tr><th scope="col" class="num">#</th><th scope="col">Job</th><th scope="col" class="num">DPS</th><th scope="col" class="num">95%</th><th scope="col" class="num">Of top</th><th scope="col" class="num">Range</th><th scope="col" class="num">Base GCD</th><th scope="col">Version</th></tr></thead><tbody>${table}</tbody></table></div>`;
  }

  // ---------- the rotation search ----------
  // How far ahead of the action list the best order is, second by second (cumulative damage, best minus list).
  function aheadChart(best, guide) {
    const W = 640, H = 170, L = 52, Rm = 12, T = 12, Bm = 26;
    const n = Math.max(2, Math.floor(best.fight));
    let a = 0, b = 0;
    const diff = [];
    for (let i = 0; i < n; i++) { a += best.timeline[i] || 0; b += guide.timeline[i] || 0; diff.push(a - b); }
    const lo = Math.min(0, ...diff), hi = Math.max(1, ...diff);
    const x = (t) => L + t / n * (W - L - Rm);
    const y = (v) => T + (hi - v) / Math.max(1, hi - lo) * (H - T - Bm);
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Damage ahead of the action list over the fight">`;
    for (const v of niceTicks(lo, hi, 4)) {
      s += `<line class="grid" x1="${L}" x2="${W - Rm}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`;
      s += `<text class="lbl" x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${v > 0 ? '+' : ''}${kfmt(v)}</text>`;
    }
    const every = n > 400 ? 120 : n > 150 ? 60 : n > 60 ? 30 : 10;
    for (let t = 0; t <= n; t += every) s += `<text class="lbl" x="${x(t).toFixed(1)}" y="${H - 8}" text-anchor="middle">${mmss(t)}</text>`;
    let d = `M${x(0).toFixed(1)} ${y(0).toFixed(1)}`;
    diff.forEach((v, i) => { d += ` L${x(i + 1).toFixed(1)} ${y(v).toFixed(1)}`; });
    s += `<path class="area" d="${d} L${x(n).toFixed(1)} ${y(0).toFixed(1)} Z"/><path class="line" d="${d}"/>`;
    s += `<line class="axis" x1="${L}" x2="${W - Rm}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>`;
    return s + '</svg>';
  }

  // How the answer was found, and how sure it is.
  function method(res) {
    const secs = `${(res.ms / 1000).toFixed(1)}s`;
    if (res.mode === 'exact') {
      return res.exact ? `Every GCD order tried: ${fmt(res.tried)} positions (${fmt(res.merged)} merged as identical), in ${secs}. No GCD order does better here (with the list's abilities, on average luck).`
        : `Every GCD order, stopped after ${fmt(res.tried)} positions at GCD ${res.depth}: the best so far, not proven.`;
    }
    const ladder = (res.steps || []).map(x => `${x.width}: +${((x.score / res.guide.score - 1) * 100).toFixed(2)}%`).join(' · ');
    const sure = res.stopped ? 'stopped early, so not settled' : res.converged ? 'settled: the widest beam found nothing more' : 'not settled at the widest beam allowed; a wider one may find more';
    const pol = res.polished ? `; a final polish ${res.polished.changes ? `changed ${res.polished.changes} GCD${res.polished.changes > 1 ? 's' : ''}` : 'found no single-GCD change that gains'}` : '';
    return `Beam widened by lines kept (${ladder}), ${sure}${pol}. ${fmt(res.tried)} fights played out in ${secs}.`;
  }

  function search(res, rep, extra) {
    extra = extra || {};
    const B1 = rep.best, G = rep.guide;
    const D = res.cfg.duration;
    const gain = res.best.score - res.guide.score;
    const role = B1.role === 'tank' ? 'tank' : B1.role === 'healer' ? 'healer' : 'dps';
    const bg = B1.seq.filter(q => q.gcd && q.t >= -1e-6), gg = G.seq.filter(q => q.gcd && q.t >= -1e-6);
    const n = Math.max(bg.length, gg.length);
    let changed = 0;
    const rows = [];
    for (let i = 0; i < n; i++) {
      const a = bg[i], b = gg[i];
      const diff = !a || !b || a.id !== b.id;
      if (diff) changed++;
      rows.push(`<tr${diff ? ' class="diff"' : ''}><td class="num muted">${i + 1}</td><td class="num muted">${a ? a.t.toFixed(2) : ''}</td><td>${a ? esc(a.name) : ''}</td><td class="num muted">${b ? b.t.toFixed(2) : ''}</td><td>${b ? esc(b.name) : ''}</td></tr>`);
    }
    const ids = [...new Set(bg.concat(gg).map(q => q.id))];
    const count = (list, id) => list.filter(q => q.id === id).length;
    const counts = ids.map(id => ({ id, name: (bg.concat(gg).find(q => q.id === id) || {}).name || id, b: count(bg, id), g: count(gg, id) }))
      .sort((p, q) => Math.abs(q.b - q.g) - Math.abs(p.b - p.g) || q.b - p.b);
    const party = B1.party.length ? B1.party.join(', ') : 'Solo, no raid buffs';
    const first = bg.findIndex((q, i) => !gg[i] || gg[i].id !== q.id);
    return `
<section class="headline card">
  <div class="who"><span class="jobchip ${role}">${esc(B1.abbr)}</span>
    <div><h2 class="jobname">Best GCD order for ${esc(mmss(D))}</h2><p class="muted">${esc(B1.jobName)} · ${esc(B1.versionLabel)} · live ${esc(B1.patch)}</p></div></div>
  <div class="dpsfig stack"><div><span class="big">${fmt(res.best.score / D)}</span> <span class="unit">DPS</span></div>
    <span class="err ${gain > 0.5 ? 'good' : ''}">${gain > 0.5 ? `+${fmt(gain / D)} DPS (+${(gain / res.guide.score * 100).toFixed(2)}%) over the action list's ${fmt(res.guide.score / D)}` : `The action list's own order (${fmt(res.guide.score / D)}) is the best found`}</span></div>
  <dl class="facts">
    <div><dt>Searched</dt><dd>${method(res)}</dd></div>
    <div><dt>Changes</dt><dd>${changed ? `${changed} of ${n} GCDs differ from the action list${first >= 0 ? `, the first at GCD ${first + 1} (${bg[first].t.toFixed(2)}s)` : ''}` : 'None: the action list already plays the best order found'}</dd></div>
    <div><dt>Party</dt><dd>${esc(party)}</dd></div>
    <div><dt>Luck</dt><dd>Average: crits and direct hits at their rates, no damage roll, steady ping${res.seeds.length > 1 ? '; procs averaged over three seeds' : ''}</dd></div>
  </dl>
</section>
<section class="card"><h2>Damage ahead of the action list</h2>${aheadChart(B1, G)}
  <p class="muted small">Total damage of the best order minus the action list's, second by second. Where it climbs is where the new order gains.</p></section>
<div class="pair">
  <section class="card"><h2>GCD by GCD</h2>
    <div class="scroll gcdlist"><table class="tbl cmp"><thead><tr><th scope="col" class="num">#</th><th scope="col" class="num">Time</th><th scope="col">Best order</th><th scope="col" class="num">Time</th><th scope="col">Action list</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>
    <div class="row"><span class="muted small">Highlighted: a different GCD.</span><button id="copy-order" class="ghost" type="button">Copy the best order</button></div></section>
  <section class="card"><h2>GCDs used</h2>
    <div class="scroll"><table class="tbl"><thead><tr><th scope="col">Action</th><th scope="col" class="num">Best</th><th scope="col" class="num">List</th><th scope="col" class="num">Change</th></tr></thead>
    <tbody>${counts.map(c => `<tr><th scope="row">${esc(c.name)}</th><td class="num">${c.b}</td><td class="num">${c.g}</td><td class="num ${c.b > c.g ? 'good' : c.b < c.g ? 'bad' : 'muted'}">${c.b === c.g ? '–' : (c.b > c.g ? '+' : '−') + Math.abs(c.b - c.g)}</td></tr>`).join('')}</tbody></table></div></section>
</div>
<section class="card"><h2>The best order, played out</h2>
  <p class="muted small">Weaponskills and spells along the bottom; the abilities around them come from the action list.</p>
  <div class="scroll seqwrap">${sequence(B1)}</div>
  <details><summary>The action list's own fight</summary><div class="scroll seqwrap">${sequence(G)}</div></details>
</section>`;
  }

  // The best order as plain text: one GCD a line with its time.
  function orderText(rep) {
    return rep.best.seq.filter(q => q.gcd && q.t >= -1e-6).map((q, i) => `${String(i + 1).padStart(3)}  ${q.t.toFixed(2).padStart(6)}  ${q.name}`).join('\n');
  }

  B.SimReport = { render, rankings, text, search, orderText, fmt, mmss };
})(window.BLM);

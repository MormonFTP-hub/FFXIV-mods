// The leader board: a log of the party leaders who let you in, per server, and how often they said yes.
// On the claude.ai page the log is shared (the artifact's db): everyone who opens the link reads it, and
// whoever can write adds their own parties. Anywhere else (a local copy, a static host) it stays in this
// browser, and Copy CSV / Import move it around. Same columns and tally as Aion2AssassinBoard/Code.gs, so
// the Google Form's response sheet pastes straight in.
(function () {
  'use strict';
  const A2 = window.A2 = window.A2 || {};

  const SERVERS = [
    'Ariel (Elyos)', 'Fregion (Elyos)', 'Hithanya (Elyos)', 'Kaisinel (Elyos)', 'Meslamtaeda (Elyos)',
    'Nezekan (Elyos)', 'Siel (Elyos)', 'Vaizel (Elyos)', 'Yustiel (Elyos)',
    'Azphel (Asmodian)', 'Beritra (Asmodian)', 'Ereshkigal (Asmodian)', 'Israphel (Asmodian)', 'Lumiel (Asmodian)',
    'Marchutan (Asmodian)', 'Nemon (Asmodian)', 'Triniel (Asmodian)', 'Zikel (Asmodian)',
  ];
  const CONTENT = ['Expedition', 'Transcendence', 'Nightmare', 'Sanctuary', 'Spacetime Rift', 'Abyss / Artifact Conquest',
                   'Field boss', 'Daily dungeon', 'Other'];
  const CLASSES = ['Assassin', 'Gladiator', 'Templar', 'Ranger', 'Sorcerer', 'Spiritmaster', 'Cleric', 'Chanter'];
  const RESULT = {yes: 'Took me', no: 'Turned me down', kick: 'Kicked me after I joined'};
  const LOCAL_KEY = 'a2sim.partylog';
  const PREF_KEY = 'a2sim.boardprefs';
  const NOTE_MAX = 160;

  const st = {
    mode: 'local',        // 'shared' (db, can write) | 'readonly' (db, can't write) | 'local'
    db: null, user: null, uid: null, owner: false,
    docs: {},             // shared: {userId: [entries]}
    local: [],
    track: 'Assassin', search: '', server: '', showMine: false, writing: Promise.resolve(),
  };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private window: the log lives for this visit */ } },
  };

  // --- reading the log ------------------------------------------------------------------

  function allEntries() {
    const out = [];
    if (st.mode !== 'local') for (const by in st.docs) for (const e of st.docs[by]) out.push(Object.assign({by}, e));
    // a read-only visitor's own entries stay in their browser and join the shared list on their screen
    if (st.mode !== 'shared') for (const e of st.local) out.push(Object.assign({by: 'me'}, e));
    return out;
  }

  function mine() {
    return st.mode === 'shared' ? (st.docs[st.uid] || []) : st.local;
  }

  function resultKind(s) {
    s = String(s || '');
    if (s === 'yes' || s === 'no' || s === 'kick') return s;
    if (/kick/i.test(s)) return 'kick';
    if (/turn|declin|reject|denied|\bno\b/i.test(s)) return 'no';
    if (/took|accept|invit|\byes\b/i.test(s)) return 'yes';
    return null;
  }

  /** "Siel (Elyos)" -> {server: 'Siel', faction: 'Elyos'}; a typed-in name gets its faction from SERVERS. */
  function serverOf(s) {
    const m = /^(.*?)\s*\((Elyos|Asmodian)\)\s*$/i.exec(s || '');
    const server = (m ? m[1] : (s || '')).trim();
    if (!server) return {server: 'Unknown server', faction: ''};
    const known = SERVERS.find((x) => x.toLowerCase().startsWith(server.toLowerCase() + ' ('));
    const name = known ? known.split(' (')[0] : server.charAt(0).toUpperCase() + server.slice(1);
    const faction = known ? /\((\w+)\)/.exec(known)[1] : m ? m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase() : '';
    return {server: name, faction};
  }

  /** One record per leader (same server and name, ignoring case) for the tracked class. */
  function tally(entries) {
    const leaders = {};
    for (const e of entries.slice().sort((a, b) => a.at - b.at)) {
      const name = String(e.leader || '').replace(/^@/, '').replace(/\s+/g, ' ').trim();
      const kind = resultKind(e.result);
      if (!name || !kind) continue;
      if ((e.cls || st.track).toLowerCase() !== st.track.toLowerCase()) continue;
      const {server, faction} = serverOf(e.server);
      const key = `${server}|${name}`.toLowerCase();
      const l = leaders[key] || (leaders[key] = {name, server, faction, yes: 0, no: 0, kick: 0, content: {}, lastYes: 0, note: ''});
      l.name = name;
      l[kind]++;
      if (kind === 'yes') {
        l.lastYes = Math.max(l.lastYes, e.at || 0);
        if (e.content) l.content[e.content] = (l.content[e.content] || 0) + 1;
      }
      if (e.note) l.note = e.note;
    }
    return Object.values(leaders);
  }

  function byRecord(a, b) {
    const rate = (l) => l.yes / (l.yes + l.no + l.kick);
    return b.yes - a.yes || rate(b) - rate(a) || b.lastYes - a.lastYes;
  }

  function ago(t) {
    if (!t) return '';
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 90) return 'just now';
    if (s < 5400) return `${Math.round(s / 60)} min ago`;
    if (s < 129600) return `${Math.round(s / 3600)} h ago`;
    const d = Math.round(s / 86400);
    return d === 1 ? 'yesterday' : `${d} days ago`;
  }

  // --- drawing ------------------------------------------------------------------------------

  function render() {
    const root = $('board-list');
    if (!root) return;
    const entries = allEntries();
    const leaders = tally(entries);
    const takers = leaders.filter((l) => l.yes > 0).sort(byRecord);
    const tot = {yes: 0, no: 0, kick: 0};
    for (const l of leaders) for (const k in tot) tot[k] += l[k];
    const tries = tot.yes + tot.no + tot.kick;

    $('board-track').textContent = st.track + 's';
    $('board-summary').innerHTML = tries
      ? `<b>${takers.length}</b> ${takers.length === 1 ? 'leader has' : 'leaders have'} taken ${article(st.track)}. ` +
        `${tries} ${tries === 1 ? 'application' : 'applications'} logged, <b>${Math.round(100 * tot.yes / tries)}%</b> got in ` +
        `<span class="tally"><i class="t-yes">${tot.yes} took</i><i class="t-no">${tot.no} turned down</i><i class="t-kick">${tot.kick} kicked</i></span>`
      : `Nothing logged yet. After each party you apply to as ${article(st.track)}, log the leader here, whether they took you or not.`;

    const q = st.search.trim().toLowerCase();
    const shown = takers.filter((l) => (!q || l.name.toLowerCase().includes(q) || (l.note || '').toLowerCase().includes(q)) &&
                                      (!st.server || l.server === st.server));
    const byServer = {};
    for (const l of shown) (byServer[l.server] = byServer[l.server] || []).push(l);
    const servers = Object.keys(byServer).sort((a, b) => byServer[b].length - byServer[a].length || a.localeCompare(b));

    const sel = $('board-server');
    const allServers = Array.from(new Set(takers.map((l) => l.server))).sort();
    sel.innerHTML = `<option value="">All servers</option>` + allServers.map((s) => `<option${s === st.server ? ' selected' : ''}>${esc(s)}</option>`).join('');

    if (!takers.length) {
      root.innerHTML = `<div class="empty"><b>No leaders yet.</b> The first leader who takes ${article(st.track)} shows up here with their record. ` +
        `Leaders who have only ever said no stay off the list, but they still count in the numbers above.</div>`;
    } else if (!servers.length) {
      root.innerHTML = `<div class="empty">No leader matches “${esc(st.search)}”.</div>`;
    } else {
      root.innerHTML = servers.map((server) => {
        const list = byServer[server];
        const fac = list[0].faction;
        return `<section class="srv ${fac.toLowerCase()}"><h4><span class="fac">${esc(fac || 'Server')}</span>${esc(server)}` +
          `<small>${list.length} ${list.length === 1 ? 'leader' : 'leaders'}</small></h4><ol>` +
          list.map(leaderRow).join('') + `</ol></section>`;
      }).join('');
    }
    renderMine();
    renderMode();
  }

  function leaderRow(l) {
    const content = Object.keys(l.content).sort((a, b) => l.content[b] - l.content[a]);
    return `<li><div class="ln"><button class="nm" data-copy="${esc(l.name)}" title="Copy name">${esc(l.name)}</button>` +
      `<span class="tally"><i class="t-yes">${l.yes} took</i>${l.no ? `<i class="t-no">${l.no} no</i>` : ''}${l.kick ? `<i class="t-kick">${l.kick} kicked</i>` : ''}</span>` +
      `<span class="when">${esc(ago(l.lastYes))}</span></div>` +
      (content.length ? `<div class="ct">${content.map((c) => `<span>${esc(c)}</span>`).join('')}</div>` : '') +
      (l.note ? `<div class="note">${esc(l.note)}</div>` : '') + `</li>`;
  }

  function renderMine() {
    const box = $('board-mine');
    const list = mine().slice().sort((a, b) => b.at - a.at);
    $('board-mine-count').textContent = list.length;
    if (!st.showMine) { box.hidden = true; return; }
    box.hidden = false;
    let rows = list.map((e) => `<tr><td>${esc(new Date(e.at).toLocaleDateString())}</td><td>${esc(e.leader)}</td>` +
      `<td>${esc(serverOf(e.server).server)}</td><td>${esc({yes: 'took', no: 'no', kick: 'kicked'}[resultKind(e.result)] || e.result)}</td>` +
      `<td>${esc(e.cls || '')}</td><td>${esc(e.content || '')}</td>` +
      `<td>${canWrite() ? `<button class="x" data-del="${esc(e.id)}" title="Delete this entry">Delete</button>` : ''}</td></tr>`).join('');
    if (st.owner && st.mode === 'shared') {
      // The artifact's owner can tidy anyone's entries (a joke entry, a typo).
      const others = allEntries().filter((e) => e.by !== st.uid).sort((a, b) => b.at - a.at);
      if (others.length) {
        rows += `<tr class="sub"><td colspan="7">Other people's entries (you can delete them as the owner)</td></tr>` +
          others.map((e) => `<tr><td>${esc(new Date(e.at).toLocaleDateString())}</td><td>${esc(e.leader)}</td><td>${esc(serverOf(e.server).server)}</td>` +
          `<td>${esc({yes: 'took', no: 'no', kick: 'kicked'}[resultKind(e.result)] || '')}</td><td>${esc(e.cls || '')}</td><td>${esc(e.content || '')}</td>` +
          `<td><button class="x" data-del="${esc(e.id)}" data-by="${esc(e.by)}">Delete</button></td></tr>`).join('');
      }
    }
    box.innerHTML = list.length || rows
      ? `<div class="scroll"><table><thead><tr><th>Date</th><th>Leader</th><th>Server</th><th>Result</th><th>As</th><th>Content</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<p class="dim">You haven't logged a party yet.</p>`;
  }

  function renderMode() {
    const m = $('board-mode');
    const form = $('board-form');
    if (st.mode === 'shared') {
      m.innerHTML = `<b>Shared log.</b> Everyone who opens this page's link sees these leaders, and your entries go to the same list.`;
    } else if (st.mode === 'readonly') {
      m.innerHTML = `<b>Shared list, yours in this browser.</b> You see everyone's leaders. Only the page's owner and people they let edit add to the shared list, so the parties you log stay in this browser (Copy CSV sends them to the owner).`;
    } else {
      m.innerHTML = `<b>Saved in this browser.</b> Open the shared page to log to the same list as everyone else, or move your log with Copy CSV and Import.`;
    }
    form.querySelectorAll('input,select,button').forEach((el) => { el.disabled = !canWrite(); });
  }

  function article(word) {
    return (/^[aeiou]/i.test(word) ? 'an ' : 'a ') + word;
  }

  function canWrite() {
    return true;   // shared, or kept in this browser
  }

  // --- writing ----------------------------------------------------------------------------

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function saveMine(list, by) {
    if (st.mode !== 'shared') {
      st.local = list;
      store.set(LOCAL_KEY, list);
      render();
      return Promise.resolve();
    }
    const who = by || st.uid;
    st.docs[who] = list;  // shows at once; the snapshot confirms it
    render();
    // One write at a time to a document: chain them.
    st.writing = st.writing.then(() => st.db.doc('log/' + who).set({entries: list, updated: Date.now()})).catch((e) => {
      toast(e && e.code === 'quota_exceeded' ? 'The shared log is full. Delete some old entries first.' :
            'Couldn\'t save to the shared log. It\'s kept in this browser instead.');
      if (e && e.code === 'invalid_argument') {
        st.local = st.local.concat(list.filter((x) => !st.local.some((y) => y.id === x.id)));
        store.set(LOCAL_KEY, st.local);
        st.mode = 'readonly';
        render();
      }
    });
    return st.writing;
  }

  function addEntry(e) {
    const entry = {
      id: newId(), at: e.at || Date.now(),
      leader: String(e.leader).trim().slice(0, 40), server: String(e.server || '').trim().slice(0, 40),
      result: resultKind(e.result) || 'yes', content: String(e.content || '').slice(0, 40),
      cls: String(e.cls || st.track).slice(0, 20), note: String(e.note || '').trim().slice(0, NOTE_MAX),
    };
    return entry;
  }

  function onSubmit(ev) {
    ev.preventDefault();
    const f = ev.target;
    const leader = f.leader.value.trim();
    if (!leader) { toast('Type the party leader\'s character name.'); f.leader.focus(); return; }
    if (!f.server.value.trim()) { toast('Pick or type the server.'); f.server.focus(); return; }
    const res = f.querySelector('input[name="result"]:checked');
    const e = addEntry({leader, server: f.server.value, result: res ? res.value : 'yes', content: f.content.value,
                        cls: f.cls.value, note: f.note.value});
    saveMine(mine().concat([e]));
    store.set(PREF_KEY, Object.assign(store.get(PREF_KEY, {}), {server: f.server.value, cls: f.cls.value, content: f.content.value}));
    f.leader.value = '';
    f.note.value = '';
    f.querySelector('input[name="result"][value="yes"]').checked = true;
    toast(`Logged ${e.leader}: ${{yes: 'took you', no: 'turned you down', kick: 'kicked you'}[e.result]}.`);
    f.leader.focus();
  }

  function onDelete(id, by) {
    if (by && by !== st.uid && st.mode === 'shared') {
      saveMine((st.docs[by] || []).filter((e) => e.id !== id), by);
    } else {
      saveMine(mine().filter((e) => e.id !== id));
    }
  }

  // --- CSV in and out --------------------------------------------------------------------

  function toCsv(list) {
    const q = (s) => /[",\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : String(s);
    const head = ['Timestamp', "Party leader's character name", 'Server', 'What happened?', 'Content', 'You applied as', 'Notes'];
    return [head.join(',')].concat(list.slice().sort((a, b) => a.at - b.at).map((e) =>
      [new Date(e.at).toISOString(), e.leader, e.server, RESULT[resultKind(e.result)] || e.result, e.content || '', e.cls || '', e.note || '']
        .map(q).join(','))).join('\n');
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    const sep = text.indexOf('\t') >= 0 && text.indexOf(',') < 0 ? '\t' : (text.split('\n')[0].indexOf('\t') >= 0 ? '\t' : ',');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
      } else if (c === '"') quoted = true;
      else if (c === sep) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some((x) => x.trim())) rows.push(row);
        row = [];
      } else cell += c;
    }
    row.push(cell);
    if (row.some((x) => x.trim())) rows.push(row);
    return rows;
  }

  /** Rows from Copy CSV or the Google Form's response sheet (copied cells paste as tab-separated). */
  function importText(text) {
    const rows = parseCsv(text.trim());
    if (!rows.length) return 0;
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const col = (re) => head.findIndex((h) => re.test(h));
    let c = {at: col(/timestamp|date/), leader: col(/leader|name/), server: col(/server/), result: col(/happen|result/),
             content: col(/content/), cls: col(/applied|class/), note: col(/note/)};
    let body = rows.slice(1);
    if (c.leader < 0 || c.result < 0) {  // no header row: assume the sheet's column order
      c = {at: 0, leader: 1, server: 2, result: 3, content: 4, cls: 5, note: 6};
      body = rows;
    }
    const have = new Set(mine().map((e) => `${e.at}|${e.leader}`.toLowerCase()));
    const add = [];
    for (const r of body) {
      const get = (i) => (i >= 0 && r[i] != null ? String(r[i]).trim() : '');
      if (!get(c.leader) || !resultKind(get(c.result))) continue;
      const at = Date.parse(get(c.at)) || Date.now();
      if (have.has(`${at}|${get(c.leader)}`.toLowerCase())) continue;
      add.push(addEntry({at, leader: get(c.leader), server: get(c.server), result: get(c.result), content: get(c.content),
                         cls: get(c.cls) || 'Assassin', note: get(c.note)}));
    }
    if (add.length) saveMine(mine().concat(add));
    return add.length;
  }

  // --- wiring ------------------------------------------------------------------------------

  function toast(msg) {
    if (A2.toast) A2.toast(msg); else console.log(msg);
  }

  function fillForm() {
    const f = $('board-form');
    const prefs = store.get(PREF_KEY, {});
    $('board-servers').innerHTML = SERVERS.map((s) => `<option value="${esc(s)}"></option>`).join('');
    f.content.innerHTML = `<option value="">Content (optional)</option>` + CONTENT.map((c) => `<option>${esc(c)}</option>`).join('');
    f.cls.innerHTML = CLASSES.map((c) => `<option>${esc(c)}</option>`).join('');
    $('board-class').innerHTML = CLASSES.map((c) => `<option>${esc(c)}</option>`).join('');
    if (prefs.server) f.server.value = prefs.server;
    if (prefs.content) f.content.value = prefs.content;
    if (prefs.track && CLASSES.includes(prefs.track)) st.track = prefs.track;
    f.cls.value = prefs.cls && CLASSES.includes(prefs.cls) ? prefs.cls : st.track;
    $('board-class').value = st.track;
  }

  function wire() {
    const f = $('board-form');
    f.addEventListener('submit', onSubmit);
    $('board-search').addEventListener('input', (e) => { st.search = e.target.value; render(); });
    $('board-server').addEventListener('change', (e) => { st.server = e.target.value; render(); });
    $('board-class').addEventListener('change', (e) => {
      st.track = e.target.value;
      store.set(PREF_KEY, Object.assign(store.get(PREF_KEY, {}), {track: st.track}));
      render();
    });
    $('board-mine-toggle').addEventListener('click', () => {
      st.showMine = !st.showMine;
      $('board-mine-toggle').setAttribute('aria-expanded', st.showMine);
      renderMine();
    });
    $('board-panel').addEventListener('click', (e) => {
      const copy = e.target.closest('[data-copy]');
      if (copy) {
        const name = copy.getAttribute('data-copy');
        const done = () => toast(`Copied ${name}`);
        try { navigator.clipboard.writeText(name).then(done, () => toast(name)); } catch (err) { toast(name); }
      }
      const del = e.target.closest('[data-del]');
      if (del) onDelete(del.getAttribute('data-del'), del.getAttribute('data-by'));
    });
    $('board-export').addEventListener('click', () => {
      const box = $('board-io');
      box.hidden = false;
      $('board-io-text').value = toCsv(mine());
      $('board-io-text').select();
      try { navigator.clipboard.writeText($('board-io-text').value).then(() => toast('Your log is copied as CSV.'), () => {}); } catch (err) { /* selected instead */ }
    });
    $('board-import').addEventListener('click', () => {
      const box = $('board-io');
      if (box.hidden || !$('board-io-text').value.trim()) {
        box.hidden = false;
        $('board-io-text').value = '';
        $('board-io-text').placeholder = 'Paste CSV here (from Copy CSV, or copy the cells of the Google Form\'s response sheet), then press Import again.';
        $('board-io-text').focus();
        return;
      }
      const n = importText($('board-io-text').value);
      toast(n ? `Imported ${n} ${n === 1 ? 'entry' : 'entries'}.` : 'Nothing new to import. The first row should be the column names.');
      if (n) { $('board-io-text').value = ''; box.hidden = true; }
    });
  }

  async function connect() {
    let db = null, user = null;
    try {
      if (window.claude && typeof window.claude.use === 'function') {
        [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      }
    } catch (e) { db = null; }
    if (!db) return;
    let uid = null;
    try { uid = user ? await user.id() : null; } catch (e) { uid = null; }
    let can = null;
    try { can = user ? await user.can('data.write') : null; } catch (e) { can = null; }
    try { st.owner = user ? !!(await user.isOwner()) : false; } catch (e) { st.owner = false; }
    st.db = db;
    st.uid = uid;
    st.mode = uid && can !== false ? 'shared' : 'readonly';
    db.collection('log').onSnapshot((snap) => {
      const docs = {};
      for (const d of snap.docs) {
        const body = d.data() || {};
        docs[d.id] = Array.isArray(body.entries) ? body.entries.filter((e) => e && typeof e === 'object') : [];
      }
      st.docs = docs;
      render();
    }, () => {
      st.mode = 'local';
      render();
    });
    render();
  }

  A2.Board = {
    init() {
      st.local = store.get(LOCAL_KEY, []);
      fillForm();
      wire();
      render();
      connect();
      setInterval(() => { if (!$('board-panel').hidden) render(); }, 60000);  // keep "2 h ago" current
    },
    render,
    tally: () => tally(allEntries()),
  };
})();

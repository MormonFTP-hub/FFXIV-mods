"use strict";
/* Insta Viewer: a desktop-style viewer for Instagram links. The local server (server/app.py) fetches the public pages;
   this page lays them out like a desktop photo/video viewer: history sidebar, big stage, info panel. */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const store = {
  get(k, d) { try { const v = localStorage.getItem("iv." + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("iv." + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

// ------------------------------------------------------------------ icons
const ICONS = {
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9.5 4v16"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  fwd: '<path d="M9 18l6-6-6-6"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/>',
  refresh: '<path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1L20.5 8.5"/><path d="M20.5 3.5v5h-5"/>',
  clipboard: '<rect x="8" y="2.5" width="8" height="4" rx="1"/><path d="M16 4.5h2a2 2 0 0 1 2 2V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h2"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>',
  comment: '<path d="M20.5 11.5a8.4 8.4 0 0 1-12.3 7.5L3.5 20.5l1.5-4.6a8.5 8.5 0 1 1 15.5-4.4z"/>',
  download: '<path d="M12 3.5v11.5"/><path d="M7 10.5l5 5 5-5"/><path d="M4.5 20.5h15"/>',
  external: '<path d="M14.5 3.5h6v6"/><path d="M10 14L20.5 3.5"/><path d="M18 13.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5.5"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5"/>',
  play: '<path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l11.2-7.2a1 1 0 0 0 0-1.72L8.5 3.94A1 1 0 0 0 7 4.8z"/>',
  pause: '<rect x="5.5" y="4" width="4.5" height="16" rx="1.2"/><rect x="14" y="4" width="4.5" height="16" rx="1.2"/>',
  volume: '<path d="M11 5L6 9H2.5v6H6l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9.5 9.5 0 0 1 0 13"/>',
  mute: '<path d="M11 5L6 9H2.5v6H6l5 4z"/><path d="M22 9l-6 6"/><path d="M16 9l6 6"/>',
  fullscreen: '<path d="M8 3.5H5.5a2 2 0 0 0-2 2V8"/><path d="M20.5 8V5.5a2 2 0 0 0-2-2H16"/><path d="M3.5 16v2.5a2 2 0 0 0 2 2H8"/><path d="M16 20.5h2.5a2 2 0 0 0 2-2V16"/>',
  loop: '<path d="M17 2.5l3.5 3.5L17 9.5"/><path d="M3.5 11.5V10a4 4 0 0 1 4-4h13"/><path d="M7 21.5L3.5 18 7 14.5"/><path d="M20.5 12.5V14a4 4 0 0 1-4 4h-13"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  reel: '<rect x="3" y="3" width="18" height="18" rx="4.5"/><path d="M3 8.5h18"/><path d="M8.5 3l3 5.5"/><path d="M14.5 3l3 5.5"/><path d="M10 12.2v5.1l4.5-2.55z" fill="currentColor"/>',
  carousel: '<rect x="7" y="7" width="14" height="14" rx="2.5"/><path d="M17 3.5H6A2.5 2.5 0 0 0 3.5 6v11"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="9" cy="9" r="2"/><path d="M21 15.5l-5-5L5 21"/>',
  video: '<rect x="2.5" y="5" width="14" height="14" rx="2.5"/><path d="M16.5 10.5l5-3v9l-5-3"/>',
  pin: '<path d="M19.5 10c0 5.5-7.5 11.5-7.5 11.5S4.5 15.5 4.5 10a7.5 7.5 0 0 1 15 0z"/><circle cx="12" cy="10" r="2.5"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  x: '<path d="M18 6L6 18"/><path d="M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5l-4.2-4.2"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  trash: '<path d="M3.5 6h17"/><path d="M8.5 6V4h7v2"/><path d="M18.5 6l-.9 14H6.4L5.5 6"/>',
  calendar: '<rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3.5 10h17"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5"/><path d="M12 16.5h.01"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  wifi: '<path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 5.2-2.7"/><path d="M19 12.9a10 10 0 0 0-2.3-1.7"/><path d="M2 8.8a15 15 0 0 1 4.2-2.6"/><path d="M22 8.8A15 15 0 0 0 11 5"/><path d="M12 20h.01"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5l-4.2-4.2"/><path d="M11 8v6M8 11h6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z"/>',
  moon: '<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
  monitor: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  send: '<path d="M21.5 2.5L10.5 13.5"/><path d="M21.5 2.5l-7 19-4-8.5-8.5-4z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
const icon = (n, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ""}</svg>`;
const VERIFIED = `<span class="vbadge" title="Verified"><svg class="i" viewBox="0 0 24 24"><path d="M12 1.8l2.6 1.9 3.2-.1 1 3.1 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3.1-3.2-.1L12 22.2l-2.6-1.9-3.2.1-1-3.1-2.6-1.9 1-3.1-1-3.1 2.6-1.9 1-3.1 3.2.1z"/><path class="check" d="M8.3 12.2l2.5 2.5 4.9-5"/></svg></span>`;
function hydrateIcons(root = document) {
  for (const n of $$("[data-icon]", root)) {
    if (n.dataset.iconDone) continue;
    n.insertAdjacentHTML("afterbegin", icon(n.dataset.icon));
    n.dataset.iconDone = "1";
  }
}

// ------------------------------------------------------------------ helpers
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// single quotes: these also go inside style="…" attributes
const cssUrl = u => u ? `url('${String(u).replace(/['"\\\n()]/g, encodeURIComponent)}')` : "none";
const num = n => n == null ? "–" : Number(n).toLocaleString("en-US");
const compact = n => n == null ? "–" : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const plural = (n, one, many) => `${num(n)} ${n === 1 ? one : many}`;
const IG = "https://www.instagram.com";
const postLink = code => `${IG}/p/${code}/`;
const userLink = u => `${IG}/${u}/`;

function ago(ts) {
  const s = Date.now() / 1000 - ts;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, secs] of [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]]) {
    if (Math.abs(s) >= secs) return rtf.format(-Math.floor(s / secs), unit);
  }
  return "just now";
}
const longDate = ts => new Date(ts * 1000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
const fullDate = ts => new Date(ts * 1000).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" });
function clock(t) {
  if (!isFinite(t)) return "0:00";
  t = Math.max(0, Math.floor(t));
  const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function linkify(text) {
  const re = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])|(?<![\w@])@([A-Za-z0-9._]{1,30})|(?<![\w&#])#([\p{L}\p{N}_]+)/gu;
  let out = "", last = 0;
  for (const m of text.matchAll(re)) {
    out += esc(text.slice(last, m.index));
    if (m[1]) out += `<a data-ext="${esc(m[1])}" title="${esc(m[1])}">${esc(m[1].replace(/^https?:\/\/(www\.)?/, ""))}</a>`;
    else if (m[2]) {
      const u = m[2].replace(/\.+$/, "");
      out += `<a data-user="${esc(u)}">@${esc(u)}</a>${esc(m[2].slice(u.length))}`;
    } else out += `<a data-ext="${IG}/explore/tags/${encodeURIComponent(m[3])}/">#${esc(m[3])}</a>`;
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}

async function api(path, body) {
  const opt = body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  let r;
  try { r = await fetch(path, opt); } catch { throw Object.assign(new Error("The viewer's local server isn't answering. Restart Insta Viewer."), { kind: "offline" }); }
  const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok) throw Object.assign(new Error(j.error || "Failed"), { kind: j.kind || "error" });
  return j;
}

async function copyText(t, what = "Link") {
  try { await navigator.clipboard.writeText(t); }
  catch {
    const ta = Object.assign(document.createElement("textarea"), { value: t });
    document.body.append(ta); ta.select(); document.execCommand("copy"); ta.remove();
  }
  S.clipSeen = t.trim();
  toast({ icon: "check", text: `${what} copied` });
}

async function copyImage(url) {
  try {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob);
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    c.getContext("2d").drawImage(bmp, 0, 0);
    const png = await c.convertToBlob({ type: "image/png" });
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    toast({ icon: "check", text: "Image copied", sub: `${bmp.width} × ${bmp.height}` });
  } catch (e) {
    toast({ err: true, icon: "alert", text: "Couldn't copy the image", sub: e.message });
  }
}

const external = url => api("/api/external", { url }).catch(() => {});

// ------------------------------------------------------------------ state
const S = {
  view: "empty", post: null, profile: null, index: 0, history: [], info: { ffmpeg: false },
  load: 0, item: 0, query: "", tagsOn: store.get("tags", false), clipSeen: "", player: null, zoom: null,
  infoTab: "comments", cm: null,
};

function showView(name) {
  S.view = name;
  for (const v of ["Empty", "Loading", "Error", "Post", "Profile"]) $("#view" + v).hidden = v.toLowerCase() !== name;
  if (name !== "post") teardownItem();
  $("#btnReload").disabled = !(name === "post" || name === "profile" || name === "error");
  if (name === "empty") { document.title = "Insta Viewer"; renderEmptyRecent(); }
  markActive();
}

// ------------------------------------------------------------------ opening links
function routeFor() {
  if (S.view === "post" && S.post) return `#/p/${S.post.code}${S.index ? "/" + (S.index + 1) : ""}`;
  if (S.view === "profile" && S.profile) return `#/u/${S.profile.username}`;
  return "#/";
}
function queryFromHash(h) {
  let m = h.match(/^#\/p\/([\w-]+)(?:\/(\d+))?/);
  if (m) return postLink(m[1]) + (m[2] ? `?img_index=${m[2]}` : "");
  m = h.match(/^#\/u\/([\w.]+)/);
  if (m) return userLink(m[1]);
  m = h.match(/^#\/open\/(.+)/);
  if (m) return decodeURIComponent(m[1]);
  return null;
}

async function open(q, opt = {}) {
  q = String(q || "").trim();
  if (!q) return;
  const token = ++S.load;
  S.query = q;
  S.clipSeen = q;
  hideClip();
  $("#url").value = q;
  $("#url").blur();
  const spin = setTimeout(() => token === S.load && showView("loading"), 120);
  try {
    const res = await api("/api/open?q=" + encodeURIComponent(q) + (opt.fresh ? "&fresh=1" : ""));
    if (token !== S.load) return;
    clearTimeout(spin);
    if (res.kind === "post") {
      S.post = res.post; S.profile = null;
      S.index = Math.min(res.index || 0, res.post.items.length - 1);
      renderPost();
    } else {
      S.profile = res.profile; S.post = null;
      renderProfile();
    }
    const route = routeFor();
    if (opt.push === false || location.hash === route) history.replaceState(null, "", route);
    else history.pushState(null, "", route);
    updateNav();
    loadHistory();
    setTimeout(loadHistory, 2500);           // thumbnails are fetched in the background
  } catch (e) {
    if (token !== S.load) return;
    clearTimeout(spin);
    showError(e, q);
  }
}

function reload() {
  if (S.view === "post" && S.post) open(postLink(S.post.code) + (S.index ? `?img_index=${S.index + 1}` : ""), { fresh: true, push: false });
  else if (S.view === "profile" && S.profile) open(userLink(S.profile.username), { fresh: true, push: false });
  else if (S.view === "error" && S.query) open(S.query, { fresh: true, push: false });
}

const ERR = {
  login: ["lock", "Instagram wants you signed in for this"],
  missing: ["search", "Nothing at that link"],
  limited: ["clock", "Instagram is slowing things down"],
  offline: ["wifi", "Can't reach Instagram"],
  badlink: ["link", "That link isn't one I can open"],
  error: ["alert", "Couldn't open that"],
};
function showError(e, q) {
  const [ic, title] = ERR[e.kind] || ERR.error;
  const box = $("#errIcon");
  box.innerHTML = icon(ic);
  $("#errTitle").textContent = title;
  $("#errText").textContent = e.message;
  const isLink = /instagr(am\.com|\.am)/i.test(q);
  $("#errOpen").hidden = !isLink;
  $("#errOpen").onclick = () => external(/^https?:/.test(q) ? q : "https://" + q.replace(/^\/+/, ""));
  $("#errRetry").hidden = e.kind === "badlink";
  $("#errRetry").onclick = () => open(q, { fresh: true, push: false });
  showView("error");
  document.title = "Insta Viewer";
  $("#url").value = q;
}

// ------------------------------------------------------------------ post view
const typeLabel = p => p.product === "clips" ? "Reel" : p.type === "carousel" ? "Carousel" : p.type === "video" ? "Video" : "Photo";

function renderPost() {
  const p = S.post;
  showView("post");
  const multi = p.items.length > 1;
  $("#stage").classList.toggle("has-strip", multi);
  $("#filmstrip").innerHTML = multi ? p.items.map((it, i) =>
    `<button class="film" data-i="${i}" style="--ar:${(it.w && it.h) ? (it.w / it.h).toFixed(3) : 1};background-image:${cssUrl(it.thumb)}" title="${i + 1}">${it.kind === "video" ? `<span class="badge">${icon("play")}</span>` : ""}</button>`).join("") : "";
  $("#filmstrip").hidden = !multi;
  renderInfo();
  $("#url").value = p.url;
  document.title = `${p.user ? "@" + p.user.username : p.code} · ${typeLabel(p)} — Insta Viewer`;
  showItem(S.index, true);
}

function renderInfo() {
  const p = S.post, u = p.user || { username: "unknown", name: "" };
  const co = p.coauthors.length ? ` · with ${p.coauthors.map(c => `<a data-user="${esc(c.username)}">${esc(c.username)}</a>`).join(", ")}` : "";
  const meta = [];
  if (p.taken_at) meta.push(`<span title="${esc(fullDate(p.taken_at))}">${icon("calendar")}${esc(longDate(p.taken_at))} · ${esc(ago(p.taken_at))}</span>`);
  meta.push(`<span>${icon(p.product === "clips" ? "reel" : p.type === "carousel" ? "carousel" : p.type === "video" ? "video" : "image")}${typeLabel(p)}${p.items.length > 1 ? ` · ${p.items.length} items` : ""}</span>`);
  if (p.location) meta.push(`<span>${icon("pin")}${esc(p.location)}</span>`);
  if (p.music) meta.push(`<span title="Audio">${icon("music")}${esc(p.music.title)}${p.music.artist ? " · " + esc(p.music.artist) : ""}</span>`);
  if (p.ai_label) meta.push(`<span>${icon("sparkle")}AI info</span>`);

  const tagged = [], seen = new Set();
  for (const it of p.items) for (const t of it.tags) if (t.username && !seen.has(t.username)) { seen.add(t.username); tagged.push(t); }

  const more = p.more.slice(0, 9);
  $("#infoScroll").innerHTML = `
    <div class="author">
      <div class="avatar" data-user="${esc(u.username)}" style="background-image:${cssUrl(u.avatar)}" title="View @${esc(u.username)}"></div>
      <div class="author-text">
        <div class="author-name" data-user="${esc(u.username)}"><span>${esc(u.username)}</span>${u.verified ? VERIFIED : ""}</div>
        <div class="author-sub">${esc(u.name)}${co}</div>
      </div>
    </div>
    <div class="meta-line">${meta.join("")}</div>
    <div class="stats">
      <div class="stat">${icon("heart")}<div><b>${p.likes == null ? "Hidden" : num(p.likes)}</b><small>likes</small></div></div>
      <div class="stat link" data-act="comments" title="Show comments">${icon("comment")}<div><b>${num(p.comments)}</b><small>comments</small></div></div>
    </div>
    ${p.caption ? `<div class="caption" dir="auto">${linkify(p.caption)}</div>` : `<div class="caption caption-empty">No caption</div>`}
    ${p.edited ? `<div class="edited">Edited</div>` : ""}
    ${tagged.length ? `<div class="section-h">Tagged</div><div class="chips">${tagged.map(t => `<button class="chip plain" data-user="${esc(t.username)}" title="${esc(t.name || "")}">${icon("user")}${esc(t.username)}${t.verified ? VERIFIED : ""}</button>`).join("")}</div>` : ""}
    <div class="tabs" id="infoTabs">
      <button class="tab" data-tab="comments">Comments <span>${p.comments ? compact(p.comments) : ""}</span></button>
      ${more.length ? `<button class="tab" data-tab="more">More from ${esc(u.username)}</button>` : ""}
    </div>
    <div class="tab-page" data-page="comments"><div class="comments" id="comments"></div></div>
    ${more.length ? `<div class="tab-page" data-page="more">
      <div class="more-grid">${more.map(m => tileHTML(m)).join("")}</div>
      <div class="more-foot"><a data-user="${esc(u.username)}">View the profile of @${esc(u.username)}</a></div>
    </div>` : ""}`;
  $("#infoScroll").scrollTop = 0;
  showTab(more.length ? S.infoTab : "comments");
  startComments();
  const multi = p.items.length > 1;
  $("#saveLabel").textContent = "Save";              // the arrow next to it has "Save all"
  $("#btnSaveMenu").hidden = !multi;
  $("#btnSave").style.borderRadius = multi ? "" : "7px";
}

// ------------------------------------------------------------------ comments
function showTab(name) {
  S.infoTab = name;
  for (const t of $$("#infoTabs .tab")) t.classList.toggle("on", t.dataset.tab === name);
  for (const pg of $$(".tab-page")) pg.hidden = pg.dataset.page !== name;
}

function shortAgo(ts) {
  const s = Math.max(0, Date.now() / 1000 - ts);
  for (const [u, n] of [["y", 31536000], ["w", 604800], ["d", 86400], ["h", 3600], ["m", 60]]) if (s >= n) return Math.floor(s / n) + u;
  return "now";
}

function commentHTML(c) {
  const u = c.user || {};
  const body = c.text ? linkify(c.text) : c.gif ? "" : `<span class="cmt-muted">GIF or sticker</span>`;
  return `<div class="cmt">
    <div class="cmt-av" data-user="${esc(u.username)}" style="background-image:${cssUrl(u.avatar)}"></div>
    <div class="cmt-body">
      <div class="cmt-head"><a class="cmt-user" data-user="${esc(u.username)}">${esc(u.username)}</a>${u.verified ? VERIFIED : ""}<span class="cmt-time" title="${c.at ? esc(fullDate(c.at)) : ""}">${c.at ? shortAgo(c.at) : ""}</span></div>
      ${body ? `<div class="cmt-text${c.covered ? " covered" : ""}" dir="auto"${c.covered ? ' title="Hidden by Instagram. Click to show."' : ""}>${body}</div>` : ""}
      ${c.gif ? `<img class="cmt-gif" src="${esc(c.gif)}" alt="GIF" loading="lazy">` : ""}
      ${c.likes ? `<div class="cmt-foot">${icon("heart")}${num(c.likes)}</div>` : ""}
    </div>
  </div>`;
}

let commentObserver = null;
function startComments() {
  const p = S.post;
  S.cm = { code: p.code, after: p.comments_after, loading: false, ids: new Set(), count: 0, failed: false };
  const box = $("#comments");
  box.innerHTML = "";
  commentObserver?.disconnect();
  if (p.comments_off && !p.comment_list.length) { box.innerHTML = `<div class="cmt-empty">Comments are turned off for this post.</div>`; return; }
  if (!p.comment_list.length && !p.comments_after) { box.innerHTML = `<div class="cmt-empty">No comments yet.</div>`; return; }
  addComments(p.comment_list);
  box.insertAdjacentHTML("beforeend", `<div class="cmt-more" id="cmtMore"></div>`);
  commentObserver = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) moreComments(); },
    { root: $("#infoScroll"), rootMargin: "400px 0px" });
  commentObserver.observe($("#cmtMore"));
  syncMore();
}

function addComments(list) {
  const fresh = list.filter(c => c.id && !S.cm.ids.has(c.id));
  for (const c of fresh) S.cm.ids.add(c.id);
  S.cm.count += fresh.length;
  const html = fresh.map(commentHTML).join("");
  const more = $("#cmtMore");
  if (more) more.insertAdjacentHTML("beforebegin", html);
  else $("#comments").insertAdjacentHTML("beforeend", html);
}

function syncMore() {
  const box = $("#cmtMore"), cm = S.cm, total = S.post.comments || 0;
  if (!box) return;
  if (cm.loading) box.innerHTML = `<div class="spinner small"></div>`;
  else if (cm.after) box.innerHTML = cm.failed
    ? `<span class="cmt-muted">${esc(cm.failed)}</span><button class="btn ghost" data-act="more-comments">${icon("refresh")}Try again</button>`
    : `<button class="btn ghost" data-act="more-comments">Load more comments</button>`;
  else box.innerHTML = `<span class="cmt-muted">${num(cm.count)}${total > cm.count ? ` of ${num(total)}` : ""} comments${total > cm.count ? ". Instagram shows signed-out visitors these, without replies." : "."}</span>`;
}

async function moreComments(manual = false) {
  const cm = S.cm;
  if (!cm || cm.loading || !cm.after || (cm.failed && !manual)) return;
  cm.loading = true; cm.failed = false;
  syncMore();
  try {
    const r = await api(`/api/comments?code=${encodeURIComponent(cm.code)}&after=${encodeURIComponent(cm.after)}`);
    if (S.cm !== cm) return;
    addComments(r.comments);
    cm.after = r.after;
  } catch (e) {
    if (S.cm !== cm) return;
    cm.failed = e.message;
  }
  cm.loading = false;
  syncMore();
  // a short page that doesn't reach the bottom of the panel: keep going
  const more = $("#cmtMore");
  if (!cm.failed && cm.after && more && !more.closest("[hidden]") &&
      more.getBoundingClientRect().top < $("#infoScroll").getBoundingClientRect().bottom + 400) moreComments();
}

function tileHTML(m, withCap = false) {
  const b = m.product === "clips" ? "reel" : m.type === "carousel" ? "carousel" : m.type === "video" ? "video" : "";
  return `<button class="tile" data-code="${esc(m.code)}" style="background-image:${cssUrl(m.thumb)}" title="${esc((m.caption || "").slice(0, 140))}">
    ${b ? `<span class="badge">${icon(b)}</span>` : ""}${withCap && m.caption ? `<span class="hover-cap">${esc(m.caption)}</span>` : ""}</button>`;
}

function teardownItem() {
  S.item++;
  if (S.player) { S.player.destroy(); S.player = null; }
  S.zoom = null;
  $("#zoomPill").hidden = true;
}

function showItem(i, first = false) {
  const p = S.post;
  if (!p || i < 0 || i >= p.items.length) return;
  if (!first && i === S.index && $("#frame").firstChild) return;
  teardownItem();
  S.index = i;
  const it = p.items[i];
  const frame = $("#frame");
  frame.className = "frame";
  frame.innerHTML = "";
  frame.style.backgroundImage = cssUrl(it.thumb);          // shown until the full-size file arrives
  const amb = $("#ambient");
  amb.classList.remove("on");
  amb.style.backgroundImage = cssUrl(it.thumb);
  requestAnimationFrame(() => amb.classList.add("on"));
  fitFrame();
  if (it.kind === "video") S.player = mountVideo(frame, it, i);
  else mountImage(frame, it);
  renderTags();
  const n = p.items.length;
  $("#counter").textContent = n > 1 ? `${i + 1} / ${n}` : "";
  $("#navPrev").disabled = i === 0;
  $("#navNext").disabled = i === n - 1;
  for (const f of $$(".film")) f.classList.toggle("active", +f.dataset.i === i);
  $(`.film[data-i="${i}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: first ? "auto" : "smooth" });
  for (const j of [i - 1, i + 1]) if (p.items[j]?.kind === "image") new Image().src = p.items[j].image;
  if (!first) history.replaceState(null, "", routeFor());
}

function fitFrame() {
  const p = S.post;
  if (!p) return;
  const it = p.items[S.index], area = $("#frameArea");
  const W = area.clientWidth, H = area.clientHeight;
  const ar = (it.w && it.h) ? it.w / it.h : 1;
  let w = Math.min(W, H * ar), h = w / ar;
  if (h > H) { h = H; w = h * ar; }
  const f = $("#frame");
  f.style.width = Math.round(w) + "px";
  f.style.height = Math.round(h) + "px";
  if (S.zoom) S.zoom.reset();
}

function renderTags() {
  $(".tags")?.remove();
  const it = S.post.items[S.index];
  const placed = it.kind === "image" ? it.tags.filter(t => t.x || t.y) : [];
  $("#btnTags").hidden = !placed.length;
  $("#tagCount").textContent = placed.length;
  $("#btnTags").classList.toggle("on", S.tagsOn);
  if (!placed.length || !S.tagsOn) return;
  const box = document.createElement("div");
  box.className = "tags";
  const stack = {};          // tags on the same spot (often all at 0.5, 0.5) go under each other
  box.innerHTML = placed.map(t => {
    const spot = `${t.x.toFixed(2)},${t.y.toFixed(2)}`, n = stack[spot] = (stack[spot] ?? -1) + 1;
    return `<span class="tag" data-user="${esc(t.username)}" style="left:${(t.x * 100).toFixed(2)}%;top:calc(${(t.y * 100).toFixed(2)}% + ${n * 30}px)">${esc(t.username)}</span>`;
  }).join("");
  $("#frame").append(box);
}

// ------------------------------------------------------------------ image + zoom
function mountImage(frame, it) {
  const img = new Image();
  img.alt = it.alt || "";
  img.draggable = false;
  img.className = "fade-in";
  img.decoding = "async";
  img.src = it.image;
  img.onerror = () => { if (img.src !== it.thumb && it.thumb) img.src = it.thumb; };
  frame.append(img);
  S.zoom = zoomer(frame, img);
}

function zoomer(frame, img) {
  let s = 1, tx = 0, ty = 0, drag = null, moved = false;
  const pill = $("#zoomPill");
  const W = () => frame.clientWidth, H = () => frame.clientHeight;
  const maxS = () => Math.max(4, (img.naturalWidth || W()) / W() * 3);
  function apply() {
    tx = Math.min(0, Math.max(W() - W() * s, tx));
    ty = Math.min(0, Math.max(H() - H() * s, ty));
    img.style.transform = s === 1 ? "" : `translate(${tx}px, ${ty}px) scale(${s})`;
    frame.classList.toggle("zoomed", s > 1);
    pill.hidden = s === 1;
    pill.textContent = Math.round(s * W() / (img.naturalWidth || W()) * 100) + "%";
  }
  function zoomAt(ns, px, py) {
    ns = Math.min(maxS(), Math.max(1, ns));
    const cx = (px - tx) / s, cy = (py - ty) / s;
    s = ns; tx = px - cx * s; ty = py - cy * s;
    apply();
  }
  const local = e => { const r = frame.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  frame.addEventListener("wheel", e => {
    if (S.zoom?.img !== img) return;
    e.preventDefault();
    const [x, y] = local(e);
    zoomAt(s * Math.pow(1.0018, -e.deltaY), x, y);
  }, { passive: false });
  frame.addEventListener("dblclick", e => {
    if (S.zoom?.img !== img || e.target.closest(".tag")) return;
    const [x, y] = local(e);
    if (s > 1) { s = 1; tx = ty = 0; apply(); }
    else zoomAt(Math.max(2, (img.naturalWidth || W()) / W()), x, y);
  });
  frame.addEventListener("pointerdown", e => {
    if (s === 1 || e.button !== 0 || S.zoom?.img !== img) return;
    drag = { x: e.clientX - tx, y: e.clientY - ty }; moved = false;
    frame.setPointerCapture(e.pointerId);
    frame.classList.add("dragging");
  });
  frame.addEventListener("pointermove", e => {
    if (!drag) return;
    tx = e.clientX - drag.x; ty = e.clientY - drag.y; moved = true;
    apply();
  });
  const end = () => { drag = null; frame.classList.remove("dragging"); };
  frame.addEventListener("pointerup", end);
  frame.addEventListener("pointercancel", end);
  return {
    img,
    reset() { s = 1; tx = ty = 0; apply(); },
    step(f) { zoomAt(s * f, W() / 2, H() / 2); },
    actual() { zoomAt((img.naturalWidth || W()) / W(), W() / 2, H() / 2); },
    get zoomed() { return s > 1; },
  };
}

// ------------------------------------------------------------------ video player
function mountVideo(frame, it, i) {
  const token = S.item, code = S.post.code;
  frame.classList.add("paused");
  frame.insertAdjacentHTML("beforeend", `
    <video playsinline preload="auto"></video>
    <div class="big-play">${icon("play")}</div>
    <div class="vbar">
      <div class="seek"><div class="seek-track"><div class="seek-buf"></div><div class="seek-fill"></div><div class="seek-knob"></div></div><div class="seek-tip"></div></div>
      <div class="vrow">
        <button class="vbtn fill" data-a="play" title="Play (Space)">${icon("play")}</button>
        <div class="vol-wrap"><button class="vbtn" data-a="mute" title="Mute (M)">${icon("volume")}</button><div class="vol"><input type="range" min="0" max="1" step="0.01" title="Volume"></div></div>
        <span class="vtime">0:00 / 0:00</span>
        <span class="vgrow"></span>
        <button class="vbtn" data-a="loop" title="Loop">${icon("loop")}</button>
        <button class="vbtn" data-a="hd" hidden><span class="vhd">HD</span></button>
        <button class="vbtn" data-a="fs" title="Full screen (F)">${icon("fullscreen")}</button>
      </div>
    </div>`);
  const v = $("video", frame), bar = $(".vbar", frame);
  const btn = a => $(`[data-a="${a}"]`, frame);
  const fill = $(".seek-fill", frame), buf = $(".seek-buf", frame), knob = $(".seek-knob", frame), tip = $(".seek-tip", frame), seek = $(".seek", frame);
  const volIn = $(".vol input", frame);
  v.poster = it.image;
  v.loop = store.get("loop", true);
  v.volume = store.get("vol", 1);
  v.muted = store.get("muted", false);
  volIn.value = v.muted ? 0 : v.volume;
  v.src = it.video;
  let hd = "off", idle = null;

  const sync = () => {
    frame.classList.toggle("paused", v.paused);
    btn("play").innerHTML = icon(v.paused ? "play" : "pause");
    btn("play").title = v.paused ? "Play (Space)" : "Pause (Space)";
  };
  const syncVol = () => {
    btn("mute").innerHTML = icon(v.muted || v.volume === 0 ? "mute" : "volume");
    volIn.value = v.muted ? 0 : v.volume;
  };
  const syncTime = () => {
    const d = v.duration || 0, t = v.currentTime || 0;
    const pct = d ? t / d * 100 : 0;
    fill.style.width = pct + "%";
    knob.style.left = pct + "%";
    $(".vtime", frame).textContent = `${clock(t)} / ${clock(d)}`;
    if (v.buffered.length && d) buf.style.width = v.buffered.end(v.buffered.length - 1) / d * 100 + "%";
  };
  const poke = () => {
    frame.classList.add("show-ui");
    frame.classList.remove("hide-cursor");
    clearTimeout(idle);
    idle = setTimeout(() => {
      if (!v.paused && !bar.matches(":hover")) { frame.classList.remove("show-ui"); frame.classList.add("hide-cursor"); }
    }, 2200);
  };
  const toggle = () => v.paused ? v.play().catch(() => {}) : v.pause();

  v.addEventListener("play", sync);
  v.addEventListener("pause", sync);
  v.addEventListener("timeupdate", syncTime);
  v.addEventListener("progress", syncTime);
  v.addEventListener("durationchange", syncTime);
  v.addEventListener("volumechange", () => { syncVol(); store.set("vol", v.volume); store.set("muted", v.muted); });
  v.addEventListener("click", () => { toggle(); poke(); });
  v.addEventListener("dblclick", () => fullscreen());
  frame.addEventListener("mousemove", poke);
  v.addEventListener("loadedmetadata", () => {
    if (hd !== "off" || !it.hd_height || !S.info.ffmpeg || it.hd_height <= v.videoHeight + 8) return;
    const b = btn("hd");
    b.hidden = false;
    b.title = `${it.hd_p}p available (H)`;
    hd = "sd";
    if (store.get("hd", true)) upgrade(false);
  });

  btn("play").onclick = toggle;
  btn("mute").onclick = () => { if (v.muted || v.volume === 0) { v.muted = false; if (!v.volume) v.volume = 1; } else v.muted = true; };
  volIn.oninput = () => { v.volume = +volIn.value; v.muted = +volIn.value === 0; };
  btn("loop").classList.toggle("on", v.loop);
  btn("loop").onclick = () => { v.loop = !v.loop; store.set("loop", v.loop); btn("loop").classList.toggle("on", v.loop); };
  btn("fs").onclick = () => fullscreen();
  btn("hd").onclick = () => {
    if (hd === "hd") { store.set("hd", false); swap(it.video, "sd"); }
    else if (hd === "sd") { store.set("hd", true); upgrade(true); }
  };

  let seeking = false;
  const seekTo = e => {
    const r = seek.getBoundingClientRect(), x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    if (v.duration) v.currentTime = x * v.duration;
    syncTime();
  };
  seek.addEventListener("pointerdown", e => { seeking = true; seek.setPointerCapture(e.pointerId); seekTo(e); });
  seek.addEventListener("pointermove", e => {
    const r = seek.getBoundingClientRect(), x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    tip.style.left = x * 100 + "%";
    tip.textContent = clock(x * (v.duration || 0));
    if (seeking) seekTo(e);
  });
  seek.addEventListener("pointerup", () => { seeking = false; });

  async function upgrade(explicit) {
    const b = btn("hd");
    hd = "wait";
    b.classList.add("hd-wait");
    b.title = `Loading ${it.hd_p}p…`;
    while (token === S.item) {
      let st;
      try { st = (await api(`/api/hd?code=${encodeURIComponent(code)}&i=${i}`)).state; } catch { st = "failed"; }
      if (token !== S.item) return;
      if (st === "ready") return swap(`/hd/${encodeURIComponent(code)}_${i}.mp4`, "hd");
      if (st !== "building") {
        hd = "sd"; b.classList.remove("hd-wait");
        if (st === "none") b.hidden = true;
        if (explicit) toast({ err: true, icon: "alert", text: "HD isn't available for this video" });
        return;
      }
      await sleep(900);
    }
  }
  function swap(src, mode) {
    const t = v.currentTime, playing = !v.paused && !v.ended;
    let freeze = null;
    if (v.videoWidth && t > 0) {
      freeze = document.createElement("canvas");
      freeze.width = v.videoWidth; freeze.height = v.videoHeight;
      freeze.className = "vfreeze";
      try { freeze.getContext("2d").drawImage(v, 0, 0); v.after(freeze); } catch { freeze = null; }
    }
    const done = () => { freeze?.remove(); freeze = null; };
    v.addEventListener("loadedmetadata", () => { if (t) v.currentTime = t; else done(); if (playing) v.play().catch(() => {}); }, { once: true });
    v.addEventListener("seeked", done, { once: true });
    setTimeout(done, 5000);
    v.src = src;
    hd = mode;
    const b = btn("hd");
    b.classList.remove("hd-wait");
    b.classList.toggle("hd-on", mode === "hd");
    b.title = mode === "hd" ? `Playing ${it.hd_p}p, click for the standard version (H)` : `${it.hd_p}p available (H)`;
  }

  syncVol(); syncTime();
  v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
  poke();
  return {
    v,
    toggle,
    mute() { btn("mute").click(); },
    seekBy(d) { if (v.duration) v.currentTime = Math.min(v.duration, Math.max(0, v.currentTime + d)); poke(); },
    hd() { btn("hd").hidden || btn("hd").click(); },
    destroy() { clearTimeout(idle); v.pause(); v.removeAttribute("src"); v.load(); },
  };
}

function fullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else $("#stage").requestFullscreen().catch(() => {});
}

// ------------------------------------------------------------------ profile view
function renderProfile() {
  const u = S.profile;
  showView("profile");
  const sub = [`@${esc(u.username)}`];
  if (u.pronouns?.length) sub.push(esc(u.pronouns.join("/")));
  if (u.category) sub.push(esc(u.category));
  const stats = [];
  if (u.posts_count != null) stats.push(`<div><b>${compact(u.posts_count)}</b><span>posts</span></div>`);
  if (u.followers != null) stats.push(`<div title="${num(u.followers)}"><b>${compact(u.followers)}</b><span>followers</span></div>`);
  if (u.following != null) stats.push(`<div title="${num(u.following)}"><b>${compact(u.following)}</b><span>following</span></div>`);
  const grid = u.private ? `<div class="private-box">${icon("lock")}<div>This account is private. Only approved followers can see its posts.</div></div>`
    : u.posts.length ? `<div class="prof-grid">${u.posts.map(m => tileHTML(m, true)).join("")}</div>`
      : `<div class="private-box">${icon("image")}<div>No posts to show.</div></div>`;
  $("#viewProfile").innerHTML = `
    <div class="prof">
      <div class="prof-head">
        <div class="prof-av" style="background-image:${cssUrl(u.avatar)}"></div>
        <div>
          <div class="prof-name"><h1>${esc(u.name || u.username)}</h1>${u.verified ? VERIFIED : ""}${u.private ? `<span class="chip plain" style="cursor:default">${icon("lock")}Private</span>` : ""}</div>
          <div class="prof-handle">${sub.join(" · ")}</div>
          ${stats.length ? `<div class="prof-stats">${stats.join("")}</div>` : ""}
          ${u.bio ? `<div class="prof-bio" dir="auto">${linkify(u.bio)}</div>` : ""}
          ${u.links.length ? `<div class="prof-links">${u.links.map(l => `<button class="chip plain" data-ext="${esc(l.url)}" title="${esc(l.url)}">${icon("globe")}${esc(l.title)}</button>`).join("")}</div>` : ""}
          <div class="prof-actions">
            <button class="btn" data-ext="${esc(u.url)}">${icon("external")}Open on Instagram</button>
            <button class="btn ghost" data-copy="${esc(u.url)}">${icon("copy")}Copy link</button>
          </div>
        </div>
      </div>
      ${u.private ? "" : `<div class="prof-bar"><h2>Latest posts</h2><small>Instagram shows signed-out visitors the newest ${u.posts.length || 12}</small></div>`}
      ${grid}
    </div>`;
  $("#viewProfile").scrollTop = 0;
  $("#url").value = u.url;
  document.title = `${u.name || u.username} (@${u.username}) — Insta Viewer`;
}

// ------------------------------------------------------------------ history sidebar
async function loadHistory() {
  try { S.history = await api("/api/history"); } catch { return; }
  renderHistory();
  if (S.view === "empty") renderEmptyRecent();
}
function histQuery(e) { return e.kind === "post" ? postLink(e.code) : userLink(e.username); }
function currentKey() {
  if (S.view === "post" && S.post) return "p:" + S.post.code;
  if (S.view === "profile" && S.profile) return "u:" + S.profile.username.toLowerCase();
  return null;
}
function renderHistory() {
  const f = $("#histFilter").value.trim().toLowerCase();
  const items = S.history.filter(e => !f || `${e.title} ${e.sub} ${e.code || ""}`.toLowerCase().includes(f));
  const list = $("#histList");
  if (!items.length) {
    list.innerHTML = `<div class="hist-empty">${S.history.length ? "No matches." : "Links you open show up here."}</div>`;
    return;
  }
  const day = 86400000, today = new Date().setHours(0, 0, 0, 0);
  const group = t => t * 1000 >= today ? "Today" : t * 1000 >= today - day ? "Yesterday" : t * 1000 >= today - 6 * day ? "This week" : "Older";
  let last = null, html = "";
  for (const e of items) {
    const g = group(e.t);
    if (g !== last) { html += `<div class="hist-group">${g}</div>`; last = g; }
    const badge = e.kind === "profile" ? "" : e.product === "clips" ? "reel" : e.type === "carousel" ? "carousel" : e.type === "video" ? "video" : "";
    html += `<div class="hist-item" data-key="${esc(e.key)}" title="${esc(e.sub)}">
      <div class="hist-thumb ${e.kind === "profile" ? "round" : ""}" style="background-image:url('/thumb/${esc(e.thumb)}')">${badge ? `<span class="badge">${icon(badge)}</span>` : ""}</div>
      <div class="hist-text">
        <div class="hist-title">${e.kind === "profile" ? "@" : ""}${esc(e.title)}${e.verified ? VERIFIED : ""}</div>
        <div class="hist-sub">${esc(e.sub || (e.kind === "post" ? "No caption" : ""))}</div>
      </div>
      <button class="hist-x" data-remove="${esc(e.key)}" title="Remove from history">${icon("x")}</button>
    </div>`;
  }
  list.innerHTML = html;
  markActive();
}
function markActive() {
  const k = currentKey();
  for (const n of $$(".hist-item")) n.classList.toggle("active", n.dataset.key === k);
}
function renderEmptyRecent() {
  const box = $("#emptyRecent");
  const items = S.history.slice(0, 12);
  box.innerHTML = items.length ? `<h3>Recently viewed</h3><div class="empty-recent-row">${items.map(e =>
    `<button data-key="${esc(e.key)}" title="${esc(e.title + (e.sub ? " · " + e.sub : ""))}" style="background-image:url('/thumb/${esc(e.thumb)}');${e.kind === "profile" ? "border-radius:50%" : ""}"></button>`).join("")}</div>` : "";
}
function openKey(k) {
  const e = S.history.find(x => x.key === k);
  if (e) open(histQuery(e));
}
async function removeKey(k) {
  await api("/api/history/remove", { key: k });
  loadHistory();
}

// ------------------------------------------------------------------ saving
async function save(which) {
  const p = S.post;
  if (!p) return;
  const n = which === "all" ? p.items.length : 1;
  const t = toast({ icon: "download", text: n > 1 ? `Saving ${n} files…` : "Saving…", ms: 0 });
  try {
    const r = await api("/api/save", { code: p.code, which: which === "all" ? "all" : String(S.index) });
    t.close();
    const name = r.files[0].split(/[\\/]/).pop();
    toast({
      icon: "check", text: r.files.length > 1 ? `Saved ${r.files.length} files` : "Saved",
      sub: r.files.length > 1 ? r.folder : name, ms: 6000,
      action: { label: "Show in folder", fn: () => api("/api/reveal", { path: r.files[0] }) },
    });
  } catch (e) {
    t.close();
    toast({ err: true, icon: "alert", text: "Couldn't save", sub: e.message, ms: 7000 });
  }
}

// ------------------------------------------------------------------ menus & toasts
function menu(x, y, items) {
  const m = $("#ctx");
  m.innerHTML = items.map((it, i) => it === "-" ? "<hr>" :
    `<button data-i="${i}" ${it.disabled ? "disabled" : ""}>${icon(it.icon || "")}${esc(it.label)}${it.key ? `<kbd>${it.key}</kbd>` : ""}</button>`).join("");
  m.hidden = false;
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, innerWidth - r.width - 8) + "px";
  m.style.top = (y + r.height > innerHeight - 8 ? Math.max(8, y - r.height) : y) + "px";
  m.onclick = e => {
    const b = e.target.closest("button[data-i]");
    if (!b) return;
    closeMenu();
    items[+b.dataset.i].fn();
  };
}
const closeMenu = () => { $("#ctx").hidden = true; };

// ------------------------------------------------------------------ Discord
const dcService = () => {
  const s = store.get("dcService", "auto");
  return s === "custom" ? (store.get("dcCustom", "") || "auto") : s;
};

async function copyForDiscord() {
  if (!S.post) return;
  if (store.get("dcMode", "link") === "file") return copyDiscordFile();
  return copyDiscordLink();
}

async function copyDiscordLink() {
  const p = S.post, i = S.index, auto = dcService() === "auto";
  const t = toast({ icon: "send", text: auto ? "Finding an embed site that works…" : "Copying…", ms: 0 });
  try {
    const r = await api(`/api/discord/link?copy=1&code=${encodeURIComponent(p.code)}&i=${i}&service=${encodeURIComponent(dcService())}`);
    S.clipSeen = r.url;
    t.close();
    if (r.warning) toast({ err: true, icon: "alert", text: "Discord link copied, but it may not play", sub: r.warning, ms: 8000,
      action: { label: "Copy the file instead", fn: copyDiscordFile } });
    else toast({ icon: "check", text: "Discord link copied. Paste it into a chat.", sub: r.url, ms: 4500 });
  } catch (e) {
    t.close();
    toast({ err: true, icon: "alert", text: "Couldn't make a Discord link", sub: e.message, ms: 7000 });
  }
}

async function copyDiscordFile() {
  const p = S.post, it = p.items[S.index];
  const t = toast({ icon: "download", text: it.kind === "video" ? "Getting the video ready for Discord…" : "Getting the image ready…", ms: 0 });
  try {
    const r = await api("/api/discord/file", { code: p.code, i: S.index });
    t.close();
    const mb = (r.size / 1e6).toFixed(1), what = it.kind === "video" ? "Video" : "Image";
    if (r.size > r.limit) toast({ err: true, icon: "alert", text: `${what} copied, but it's ${mb} MB`, ms: 10000,
      sub: "Over Discord's 10 MB limit without Nitro.", action: { label: "Copy embed link", fn: copyDiscordLink } });
    else toast({ icon: "check", text: `${what} copied (${mb} MB${it.kind === "video" ? ", " + r.quality : ""}). Paste it into Discord.`,
      sub: r.path.split(/[\\/]/).pop(), ms: 5000 });
  } catch (e) {
    t.close();
    toast({ err: true, icon: "alert", text: "Couldn't copy the file", sub: e.message, ms: 7000 });
  }
}

// ------------------------------------------------------------------ settings dialog
function openSettings() {
  closeMenu();
  const services = (S.info.embed_services || []);
  const sel = $("#dcService");
  sel.innerHTML = `<option value="auto">Automatic (first one that works)</option>` +
    services.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join("") + `<option value="custom">Other site…</option>`;
  sel.value = store.get("dcService", "auto");
  if (![...sel.options].some(o => o.value === sel.value)) sel.value = "auto";
  $("#dcCustom").value = store.get("dcCustom", "");
  for (const r of $$('input[name="dcMode"]')) r.checked = r.value === store.get("dcMode", "link");
  $("#optHD").checked = store.get("hd", true);
  $("#optHD").disabled = !S.info.ffmpeg;
  $("#themeSeg").innerHTML = Object.entries(THEMES).map(([k, [ic, label]]) =>
    `<button class="${store.get("theme", "dark") === k ? "on" : ""}" data-theme-pick="${k}">${icon(ic)}${label}</button>`).join("");
  $("#dcTestOut").innerHTML = "";
  syncSettings();
  $("#settings").hidden = false;
}
function syncSettings() {
  const link = store.get("dcMode", "link") === "link";
  $("#dcServiceRow").classList.toggle("dim", !link);
  $("#dcCustom").hidden = $("#dcService").value !== "custom";
}
const closeSettings = () => { $("#settings").hidden = true; };

async function testService() {
  const out = $("#dcTestOut"), svc = dcService();
  const code = S.post?.code || "DehZj9wggt0", i = S.post ? S.index : 0;
  const what = S.post ? "this post" : "a sample reel";
  out.innerHTML = `<div class="spinner small"></div>`;
  try {
    const r = svc === "auto"
      ? await api(`/api/discord/link?code=${encodeURIComponent(code)}&i=${i}&service=auto`)
      : await api(`/api/discord/test?code=${encodeURIComponent(code)}&i=${i}&service=${encodeURIComponent(svc)}`);
    const ok = r.kind === "video" || (r.kind === "image" && S.post && S.post.items[i].kind === "image");
    out.innerHTML = r.kind
      ? `<span class="${ok ? "ok" : "warn"}">${icon(ok ? "check" : "alert")}${esc(r.service)} gives Discord ${r.kind === "video" ? "a playable video" : "a picture"} for ${what}${r.note ? ` (${esc(r.note)})` : ""}.</span>`
      : `<span class="bad">${icon("x")}${esc(r.service)} doesn't work right now${r.note ? ` (${esc(r.note)})` : ""}.</span>`;
  } catch (e) {
    out.innerHTML = `<span class="bad">${icon("x")}${esc(e.message)}</span>`;
  }
}

// ------------------------------------------------------------------ theme
const THEMES = { dark: ["moon", "Dark"], light: ["sun", "Light"], system: ["monitor", "Match Windows"] };
const lightQuery = matchMedia("(prefers-color-scheme: light)");
function applyTheme() {
  const pref = store.get("theme", "dark");
  const t = pref === "system" ? (lightQuery.matches ? "light" : "dark") : pref;
  document.documentElement.dataset.theme = t;
  $('meta[name="theme-color"]').content = t === "light" ? "#fbfbfc" : "#16171a";
  $("#btnTheme").innerHTML = icon(THEMES[pref][0]);
  $("#btnTheme").title = `Theme: ${THEMES[pref][1]}`;
}
function setTheme(pref) {
  store.set("theme", pref);
  applyTheme();
  api("/api/settings", { theme: pref }).catch(() => {});   // the launcher picks the window frame from it
}

function stageMenu(x, y) {
  const p = S.post, it = p.items[S.index], multi = p.items.length > 1;
  const items = [
    { icon: "download", label: multi ? "Save this item" : "Save", key: "Ctrl+S", fn: () => save("one") },
  ];
  if (multi) items.push({ icon: "download", label: `Save all ${p.items.length}`, key: "Ctrl+Shift+S", fn: () => save("all") });
  items.push("-");
  if (it.kind === "image") items.push({ icon: "image", label: "Copy image", fn: () => copyImage(it.image) });
  items.push({ icon: "send", label: "Copy for Discord", key: "Ctrl+Shift+D", fn: copyForDiscord });
  items.push({ icon: "link", label: "Copy link", key: "Ctrl+Shift+C", fn: () => copyText(p.url + (multi ? `?img_index=${S.index + 1}` : "")) });
  items.push({ icon: "copy", label: it.kind === "video" ? "Copy video address" : "Copy image address", fn: () => copyText(it.kind === "video" ? it.video : it.image, "Address") });
  if (p.caption) items.push({ icon: "copy", label: "Copy caption", fn: () => copyText(p.caption, "Caption") });
  items.push("-");
  items.push({ icon: "external", label: "Open on Instagram", fn: () => external(p.url) });
  if (it.kind === "image") items.push({ icon: "zoom", label: S.zoom?.zoomed ? "Fit to window" : "Actual size", key: "0", fn: () => S.zoom?.zoomed ? S.zoom.reset() : S.zoom?.actual() });
  items.push({ icon: "fullscreen", label: document.fullscreenElement ? "Exit full screen" : "Full screen", key: "F", fn: fullscreen });
  menu(x, y, items);
}

function toast({ icon: ic = "check", text, sub, action, err, ms = 3200 }) {
  const t = document.createElement("div");
  t.className = "toast" + (err ? " err" : "");
  t.innerHTML = `${icon(ic)}<div class="toast-text">${esc(text)}${sub ? `<small title="${esc(sub)}">${esc(sub)}</small>` : ""}</div>${action ? `<button class="btn">${esc(action.label)}</button>` : ""}`;
  const close = () => { if (!t.isConnected) return; t.classList.add("out"); setTimeout(() => t.remove(), 200); };
  if (action) $(".btn", t).onclick = () => { action.fn(); close(); };
  $("#toasts").append(t);
  if (ms) setTimeout(close, ms);
  return { close };
}

// ------------------------------------------------------------------ clipboard watcher
const linkShort = t => {
  const m = t.match(/instagram\.com\/(?:[\w.]+\/)?(p|reels?|tv)\/([\w-]+)/i);
  if (m) return `${m[1].toLowerCase().startsWith("reel") ? "reel" : m[1].toLowerCase()}/${m[2]}`;
  const u = t.match(/instagram\.com\/([\w.]+)/i);
  return u ? "@" + u[1] : t.slice(0, 40);
};
const codeOf = t => (t.match(/\/(?:p|reels?|tv)\/([\w-]+)/i) || [])[1];
let clipBusy = false;
async function checkClipboard() {
  if (clipBusy || !document.hasFocus() || document.hidden) return;
  let r;
  clipBusy = true;
  try { r = await api("/api/clipboard"); } catch { return; } finally { clipBusy = false; }
  const t = (r.text || "").trim();
  const cur = S.post ? S.post.code : null;
  if (!t || t === S.clipSeen || (cur && codeOf(t) === cur) ||
      (S.profile && r.kind === "profile" && linkShort(t).toLowerCase() === "@" + S.profile.username.toLowerCase())) return hideClip();
  $("#clipSub").textContent = linkShort(t);
  $("#clipChip").dataset.text = t;
  $("#clipChip").hidden = false;
}
function hideClip() { $("#clipChip").hidden = true; }

// ------------------------------------------------------------------ nav buttons
function updateNav() {
  const nav = window.navigation;
  $("#btnBack").disabled = nav ? !nav.canGoBack : false;
  $("#btnFwd").disabled = nav ? !nav.canGoForward : false;
}

// ------------------------------------------------------------------ wiring
function wire() {
  hydrateIcons();
  applyTheme();
  lightQuery.addEventListener("change", applyTheme);
  $("#btnSettings").onclick = openSettings;
  $("#setClose").onclick = closeSettings;
  $("#settings").addEventListener("mousedown", e => { if (e.target.id === "settings") closeSettings(); });
  $("#settings").addEventListener("change", e => {
    const t = e.target;
    if (t.name === "dcMode") store.set("dcMode", t.value);
    if (t.id === "dcService") { store.set("dcService", t.value); $("#dcTestOut").innerHTML = ""; if (t.value === "custom") setTimeout(() => $("#dcCustom").focus()); }
    if (t.id === "dcCustom") store.set("dcCustom", t.value.trim());
    if (t.id === "optHD") store.set("hd", t.checked);
    syncSettings();
  });
  $("#dcCustom").addEventListener("input", e => store.set("dcCustom", e.target.value.trim()));
  $("#dcTest").onclick = testService;
  $("#themeSeg").addEventListener("click", e => {
    const b = e.target.closest("[data-theme-pick]");
    if (!b) return;
    setTheme(b.dataset.themePick);
    for (const x of $$("#themeSeg button")) x.classList.toggle("on", x === b);
  });
  $("#btnDiscord").onclick = copyForDiscord;
  $("#btnTheme").onclick = e => {
    const r = e.currentTarget.getBoundingClientRect(), cur = store.get("theme", "dark");
    menu(r.right - 200, r.bottom + 6, Object.entries(THEMES).map(([k, [, label]]) =>
      ({ icon: k === cur ? "check" : "", label, fn: () => setTheme(k) })));
    e.stopPropagation();
  };
  const app = $("#app");
  app.classList.toggle("no-side", !store.get("sidebar", true));
  if (store.get("infoW", null)) document.documentElement.style.setProperty("--info-w", store.get("infoW") + "px");

  $("#urlForm").addEventListener("submit", e => { e.preventDefault(); open($("#url").value); });
  $("#url").addEventListener("focus", () => $("#url").select());
  $("#btnSidebar").onclick = () => { const on = app.classList.toggle("no-side"); store.set("sidebar", !on); setTimeout(fitFrame, 200); };
  $("#btnBack").onclick = () => history.back();
  $("#btnFwd").onclick = () => history.forward();
  $("#btnReload").onclick = reload;
  $("#histFilter").addEventListener("input", renderHistory);
  $("#btnDownloads").onclick = () => api("/api/reveal", {});
  $("#btnClear").onclick = async () => {
    if (!S.history.length) return;
    const old = S.history.length;
    await api("/api/history/clear", {});
    loadHistory();
    toast({ icon: "trash", text: `Cleared ${plural(old, "entry", "entries")}` });
  };
  $("#clipChip").onclick = e => {
    if (e.target.closest("#clipX")) { S.clipSeen = $("#clipChip").dataset.text; hideClip(); return; }
    open($("#clipChip").dataset.text);
  };

  $("#navPrev").onclick = () => showItem(S.index - 1);
  $("#navNext").onclick = () => showItem(S.index + 1);
  $("#filmstrip").onclick = e => { const f = e.target.closest(".film"); if (f) showItem(+f.dataset.i); };
  $("#btnTags").onclick = () => { S.tagsOn = !S.tagsOn; store.set("tags", S.tagsOn); renderTags(); };
  $("#btnSave").onclick = () => save("one");
  $("#btnSaveMenu").onclick = e => {
    const r = e.currentTarget.getBoundingClientRect();
    menu(r.right - 230, r.top - 8 - 120, [
      { icon: "download", label: "Save this item", key: "Ctrl+S", fn: () => save("one") },
      { icon: "download", label: `Save all ${S.post.items.length}`, key: "Ctrl+Shift+S", fn: () => save("all") },
      "-",
      { icon: "folder", label: "Open saved files folder", fn: () => api("/api/reveal", {}) },
    ]);
    e.stopPropagation();        // or the document click handler closes the menu straight away
  };
  $("#btnCopyLink").onclick = () => S.post && copyText(S.post.url);
  $("#btnExternal").onclick = () => S.post && external(S.post.url);

  $("#stage").addEventListener("contextmenu", e => {
    if (!S.post || e.target.closest(".vbar")) return;
    e.preventDefault();
    stageMenu(e.clientX, e.clientY);
  });
  new ResizeObserver(() => fitFrame()).observe($("#frameArea"));

  // global clicks: @users, external links, posts, history
  document.addEventListener("click", e => {
    if (!e.target.closest("#ctx")) closeMenu();
    const t = e.target;
    const tab = t.closest("[data-tab]");
    if (tab) return showTab(tab.dataset.tab);
    const act = t.closest("[data-act]");
    if (act?.dataset.act === "more-comments") return moreComments(true);
    if (act?.dataset.act === "comments") {
      showTab("comments");
      return $("#infoTabs").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    const cov = t.closest(".cmt-text.covered");
    if (cov) return cov.classList.remove("covered");
    const rm = t.closest("[data-remove]");
    if (rm) { e.stopPropagation(); return removeKey(rm.dataset.remove); }
    const u = t.closest("[data-user]");
    if (u) { e.preventDefault(); return open(userLink(u.dataset.user)); }
    const x = t.closest("[data-ext]");
    if (x) { e.preventDefault(); return external(x.dataset.ext); }
    const c = t.closest("[data-copy]");
    if (c) return copyText(c.dataset.copy);
    const p = t.closest("[data-code]");
    if (p) return open(postLink(p.dataset.code));
    const k = t.closest("[data-key]");
    if (k && !t.closest("#ctx")) return openKey(k.dataset.key);
  });
  document.addEventListener("auxclick", e => {            // middle click: open on Instagram
    if (e.button !== 1) return;
    const p = e.target.closest("[data-code]"), u = e.target.closest("[data-user]");
    if (p) external(postLink(p.dataset.code));
    else if (u) external(userLink(u.dataset.user));
  });
  document.addEventListener("contextmenu", e => {
    if (e.defaultPrevented || e.target.closest("input, .caption, .cmt-text, .prof-bio, .error-card p")) return;
    const p = e.target.closest("[data-code]"), h = e.target.closest(".hist-item, .empty-recent-row button"), u = e.target.closest("[data-user]");
    e.preventDefault();
    if (p) {
      const url = postLink(p.dataset.code);
      menu(e.clientX, e.clientY, [
        { icon: "image", label: "Open", fn: () => open(url) },
        { icon: "external", label: "Open on Instagram", fn: () => external(url) },
        { icon: "link", label: "Copy link", fn: () => copyText(url) },
      ]);
    } else if (h) {
      const entry = S.history.find(x => x.key === h.dataset.key);
      if (!entry) return;
      const url = histQuery(entry);
      menu(e.clientX, e.clientY, [
        { icon: "image", label: "Open", fn: () => open(url) },
        { icon: "external", label: "Open on Instagram", fn: () => external(url) },
        { icon: "link", label: "Copy link", fn: () => copyText(url) },
        "-",
        { icon: "trash", label: "Remove from history", fn: () => removeKey(entry.key) },
      ]);
    } else if (u) {
      const url = userLink(u.dataset.user);
      menu(e.clientX, e.clientY, [
        { icon: "user", label: `View @${u.dataset.user}`, fn: () => open(url) },
        { icon: "external", label: "Open on Instagram", fn: () => external(url) },
        { icon: "link", label: "Copy link", fn: () => copyText(url) },
      ]);
    } else closeMenu();
  });

  // paste / drop anywhere
  document.addEventListener("paste", e => {
    if (e.target instanceof Element && e.target.closest("input, textarea")) return;
    const t = e.clipboardData.getData("text");
    if (t) { e.preventDefault(); open(t); }
  });
  let dragDepth = 0;
  const hasText = e => [...(e.dataTransfer?.types || [])].some(t => t === "text/uri-list" || t === "text/plain");
  document.addEventListener("dragenter", e => { if (hasText(e)) { dragDepth++; $("#dropHint").hidden = false; } });
  document.addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; $("#dropHint").hidden = true; } });
  document.addEventListener("dragover", e => { if (hasText(e)) e.preventDefault(); });
  document.addEventListener("drop", e => {
    e.preventDefault();
    dragDepth = 0;
    $("#dropHint").hidden = true;
    const t = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (t) open(t.split("\n")[0]);
  });

  // splitter
  const sp = $("#splitter");
  sp.addEventListener("pointerdown", e => {
    sp.setPointerCapture(e.pointerId);
    sp.classList.add("drag");
    const move = ev => {
      const w = Math.min(680, Math.max(320, innerWidth - ev.clientX));
      document.documentElement.style.setProperty("--info-w", w + "px");
    };
    const up = () => {
      sp.classList.remove("drag");
      sp.removeEventListener("pointermove", move);
      store.set("infoW", parseInt(getComputedStyle(document.documentElement).getPropertyValue("--info-w")));
    };
    sp.addEventListener("pointermove", move);
    sp.addEventListener("pointerup", up, { once: true });
  });
  sp.addEventListener("dblclick", () => { document.documentElement.style.removeProperty("--info-w"); store.set("infoW", null); });

  // keyboard
  document.addEventListener("keydown", e => {
    const inInput = e.target instanceof Element && e.target.closest("input, textarea");
    const k = e.key, ctrl = e.ctrlKey || e.metaKey;
    if (k === "Escape") {
      if (!$("#ctx").hidden) return closeMenu();
      if (!$("#settings").hidden) return closeSettings();
      if (inInput) return e.target.blur();
      if (S.zoom?.zoomed) return S.zoom.reset();
      return;
    }
    if (!$("#settings").hidden) return;           // the dialog keeps the keys
    if ((ctrl && k.toLowerCase() === "l") || k === "F6") { e.preventDefault(); $("#url").focus(); return; }
    if (ctrl && k.toLowerCase() === "b") { e.preventDefault(); $("#btnSidebar").click(); return; }
    if (k === "F5" || (ctrl && k.toLowerCase() === "r")) { e.preventDefault(); reload(); return; }
    if (ctrl && e.shiftKey && k.toLowerCase() === "c" && S.post) { e.preventDefault(); copyText(S.post.url); return; }
    if (ctrl && e.shiftKey && k.toLowerCase() === "d") { e.preventDefault(); copyForDiscord(); return; }
    if (ctrl && k === ",") { e.preventDefault(); openSettings(); return; }
    if (ctrl && k.toLowerCase() === "s") { e.preventDefault(); if (S.post) save(e.shiftKey ? "all" : "one"); return; }
    if (ctrl && k.toLowerCase() === "f") { e.preventDefault(); $("#histFilter").focus(); return; }
    if (inInput || ctrl || e.altKey || S.view !== "post") return;
    const pl = S.player, multi = S.post.items.length > 1;
    switch (k) {
      case "ArrowLeft": e.preventDefault(); if (multi && !e.shiftKey) showItem(S.index - 1); else pl?.seekBy(-5); break;
      case "ArrowRight": e.preventDefault(); if (multi && !e.shiftKey) showItem(S.index + 1); else pl?.seekBy(5); break;
      case "Home": showItem(0); break;
      case "End": showItem(S.post.items.length - 1); break;
      case " ": case "k": case "K": if (pl) { e.preventDefault(); pl.toggle(); } break;
      case "j": case "J": pl?.seekBy(-10); break;
      case "l": case "L": pl?.seekBy(10); break;
      case "m": case "M": pl?.mute(); break;
      case "h": case "H": pl?.hd(); break;
      case "f": case "F": fullscreen(); break;
      case "t": case "T": if (!$("#btnTags").hidden) $("#btnTags").click(); break;
      case "+": case "=": S.zoom?.step(1.25); break;
      case "-": S.zoom?.step(0.8); break;
      case "0": S.zoom?.zoomed ? S.zoom.reset() : S.zoom?.actual(); break;
    }
  });

  window.addEventListener("popstate", () => {
    updateNav();
    const q = queryFromHash(location.hash);
    if (q) open(q, { push: false });
    else { S.post = S.profile = null; showView("empty"); $("#url").value = ""; }
  });
  window.addEventListener("focus", checkClipboard);
  window.addEventListener("blur", closeMenu);
  window.addEventListener("resize", closeMenu);
  setInterval(checkClipboard, 2500);
  setInterval(() => fetch("/api/ping").catch(() => {}), 2000);
  window.addEventListener("pagehide", () => navigator.sendBeacon("/api/bye"));
  window.navigation?.addEventListener("currententrychange", updateNav);
}

async function start() {
  wire();
  api("/api/info").then(i => { S.info = i; }).catch(() => {});
  await loadHistory();
  const q = queryFromHash(location.hash);
  if (q) open(q, { push: false });
  else showView("empty");
  updateNav();
  checkClipboard();
}
start();

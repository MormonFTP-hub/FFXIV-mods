/**
 * PF Merc Board: keeps one live message in a Discord channel listing every NA Party Finder party
 * that's paying gil for mercs, grouped by fight with each duty's banner art. It never pings anyone
 * except the one person in PING_USER_ID, about big offers on the fights in PING_FIGHTS.
 *
 * Runs for free on Google's servers (Google Apps Script), checks https://xivpf.com/listings every
 * minute and edits the same message in place. Setup steps are in README.md next to this file.
 * In short: paste your Discord webhook URL below, save, then run `setup` once.
 *
 * The detection rules are the same as ../pf.py; keep the two in sync when tuning.
 */

// ============ settings ============
const WEBHOOK_URL = 'PASTE_WEBHOOK_URL_HERE';  // double-click PASTE_WEBHOOK_URL_HERE and paste your Discord webhook URL
const MIN_PAY_MILLIONS = 0;  // only list parties offering at least this much (0 = every merc listing)
const DATA_CENTRES = ['Aether', 'Crystal', 'Dynamis', 'Primal'];  // delete any you don't want
// These fights go at the bottom of the board, in this order (the last one is the very bottom).
const PIN_TO_BOTTOM = ["Dragonsong's Reprise (Ultimate)", 'The Omega Protocol (Ultimate)'];
// Optional, for each leader's best pull on the board: make a client at https://www.fflogs.com/api/clients/
const FFLOGS_CLIENT_ID = 'PASTE_FFLOGS_CLIENT_ID';  // double-click and paste the Client ID
const FFLOGS_CLIENT_SECRET = 'PASTE_FFLOGS_CLIENT_SECRET';  // double-click and paste the Client Secret
const USE_FFLOGS = false;  // true = look up each leader's prog on FFLogs (spends those keys' API points)
// Pings this one Discord user (right-click your name > Copy User ID) when a party in PING_FIGHTS offers
// more than PING_OVER_MILLIONS. Nobody else is ever pinged. '' turns it off.
const PING_USER_ID = '161345179222147072';
const PING_FIGHTS = ["Dragonsong's Reprise (Ultimate)", 'The Omega Protocol (Ultimate)'];
const PING_OVER_MILLIONS = 5;
// Optional, to move the board back to the bottom when people type in the channel and delete the board's
// own old messages: a Discord bot's token (README: "Keeping the board at the bottom"). The bot only
// reads the channel; it never posts.
const DISCORD_BOT_TOKEN = 'PASTE_BOT_TOKEN_HERE';  // double-click and paste the bot's token
// ==================================

const LISTINGS_URL = 'https://xivpf.com/listings';
const NA_DATA_CENTRES = ['Aether', 'Crystal', 'Dynamis', 'Primal'];
const BOT_NAME = 'PF Mercs';
const GONE_AFTER_MISSES = 2;  // xivpf sometimes drops a listing for one refresh; keep it on the board through one miss
const NEW_FOR_MS = 10 * 60 * 1000;  // parties first seen this recently get a 🆕
const FORGET_MS = 3 * 3600 * 1000;  // stop remembering a party this long after it was last seen
const CHECK_EVERY_S = 60;  // the trigger's interval, for the "next refresh" countdown
const BOARD_LAYOUT = 3;  // bump when the layout changes, so the board is re-sent once
const LOOKUPS_PER_CHECK = 4;  // Lodestone searches per check, for new party leaders' Tomestone links
const FFLOGS_PER_CHECK = 2;  // FFLogs prog lookups per check (the free API allows 3600 points an hour)
const PROG_PAGE_SIZE = 25;  // FFLogs reports per prog query (bigger pages can go over FFLogs' query complexity limit)
const PROG_PAGES = 3;  // how far back to look for a leader's pulls: 3 pages of 25, so 75 reports
const GONE_STALE_MIN = 6;  // a listing not re-seen this long after its data center + category was refreshed is gone
const PROG_CACHE_S = 6 * 3600;  // how long a leader's prog is reused before it's looked up again
const DAILY_BUDGET_MIN = 80;  // free Google accounts get 90 min of trigger runtime a day
const MAX_FIGHTS = 9;  // Discord allows 10 embeds per message: the header plus 9 fights
const MAX_CHARS = 5800;  // ...and 6000 characters across all of them
const GOLD = 0xF1C40F;
const GIL_ICON = 'attachment://icon065002.png';  // the gil coin, shown on the board's header
const FIGHT_COLOURS = [0xE74C3C, 0x9B59B6, 0x3498DB, 0x1ABC9C, 0xE67E22, 0xE91E63, 0x2ECC71, 0x5865F2, 0xF39C12];
const ROLE_ICONS = {tank: '🛡️', healer: '💚', dps: '⚔️', flex: '❔', any: '❔'};


// --- things you run from the editor ------------------------------------------------

/** Run once: checks settings, posts the board, then keeps it updated every minute. */
function setup() {
  checkSettings_();
  stop();
  ScriptApp.newTrigger('poll').timeBased().everyMinutes(1).create();
  const t0 = Date.now();
  check_(true);
  console.log(`Running. The first check took ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
}

/** Turns the every-minute check off. Run `setup` again to turn it back on. */
function stop() {
  for (const t of ScriptApp.getProjectTriggers()) {
    if (t.getHandlerFunction() === 'poll') ScriptApp.deleteTrigger(t);
  }
}

/** Logs what counts as a merc listing right now, and the money-mentioning listings it skipped. */
function showMercsNow() {
  const listings = parseListings(fetchListings_(), NA_DATA_CENTRES);
  console.log(`${listings.length} NA listings`);
  for (const l of listings) {
    const r = mercReason(l);
    if (r.merc || payAmounts(fullText(l)).length) {
      console.log(`[${r.merc ? 'MERC' : 'skip'}] ${l.dc} ${dutyDisplay(l)} | ${l.creator} | ${l.filled}/${l.total} | ` +
                  `pay ${formatMillions(maxPay(l))} | ${r.why}\n    ${fullText(l)}`);
    }
  }
}


// --- the every-minute check ----------------------------------------------------------

function poll() {
  check_(false);
}

// Trigger runs log failures instead of throwing: a thrown error makes Google email a failure
// digest, and a flaky xivpf minute isn't worth that. `setup` passes true to show errors.
function check_(throwErrors) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;  // the previous check is still running
  const t0 = Date.now();
  const props = PropertiesService.getScriptProperties();
  const stored = props.getProperties();
  try {
    if (!budgetAllows_(stored)) return;
    runPoll_(props, stored, t0);
  } catch (e) {
    if (throwErrors) throw e;
    console.warn(`Check failed: ${e.message}`);
  } finally {
    recordRuntime_(props, stored, Date.now() - t0);
    lock.releaseLock();
  }
}

function runPoll_(props, stored, startedAt) {
  checkSettings_();
  const listings = parseListings(fetchListings_(), NA_DATA_CENTRES);
  if (!listings.length) throw new Error('xivpf returned no NA listings (site down or changed?)');

  const now = Date.now();
  const cache = CacheService.getScriptCache();
  const previous = JSON.parse(cache.get('board-parties') || '{}');  // last check's board, by key
  const seen = JSON.parse(stored.seen || '{}');  // key hash -> {first, last, miss}

  // xivpf keeps showing a listing until its timer runs out, even after the party fills or is taken
  // down. When someone with the plugin opens the Party Finder, every listing still up gets re-seen, so
  // a listing that wasn't re-seen while the rest of its data center + category was is gone.
  const groupOf = l => `${l.dc}|${l.category}`;
  const lastRefresh = {};  // group -> minutes since its freshest listing was seen
  for (const l of listings) lastRefresh[groupOf(l)] = Math.min(lastRefresh[groupOf(l)] ?? 999, l.seenAgo);
  const stale = l => l.seenAgo - lastRefresh[groupOf(l)] >= GONE_STALE_MIN;
  const listed = new Set(listings.map(listingKey));  // includes stale copies: those count as gone, not missing

  const fresh = {};  // merc parties that are still up, by key (a relisted party's old copy is skipped)
  for (const l of listings) {
    const k = listingKey(l);
    if (!(k in fresh) && !stale(l) && isMerc(l) && DATA_CENTRES.includes(l.dc) &&
        (MIN_PAY_MILLIONS <= 0 || maxPay(l) >= MIN_PAY_MILLIONS)) fresh[k] = l;
  }
  const board = {};
  for (const [k, l] of Object.entries(fresh)) {
    const s = seen[shortHash_(k)] || (seen[shortHash_(k)] = {first: now});
    Object.assign(s, {last: now, miss: 0});
    board[k] = l;
  }
  for (const [k, l] of Object.entries(previous)) {  // keep a party that dropped off xivpf for a single check
    const s = seen[shortHash_(k)];
    if (!(k in fresh) && !listed.has(k) && s && ++s.miss < GONE_AFTER_MISSES) board[k] = l;
  }
  for (const [h, s] of Object.entries(seen)) if (now - s.last > FORGET_MS) delete seen[h];

  const firstSeen = l => seen[shortHash_(listingKey(l))].first;
  const parties = Object.values(board);
  const leaders = lookupLeaders_(parties, props, stored);
  const prog = lookupProg_(parties, props, stored);
  const embeds = buildBoard_(parties, firstSeen, leaders, prog, now, props, stored);
  const sig = shortHash_(BOARD_LAYOUT + JSON.stringify(embeds));
  const t = Math.floor(now / 1000);
  // the next check that will run: in a minute, or later if today's runtime budget needs a rest
  const rest = Math.ceil((budgetOpensAt_(stored, Date.now() - startedAt) - now) / 1000 / CHECK_EVERY_S) * CHECK_EVERY_S;
  const timer = `-# 🔄 Next refresh <t:${t + Math.max(CHECK_EVERY_S, rest)}:R>  ·  last refreshed <t:${t}:T>`;

  // Two messages: the board (the cards) and a one-line countdown under it. Discord only builds image
  // previews for pictures uploaded with the edit, so the board is re-sent with its pictures only when
  // it changed, while the countdown is edited every check. Edits never notify anyone.
  const state = JSON.parse(stored.board || 'null');
  const hook = webhookId_();
  const mine = state && state.hook === hook;
  let boardId = mine ? state.id : null;
  let boardSig = mine ? state.sig : null;
  let timerId = mine ? state.timerId : null;
  const alerts = Object.assign({}, mine && state.alerts);  // key hash -> ping message id
  // Saved after every post, so a check that fails halfway (Discord has its moments) never loses track
  // of a message it already posted.
  const save = () => props.setProperty('board', JSON.stringify({id: boardId, hook, sig: boardSig, timerId, alerts}));
  // With DISCORD_BOT_TOKEN (webhooks can't read the channel), the channel's latest messages: if someone
  // typed under ours, the board is posted again, and the pings and countdown with it, so it's all back
  // at the bottom. Our own out-of-date messages are deleted further down.
  const recent = mine && botReady_() ? channelRecent_(props, stored).messages : [];
  if (boardId && timerId && recent.some(m => m.webhook_id !== hook && laterId_(m.id, timerId))) {
    discord_('delete', `/messages/${boardId}`);
    boardId = null;
  }
  if (boardId && boardSig !== sig && !sendBoard_('patch', boardId, embeds)) boardId = null;
  if (!boardId) boardId = sendBoard_('post', null, embeds).id;  // first board, someone deleted it, or it's moving back down
  boardSig = sig;
  save();

  // Pings: a big enough offer on a PING_FIGHTS fight gets one short message mentioning PING_USER_ID
  // (only them), once per party. It's deleted when the party leaves the board, and moves under the
  // board (without pinging again) when the board is posted again. Discord ids grow with time, so
  // "older than the board" means "above it".
  const onBoard = {};  // key hash -> party
  for (const [k, l] of Object.entries(board)) onBoard[shortHash_(k)] = l;
  for (const [h, id] of Object.entries(alerts)) {
    if (h in onBoard && laterId_(id, boardId)) continue;
    discord_('delete', `/messages/${id}`);
    delete alerts[h];
    if (h in onBoard) alerts[h] = discord_('post', '', pingMessage_(onBoard[h], false)).id;
    save();
  }
  for (const [h, l] of Object.entries(onBoard)) {
    if (!pingWorthy_(l) || seen[h].pinged) continue;
    alerts[h] = discord_('post', '', pingMessage_(l, true)).id;
    seen[h].pinged = true;
    save();
    props.setProperty('seen', JSON.stringify(seen));
  }

  if (timerId && ![boardId, ...Object.values(alerts)].every(id => laterId_(timerId, id))) {  // it's above the board or a ping: replace it
    discord_('delete', `/messages/${timerId}`);
    timerId = null;
  }
  if (timerId && !discord_('patch', `/messages/${timerId}`, {content: timer, allowed_mentions: {parse: []}})) timerId = null;
  if (!timerId) timerId = discord_('post', '', {content: timer, username: BOT_NAME, allowed_mentions: {parse: []}}).id;
  save();
  // Anything else this webhook posted is out of date (old boards and countdowns, one-per-party alerts
  // from the first version): delete it. Messages handled above this check are skipped.
  const handled = new Set([boardId, timerId, ...Object.values(alerts), state && state.id, state && state.timerId,
                           ...Object.values((state && state.alerts) || {})]);
  for (const m of recent) if (m.webhook_id === hook && !handled.has(m.id)) discord_('delete', `/messages/${m.id}`);

  props.setProperty('seen', JSON.stringify(seen));
  cache.put('board-parties', JSON.stringify(board), 21600);
  for (const pk of Object.keys(stored)) {
    if (pk.startsWith('alert:')) props.deleteProperty(pk);  // left over from the one-message-per-party version
  }
}

function fetchListings_() {
  const r = UrlFetchApp.fetch(LISTINGS_URL, {muteHttpExceptions: true});
  if (r.getResponseCode() !== 200) throw new Error(`xivpf answered HTTP ${r.getResponseCode()}`);
  return r.getContentText('UTF-8');
}

// Spread the 90 min/day of free runtime over the day: skip a check if we're ahead of schedule.
function budgetAllows_(stored) {
  return Date.now() >= budgetOpensAt_(stored, 0);
}

/** When today's runtime budget lets a check run, with `extraMs` more runtime used than recorded. */
function budgetOpensAt_(stored, extraMs) {
  const b = JSON.parse(stored.budget || 'null');
  const day = new Date().toISOString().slice(0, 10);
  const used = (b && b.day === day ? b.ms : 0) + extraMs;
  const dayStart = Date.parse(day + 'T00:00:00Z');
  return dayStart + Math.min(1, Math.max(0, used - 5 * 60000) / (DAILY_BUDGET_MIN * 60000)) * 86400000;
}

function recordRuntime_(props, stored, ms) {
  const b = JSON.parse(stored.budget || 'null');
  const day = new Date().toISOString().slice(0, 10);
  const used = b && b.day === day ? b.ms : 0;
  props.setProperty('budget', JSON.stringify({day, ms: used + ms}));
}


// --- Discord webhook -------------------------------------------------------------------

function checkSettings_() {
  if (!/^https:\/\/(?:\w+\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+/.test(WEBHOOK_URL)) {
    throw new Error('Double-click PASTE_WEBHOOK_URL_HERE at the top of Code.gs, paste your Discord webhook URL, then save.');
  }
}

function webhookBase_() {
  return WEBHOOK_URL.split('?')[0].replace(/\/+$/, '');
}

function webhookId_() {
  return webhookBase_().split('/webhooks/')[1].split('/')[0];
}

function botReady_() {
  return !/^PASTE_|^$/.test(DISCORD_BOT_TOKEN);
}

/** Whether Discord id a is newer than id b (ids are time-ordered numbers too big for JS numbers). */
function laterId_(a, b) {
  return a.length !== b.length ? a.length > b.length : a > b;
}

/** The latest 100 messages in the webhook's channel, read as the bot: {code, messages}. */
function channelRecent_(props, stored) {
  const pk = 'channel:' + webhookId_();
  if (!stored[pk]) {  // the webhook knows its channel
    const w = UrlFetchApp.fetch(webhookBase_(), {muteHttpExceptions: true});
    if (w.getResponseCode() !== 200) return {code: w.getResponseCode(), messages: []};
    stored[pk] = JSON.parse(w.getContentText()).channel_id;
    props.setProperty(pk, stored[pk]);
  }
  const r = UrlFetchApp.fetch(`https://discord.com/api/v10/channels/${stored[pk]}/messages?limit=100`,
                              {headers: {Authorization: 'Bot ' + DISCORD_BOT_TOKEN}, muteHttpExceptions: true});
  const code = r.getResponseCode();
  if (code === 401 || code === 403) console.warn(`The Discord bot can't read the channel (HTTP ${code}): run testDiscordBot`);
  let messages = [];
  try {
    if (code === 200) messages = JSON.parse(r.getContentText());
  } catch (e) {
    // not Discord's JSON (Cloudflare): try again next check
  }
  return {code, messages};
}

/** Run from the editor to check DISCORD_BOT_TOKEN: signs in as the bot and reads the board's channel. */
function testDiscordBot() {
  checkSettings_();
  if (!botReady_()) return console.log('No bot token yet: paste it near the top, save, and run this again.');
  const me = UrlFetchApp.fetch('https://discord.com/api/v10/users/@me', {headers: {Authorization: 'Bot ' + DISCORD_BOT_TOKEN}, muteHttpExceptions: true});
  if (me.getResponseCode() !== 200) return console.log(`Discord didn't take the bot token (HTTP ${me.getResponseCode()}): copy it again from the bot's page.`);
  console.log(`Signed in as the bot ${JSON.parse(me.getContentText()).username}.`);
  const props = PropertiesService.getScriptProperties();
  const {code} = channelRecent_(props, props.getProperties());
  console.log(code === 200 ? 'It can read the channel: the board will move back to the bottom when people type, and old messages get cleaned up.' :
              `It can't read the channel (HTTP ${code}): invite it to the server, with Read Message History in that channel.`);
}

function discord_(method, path, payload, uploads) {
  const url = webhookBase_() + path + (method === 'post' ? '?wait=true' : '');
  const multipart = uploads && Object.keys(uploads).length > 0;
  let options = {method, muteHttpExceptions: true};  // a delete has no body
  if (multipart) options.payload = Object.assign({payload_json: JSON.stringify(payload)}, uploads);
  else if (payload) options = Object.assign(options, {contentType: 'application/json', payload: JSON.stringify(payload)});
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = UrlFetchApp.fetch(url, options);
    const code = r.getResponseCode();
    if (code === 429) {
      let limit = null;
      try {
        limit = JSON.parse(r.getContentText());
      } catch (e) {
        // not Discord's own JSON: Cloudflare in front of Discord briefly blocking Google's shared servers
      }
      if (!limit) throw new Error('Discord is briefly blocking Google\'s servers (Cloudflare 1015); trying again next minute');
      Utilities.sleep(Math.min(Number(limit.retry_after) || 1, 10) * 1000 + 250);
      continue;
    }
    if (code >= 200 && code < 300) return code === 204 ? null : JSON.parse(r.getContentText());
    if (code === 404 && method !== 'post') return null;  // someone deleted that message; fine
    throw new Error(`Discord ${method} failed, HTTP ${code}: ${r.getContentText().slice(0, 300)}`);
  }
  throw new Error('Discord kept rate limiting');
}

/**
 * Posts or re-sends the whole board. Discord's image proxy can't load XIVAPI, and it only builds
 * previews for pictures uploaded with the message or edit, so every picture (banners and the gil
 * icon) is uploaded each time and referenced with attachment://. Listing only the new uploads in
 * `attachments` drops the previous copies. Returns the message, or null if it's gone.
 */
function sendBoard_(method, messageId, boardEmbeds) {
  const embeds = JSON.parse(JSON.stringify(boardEmbeds));  // pictures that fail are dropped from this copy only
  const pictures = [];  // [embed, 'image' | 'thumbnail', file name]
  for (const e of embeds) {
    for (const key of ['thumbnail', 'image']) {
      if (e[key] && e[key].url.startsWith('attachment://')) pictures.push([e, key, e[key].url.slice('attachment://'.length)]);
    }
  }
  const attachments = [];
  const uploads = {};
  const added = new Set();
  for (const [, , file] of pictures) {
    if (added.has(file)) continue;
    const blob = iconBlob_(file);
    if (!blob) continue;
    const i = Object.keys(uploads).length;
    uploads[`files[${i}]`] = blob;
    attachments.push({id: i, filename: file});
    added.add(file);
  }
  for (const [e, key, file] of pictures) {
    if (!added.has(file)) delete e[key];  // couldn't get that art this time: show it without
  }
  const body = {content: '', embeds, allowed_mentions: {parse: []}, attachments};
  if (method === 'post') body.username = BOT_NAME;
  return discord_(method, method === 'post' ? '' : `/messages/${messageId}`, body, uploads);
}

/** A game icon as a named blob, from the script cache when we've fetched it lately. */
function iconBlob_(file) {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('icon:' + file);
  if (hit) return Utilities.newBlob(Utilities.base64Decode(hit), 'image/png', file);
  const blob = fetchIcon_(file);
  if (!blob) return null;
  try {
    cache.put('icon:' + file, Utilities.base64Encode(blob.getBytes()), 21600);
  } catch (e) {
    // too big for the cache (100 KB): it gets fetched again next time
  }
  return blob.setName(file);
}

/** Downloads game icon `iconNNNNNN.png` from XIVAPI. */
function fetchIcon_(file) {
  const id = Number(/\d+/.exec(file)[0]);
  const folder = String(Math.floor(id / 1000) * 1000).padStart(6, '0');
  try {
    const r = UrlFetchApp.fetch(`https://xivapi.com/i/${folder}/${String(id).padStart(6, '0')}.png`, {muteHttpExceptions: true});
    if (r.getResponseCode() === 200 && r.getBlob().getBytes().length > 0) return r.getBlob();
  } catch (e) {
    // XIVAPI unreachable: try again next time
  }
  return null;
}

function shortHash_(s) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}


// --- the board ------------------------------------------------------------------------

/** One header embed plus one embed per fight, biggest fights first (PIN_TO_BOTTOM last), each with its banner art. */
function buildBoard_(parties, firstSeen, leaders, prog, now, props, stored) {
  const fights = {};
  for (const l of parties) (fights[fightName_(l)] = fights[fightName_(l)] || []).push(l);
  const byPay = (a, b) => maxPay(b) - maxPay(a) || listingKey(a).localeCompare(listingKey(b));
  const pin = name => PIN_TO_BOTTOM.findIndex(p => p.toLowerCase() === name.toLowerCase());
  let groups = Object.entries(fights).map(([name, ls]) => ({name, ls: ls.sort(byPay)}))
      .sort((a, b) => b.ls.length - a.ls.length || byPay(a.ls[0], b.ls[0]));
  const pinned = groups.filter(g => pin(g.name) >= 0).sort((a, b) => pin(a.name) - pin(b.name));
  groups = groups.filter(g => pin(g.name) < 0);
  if (groups.length + pinned.length > MAX_FIGHTS) {  // more fights than Discord's embed limit: fold the smallest together
    const rest = groups.splice(Math.max(0, MAX_FIGHTS - 1 - pinned.length));
    groups.push({name: 'Other fights', ls: rest.flatMap(g => g.ls).sort(byPay), mixed: true});
  }
  groups = groups.concat(pinned);
  const used = new Set();
  for (const g of groups) {
    g.image = g.mixed ? null : dutyImage_(g.name, props, stored);
    let c = colourIndex_(g.name);  // stable per fight, nudged along if another fight already has it
    while (used.has(c) && used.size < FIGHT_COLOURS.length) c = (c + 1) % FIGHT_COLOURS.length;
    used.add(c);
    g.colour = FIGHT_COLOURS[c];
  }

  // Shrink to fit Discord's 6000-character limit: shorter descriptions, then no profile links, then fewer rows.
  const levels = [[110, true, 24], [70, true, 24], [40, true, 24], [40, false, 24], [0, false, 24], [0, false, 5], [0, false, 2]];
  for (const [descMax, links, maxRows] of levels) {
    const opts = {descMax, links, maxRows, firstSeen, leaders, prog, now};
    const embeds = [boardHeader_(parties)].concat(groups.map(g => fightEmbed_(g, opts)));
    if (embedChars_(embeds) <= MAX_CHARS && embeds.every(e => e.description.length <= 4096)) return embeds;
  }
  return [boardHeader_(parties)];
}

/** The board's title card. The countdown is its own message under the board (see runPoll_). */
function boardHeader_(parties) {
  const e = {title: '💰  NA Merc Board', url: LISTINGS_URL, color: GOLD, thumbnail: {url: GIL_ICON},
             footer: {text: 'Paying Party Finder listings · data from xivpf.com, FFLogs and the Lodestone'}};
  if (!parties.length) {
    e.description = 'Nobody on NA is paying for mercs right now.';
    return e;
  }
  const n = parties.length;
  const best = Math.max(...parties.map(maxPay));
  const perDc = DATA_CENTRES.map(dc => `${dc} **${parties.filter(l => l.dc === dc).length}**`).join('  ·  ');
  const legend = (fflogsReady_() ? '✅ leader has cleared  ·  📈 leader\'s best pull  ·  ' : '') + '🆕 new in the last 10 min';
  e.description = `### ${n} ${n === 1 ? 'party' : 'parties'} paying for help` +
                  (best ? `\nBest offer **${formatMillions(best)}**` : '') + `\n🌐 ${perDc}\n-# ${legend}`;
  return e;
}

/** A fight's card: its parties one under another in the description (headings work there, not in fields). */
function fightEmbed_(g, opts) {
  const shown = g.ls.slice(0, opts.maxRows);
  const top = maxPay(g.ls[0]);
  const blocks = [`-# ${g.ls.length} ${g.ls.length === 1 ? 'party' : 'parties'}` + (top ? `  ·  best offer ${formatMillions(top)}` : '')];
  for (const l of shown) blocks.push(partyBlock_(l, opts, g.mixed));
  if (g.ls.length > shown.length) blocks.push(`*…and ${g.ls.length - shown.length} more on [xivpf.com](${LISTINGS_URL})*`);
  const e = {title: g.name, color: g.colour, description: blocks.join('\n\n')};
  if (g.image) e.image = {url: g.image};
  return e;
}

/**
 * One party. Top line (bold): pay, fill, data center, and the leader's prog. Then their text, open
 * roles, the /tell, and big Tomestone and FFLogs links.
 */
function partyBlock_(l, opts, showFight) {
  const pay = maxPay(l);
  const first = opts.firstSeen(l);
  const head = [`💰 ${pay ? formatMillions(pay) : '?'}`, `${l.filled}/${l.total}`, l.dc];
  const prog = opts.prog[progKey_(l)];
  if (prog && prog !== 'na') head.push(prog === 'none' ? '📈 no logs' : prog);
  const lines = [`**${head.join('  ·  ')}**` + (opts.now - first < NEW_FOR_MS ? '  🆕' : '')];
  if (showFight) lines.push(`**${dutyDisplay(l)}**`);
  if (opts.descMax > 0 && l.description) {
    const d = l.description.length > opts.descMax ? l.description.slice(0, opts.descMax - 1).trimEnd() + '…' : l.description;
    lines.push('> ' + escapeMarkdown(d));
  }
  const slots = openSlotsText_(l);
  lines.push((slots ? `Needs ${slots}  ·  ` : '') + `spotted <t:${Math.floor(first / 1000)}:R>`);
  lines.push('`' + tellCommand(l.creator) + '`');
  if (opts.links) lines.push('### ' + profileLinks_(l, opts.leaders));  // big, easy to hit
  return lines.join('\n');
}

function openSlotsText_(l) {
  return ['tank', 'healer', 'dps', 'any'].map(role => {
    const n = l.openSlots.filter(s => (role === 'any' ? s === 'any' || s === 'flex' : s === role)).length;
    return n > 1 ? `${ROLE_ICONS[role]}×${n}` : n ? ROLE_ICONS[role] : '';
  }).filter(Boolean).join(' ');
}

/** Tomestone (needs the leader's Lodestone id) and FFLogs (works from name + world) profile links. */
function profileLinks_(l, leaders) {
  const [name, world] = l.creator.split(' @ ');
  if (!world) return '';
  const links = [];
  const id = leaders[`${name}@${world}`];
  if (id) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    links.push(`[Tomestone](https://tomestone.gg/character/${id}/${slug})`);
  }
  links.push(`[FFLogs](https://www.fflogs.com/character/na/${encodeURIComponent(world.toLowerCase())}/${encodeURIComponent(name)})`);
  return links.join('  ·  ');
}

/** Lodestone ids of the board's party leaders ("Name@World" -> id), a few new ones looked up per check. */
function lookupLeaders_(parties, props, stored) {
  const ids = JSON.parse(stored.lodestone || '{}');  // '' = searched, not found
  const todo = [];
  for (const l of parties.slice().sort((a, b) => maxPay(b) - maxPay(a))) {  // best offers get their links first
    const [name, world] = l.creator.split(' @ ');
    const who = `${name}@${world}`;
    if (!world || who in ids || todo.length >= LOOKUPS_PER_CHECK || todo.some(t => t.who === who)) continue;
    todo.push({who, name, world});
  }
  if (!todo.length) return ids;
  let responses;
  try {  // all at once: a search takes about a second
    responses = UrlFetchApp.fetchAll(todo.map(t => ({
      url: 'https://na.finalfantasyxiv.com/lodestone/character/?q=' + encodeURIComponent(t.name) +
           '&worldname=' + encodeURIComponent(t.world),
      muteHttpExceptions: true,
    })));
  } catch (e) {
    return ids;  // Lodestone unreachable: try again next check
  }
  let changed = false;
  todo.forEach((t, i) => {
    const id = lodestoneIdFrom_(responses[i], t.name, t.world);
    if (id === null) return;
    ids[t.who] = id;
    changed = true;
  });
  if (changed) {
    const keys = Object.keys(ids);
    for (const k of keys.slice(0, Math.max(0, keys.length - 150))) delete ids[k];  // remember the newest 150
    props.setProperty('lodestone', JSON.stringify(ids));
  }
  return ids;
}

const RE_LODESTONE_ENTRY =
    /<a href="\/lodestone\/character\/(\d+)\/" class="entry__link">[\s\S]*?<p class="entry__name">([^<]*)<\/p><p class="entry__world">[\s\S]*?<\/i>([^<[]*)\[/g;

/** The character's id from a Lodestone search page ('' = not there, null = the search failed). */
function lodestoneIdFrom_(r, name, world) {
  if (r.getResponseCode() !== 200) return null;
  for (const m of r.getContentText('UTF-8').matchAll(RE_LODESTONE_ENTRY)) {
    if (decodeEntities_(m[2]).trim().toLowerCase() === name.toLowerCase() &&
        decodeEntities_(m[3]).trim().toLowerCase() === world.toLowerCase()) return m[1];
  }
  return '';
}


// --- FFLogs prog ------------------------------------------------------------------------

// One page of the character's reports: who was in each log (to tell their pulls from other parties'),
// and every pull of the fight.
const PROG_QUERY = `query($name: String, $server: String, $enc: Int, $limit: Int, $page: Int) {
  characterData { character(name: $name, serverSlug: $server, serverRegion: "NA") {
    hidden
    encounterRankings(encounterID: $enc)
    recentReports(limit: $limit, page: $page) { data {
      masterData { actors(type: "Player") { id name server } }
      fights(encounterID: $enc) {
        kill lastPhase lastPhaseAsAbsoluteIndex lastPhaseIsIntermission bossPercentage fightPercentage friendlyPlayers } } }
  } }
}`;

function fflogsReady_() {
  return USE_FFLOGS && !/^PASTE_|^$/.test(FFLOGS_CLIENT_ID) && !/^PASTE_|^$/.test(FFLOGS_CLIENT_SECRET);
}

function progKey_(l) {
  return `${l.creator.replace(' @ ', '@')}|${l.duty}`;
}

/**
 * Each leader's best FFLogs pull on their listing's fight ("Name@World|duty" -> line of text, 'none'
 * for no public logs, 'na' for fights FFLogs doesn't track), cached for a few hours, a couple of new
 * leaders looked up per check. Empty without keys.
 */
function lookupProg_(parties, props, stored) {
  const prog = {};
  if (!fflogsReady_() || !parties.length) return prog;
  const cache = CacheService.getScriptCache();
  const cacheKey = l => 'ffl4:' + shortHash_(progKey_(l));  // bump when the prog rules change
  const hits = cache.getAll(parties.map(cacheKey));
  for (const l of parties) if (cacheKey(l) in hits) prog[progKey_(l)] = hits[cacheKey(l)];
  if (Number(stored['ffl-pause'] || 0) > Date.now()) return prog;  // FFLogs failed recently: give it a rest

  let token = null;
  const todo = [];  // [party, query variables]
  for (const l of parties.slice().sort((a, b) => maxPay(b) - maxPay(a))) {  // best offers first
    const [name, world] = l.creator.split(' @ ');
    if (!world || progKey_(l) in prog || todo.length >= FFLOGS_PER_CHECK || todo.some(([t]) => progKey_(t) === progKey_(l))) continue;
    token = token || fflogsToken_(props, stored);
    if (!token) break;
    const enc = fflogsEncounter_(l.duty, token, props, stored);
    if (enc === null) break;  // FFLogs unreachable
    if (!enc) {  // FFLogs doesn't track this fight: show nothing
      prog[progKey_(l)] = 'na';
      cache.put(cacheKey(l), 'na', PROG_CACHE_S);
      continue;
    }
    todo.push([l, {name, server: world.toLowerCase(), enc}]);
  }
  if (!todo.length) return prog;
  const found = fetchProg_(token, todo.map(([, variables]) => variables));
  todo.forEach(([l], i) => {
    if (found[i].failed) return;
    const text = progText_(found[i]);
    prog[progKey_(l)] = text;
    cache.put(cacheKey(l), text, PROG_CACHE_S);
  });
  if (found.some(f => f.failed)) props.setProperty('ffl-pause', String(Date.now() + 10 * 60000));  // out of points for the hour, or down
  return prog;
}

/**
 * Each character's kills and pulls on a fight. A log holds every pull its logger saw, other parties'
 * too, so only pulls with this character in them count (as on Tomestone). Busy loggers' newest
 * reports are often other content, so this reads up to PROG_PAGES pages of PROG_PAGE_SIZE reports
 * while their pulls keep showing up (or haven't yet), and stops once they've cleared it. Each page
 * takes FFLogs a few seconds, so page 1 goes first for everyone (it settles anyone who's cleared or
 * barely logs) and then the rest of the pages all at once.
 */
function fetchProg_(token, varsList) {
  const query = (v, page) => ({query: PROG_QUERY, variables: Object.assign({page, limit: PROG_PAGE_SIZE}, v)});
  const found = varsList.map(() => ({kills: 0, fights: [], reports: 0, pulls: 0, missing: false, failed: false, more: true}));
  const first = fflogsQueryAll_(token, varsList.map(v => query(v, 1)));
  found.forEach((f, i) => readProgPage_(f, varsList[i], first[i]));
  const rest = [];  // [character, page], each character's pages in order
  found.forEach((f, i) => { for (let page = 2; f.more && page <= PROG_PAGES; page++) rest.push([i, page]); });
  const results = rest.length ? fflogsQueryAll_(token, rest.map(([i, page]) => query(varsList[i], page))) : [];
  rest.forEach(([i], k) => { if (found[i].more) readProgPage_(found[i], varsList[i], results[k]); });
  return found;
}

/** Adds one page of FFLogs results to `f`; `f.more` says whether their next page is still worth reading. */
function readProgPage_(f, who, res) {
  const c = res && res.data && res.data.characterData && res.data.characterData.character;
  if (!res) f.failed = true;
  else if (!c || c.hidden) f.missing = true;
  if (f.failed || f.missing) {
    f.more = false;
    return;
  }
  f.kills = Math.max(f.kills, Number((c.encounterRankings && c.encounterRankings.totalKills) || 0));
  const reports = (c.recentReports && c.recentReports.data) || [];
  const theirs = reports.flatMap(r => pullsWith_(r, who));
  const hadPulls = f.fights.length > 0;
  f.reports += reports.length;
  f.pulls += reports.reduce((n, r) => n + (r.fights || []).length, 0);
  f.fights.push(...theirs);
  f.more = !f.kills && !theirs.some(p => p.kill) && reports.length === PROG_PAGE_SIZE && (theirs.length > 0 || !hadPulls);
}

/** The report's pulls that the character was in. */
function pullsWith_(report, who) {
  const actors = (report.masterData && report.masterData.actors) || [];
  const ids = new Set(actors.filter(a => (a.name || '').toLowerCase() === who.name.toLowerCase() &&
                                         (!a.server || a.server.toLowerCase() === who.server)).map(a => a.id));
  return (report.fights || []).filter(p => (p.friendlyPlayers || []).some(id => ids.has(id)));
}

/** "✅ Cleared ×3", "📈 P5 · 18.97%" (their furthest pull: the latest phase, then the least boss HP left), or 'none'. */
function progText_(found) {
  if (found.missing) return 'none';
  if (found.kills > 0 || found.fights.some(f => f.kill)) return '✅ Cleared' + (found.kills > 1 ? ` ×${found.kills}` : '');
  let best = null;
  for (const f of found.fights) if (!best || furtherThan_(f, best)) best = f;
  if (!best) return 'none';
  const phase = !best.lastPhase ? '' : !best.lastPhaseIsIntermission ? `P${best.lastPhase}` :
      best.lastPhase > 1 ? `Intermission ${best.lastPhase}` : 'Intermission';  // FFLogs numbers intermissions on their own
  const hp = best.bossPercentage == null ? '' : `${best.bossPercentage.toFixed(2)}%`;
  return '📈 ' + ([phase, hp].filter(Boolean).join(' · ') || 'pulled');
}

/** Whether pull a got further than pull b: a later phase (intermissions count), then less boss HP, then less of the fight left. */
function furtherThan_(a, b) {
  const phase = p => p.lastPhaseAsAbsoluteIndex ?? -1;
  if (phase(a) !== phase(b)) return phase(a) > phase(b);
  if ((a.bossPercentage ?? 100) !== (b.bossPercentage ?? 100)) return (a.bossPercentage ?? 100) < (b.bossPercentage ?? 100);
  return (a.fightPercentage ?? 100) < (b.fightPercentage ?? 100);
}

/** FFLogs encounter id for a Party Finder duty (0 = FFLogs doesn't track it, null = unreachable). */
function fflogsEncounter_(duty, token, props, stored) {
  const want = fflogsName_(duty);
  if (!want || want === 'none' || duty.includes(':')) return 0;  // no duty set, or a roulette
  const pk = 'ffe:' + shortHash_(want);
  if (pk in stored) return Number(stored[pk]);
  const cache = CacheService.getScriptCache();
  let all = JSON.parse(cache.get('ffl-encounters') || 'null');  // [[name, id], ...] for every zone
  if (!all) {
    const res = fflogsQuery_(token, '{ worldData { zones { encounters { id name } } } }', {});
    if (!res || !res.data) return null;
    all = res.data.worldData.zones.flatMap(z => (z.encounters || []).map(e => [e.name, e.id]));
    cache.put('ffl-encounters', JSON.stringify(all), 21600);
  }
  let id = 0;  // a fight listed in several zones (legacy ultimates) uses its newest id
  for (const [name, eid] of all) if (fflogsName_(name) === want && eid > id) id = eid;
  stored[pk] = String(id);
  props.setProperty(pk, String(id));
  return id;
}

function fflogsName_(s) {
  return s.toLowerCase().replace(/\s*\((ultimate|savage|extreme|unreal|chaotic)\)\s*$/, '').replace(/^the /, '').trim();
}

function fflogsToken_(props, stored) {
  const saved = JSON.parse(stored['ffl-token'] || 'null');
  if (saved && saved.exp > Date.now() + 3600000) return saved.token;
  let r;
  try {
    r = UrlFetchApp.fetch('https://www.fflogs.com/oauth/token', {
      method: 'post', payload: {grant_type: 'client_credentials'}, muteHttpExceptions: true,
      headers: {Authorization: 'Basic ' + Utilities.base64Encode(`${FFLOGS_CLIENT_ID}:${FFLOGS_CLIENT_SECRET}`)},
    });
  } catch (e) {
    return null;
  }
  if (r.getResponseCode() !== 200) {
    console.warn(`FFLogs sign-in failed (HTTP ${r.getResponseCode()}): check FFLOGS_CLIENT_ID and FFLOGS_CLIENT_SECRET`);
    props.setProperty('ffl-pause', String(Date.now() + 30 * 60000));
    return null;
  }
  const j = JSON.parse(r.getContentText());
  props.setProperty('ffl-token', JSON.stringify({token: j.access_token, exp: Date.now() + j.expires_in * 1000}));
  return j.access_token;
}

function fflogsQuery_(token, query, variables) {
  return fflogsQueryAll_(token, [{query, variables}])[0];
}

/** Several GraphQL queries at once; each result is the parsed reply, or null if that one failed. */
function fflogsQueryAll_(token, queries) {
  let responses;
  try {
    responses = UrlFetchApp.fetchAll(queries.map(q => ({
      url: 'https://www.fflogs.com/api/v2/client', method: 'post', contentType: 'application/json',
      payload: JSON.stringify(q), headers: {Authorization: 'Bearer ' + token}, muteHttpExceptions: true,
    })));
  } catch (e) {
    return queries.map(() => null);
  }
  return responses.map(r => {
    if (r.getResponseCode() !== 200) {
      console.warn(`FFLogs query failed, HTTP ${r.getResponseCode()}: ${r.getContentText().slice(0, 200)}`);
      return null;
    }
    try {
      const res = JSON.parse(r.getContentText());
      if (res.errors && res.errors.length) console.warn(`FFLogs said: ${res.errors[0].message}`);
      return res;
    } catch (e) {
      console.warn(`FFLogs sent something that isn't JSON: ${r.getContentText().slice(0, 200)}`);
      return null;
    }
  });
}

/** Run from the editor to check the FFLogs keys: signs in, finds a fight, looks up one leader. */
function testFFLogs() {
  if (!fflogsReady_()) return console.log('FFLogs is off: set USE_FFLOGS to true and paste the keys near the top, save, and run this again.');
  const props = PropertiesService.getScriptProperties();
  const stored = props.getProperties();
  delete stored['ffl-token'];  // force a fresh sign-in
  props.deleteProperty('ffl-pause');
  const token = fflogsToken_(props, stored);
  if (!token) return console.log('FFLogs sign-in failed: check FFLOGS_CLIENT_ID and FFLOGS_CLIENT_SECRET.');
  console.log('Signed in to FFLogs.');
  const l = parseListings(fetchListings_(), NA_DATA_CENTRES).filter(isMerc).find(x => /\(Ultimate\)/.test(x.duty));
  if (!l) return console.log('No ultimate merc listing on NA right now to test with.');
  const enc = fflogsEncounter_(l.duty, token, props, stored);
  console.log(`${l.duty} is FFLogs encounter ${enc}.`);
  if (!enc) return;
  const [name, world] = l.creator.split(' @ ');
  const [found] = fetchProg_(token, [{name, server: world.toLowerCase(), enc}]);
  console.log(`${l.creator}: ${found.failed ? 'the lookup failed (see the warning above)' : progText_(found)}`);
}

/** Run from the editor: logs the prog of the board's ultimate leaders, to compare with Tomestone. */
function diagnoseProg() {
  if (!fflogsReady_()) return console.log('FFLogs is off (USE_FFLOGS) or has no keys.');
  const props = PropertiesService.getScriptProperties();
  const stored = props.getProperties();
  const token = fflogsToken_(props, stored);
  if (!token) return console.log('FFLogs sign-in failed.');
  const points = () => {
    const res = fflogsQuery_(token, '{ rateLimitData { pointsSpentThisHour limitPerHour } }', {});
    return res && res.data ? `${res.data.rateLimitData.pointsSpentThisHour} of ${res.data.rateLimitData.limitPerHour}` : '?';
  };
  console.log(`FFLogs points used this hour: ${points()}`);
  const board = Object.values(JSON.parse(CacheService.getScriptCache().get('board-parties') || '{}'));
  const done = new Set();
  for (const l of board.length ? board : parseListings(fetchListings_(), NA_DATA_CENTRES).filter(isMerc)) {
    if (!/\(Ultimate\)/.test(l.duty) || done.has(l.creator) || done.size >= 6) continue;
    done.add(l.creator);
    const enc = fflogsEncounter_(l.duty, token, props, stored);
    const [name, world] = l.creator.split(' @ ');
    const [f] = fetchProg_(token, [{name, server: world.toLowerCase(), enc}]);
    if (f.failed) {
      console.log(`${l.creator} (${l.duty}): the lookup failed (see the warning above)`);
      continue;
    }
    const byPhase = {};  // their pulls by the phase they ended in
    for (const p of f.fights) {
      const k = (p.lastPhaseIsIntermission ? 'Int' : 'P') + p.lastPhase;
      byPhase[k] = (byPhase[k] || 0) + 1;
    }
    console.log(`${l.creator} (${l.duty}): ${progText_(f)}  |  ranked kills ${f.kills}; ${f.reports} recent reports with ` +
                `${f.pulls} pulls, ${f.fights.length} of them theirs (${f.fights.filter(p => p.kill).length} kills), ending in ` +
                Object.entries(byPhase).map(([k, n]) => `${k}×${n}`).join(' '));
  }
  console.log(`FFLogs points used this hour: ${points()}`);
}

function fightName_(l) {
  const d = dutyDisplay(l);
  return d === 'No duty set' ? 'Other paid jobs' : d;
}

function colourIndex_(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h % FIGHT_COLOURS.length;
}

function embedChars_(embeds) {
  let n = 0;
  for (const e of embeds) {
    n += (e.title || '').length + (e.description || '').length + ((e.footer && e.footer.text) || '').length;
    for (const f of e.fields || []) n += f.name.length + f.value.length;
  }
  return n;
}

/**
 * The duty's banner art as an attachment:// reference (sendBoard_ uploads the file), looked up on
 * XIVAPI once per duty and cached. Null if there isn't one.
 */
function dutyImage_(duty, props, stored) {
  if (duty === 'Other paid jobs' || duty.includes(':')) return null;  // no duty, or a roulette
  const pk = 'img:' + shortHash_(duty);
  if (!(pk in stored)) {
    const core = duty.replace(/^the /i, '').replace(/"/g, '');
    const q = encodeURIComponent(`Name~"${core}"`);
    let r;
    try {
      r = UrlFetchApp.fetch('https://v2.xivapi.com/api/search?sheets=ContentFinderCondition&fields=Name,Image&query=' + q,
                            {muteHttpExceptions: true});
    } catch (e) {
      return null;  // XIVAPI unreachable: try again next check
    }
    if (r.getResponseCode() !== 200) return null;
    const hit = (JSON.parse(r.getContentText()).results || []).find(x =>
        x.fields && x.fields.Name && x.fields.Name.toLowerCase() === duty.toLowerCase() && x.fields.Image && x.fields.Image.id > 0);
    stored[pk] = hit ? hit.fields.Image.path_hr1 : '';
    props.setProperty(pk, stored[pk]);
  }
  const icon = /icon\/\d+\/(\d+)/.exec(stored[pk]);
  return icon ? `attachment://icon${icon[1]}.png` : null;
}

function escapeMarkdown(s) {
  return s.replace(/([\\*_~`|>])/g, '\\$1');
}

function tellCommand(creator) {
  return '/tell ' + creator.replace(' @ ', '@');
}

/** Whether a party is worth pinging PING_USER_ID about. */
function pingWorthy_(l) {
  if (!/^\d{17,20}$/.test(PING_USER_ID)) return false;
  const fight = fightName_(l).toLowerCase();
  return PING_FIGHTS.some(f => f.toLowerCase() === fight) && maxPay(l) > PING_OVER_MILLIONS;
}

/**
 * The ping: pay, fight, data center and fill, the listing text, and the /tell. Only PING_USER_ID can
 * be mentioned, and only when `notify` (a ping being moved shows the mention without pinging).
 */
function pingMessage_(l, notify) {
  const d = l.description.length > 110 ? l.description.slice(0, 109).trimEnd() + '…' : l.description;
  const lines = [`<@${PING_USER_ID}> 💰 **${formatMillions(maxPay(l))}**  ·  ${fightName_(l)}  ·  ${l.dc}  ·  ${l.filled}/${l.total}`];
  if (d) lines.push('> ' + escapeMarkdown(d));
  lines.push('`' + tellCommand(l.creator) + '`');
  return {content: lines.join('\n'), username: BOT_NAME, allowed_mentions: notify ? {parse: [], users: [PING_USER_ID]} : {parse: []}};
}


// --- xivpf page parsing ----------------------------------------------------------------
// The page is server-rendered with a fixed template, so each listing block is cut out
// and its fields pulled with small regexes. Only blocks on the wanted data centres are parsed.

const RE_DC = /data-centre="([^"]*)"/;
const RE_CATEGORY = /data-pf-category="([^"]*)"/;
const RE_DUTY = /<div class="duty([^"]*)">([\s\S]*?)<\/div>/;
const RE_DESC = /<div class="description">([\s\S]*?)<\/div>/;
const RE_TAG_SPAN = /<span class="desc-[^"]*">([\s\S]*?)<\/span>/g;
const RE_ITEM = /<div class="item (creator|world|expires|updated)">\s*<span class="text">([\s\S]*?)<\/span>/g;
const RE_TOTAL = /<div class="total">\s*(\d+)\s*\/\s*(\d+)/;
const RE_SLOT = /<div class="slot([^"]*)"/g;
const RE_MIN_IL = /<div class="name">\s*Min IL\s*<\/div>\s*<div class="value">([^<]*)/;

function parseListings(html, dataCentres) {
  const out = [];
  const parts = html.split('class="listing"');
  for (let i = 1; i < parts.length; i++) {
    const b = parts[i];
    const dc = (RE_DC.exec(b.slice(0, 300)) || [])[1] || '';
    if (dataCentres && !dataCentres.includes(dc)) continue;
    const duty = RE_DUTY.exec(b);
    const desc = (RE_DESC.exec(b) || [])[1] || '';
    const tags = [...desc.matchAll(RE_TAG_SPAN)].map(m => stripTags_(m[1])).join('').trim();
    const items = {};
    for (const m of b.matchAll(RE_ITEM)) items[m[1]] = decodeEntities_(m[2]).trim();
    const total = RE_TOTAL.exec(b);
    const openSlots = [];
    for (const m of b.matchAll(RE_SLOT)) {
      const classes = m[1].split(/\s+/).filter(Boolean);
      if (classes.includes('filled')) continue;
      const roles = ['tank', 'healer', 'dps'].filter(r => classes.includes(r));
      if (classes.includes('empty')) openSlots.push('any');
      else if (roles.length === 1) openSlots.push(roles[0]);
      else if (roles.length) openSlots.push('flex');
      // class="slot " with no roles is a filled slot the site couldn't name
    }
    out.push({
      id: (/data-id="([^"]*)"/.exec(b) || [])[1] || '',
      dc,
      category: decodeEntities_((RE_CATEGORY.exec(b) || [])[1] || ''),
      duty: duty ? stripTags_(duty[2]).trim() : '',
      crossWorld: duty ? duty[1].split(/\s+/).includes('cross') : false,
      tags,
      description: stripTags_(desc.replace(RE_TAG_SPAN, '')).replace(/\s+/g, ' ').trim(),
      creator: items.creator || '',
      world: items.world || '',
      expires: items.expires || '',
      updated: items.updated || '',
      seenAgo: minutesAgo_(items.updated || ''),
      minIl: ((RE_MIN_IL.exec(b) || [])[1] || '').trim(),
      filled: total ? Number(total[1]) : 0,
      total: total ? Number(total[2]) : 0,
      openSlots,
    });
  }
  return out;
}

/** Minutes from xivpf's "updated" text: "now", "32 seconds ago", "a minute ago", "12 minutes ago", "an hour ago". */
function minutesAgo_(s) {
  let m;
  if ((m = /(\d+) minutes?/.exec(s))) return Number(m[1]);
  if (/a minute/.test(s)) return 1;
  if ((m = /(\d+) hours?/.exec(s))) return 60 * Number(m[1]);
  if (/an hour/.test(s)) return 60;
  return 0;  // "now" or seconds
}

function stripTags_(s) {
  return decodeEntities_(s.replace(/<[^>]*>/g, ''));
}

function decodeEntities_(s) {
  const named = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: String.fromCharCode(160)};
  return s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(cp); } catch (err) { return m; }
    }
    return named[e.toLowerCase()] ?? m;
  });
}

function listingKey(l) {
  // Stable across relists: the same recruiter re-posting the same duty is the same party.
  return `${l.dc}|${l.creator}|${l.duty}`;
}

function dutyDisplay(l) {
  return !l.duty || l.duty === 'None' ? 'No duty set' : l.duty;
}

function fullText(l) {
  return `${l.tags} ${l.description}`.trim();
}


// --- merc detection (same rules as ../pf.py) -----------------------------------------------
// A "merc" listing is one where the recruiter pays gil for help (a clear, a phase, filling for
// an hour, farming an item). Sellers (people *charging* gil for carries) and venue/raffle/gamba
// ads also mention gil, so those are filtered out first.

const RE_SELLER = new RegExp(
  '\\b(wts|selling|sells?|seller|for sale|for sell|pricing|cheap|discount|boost(s|ing)?|' +
  'buyers?|carry services?|clear services?|dm for (prices?|info|rates))\\b', 'i');
const RE_NOT_MERC = new RegExp(
  // venues, events and gambling
  '\\b(raffles?|gamba|gamble|gambling|giveaways?|give ?away|djs?|venue|club|lounge|bar|' +
  'cafe|tavern|nightclub|lottery|lotto|drt|death ?roll|bingo|auction|bid|prizes?|' +
  'prize ?pool|tourney|tournament|contest|duels?|sign ?ups?|rp|role ?play|' +
  // paying *to* the party: loot-master farms, buy-ins
  'loot ?master|lm|buy[- ]?in|entry fee|fees?|' +
  // item trading and venue/FC job ads
  'ceruleum|materials|per stack|per 999|in bulk|fc credits?|all positions|open positions|' +
  'staff|staffing|applications?)\\b', 'i');
const RE_MERC_WORD = /\bmercs?\b|mercenar/i;
const RE_PAY_WORD = new RegExp(
  '\\bpay(s|ing|ed)?\\b|\\bpaid\\b|\\bbount(y|ies)\\b|\\brewards?\\b|\\bcompensat|' +
  '\\b(wtb|buying)\\b.{0,25}\\b(clears?|carry|carries|kills?|help|runs?)\\b', 'i');
const RE_PAY_CONTEXT = /\b(for|per|each|a pop|clears?|kills?|phases?|p\d+|lockout|hours?|hrs?|hr|runs?|reclear)\b|\//i;

// 10m, 2 mil, 1.5M, 500k, 20MIL. Must start with a digit so "M4S" etc. never match.
const RE_AMOUNT = /(?<![\w.,])(\d+(?:[.,]\d+)?)\s*(k|m|mil|mill|mils|million|millions|mio)(?![a-z])/gi;
const RE_AMOUNT_LONG = /(?<![\d,])(\d{1,3}(?:,\d{3}){2,})(?![\d,])/g;  // 5,000,000
const RE_AMOUNT_GIL = /(?<![\w.,])(\d[\d,]*)\s*gil\b/gi;  // 500000 gil

/** Every gil amount mentioned, in millions. */
function payAmounts(text) {
  const out = [];
  for (const m of text.matchAll(RE_AMOUNT)) {
    const n = parseFloat(m[1].replace(',', '.'));
    out.push(m[2].toLowerCase() === 'k' ? n / 1000 : n);
  }
  for (const m of text.matchAll(RE_AMOUNT_LONG)) out.push(Number(m[1].replace(/,/g, '')) / 1e6);
  for (const m of text.matchAll(RE_AMOUNT_GIL)) {
    const n = Number(m[1].replace(/,/g, ''));
    out.push(n < 1000 ? n : n / 1e6);  // "5 gil" is nonsense; treat small numbers as millions
  }
  return out;
}

function mercReason(l) {
  const text = fullText(l);
  let m;
  if ((m = RE_SELLER.exec(text))) return {merc: false, why: `seller ('${m[0]}')`};
  if ((m = RE_NOT_MERC.exec(text))) return {merc: false, why: `not a merc job ('${m[0]}')`};
  if (RE_MERC_WORD.test(text)) return {merc: true, why: 'merc keyword'};
  const amounts = payAmounts(text);
  const payWord = RE_PAY_WORD.test(text);
  if (amounts.length && payWord) return {merc: true, why: 'gil amount + pay keyword'};
  if (payWord && /\bgil\b/i.test(text)) return {merc: true, why: 'paying gil'};
  if (amounts.length && RE_PAY_CONTEXT.test(text)) {
    // Without an explicit "paying"/"merc", "1M each" in a [Loot] farm means you pay
    // per drop, and 100M+ for a clear is a sale, not a merc fee.
    if (l.tags.includes('[Loot]')) return {merc: false, why: 'loot party price'};
    if (Math.max(...amounts) >= 100) return {merc: false, why: 'big amount without pay word (likely a sale)'};
    return {merc: true, why: 'gil amount for a clear/phase/hour'};
  }
  return {merc: false, why: amounts.length ? 'amount without pay context' : 'no pay mentioned'};
}

function isMerc(l) {
  return mercReason(l).merc;
}

/** Biggest amount offered, in millions (0 if none was written). */
function maxPay(l) {
  const a = payAmounts(fullText(l));
  return a.length ? Math.max(...a) : 0;
}

function formatMillions(m) {
  if (m <= 0) return 'not stated';
  if (m < 1) return `${+(m * 1000).toPrecision(6)}K`;
  return `${+m.toPrecision(6)}M`;
}

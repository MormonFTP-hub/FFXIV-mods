/**
 * Aion 2 Assassin Board: keeps one live message in a Discord channel listing the Aion 2 party leaders
 * who have let an Assassin into their party, per server, with how often they said yes and no.
 *
 * Aion 2's party finder only exists inside the game, and nobody publishes a feed of it the way xivpf
 * does for FFXIV, so the board is built from a log instead: a Google Form you fill in (a few taps on
 * your phone) after each party you apply to. Anyone you share the form with can add to it too.
 * Runs for free on Google's servers (Google Apps Script) and edits the same message after every entry.
 * Setup steps are in README.md next to this file. In short: paste your Discord webhook URL below,
 * save, then run `setup` once.
 */

// ============ settings ============
const WEBHOOK_URL = 'PASTE_WEBHOOK_URL_HERE';  // double-click PASTE_WEBHOOK_URL_HERE and paste your Discord webhook URL
const TRACK_CLASS = 'Assassin';  // the board only counts parties someone applied to as this class
// The form's server choices (the NA East list, which has every NA West server in it). The form also
// takes any other server name. Changing this list only affects a form made after the change.
const SERVERS = [
  'Ariel (Elyos)', 'Fregion (Elyos)', 'Hithanya (Elyos)', 'Kaisinel (Elyos)', 'Meslamtaeda (Elyos)',
  'Nezekan (Elyos)', 'Siel (Elyos)', 'Vaizel (Elyos)', 'Yustiel (Elyos)',
  'Azphel (Asmodian)', 'Beritra (Asmodian)', 'Ereshkigal (Asmodian)', 'Israphel (Asmodian)', 'Lumiel (Asmodian)',
  'Marchutan (Asmodian)', 'Nemon (Asmodian)', 'Triniel (Asmodian)', 'Zikel (Asmodian)',
];
const SHOW_FORM_LINK = true;  // put the form's link on the board, so anyone in the channel can log a party
// ==================================

const BOT_NAME = 'Assassin Board';
const FORM_TITLE = 'Aion 2 party log';
// The form's questions. The board finds its columns in the response sheet by these titles, so rename
// a question here and on the form together.
const Q_LEADER = "Party leader's character name";
const Q_SERVER = 'Server';
const Q_RESULT = 'What happened?';
const Q_CONTENT = 'Content';
const Q_CLASS = 'You applied as';
const Q_NOTES = 'Notes';
const ACCEPTED = 'They took me';
const DECLINED = 'They turned me down';
const KICKED = 'They kicked me after I joined';
const CLASSES = ['Gladiator', 'Templar', 'Assassin', 'Ranger', 'Sorcerer', 'Spiritmaster', 'Cleric', 'Chanter', 'Brawler'];
const CONTENT = ['Expedition', 'Transcendence', 'Nightmare', 'Sanctuary', 'Spacetime Rift', 'Abyss / Artifact Conquest',
                 'Field boss', 'Daily dungeon', 'Other'];
const MAX_SERVERS = 9;  // Discord allows 10 embeds per message: the header plus 9 servers
const MAX_CHARS = 5800;  // ...and 6000 characters across all of them
const MAX_DESC = 4000;  // ...and 4096 in one embed's description
const NOTE_CHARS = 80;  // a leader's latest note is cut to this length on the board
const MAX_RETRIES = 5;  // a failed update tries again every 2 minutes, this many times
const HEADER_COLOUR = 0xC0392B;
const FACTION_COLOURS = {Elyos: 0x4FC3F7, Asmodian: 0x9B59B6};
const FACTION_ICONS = {Elyos: '☀️', Asmodian: '🌙'};
const OTHER_COLOUR = 0x95A5A6;


// --- things you run from the editor ------------------------------------------------

/**
 * Run once: makes the form and its response sheet (the first time only), posts the board, and from
 * then on updates it after every form entry and every hand edit to the sheet.
 */
function setup() {
  checkSettings_();
  const {form, sheet} = logFiles_(true);
  stop();
  // The sheet's own form trigger, not the form's: it fires once the new row is in the sheet.
  ScriptApp.newTrigger('onLog').forSpreadsheet(sheet.getParent()).onFormSubmit().create();
  ScriptApp.newTrigger('onSheetChange').forSpreadsheet(sheet.getParent()).onChange().create();  // edits and deleted rows
  refresh();
  console.log(`Running.\nThe form to fill in after each party (bookmark it on your phone):\n${form.getPublishedUrl()}\n` +
              `Every entry, to fix a typo or delete one:\n${sheet.getParent().getUrl()}`);
}

/** Stops updating the board. Run `setup` to turn it back on; it keeps the same form and sheet. */
function stop() {
  for (const t of ScriptApp.getProjectTriggers()) ScriptApp.deleteTrigger(t);
}

/** Rebuilds the board from the sheet now, and shows any error. */
function refresh() {
  update_(true);
}

/** Logs every leader in the sheet with their record, best first, including ones not on the board. */
function showTally() {
  const {form, sheet} = logFiles_(false);
  const leaders = tally_(readLog_(sheet)).sort(byRecord_);
  console.log(`${leaders.length} leaders logged. Form: ${form.getPublishedUrl()}`);
  for (const l of leaders) {
    console.log(`${l.yes ? 'BOARD' : '     '} ${l.server} | ${l.name} | took ${l.yes}, turned down ${l.no}, kicked ${l.kick}` +
                (l.note ? ` | ${l.note}` : ''));
  }
}


// --- updating the board --------------------------------------------------------------

function onLog() {
  update_(false);
}

function onSheetChange() {
  update_(false);
}

function retry() {
  for (const t of ScriptApp.getProjectTriggers()) {
    if (t.getHandlerFunction() === 'retry') ScriptApp.deleteTrigger(t);
  }
  update_(false);
}

// Trigger runs log failures and try again in 2 minutes instead of throwing: a thrown error makes
// Google email a failure digest, and a Discord hiccup isn't worth that. `refresh` shows errors.
function update_(throwErrors) {
  const lock = LockService.getScriptLock();
  const props = PropertiesService.getScriptProperties();
  try {
    lock.waitLock(30000);  // each update reads the whole sheet, so wait for the one running instead of skipping
    checkSettings_();
    const {form, sheet} = logFiles_(false);
    const leaders = tally_(readLog_(sheet));
    postBoard_(props, buildBoard_(leaders, SHOW_FORM_LINK ? form.getPublishedUrl() : '', Date.now()));
    props.deleteProperty('retries');
  } catch (e) {
    if (throwErrors) throw e;
    const tries = Number(props.getProperty('retries') || 0) + 1;
    props.setProperty('retries', String(tries));
    if (tries > MAX_RETRIES) return console.warn(`Board update failed ${tries} times, giving up until the next entry: ${e.message}`);
    console.warn(`Board update failed, trying again in 2 minutes: ${e.message}`);
    if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'retry')) {
      ScriptApp.newTrigger('retry').timeBased().after(2 * 60000).create();
    }
  } finally {
    lock.releaseLock();
  }
}


// --- the form and its sheet --------------------------------------------------------------

/** The form and its response sheet. `setup` makes them the first time, or again if the form was deleted. */
function logFiles_(create) {
  const props = PropertiesService.getScriptProperties();
  let form = null;
  const id = props.getProperty('formId');
  if (id) {
    try {
      form = FormApp.openById(id);
    } catch (e) {
      if (!create) throw new Error(`Can't open the party log form (${e.message}). Run setup to make a new one.`);
    }
  }
  if (!form) {
    if (!create) throw new Error('Run setup first: it makes the form.');
    form = makeForm_();
    props.setProperty('formId', form.getId());
  }
  const sheet = SpreadsheetApp.openById(form.getDestinationId()).getSheets().find(s => s.getFormUrl());
  if (!sheet) throw new Error(`The form has no response sheet. Open the form, Responses > Link to Sheets, then run refresh.`);
  return {form, sheet};
}

function makeForm_() {
  const form = FormApp.create(FORM_TITLE)
      .setDescription(`Fill this in after every party you apply to as ${withArticle_(TRACK_CLASS)}, whether they took you ` +
                      `or not. It feeds a Discord board of the leaders who take ${TRACK_CLASS}s.`)
      .setConfirmationMessage('Logged. The Discord board updates in a few seconds.')
      .setShowLinkToRespondAgain(true);
  form.addTextItem().setTitle(Q_LEADER).setHelpText('As it shows in game.').setRequired(true);
  form.addMultipleChoiceItem().setTitle(Q_SERVER).setChoiceValues(SERVERS).showOtherOption(true).setRequired(true);
  form.addMultipleChoiceItem().setTitle(Q_RESULT).setChoiceValues([ACCEPTED, DECLINED, KICKED]).setRequired(true);
  form.addListItem().setTitle(Q_CONTENT).setChoiceValues(CONTENT);
  form.addListItem().setTitle(Q_CLASS).setHelpText(`Leave it blank if you went as ${withArticle_(TRACK_CLASS)}.`)
      .setChoiceValues([TRACK_CLASS].concat(CLASSES.filter(c => c !== TRACK_CLASS)));
  form.addParagraphTextItem().setTitle(Q_NOTES).setHelpText('Optional, e.g. "wants 3k CP" or "only took me for Transcendence".');
  const ss = SpreadsheetApp.create(`${FORM_TITLE} (responses)`);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  if (typeof form.setPublished === 'function') form.setPublished(true);  // newer forms start unpublished
  SpreadsheetApp.flush();
  try {  // drop the new spreadsheet's empty Sheet1, now that the responses have their own tab
    const book = SpreadsheetApp.openById(ss.getId());
    const sheets = book.getSheets();
    if (sheets.some(s => s.getFormUrl())) sheets.filter(s => !s.getFormUrl() && s.getLastRow() === 0).forEach(s => book.deleteSheet(s));
  } catch (e) {
    // harmless: it just keeps an empty tab
  }
  return form;
}

/** Every entry in the response sheet, rows typed in by hand included, oldest first. */
function readLog_(sheet) {
  const values = sheet.getDataRange().getValues();
  const head = (values.shift() || []).map(h => String(h).trim());
  const col = {leader: head.indexOf(Q_LEADER), server: head.indexOf(Q_SERVER), result: head.indexOf(Q_RESULT),
               content: head.indexOf(Q_CONTENT), cls: head.indexOf(Q_CLASS), notes: head.indexOf(Q_NOTES)};
  if (col.leader < 0 || col.result < 0) {
    throw new Error(`The response sheet has no "${Q_LEADER}" or "${Q_RESULT}" column. Rename the form's question back, or change it at the top of Code.gs.`);
  }
  const cell = (row, i) => i < 0 ? '' : String(row[i]).trim();
  return values.map(row => ({
    time: row[0] instanceof Date ? row[0].getTime() : Date.parse(row[0]) || 0,
    leader: cell(row, col.leader), server: cell(row, col.server), result: cell(row, col.result),
    content: cell(row, col.content), cls: cell(row, col.cls), notes: cell(row, col.notes),
  })).sort((a, b) => a.time - b.time);
}


// --- the tally -------------------------------------------------------------------------

/** One record per leader (same server and name, ignoring case): how often they took or turned down a TRACK_CLASS. */
function tally_(entries) {
  const leaders = {};
  for (const e of entries) {
    const name = e.leader.replace(/^@/, '').replace(/\s+/g, ' ').trim();
    const kind = resultKind_(e.result);
    if (!name || !kind) continue;
    if (e.cls && e.cls.toLowerCase() !== TRACK_CLASS.toLowerCase()) continue;
    const {server, faction} = serverOf_(e.server);
    const key = `${server}|${name}`.toLowerCase();
    const l = leaders[key] || (leaders[key] = {name, server, faction, yes: 0, no: 0, kick: 0, content: {}, lastYes: 0, note: ''});
    l.name = name;  // the latest spelling
    l[kind]++;
    if (kind === 'yes') {
      l.lastYes = Math.max(l.lastYes, e.time);
      if (e.content) l.content[e.content] = (l.content[e.content] || 0) + 1;
    }
    if (e.notes) l.note = e.notes;
  }
  return Object.values(leaders);
}

/** 'yes', 'no' or 'kick' from the form's answer, or from looser wording typed into the sheet by hand. */
function resultKind_(s) {
  if (/kick/i.test(s)) return 'kick';
  if (/turn|declin|reject|denied|\bno\b/i.test(s)) return 'no';
  if (/took|accept|invit|\byes\b/i.test(s)) return 'yes';
  return null;
}

/** "Siel (Elyos)" -> {server: 'Siel', faction: 'Elyos'}; a typed-in name gets its faction from SERVERS. */
function serverOf_(s) {
  const m = /^(.*?)\s*\((Elyos|Asmodian)\)\s*$/i.exec(s);
  const server = (m ? m[1] : s).trim();
  if (!server) return {server: 'Unknown server', faction: ''};
  const known = SERVERS.find(x => x.toLowerCase().startsWith(server.toLowerCase() + ' ('));
  const name = known ? known.split(' (')[0] : server.charAt(0).toUpperCase() + server.slice(1);
  const faction = known ? /\((\w+)\)/.exec(known)[1] : m ? m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase() : '';
  return {server: name, faction};
}

/** Most takes first, then the best yes rate, then whoever took one most recently. */
function byRecord_(a, b) {
  const rate = l => l.yes / (l.yes + l.no + l.kick);
  return b.yes - a.yes || rate(b) - rate(a) || b.lastYes - a.lastYes;
}


// --- the board -------------------------------------------------------------------------

/** The board's embeds: a header, then one card per server with the leaders who took a TRACK_CLASS. */
function buildBoard_(leaders, formUrl, now) {
  const takers = leaders.filter(l => l.yes > 0).sort(byRecord_);
  const byServer = {};
  for (const l of takers) (byServer[l.server] = byServer[l.server] || []).push(l);
  const servers = Object.keys(byServer).sort((a, b) => byServer[b].length - byServer[a].length || a.localeCompare(b));
  const shown = servers.slice(0, MAX_SERVERS);

  const cards = shown.map(server => {
    const list = byServer[server];
    const faction = list[0].faction;
    return {server, faction, count: list.length, lines: list.map(leaderLine_), hidden: 0};
  });
  const header = boardHeader_(leaders, takers, servers.length - shown.length, formUrl, now);
  const render = () => [header].concat(cards.map(serverCard_));

  // Fit Discord's limits: drop leaders off the end of the longest card until everything fits.
  let embeds = render();
  while (embedChars_(embeds) > MAX_CHARS || cards.some(c => serverCard_(c).description.length > MAX_DESC)) {
    const longest = cards.filter(c => c.lines.length > 1).sort((a, b) => serverCard_(b).description.length - serverCard_(a).description.length)[0];
    if (!longest) break;
    longest.lines.pop();
    longest.hidden++;
    embeds = render();
  }
  return embeds;
}

function boardHeader_(leaders, takers, moreServers, formUrl, now) {
  const total = {yes: 0, no: 0, kick: 0};
  for (const l of leaders) for (const k in total) total[k] += l[k];
  const tries = total.yes + total.no + total.kick;
  const lines = [];
  if (!tries) {
    lines.push(`Nothing logged yet. After you apply to a party as ${withArticle_(TRACK_CLASS)}, fill in the form, ` +
               'whether they took you or not.');
  } else {
    lines.push(`**${takers.length}** ${plural_(takers.length, 'leader')} have taken ${withArticle_(TRACK_CLASS)}.`);
    lines.push(`${tries} ${plural_(tries, 'application')} logged: ${Math.round(100 * total.yes / tries)}% got in ` +
               `(✅ ${total.yes} took · ❌ ${total.no} turned down · 👢 ${total.kick} kicked).`);
    if (moreServers) lines.push(`Plus ${moreServers} more ${plural_(moreServers, 'server')} that don't fit here.`);
    lines.push('', '✅ took · ❌ turned down · 👢 kicked after joining · then the content and when they last took one.');
  }
  if (formUrl) lines.push('', `**[📝 Log a party](${formUrl})**`);
  return {title: `🗡️ Aion 2 leaders who take ${TRACK_CLASS}s`, color: HEADER_COLOUR, description: lines.join('\n'),
          footer: {text: 'Updated'}, timestamp: new Date(now).toISOString()};
}

function serverCard_(c) {
  const title = `${FACTION_ICONS[c.faction] || '🌐'} ${c.server}${c.faction ? ' · ' + c.faction : ''} · ` +
                `${c.count} ${plural_(c.count, 'leader')}`;
  const description = c.lines.join('\n') + (c.hidden ? `\n…and ${c.hidden} more` : '');
  return {title, color: FACTION_COLOURS[c.faction] || OTHER_COLOUR, description};
}

/** "`Name` ✅ 3 ❌ 1 · Expedition, Nightmare · 2 days ago", then the latest note on its own line. */
function leaderLine_(l) {
  const record = [`✅ ${l.yes}`];
  if (l.no) record.push(`❌ ${l.no}`);
  if (l.kick) record.push(`👢 ${l.kick}`);
  const parts = [`\`${l.name.replace(/`/g, "'")}\` ${record.join(' ')}`];
  const content = Object.keys(l.content).sort((a, b) => l.content[b] - l.content[a]);
  if (content.length) parts.push(content.join(', '));
  if (l.lastYes) parts.push(`<t:${Math.floor(l.lastYes / 1000)}:R>`);
  let line = parts.join(' · ');
  if (l.note) line += `\n↳ *${escapeMarkdown_(truncate_(l.note.replace(/\s+/g, ' '), NOTE_CHARS))}*`;
  return line;
}

function embedChars_(embeds) {
  let n = 0;
  for (const e of embeds) n += (e.title || '').length + (e.description || '').length + ((e.footer && e.footer.text) || '').length;
  return n;
}

function escapeMarkdown_(s) {
  return s.replace(/([\\*_~`|>\[\]()<@#])/g, '\\$1');
}

function truncate_(s, n) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

function plural_(n, word) {
  return n === 1 ? word : word + 's';
}

function withArticle_(word) {
  return (/^[aeiou]/i.test(word) ? 'an ' : 'a ') + word;
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

/** Edits the board in place, or posts it if there isn't one yet (or someone deleted it). */
function postBoard_(props, embeds) {
  const pk = 'board:' + webhookBase_().split('/webhooks/')[1].split('/')[0];
  const body = {content: '', embeds, allowed_mentions: {parse: []}};
  const id = props.getProperty(pk);
  if (id && discord_('patch', `/messages/${id}`, body)) return;
  const message = discord_('post', '', Object.assign({username: BOT_NAME}, body));
  props.setProperty(pk, message.id);
}

function discord_(method, path, payload) {
  const url = webhookBase_() + path + (method === 'post' ? '?wait=true' : '');
  const options = {method, contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true};
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
      if (!limit) throw new Error('Discord is briefly blocking Google\'s servers (Cloudflare 1015)');
      Utilities.sleep(Math.min(Number(limit.retry_after) || 1, 10) * 1000 + 250);
      continue;
    }
    if (code >= 200 && code < 300) return code === 204 ? null : JSON.parse(r.getContentText());
    if (code === 404 && method !== 'post') return null;  // someone deleted the board; it gets posted again
    if (code === 401 || (code === 404 && method === 'post')) throw new Error('Discord doesn\'t know that webhook: copy its URL again.');
    throw new Error(`Discord ${method} failed, HTTP ${code}: ${r.getContentText().slice(0, 300)}`);
  }
  throw new Error('Discord kept rate limiting');
}

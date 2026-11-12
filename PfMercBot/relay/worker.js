// pf-mercs-relay: passes the PF Merc board's Discord bot requests on to Discord. Discord turns bot
// requests from Google's servers away ("internal network error", code 40333), so the Apps Script sends
// them here instead. Only the PF Mercs bot's own token, and only these few requests on #pf-mercs, get
// through: the bot sign-in check, reading the channel's latest messages, and the 🛑 switch.

const BOT_ID = '1570476999628030112';  // the PF Mercs app; a bot token starts with its id in base64
const CHANNEL = '1563652844240896081';  // #pf-mercs in The Disciples
const STOP = '%F0%9F%9B%91';  // 🛑
const ALLOWED = [
  ['GET', new RegExp('^/api/v10/users/@me$')],
  ['GET', new RegExp(`^/api/v10/channels/${CHANNEL}/messages\\?limit=100$`)],
  ['GET', new RegExp(`^/api/v10/channels/${CHANNEL}/messages/\\d+/reactions/${STOP}\\?limit=100$`)],
  ['PUT', new RegExp(`^/api/v10/channels/${CHANNEL}/messages/\\d+/reactions/${STOP}/@me$`)],
];

function tokenBotId(auth) {
  const first = auth.replace(/^Bot /, '').split('.')[0] || '';
  try {
    return atob(first.replace(/-/g, '+').replace(/_/g, '/'));
  } catch (e) {
    return '';
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname + url.search;
    const auth = request.headers.get('Authorization') || '';
    if (!ALLOWED.some(([method, re]) => method === request.method && re.test(path)) || tokenBotId(auth) !== BOT_ID) {
      return new Response('{"message": "not allowed"}', {status: 403, headers: {'Content-Type': 'application/json'}});
    }
    const reply = await fetch('https://discord.com' + path, {
      method: request.method,
      headers: {Authorization: auth, 'User-Agent': 'DiscordBot (https://pf-mercs-relay.workers.dev, 1.0)'},
    });
    return new Response(reply.body, {status: reply.status, headers: {'Content-Type': reply.headers.get('Content-Type') || 'application/json'}});
  },
};

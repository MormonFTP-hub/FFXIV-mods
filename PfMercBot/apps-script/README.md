# PF Merc Board on Google's servers (free, no PC needed)

`Code.gs` keeps **one live message** in a Discord channel that lists every NA Party Finder party
paying gil for mercs. It runs on Google's servers (Google Apps Script) every minute for free, with
no credit card, so your PC can be off. It posts through a channel **webhook**, so there's no bot
account. It never pings anyone except the one person set in `PING_USER_ID` (see below).

What the board shows:

- **Title card** (with the gil coin): how many parties are paying, the best offer, and a count
  per data center.
- **One card per fight**, biggest first, in its own colour with the duty's banner art. The fights
  in `PIN_TO_BOTTOM` always go last: Dragonsong's Reprise second to last, The Omega Protocol at the
  very bottom. Each party on a card shows:
  - pay, fill (e.g. 6/8), data center, the leader's prog ("📈 P5 · 18.97%" or "✅ Cleared ×3",
    only with `USE_FFLOGS` on), and 🆕 for the first 10 minutes;
  - the listing text, the open roles, and how long ago it was first spotted;
  - a copyable `/tell Name@World`, and the leader's **Tomestone** and **FFLogs** pages as big
    links on their own line. Those are plain links and use no FFLogs API points.
- **Under the board**, a one-line countdown to the next refresh ("Next refresh in 42 seconds") and
  the time of the last one.
- Parties leave the board once their listing is taken down or fills (see below). Both messages are
  edited in place, and edits never notify anyone.
- **Pings:** when a party on a `PING_FIGHTS` fight (DSR or TOP) offers more than
  `PING_OVER_MILLIONS` (5M), a short message under the board @-mentions `PING_USER_ID`, and only
  them. It shows the pay, fight, data center, fill, listing text and `/tell`. Each party is pinged
  once, and the message is deleted when the party leaves the board.

It catches the same listings as the PC bot (same rules as `../pf.py`).

## Setup (about 5 minutes)

1. **Make a webhook in Discord.** Hover the channel, click the gear (Edit Channel), then
   **Integrations > Webhooks > New Webhook > Copy Webhook URL**.
2. **Make the script.** Go to <https://script.google.com>, click **New project**, and name it.
3. **Paste the code.** Replace everything in `Code.gs` with all of [`Code.gs`](Code.gs) from this folder.
4. **Paste your webhook URL.** Near the top, double-click `PASTE_WEBHOOK_URL_HERE` to select it,
   paste the URL over it, then press **Ctrl+S**.
5. **Run `setup` once** and allow it on Google's permission screen. It needs exactly two permissions:
   "connect to an external service" (xivpf, Discord, XIVAPI, Lodestone) and "run when you are not
   present" (the every-minute check). Google calls it unverified only because it's your own script.

## Changing settings

Edit the lines at the top of `Code.gs` and save. The next check uses them.

| Setting | What it does |
|---|---|
| `MIN_PAY_MILLIONS` | Only list parties offering at least this much, e.g. `5` = 5M. `0` = every merc listing. |
| `DATA_CENTRES` | Delete any NA data centers you don't care about. |
| `PIN_TO_BOTTOM` | Fights that always go at the bottom of the board, in this order (the last is the very bottom). |
| `PING_USER_ID` | The Discord user to @-mention about big offers (in Discord: right-click your name > Copy User ID; needs Developer Mode on). `''` turns pings off. |
| `PING_FIGHTS` / `PING_OVER_MILLIONS` | Which fights ping, and the pay they have to beat (more than this many millions). |
| `DISCORD_BOT_TOKEN` | Optional. Lets the board move back to the bottom when people type in the channel (see below). |
| `FFLOGS_CLIENT_ID` / `FFLOGS_CLIENT_SECRET` | Optional. With these and `USE_FFLOGS`, each leader gets their best pull on that fight, e.g. "📈 P5 · 23.44%" or "✅ Cleared ×3". |
| `USE_FFLOGS` | `false` (now) = no FFLogs lookups at all, so those keys' API points stay free for other things. `true` turns prog back on. |

### Keeping the board at the bottom

When people chat in the channel, the board ends up above their messages. A webhook can only post,
not read the channel, so moving the board back down needs a small Discord bot that only reads:

1. Open <https://discord.com/developers/applications>, click **New Application**, name it (e.g.
   "PF Mercs") and create it.
2. Open **Bot**, click **Reset Token** and copy the token. Paste it over `PASTE_BOT_TOKEN_HERE`
   near the top of `Code.gs`, then save.
3. Invite the bot to your server. Open **OAuth2 > URL Generator**, tick `bot`, then tick
   **View Channels** and **Read Message History**. Open the link at the bottom, pick the server,
   and authorize it. It needs no other permissions, and no privileged intents.
4. Run `testDiscordBot` from the function dropdown. It should say the bot can read the channel.

From then on, a check that finds a message posted after the countdown deletes the board, pings and
countdown and posts them again below it. It also deletes any other message the webhook posted that's
out of date: old boards and countdowns, stray pings, and the one-per-party alerts from the first
version. Other people's messages are never touched.

Even without the bot, each check keeps the board, then the pings, then the countdown in that order,
and saves after every message it posts, so a check that fails halfway doesn't lose track of one. Moved pings show the mention but don't ping again. Each
move is a new message, so people with "All Messages" notifications for the channel get one when it
happens.

### Turning on FFLogs prog

It's off right now (`USE_FFLOGS = false`), because the lookups use up the FFLogs API key's points.
To turn it on:

1. Sign in at <https://www.fflogs.com> (a free account works) and open <https://www.fflogs.com/api/clients/>.
2. Click **Create Client**. Use any name (e.g. "PF Merc Board") and `https://localhost` as the
   redirect URL, and leave "public client" unticked.
3. Copy the **Client ID** over `PASTE_FFLOGS_CLIENT_ID` and the **Client Secret** over
   `PASTE_FFLOGS_CLIENT_SECRET` near the top of `Code.gs`, set `USE_FFLOGS` to `true`, then save.
   The next check uses them.

How prog is worked out, to match Tomestone:

- It reads the leader's 75 most recent public FFLogs reports (3 pages of 25).
- A report holds every pull its logger saw, including other parties' pulls from the same session.
  Only pulls the leader was actually in count.
- "✅ Cleared" means they have a ranked kill, or a kill in one of those pulls. Otherwise it shows
  their furthest pull: the latest phase reached, then the least boss HP left in it.
- Leaders who don't log, or whose logs are private, show "📈 no logs". FFLogs doesn't track some
  fights (or "no duty" listings), and those show nothing.

Prog is looked up for two new leaders per check, best offers first, and cached for 6 hours. FFLogs'
free API allows 3600 points an hour, and a leader costs about 50–150. If it runs out, the board keeps
the prog it has and tries again 10 minutes later.

From the toolbar's function dropdown:
- `stop` turns the checks off (run `setup` to turn them back on).
- `showMercsNow` logs what counts as a merc listing right now, and what got skipped and why.
- `diagnoseProg` logs the board's ultimate leaders with their prog and pulls per phase, to compare
  with Tomestone.
- `testDiscordBot` checks the bot token, and whether the bot can read the channel.

## How it works, and its limits

- The listings come from xivpf.com, which only sees a data center's Party Finder once someone running
  the Remote Party Finder Dalamud plugin opens it there. Listings can show up a few minutes late or
  get missed.
- **Taken-down parties:** xivpf keeps showing a listing until its timer runs out, even after it
  fills or is taken down. Each time someone with the plugin opens the Party Finder, every listing
  still up gets re-seen. So a listing that hasn't been re-seen for 6 minutes, while the rest of its
  data center and category has, is treated as gone and leaves the board. A relisted party keeps its
  spot.
- Discord can't load images from XIVAPI, so the banners and the gil coin are uploaded with the board.
  Discord only shows previews for pictures uploaded with a message or edit, so:
  - the cards (and their pictures) are re-sent only when the board actually changes;
  - the every-minute countdown edit only touches the message text.
  Pictures are cached on Google's side for 6 hours.
- **Tomestone:** the script can't read prog off tomestone.gg. Tomestone shows scripts an "are you
  a human" check, and the script doesn't get around that. Instead each leader gets a link to their
  Tomestone page (looked up on the official Lodestone, a few new leaders per check) and an FFLogs
  link. The prog numbers themselves come from FFLogs' official API (see above).
- Discord sits behind Cloudflare, which now and then briefly blocks Google's shared servers
  ("error 1015"). When that happens the board skips that minute and updates on the next one.
- Google gives free accounts 90 minutes of script runtime a day. A check takes about 3 seconds
  (a few more when it looks up new leaders' prog). If the script gets close to the limit it spaces
  out checks, and the countdown shows when the next check will really run.
- Anyone with the webhook URL can post in that channel, and anyone with the bot token can read your
  server's channels the bot can see. Don't share the script with either pasted in.

# Aion 2 Assassin Board

`Code.gs` keeps **one live message** in a Discord channel listing the Aion 2 party leaders who have
taken an Assassin, per server, with how often they said yes and no. It's the Aion 2 sibling of the
[PF Merc Board](../PfMercBot/apps-script/README.md). It runs on Google's servers (Google Apps Script)
for free, so your PC can be off. It posts through a channel **webhook**, so there's no bot account, and
it never pings anyone.

## Where the names come from

Aion 2's party finder only exists inside the game, and nothing publishes it the way xivpf does for
FFXIV. The two fan party finders (aion2timers.com and aion2lobby.com) are nearly empty, and
aion2timers forbids reading its API. Reading the game's network traffic or memory would risk your
account under NCSOFT's rules, so the board doesn't do that either.

Instead, `setup` makes a **Google Form** with six quick questions. After each party you apply to, open
it on your phone and log the leader's name, server, and whether they took you. Everyone you share the
form with adds to the same list. With `SHOW_FORM_LINK` on (the default), the link is on the board
itself, so anyone in the channel can log a party. Other Assassins are the fastest way to grow the list.

## What the board shows

- **Header:** how many leaders have taken an Assassin, how many applications were logged and what
  share got in, and a **📝 Log a party** link to the form.
- **One card per server** (☀️ Elyos, 🌙 Asmodian), the busiest first. Each leader who has taken an
  Assassin at least once gets a line:
  `` `Name` ✅ 3 ❌ 1 👢 1 · Expedition, Nightmare · 2 days ago ``
  - ✅ took you, ❌ turned you down, 👢 kicked you after you joined;
  - what they took an Assassin for, most often first;
  - when they last took one (Discord keeps "2 days ago" current by itself);
  - the latest note anyone left about them, e.g. *wants 3k CP*.
  Leaders are sorted by most takes, then best yes rate, then most recent.
- Leaders who have only ever turned an Assassin down stay off the board. They're still counted in the
  header and kept in the sheet, and `showTally` lists them.
- The message is edited in place a few seconds after each entry. Edits don't notify anyone.
- Discord fits 9 server cards and about 6000 characters in one message. When the board outgrows that,
  the longest cards end with "…and 12 more" and the header counts the servers left out.

Only entries for `TRACK_CLASS` (Assassin) count. The form's "You applied as" question defaults to it
when left blank, so friends on other classes can use the same form without skewing the board.

## Setup (about 5 minutes)

Use whichever Google account you want the form and sheet to live in. It doesn't have to be the one
running the PF Merc Board.

1. **Make a webhook in Discord.** Hover the channel, click the gear (Edit Channel), then
   **Integrations > Webhooks > New Webhook > Copy Webhook URL**.
2. **Make the script.** Go to <https://script.google.com> (check the account picture in the top right),
   click **New project**, and name it, e.g. "Aion 2 Assassin Board".
3. **Paste the code.** Replace everything in `Code.gs` with all of [`Code.gs`](Code.gs) from this folder.
4. **Paste your webhook URL.** Near the top, double-click `PASTE_WEBHOOK_URL_HERE` to select it,
   paste the URL over it, then press **Ctrl+S**.
5. **Run `setup` once** (pick it in the function dropdown, click **Run**) and allow it on Google's
   permission screen. It asks to manage forms and spreadsheets (for the form and its sheet), connect
   to an external service (Discord), and run when you're not there (the update after each entry).
   Google calls it unverified only because it's your own script.
6. Open **Execution log**. It prints the **form link** (bookmark it on your phone) and the **sheet link**.
   The board is now in your channel.

## Using it

- **Log every application**, not just the good ones. The ❌ counts and the header's "got in" rate only
  mean something if the turn-downs are logged too.
- **Fix mistakes in the sheet.** Edit a name or delete a row, and the board updates within a few
  seconds. You can also type rows in by hand: "accepted", "declined" and "kicked" work in the
  "What happened?" column.
- The same leader is matched by server and name, ignoring capitals, so "kaelith" and "Kaelith" on Siel
  are one line. The board shows the latest spelling.
- **Make friends of the leaders on the board.** Someone who took you once usually will again. Whisper
  them before they post.

## Changing settings

Edit the lines at the top of `Code.gs` and save. Run `refresh` to see the change right away.

| Setting | What it does |
|---|---|
| `WEBHOOK_URL` | The Discord channel webhook the board posts through. A new webhook gets a new board. |
| `TRACK_CLASS` | The class the board is about. Entries for other classes are ignored. |
| `SERVERS` | The form's server choices (NA East, which includes every NA West server). The form also takes any other name. This only applies to a form made after the change. |
| `SHOW_FORM_LINK` | `true` puts the form's link on the board for everyone in the channel. `false` keeps it to you. |

From the toolbar's function dropdown:
- `refresh` rebuilds the board now and shows any error.
- `showTally` logs every leader in the sheet with their record, including those not on the board.
- `stop` turns updates off. Run `setup` to turn them back on; it keeps the same form and sheet.

## Limits

- The board only knows what gets logged. A leader nobody has applied to isn't on it.
- Anyone with the form link can log a party, so a joke entry is possible. Delete its row in the sheet.
- Discord sits behind Cloudflare, which now and then briefly blocks Google's shared servers. A failed
  update tries again every 2 minutes, up to 5 times, and the next entry updates the board anyway.
- Anyone with the webhook URL can post in that channel. Don't share the script with it pasted in.

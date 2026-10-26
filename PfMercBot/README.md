# PF Merc Bot

A Discord bot that watches the NA Party Finder (Aether, Crystal, Dynamis, Primal) around the clock
and pings your channel whenever someone posts a listing that pays gil for mercs, like
"10m p5 / 20m clear", "1m/hour regen fill" or "will pay 2 mil a pop".

Each alert shows the duty, the listing text, the pay, the data center, open slots and a ready-to-copy
`/tell Name@World`. The message updates as the party fills and greys out when the listing is gone.
If the recruiter reposts the same party, the old alert comes back instead of a second ping.

There are two ways to run it:

- **On Google's servers, free (recommended):** [`apps-script/`](apps-script/README.md). Your PC can be
  off, and it uses a channel webhook, so you don't need a bot account. Settings live at the top of the
  script instead of in slash commands.
- **On your PC:** the Python bot described below. It has slash commands (`/merc ...`, `/mercs`) but
  only runs while your PC is on.

Both use the same detection rules (`pf.py` and `apps-script/Code.gs`). Keep them in sync when tuning.

## PC bot setup (one time, ~3 minutes)

1. **Create the bot.** Go to <https://discord.com/developers/applications>, click **New Application**,
   and give it a name (e.g. "PF Mercs"). Open the **Bot** tab, click **Reset Token**, and copy the token.
   You don't need to turn on any of the "Privileged Gateway Intents".
2. **Paste the token.** Open `.env` in this folder and replace `paste-your-bot-token-here` with the
   token. Don't share this file.
3. **Invite it to your server.** On the app's **General Information** tab, copy the **Application ID**,
   then open this link with your ID in place of `APP_ID`:

   `https://discord.com/oauth2/authorize?client_id=APP_ID&scope=bot+applications.commands&permissions=150528`

   That grants View Channels, Send Messages, Embed Links and Mention @everyone/@here/roles (the last
   one is needed for the ping to notify anyone). The bot also prints this link when it starts.
4. **Start it.** Double-click `run_bot.bat`. The first run sets up Python packages. Leave the window
   open. The bot runs only while this window is open.
5. **Pick the channel.** In Discord, go to the channel you want and type `/merc here`.
   Current merc listings get posted right away, and new ones follow as they appear.

## Commands

| Command | What it does |
|---|---|
| `/merc here [ping] [role]` | Post alerts in this channel. Pings @here by default. `ping:` can be @everyone or nobody, and `role:` pings a role instead. |
| `/merc minpay <millions>` | Only alert when the listing offers at least this much, e.g. `5` = 5M. `0` = everything. |
| `/merc datacenter <dc>` | Watch all of NA (default) or just Aether / Crystal / Dynamis / Primal. |
| `/merc status` | Settings, when xivpf was last read, and any error. |
| `/merc stop` | Turn alerts off in this server. |
| `/mercs` | Anyone can use this to see every NA merc listing up right now (only they see the reply). |

The `/merc` commands need **Manage Server** by default. You can change who gets them under
Server Settings > Integrations.

## How it works

- Every 60 seconds it reads <https://xivpf.com/listings>. That site gets PF listings from players
  running the *Remote Party Finder* Dalamud plugin. A listing shows up there once someone with the
  plugin opens the Party Finder on that data center. NA is well covered but not perfectly, so some
  listings can show up a few minutes late or get missed.
- A listing counts as a merc job when it mentions mercs, or offers a gil amount ("5m", "2 mil",
  "500k") with paying words or with a phase/clear/hour ("for p6", "20m clear", "1m/hour").
  These get skipped: sellers (WTS, selling, carry services, buyers), venues/raffles/gamba/prize
  events, item WTBs, loot-master farms where *you* pay per drop, and 100M+ clear prices with no
  "paying" (those are sales).
- The rules are the regexes near the top of the "merc detection" section in `pf.py`. To see what the
  bot would catch right now, and what it skipped and why, run:

  ```bat
  .venv\Scripts\python pf.py --rejects
  ```

## Files

- `merc_bot.py`: the Discord bot (polling, alerts, slash commands)
- `pf.py`: xivpf page parser and merc detection; runs on its own for testing
- `.env`: your bot token (private)
- `state.json`: per-server settings and posted alerts, so restarts don't re-ping (created automatically)
- `bot.log`: log file, useful if it ever stops alerting

## Run it at Windows login

Press Win+R, type `shell:startup`, and put a shortcut to `run_bot.bat` in that folder.

"""Discord bot that pings a channel when an NA Party Finder listing is paying gil for mercs.

Setup is in README.md. Start it with run_bot.bat (or: .venv\\Scripts\\python merc_bot.py).
"""
from __future__ import annotations

import asyncio
import dataclasses
import json
import logging
import logging.handlers
import os
import sys
import time
from pathlib import Path

import aiohttp
import discord
from discord import app_commands
from discord.app_commands import Choice
from discord.ext import tasks

import pf

ROOT = Path(__file__).resolve().parent
STATE_FILE = ROOT / "state.json"
ENV_FILE = ROOT / ".env"
LOG_FILE = ROOT / "bot.log"

POLL_SECONDS = 60
GONE_AFTER_MISSES = 2          # xivpf sometimes drops a listing for one refresh; don't flap
REMEMBER_SECONDS = 3 * 3600    # a relist within this window revives the old alert instead of pinging again
USER_AGENT = "PfMercBot/1.0 (FFXIV party finder merc alerts for a private Discord)"
INVITE_PERMISSIONS = discord.Permissions(
    view_channel=True, send_messages=True, embed_links=True, mention_everyone=True)

GOLD = 0xF1C40F
GREY = 0x747F8D
ROLE_ICONS = {"tank": "\N{SHIELD}️", "healer": "\N{GREEN HEART}", "dps": "\N{CROSSED SWORDS}️",
              "flex": "\N{TWISTED RIGHTWARDS ARROWS}", "any": "\N{WHITE QUESTION MARK ORNAMENT}"}

log = logging.getLogger("pfmerc")


# --- persistent state -------------------------------------------------------------

def default_guild_config() -> dict:
    return {"channel_id": None, "ping": "here", "role_id": None,
            "data_centres": list(pf.NA_DATA_CENTRES), "min_pay": 0}


class State:
    """state.json: per-server settings plus the alerts already posted (so restarts don't re-ping)."""

    def __init__(self, guilds: dict | None = None, alerts: dict | None = None):
        self.guilds: dict[str, dict] = guilds or {}
        self.alerts: dict[str, dict[str, dict]] = alerts or {}

    @classmethod
    def load(cls) -> "State":
        try:
            data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
            return cls(data.get("guilds"), data.get("alerts"))
        except FileNotFoundError:
            return cls()
        except (OSError, ValueError) as e:
            log.warning("Couldn't read %s (%s); starting fresh", STATE_FILE.name, e)
            return cls()

    def save(self) -> None:
        tmp = STATE_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps({"guilds": self.guilds, "alerts": self.alerts}, indent=1), encoding="utf-8")
        os.replace(tmp, STATE_FILE)

    def guild(self, guild_id: int) -> dict:
        cfg = self.guilds.setdefault(str(guild_id), default_guild_config())
        for k, v in default_guild_config().items():
            cfg.setdefault(k, v)
        return cfg


# --- message formatting -----------------------------------------------------------

def listing_from_snapshot(snapshot: dict) -> pf.Listing:
    names = {f.name for f in dataclasses.fields(pf.Listing)}
    return pf.Listing(**{k: v for k, v in snapshot.items() if k in names})


def tell_command(creator: str) -> str:
    return "/tell " + creator.replace(" @ ", "@")


def open_slots_text(l: pf.Listing) -> str:
    return "".join(ROLE_ICONS.get(s, "?") for s in l.open_slots)


def signature(l: pf.Listing) -> str:
    """What an alert shows; when it changes the message gets edited. Excludes the ticking timers."""
    return f"{l.filled}/{l.total}|{l.tags}|{l.description}|{','.join(l.open_slots)}"


def build_embed(l: pf.Listing, closed: bool = False) -> discord.Embed:
    esc = discord.utils.escape_markdown
    body = []
    if l.tags:
        body.append(f"**{esc(l.tags)}**")
    body.append(esc(l.description) if l.description else "*(no description)*")
    pay = pf.max_pay(l)
    e = discord.Embed(
        title=("\N{CROSS MARK} " if closed else "\N{MONEY BAG} ") + l.duty_display,
        url=pf.LISTINGS_URL,
        description="\n".join(body),
        color=GREY if closed else GOLD,
        timestamp=discord.utils.utcnow(),
    )
    e.add_field(name="Pay", value=f"up to **{pf.format_millions(pay)}**" if pay else "not stated", inline=True)
    e.add_field(name="Data Center", value=l.data_centre, inline=True)
    slots = open_slots_text(l)
    e.add_field(name="Party", value=f"{l.filled}/{l.total}" + (f"  open: {slots}" if slots and not closed else ""),
                inline=True)
    e.add_field(name="Recruiter", value=f"`{tell_command(l.creator)}`", inline=False)
    if closed:
        e.add_field(name="Status", value="Listing is gone (filled or taken down)", inline=False)
    e.set_footer(text=f"{l.category} \N{MIDDLE DOT} {'cross-world' if l.cross_world else 'local only'} "
                      f"\N{MIDDLE DOT} via xivpf.com \N{MIDDLE DOT} last checked")
    return e


def ping_parts(cfg: dict, l: pf.Listing) -> tuple[str, discord.AllowedMentions]:
    pay = pf.max_pay(l)
    line = f"\N{MONEY BAG} Merc party on **{l.data_centre}**: {l.duty_display}"
    if pay:
        line += f" \N{EM DASH} up to **{pf.format_millions(pay)}**"
    if cfg.get("role_id"):
        return (f"<@&{cfg['role_id']}> {line}",
                discord.AllowedMentions(everyone=False, users=False, roles=[discord.Object(cfg["role_id"])]))
    who = {"here": "@here ", "everyone": "@everyone "}.get(cfg.get("ping"), "")
    return who + line, discord.AllowedMentions(everyone=bool(who), users=False, roles=False)


# --- the bot ----------------------------------------------------------------------

class MercBot(discord.Client):
    def __init__(self) -> None:
        intents = discord.Intents.none()
        intents.guilds = True
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)
        self.state = State.load()
        self.http_session: aiohttp.ClientSession | None = None
        self.current: dict[str, pf.Listing] = {}   # NA merc listings from the last good poll, by key
        self.last_poll = 0.0
        self.last_error: str | None = None
        self.lock = asyncio.Lock()
        self._synced: set[int] = set()

    async def setup_hook(self) -> None:
        self.http_session = aiohttp.ClientSession(
            headers={"User-Agent": USER_AGENT}, timeout=aiohttp.ClientTimeout(total=45))
        self.tree.add_command(merc_group)
        self.tree.add_command(mercs_command)
        self.poll.start()

    async def close(self) -> None:
        self.poll.cancel()
        if self.http_session:
            await self.http_session.close()
        await super().close()

    async def on_ready(self) -> None:
        log.info("Logged in as %s, in %d server(s)", self.user, len(self.guilds))
        log.info("Invite link: %s", discord.utils.oauth_url(
            self.user.id, permissions=INVITE_PERMISSIONS, scopes=("bot", "applications.commands")))
        for guild in self.guilds:
            await self.sync_commands(guild)

    async def on_guild_join(self, guild: discord.Guild) -> None:
        log.info("Joined %s", guild.name)
        await self.sync_commands(guild)

    async def sync_commands(self, guild: discord.Guild) -> None:
        # Per-server sync shows the slash commands instantly (global sync can take a while).
        if guild.id in self._synced:
            return
        self.tree.copy_global_to(guild=guild)
        try:
            await self.tree.sync(guild=guild)
            self._synced.add(guild.id)
        except discord.HTTPException as e:
            log.warning("Couldn't register slash commands in %s: %s", guild.name, e)

    # polling

    @tasks.loop(seconds=POLL_SECONDS)
    async def poll(self) -> None:
        try:
            async with self.http_session.get(pf.LISTINGS_URL) as r:
                r.raise_for_status()
                html = await r.text()
            listings = await asyncio.to_thread(pf.parse_listings, html)
        except Exception as e:  # network trouble or xivpf down: try again next tick
            self.last_error = f"{type(e).__name__}: {e}"
            log.warning("xivpf fetch failed: %s", self.last_error)
            return
        if not listings:
            self.last_error = "xivpf returned no listings (site changed or empty?)"
            log.warning(self.last_error)
            return

        found: dict[str, pf.Listing] = {}
        for l in listings:
            if l.data_centre in pf.NA_DATA_CENTRES and l.key not in found and pf.is_merc(l):
                found[l.key] = l
        self.current, self.last_poll, self.last_error = found, time.time(), None
        log.info("Polled %d listings, %d NA merc", len(listings), len(found))

        async with self.lock:
            for gid, cfg in list(self.state.guilds.items()):
                if cfg.get("channel_id"):
                    try:
                        await self.update_guild(gid, cfg)
                    except Exception:
                        log.exception("Updating alerts for server %s failed", gid)
            self.state.save()

    @poll.before_loop
    async def before_poll(self) -> None:
        await self.wait_until_ready()

    def wanted_for(self, cfg: dict) -> dict[str, pf.Listing]:
        dcs = set(cfg.get("data_centres") or pf.NA_DATA_CENTRES)
        min_pay = cfg.get("min_pay") or 0
        return {k: l for k, l in self.current.items()
                if l.data_centre in dcs and (min_pay <= 0 or pf.max_pay(l) >= min_pay)}

    async def update_guild(self, gid: str, cfg: dict) -> None:
        channel = self.get_channel(cfg["channel_id"])
        if channel is None:
            log.warning("Alert channel %s for server %s not found", cfg["channel_id"], gid)
            return
        alerts = self.state.alerts.setdefault(gid, {})
        wanted = self.wanted_for(cfg)
        now = time.time()

        for key, l in wanted.items():
            sig = signature(l)
            a = alerts.get(key)
            if a and a["channel_id"] == channel.id:
                a["last_seen"], a["misses"] = now, 0
                if a.get("closed") or a.get("sig") != sig:
                    await self.edit_alert(a, build_embed(l))
                    a.update(closed=False, sig=sig, snapshot=dataclasses.asdict(l))
                continue
            content, mentions = ping_parts(cfg, l)
            try:
                msg = await channel.send(content=content, embed=build_embed(l), allowed_mentions=mentions)
            except discord.Forbidden:
                log.warning("No permission to post in #%s (server %s)", getattr(channel, "name", "?"), gid)
                return
            log.info("Alerted %s: %s", gid, key)
            alerts[key] = {"channel_id": channel.id, "message_id": msg.id, "last_seen": now, "misses": 0,
                           "closed": False, "sig": sig, "snapshot": dataclasses.asdict(l)}

        for key, a in list(alerts.items()):
            if key in wanted:
                continue
            if key in self.current:          # still listed, just outside the filters now
                a["last_seen"] = now
                continue
            if not a.get("closed"):
                a["misses"] = a.get("misses", 0) + 1
                if a["misses"] >= GONE_AFTER_MISSES:
                    await self.edit_alert(a, build_embed(listing_from_snapshot(a["snapshot"]), closed=True))
                    a["closed"] = True
            if now - a["last_seen"] > REMEMBER_SECONDS:
                del alerts[key]

    async def edit_alert(self, alert: dict, embed: discord.Embed) -> None:
        channel = self.get_channel(alert["channel_id"])
        if channel is None:
            return
        try:
            await channel.get_partial_message(alert["message_id"]).edit(embed=embed)
        except discord.NotFound:
            pass  # someone deleted the alert; fine
        except discord.HTTPException as e:
            log.warning("Couldn't edit alert %s: %s", alert["message_id"], e)


# --- slash commands -----------------------------------------------------------------

merc_group = app_commands.Group(
    name="merc", description="NA Party Finder merc alerts",
    guild_only=True, default_permissions=discord.Permissions(manage_guild=True))

PING_CHOICES = [Choice(name="@here", value="here"), Choice(name="@everyone", value="everyone"),
                Choice(name="Nobody (no ping)", value="none")]
DC_CHOICES = [Choice(name="All NA", value="all")] + [Choice(name=dc, value=dc) for dc in pf.NA_DATA_CENTRES]


def settings_text(cfg: dict) -> str:
    channel = f"<#{cfg['channel_id']}>" if cfg.get("channel_id") else "*off*"
    if cfg.get("role_id"):
        ping = f"<@&{cfg['role_id']}>"
    else:
        ping = {"here": "@here", "everyone": "@everyone"}.get(cfg.get("ping"), "nobody")
    dcs = cfg.get("data_centres") or pf.NA_DATA_CENTRES
    dcs_text = "all NA" if set(dcs) == set(pf.NA_DATA_CENTRES) else ", ".join(dcs)
    min_pay = cfg.get("min_pay") or 0
    return (f"Channel: {channel}\nPing: {ping}\nData centers: {dcs_text}\n"
            f"Minimum pay: {pf.format_millions(min_pay) if min_pay else 'any (including unstated)'}")


async def apply_now(bot: MercBot, guild_id: int) -> None:
    """Post current matches right away instead of waiting for the next poll."""
    async with bot.lock:
        cfg = bot.state.guild(guild_id)
        if cfg.get("channel_id") and bot.last_poll:
            await bot.update_guild(str(guild_id), cfg)
        bot.state.save()


@merc_group.command(name="here", description="Post merc alerts in this channel")
@app_commands.describe(ping="Who to ping for each new merc listing (default @here)",
                       role="Ping this role instead of @here")
@app_commands.choices(ping=PING_CHOICES)
async def merc_here(interaction: discord.Interaction, ping: Choice[str] | None = None,
                    role: discord.Role | None = None) -> None:
    bot: MercBot = interaction.client  # type: ignore[assignment]
    perms = interaction.channel.permissions_for(interaction.guild.me)
    missing = [p for p in ("view_channel", "send_messages", "embed_links") if not getattr(perms, p)]
    if missing:
        await interaction.response.send_message(
            f"I can't post in this channel. Missing permission(s): {', '.join(missing)}", ephemeral=True)
        return
    cfg = bot.state.guild(interaction.guild_id)
    cfg["channel_id"] = interaction.channel_id
    if role:
        cfg["role_id"] = role.id
    elif ping:
        cfg["ping"], cfg["role_id"] = ping.value, None
    bot.state.save()
    note = ""
    if (cfg.get("role_id") or cfg["ping"] != "none") and not perms.mention_everyone \
            and not (role and role.mentionable):
        note = "\n\n\N{WARNING SIGN} I don't have **Mention @everyone, @here and All Roles** here, so pings won't notify anyone."
    await interaction.response.send_message(
        f"Merc alerts will post here.\n{settings_text(cfg)}\n\nI check xivpf.com every {POLL_SECONDS}s.{note}")
    await apply_now(bot, interaction.guild_id)


@merc_group.command(name="stop", description="Stop posting merc alerts in this server")
async def merc_stop(interaction: discord.Interaction) -> None:
    bot: MercBot = interaction.client  # type: ignore[assignment]
    bot.state.guild(interaction.guild_id)["channel_id"] = None
    bot.state.save()
    await interaction.response.send_message("Merc alerts stopped. Use `/merc here` to turn them back on.")


@merc_group.command(name="minpay", description="Only alert when the listing offers at least this much")
@app_commands.describe(millions="Minimum gil in millions (0 = alert on every merc listing)")
async def merc_minpay(interaction: discord.Interaction,
                     millions: app_commands.Range[float, 0, 100000]) -> None:
    bot: MercBot = interaction.client  # type: ignore[assignment]
    cfg = bot.state.guild(interaction.guild_id)
    cfg["min_pay"] = millions
    bot.state.save()
    await interaction.response.send_message(settings_text(cfg))
    await apply_now(bot, interaction.guild_id)


@merc_group.command(name="datacenter", description="Which NA data center(s) to watch")
@app_commands.choices(dc=DC_CHOICES)
async def merc_datacenter(interaction: discord.Interaction, dc: Choice[str]) -> None:
    bot: MercBot = interaction.client  # type: ignore[assignment]
    cfg = bot.state.guild(interaction.guild_id)
    cfg["data_centres"] = list(pf.NA_DATA_CENTRES) if dc.value == "all" else [dc.value]
    bot.state.save()
    await interaction.response.send_message(settings_text(cfg))
    await apply_now(bot, interaction.guild_id)


@merc_group.command(name="status", description="Show settings and whether xivpf is being read OK")
async def merc_status(interaction: discord.Interaction) -> None:
    bot: MercBot = interaction.client  # type: ignore[assignment]
    cfg = bot.state.guild(interaction.guild_id)
    if bot.last_poll:
        health = f"Last good check <t:{int(bot.last_poll)}:R>, {len(bot.current)} NA merc listing(s) up, " \
                 f"{len(bot.wanted_for(cfg))} match your filters."
    else:
        health = "Haven't read xivpf successfully yet."
    if bot.last_error:
        health += f"\nLast error: `{bot.last_error[:300]}`"
    await interaction.response.send_message(f"{settings_text(cfg)}\n\n{health}", ephemeral=True)


@app_commands.command(name="mercs", description="List NA Party Finder listings paying for mercs right now")
@app_commands.guild_only()
async def mercs_command(interaction: discord.Interaction) -> None:
    bot: MercBot = interaction.client  # type: ignore[assignment]
    if not bot.last_poll:
        await interaction.response.send_message("Still loading the Party Finder, try again in a minute.",
                                                ephemeral=True)
        return
    listings = sorted(bot.current.values(), key=pf.max_pay, reverse=True)
    if not listings:
        await interaction.response.send_message("No merc listings on NA right now.", ephemeral=True)
        return
    e = discord.Embed(title=f"\N{MONEY BAG} {len(listings)} NA merc listing(s)", url=pf.LISTINGS_URL, color=GOLD)
    for l in listings[:25]:
        pay = pf.max_pay(l)
        e.add_field(
            name=f"{l.duty_display} \N{MIDDLE DOT} {l.data_centre}"
                 + (f" \N{MIDDLE DOT} {pf.format_millions(pay)}" if pay else ""),
            value=f"{discord.utils.escape_markdown(l.description)[:300] or '*(no description)*'}\n"
                  f"{l.filled}/{l.total} \N{MIDDLE DOT} `{tell_command(l.creator)}`",
            inline=False)
    await interaction.response.send_message(embed=e, ephemeral=True)


# --- startup ------------------------------------------------------------------------

def load_token() -> str | None:
    token = os.environ.get("DISCORD_TOKEN")
    if not token and ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8-sig").splitlines():
            k, _, v = line.partition("=")
            if k.strip() == "DISCORD_TOKEN":
                token = v.strip().strip('"').strip("'")
    if not token or token.startswith("paste-"):
        return None
    return token


def main() -> None:
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")
    discord.utils.setup_logging(level=logging.INFO, root=True)
    file_handler = logging.handlers.RotatingFileHandler(LOG_FILE, maxBytes=1_000_000, backupCount=2,
                                                        encoding="utf-8")
    file_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    logging.getLogger().addHandler(file_handler)

    token = load_token()
    if not token:
        print(f"No bot token found. Open {ENV_FILE} and set DISCORD_TOKEN=<your bot token> (see README.md).")
        sys.exit(2)
    try:
        MercBot().run(token, log_handler=None)
    except discord.LoginFailure:
        print("Discord rejected the token in .env. Reset it in the Developer Portal and paste the new one.")
        sys.exit(2)


if __name__ == "__main__":
    main()

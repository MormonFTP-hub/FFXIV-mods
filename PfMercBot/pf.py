"""Party Finder scraping and merc-listing detection.

Data comes from https://xivpf.com/listings, which is fed by players running the
Remote Party Finder Dalamud plugin. Its JSON API isn't gzipped (1.6 MB a poll)
and its websocket isn't proxied, so we read the gzipped HTML page (~190 KB).

Run directly to test detection without Discord:
    python pf.py               # fetch live and print NA merc listings
    python pf.py saved.html    # same, from a saved copy of the page
    python pf.py --rejects     # also show money-mentioning listings that were skipped
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from html.parser import HTMLParser

LISTINGS_URL = "https://xivpf.com/listings"
NA_DATA_CENTRES = ("Aether", "Crystal", "Dynamis", "Primal")


@dataclass
class Listing:
    id: str
    data_centre: str
    category: str
    duty: str = ""
    cross_world: bool = False
    tags: str = ""         # "[Duty Completion][Duty Complete]" - the coloured PF objective/condition flags
    description: str = ""  # free text the recruiter typed
    creator: str = ""      # "Name @ World"
    world: str = ""
    expires: str = ""
    updated: str = ""
    min_il: str = ""
    filled: int = 0
    total: int = 0
    open_slots: list[str] = field(default_factory=list)  # "tank" / "healer" / "dps" / "flex" / "any"

    @property
    def key(self) -> str:
        """Stable across relists: the same recruiter re-posting the same duty is the same party."""
        return f"{self.data_centre}|{self.creator}|{self.duty}"

    @property
    def duty_display(self) -> str:
        return "No duty set" if self.duty in ("", "None") else self.duty

    @property
    def full_text(self) -> str:
        return f"{self.tags} {self.description}".strip()


class _ListingParser(HTMLParser):
    """Walks the listings page and pulls each <div class="listing"> into a Listing."""

    _ITEMS = {"creator", "world", "expires", "updated"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.listings: list[Listing] = []
        self._cur: Listing | None = None
        self._depth = 0               # open <div>s inside the current listing
        self._field: str | None = None
        self._field_depth = 0
        self._item: str | None = None
        self._item_depth = 0
        self._in_item_text = False
        self._in_desc_tag = False
        self._stat_name = ""
        self._buf: dict[str, str] = {}

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = a.get("class") or ""
        if tag == "div":
            if self._cur is None:
                if cls == "listing":
                    self._cur = Listing(
                        id=a.get("data-id", ""),
                        data_centre=a.get("data-centre", ""),
                        category=a.get("data-pf-category", ""),
                    )
                    self._depth = 1
                    self._buf = {}
                return
            self._depth += 1
            classes = cls.split()
            if "duty" in classes:
                self._open_field("duty")
                self._cur.cross_world = "cross" in classes
            elif cls == "description":
                self._open_field("description")
            elif cls == "total":
                self._open_field("total")
            elif cls == "name":
                self._open_field("stat_name")
            elif cls == "value":
                self._open_field("stat_value")
            elif "slot" in classes and "filled" not in classes:
                roles = [r for r in ("tank", "healer", "dps") if r in classes]
                if "empty" in classes:
                    self._cur.open_slots.append("any")
                elif len(roles) == 1:
                    self._cur.open_slots.append(roles[0])
                elif roles:
                    self._cur.open_slots.append("flex")
                # class="slot " with no roles is a filled slot the site couldn't name
            elif len(classes) == 2 and classes[0] == "item" and classes[1] in self._ITEMS:
                self._item = classes[1]
                self._item_depth = self._depth
        elif tag == "span" and self._cur is not None:
            if self._field == "description" and cls.startswith("desc-"):
                self._in_desc_tag = True
            elif self._item and cls == "text":
                self._in_item_text = True

    def handle_endtag(self, tag):
        if self._cur is None:
            return
        if tag == "span":
            self._in_desc_tag = False
            self._in_item_text = False
            return
        if tag != "div":
            return
        if self._field and self._depth == self._field_depth:
            self._close_field()
        if self._item and self._depth == self._item_depth:
            self._item = None
        self._depth -= 1
        if self._depth == 0:
            self._finish()

    def handle_data(self, data):
        if self._cur is None:
            return
        if self._in_item_text and self._item:
            self._buf[self._item] = self._buf.get(self._item, "") + data
        elif self._field == "description":
            key = "tags" if self._in_desc_tag else "description"
            self._buf[key] = self._buf.get(key, "") + data
        elif self._field:
            self._buf[self._field] = self._buf.get(self._field, "") + data

    def _open_field(self, name):
        self._field = name
        self._field_depth = self._depth

    def _close_field(self):
        if self._field == "stat_value" and self._stat_name.strip() == "Min IL":
            self._cur.min_il = self._buf.pop("stat_value", "").strip()
        elif self._field == "stat_name":
            self._stat_name = self._buf.pop("stat_name", "")
        self._field = None

    def _finish(self):
        cur, b = self._cur, self._buf
        cur.duty = b.get("duty", "").strip()
        cur.tags = b.get("tags", "").strip()
        cur.description = " ".join(b.get("description", "").split())
        cur.creator = b.get("creator", "").strip()
        cur.world = b.get("world", "").strip()
        cur.expires = b.get("expires", "").strip()
        cur.updated = b.get("updated", "").strip()
        m = re.match(r"\s*(\d+)\s*/\s*(\d+)", b.get("total", ""))
        if m:
            cur.filled, cur.total = int(m.group(1)), int(m.group(2))
        self.listings.append(cur)
        self._cur = None
        self._field = self._item = None


def parse_listings(html: str) -> list[Listing]:
    p = _ListingParser()
    p.feed(html)
    p.close()
    return p.listings


# --- merc detection -------------------------------------------------------------
# A "merc" listing is one where the recruiter pays gil for help (a clear, a phase,
# filling for an hour, farming an item). Sellers (people *charging* gil for carries)
# and venue/raffle/gamba ads also mention gil, so those are filtered out first.

_SELLER = re.compile(
    r"\b(wts|selling|sells?|seller|for sale|for sell|pricing|cheap|discount|boost(s|ing)?|"
    r"buyers?|carry services?|clear services?|dm for (prices?|info|rates))\b", re.I)
_NOT_MERC = re.compile(
    # venues, events and gambling
    r"\b(raffles?|gamba|gamble|gambling|giveaways?|give ?away|djs?|venue|club|lounge|bar|"
    r"cafe|tavern|nightclub|lottery|lotto|drt|death ?roll|bingo|auction|bid|prizes?|"
    r"prize ?pool|tourney|tournament|contest|duels?|sign ?ups?|rp|role ?play|"
    # paying *to* the party: loot-master farms, buy-ins
    r"loot ?master|lm|buy[- ]?in|entry fee|fees?|"
    # item trading and venue/FC job ads
    r"ceruleum|materials|per stack|per 999|in bulk|fc credits?|all positions|open positions|"
    r"staff|staffing|applications?)\b", re.I)
_MERC_WORD = re.compile(r"\bmercs?\b|mercenar", re.I)
_PAY_WORD = re.compile(
    r"\bpay(s|ing|ed)?\b|\bpaid\b|\bpay ?outs?\b|\bbount(y|ies)\b|\brewards?\b|\bcompensat|\btip(s|ping)?\b|"
    r"\b(wtb|buying)\b.{0,25}\b(clears?|carry|carries|kills?|help|runs?)\b", re.I)
_PAY_CONTEXT = re.compile(
    r"\b(for|per|each|ea|pp|a pop|clears?|kills?|phases?|p\d+|c\d\d|lockout|hours?|hrs?|hr|runs?|reclear|"
    r"enrage|if|see)\b|/", re.I)

# 10m, 2 mil, 1.5M, 500k, 1kk, 3 mills, 2 milly, 20MIL. Must start with a digit so "M4S" etc. never
# match, and MGP (Gold Saucer points) isn't gil.
_AMOUNT = re.compile(
    r"(?<![\w.,])(\d+(?:[.,]\d+)?)\s*(kk|k|m|mils?|mills?|milly|mili|milli|mill?ions?|millons?|mln|mio)"
    r"(?![a-z])(?!\s*mgp\b)", re.I)
_AMOUNT_WORDS = re.compile(  # a mil, two million, half a mil
    r"\b(an?|one|two|three|four|five|six|seven|eight|nine|ten|half(?:\s+an?)?)\s+(mils?|mills?|mill?ions?)\b", re.I)
_WORD_MILLIONS = {"a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
                  "eight": 8, "nine": 9, "ten": 10, "half": 0.5}
_AMOUNT_LONG = re.compile(r"(?<![\d,])(\d{1,3}(?:,\d{3}){2,})(?![\d,])")       # 5,000,000
_AMOUNT_GIL = re.compile(r"(?<![\w.,])(\d[\d,]*)\s*gil\b", re.I)                  # 500000 gil


def pay_amounts(text: str) -> list[float]:
    """Every gil amount mentioned, in millions."""
    out: list[float] = []
    for m in _AMOUNT.finditer(text):
        n = float(m.group(1).replace(",", "."))
        unit = m.group(2).lower()
        out.append(n / 1000 if unit == "k" else n)  # "kk" is millions too
    for m in _AMOUNT_WORDS.finditer(text):
        out.append(_WORD_MILLIONS[m.group(1).lower().split()[0]])
    for m in _AMOUNT_LONG.finditer(text):
        out.append(int(m.group(1).replace(",", "")) / 1_000_000)
    for m in _AMOUNT_GIL.finditer(text):
        n = int(m.group(1).replace(",", ""))
        out.append(n if n < 1000 else n / 1_000_000)  # "5 gil" is nonsense; treat small numbers as millions
    return out


def merc_reason(listing: Listing) -> tuple[bool, str]:
    """(is_merc, why). The reason string is only for --rejects debugging."""
    text = listing.full_text
    if m := _SELLER.search(text):
        return False, f"seller ({m.group(0)!r})"
    if m := _NOT_MERC.search(text):
        return False, f"not a merc job ({m.group(0)!r})"
    if _MERC_WORD.search(text):
        return True, "merc keyword"
    amounts = pay_amounts(text)
    pay_word = _PAY_WORD.search(text)
    if amounts and pay_word:
        return True, "gil amount + pay keyword"
    if pay_word and re.search(r"\bgil\b", text, re.I):
        return True, "paying gil"
    ultimate = "(Ultimate)" in listing.duty
    if amounts and (ultimate or _PAY_CONTEXT.search(text)):
        # Without an explicit "paying"/"merc", "1M each" in a [Loot] farm means you pay per drop,
        # and 100M+ for a clear is a sale, not a merc fee. Ultimates have no loot to sell (and
        # often carry the Loot tag anyway): gil on one is pay for help.
        if "[Loot]" in listing.tags and not ultimate:
            return False, "loot party price"
        if max(amounts) >= 100:
            return False, "big amount without pay word (likely a sale)"
        return True, "gil amount on an ultimate" if ultimate else "gil amount for a clear/phase/hour"
    return False, "amount without pay context" if amounts else "no pay mentioned"


def is_merc(listing: Listing) -> bool:
    return merc_reason(listing)[0]


def max_pay(listing: Listing) -> float:
    """Biggest amount offered, in millions (0 if none was written)."""
    return max(pay_amounts(listing.full_text), default=0.0)


def format_millions(m: float) -> str:
    if m <= 0:
        return "not stated"
    if m < 1:
        return f"{m * 1000:g}K"
    return f"{m:g}M"


def _main(argv: list[str]) -> None:
    import gzip
    import urllib.request

    show_rejects = "--rejects" in argv
    files = [a for a in argv if not a.startswith("--")]
    if files:
        with open(files[0], encoding="utf-8") as f:
            html = f.read()
    else:
        req = urllib.request.Request(LISTINGS_URL, headers={
            "User-Agent": "PfMercBot/1.0 (FFXIV party finder merc alerts)",
            "Accept-Encoding": "gzip",
        })
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            html = (gzip.decompress(raw) if r.headers.get("Content-Encoding") == "gzip" else raw).decode("utf-8")

    listings = parse_listings(html)
    na = [l for l in listings if l.data_centre in NA_DATA_CENTRES]
    out = sys.stdout.buffer
    out.write(f"{len(listings)} listings total, {len(na)} on NA data centres\n".encode())
    for l in na:
        ok, why = merc_reason(l)
        if ok or (show_rejects and pay_amounts(l.full_text)):
            mark = "MERC" if ok else "skip"
            line = (f"[{mark}] {l.data_centre:8} {l.duty_display} | {l.creator} | {l.filled}/{l.total} | "
                    f"pay {format_millions(max_pay(l))} | {why}\n        {l.full_text}\n")
            out.write(line.encode("utf-8", "replace"))


if __name__ == "__main__":
    _main(sys.argv[1:])

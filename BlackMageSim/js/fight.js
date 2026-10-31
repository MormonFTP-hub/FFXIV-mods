// A fight to test against (Settings → Location, or /fight): its arena, its boss standing in for the dummy, and the
// boss's timeline from cactbot (both from tools/export_map.py). The fight's clock starts with the pull: the boss casts
// on time (its cast bar under its name, its abilities in the log), the next ones show in a list at the left, it can't
// be targeted in its untargetable windows, and at the enrage the pull ends. For testing: the boss has the dummy's HP,
// and nothing it does hurts you or moves you yet.
(function (B) {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mmss = (t) => `${Math.floor(Math.max(0, t) / 60)}:${String(Math.floor(Math.max(0, t) % 60)).padStart(2, '0')}`;

  class Fight {
    constructor(app, key, data) {
      this.app = app;
      this.key = key;
      this.data = data;
      this.events = data.events;
      this.hitbox = data.hitbox || 5;
      this.reset();
    }
    get name() { return this.data.boss; }

    reset() {
      this.next = 0;
      this.casting = null;
      this.over = false;
      this.picks = {};
      this.t = null;
      this.app.engine.untargetable = false;
    }

    // "A/B": the boss does one or the other, picked once a pull; a later "B/A" is then the other one.
    label(ev) {
      const parts = ev.name.split('/');
      if (parts.length < 2) return ev.name;
      const key = parts.slice().sort().join('/');
      if (!(key in this.picks)) this.picks[key] = Math.random() < 0.5 ? 0 : 1;
      return parts[this.picks[key] % parts.length];
    }

    // Each frame: the fight's second since the pull, what's cast and used by now, and the enrage.
    update() {
      const app = this.app, e = app.engine, enc = app.enc;
      if (!enc || enc.end !== null) {
        if (this.t !== null) this.reset();
        this.draw(null);
        return;
      }
      const t = this.t = e.now - enc.start;
      while (this.next < this.events.length && this.events[this.next].t <= t) this.fire(this.events[this.next++]);
      this.casting = this.events.find((ev) => ev.cast && t >= ev.t - ev.cast && t < ev.t) || null;
      e.untargetable = this.data.untargetable.some(([a, b]) => t >= a && t < b);
      if (!this.over && t >= this.data.enrage) {
        this.over = true;
        app.ui.log(`Enrage at ${mmss(this.data.enrage)}: the pull is over.`, 'lose', 'battle');
        app.endEncounter(enc.start + this.data.enrage, 'time');
      }
      this.draw(t);
    }

    fire(ev) {
      const name = this.label(ev);
      if (ev.anim) { this.motion = ev.anim; this.motionSeq = (this.motionSeq || 0) + 1; }       // the boss plays it
      if (ev.cast || ev.kind === 'enrage') this.app.ui.log(`${this.name} casts ${name}.`, 'lose', 'battle');
      else this.app.ui.log(`${this.name} uses ${name}.`, 'dim', 'battle');
    }

    // The boss's name and cast bar on the target bar, and the next abilities with the seconds to each.
    draw(t) {
      $('#t-name').textContent = this.name;
      const cast = this.casting, bar = $('#t-cast');
      bar.classList.toggle('show', !!cast);
      if (cast) {
        $('#t-cast-name').textContent = this.label(cast);
        $('#t-cast-fill').style.transform = `scaleX(${Math.min(1, (t - (cast.t - cast.cast)) / cast.cast)})`;
      }
      const now = t === null ? 0 : t;
      // A cast and the hit it lands are one line.
      const up = [];
      for (const ev of this.events) {
        if (ev.t <= now) continue;
        const last = up[up.length - 1];
        if (last && last.name === ev.name && ev.t - last.t < 6) continue;
        up.push(ev);
        if (up.length === 6) break;
      }
      const tl = $('#fight-tl');
      tl.classList.add('show');
      tl.innerHTML = `<div class="hd"><span>${esc(this.data.duty)}</span><b>${t === null ? 'Pull to start' : `${mmss(t)} / ${mmss(this.data.enrage)}`}</b></div>`
        + up.map((ev) => `<div class="ev${ev.kind === 'enrage' ? ' enr' : ''}"><b>${Math.ceil(ev.t - now)}</b>${esc(this.label(ev))}</div>`).join('')
        + (this.app.engine.untargetable ? '<div class="ev unt">Untargetable</div>' : '');
    }

    // Back to the striking dummy.
    static clear() {
      $('#t-name').textContent = 'Striking Dummy';
      $('#t-cast').classList.remove('show');
      $('#fight-tl').classList.remove('show');
    }
  }

  B.Fight = Fight;
})(window.BLM);

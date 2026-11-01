// A fight (Settings → Location, or /fight): its arena, its boss where the dummy stood, and the boss's timeline from
// cactbot (both from tools/export_map.py). The fight's clock starts with the pull: the boss casts on time (its cast
// bar under its name, its abilities in the log), the next ones show in a list at the left, it can't be targeted in
// its untargetable windows, and at the enrage the pull ends. A fight with a script (js/fights/<key>.js) also has its
// mechanics (js/mech.js), a party of bots playing the chosen strat with you (js/party.js) and the boss's own HP: kill
// it and the pull ends there. Without one, the boss has the dummy's HP and nothing it does lands.
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
      this.script = (B.FIGHT_SCRIPTS || {})[key] || null;
      this.maxHp = this.script ? this.script.hp : null;
      this.mech = this.script ? new B.Mechanics(app, this, this.script) : null;
      this.reset();
    }
    // The boss's name: the plan's for the phase (names: [{t, name}]), or the fight's.
    get name() {
      const L = this.mech && this.mech.plan && this.mech.plan.names;
      let n = this.data.boss;
      if (L) for (const k of L) if (k.t <= (this.t ?? 0)) n = k.name;
      return n;
    }

    reset() {
      this.next = 0;
      this.offset = 0;                           // seconds skipped ahead by phase pushes this pull
      this.pushed = new Set();
      this.casting = null;
      this.castHeard = null;
      this.over = false;
      this.picks = {};
      this.t = null;
      this.hp = this.maxHp;
      B.BOSS.x = 0; B.BOSS.z = 0;                 // back to the middle for the next pull
      this.dealt = 0;                            // all the party's damage this pull, and what the adds took of it
      this.soaked = 0;
      this.addsTaken = (this.script && this.script.adds || []).map(() => 0);
      this.app.engine.untargetable = false;
      if (this.mech) {                            // the next pull's picks, the opening look, where the boss starts
        this.mech.reset();
        this.showLooks(null);
        const at = B.toSim(this.mech.bossAt(0));
        B.BOSS.x = at.x; B.BOSS.z = at.z;
      }
      if (this.app.party) this.app.party.reset();
    }

    // "A/B": the boss does one or the other, picked once a pull; a later "B/A" is then the other one.
    label(ev) {
      const own = this.mech && this.mech.plan.labels.get(ev);     // the script's pick for this pull
      if (own) return own;
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
      const t = this.t = e.now - enc.start + this.offset;
      while (this.next < this.events.length && this.events[this.next].t <= t) this.fire(this.events[this.next++]);
      this.casting = this.events.find((ev) => ev.cast && t >= ev.t - ev.cast && t < ev.t) || null;
      if (this.casting && this.casting !== this.castHeard) {           // the boss's cast sound, as it starts
        this.castHeard = this.casting;
        if (app.sfx && app.sfx.boss) app.sfx.boss(this.key, this.label(this.casting), 'cast');
      }
      e.untargetable = this.data.untargetable.concat((this.mech && this.mech.plan.untargetable) || []).some(([a, b]) => t >= a && t < b);
      // Adds up while the boss can't be targeted (an adds window with `whileAway`): the party hits them meanwhile.
      this.onAdds = e.untargetable && (this.script && this.script.adds || []).some((w, k) => w.whileAway && t >= w.from && t < w.to && this.addsTaken[k] < w.hp);
      if (this.onAdds) e.untargetable = false;
      if (this.mech) {
        this.mech.update(t);
        const at = B.toSim(this.mech.bossAt(t));             // the boss walks or leaps where the plan has it
        B.BOSS.x = at.x; B.BOSS.z = at.z;
        // The fight's walls stop you walking (js/engine.js asks B.blocked).
        B.blocked = this.mech.plan.walls ? (pos) => this.mech.inWall(B.toCompass(pos), 0.4) : null;
        this.showLooks(t);
        // A boss whose size changes by phase (the plan's `hitbox`: [{t, r}]).
        const hb = this.mech.plan.hitbox;
        if (hb) { let r = this.hitbox; for (const k of hb) if (k.t <= t) r = k.r; B.DUMMY_RADIUS = r; }
      }
      if (this.maxHp) {
        // Adds that soak damage (script.adds: [{from, to, hp, share, name}]): in each window that share of what the
        // party deals goes to them, not the boss, until their HP is gone (the fight's own adds, fought beside her).
        const dealt = enc.total + app.party.botDamage, d = dealt - this.dealt;
        this.dealt = dealt;
        (this.script.adds || []).forEach((w, k) => {
          if (d <= 0 || t < w.from || t >= w.to) return;
          const take = Math.min(d * (this.onAdds && w.whileAway ? 1 : w.share ?? 1), w.hp - this.addsTaken[k]);
          if (take > 0) { this.addsTaken[k] += take; this.soaked += take; }
        });
        this.hp = Math.max(0, this.maxHp - (dealt - this.soaked));
        // Phase pushes (script.pushes: [{from, to, dealt | adds}]): deal `dealt` to the boss this pull (or kill the
        // adds of window `adds`) between `from` and `to` and the fight skips ahead to `to`, as the game's HP-driven
        // phases do; otherwise the timeline gets there on its own.
        for (const [k, p] of (this.script.pushes || []).entries()) {
          if (this.pushed.has(k) || t < p.from || t >= p.to) continue;
          const done = p.dealt !== undefined ? dealt - this.soaked >= p.dealt
            : p.adds !== undefined ? this.addsTaken[p.adds] >= this.script.adds[p.adds].hp - 1 : false;
          if (done) { this.pushed.add(k); this.jump(p.to, p.name); return; }
        }
        if (!this.over && this.hp <= 0) {
          this.over = true;
          app.ui.log(`${this.name} is defeated!`, 'gain', 'battle');
          app.ui.count('CLEAR', true);
          app.endEncounter(e.now, 'kill');
          return;
        }
      }
      if (!this.over && t >= this.data.enrage) {
        this.over = true;
        app.ui.log(`Enrage at ${mmss(this.data.enrage)}: the pull is over.`, 'lose', 'battle');
        app.endEncounter(enc.start + this.data.enrage, 'time');
      }
      this.draw(t);
    }

    // The arena's look for second t (the plan's `looks`: [{t, show: ['a1']}]): the stage changes with the phases.
    showLooks(t) {
      const L = this.mech && this.mech.plan.looks, map = this.app.map;
      if (!L || !L.length || !map || !map.setLooks) return;
      let cur = L[0];
      for (const k of L) if (k.t <= (t ?? 0)) cur = k;
      map.setLooks(cur.show, this.allLooks || (this.allLooks = new Set(L.flatMap(k => k.show))), cur.lift, cur.shift, cur.shifts);
    }

    // Skip ahead to second `to` (a phase pushed early): the abilities and mechanics in between never happen.
    jump(to, name) {
      const t = this.t;
      if (t === null || to <= t) return;
      this.offset += to - t;
      while (this.next < this.events.length && this.events[this.next].t < to) this.next++;
      if (this.mech) this.mech.skipTo(to);
      this.app.ui.log(`${name || 'Phase pushed'}: the fight moves on to ${mmss(to)}.`, 'gain', 'battle');
    }

    fire(ev) {
      const name = this.label(ev);
      if (ev.anim) { this.motion = ev.anim; this.motionSeq = (this.motionSeq || 0) + 1; }       // the boss plays it
      if (this.app.sfx && this.app.sfx.boss) this.app.sfx.boss(this.key, name, 'use');         // and its sound
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
      // The quick toggles under the list (a fight with a party): the guide and whether attacks hurt.
      const st = this.app.store.settings;
      for (const b of document.querySelectorAll('#fight-opts button')) b.classList.toggle('on', st[b.dataset.opt] !== false);
      // With a script: the strat, your spot, and your debuff's timer.
      const party = this.app.party, me = party && party.playerSlot();
      const deb = this.mech && t !== null && this.mech.plan.debuffs.find(d => d.slot === me && t >= d.t0 && t < d.t1);
      const adds = t === null ? -1 : (this.script && this.script.adds || []).findIndex(w => t >= w.from && t < w.to);
      const aw = adds >= 0 && this.script.adds[adds], left = aw ? Math.max(0, 1 - this.addsTaken[adds] / aw.hp) : 0;
      $('#fight-tl-body').innerHTML = `<div class="hd"><span>${esc(this.data.duty)}</span><b>${t === null ? 'Pull to start' : `${mmss(t)} / ${mmss(this.data.enrage)}`}</b></div>`
        + (this.mech ? `<div class="sub">${esc(this.script.strats[this.mech.strat].label)} · you're ${me}</div>` : '')
        + (deb ? `<div class="ev deb"><b>${Math.ceil(deb.t1 - t)}</b>${esc(deb.name)}${deb.hint ? `: ${esc(deb.hint)}` : ''}</div>` : '')
        + (aw && left > 0 ? `<div class="ev adds"><b>${Math.ceil(left * 100)}%</b>${esc(aw.name || 'Adds')}: the party's damage goes to them</div>` : '')
        + up.map((ev) => `<div class="ev${ev.kind === 'enrage' ? ' enr' : ''}"><b>${Math.ceil(ev.t - now)}</b>${esc(this.label(ev))}</div>`).join('')
        + (this.app.engine.untargetable ? '<div class="ev unt">Untargetable</div>' : '');
    }

    // Back to the striking dummy.
    static clear() {
      B.blocked = null;                           // no fight walls at the pier
      B.BOSS.x = 0; B.BOSS.z = 0;
      $('#t-name').textContent = 'Striking Dummy';
      $('#t-cast').classList.remove('show');
      $('#fight-tl').classList.remove('show');
    }
  }

  // A status the current fight puts on players (its name, the game's description and icon, from the map's file).
  B.fightStatus = (key) => {
    const f = B.app && B.app.fight;
    return (f && f.data.statuses && f.data.statuses[key]) || null;
  };

  B.Fight = Fight;
})(window.BLM);

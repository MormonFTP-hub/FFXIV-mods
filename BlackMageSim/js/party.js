// The party in a fight that has a script (js/fights/<key>.js): you in your spot (Settings → Your spot, or your job's
// usual one) and seven bots in the others, each a job of that role. The bots run to where the strat puts them
// (B.Mechanics.target), dodge what's coming, take the raidwides with you and deal their share of damage to the
// boss. Everyone's HP is on the party list; with Settings → Take damage on, the boss's attacks hit you too, and if
// they KO you a healer raises you a few seconds later.
(function (B) {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  // Each spot's job, and another if you're playing the first.
  const BOT_JOBS = { MT: ['war', 'gnb'], OT: ['drk', 'pld'], H1: ['whm', 'ast'], H2: ['sge', 'ast'], M1: ['drg', 'sam'], M2: ['vpr', 'rpr'], R1: ['brd', 'mch'], R2: ['pct', 'smn'] };
  const JOB_NAME = { war: 'Warrior', gnb: 'Gunbreaker', drk: 'Dark Knight', pld: 'Paladin', whm: 'White Mage', ast: 'Astrologian', sge: 'Sage', drg: 'Dragoon', sam: 'Samurai', vpr: 'Viper', rpr: 'Reaper', brd: 'Bard', mch: 'Machinist', pct: 'Pictomancer', smn: 'Summoner' };
  // A raiding bot's damage per second over a pull, with its party's buffs (rough Dawntrail savage figures).
  const BOT_DPS = { tank: 19500, healer: 14000, melee: 33000, ranged: 28000, caster: 31500 };
  // HP against a DPS's: what the fight scripts' damage shares are of.
  const HP_K = { tank: 1.6, healer: 1, melee: 1.05, ranged: 1, caster: 1 };
  const RUN = 6;                  // yalms a second
  const RAISE = 12;               // seconds on the floor before a healer raises you
  const ROLE_COLOR = { tank: '80,150,255', healer: '90,220,110', melee: '235,80,80', ranged: '235,80,80' };

  class Party {
    constructor(app) {
      this.app = app;
      this.bots = [];
      this.active = false;
      this.botDamage = 0;
      this.koUntil = null;
    }

    get fight() { return this.app.fight; }
    get mech() { return this.fight && this.fight.mech; }

    // Your spot: Settings → Your spot, or tanks MT, healers H1 (shield healers H2), melee M1, physical ranged R1,
    // casters R2.
    playerSlot() {
      if (!this.active) return null;
      const s = this.app.store.settings.partySlot;
      if (B.SLOTS.includes(s)) return s;
      const j = this.app.engine.job;
      if (j.role === 'tank') return 'MT';
      if (j.role === 'healer') return ['sch', 'sge'].includes(j.id) ? 'H2' : 'H1';
      if (j.role === 'melee') return 'M1';
      if (j.role === 'ranged') return 'R1';
      return 'R2';
    }
    playerRole() { const r = this.app.engine.job.role; return r === 'caster' ? 'caster' : r; }

    // A fight with a script gets a party; anywhere else, just you.
    setup() {
      const f = this.fight;
      this.active = !!(f && f.mech);
      this.bots = [];
      this.botDamage = 0;
      if (this.active) {
        const me = this.playerSlot(), mine = this.app.engine.job.id;
        const start = f.mech.plan.start;
        for (const slot of B.SLOTS) {
          if (slot === me) continue;
          const [a, b] = BOT_JOBS[slot], job = a === mine ? b : a;
          const role = B.SLOT_ROLE[slot] === 'ranged' && (job === 'pct' || job === 'smn') ? 'caster' : B.SLOT_ROLE[slot];
          this.bots.push({ slot, job, role, name: JOB_NAME[job], pos: start[slot].slice(), facing: 0, moving: false, hp: 1, maxHp: 1, lastHit: -99 });
        }
        this.fillHp();
      }
      this.app.engine.ko = false;
      this.koUntil = null;
      this.render();
      if (this.app.models) this.app.models.partyChanged = true;
    }

    // HP: yours from your job; a bot's from its role against a DPS's.
    fillHp() {
      const ref = this.refHp();
      for (const b of this.bots) { b.maxHp = Math.round(ref * HP_K[b.role]); b.hp = b.maxHp; }
    }
    refHp() { return this.app.engine.maxHp / HP_K[this.playerRole()]; }

    // Before each pull: everyone back to their opening spot at full HP.
    reset() {
      if (!this.active) return;
      const start = this.mech.plan.start;
      for (const b of this.bots) { b.pos = start[b.slot].slice(); b.hp = b.maxHp; }
      this.botDamage = 0;
      this.app.engine.ko = false;
      this.koUntil = null;
    }

    members() {
      if (!this.active) return [];
      const me = this.playerSlot();
      return B.SLOTS.map(s => (s === me ? { slot: s, player: true } : this.bots.find(b => b.slot === s))).filter(Boolean);
    }
    bot(slot) { return this.bots.find(b => b.slot === slot); }
    compassOf(slot) {
      if (slot === this.playerSlot()) return B.toCompass(this.app.engine.pos);
      const b = this.bot(slot);
      return b ? b.pos : [0, 0];
    }
    bearingOf(slot) { const p = this.compassOf(slot); return Math.atan2(p[0], p[1]) * 180 / Math.PI; }

    // ---------- each frame ----------
    update(dt) {
      if (!this.active) return;
      const app = this.app, e = app.engine, f = this.fight, t = f.t;
      for (const b of this.bots) {
        const want = this.mech.target(b.slot, t, b.pos);
        const dx = want[0] - b.pos[0], dy = want[1] - b.pos[1], d = Math.hypot(dx, dy);
        const step = Math.min(d, RUN * dt);
        b.moving = d > 0.05;
        if (b.moving) {
          b.pos[0] += dx / d * step; b.pos[1] += dy / d * step;
          b.facing = Math.atan2(-dx, dy);                 // the sim's yaw (x is west)
        } else b.facing = Math.atan2(b.pos[0], -b.pos[1]);    // toward the boss
      }
      // The boss faces the main tank.
      const mt = this.compassOf('MT');
      e.facing = Math.atan2(-mt[0], mt[1]);
      // Healing: whatever got hurt is topped back up a few seconds later.
      const heal = (now, last, max) => (now - last > 2 ? max * 0.07 * dt : 0);
      for (const b of this.bots) b.hp = Math.min(b.maxHp, b.hp + heal(e.now, b.lastHit, b.maxHp));
      if (!e.ko) e.hp = Math.min(e.maxHp, e.hp + heal(e.now, this.lastHit || -99, e.maxHp));
      // The bots' damage on the boss while the pull runs.
      if (t !== null && !f.over && !e.untargetable) {
        this.botDamage += this.bots.reduce((s, b) => s + BOT_DPS[b.role], 0) * dt;
      }
      if (e.ko && this.koUntil !== null && e.now >= this.koUntil) this.raise();
      this.draw();
    }

    // ---------- damage ----------
    // share: of a DPS's HP (a raidwide about half, most avoidable attacks more than all of it).
    hurt(slot, share, source, why) {
      if (!share) return;
      const app = this.app, e = app.engine, ui = app.ui;
      const amount = Math.round(share * this.refHp() * (0.95 + Math.random() * 0.1));
      if (slot !== this.playerSlot()) {
        const b = this.bot(slot);
        if (b) { b.hp = Math.max(1, b.hp - amount); b.lastHit = e.now; }
        return;
      }
      const at = app.scene.mageHead();
      if (e.ko) return;
      if (!app.store.settings.takeDamage) {
        ui.fly({ at, text: fmt(amount), cls: 'hurt off', dx: -60 });
        ui.log(`${source} would hit you for ${fmt(amount)}${why ? ` (${why})` : ''}. Take damage is off.`, 'dim', 'battle');
        return;
      }
      e.hp = Math.max(0, e.hp - amount);
      this.lastHit = e.now;
      ui.fly({ at, text: fmt(amount), cls: 'hurt', dx: -60 });
      ui.log(`${source} hits you for ${fmt(amount)} damage${why ? ` (${why})` : ''}.`, 'lose', 'battle');
      if (e.hp <= 0) this.ko(source);
    }

    ko(source) {
      const e = this.app.engine, ui = this.app.ui;
      e.ko = true;
      e.hp = 0;
      e.interrupt('Interrupted');
      e.queue = [];
      this.koUntil = e.now + RAISE;
      ui.log(`You are defeated by ${source}.`, 'err', 'battle');
      ui.callout(`KO'd by ${source}: a healer raises you in ${RAISE}s`, 4, true);
      this.app.sfx.play('error');
    }

    raise() {
      const e = this.app.engine;
      const healer = this.bots.find(b => b.role === 'healer');
      e.ko = false;
      e.hp = Math.round(e.maxHp * 0.5);
      this.koUntil = null;
      this.lastHit = e.now;
      this.app.ui.log(`${healer ? healer.name : 'Your healer'} raises you.`, 'gain', 'battle');
    }

    // ---------- the party list ----------
    render() {
      const box = $('#party-bots');
      document.body.classList.toggle('in-party', this.active);
      $('#party-slot').textContent = this.active ? this.playerSlot() : '';
      if (!this.active) { box.innerHTML = ''; return; }
      box.innerHTML = this.bots.map(b => `<div class="pm" data-slot="${b.slot}"><img src="${B.jobIcon(b.job)}" alt="">`
        + `<div><div class="nm outline"><b>${b.slot}</b>${esc(b.name)}</div><div class="minibar hp"><i></i></div></div>`
        + '<div class="barnum outline"></div></div>').join('');
      this.rows = [...box.querySelectorAll('.pm')].map(el => ({ el, bar: el.querySelector('.minibar i'), num: el.querySelector('.barnum'), last: null }));
    }
    draw() {
      (this.rows || []).forEach((r, i) => {
        const b = this.bots[i];
        if (!b || r.last === b.hp) return;
        r.last = b.hp;
        r.bar.style.transform = `scaleX(${(b.hp / b.maxHp).toFixed(3)})`;
        r.num.textContent = fmt(b.hp);
      });
      document.body.classList.toggle('ko', !!this.app.engine.ko);
    }

    // Each bot's marker on the floor (its role's colour), for the drawn figures and to tell them apart.
    drawGround(sc) {
      if (!this.active) return;
      const ctx = sc.ctx;
      for (const b of this.bots) {
        const s = B.toSim(b.pos);
        if (sc.groundPath(s.x, s.z, 0.6, 20, 0.03)) {
          ctx.fillStyle = `rgba(${ROLE_COLOR[B.SLOT_ROLE[b.slot]]},${sc.modelsOn() ? 0.22 : 0.75})`; ctx.fill();
          ctx.strokeStyle = `rgba(${ROLE_COLOR[B.SLOT_ROLE[b.slot]]},0.9)`; ctx.lineWidth = 1.5; ctx.stroke();
        }
      }
    }
    // Their spot names over their heads.
    drawLabels(sc) {
      if (!this.active) return;
      const ctx = sc.ctx;
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      for (const b of this.bots) {
        const s = B.toSim(b.pos), q = sc.project(s.x, sc.modelsOn() ? 2.25 : 1.4, s.z);
        if (!q || q.z > 45) continue;
        ctx.font = `700 ${Math.max(11, Math.min(17, q.s * 0.45)).toFixed(0)}px Saira Semi Condensed, sans-serif`;
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(b.slot, q.x, q.y);
        ctx.fillStyle = `rgb(${ROLE_COLOR[B.SLOT_ROLE[b.slot]]})`; ctx.fillText(b.slot, q.x, q.y);
      }
      ctx.restore();
    }
  }

  B.Party = Party;
  B.BOT_MODEL = (job) => {
    const jobs = (B.GAME_MODELS && B.GAME_MODELS.jobs) || {};
    return jobs[job + '-dt'] ? job + '-dt' : jobs[job] ? job : null;
  };
})(window.BLM);

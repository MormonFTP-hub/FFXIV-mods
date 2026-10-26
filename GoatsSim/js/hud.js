// The HUD in the 2018 layout: objective and both teams up top, kill feed top right, health in 25 hp
// segments bottom left (white health, yellow armour, blue shields), ult meter in the middle, abilities
// bottom right. Plus what the game didn't have: team comms as text, an ult tracker, and a coach that calls
// out what a good GOATS Reinhardt would do right now.
(function (G) {
  const T = THREE;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  class HUD {
    constructor(game) {
      this.g = game;
      this.ov = $('overlay');
      this.ctx = this.ov.getContext('2d');
      this.coachOn = true;
      this.coachText = '';
      this.coachUntil = 0;
      this.coachSaid = {};
      this.feed = [];
      this.comms = [];
      this.segCache = '';
      this.resize();
      addEventListener('resize', () => this.resize());
    }

    resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      this.ov.width = innerWidth * dpr; this.ov.height = innerHeight * dpr;
      this.ov.style.width = innerWidth + 'px'; this.ov.style.height = innerHeight + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    show(on) { $('hud').classList.toggle('hidden', !on); $('ult-tracker').classList.toggle('hidden', !on); }

    // a new fight: clear feeds and timers that are keyed to the fight clock
    reset() {
      this.trackAt = -1; this.coachAt = -1; this.coachSaid = {}; this.coachUntil = 0; this.coachPrio = 0;
      for (const id of ['killfeed', 'comms', 'ultlines', 'dmgdir']) $(id).innerHTML = '';
      this.segCache = '';
      $('crosshair').classList.toggle('hidden', !!this.g.autopilot);
      $('player').classList.toggle('hidden', !!this.g.autopilot);
      $('abilities').classList.toggle('hidden', !!this.g.autopilot);
      $('ult').classList.toggle('hidden', !!this.g.autopilot);
    }

    buildTeams() {
      const g = this.g;
      for (const [id, team] of [['team-blue', g.blue], ['team-red', g.red]]) {
        const el = $(id);
        el.innerHTML = '';
        for (const u of g.team(team)) {
          const d = document.createElement('div');
          d.className = 'hero ' + (team === g.blue ? 'blue' : 'red');
          d.innerHTML = `<div class="hx" style="--c:${u.H.color}">${u.H.short}</div><div class="ul"></div>`;
          el.appendChild(d);
          u.hudEl = d;
        }
      }
    }

    // ---------------------------------------------------------------- per frame
    update(dt) {
      const g = this.g, p = g.player.u, t = g.time;
      // teams
      for (const u of g.units) {
        if (!u.hudEl) continue;
        u.hudEl.classList.toggle('dead', !u.alive);
        const ul = u.hudEl.querySelector('.ul');
        if (u.team === g.blue) {
          const pct = u.ultPct();
          ul.textContent = u.alive ? (u.ultReady() ? '★' : pct + '%') : '';
          ul.classList.toggle('ready', u.ultReady());
        } else ul.textContent = '';
      }
      // objective
      const cap = g.capture;
      $('cap-ring').style.strokeDashoffset = String(213.6 * (1 - cap));
      $('point-state').textContent = g.pointState;
      $('point').className = g.pointState === 'CONTESTED' ? 'contested' : (g.pointState === 'CAPTURING' ? 'capturing' : '');
      const left = Math.max(0, g.roundEnd - t);
      $('round-time').textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
      // health segments
      const pools = [['hp', p.hp, p.maxHp], ['ar', p.armor + p.tempArmor, p.maxArmor + p.tempArmor], ['sh', p.shields + p.temp, p.maxShields + p.temp]];
      const segs = [];
      for (const [cls, cur, max] of pools) {
        const n = Math.round(max / 25);
        for (let i = 0; i < n; i++) segs.push(`<i class="${cls}" style="--f:${Math.max(0, Math.min(1, (cur - i * 25) / 25))}"></i>`);
      }
      const key = segs.join('');
      if (key !== this.segCache) { $('hp-segs').innerHTML = key; this.segCache = key; }
      $('hp-cur').textContent = Math.ceil(p.total());
      $('hp-max').textContent = p.maxTotal();
      $('player').classList.toggle('low', p.alive && p.frac() < 0.35);
      $('vignette').style.opacity = p.alive ? String(Math.max(0, 0.55 - p.frac()) * 1.4) : '0.4';
      // ult
      const up = p.ultPct();
      $('ult-ring').style.strokeDashoffset = String(263.9 * (1 - up / 100));
      $('ult-pct').textContent = p.ultReady() ? 'READY' : up + '%';
      $('ult').classList.toggle('ready', p.ultReady());
      // abilities
      const ab = (id, left, txt) => {
        const el = $(id);
        el.classList.toggle('cooling', left > 0);
        el.querySelector('.cd').textContent = left > 0 ? Math.ceil(left) : (txt || '');
      };
      ab('ab-charge', p.has('charging') ? 0 : p.cdLeft('charge'));
      ab('ab-fire', p.cdLeft('fire'));
      const b = p.barrier;
      ab('ab-shield', Math.max(0, b.brokenUntil - t));
      $('ab-shield').classList.toggle('active', b.up);
      $('barrier-fill').style.width = (b.hp / b.maxHp * 100) + '%';
      $('barrier-num').textContent = Math.ceil(b.hp);
      $('barrier-hp').classList.toggle('show', !g.autopilot && (b.up || b.hp < b.maxHp));
      $('barrier-hp').classList.toggle('low', b.hp < 600);
      // status banner
      let banner = '';
      if (g.autopilot) banner = '';
      else if (!p.alive) banner = 'ELIMINATED — SPECTATING';
      else if (p.has('knock')) banner = 'KNOCKED DOWN';
      else if (p.has('grav')) banner = 'GRAVITON SURGE';
      else if (p.has('stun')) banner = 'STUNNED';
      else if (p.has('pinned')) banner = 'PINNED';
      $('status-banner').textContent = banner;
      $('status-banner').classList.toggle('show', !!banner);
      // feeds
      this.feed = this.feed.filter((f) => t - f.t < 7);
      this.comms = this.comms.filter((c) => t - c.t < 4.5);
      // coach
      if (this.coachOn) this.coach();
      $('coach').classList.toggle('show', this.coachOn && t < this.coachUntil && !!this.coachText);
      this.tracker();
      this.drawOverlay();
    }

    // health bars and names over heads
    drawOverlay() {
      const g = this.g, ctx = this.ctx, cam = g.world.camera, W = innerWidth, H = innerHeight;
      ctx.clearRect(0, 0, W, H);
      const p = g.player.u, v = new T.Vector3();
      const camPos = cam.position;
      for (const u of g.units) {
        if (u === p && g.player.third < 0.5) continue;
        if (!u.alive) continue;
        v.set(u.pos.x, u.pos.y + u.height + 0.35 + (u.hero === 'zenyatta' ? 0.2 : 0), u.pos.z);
        const d = v.distanceTo(camPos);
        if (d > 60) continue;
        const s = v.clone().project(cam);
        if (s.z > 1 || s.x < -1.1 || s.x > 1.1 || s.y < -1.1 || s.y > 1.1) continue;
        const ally = u.team === p.team;
        const seen = g.world.los(camPos, u.center(new T.Vector3()), 0.3);
        if (!ally && !seen) continue;
        const x = (s.x + 1) / 2 * W, y = (1 - s.y) / 2 * H;
        const w = Math.max(36, Math.min(90, 900 / d)), h = 5;
        const max = u.maxTotal() + u.tempArmor + u.temp;
        const parts = [[u.hp, '#ffffff'], [u.armor + u.tempArmor, '#ffcc33'], [u.shields + u.temp, '#6cc8ff']];
        ctx.globalAlpha = seen ? 0.95 : 0.5;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
        let ox = x - w / 2;
        for (const [val, col] of parts) {
          const pw = w * Math.max(0, val) / max;
          ctx.fillStyle = ally ? col : (col === '#ffffff' ? '#ff4a5a' : col);
          ctx.fillRect(ox, y, pw, h);
          ox += pw;
        }
        if (ally) {
          ctx.font = '600 12px "Saira Semi Condensed", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#9fdcff';
          ctx.fillText(u.name, x, y - 5);
        }
        if (u.st.discord && u.st.discord.until > g.time) { ctx.fillStyle = '#b05cff'; ctx.beginPath(); ctx.arc(x + w / 2 + 7, y + 2, 4, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
    }

    // ---------------------------------------------------------------- events
    kill(e) {
      const g = this.g, killer = e.killer, victim = e.unit;
      const row = document.createElement('div');
      row.className = 'kf';
      const side = (u) => (u.team === g.blue ? 'blue' : 'red');
      row.innerHTML = (killer ? `<span class="n ${side(killer)}">${esc(killer.name)}</span><span class="hx sm" style="--c:${killer.H.color}">${killer.H.short}</span>` : '') +
        `<span class="kfab">${esc(e.kind || '')}</span>` +
        `<span class="hx sm" style="--c:${victim.H.color}">${victim.H.short}${e.mech ? '·MECH' : ''}</span><span class="n ${side(victim)}">${esc(victim.name)}</span>`;
      $('killfeed').prepend(row);
      setTimeout(() => row.classList.add('fade'), 6000);
      setTimeout(() => row.remove(), 7000);
      while ($('killfeed').children.length > 6) $('killfeed').lastChild.remove();
    }

    comm(u, text) {
      const g = this.g;
      const row = document.createElement('div');
      row.className = 'cm ' + (u.team === g.blue ? 'blue' : 'red');
      row.innerHTML = `<span class="spk" style="--c:${u.H.color}">${esc(u.H.short)}</span><span>${esc(text)}</span>`;
      $('comms').appendChild(row);
      setTimeout(() => row.classList.add('fade'), 3800);
      setTimeout(() => row.remove(), 4500);
      while ($('comms').children.length > 5) $('comms').firstChild.remove();
    }

    ultLine(u, line, ally) {
      const row = document.createElement('div');
      row.className = 'ulnl ' + (ally ? 'blue' : 'red');
      row.innerHTML = `<b>${esc(u.H.name)}</b> “${esc(line)}”`;
      $('ultlines').appendChild(row);
      setTimeout(() => row.classList.add('fade'), 2400);
      setTimeout(() => row.remove(), 3000);
    }

    hit(kill) {
      const el = $('hitmark');
      el.className = kill ? 'kill' : 'hit';
      void el.offsetWidth;
      el.classList.add('on');
    }

    hurtFrom(src) {
      const g = this.g, p = g.player.u;
      if (!src) return;
      const a = Math.atan2(src.pos.x - p.pos.x, src.pos.z - p.pos.z) - p.yaw;
      const el = document.createElement('i');
      el.style.transform = `rotate(${-a}rad)`;
      $('dmgdir').appendChild(el);
      setTimeout(() => el.remove(), 700);
    }

    center(text, secs = 2, cls = '') {
      const el = $('center-msg');
      el.textContent = text;
      el.className = 'show ' + cls;
      clearTimeout(this.cTimer);
      this.cTimer = setTimeout(() => { el.className = ''; }, secs * 1000);
    }

    toggleCoach() { this.coachOn = !this.coachOn; $('s-coach').checked = this.coachOn; }

    showScore(on) {
      const el = $('scoreboard');
      if (!on) { el.classList.add('hidden'); return; }
      const g = this.g, rows = (team) => g.team(team).map((u) =>
        `<tr class="${u.alive ? '' : 'dead'}"><td><span class="hx sm" style="--c:${u.H.color}">${u.H.short}</span></td><td>${esc(u.name)}</td><td>${u.stats.kills}</td><td>${u.stats.deaths}</td><td>${Math.round(u.stats.dmg)}</td><td>${Math.round(u.stats.heal)}</td><td>${Math.round(u.stats.blocked)}</td><td>${u.stats.ults}</td><td>${u.ultPct()}%</td></tr>`).join('');
      el.innerHTML = `<table><thead><tr><th></th><th>Player</th><th>E</th><th>D</th><th>Damage</th><th>Healing</th><th>Blocked</th><th>Ults</th><th>Ult</th></tr></thead>
        <tbody class="blue">${rows(g.blue)}</tbody><tbody class="red">${rows(g.red)}</tbody></table>`;
      el.classList.remove('hidden');
    }

    // ---------------------------------------------------------------- ult tracker
    tracker() {
      const g = this.g, t = g.time;
      if (t - (this.trackAt || 0) < 0.25) return;
      this.trackAt = t;
      const blue = g.team(g.blue).map((u) => {
        const s = !u.alive ? '<em class="x">dead</em>' : (u.ultReady() ? '<em class="ok">READY</em>' : `${u.ultPct()}%`);
        return `<div class="ut"><span class="hx sm" style="--c:${u.H.color}">${u.H.short}</span><span class="un">${esc(u.H.ult)}</span><span class="us">${s}</span></div>`;
      }).join('');
      const red = g.team(g.red).map((u) => {
        const used = g.usedAt[u.id];
        let s;
        if (!u.alive) s = '<em class="x">dead</em>';
        else if (used !== undefined && t - used < 25) s = `<em class="used">used ${Math.floor(t - used)}s ago</em>`;
        else if (u.ultReady()) s = '<em class="warn">likely up</em>';
        else s = '<em class="dim">building</em>';
        return `<div class="ut"><span class="hx sm" style="--c:${u.H.color}">${u.H.short}</span><span class="un">${esc(u.H.ult)}</span><span class="us">${s}</span></div>`;
      }).join('');
      $('ut-blue').innerHTML = blue;
      $('ut-red').innerHTML = red;
    }

    // ---------------------------------------------------------------- watch-mode narration
    // In watch mode the coach box explains the fight as it happens instead of giving you instructions.
    bindNarration() {
      const g = this.g;
      const side = (u) => (u.team === g.blue ? 'Our' : 'Their');
      const say = (text, prio = 6, secs = 3.5) => { if (g.autopilot && this.coachOn) this.tip('n' + g.time.toFixed(2), text, prio, secs, 0); };
      g.on('engage', (e) => say(e.team === g.blue ? 'Lúcio amps the speed: <b>our engage</b>. Everyone goes in together.' : '<b>They engage</b>: their deathball walks into ours.', 5));
      g.on('gravLanded', (e) => say(`${side(e.unit)} Zarya gravs <b>${e.count}</b>. ${e.count >= 2 ? 'Now the follow-up: a bomb or a Shatter, unless the other side spends a save.' : 'A weak grav: it only pulls one in.'}`, 8));
      g.on('ult', (e) => {
        const u = e.unit, s = side(u);
        const lines = {
          bomb: g.gravs.some((f) => f.team === u.team && f.until > g.time) ? `${s} D.Va bombs into the grav: the classic combo.` : `${s} D.Va bombs. Break line of sight or get behind a shield.`,
          trans: `${s} Zen transcends: 300 healing a second to soak the damage. That save is gone now.`,
          beat: `${s} Lúcio drops the beat: 750 shields on everyone in range, the answer to a bomb.`,
          rally: `${s} Brigitte rallies: armour for the brawl.`,
          shatter: `${s} Reinhardt swings down Earthshatter.`,
        };
        if (lines[e.kind]) say(lines[e.kind], 7);
      });
      g.on('shatterLanded', (e) => say(e.hits.length ? `Shatter catches <b>${e.hits.length}</b>: free kills for the next 2.5 seconds.` : 'The Shatter hits nothing: wasted.', 8));
      g.on('shatterBlocked', () => say('That Shatter went into a shield.', 8));
      g.on('bombExploded', (e) => say(e.victims.length ? `The bomb hits ${e.victims.length}.` : 'The bomb is blocked or dodged: wasted.', 8));
      g.on('bubble', (e) => { if (e.target.recentDmg > 100) say(`${side(e.unit)} Zarya bubbles the ${e.target.H.name} just in time.`, 4, 2.5); });
    }

    // ---------------------------------------------------------------- coach
    tip(id, text, prio, secs = 3.2, cool = 12) {
      const t = this.g.time;
      if ((this.coachSaid[id] || -99) + cool > t) return false;
      if (t < this.coachUntil && prio <= this.coachPrio) return false;
      this.coachSaid[id] = t;
      this.coachText = text;
      this.coachPrio = prio;
      this.coachUntil = t + secs;
      $('coach-text').innerHTML = text;
      return true;
    }

    coach() {
      const g = this.g, p = g.player.u, t = g.time;
      if (g.autopilot || t - (this.coachAt || 0) < 0.2 || !p.alive || g.state !== 'fight') return;
      this.coachAt = t;
      const blueD = g.directors[g.blue], redD = g.directors[g.red];
      const foes = g.team(g.red).filter((u) => u.alive);
      const eRein = foes.find((u) => u.hero === 'reinhardt');
      const near = foes.filter((u) => u.pos.distanceTo(p.pos) < 9).length;
      const eShatter = eRein && eRein.ultReady();
      const bombs = g.bombs.filter((b) => b.team === g.red && !b.done);
      const allyGrav = g.gravs.find((f) => f.team === g.blue && f.until > t);
      const enemyGrav = g.gravs.find((f) => f.team === g.red && f.until > t);
      const saves = (redD.enemyUsed && 0) + (foes.some((u) => u.hero === 'zenyatta' && u.ultReady()) ? 1 : 0) + (foes.some((u) => u.hero === 'lucio' && u.ultReady()) ? 1 : 0);
      const transUsed = g.team(g.red).some((u) => u.hero === 'zenyatta' && g.usedAt[u.id] !== undefined && t - g.usedAt[u.id] < 10);
      const beatUsed = g.team(g.red).some((u) => u.hero === 'lucio' && g.usedAt[u.id] !== undefined && t - g.usedAt[u.id] < 10);
      const k = (s) => `<kbd>${s}</kbd>`;

      if (bombs.length) {
        const b = bombs[0];
        const facing = p.barrierUp() && Math.abs(G.Combat.angleTo(p, b.pos)) < p.H.barrier.halfArc;
        if (!facing) this.tip('bomb', `BOMB! Hold ${k('RMB')} and turn your shield toward the mech. Your team hides behind you.`, 10, 2.5, 4);
        else this.tip('bombOk', 'Shield is on the bomb — hold it till it blows.', 9, 2, 4);
        return;
      }
      if (allyGrav && allyGrav.caught.size >= 2) {
        if (p.ultReady() && saves === 0) { this.tip('gravShatter', `GRAV with no saves left — ${k('Q')} Earthshatter into it now!`, 9, 2.5, 6); return; }
        this.tip('grav', `Grav is down: get in and swing ${k('LMB')} on the pulled enemies, ${k('E')} Fire Strike the clump.`, 8, 2.5, 8);
        return;
      }
      if (enemyGrav && p.has('grav')) { this.tip('gravved', `You're in their grav. Hold ${k('RMB')} and turn your shield at their damage; your Zen's Trans or Lúcio's Beat saves the rest.`, 8, 2.5, 8); return; }
      if (p.ultReady() && eRein && eRein.alive) {
        const shieldDown = !eRein.barrier.up || Math.abs(G.Combat.angleTo(eRein, p.pos)) > eRein.H.barrier.halfArc;
        const inCone = foes.filter((u) => u.pos.distanceTo(p.pos) < 18 && Math.abs(G.Combat.angleTo(p, u.pos)) < 0.45).length;
        if (shieldDown && inCone >= 2) { this.tip('shatterNow', `Their Rein's shield is down and ${inCone} are in front of you — ${k('Q')} SHATTER!`, 8, 2.2, 5); return; }
        if (transUsed || beatUsed) { this.tip('savesGone', `Their ${transUsed ? 'Trans' : 'Beat'} is gone. Your next ult wins the fight: line up ${k('Q')} past their shield.`, 7, 3, 10); return; }
        this.tip('holdShatter', 'Shatter is up. Don\'t throw it into a shield: wait for their Rein to drop it, swing, or turn.', 4, 3.5, 25);
      }
      if (eShatter && !p.barrierUp() && p.action && p.action.name === 'swing' && eRein.pos.distanceTo(p.pos) < 14 && Math.abs(G.Combat.angleTo(eRein, p.pos)) < 0.5) {
        this.tip('punish', 'Careful: their Rein has Shatter and you\'re swinging with no shield in his face.', 7, 3, 10);
        return;
      }
      if (p.barrier.up && p.barrier.hp < 500) { this.tip('lowShield', 'Shield is cracking. Step back behind your Brig and let it regen, or drop it and swing if you\'re on top of them.', 6, 3, 10); return; }
      if (p.frac() < 0.35) { this.tip('lowHp', 'You\'re low. Hold shield and back up into your Brig\'s packs and Zen\'s Harmony.', 6, 3, 10); return; }
      if (blueD.phase === 'engage' && t - blueD.phaseAt < 3) { this.tip('engage', `Lucio's speeding in — GO with them! Close in, drop shield on top of them and swing ${k('LMB')}.`, 7, 3, 8); return; }
      if (near >= 3 && !p.barrierUp() && blueD.phase !== 'engage') { this.tip('alone', 'You\'re in front of your team. Shield up or back off — they haven\'t gone in yet.', 6, 3, 10); return; }
      if (p.ready('fire')) {
        const lined = foes.filter((u) => u.pos.distanceTo(p.pos) < 25 && Math.abs(G.Combat.angleTo(p, u.pos)) < 0.12).length;
        if (lined >= 2) { this.tip('fire', `${lined} of them lined up: ${k('E')} Fire Strike goes through shields.`, 5, 2.5, 12); return; }
      }
      const mates = g.team(g.blue).filter((u) => u.alive && u !== p);
      if (mates.length && blueD.phase !== 'engage') {
        const c = mates.reduce((a, u) => a.add(u.pos), new THREE.Vector3()).multiplyScalar(1 / mates.length);
        if (c.distanceTo(p.pos) > 14) { this.tip('lag', 'Your team is setting up without you. Get to them: they won\'t go in for long without their Rein.', 5, 3.5, 12); return; }
      }
      if (blueD.phase === 'approach') this.tip('walk', `Lead with your shield (${k('RMB')}). Six people walk in behind it; Zen and Lucio need that cover.`, 3, 4, 30);
      else if (blueD.phase === 'poke') this.tip('poke', 'Poke phase: hold the shield, let Zen discord and D.Va poke. Wait for Lucio\'s speed — don\'t walk in alone.', 3, 4, 30);
    }
  }

  G.HUD = HUD;
})(window.G = window.G || {});

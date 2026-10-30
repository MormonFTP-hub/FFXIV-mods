// Action priority lists for the simulator, written the way SimulationCraft writes them:
//
//   actions.precombat=holySpirit,at=-1.5        # pressed at a set time before the pull (0 = the pull)
//   actions=/fightOrFlight,if=combo.fastBlade
//   actions+=/call_action_list,name=aoe,if=targets>=3
//   actions+=/goringBlade
//
// Each decision walks the list from the top and takes the first action that can go now and whose `if=` holds.
// GCDs are taken only when the GCD is ready; abilities (oGCDs) only when they fit before the next GCD without
// delaying it, unless the line says `pre=1` (may go in front of a ready GCD, e.g. Swiftcast) or `clip=1`.
// `line_cd=N` stops a line repeating within N seconds; `call_action_list` runs another list and falls through
// when it picks nothing, `run_action_list` runs it instead of the rest. Names in conditions are listed in
// B.SimAPL.HELP. Action names are the job module's own ids (js/jobs/*.js).
(function (B) {
  const EPS = 1e-6;

  const OPTIONS = ['if', 'at', 'line_cd', 'pre', 'clip', 'name', 'value', 'sec'];

  function parseEntry(body, lineNo) {
    const parts = body.split(',').map(s => s.trim()).filter(Boolean);
    if (!parts.length) return null;
    const ent = { action: parts[0], line: lineNo, opts: {}, errors: [] };
    for (const kv of parts.slice(1)) {
      const k = kv.indexOf('=');
      const key = k < 0 ? kv : kv.slice(0, k).trim();
      if (!OPTIONS.includes(key)) ent.errors.push(`line ${lineNo}: unknown option "${key}" (known: ${OPTIONS.join(', ')})`);
      else if (ent.opts[key] !== undefined) ent.errors.push(`line ${lineNo}: "${key}" given twice; the last one counts`);
      ent.opts[key] = k < 0 ? '1' : kv.slice(k + 1).trim();
    }
    return ent;
  }

  // text → { lists: { default: [...], precombat: [...], ... }, errors: [...] }
  function parse(text) {
    const lists = { default: [], precombat: [] };
    const errors = [];
    String(text || '').split(/\r?\n/).forEach((raw, i) => {
      const line = raw.replace(/#.*$/, '').trim();
      if (!line) return;
      const m = line.match(/^actions(?:\.([A-Za-z0-9_]+))?\s*(\+?=)\s*\/?(.*)$/);
      if (!m) { errors.push(`line ${i + 1}: expected actions=… or actions+=/…`); return; }
      const name = m[1] || 'default';
      if (m[2] === '=' && lists[name] && lists[name].length) lists[name] = [];     // `=` starts the list over
      const ent = parseEntry(m[3], i + 1);
      if (ent) { errors.push(...ent.errors); (lists[name] = lists[name] || []).push(ent); }
    });
    return { lists, errors };
  }

  // ---------- names usable in conditions ----------
  // The context is one object the runner keeps up to date: { e: engine, job, A: actions, end, sim }.
  function resolver(job, A, warn) {
    const st = (key) => { if (!(B.STATUSES[key])) warn(`unknown status "${key}"`); return key; };
    const act = (id) => { if (!A[id]) warn(`unknown action "${id}"`); return id; };
    const self = (c, key) => { const s = c.e.statuses[key]; return s && s.until > c.e.now + EPS ? s : null; };
    const tgt = (c, key) => { const s = c.e.tStatuses[key]; return s && s.until > c.e.now + EPS ? s : null; };
    const cdOf = (c, id) => (A[id] ? c.e.cd(id) : null);
    const fields = {
      up: (s) => (s ? 1 : 0), down: (s) => (s ? 0 : 1), react: (s) => (s ? 1 : 0),
      stacks: (s) => (s ? (s.stacks !== undefined ? s.stacks : 1) : 0),
    };

    return function resolve(path) {
      const p = path.split('.');
      const head = p[0];
      switch (head) {
        case 'time': return (c) => c.e.now - c.t0;
        case 'now': return (c) => c.e.now;     // the engine's own clock, for gauge timers kept in it (gauge.lilyAt-now)
        case 'remains': return (c) => Math.max(0, c.end - c.e.now);
        case 'fight':
          if (p[1] === 'remains') return (c) => Math.max(0, c.end - c.e.now);
          if (p[1] === 'length') return (c) => c.end - c.t0;
          break;
        case 'targets': case 'active_enemies': return (c) => c.e.targets;
        case 'level': return (c) => c.e.level;
        case 'moving': return (c) => (c.e.moving ? 1 : 0);
        case 'movement':       // movement.in: seconds until the next forced movement; movement.remains: left of this one
          if (p[1] === 'in') return (c) => Math.min(999, c.sim.moveIn ? c.sim.moveIn() : 999);
          if (p[1] === 'remains') return (c) => (c.sim.moveLeft ? c.sim.moveLeft() : 0);
          throw new Error(`${path}: movement has in, remains`);
        case 'combat': return (c) => (c.e.inCombat ? 1 : 0);
        case 'mp':
          if (p[1] === 'max') return (c) => c.e.maxMp;
          if (p[1] === 'deficit') return (c) => c.e.maxMp - c.e.mp;
          if (p[1] === 'pct') return (c) => 100 * c.e.mp / c.e.maxMp;
          return (c) => c.e.mp;
        case 'gcd':
          if (p[1] === 'remains') return (c) => Math.max(0, c.e.gcdEnd - c.e.now);
          if (p[1] === 'ready') return (c) => (c.e.gcdEnd <= c.e.now + EPS ? 1 : 0);
          return (c) => c.e.gcdRecast();
        case 'buff': case 'debuff': {
          const key = st(p[1]);
          const get = head === 'buff' ? self : tgt;
          const f = p[2] || 'up';
          if (f === 'remains') return (c) => { const s = get(c, key); return s ? s.until - c.e.now : 0; };
          if (f === 'duration') return (c) => { const s = get(c, key); return s ? s.dur : 0; };
          if (!fields[f]) throw new Error(`${path}: buffs have up, down, remains, stacks`);
          return (c) => fields[f](get(c, key));
        }
        case 'cd': case 'cooldown': {
          const id = act(p[1]);
          const f = p[2] || 'ready';
          return (c) => {
            const k = cdOf(c, id);
            if (!k) return 0;
            const left = k.charges > 0 ? 0 : Math.max(0, k.nextAt - c.e.now);
            switch (f) {
              case 'ready': case 'up': return k.charges > 0 ? 1 : 0;
              case 'remains': return left;
              case 'charges': return k.charges;
              case 'charges_fractional': return k.charges + (k.nextAt !== null ? 1 - Math.max(0, k.nextAt - c.e.now) / k.recast : 0);
              case 'max': case 'max_charges': return k.max;
              case 'full': return k.charges >= k.max ? 1 : 0;
              case 'fullin': case 'full_recharge_time':
                return k.charges >= k.max ? 0 : Math.max(0, k.nextAt - c.e.now) + (k.max - k.charges - 1) * k.recast;
              case 'recast': case 'duration': return k.recast;
            }
            throw new Error(`${path}: cooldowns have ready, remains, charges, max, full, fullin, recast`);
          };
        }
        case 'combo': {
          if (p[1] === 'any' || !p[1]) return (c) => (c.e.combo && c.e.combo.until > c.e.now ? 1 : 0);
          const id = act(p[1]);
          return (c) => (c.e.inCombo(id) ? 1 : 0);
        }
        case 'ready': {        // could be pressed right now (GCD or recast permitting) and meets its conditions
          const id = p[1];
          act(id);
          return (c) => {
            const r = c.e.resolve(id);
            return A[r] && c.e.availableAt(r) <= c.e.now + EPS && !c.e.checkConditions(r) ? 1 : 0;
          };
        }
        case 'usable': {       // meets its conditions (gauge, procs, MP), whatever the timers say
          const id = p[1];
          act(id);
          return (c) => { const r = c.e.resolve(id); return A[r] && !c.e.checkConditions(r) ? 1 : 0; };
        }
        case 'proc': {         // the job's own highlight for a button (what glows on the hotbar)
          const id = p[1];
          return (c) => (c.job.proc && c.job.proc(id, c.e) ? 1 : 0);
        }
        case 'is': {           // is.<id>: this button currently stands for that action (Fire → Paradox)
          const btn = p[1], as = p[2];
          return (c) => (c.e.resolve(btn) === as ? 1 : 0);
        }
        case 'action': {
          const id = act(p[1]);
          const f = p[2] || 'cast_time';
          if (f === 'cast_time' || f === 'cast') return (c) => (A[id] ? c.e.castTimeFor(id) : 0);
          if (f === 'mp' || f === 'cost') return (c) => (A[id] ? c.e.mpCost(id) : 0);
          if (f === 'potency') return () => (A[id] && A[id].potency) || 0;
          throw new Error(`${path}: actions have cast_time, mp, potency`);
        }
        case 'gauge': {        // the job's gauge object (e.g), any depth: gauge.kenki, gauge.sen.setsu
          const keys = p.slice(1);
          if (!keys.length) throw new Error('gauge needs a field: gauge.kenki');
          return (c) => {
            let v = c.e.g;
            for (const k of keys) { if (v === null || v === undefined) return 0; v = v[k]; }
            if (v && typeof v === 'object') return v.until !== undefined ? (v.until > c.e.now ? 1 : 0) : 1;
            return v;
          };
        }
        case 'job': {          // job.<method>: the job module's helper called with the engine (job.senCount)
          const fn = p[1];
          if (typeof job[fn] !== 'function') warn(`the job has no method "${fn}"`);
          return (c) => (typeof c.job[fn] === 'function' ? c.job[fn](c.e) : 0);
        }
        case 'raid': {         // the party's raid buffs (Party in the simulator): raid.up, raid.chain.remains
          const which = p.length > 2 ? p[1] : null;
          const f = p.length > 2 ? p[2] : p[1] || 'up';
          if (!['up', 'down', 'remains', 'in'].includes(f)) throw new Error(`${path}: raid buffs have up, down, remains, in`);
          return (c) => c.sim.raidQuery(which, f, c.e.now);     // engine time: the runner shifts it
        }
        case 'prev': {         // prev.<id>: the last action used; prev_gcd.<id>: the last GCD
          const id = p[1];
          return (c) => (c.sim.lastAction === id ? 1 : 0);
        }
        case 'prev_gcd': {
          const id = p[1];
          return (c) => (c.sim.lastGcd === id ? 1 : 0);
        }
        case 'var': {          // var.<name>: a number the list sets with variable,name=x,value=…
          const name = p[1];
          return (c) => c.sim.vars[name] || 0;
        }
        case 'iteration': return (c) => c.sim.iteration;
      }
      throw new Error(`unknown name "${path}"`);
    };
  }

  // Compile a parsed list for one job: every condition becomes a closure, every name gets checked.
  function compile(parsed, job, A) {
    const warnings = [];
    const warn = (m) => { if (!warnings.includes(m)) warnings.push(m); };
    const resolve = resolver(job, A, warn);
    const lists = {};
    for (const [name, ents] of Object.entries(parsed.lists)) {
      lists[name] = ents.map(ent => {
        const o = ent.opts;
        const out = { action: ent.action, line: ent.line, pre: o.pre === '1', clip: o.clip === '1', lineCd: +o.line_cd || 0, last: -1e9 };
        if (o.at !== undefined) out.at = +o.at;
        try { out.cond = o.if ? B.SimExpr.compile(o.if, resolve) : null; }
        catch (err) { warnings.push(`line ${ent.line}: ${err.message}`); out.cond = () => 0; }
        if (ent.action === 'call_action_list' || ent.action === 'run_action_list') {
          out.call = o.name;
          out.run = ent.action === 'run_action_list';
          if (!parsed.lists[o.name]) warnings.push(`line ${ent.line}: no list called "${o.name}"`);
        } else if (ent.action === 'variable') {
          out.varName = o.name;
          try { out.value = B.SimExpr.compile(o.value || '0', resolve); }
          catch (err) { warnings.push(`line ${ent.line}: ${err.message}`); out.value = () => 0; }
        } else if (ent.action === 'wait') {
          out.wait = true;
          try { out.sec = B.SimExpr.compile(o.sec || '0.1', resolve); }
          catch (err) { warnings.push(`line ${ent.line}: ${err.message}`); out.sec = () => 0.1; }
        } else if (!A[ent.action]) warnings.push(`line ${ent.line}: the job has no action "${ent.action}"`);
        return out;
      });
    }
    return { lists, warnings: parsed.errors.concat(warnings) };
  }

  // Pick what to press now. Returns { entry, id } for an action, { wait: seconds } to hold, or null.
  // ctx: { e, job, A, end, sim }.
  function choose(compiled, ctx) {
    const e = ctx.e, now = e.now;
    if (e.casting || e.lockUntil > now + EPS) return null;
    const gcdReady = e.gcdEnd <= now + EPS;
    const moveIn = ctx.sim.moveIn ? ctx.sim.moveIn() : Infinity;
    // Can any GCD on the list go? If not, abilities needn't wait for one (e.g. during movement).
    let pass = 0;
    const visit = (list, depth) => {
      for (const ent of list) {
        if (ent.lineCd && now - ent.last < ent.lineCd - EPS) continue;
        if (ent.call) {
          if (depth > 8 || (ent.cond && !ent.cond(ctx))) continue;
          const r = visit(compiled.lists[ent.call] || [], depth + 1);
          if (r || ent.run) return r;
          continue;
        }
        if (ent.varName) { if (!ent.cond || ent.cond(ctx)) ctx.sim.vars[ent.varName] = ent.value(ctx); continue; }
        if (ent.wait) { if (!ent.cond || ent.cond(ctx)) return { wait: Math.max(0.01, ent.sec(ctx)), entry: ent }; continue; }
        const id = e.resolve(ent.action);
        const a = ctx.A[id];
        if (!a) continue;
        if (a.kind === 'gcd') {
          if (!gcdReady || pass === 1) continue;
          // Don't start a cast that forced movement would cut off (slidecasting allowed).
          if (moveIn < Infinity && a.cast && moveIn < e.castTimeFor(id) - B.SLIDECAST) continue;
        } else {
          if (pass === 0 && gcdReady && !ent.pre) continue;
          if (pass === 0 && !gcdReady && !ent.clip && now + e.animLock(a.lock, true) > e.gcdEnd + 0.01) continue;
        }
        if (e.availableAt(id) > now + EPS) continue;
        if (e.checkConditions(id)) continue;
        if (ent.cond && !ent.cond(ctx)) continue;
        return { entry: ent, id };
      }
      return null;
    };
    const r = visit(compiled.lists.default || [], 0);
    if (r || !gcdReady) return r;
    // The GCD is ready but nothing on the list can use it: let abilities through.
    pass = 1;
    return visit(compiled.lists.default || [], 0);
  }

  const HELP = [
    ['time', 'seconds since the pull'],
    ['now', 'the engine clock, for a gauge timer stored as a time (gauge.lilyAt-now)'],
    ['remains / fight.remains', 'seconds left in this iteration\'s fight'],
    ['targets', 'enemies in reach (Fight → Targets)'],
    ['gcd, gcd.remains, gcd.ready', 'the GCD\'s length, time until it\'s ready'],
    ['mp, mp.max, mp.deficit, mp.pct', 'MP'],
    ['moving, movement.in, movement.remains', 'moving now; seconds until the next forced movement, and left of this one (Movement fights)'],
    ['buff.X.up / down / remains / stacks', 'your statuses (the job module\'s status keys)'],
    ['debuff.X.up / remains', 'statuses on the target (DoTs, Chain Stratagem)'],
    ['cd.X.ready / remains / charges / max / full / fullin', 'recasts and charges'],
    ['combo.X', 'X was the last combo weaponskill and the combo is still running'],
    ['ready.X', 'X could be pressed right now'],
    ['usable.X', 'X\'s requirements are met (gauge, procs, MP), whatever its timer says'],
    ['proc.X', 'X is highlighted on the hotbar'],
    ['is.BUTTON.ACTION', 'the button currently stands for that action (fire.paradox)'],
    ['action.X.cast_time / mp / potency', 'an action\'s numbers'],
    ['gauge.F', 'the job gauge (gauge.kenki, gauge.sen.setsu)'],
    ['job.F', 'one of the job module\'s helpers, called with the engine'],
    ['raid.up / remains / in', 'party raid buffs: any up, time left, time until the next window'],
    ['raid.NAME.up / remains', 'one raid buff (divination, litany, chain, …)'],
    ['prev.X, prev_gcd.X', 'the last action, the last GCD'],
    ['var.NAME', 'set with actions+=/variable,name=NAME,value=EXPR'],
  ];

  B.SimAPL = { parse, compile, choose, HELP };
})(window.BLM);

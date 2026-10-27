// Paladin, Dawntrail (patches 7.0–7.57) at level 100. The Fast Blade → Riot Blade → Royal Authority combo; Royal
// Authority opens Atonement → Supplication → Sepulchre and Divine Might (an instant, stronger Holy Spirit). Fight or
// Flight (+25%, 60s) readies Goring Blade (700); Imperator (580) gives four Requiescat stacks and Confiteor Ready:
// Confiteor → Blade of Faith → Blade of Truth → Blade of Valor, each 500 stronger under Requiescat, and then Blade of
// Honor (1,000). Expiacion, Circle of Scorn and Intervene go inside the burst. Spells cost MP (1,000 here): Riot
// Blade's combo, Expiacion and the Atonement chain give it back. Numbers are 7.05's (the single-target values didn't
// change from 7.05 to 7.57; 7.0–7.01 had lower ones), from the wiki's patch histories, the Lodestone notes and the
// game data at 7.57; the gear is The Balance's 7.4 savage set at 2.50.
(function (B) {
  const FOF = 1.25;
  const FALLOFF = 0.4;            // the Confiteor chain, Imperator, Expiacion and Blade of Honor: 60% less on the rest (7.2)
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.5, fx: 'gnbSlash' }, o);
  const spell = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.7, school: 'holy', mp: 1000, spell: true, fx: 'gnbBurst', sound: 'paradox' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const BLADES = ['confiteor', 'bladeOfFaith', 'bladeOfTruth', 'bladeOfValor'];

  const ACTIONS = {
    fastBlade: ws({ name: 'Fast Blade', potency: 220, comboStart: true, comboNext: true, desc: 'Delivers an attack with a potency of 220.' }),
    riotBlade: ws({ name: 'Riot Blade', potency: 170, comboPotency: 330, comboFrom: 'fastBlade', comboNext: true, fx: 'gnbSlash2', desc: 'Delivers an attack with a potency of 170.\nCombo Action: Fast Blade\nCombo Potency: 330\nCombo Bonus: Restores 1,000 MP' }),
    royalAuthority: ws({ name: 'Royal Authority', potency: 200, comboPotency: 460, comboFrom: 'riotBlade', fx: 'gnbBarrel', desc: 'Delivers an attack with a potency of 200.\nCombo Action: Riot Blade\nCombo Potency: 460\nCombo Bonus: Grants Atonement Ready and Divine Might\nDuration: 30s' }),
    atonement: ws({ name: 'Atonement', potency: 460, ready: 'atonementReady', fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 460.\nAdditional Effect: Restores MP\nAdditional Effect: Grants Supplication Ready\nDuration: 30s\nCan only be executed while under the effect of Atonement Ready.\nAtonement changes to Supplication, then Sepulchre.' }),
    supplication: ws({ name: 'Supplication', potency: 500, ready: 'supplicationReady', fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 500.\nAdditional Effect: Restores MP\nAdditional Effect: Grants Sepulchre Ready\nDuration: 30s' }),
    sepulchre: ws({ name: 'Sepulchre', potency: 540, ready: 'sepulchreReady', fx: 'gnbDouble', desc: 'Delivers an attack with a potency of 540.\nAdditional Effect: Restores MP' }),
    goringBlade: ws({ name: 'Goring Blade', potency: 700, ready: 'goringBladeReady', fx: 'gnbFang3', desc: 'Delivers an attack with a potency of 700.\nCan only be executed while under the effect of Goring Blade Ready.' }),
    shieldLob: ws({ name: 'Shield Lob', potency: 100, range: 20, delay: 0.7, fx: 'gnbShot', desc: 'Delivers a ranged attack with a potency of 100.\nAdditional Effect: Increased enmity' }),
    totalEclipse: ws({ name: 'Total Eclipse', potency: 120, comboStart: true, comboNext: true, target: false, pbaoe: 5, aoe: true, desc: 'Delivers an attack with a potency of 120 to all nearby enemies.' }),
    prominence: ws({ name: 'Prominence', potency: 100, comboPotency: 220, comboFrom: 'totalEclipse', target: false, pbaoe: 5, aoe: true, fx: 'gnbSlash2', desc: 'Delivers an attack with a potency of 100 to all nearby enemies.\nCombo Action: Total Eclipse\nCombo Potency: 220\nCombo Bonus: Restores MP\nCombo Bonus: Grants Divine Might\nDuration: 30s' }),
    holySpirit: spell({ name: 'Holy Spirit', potency: 400, dm: 500, req: 700, cast: 1.5, desc: 'Deals unaspected damage with a potency of 400.\nDivine Might Potency: 500\nRequiescat Potency: 700\nDivine Might or Requiescat: cast immediately (Divine Might is used first).' }),
    holyCircle: spell({ name: 'Holy Circle', potency: 100, dm: 250, req: 350, cast: 1.5, target: false, pbaoe: 5, aoe: true, desc: 'Deals unaspected damage with a potency of 100 to all nearby enemies.\nDivine Might Potency: 250\nRequiescat Potency: 350' }),
    confiteor: spell({ name: 'Confiteor', potency: 500, req: 1000, ready: 'confiteorReady', aoe: FALLOFF, fx: 'gnbZone', desc: 'Deals unaspected damage with a potency of 500 to target and all enemies nearby it, 60% less for all remaining enemies.\nRequiescat Potency: 1,000\nCan only be executed while under the effect of Confiteor Ready.\nConfiteor changes to Blade of Faith, Blade of Truth and Blade of Valor.' }),
    bladeOfFaith: spell({ name: 'Blade of Faith', potency: 260, req: 760, aoe: FALLOFF, fx: 'gnbZone', desc: 'Deals unaspected damage with a potency of 260 to target and all enemies nearby it, 60% less for all remaining enemies.\nRequiescat Potency: 760\nCombo Action: Confiteor' }),
    bladeOfTruth: spell({ name: 'Blade of Truth', potency: 380, req: 880, aoe: FALLOFF, fx: 'gnbZone', desc: 'Deals unaspected damage with a potency of 380 to target and all enemies nearby it, 60% less for all remaining enemies.\nRequiescat Potency: 880\nCombo Action: Blade of Faith' }),
    bladeOfValor: spell({ name: 'Blade of Valor', potency: 500, req: 1000, aoe: FALLOFF, fx: 'gnbZone', desc: 'Deals unaspected damage with a potency of 500 to target and all enemies nearby it, 60% less for all remaining enemies.\nRequiescat Potency: 1,000\nCombo Action: Blade of Truth\nAdditional Effect: Grants Blade of Honor Ready\nDuration: 30s' }),
    clemency: spell({ name: 'Clemency', potency: 0, mp: 2000, cast: 1.5, target: false, sound: 'paradox', desc: 'Restores target\'s HP.\nCure Potency: 1,000' }),
    fightOrFlight: ab({ name: 'Fight or Flight', recast: 60, desc: 'Increases damage dealt by 25%.\nDuration: 20s\nAdditional Effect: Grants Goring Blade Ready\nDuration: 30s' }),
    imperator: ab({ name: 'Imperator', recast: 60, potency: 580, target: true, range: 25, delay: 0.6, aoe: FALLOFF, fx: 'gnbZone', desc: 'Delivers an attack with a potency of 580 to target and all enemies nearby it, 60% less for all remaining enemies.\nAdditional Effect: Grants 4 stacks of Requiescat and Confiteor Ready\nDuration: 30s\nImperator changes to Blade of Honor while Blade of Honor Ready is up.' }),
    bladeOfHonor: ab({ name: 'Blade of Honor', recast: 1, potency: 1000, target: true, range: 25, delay: 0.7, aoe: FALLOFF, ready: 'bladeOfHonorReady', fx: 'gnbDouble', desc: 'Deals unaspected damage with a potency of 1,000 to target and all enemies nearby it, 60% less for all remaining enemies.\nCan only be executed while under the effect of Blade of Honor Ready.' }),
    expiacion: ab({ name: 'Expiacion', recast: 30, potency: 450, target: true, range: B.MELEE_RANGE, delay: 0.6, aoe: FALLOFF, fx: 'gnbBow', desc: 'Delivers an attack with a potency of 450 to target and all enemies nearby it, 60% less for all remaining enemies.\nAdditional Effect: Restores 400 MP' }),
    circleOfScorn: ab({ name: 'Circle of Scorn', recast: 30, potency: 140, target: false, pbaoe: 5, aoe: true, delay: 0.6, dot: { potency: 30, duration: 15, aoe: true }, fx: 'gnbBow', desc: 'Delivers an attack with a potency of 140 to all nearby enemies.\nAdditional Effect: Damage over time\nPotency: 30\nDuration: 15s' }),
    intervene: ab({ name: 'Intervene', recast: 30, charges: 2, potency: 150, target: true, range: 20, delay: 0.3, fx: 'gnbCont', desc: 'Rushes target and delivers an attack with a potency of 150.\nMaximum Charges: 2\nCannot be executed while bound.' }),
    ironWill: ab({ name: 'Iron Will', recast: 2, desc: 'Significantly increases enmity generation.\nEffect ends upon reuse.' }),
    holySheltron: ab({ name: 'Holy Sheltron', recast: 5, oath: 50, desc: 'Reduces damage taken by 15%, and more on the first 4s.\nDuration: 8s\nAdditional Effect: Regen\nOath Gauge Cost: 50' }),
    intervention: ab({ name: 'Intervention', recast: 10, oath: 50, desc: 'Reduces target party member\'s damage taken by 10%.\nDuration: 8s\nOath Gauge Cost: 50' }),
    cover: ab({ name: 'Cover', recast: 120, oath: 50, desc: 'Take all physical and magic damage for a party member.\nDuration: 12s\nOath Gauge Cost: 50' }),
    guardian: ab({ name: 'Guardian', recast: 120, desc: 'Reduces damage taken by 40%.\nAdditional Effect: Creates a barrier\nDuration: 15s' }),
    bulwark: ab({ name: 'Bulwark', recast: 90, desc: 'Block incoming attacks.\nDuration: 10s' }),
    hallowedGround: ab({ name: 'Hallowed Ground', recast: 420, desc: 'Renders you impervious to most attacks.\nDuration: 10s' }),
    divineVeil: ab({ name: 'Divine Veil', recast: 90, desc: 'Creates a barrier around self and all nearby party members.\nDuration: 30s' }),
    passageOfArms: ab({ name: 'Passage of Arms', recast: 120, desc: 'Increases block rate to 100% and creates a designated area in which party members will only suffer 85% of all damage inflicted.\nDuration: 18s\nEffect ends upon using another action or moving.' }),
    ...B.ROLE_ACTIONS.tank,
    ...B.GENERAL_ACTIONS,
    tincture: B.tincture('strdt4'),
    auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
  };

  const STATUSES = {
    fightOrFlight: { name: 'Fight or Flight', self: true, icon: 'st_fof' },
    requiescat: { name: 'Requiescat', self: true, icon: 'st_req' },
    confiteorReady: { name: 'Confiteor Ready', self: true, icon: 'st_conf' },
    goringBladeReady: { name: 'Goring Blade Ready', self: true, icon: 'st_goring' },
    atonementReady: { name: 'Atonement Ready', self: true, icon: 'st_aton' },
    supplicationReady: { name: 'Supplication Ready', self: true, icon: 'st_supp' },
    sepulchreReady: { name: 'Sepulchre Ready', self: true, icon: 'st_sep' },
    divineMight: { name: 'Divine Might', self: true, icon: 'st_dm' },
    bladeOfHonorReady: { name: 'Blade of Honor Ready', self: true, icon: 'st_honor' },
    ironWill: { name: 'Iron Will', self: true, icon: 'st_ironwill' },
    holySheltron: { name: 'Holy Sheltron', self: true, icon: 'st_sheltron' },
    guardian: { name: 'Guardian', self: true, icon: 'st_guardian' },
    bulwark: { name: 'Bulwark', self: true, icon: 'st_bulwark' },
    hallowedGround: { name: 'Hallowed Ground', self: true, icon: 'st_hallowed' },
    divineVeil: { name: 'Divine Veil', self: true, icon: 'st_veil' },
    passageOfArms: { name: 'Passage of Arms', self: true, icon: 'st_poa' },
    circleOfScorn: { name: 'Circle of Scorn', self: false, icon: 'st_scorn' },
  };

  class PaladinDT {
    constructor() {
      this.name = 'Paladin';
      this.abbr = 'PLD';
      this.role = 'tank';
      this.level = 100;
      this.levelKey = 100;
      this.model = 'pld-dt';
      this.actions = ACTIONS;
      this.statuses = STATUSES;
      this.maxMp = 10000;
      // The Balance's 7.4 savage set (Grand Champion's Falchion: 158 weapon damage, 2.24 delay), 2.50 GCD, food
      // included, without the 5% party bonus.
      this.stats = { hp: 285000, main: 6450, mainStat: 'str', jobMod: 100, trait: 100, wd: 158, det: 3066, crit: 3595,
        dh: 1230, speed: 420, ten: 622, delay: 2.24 };
      this.speedName = 'Skill speed';
      this.tierHaste = 0;
      this.autoAttack = { potency: 90, delay: 2.24, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['fightOrFlight', 'requiescat', 'confiteorReady', 'goringBladeReady', 'divineMight', 'atonementReady',
        'supplicationReady', 'sepulchreReady', 'bladeOfHonorReady', 'ironWill', 'medicated', 'holySheltron', 'rampart', 'guardian',
        'bulwark', 'hallowedGround', 'divineVeil', 'passageOfArms', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['circleOfScorn', 'reprisal'];
      this.defaultBars = [
        ['fastBlade', 'riotBlade', 'royalAuthority', 'atonement', 'holySpirit', 'goringBlade', 'confiteor', 'fightOrFlight', 'imperator', 'expiacion', 'circleOfScorn', 'intervene'],
        ['shieldLob', 'tincture', 'ironWill', 'holySheltron', 'rampart', 'guardian', 'bulwark', 'hallowedGround', 'divineVeil', 'intervention', 'reprisal', 'provoke'],
        ['totalEclipse', 'prominence', 'holyCircle', 'clemency', 'cover', 'passageOfArms', 'shirk', 'lowBlow', 'interject', 'armsLength', 'sprint', null],
      ];
      this.actionGroups = [
        ['Paladin', ['fastBlade', 'riotBlade', 'royalAuthority', 'atonement', 'supplication', 'sepulchre', 'goringBlade', 'holySpirit', 'confiteor',
          'bladeOfFaith', 'bladeOfTruth', 'bladeOfValor', 'fightOrFlight', 'imperator', 'bladeOfHonor', 'expiacion', 'circleOfScorn', 'intervene',
          'shieldLob', 'totalEclipse', 'prominence', 'holyCircle', 'clemency', 'ironWill', 'holySheltron', 'intervention', 'cover', 'guardian',
          'bulwark', 'hallowedGround', 'divineVeil', 'passageOfArms']],
        ['Role Actions', ['rampart', 'lowBlow', 'provoke', 'interject', 'reprisal', 'armsLength', 'shirk']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 26000;     // a scripted 7.x rotation on this gear parses about 24,500 on the dummy
      this.referenceGcd = 2.5;
      this.startDistance = 3.2;
    }

    initGauge() { return { oath: 0, blade: null }; }

    // Atonement becomes Supplication and Sepulchre; Confiteor becomes the three Blades; Imperator becomes Blade of Honor.
    resolveId(id, e) {
      const g = e.g;
      if (id === 'atonement') return e.has('sepulchreReady') ? 'sepulchre' : e.has('supplicationReady') ? 'supplication' : id;
      if (id === 'confiteor' && g.blade && g.blade.until > e.now) return g.blade.next;
      if (id === 'imperator' && e.has('bladeOfHonorReady')) return 'bladeOfHonor';
      return id;
    }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.ready && !e.has(a.ready)) return 'Unable to execute action.';
      if (BLADES.indexOf(id) > 0 && !(g.blade && g.blade.next === id && g.blade.until > e.now)) return 'Unable to execute action.';
      if (a.oath && g.oath < a.oath) return 'Not enough Oath Gauge.';
      return null;
    }

    reqStacks(e) { return e.has('requiescat') ? (e.statuses.requiescat.stacks || 0) : 0; }

    // Holy Spirit and Holy Circle are instant under Divine Might or Requiescat; the Confiteor chain always is.
    castTime(id, e) {
      const a = this.actions[id];
      if (!a.cast) return 0;
      if (e.has('divineMight') || this.reqStacks(e) > 0) return 0;
      return e.speedScale(a.cast, 0);
    }

    snapshot(a, e) {
      const mult = e.has('fightOrFlight') ? FOF : 1;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES.strdt4.cap : 0);
      return { mult, main };
    }

    useStack(e) {
      const st = e.statuses.requiescat;
      if (!st) return false;
      st.stacks = (st.stacks || 1) - 1;
      if (st.stacks <= 0) e.removeStatus('requiescat');
      else e.emit('statusStack', { key: 'requiescat' });
      return true;
    }

    gainMp(e, n) {
      const before = e.mp;
      e.mp = Math.min(e.maxMp, e.mp + n);
      if (e.mp > before) e.emit('mpGain', { amount: e.mp - before, source: 'tick' });
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      let potency = a.potency || 0;
      if (a.comboFrom && e.lastComboHit) potency = a.comboPotency;
      if (a.spell) e.mp -= a.mp;
      if (a.oath) g.oath -= a.oath;

      switch (id) {
        case 'riotBlade': if (e.lastComboHit) this.gainMp(e, 1000); break;
        case 'royalAuthority':
          if (e.lastComboHit) { e.addStatus('atonementReady', 30); e.addStatus('divineMight', 30); }
          break;
        case 'prominence': if (e.lastComboHit) { e.addStatus('divineMight', 30); this.gainMp(e, 500); } break;
        case 'atonement': e.removeStatus('atonementReady'); e.addStatus('supplicationReady', 30); this.gainMp(e, 400); break;
        case 'supplication': e.removeStatus('supplicationReady'); e.addStatus('sepulchreReady', 30); this.gainMp(e, 400); break;
        case 'sepulchre': e.removeStatus('sepulchreReady'); this.gainMp(e, 400); break;
        case 'goringBlade': e.removeStatus('goringBladeReady'); break;
        case 'holySpirit': case 'holyCircle':
          if (e.has('divineMight')) { e.removeStatus('divineMight'); potency = a.dm; }
          else if (this.useStack(e)) potency = a.req;
          break;
        case 'confiteor': case 'bladeOfFaith': case 'bladeOfTruth': case 'bladeOfValor': {
          if (id === 'confiteor') e.removeStatus('confiteorReady');
          if (this.useStack(e)) potency = a.req;
          const k = BLADES.indexOf(id);
          g.blade = k < 3 ? { next: BLADES[k + 1], until: e.now + 30 } : null;
          if (id === 'bladeOfValor') e.addStatus('bladeOfHonorReady', 30);
          break;
        }
        case 'fightOrFlight': e.addStatus('fightOrFlight', 20); e.addStatus('goringBladeReady', 30); break;
        case 'imperator':
          e.addStatus('requiescat', 30, { stacks: 4 });
          e.addStatus('confiteorReady', 30);
          g.blade = null;
          break;
        case 'bladeOfHonor': e.removeStatus('bladeOfHonorReady'); break;
        case 'expiacion': this.gainMp(e, 400); break;
        case 'intervene': {
          const d = e.distToTarget() || 1;
          if (d > 2.6) {
            const from = { x: e.pos.x, z: e.pos.z };
            e.pos.x *= 2.4 / d; e.pos.z *= 2.4 / d;
            e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
          }
          break;
        }
        case 'ironWill':
          if (e.has('ironWill')) e.removeStatus('ironWill');
          else e.addStatus('ironWill', 1e9, { permanent: true });
          break;
        case 'holySheltron': e.addStatus('holySheltron', 8); break;
        case 'guardian': e.addStatus('guardian', 15); break;
        case 'bulwark': e.addStatus('bulwark', 10); break;
        case 'hallowedGround': e.addStatus('hallowedGround', 10); break;
        case 'divineVeil': e.addStatus('divineVeil', 30); break;
        case 'passageOfArms': e.addStatus('passageOfArms', 18); break;
        default:
          if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
      }

      if (potency) {
        const snap = this.snapshot(a, e);
        const after = a.dot ? () => e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }) : null;
        e.queueHit(id, potency, snap, a.delay, after);
      }
    }

    // Each auto-attack adds 5 to the Oath Gauge.
    onHit(h, r, e) { if (h.auto && !h.extra) e.g.oath = Math.min(100, e.g.oath + 5); }

    proc(id, e) {
      const a = this.actions[id];
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (a.ready && e.has(a.ready)) return true;
      if (id === 'holySpirit') return e.has('divineMight') || this.reqStacks(e) > 0;
      if (BLADES.includes(id)) return true;
      return false;
    }

    mpRegen() { return B.BASE_REGEN; }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Fight or Flight fits ${Math.floor(20 / e.gcdForSpeed(e.stats.speed))} GCDs`; }

    // ---------- the Oath Gauge ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="120" viewBox="0 0 360 120">
  <defs><linearGradient id="pl-oath" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a6fd6"/><stop offset="1" stop-color="#cfe6ff"/></linearGradient></defs>
  <rect x="8" y="10" width="344" height="100" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text x="24" y="38" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">OATH GAUGE</text>
  <text id="pl-n" x="336" y="40" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="20" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">0</text>
  <rect x="24" y="52" width="312" height="14" rx="7" fill="#1d1a2a" stroke="rgba(255,255,255,.2)"/>
  <rect id="pl-bar" x="24" y="52" width="0" height="14" rx="7" fill="url(#pl-oath)"/>
  <line x1="180" y1="48" x2="180" y2="70" stroke="rgba(255,255,255,.5)"/>
  <text id="pl-req" x="24" y="94" font-family="Noto Sans, sans-serif" font-size="12" font-weight="600" fill="#ffd98a" letter-spacing="1"></text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.pg = { n: $('#pl-n'), bar: $('#pl-bar'), req: $('#pl-req'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.pg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      put('o', g.oath, v => { G.n.textContent = String(v); G.bar.setAttribute('width', String(312 * v / 100)); });
      const n = this.reqStacks(e);
      const next = g.blade && g.blade.until > e.now ? this.actions[g.blade.next].name : e.has('confiteorReady') ? 'Confiteor' : '';
      put('r', `${n}|${next}`, () => { G.req.textContent = (n ? `REQUIESCAT ×${n}` : '') + (next ? `${n ? '  ·  ' : ''}NEXT: ${next.toUpperCase()}` : ''); });
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Dawntrail 7.0–7.57)</h3>
<p>Level 100 Paladin. The combo is <b>Fast Blade → Riot Blade → Royal Authority</b> (Riot Blade's combo restores 1,000 MP). Royal Authority's combo grants <b>Atonement Ready</b> and <b>Divine Might</b>: the Atonement button then plays Atonement (460) → Supplication (500) → Sepulchre (540), and Divine Might makes the next <b>Holy Spirit</b> instant at 500. None of these break the combo, so spend them before the next Royal Authority.</p>
<p>Every 60s, <b>Fight or Flight</b> (+25% for 20s) readies <b>Goring Blade</b> (700) and <b>Imperator</b> (580) gives four <b>Requiescat</b> stacks and Confiteor Ready. The Confiteor button plays <b>Confiteor → Blade of Faith → Blade of Truth → Blade of Valor</b> (1,000 / 760 / 880 / 1,000 with Requiescat), and Blade of Valor lights <b>Blade of Honor</b> (1,000) on the Imperator button. Fit <b>Expiacion</b>, <b>Circle of Scorn</b> and both <b>Intervene</b> charges in the window too. Spells cost 1,000 MP; Riot Blade, Expiacion and the Atonement chain give it back. Auto-attacks fill the Oath Gauge for Holy Sheltron.</p>
<h3>The 7.x opener</h3>
${seq(['holySpirit', 'fastBlade', 'riotBlade', ['tincture'], 'royalAuthority', ['fightOrFlight'], ['imperator'], 'confiteor', ['circleOfScorn'], ['expiacion'], 'bladeOfFaith', ['intervene'], 'bladeOfTruth', ['intervene'], 'bladeOfValor', ['bladeOfHonor'], 'goringBlade', 'atonement', 'supplication', 'sepulchre', 'holySpirit'])}
<p>From The Balance's 7.4 Paladin guide: a hardcast Holy Spirit about 1.75s before the pull, then the burst at the third GCD. Between bursts the loop is Royal Authority → Atonement → Fast Blade → Riot Blade → Supplication → Holy Spirit (Divine Might) → Sepulchre.</p>
<p style="color:#a9a3b4">The 7.05–7.57 numbers: Fast Blade 220, Riot Blade combo 330, Royal Authority combo 460, Atonement 460, Supplication 500, Sepulchre 540, Goring Blade 700, Holy Spirit 400 / 500 / 700, Confiteor 500 / 1,000, Blades 260 / 760, 380 / 880, 500 / 1,000, Imperator 580, Blade of Honor 1,000, Expiacion 450, Circle of Scorn 140 + 30 × 15s, Intervene 150; auto-attacks 90 at 2.24s. 7.0–7.01 had Royal Authority 440, Atonement 440, Supplication 460, Sepulchre 480, Holy Spirit 370 / 470 / 670 and the Confiteor chain 60 lower. How much MP the Atonement chain gives back isn't documented (400 here). Gear is The Balance's 7.4 savage set (Strength 6,450, 158 weapon damage), with a Grade 4 Gemdraught.</p>`;
    }
  }

  B.registerJob({
    id: 'pld', name: 'Paladin', abbr: 'PLD', role: 'tank', classJob: 19,
    versions: [{ id: 'dt70', label: 'Dawntrail 7.0–7.57', history: 'DT 7.0–7.57', note: 'Level 100. Atonement → Supplication → Sepulchre, Divine Might Holy Spirit, Fight or Flight into Goring Blade, Imperator into Confiteor and the Blades, Blade of Honor; 7.05\'s numbers', create: () => new PaladinDT() }],
  });
})(window.BLM);

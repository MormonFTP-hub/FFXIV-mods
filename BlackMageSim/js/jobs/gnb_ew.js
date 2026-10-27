// Gunbreaker, Endwalker patches 6.2–6.58 at level 90: the long Bloodfest. Patch 6.2 raised its recast from 90 to
// 120 seconds, which put Gunbreaker's burst on a 2-minute rhythm, with a No Mercy every minute in between, until
// Dawntrail. Numbers are the 6.4+ values from the FFXIV wiki's patch histories (Keen Edge 200 and Brutal Shell
// 160/300 from 6.4; Solid Barrel 140/360 and Blasting Zone 720 from 6.2; the Gnashing Fang combo and Continuation
// from 6.11). Cartridges cap at 3 (Cartridge Charge II); Bloodfest adds 3.
(function (B) {
  const MAX_CARTS = 3;
  const NO_MERCY = 1.2;
  const AMMO_COMBO = 30;            // seconds to continue the Gnashing Fang combo
  const READY = ['readyToRip', 'readyToTear', 'readyToGouge', 'readyToBlast'];
  const CONTINUATION = { readyToRip: 'jugularRip', readyToTear: 'abdomenTear', readyToGouge: 'eyeGouge', readyToBlast: 'hypervelocity' };

  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.5 }, o);
  const cont = (o) => Object.assign({ kind: 'ogcd', recast: 1, cdGroup: 'continuation', target: true, range: 5, delay: 0.5 }, o);
  const ACTIONS = {
    keenEdge: ws({
      name: 'Keen Edge', potency: 200, comboStart: true, comboNext: true, fx: 'gnbSlash',
      desc: 'Delivers an attack with a potency of 200.',
    }),
    brutalShell: ws({
      name: 'Brutal Shell', potency: 160, comboPotency: 300, comboFrom: 'keenEdge', comboNext: true, fx: 'gnbSlash2',
      desc: 'Delivers an attack with a potency of 160.\nCombo Action: Keen Edge\nCombo Potency: 300\nCombo Bonus: Restores own HP\nCure Potency: 200\nCombo Bonus: Creates a barrier which nullifies damage equal to HP restored\nDuration: 30s',
    }),
    solidBarrel: ws({
      name: 'Solid Barrel', potency: 140, comboPotency: 360, comboFrom: 'brutalShell', fx: 'gnbBarrel',
      desc: 'Delivers an attack with a potency of 140.\nCombo Action: Brutal Shell\nCombo Potency: 360\nCombo Bonus: Adds a Cartridge to your Powder Gauge',
    }),
    lightningShot: ws({
      name: 'Lightning Shot', potency: 150, range: 20, breaksCombo: true, delay: 0.7, fx: 'gnbShot',
      desc: 'Delivers a ranged attack with a potency of 150.\nAdditional Effect: Increased enmity',
    }),
    burstStrike: ws({
      name: 'Burst Strike', potency: 380, carts: 1, fx: 'gnbBurst',
      desc: 'Delivers an attack with a potency of 380.\nAdditional Effect: Grants Ready to Blast\nDuration: 10s\nCartridge Cost: 1',
    }),
    gnashingFang: ws({
      name: 'Gnashing Fang', potency: 380, carts: 1, cd: 30, fx: 'gnbFang',
      desc: 'Delivers an attack with a potency of 380.\nAdditional Effect: Grants Ready to Rip\nDuration: 10s\nCartridge Cost: 1\nShares a recast timer with weaponskills.\n  Gnashing Fang changes to Savage Claw, then Wicked Talon, as the combo continues.',
    }),
    savageClaw: ws({
      name: 'Savage Claw', potency: 440, ammoFrom: 'gnashingFang', fx: 'gnbFang2',
      desc: 'Delivers an attack with a potency of 440.\nCombo Action: Gnashing Fang\nAdditional Effect: Grants Ready to Tear\nDuration: 10s',
    }),
    wickedTalon: ws({
      name: 'Wicked Talon', potency: 540, ammoFrom: 'savageClaw', fx: 'gnbFang3',
      desc: 'Delivers an attack with a potency of 540.\nCombo Action: Savage Claw\nAdditional Effect: Grants Ready to Gouge\nDuration: 10s',
    }),
    sonicBreak: ws({
      name: 'Sonic Break', potency: 300, cd: 60, dot: { potency: 60, duration: 30 }, delay: 0.6, fx: 'gnbSonic',
      desc: 'Delivers an attack with a potency of 300.\nAdditional Effect: Damage over time\nPotency: 60\nDuration: 30s',
    }),
    doubleDown: ws({
      name: 'Double Down', potency: 1200, carts: 2, cd: 60, range: 5, delay: 0.7, fx: 'gnbDouble',
      desc: 'Delivers an attack to all nearby enemies with a potency of 1,200 for the first enemy, and 15% less for all remaining enemies.\nCartridge Cost: 2',
    }),
    continuation: cont({
      name: 'Continuation', target: false,
      desc: 'Allows the firing of successive rounds with your gunblade.\nGnashing Fang may be followed by Jugular Rip.\nSavage Claw may be followed by Abdomen Tear.\nWicked Talon may be followed by Eye Gouge.\nBurst Strike may be followed by Hypervelocity.',
    }),
    jugularRip: cont({ name: 'Jugular Rip', potency: 200, ready: 'readyToRip', fx: 'gnbCont', desc: 'Delivers an attack with a potency of 200.\nCan only be executed when Ready to Rip.' }),
    abdomenTear: cont({ name: 'Abdomen Tear', potency: 240, ready: 'readyToTear', fx: 'gnbCont', desc: 'Delivers an attack with a potency of 240.\nCan only be executed when Ready to Tear.' }),
    eyeGouge: cont({ name: 'Eye Gouge', potency: 280, ready: 'readyToGouge', fx: 'gnbCont', desc: 'Delivers an attack with a potency of 280.\nCan only be executed when Ready to Gouge.' }),
    hypervelocity: cont({ name: 'Hypervelocity', potency: 180, ready: 'readyToBlast', fx: 'gnbCont', desc: 'Delivers an attack with a potency of 180.\nCan only be executed when Ready to Blast.' }),
    noMercy: {
      name: 'No Mercy', kind: 'ogcd', recast: 60,
      desc: 'Increases damage dealt by 20%.\nDuration: 20s',
    },
    bloodfest: {
      name: 'Bloodfest', kind: 'ogcd', recast: 120, target: true, range: 25,
      desc: 'Draws aetheric energy from target, adding 3 Cartridges to your Powder Gauge.',
    },
    blastingZone: {
      name: 'Blasting Zone', kind: 'ogcd', recast: 30, potency: 720, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'gnbZone',
      desc: 'Delivers an attack with a potency of 720.',
    },
    bowShock: {
      name: 'Bow Shock', kind: 'ogcd', recast: 60, potency: 150, target: true, range: 5, delay: 0.6, dot: { potency: 60, duration: 15 }, fx: 'gnbBow',
      desc: 'Delivers an attack with a potency of 150 to all nearby enemies.\nAdditional Effect: Damage over time\nPotency: 60\nDuration: 15s',
    },
    roughDivide: {
      name: 'Rough Divide', kind: 'ogcd', recast: 30, charges: 2, potency: 150, target: true, range: 20, delay: 0.3, fx: 'gnbCont',
      desc: 'Delivers a jumping attack with a potency of 150.\nCannot be executed while bound.\nMaximum Charges: 2',
    },
    royalGuard: {
      name: 'Royal Guard', kind: 'ogcd', recast: 2,
      desc: 'Significantly increases enmity generation.\nEffect ends upon reuse.',
    },
    camouflage: { name: 'Camouflage', kind: 'ogcd', recast: 90, desc: 'Increases parry rate by 50% while reducing damage taken by 10%.\nDuration: 20s' },
    nebula: { name: 'Nebula', kind: 'ogcd', recast: 120, desc: 'Reduces damage taken by 30%.\nDuration: 15s' },
    aurora: { name: 'Aurora', kind: 'ogcd', recast: 60, charges: 2, desc: 'Grants Regen to target.\nCure Potency: 200\nDuration: 18s\nMaximum Charges: 2' },
    superbolide: { name: 'Superbolide', kind: 'ogcd', recast: 360, desc: 'Reduces HP to 1 and renders you impervious to most attacks.\nDuration: 10s' },
    heartOfLight: { name: 'Heart of Light', kind: 'ogcd', recast: 90, desc: 'Reduces magic damage taken by self and nearby party members by 10%.\nDuration: 15s' },
    heartOfCorundum: { name: 'Heart of Corundum', kind: 'ogcd', recast: 25, desc: 'Reduces damage taken by target by 15%.\nDuration: 8s\nAdditional Effect: Grants Clarity of Corundum and Catharsis of Corundum.' },
    ...B.ROLE_ACTIONS.tank,
    ...B.GENERAL_ACTIONS,
    tincture: B.tincture('str'),
    auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
  };

  const STATUSES = {
    noMercy: { name: 'No Mercy', self: true, icon: 'st_nomercy' },
    readyToRip: { name: 'Ready to Rip', self: true, icon: 'st_rip' },
    readyToTear: { name: 'Ready to Tear', self: true, icon: 'st_tear' },
    readyToGouge: { name: 'Ready to Gouge', self: true, icon: 'st_gouge' },
    readyToBlast: { name: 'Ready to Blast', self: true, icon: 'st_blast' },
    brutalShell: { name: 'Brutal Shell', self: true, icon: 'st_brutal' },
    royalGuard: { name: 'Royal Guard', self: true, icon: 'st_royalguard' },
    camouflage: { name: 'Camouflage', self: true, icon: 'st_camo' },
    nebula: { name: 'Nebula', self: true, icon: 'st_nebula' },
    aurora: { name: 'Aurora', self: true, icon: 'st_aurora' },
    superbolide: { name: 'Superbolide', self: true, icon: 'st_bolide' },
    heartOfLight: { name: 'Heart of Light', self: true, icon: 'st_hol' },
    heartOfCorundum: { name: 'Heart of Corundum', self: true, icon: 'st_hoc' },
    sonicBreak: { name: 'Sonic Break', self: false, icon: 'st_sonic' },
    bowShock: { name: 'Bow Shock', self: false, icon: 'st_bowshock' },
  };

  class GunbreakerEW62 {
    constructor() {
      this.name = 'Gunbreaker';
      this.abbr = 'GNB';
      this.role = 'tank';
      this.actions = ACTIONS;
      this.statuses = STATUSES;
      // A rough 6.4/6.5 item level 665 set at the 2.50 GCD. Tanks use the 156 attack modifier and add Tenacity.
      this.stats = { hp: 128000, main: 3330, mainStat: 'str', apMod: 156, jobMod: 100, trait: 100, wd: 132, det: 2047,
        crit: 2576, dh: 868, speed: 400, ten: 751, delay: 2.8 };
      this.speedName = 'Skill speed';
      this.tierHaste = 0;
      this.autoAttack = { potency: 90, delay: 2.8, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['noMercy', 'readyToRip', 'readyToTear', 'readyToGouge', 'readyToBlast', 'brutalShell',
        'royalGuard', 'medicated', 'rampart', 'camouflage', 'nebula', 'aurora', 'superbolide', 'heartOfLight',
        'heartOfCorundum', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['sonicBreak', 'bowShock', 'reprisal'];
      this.defaultBars = [
        ['keenEdge', 'brutalShell', 'solidBarrel', 'gnashingFang', 'continuation', 'burstStrike', 'sonicBreak', 'doubleDown', 'lightningShot', 'roughDivide', 'royalGuard', 'provoke'],
        ['noMercy', 'bloodfest', 'blastingZone', 'bowShock', 'tincture', 'rampart', 'camouflage', 'nebula', 'heartOfCorundum', 'aurora', 'superbolide', 'reprisal'],
        ['heartOfLight', 'sprint', 'armsLength', 'lowBlow', 'interject', 'shirk', null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Gunbreaker', ['keenEdge', 'brutalShell', 'solidBarrel', 'lightningShot', 'burstStrike', 'gnashingFang', 'savageClaw',
          'wickedTalon', 'sonicBreak', 'doubleDown', 'continuation', 'jugularRip', 'abdomenTear', 'eyeGouge', 'hypervelocity',
          'noMercy', 'bloodfest', 'blastingZone', 'bowShock', 'roughDivide', 'royalGuard', 'camouflage', 'nebula', 'aurora',
          'superbolide', 'heartOfLight', 'heartOfCorundum']],
        ['Role Actions', ['rampart', 'lowBlow', 'provoke', 'interject', 'reprisal', 'armsLength', 'shirk']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 8900;     // a scripted 6.5 rotation on this gear parses about 8,400 on the dummy
      this.referenceGcd = 2.5;
      this.startDistance = 3.2;
    }

    initGauge() { return { carts: 0, ammo: null }; }

    // Gnashing Fang becomes Savage Claw, then Wicked Talon; Continuation becomes whichever follow-up is ready.
    resolveId(id, e) {
      const g = e.g;
      if (id === 'gnashingFang' && g.ammo && g.ammo.until > e.now) return g.ammo.next;
      if (id === 'continuation') {
        for (const r of READY) if (e.has(r)) return CONTINUATION[r];
      }
      return id;
    }

    check(id, e) {
      const a = ACTIONS[id], g = e.g;
      if (id === 'continuation') return 'Unable to execute action.';
      if (a.ready && !e.has(a.ready)) return 'Unable to execute action.';
      if (a.ammoFrom && !(g.ammo && g.ammo.next === id && g.ammo.until > e.now)) return 'Unable to execute action.';
      if (a.carts && g.carts < a.carts) return 'Not enough cartridges.';
      if (id === 'bloodfest' && !e.inCombat) return 'Unable to execute action while not in combat.';
      return null;
    }

    snapshot(a, e) {
      const mult = e.has('noMercy') ? NO_MERCY : 1;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES.str.cap : 0);
      return { mult, main };
    }

    setReady(e, key) {
      for (const r of READY) if (r !== key) e.removeStatus(r, true);
      e.addStatus(key, 10);
    }

    resolve(id, e) {
      const a = ACTIONS[id], g = e.g;
      let potency = a.potency || 0;
      if (a.comboFrom && e.lastComboHit) potency = a.comboPotency;
      if (a.carts) { g.carts -= a.carts; e.emit('carts', {}); }

      switch (id) {
        case 'brutalShell': if (e.lastComboHit) e.addStatus('brutalShell', 30); break;
        case 'solidBarrel': if (e.lastComboHit) { g.carts = Math.min(MAX_CARTS, g.carts + 1); e.emit('carts', {}); } break;
        case 'burstStrike': this.setReady(e, 'readyToBlast'); break;
        case 'gnashingFang': g.ammo = { next: 'savageClaw', until: e.now + AMMO_COMBO }; this.setReady(e, 'readyToRip'); break;
        case 'savageClaw': g.ammo = { next: 'wickedTalon', until: e.now + AMMO_COMBO }; this.setReady(e, 'readyToTear'); break;
        case 'wickedTalon': g.ammo = null; this.setReady(e, 'readyToGouge'); break;
        case 'noMercy': e.addStatus('noMercy', 20); break;
        case 'bloodfest': g.carts = Math.min(MAX_CARTS, g.carts + 3); e.emit('carts', {}); break;
        case 'royalGuard':
          if (e.has('royalGuard')) e.removeStatus('royalGuard');
          else e.addStatus('royalGuard', 1e9, { permanent: true });
          break;
        case 'camouflage': e.addStatus('camouflage', 20); break;
        case 'nebula': e.addStatus('nebula', 15); break;
        case 'aurora': e.addStatus('aurora', 18); break;
        case 'superbolide': e.addStatus('superbolide', 10); break;
        case 'heartOfLight': e.addStatus('heartOfLight', 15); break;
        case 'heartOfCorundum': e.addStatus('heartOfCorundum', 8); break;
        case 'roughDivide': {
          const d = e.distToTarget() || 1;
          if (d > 2.6) {
            const from = { x: e.pos.x, z: e.pos.z };
            e.pos.x *= 2.4 / d; e.pos.z *= 2.4 / d;
            e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
          }
          break;
        }
        default:
          if (a.ready) e.removeStatus(a.ready);
          else if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
      }

      if (potency) {
        const snap = this.snapshot(a, e);
        const after = a.dot ? () => e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }) : null;
        e.queueHit(id, potency, snap, a.delay, after);
      }
    }

    // Hotbar borders: the next combo step, the Gnashing Fang chain, Continuation when ready, Burst Strike at a full gauge.
    proc(id, e) {
      const a = ACTIONS[id], g = e.g;
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (a.ammoFrom && g.ammo && g.ammo.next === id && g.ammo.until > e.now) return true;
      if (a.ready && e.has(a.ready)) return true;
      if (id === 'burstStrike' && g.carts >= MAX_CARTS) return true;
      return false;
    }

    mpRegen() { return B.BASE_REGEN; }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · No Mercy fits ${Math.floor(20 / e.gcdForSpeed(e.stats.speed))} GCDs`; }

    // ---------- the Powder Gauge: three cartridges ----------
    gaugeBuild(root) {
      const shell = (x) => `
  <g transform="translate(${x} 0)">
    <rect x="-13" y="70" width="26" height="78" rx="6" fill="#16141c" stroke="rgba(255,255,255,.25)" stroke-width="1.5"/>
    <g class="round" opacity=".15">
      <rect x="-10" y="92" width="20" height="52" rx="3" fill="url(#brass)"/>
      <path d="M-10 92 Q0 60 10 92 Z" fill="url(#tip)"/>
      <rect x="-10" y="132" width="20" height="5" fill="#7a5a22"/>
    </g>
  </g>`;
      root.innerHTML = `
<svg width="360" height="220" viewBox="0 0 360 220">
  <defs>
    <linearGradient id="brass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a6a2a"/><stop offset=".45" stop-color="#ffe2a0"/><stop offset="1" stop-color="#9a7430"/></linearGradient>
    <linearGradient id="tip" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4a7fd8"/><stop offset=".5" stop-color="#cfe6ff"/><stop offset="1" stop-color="#3a63b8"/></linearGradient>
    <filter id="cg" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect x="8" y="14" width="344" height="190" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text x="24" y="42" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">POWDER GAUGE</text>
  <text id="g-cartn" x="332" y="46" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="26" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">0</text>
  ${[0, 1, 2].map(k => `<g id="g-cart${k}">${shell(120 + k * 60)}</g>`).join('')}
  <path d="M60 160 L300 160" stroke="rgba(255,255,255,.12)" stroke-width="2"/>
  <text id="g-ammo" x="180" y="190" text-anchor="middle" font-family="Noto Sans, sans-serif" font-size="12" font-weight="600" fill="#8fb6ff"></text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.gg = { n: $('#g-cartn'), carts: [0, 1, 2].map(k => $(`#g-cart${k} .round`)), ammo: $('#g-ammo'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.gg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      put('n', g.carts, v => { G.n.textContent = String(v); });
      for (let i = 0; i < 3; i++) put('c' + i, g.carts > i, v => { G.carts[i].setAttribute('opacity', v ? '1' : '.15'); G.carts[i].setAttribute('filter', v ? 'url(#cg)' : ''); });
      const next = g.ammo && g.ammo.until > e.now ? `Next: ${ACTIONS[g.ammo.next].name}` : '';
      put('a', next, v => { G.ammo.textContent = v; });
    }

    // ---------- help ----------
    helpHtml(seq) {
      return `
<h3>How it plays (Endwalker 6.2–6.58, the long Bloodfest)</h3>
<p>Patch 6.2 raised <b>Bloodfest</b>'s recast from 90 to 120 seconds, so Gunbreaker's big burst lands every 2 minutes, with a smaller <b>No Mercy</b> window (+20% damage for 20s, every 60s) in between. That held until Dawntrail. Weaponskills share a 2.5s GCD; most Gunbreakers ran 2.50 or 2.45.</p>
<p>The <b>Powder Gauge</b> holds 3 cartridges. Solid Barrel (end of the Keen Edge → Brutal Shell → Solid Barrel combo) adds one, and Bloodfest adds three. Spend them on <b>Gnashing Fang</b> (1, 30s recast), <b>Double Down</b> (2, 60s) and <b>Burst Strike</b> (1). Gnashing Fang turns into Savage Claw and then Wicked Talon, and each of those, plus Burst Strike, lets <b>Continuation</b> fire once (Jugular Rip, Abdomen Tear, Eye Gouge, Hypervelocity). Weave it right after. Cartridge GCDs don't break the Keen Edge combo.</p>
<p>In each No Mercy, fit Gnashing Fang's combo, Sonic Break, Double Down (every other window), Blasting Zone, Bow Shock and Rough Divide. Outside it, keep Gnashing Fang on cooldown and don't let Solid Barrel overcap the gauge.</p>
<h3>An opener for this version</h3>
${seq(['keenEdge', ['tincture'], 'brutalShell', ['bloodfest'], ['noMercy'], 'gnashingFang', ['jugularRip'], ['bowShock'], 'sonicBreak', ['blastingZone'], ['roughDivide'], 'doubleDown', ['roughDivide'], 'savageClaw', ['abdomenTear'], 'wickedTalon', ['eyeGouge'], 'solidBarrel', 'burstStrike', ['hypervelocity']])}
<p>No Mercy goes late in the second GCD's window, so eight GCDs fit inside it at 2.50. Bloodfest before it puts three cartridges in for Gnashing Fang and Double Down. This sequence follows the version's rules; it isn't copied from a published guide.</p>
<p style="color:#a9a3b4">The 6.4–6.58 numbers: Keen Edge 200; Brutal Shell 300 and Solid Barrel 360 in combo; Burst Strike 380; Gnashing Fang 380, Savage Claw 440, Wicked Talon 540; Jugular Rip 200, Abdomen Tear 240, Eye Gouge 280, Hypervelocity 180; Sonic Break 300 + 60 per tick for 30s; Double Down 1,200; Blasting Zone 720; Bow Shock 150 + 60 per tick for 15s; Rough Divide 150 (2 charges); auto-attacks 90 at 2.80s.</p>`;
    }
  }

  B.registerJob({
    id: 'gnb', name: 'Gunbreaker', abbr: 'GNB', role: 'tank', classJob: 37,
    versions: [{ id: 'ew62', label: 'Endwalker 6.2–6.58', note: 'Bloodfest on a 120s recast (it was 90s before 6.2), Double Down for 2 cartridges, Sonic Break as a 60s weaponskill', create: () => new GunbreakerEW62() }],
  });
})(window.BLM);

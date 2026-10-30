// Conditions for the simulator's action lists, in SimulationCraft's style: `buff.fightOrFlight.up&cd.requiescat.ready`,
// `gauge.kenki>=50|time<10`. A small parser compiles each one into closures once, so evaluating a list thousands of
// times per iteration stays cheap. No eval: the artifact host may forbid it. Names resolve through the simulator's
// context (js/sim/apl.js), which turns a dotted path into a getter.
(function (B) {
  const OPS = ['&&', '||', '<=', '>=', '==', '!=', '&', '|', '<', '>', '=', '+', '-', '*', '/', '%', '!', '(', ')'];

  function tokenize(src) {
    const out = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        let j = i;
        while (j < src.length && /[0-9.]/.test(src[j])) j++;
        out.push({ t: 'num', v: parseFloat(src.slice(i, j)) });
        i = j;
        continue;
      }
      if (c === '"' || c === "'") {          // a quoted string, for gauge fields that hold one: gauge.demi="solar"
        const j = src.indexOf(c, i + 1);
        if (j < 0) throw new Error(`unclosed quote in "${src}"`);
        out.push({ t: 'str', v: src.slice(i + 1, j) });
        i = j + 1;
        continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        let j = i;
        while (j < src.length && /[A-Za-z0-9_.]/.test(src[j])) j++;
        out.push({ t: 'id', v: src.slice(i, j) });
        i = j;
        continue;
      }
      const op = OPS.find(o => src.startsWith(o, i));
      if (!op) throw new Error(`unexpected "${c}" in "${src}"`);
      out.push({ t: 'op', v: op });
      i += op.length;
    }
    return out;
  }

  // Lowest binding first. `=` is SimulationCraft's equality; `&` and `|` its and / or.
  const BINARY = [
    ['|', '||'],
    ['&', '&&'],
    ['=', '==', '!=', '<', '<=', '>', '>='],
    ['+', '-'],
    ['*', '/', '%'],
  ];
  const num = (v) => (v === true ? 1 : v === false || v === null || v === undefined || v !== v ? 0 : typeof v === 'number' ? v : 1);

  // Equality compares text as text when either side is a string, numbers otherwise.
  const same = (a, b) => (typeof a === 'string' || typeof b === 'string' ? String(a) === String(b) : Math.abs(num(a) - num(b)) < 1e-9);

  function combine(op, l, r) {
    switch (op) {
      case '|': case '||': return (c) => (num(l(c)) || num(r(c)) ? 1 : 0);
      case '&': case '&&': return (c) => (num(l(c)) && num(r(c)) ? 1 : 0);
      case '=': case '==': return (c) => (same(l(c), r(c)) ? 1 : 0);
      case '!=': return (c) => (same(l(c), r(c)) ? 0 : 1);
      case '<': return (c) => (num(l(c)) < num(r(c)) - 1e-9 ? 1 : 0);
      case '<=': return (c) => (num(l(c)) <= num(r(c)) + 1e-9 ? 1 : 0);
      case '>': return (c) => (num(l(c)) > num(r(c)) + 1e-9 ? 1 : 0);
      case '>=': return (c) => (num(l(c)) >= num(r(c)) - 1e-9 ? 1 : 0);
      case '+': return (c) => num(l(c)) + num(r(c));
      case '-': return (c) => num(l(c)) - num(r(c));
      case '*': return (c) => num(l(c)) * num(r(c));
      case '/': return (c) => { const d = num(r(c)); return d ? num(l(c)) / d : 0; };
      case '%': return (c) => { const d = num(r(c)); return d ? num(l(c)) % d : 0; };
    }
    throw new Error('bad operator ' + op);
  }

  // compile(src, resolve) → (ctx) => number. resolve(path) returns a getter (ctx) => value for a dotted name and
  // throws on a name it doesn't know, so a typo shows up when the list is loaded rather than as a silent zero.
  function compile(src, resolve) {
    const toks = tokenize(src);
    let p = 0;
    const peek = () => toks[p];
    const isOp = (...vs) => peek() && peek().t === 'op' && vs.includes(peek().v);

    function level(n) {
      if (n >= BINARY.length) return unary();
      let left = level(n + 1);
      while (isOp(...BINARY[n])) {
        const op = toks[p++].v;
        left = combine(op, left, level(n + 1));
      }
      return left;
    }
    function unary() {
      if (isOp('!')) { p++; const f = unary(); return (c) => (num(f(c)) ? 0 : 1); }
      if (isOp('-')) { p++; const f = unary(); return (c) => -num(f(c)); }
      return primary();
    }
    function primary() {
      const tk = toks[p++];
      if (!tk) throw new Error(`"${src}" ends early`);
      if (tk.t === 'num' || tk.t === 'str') { const v = tk.v; return () => v; }
      if (tk.t === 'id') {
        if (tk.v === 'true') return () => 1;
        if (tk.v === 'false') return () => 0;
        return resolve(tk.v);
      }
      if (tk.v === '(') {
        const f = level(0);
        if (!isOp(')')) throw new Error(`missing ")" in "${src}"`);
        p++;
        return f;
      }
      throw new Error(`unexpected "${tk.v}" in "${src}"`);
    }

    const f = level(0);
    if (p < toks.length) throw new Error(`unexpected "${toks[p].v}" in "${src}"`);
    return f;
  }

  B.SimExpr = { compile, tokenize, num };
})(window.BLM);

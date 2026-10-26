// Loads the converted Overwatch models and the map's navigation data from work/ (made by the tools/
// scripts from the rips in source/). Served over http the GLBs are fetched directly; opened from disk
// (file://, where fetch is blocked) they come from work/game-assets.js, which tools/pack_assets.py writes.
(function (G) {
  const MODELS = ['hanamura', 'reinhardt', 'zarya', 'dva_mech', 'dva_pilot', 'lucio', 'brigitte', 'zenyatta',
    'hammer', 'cannon', 'amp', 'flail', 'shield', 'lightgun'];

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('missing ' + src));
      document.head.appendChild(s);
    });
  }

  function b64(str) {
    const bin = atob(str), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }

  async function fetchBuf(url, onBytes) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ': ' + r.status);
    if (!r.body || !onBytes) return r.arrayBuffer();
    const total = +r.headers.get('content-length') || 0, reader = r.body.getReader(), parts = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value); got += value.length; onBytes(got, total);
    }
    const out = new Uint8Array(got);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out.buffer;
  }

  G.Assets = {
    gltf: {},
    nav: null,
    async load(progress) {
      const embedded = location.protocol === 'file:';
      if (embedded) {
        progress('Unpacking models…', 0.05);
        await loadScript('work/game-assets.js');
      }
      const loader = new THREE.GLTFLoader();
      for (let i = 0; i < MODELS.length; i++) {
        const name = MODELS[i];
        const base = i / MODELS.length, step = 1 / MODELS.length;
        progress(`Loading ${name}…`, base);
        const buf = embedded ? b64(G.PACK[name]) : await fetchBuf(`work/models/${name}.glb`, (got, total) => {
          if (total) progress(`Loading ${name}… ${(got / 1048576).toFixed(1)} MB`, base + step * 0.8 * got / total);
        });
        this.gltf[name] = await new Promise((res, rej) => loader.parse(buf, '', res, rej));
      }
      progress('Loading navigation…', 0.98);
      const meta = embedded ? G.PACK.nav_meta : await (await fetch('work/map/nav.json')).json();
      const bin = embedded ? b64(G.PACK.nav_bin) : await fetchBuf('work/map/nav.bin');
      this.nav = { meta, bin };
      if (embedded) delete G.PACK;
      progress('Ready', 1);
    },
  };
})(window.G = window.G || {});

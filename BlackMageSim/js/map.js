// The game's own maps under everything, from work/game-map*.js (tools/export_map.py): Wolves' Den Pier under a
// daytime sky over the open sea, and the fights' arenas (Settings → Location). The 2D scene then leaves out its own
// sky, ground and decor and draws only what lies on the ground (the target ring, Ley Lines, cast circles, shadows).
// With the game's models on, the model layer draws the map, those ground marks and the figures into its one canvas,
// in that order (drawInto): two WebGL canvases can show different frames when the GPU falls behind, and the dummy
// then seemed to float over the deck as the camera turned. Without the models, the map draws itself on the bottom
// canvas. Off in Settings (the pier only: a fight's arena always shows), or without three.js or the map files, the
// dusk training ground stays.
(function (B) {
  // The sun: high, behind and to the left of where you start, so shadows fall across the deck toward the dummy.
  B.MAP_SUN = { x: -0.42, y: 0.8, z: -0.43 };
  // Each map's look: its sky, haze and light. The pier is open daylight; an arena is lit like a stage at night.
  const LOOKS = {
    day: { zenith: 0x3d7bc6, horizon: 0xcde0ec, sun: 0xfff2dc, fog: [180, 1800], hemi: [0xd2e6ff, 0x8a7656, 0.95], light: [0xfff0d6, 1.85] },
    arena: { zenith: 0x150b2b, horizon: 0x5b3a72, sun: 0xffd9f2, fog: [140, 1100], hemi: [0xeadcff, 0x4a3656, 1.05], light: [0xfff0fa, 1.55] },
    // A club: the room dark, the floor, neon and stage lights doing the lighting.
    club: { zenith: 0x05030c, horizon: 0x1a0e2c, sun: 0xffd0ec, fog: [120, 900], hemi: [0xa08cdc, 0x2a1838, 0.75], light: [0xffe6f4, 1.15] },
  };

  // The maps there are: BLM.GAME_MAPS by key (an older file's BLM.GAME_MAP is the pier).
  B.gameMaps = () => Object.assign({}, B.GAME_MAP ? { pier: B.GAME_MAP } : {}, B.GAME_MAPS || {});

  class MapLayer {
    constructor(canvas, engine, scene, settings) {
      this.canvas = canvas;
      this.e = engine;
      this.sc = scene;
      this.settings = settings;
      this.maps = B.gameMaps();
      this.loaded = {};             // key -> { G, buf, scene3, sky, sun, sunDir, water, world, textures }
      this.key = null;              // the map showing
      this.cur = null;
      this.loading = null;
      this.ready = false;
      this.ok = !!(window.THREE && Object.keys(this.maps).length);
      this.canvas.style.display = 'none';
      if (this.ok) this.want();
    }

    // The map Settings → Location asks for, or the pier (or whatever there is).
    wanted() {
      const k = this.settings.location;
      return this.maps[k] ? k : this.maps.pier ? 'pier' : Object.keys(this.maps)[0];
    }
    get G() { return this.cur ? this.cur.G : null; }
    get world() { return this.cur ? this.cur.world : null; }
    // The fight on this map (its boss, timeline and enrage), once it's loaded.
    fight() { return this.ready && this.G && this.G.fight ? this.G.fight : null; }

    active() { return this.ok && this.ready && (this.settings.gameMap !== false || !!(this.G && this.G.fight)); }

    // Its own canvas only shows when it draws the map itself (the game's models off).
    setEnabled() {
      this.shared = !!(this.sc.models && this.sc.models.active());
      this.canvas.style.display = this.active() && !this.shared ? '' : 'none';
    }

    // Load the map Settings asks for (each once), then show it.
    want() {
      const k = this.wanted();
      if (k === this.key || k === this.loading) return;
      this.loading = k;
      this.load(k).then(() => {
        if (this.loading !== k) return;
        this.loading = null;
        this.key = k;
        this.cur = this.loaded[k];
        this.ready = true;
        this.setEnabled();
        if (this.onChange) this.onChange(k);
      }).catch((err) => {
        console.error(`Game map ${k} failed to load:`, err);
        this.loading = null;
        if (!this.key) this.ok = false;
        this.setEnabled();
      });
    }

    async load(k) {
      if (this.loaded[k]) return;
      const G = this.maps[k];
      const bin = atob(G.bin), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      const E = { key: k, G, buf: await new Response(stream).arrayBuffer(), textures: {} };
      E.world = G.collision && B.MapWorld ? new B.MapWorld(this.view(G.collision, E), G.sea && G.sea.y) : null;
      if (E.world && !E.world.n.length) E.world = null;
      this.build(E);
      this.loaded[k] = E;
    }

    view(spec, E = this.cur) {
      const [kind, off, n] = spec;
      const C = { f32: Float32Array, i16: Int16Array, u16: Uint16Array, u32: Uint32Array, u8: Uint8Array }[kind];
      return new C(E.buf, off, n);
    }

    // What the model layer needs to build the fight's boss from this map's file.
    source() {
      const E = this.cur;
      return E && { key: E.key, view: (spec) => this.view(spec, E), textures: E.G.textures };
    }

    // ---------- building ----------
    build(E) {
      const T = THREE, G = E.G, look = LOOKS[G.sky] || LOOKS.day;
      const s = E.scene3 = new T.Scene();
      E.look = look;
      s.fog = new T.Fog(look.horizon, look.fog[0], look.fog[1]);
      E.sunDir = new T.Vector3(B.MAP_SUN.x, B.MAP_SUN.y, B.MAP_SUN.z).normalize();

      // The light: the sun (or the stage lights) with its shadows, and a sky fill over a warm bounce off the floor.
      s.add(new T.HemisphereLight(look.hemi[0], look.hemi[1], look.hemi[2]));
      const sun = E.sun = new T.DirectionalLight(look.light[0], look.light[1]);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 320 });
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.04;
      s.add(sun, sun.target);

      this.texLoader = this.texLoader || new T.TextureLoader();
      this.buildSky(E);
      if (G.sea) this.buildSea(E, G.sea);
      const mats = G.materials.map(m => (m.water ? null : this.material(m, E)));
      // One instanced mesh per model mesh, with bounds around all of its copies, so a model wholly off screen (or
      // outside the sun's shadow box) isn't drawn. (Split finer, the extra draw calls cost more than culling saved.)
      const m4 = new T.Matrix4(), one = new T.Sphere();
      const union = (a, b) => {
        const d = a.center.distanceTo(b.center);
        if (d + b.radius <= a.radius) return;
        if (d + a.radius <= b.radius) { a.copy(b); return; }
        const r = (d + a.radius + b.radius) / 2;
        a.center.lerp(b.center, (r - a.radius) / d);
        a.radius = r;
      };
      for (const md of G.models) {
        const inst = this.view(md.instances, E), n = inst.length / 12;
        for (const me of md.meshes) {
          const mat = mats[me.material];
          if (!mat) continue;
          const g = this.geometry(me, E);
          g.computeBoundingSphere();
          const im = new T.InstancedMesh(g, mat, n), bounds = new T.Sphere();
          for (let i = 0; i < n; i++) {
            const o = i * 12;
            m4.set(inst[o], inst[o + 3], inst[o + 6], inst[o + 9], inst[o + 1], inst[o + 4], inst[o + 7], inst[o + 10],
              inst[o + 2], inst[o + 5], inst[o + 8], inst[o + 11], 0, 0, 0, 1);
            im.setMatrixAt(i, m4);
            one.copy(g.boundingSphere).applyMatrix4(m4);
            if (i === 0) bounds.copy(one); else union(bounds, one);
          }
          g.boundingSphere = bounds;
          im.castShadow = !mat.transparent;
          im.receiveShadow = !mat.transparent;
          s.add(im);
        }
      }
    }

    // Its own renderer, made the first time it draws itself.
    ownRenderer() {
      if (this.renderer) return this.renderer;
      const T = THREE;
      const r = this.renderer = new T.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
      r.outputEncoding = T.sRGBEncoding;
      r.shadowMap.enabled = true;
      r.shadowMap.type = T.PCFSoftShadowMap;
      this.camera = new T.PerspectiveCamera(55, 1, 0.1, 5000);
      if (this.sc.W) this.resize(this.sc.W, this.sc.H, this.sc.dpr);
      return r;
    }

    texture(index, srgb, E) {
      const key = index + (srgb ? 's' : 'l');
      if (E.textures[key]) return E.textures[key];
      const t = this.texLoader.load(E.G.textures[index]);
      t.flipY = false;                  // the game's UVs count from the top
      t.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      return (E.textures[key] = t);
    }

    material(m, E) {
      const T = THREE;
      if (m.glow) {
        // lightshaft.shpk: light added over whatever's behind, in its colour and strength, fading as you look along
        // its surface (as the game's soft beams do: a cone of light is bright through its middle, not at its rim).
        const tint = m.tint || [1, 1, 1];
        return new T.ShaderMaterial({
          uniforms: { map: { value: this.texture(m.color, false, E) }, color: { value: new T.Color(tint[0], tint[1], tint[2]) },
            opacity: { value: m.opacity ?? 0.6 } },
          vertexShader: [
            'varying vec2 vUv;', 'varying float vFace;',
            'void main() {',
            '  vUv = uv;',
            '  vec4 p = vec4(position, 1.0); vec3 n = normal;',
            '  #ifdef USE_INSTANCING', '  p = instanceMatrix * p; n = mat3(instanceMatrix) * n;', '  #endif',
            '  vec4 mv = modelViewMatrix * p;',
            '  vFace = abs(dot(normalize(normalMatrix * n), normalize(-mv.xyz)));',
            '  gl_Position = projectionMatrix * mv;',
            '}'].join('\n'),
          fragmentShader: [
            'uniform sampler2D map;', 'uniform vec3 color;', 'uniform float opacity;',
            'varying vec2 vUv;', 'varying float vFace;',
            'void main() { gl_FragColor = vec4(texture2D(map, vUv).rgb * color * opacity * vFace * vFace, 1.0); }'].join('\n'),
          transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide,
        });
      }
      const mat = new T.MeshStandardMaterial({ map: this.texture(m.color, true, E), roughness: 0.86, metalness: 0,
        side: m.doubleSided ? T.DoubleSide : T.FrontSide });
      // bg.shpk's colour constants: a tint on the texture, and light of its own (neon: black, lit in a colour).
      if (m.diffuse) mat.color.setRGB(m.diffuse[0], m.diffuse[1], m.diffuse[2]);
      if (m.emissive) mat.emissive.setRGB(m.emissive[0], m.emissive[1], m.emissive[2]);
      if (m.normal !== null && m.normal !== undefined) { mat.normalMap = this.texture(m.normal, false, E); mat.normalScale = new T.Vector2(1, -1); }
      if (m.alpha) mat.alphaTest = m.alphaTest > 0 ? Math.max(0.3, m.alphaTest) : 0.5;      // nets, ropes, leaves
      if (m.color1 !== undefined && m.color1 !== null) this.blendLayers(mat, this.texture(m.color1, true, E));
      return mat;
    }

    // bg.shpk's second layer: its own colour map on the second UV set, blended in by the vertices' alpha.
    blendLayers(mat, map1) {
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.map1 = { value: map1 };
        sh.vertexShader = 'attribute vec2 uvB;\nattribute float blend;\nvarying vec2 vUvB;\nvarying float vBlend;\n'
          + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n  vUvB = uvB;\n  vBlend = blend;');
        sh.fragmentShader = 'uniform sampler2D map1;\nvarying vec2 vUvB;\nvarying float vBlend;\n'
          + sh.fragmentShader.replace('#include <map_fragment>', [
            '#ifdef USE_MAP',
            '  vec4 texelColor = mapTexelToLinear(mix(texture2D(map1, vUvB), texture2D(map, vUv), vBlend));',
            '  diffuseColor *= texelColor;',
            '#endif'].join('\n'));
      };
      mat.customProgramCacheKey = () => 'map-blend';
    }

    geometry(me, E) {
      const T = THREE, g = new T.BufferGeometry(), v = (s) => this.view(s, E);
      g.setAttribute('position', new T.BufferAttribute(v(me.pos), 3));
      g.setAttribute('normal', new T.BufferAttribute(v(me.nrm), 3, true));
      g.setAttribute('uv', new T.BufferAttribute(v(me.uv), 2));
      if (me.uv1) g.setAttribute('uvB', new T.BufferAttribute(v(me.uv1), 2));
      if (me.blend) g.setAttribute('blend', new T.BufferAttribute(v(me.blend), 1, true));
      g.setIndex(new T.BufferAttribute(v(me.idx), 1));
      return g;
    }

    // A sky dome around the camera: horizon haze up to the zenith, with the sun's disc and glow.
    buildSky(E) {
      const T = THREE, look = E.look;
      const lin = (hex) => new T.Color(hex).convertSRGBToLinear();
      const mat = new T.ShaderMaterial({
        side: T.BackSide, depthWrite: false, fog: false,
        uniforms: { zenith: { value: lin(look.zenith) }, horizon: { value: lin(look.horizon) }, sunCol: { value: lin(look.sun) }, sunDir: { value: E.sunDir } },
        vertexShader: 'varying vec3 vDir;\nvoid main() {\n  vDir = position;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n  gl_Position.z = gl_Position.w * 0.9999;\n}',
        fragmentShader: [
          'uniform vec3 zenith, horizon, sunCol, sunDir;',
          'varying vec3 vDir;',
          'void main() {',
          '  vec3 d = normalize(vDir);',
          '  vec3 c = mix(horizon, zenith, pow(max(d.y, 0.0), 0.5));',
          '  float s = max(dot(d, sunDir), 0.0);',
          '  c += sunCol * (pow(s, 900.0) * 3.0 + pow(s, 14.0) * 0.22);',
          '  gl_FragColor = linearToOutputTexel(vec4(c, 1.0));',
          '}'].join('\n'),
      });
      E.sky = new T.Mesh(new T.SphereGeometry(2000, 32, 16), mat);
      E.sky.frustumCulled = false;
      E.sky.renderOrder = -1;
      E.scene3.add(E.sky);
    }

    // The sea: one plane to the horizon at the zone's water height, its colour the material's, with the game's wave
    // normals scrolling two ways for the ripples and the sky in it at a glancing angle.
    buildSea(E, w) {
      const T = THREE, look = E.look;
      const mat = new T.ShaderMaterial({
        fog: true,
        uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, {
          tint: { value: new T.Color(w.tint[0], w.tint[1], w.tint[2]) },
          sky: { value: new T.Color(look.horizon).convertSRGBToLinear() },
          sunCol: { value: new T.Color(look.sun).convertSRGBToLinear() },
          sunDir: { value: E.sunDir }, waves: { value: null }, time: { value: 0 },
        }]),
        vertexShader: [
          'varying vec3 vWorld;',
          '#include <fog_pars_vertex>',
          'void main() {',
          '  vec4 wp = modelMatrix * vec4(position, 1.0);',
          '  vWorld = wp.xyz;',
          '  vec4 mvPosition = viewMatrix * wp;',
          '  gl_Position = projectionMatrix * mvPosition;',
          '  #include <fog_vertex>',
          '}'].join('\n'),
        fragmentShader: [
          'uniform vec3 tint, sky, sunCol, sunDir;',
          'uniform sampler2D waves;',
          'uniform float time;',
          'varying vec3 vWorld;',
          '#include <fog_pars_fragment>',
          'void main() {',
          '  vec2 uv = vWorld.xz * 0.04;',
          '  vec3 a = texture2D(waves, uv + vec2(time * 0.011, time * 0.006)).xyz * 2.0 - 1.0;',
          '  vec3 b = texture2D(waves, uv * 1.9 + vec2(-time * 0.008, time * 0.012)).xyz * 2.0 - 1.0;',
          '  vec3 n = normalize(vec3((a.x + b.x) * 0.3, 1.0, (a.y + b.y) * 0.3));',
          '  vec3 v = normalize(cameraPosition - vWorld);',
          '  float f = pow(1.0 - max(dot(n, v), 0.0), 5.0);',
          '  vec3 c = mix(tint * 0.75, sky, 0.06 + 0.8 * f);',
          '  c += sunCol * pow(max(dot(n, normalize(v + sunDir)), 0.0), 260.0) * 2.5;',
          '  gl_FragColor = linearToOutputTexel(vec4(c, 1.0));',
          '  #include <fog_fragment>',
          '}'].join('\n'),
      });
      if (w.normal !== null && w.normal !== undefined) mat.uniforms.waves.value = this.texture(w.normal, false, E);
      const sea = new T.Mesh(new T.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2), mat);
      sea.position.y = w.y;
      sea.receiveShadow = false;
      E.water = mat;
      E.scene3.add(sea);
    }

    resize(w, h, dpr) {
      if (!this.renderer) return;
      this.renderer.setPixelRatio(Math.min(dpr, 1.5));
      this.renderer.setSize(w, h, false);
    }

    // ---------- per frame ----------
    // The sea moves; with the game's models off, the map draws itself through the 2D scene's camera (with them on,
    // the model layer calls drawInto).
    render(dt) {
      if (this.ok) this.want();
      if (!this.active()) return;
      if (this.cur.water) this.cur.water.uniforms.time.value += dt;
      if (this.shared !== !!(this.sc.models && this.sc.models.active())) this.setEnabled();
      if (this.shared) return;
      const r = this.ownRenderer(), sc = this.sc, c = sc.cam, cam = this.camera;
      cam.position.set(c.pos.x, c.pos.y, c.pos.z);
      cam.up.set(0, 1, 0);
      cam.lookAt(c.look.x, c.look.y, c.look.z);
      cam.fov = 2 * Math.atan(sc.H / 2 / sc.F) * 180 / Math.PI;
      cam.aspect = sc.W / sc.H;
      cam.updateProjectionMatrix();
      this.drawInto(r, cam);
    }

    // The map through `cam` into renderer `r`: the sky around the camera, the sun's shadow box around you. Nothing in
    // the map moves, so its shadows are drawn again only when the box (on an 8-yalm grid) moves with you, or the map
    // changes: that pass is about half the frame's draw calls.
    drawInto(r, cam) {
      const E = this.cur, p = this.e.pos, x = Math.round(p.x / 8) * 8, z = Math.round(p.z / 8) * 8, key = `${E.key}:${x},${z}`;
      E.sky.position.copy(cam.position);
      r.shadowMap.autoUpdate = false;
      if (r.mapShadowKey !== key) {
        r.mapShadowKey = key;
        E.sun.target.position.set(x, 0, z);
        E.sun.position.set(x + E.sunDir.x * 150, E.sunDir.y * 150, z + E.sunDir.z * 150);
        E.sun.updateMatrixWorld();
        E.sun.target.updateMatrixWorld();
        r.shadowMap.needsUpdate = true;
      }
      r.render(E.scene3, cam);
    }
  }

  B.MapLayer = MapLayer;
})(window.BLM);

// The game's own map under everything: Wolves' Den Pier, from work/game-map.js (tools/export_map.py), drawn with
// three.js on the bottom canvas through the 2D scene's camera, under a daytime sky and over the open sea. The 2D scene
// then leaves out its own sky, ground and decor and draws only what lies on the ground (the target ring, Ley Lines,
// cast circles, shadows) over it. Off in Settings, or without three.js or the map file, the dusk training ground stays.
(function (B) {
  // The sun: high, behind and to the left of where you start, so shadows fall across the deck toward the dummy.
  B.MAP_SUN = { x: -0.42, y: 0.8, z: -0.43 };
  const SKY = { zenith: 0x3d7bc6, horizon: 0xcde0ec, sun: 0xfff2dc };

  class MapLayer {
    constructor(canvas, engine, scene, settings) {
      this.canvas = canvas;
      this.e = engine;
      this.sc = scene;
      this.settings = settings;
      this.ready = false;
      this.ok = !!(window.THREE && B.GAME_MAP && B.GAME_MAP.models);
      this.canvas.style.display = 'none';
      if (this.ok) this.load().catch((err) => { console.error('Game map failed to load:', err); this.ok = false; this.setEnabled(); });
    }

    active() { return this.ok && this.ready && this.settings.gameMap !== false; }

    setEnabled() { this.canvas.style.display = this.active() ? '' : 'none'; }

    async load() {
      const G = B.GAME_MAP;
      const bin = atob(G.bin), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      this.buf = await new Response(stream).arrayBuffer();
      this.build();
      this.ready = true;
      this.setEnabled();
    }

    view(spec) {
      const [kind, off, n] = spec;
      const C = { f32: Float32Array, i16: Int16Array, u16: Uint16Array, u32: Uint32Array, u8: Uint8Array }[kind];
      return new C(this.buf, off, n);
    }

    // ---------- building ----------
    build() {
      const T = THREE, G = B.GAME_MAP;
      const r = this.renderer = new T.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
      r.outputEncoding = T.sRGBEncoding;
      r.shadowMap.enabled = true;
      r.shadowMap.type = T.PCFSoftShadowMap;
      if (this.sc.W) this.resize(this.sc.W, this.sc.H, this.sc.dpr);
      const s = this.scene3 = new T.Scene();
      this.camera = new T.PerspectiveCamera(55, 1, 0.1, 5000);
      s.fog = new T.Fog(SKY.horizon, 180, 1800);
      this.sunDir = new T.Vector3(B.MAP_SUN.x, B.MAP_SUN.y, B.MAP_SUN.z).normalize();

      // Daylight: the sun with its shadows, and a sky-blue fill over a warm bounce off the boards.
      s.add(new T.HemisphereLight(0xd2e6ff, 0x8a7656, 0.95));
      const sun = this.sun = new T.DirectionalLight(0xfff0d6, 1.85);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 320 });
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.04;
      s.add(sun, sun.target);

      this.texLoader = new T.TextureLoader();
      this.textures = {};
      this.buildSky();
      if (G.sea) this.buildSea(G.sea);
      const mats = G.materials.map(m => (m.water ? null : this.material(m)));
      const m4 = new T.Matrix4();
      for (const md of G.models) {
        const inst = this.view(md.instances), n = inst.length / 12;
        for (const me of md.meshes) {
          const mat = mats[me.material];
          if (!mat) continue;
          const im = new T.InstancedMesh(this.geometry(me), mat, n);
          for (let i = 0; i < n; i++) {
            const o = i * 12;
            m4.set(inst[o], inst[o + 3], inst[o + 6], inst[o + 9], inst[o + 1], inst[o + 4], inst[o + 7], inst[o + 10],
              inst[o + 2], inst[o + 5], inst[o + 8], inst[o + 11], 0, 0, 0, 1);
            im.setMatrixAt(i, m4);
          }
          im.frustumCulled = false;     // the instances spread far beyond the mesh's own bounds
          im.castShadow = !mat.transparent;
          im.receiveShadow = true;
          s.add(im);
        }
      }
    }

    texture(index, srgb) {
      const key = index + (srgb ? 's' : 'l');
      if (this.textures[key]) return this.textures[key];
      const t = this.texLoader.load(B.GAME_MAP.textures[index]);
      t.flipY = false;                  // the game's UVs count from the top
      t.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      return (this.textures[key] = t);
    }

    material(m) {
      const T = THREE;
      const mat = new T.MeshStandardMaterial({ map: this.texture(m.color, true), roughness: 0.86, metalness: 0,
        side: m.doubleSided ? T.DoubleSide : T.FrontSide });
      if (m.normal !== null && m.normal !== undefined) { mat.normalMap = this.texture(m.normal, false); mat.normalScale = new T.Vector2(1, -1); }
      if (m.alpha) mat.alphaTest = m.alphaTest > 0 ? Math.max(0.3, m.alphaTest) : 0.5;      // nets, ropes, leaves
      if (m.color1 !== undefined && m.color1 !== null) this.blendLayers(mat, this.texture(m.color1, true));
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

    geometry(me) {
      const T = THREE, g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(this.view(me.pos), 3));
      g.setAttribute('normal', new T.BufferAttribute(this.view(me.nrm), 3, true));
      g.setAttribute('uv', new T.BufferAttribute(this.view(me.uv), 2));
      if (me.uv1) g.setAttribute('uvB', new T.BufferAttribute(this.view(me.uv1), 2));
      if (me.blend) g.setAttribute('blend', new T.BufferAttribute(this.view(me.blend), 1, true));
      g.setIndex(new T.BufferAttribute(this.view(me.idx), 1));
      return g;
    }

    // A sky dome around the camera: horizon haze up to a deep blue, with the sun's disc and glow.
    buildSky() {
      const T = THREE;
      const lin = (hex) => new T.Color(hex).convertSRGBToLinear();
      const mat = new T.ShaderMaterial({
        side: T.BackSide, depthWrite: false, fog: false,
        uniforms: { zenith: { value: lin(SKY.zenith) }, horizon: { value: lin(SKY.horizon) }, sunCol: { value: lin(SKY.sun) }, sunDir: { value: this.sunDir } },
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
      this.sky = new T.Mesh(new T.SphereGeometry(2000, 32, 16), mat);
      this.sky.frustumCulled = false;
      this.sky.renderOrder = -1;
      this.scene3.add(this.sky);
    }

    // The sea: one plane to the horizon at the zone's water height, its colour the material's, with the game's wave
    // normals scrolling two ways for the ripples and the sky in it at a glancing angle.
    buildSea(w) {
      const T = THREE;
      const mat = new T.ShaderMaterial({
        fog: true,
        uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, {
          tint: { value: new T.Color(w.tint[0], w.tint[1], w.tint[2]) },
          sky: { value: new T.Color(SKY.horizon).convertSRGBToLinear() },
          sunCol: { value: new T.Color(SKY.sun).convertSRGBToLinear() },
          sunDir: { value: this.sunDir }, waves: { value: null }, time: { value: 0 },
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
      if (w.normal !== null && w.normal !== undefined) mat.uniforms.waves.value = this.texture(w.normal, false);
      const sea = new T.Mesh(new T.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2), mat);
      sea.position.y = w.y;
      sea.receiveShadow = false;
      this.water = mat;
      this.scene3.add(sea);
    }

    resize(w, h, dpr) {
      if (!this.renderer) return;
      this.renderer.setPixelRatio(Math.min(dpr, 1.5));
      this.renderer.setSize(w, h, false);
    }

    // ---------- per frame ----------
    render(dt) {
      if (!this.active()) return;
      const sc = this.sc, c = sc.cam, p = this.e.pos, cam = this.camera;
      cam.position.set(c.pos.x, c.pos.y, c.pos.z);
      cam.up.set(0, 1, 0);
      cam.lookAt(c.look.x, c.look.y, c.look.z);
      cam.fov = 2 * Math.atan(sc.H / 2 / sc.F) * 180 / Math.PI;
      cam.aspect = sc.W / sc.H;
      cam.updateProjectionMatrix();
      this.sky.position.copy(cam.position);
      // The sun's shadow box follows you.
      this.sun.target.position.set(p.x, 0, p.z);
      this.sun.position.set(p.x + this.sunDir.x * 150, this.sunDir.y * 150, p.z + this.sunDir.z * 150);
      if (this.water) this.water.uniforms.time.value += dt;
      this.renderer.render(this.scene3, cam);
    }
  }

  B.MapLayer = MapLayer;
})(window.BLM);

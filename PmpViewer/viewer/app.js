import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { EffectComposer } from './vendor/EffectComposer.js';
import { RenderPass } from './vendor/RenderPass.js';
import { GTAOPass } from './vendor/GTAOPass.js';
import { OutputPass } from './vendor/OutputPass.js';

const $ = (id) => document.getElementById(id);
const SLOTS = ['met', 'top', 'glv', 'dwn', 'sho', 'ear', 'nek', 'wrs', 'rir', 'ril'];
const SLOT_LABEL = { met: 'Head', top: 'Body', glv: 'Hands', dwn: 'Legs', sho: 'Feet', ear: 'Ears', nek: 'Neck',
  wrs: 'Wrists', rir: 'Ring R', ril: 'Ring L' };
const SLOT_COLOR = { met: 0xe0554f, top: 0x4f86e0, glv: 0xe8c93a, dwn: 0x4cc38a, sho: 0xa766e0, ear: 0xe08a4f,
  nek: 0x4fd0e0, wrs: 0xe04fb8, rir: 0x9ad04f, ril: 0x9ad04f, face: 0xd9b38c, hair: 0x8c6a4a, tail: 0x8c6a4a,
  zear: 0xd9b38c, body: 0xcccccc, weapon: 0xcccccc };
const SRC_COLOR = { mod: 0x4cc38a, game: 0x8a909c, swap: 0x6aa8ff, collection: 0xd9a441, missing: 0xff6b6b };
const TAIL_RACES = ['c0701', 'c0801', 'c1301', 'c1401', 'c1501', 'c1601'];
const EAR_RACES = ['c1701', 'c1801'];

const st = {
  mods: [], open: null, path: '', settings: {}, figures: [], selectedBone: '', overrides: {},
  races: [], lastItems: {}, loading: false,
  palette: null, colors: { skin: null, hair: null, highlight: null, eye: null },   // palette indices, like the game
};

// ------------------------------------------------------------------ api
async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
  return r.json();
}
async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ error: r.statusText }));
  if (!r.ok || j.error) throw new Error(j.error || r.statusText);
  return j;
}
function status(t) { $('status').textContent = t || ''; }
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const srcBadge = (s) => `<span class="src ${esc(s)}">${esc(s)}</span>`;

// ------------------------------------------------------------------ three
const canvas = $('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;     // keeps texture colours close to their values (ACES darkens and shifts them)
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1e24);
// soft studio reflections, so metal reads as metal (the game reflects its own environment maps)
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
camera.position.set(0, 1.2, 3.6);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.9, 0);
controls.enableDamping = true;
// neutral white light, so the viewer adds no tint of its own (in game the light colour depends on the zone)
const hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 0.9); scene.add(hemi);
const key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(1.5, 3, 2.5); scene.add(key);
// The game's sun / moon casts shadows: a cap brim darkens the face under it, an open coat the shirt inside.
const KEY_DIR = key.position.clone().normalize();
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0005;
key.shadow.normalBias = 0.004;
scene.add(key.target);
/** Aim the key light's shadow camera at the figures, as tight as they allow. */
function fitShadow() {
  const b = new THREE.Box3();
  for (const f of st.figures) b.union(f.bounds());
  if (b.isEmpty()) return;
  const c = b.getCenter(new THREE.Vector3()), r = b.getBoundingSphere(new THREE.Sphere()).radius;
  key.target.position.copy(c);
  key.position.copy(c).addScaledVector(KEY_DIR, r * 3);
  const cam = key.shadow.camera;
  cam.left = cam.bottom = -r; cam.right = cam.top = r; cam.near = r; cam.far = r * 5;
  cam.updateProjectionMatrix();
}
const rim = new THREE.DirectionalLight(0xffffff, 0.8); rim.position.set(-2, 2, -2.5); scene.add(rim);
// Lighting presets. In game the light depends on zone, weather and time of day; these cover the usual cases.
// sky/ground: ambient (hemisphere) colours, amb: its strength; key: sun or moon; env: reflection strength;
// haze: [colour, near, far] distance haze, which in game greys out colours (night was fitted to an in-game shot).
const LIGHTS = {
  neutral: { sky: 0xffffff, ground: 0x505050, amb: 1.3, key: 0xffffff, keyI: 1.8, rim: 0xffffff, rimI: 0.8, fillI: 0.5, env: 0.15 },
  // Day: in game, shade is far darker than sunlight (a white coat's shaded side gets about 1/9 of its sunlit side by a
  // cliff, about 1/4 in the open); the sky light slider covers spots where cliffs and trees block the sky
  day: { sky: 0xbccdf0, ground: 0x5a5244, amb: 0.5, key: 0xfff1dc, keyI: 3.4, rim: 0xe6eeff, rimI: 0.25, fillI: 0.05, env: 0.1,
    haze: [0xb8c4d6, 2, 60],
    // game renderer: fitted (2026-10-24, tools/calibrate_light.py) to 7.4 footage of the Bygone Brass sets on a Miqo'te
    // in sunlight (front, side and back of Fending; Casting held out: 72% less error than the values above); the sliders
    // still place the sun (the footage had it at -50 / 49)
    xr: { sun: [1.342, 1.248, 1.101], sh: [[0, 0.1354, 0, 0.7586], [0, 0.1973, 0, 0.7692], [0, 0.3295, 0, 0.8061]],
      reflection: [0.193, 0.209, 0.245], reflectionGround: [0.162, 0.149, 0.124], camera: 0.0611, cameraLight: [0.3041, 0.0422, 0, 0] } },
  dusk: { sky: 0x9aa4c8, ground: 0x3a3030, amb: 0.9, key: 0xffb27a, keyI: 1.5, rim: 0xb0b8ff, rimI: 0.5, fillI: 0.2, env: 0.12,
    haze: [0x6a6070, 1, 30] },
  // fitted to in-game night screenshots (2026-10-23): Peni Parker's yellow and orange cloth within a few RGB units, and
  // Jotaro's white coat, which reads neutral grey (the moonlight isn't blue); light haze plus the game's night colour
  // grade (desaturate, keep blacks)
  night: { sky: 0x9ca0a8, ground: 0x262a30, amb: 0.62, key: 0xdcdfe6, keyI: 0.8, rim: 0xa8aebc, rimI: 0.22, fillI: 0.08, env: 0.06,
    haze: [0x5c6169, 0, 11], grade: [0.64, 1.1] },
  indoor: { sky: 0xfff6ec, ground: 0x4a4038, amb: 1.3, key: 0xffeedd, keyI: 1.8, rim: 0xfff2e6, rimI: 0.8, fillI: 0.5, env: 0.13 },
};
LIGHTS.warm = LIGHTS.indoor;
function applyLight() {
  const l = LIGHTS[$('light').value] || LIGHTS.neutral;
  const sky = +$('lightAmb').value / 100;       // shade under cliffs and trees: the sky is partly blocked
  hemi.color.setHex(l.sky); hemi.groundColor.setHex(l.ground); hemi.intensity = l.amb * sky;
  key.color.setHex(l.key); key.intensity = l.keyI; rim.color.setHex(l.rim); rim.intensity = l.rimI;
  fill.color.setHex(l.key); fill.intensity = l.fillI * sky;
  scene.environmentIntensity = l.env * sky;
  // where the sun / moon stands: around the figure (0 = from the camera's side, 90 = from the figure's left) and height
  const az = THREE.MathUtils.degToRad(+$('lightAz').value), el = THREE.MathUtils.degToRad(+$('lightEl').value);
  KEY_DIR.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  fitShadow();
  scene.fog = l.haze ? new THREE.Fog(l.haze[0], l.haze[1], l.haze[2]) : null;
  // the game's per-zone colour grading (night desaturates without lifting blacks), applied to the finished picture
  canvas.style.filter = l.grade ? `saturate(${l.grade[0]}) brightness(${l.grade[1]})` : '';
}
window.pmpv = { LIGHTS, applyLight, refreshAll: () => refreshAll(), camera, controls, renderer, scene, st: () => st };   // devtools / tuning hook
const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-1.5, 0.5, 2); scene.add(fill);
const grid = new THREE.GridHelper(10, 40, 0x3a404c, 0x2a2e36); scene.add(grid);
const root = new THREE.Group(); scene.add(root);

// Ambient occlusion, like the game's HBAO: creases and the face under a cap brim get less of the sky's light.
// The normal pass keeps each material's alpha cut-out (hair cards, lashes) instead of drawing solid quads.
const AO_VS = `varying vec3 vN; varying vec2 vUv;
void main() { vUv = uv; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const AO_FS = `uniform sampler2D map; uniform float alphaTest; uniform bool useMap; varying vec3 vN; varying vec2 vUv;
void main() {
  if (useMap && texture2D(map, vUv).a < alphaTest) discard;
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
}`;
const aoSkip = new THREE.MeshBasicMaterial({ visible: false });
const aoNormals = new WeakMap();
function aoNormal(m) {
  if (!m || m === ghostMat || m.visible === false) return aoSkip;
  if (!aoNormals.has(m)) {
    const cut = m.map && (m.alphaTest > 0 || m.transparent);
    aoNormals.set(m, new THREE.ShaderMaterial({ vertexShader: AO_VS, fragmentShader: AO_FS, side: m.side, blending: THREE.NoBlending,
      uniforms: { map: { value: m.map || null }, useMap: { value: !!cut }, alphaTest: { value: Math.max(m.alphaTest || 0, 0.5) } } }));
  }
  return aoNormals.get(m);
}
class CutoutGTAOPass extends GTAOPass {
  renderOverride(renderer, overrideMaterial, renderTarget, clearColor, clearAlpha) {
    if (overrideMaterial !== this.normalMaterial) return super.renderOverride(renderer, overrideMaterial, renderTarget, clearColor, clearAlpha);
    const saved = [];
    this.scene.traverse((o) => {
      if (!o.isMesh) return;
      saved.push([o, o.material]);
      o.material = Array.isArray(o.material) ? o.material.map(aoNormal) : aoNormal(o.material);
    });
    renderer.getClearColor(this.originalClearColor);
    const alpha = renderer.getClearAlpha(), auto = renderer.autoClear;
    renderer.setRenderTarget(renderTarget);
    renderer.autoClear = false;
    renderer.setClearColor(clearColor); renderer.setClearAlpha(clearAlpha || 0); renderer.clear();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = auto; renderer.setClearColor(this.originalClearColor); renderer.setClearAlpha(alpha);
    for (const [o, m] of saved) o.material = m;
  }
}
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
// The output pass tone-maps the background too; pick the colour that comes out as the old one (Neutral tone mapping
// subtracts x - 6.25x^2 from dark colours, x = the smallest channel).
{
  const c = new THREE.Color(0x1b1e24), x = Math.sqrt(Math.min(c.r, c.g, c.b) / 6.25), off = x - Math.min(c.r, c.g, c.b);
  scene.background = new THREE.Color(c.r + off, c.g + off, c.b + off);
}
composer.addPass(new RenderPass(scene, camera));
const aoPass = new CutoutGTAOPass(scene, camera, 512, 512);
aoPass.updateGtaoMaterial({ radius: 0.25, distanceExponent: 1, thickness: 1, scale: 1.2, samples: 16 });
composer.addPass(aoPass);
composer.addPass(new OutputPass());
window.pmpv.ao = aoPass; window.pmpv.composer = composer;
/** AO only belongs on the lit materials view, not on unlit texture colours or the diagnostic colourings. */
function updateAo() {
  aoPass.enabled = $('vAo').checked && $('light').value !== 'unlit' && $('colorMode').value === 'material' && !$('vWire').checked;
}

function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  composer.setPixelRatio(window.devicePixelRatio);
  composer.setSize(r.width, r.height);
  camera.aspect = r.width / Math.max(r.height, 1);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement);
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  controls.update();
  const pv = $('pose').value;
  if (pv === 'walk' || pv.endsWith(':anim')) {
    const t = clock.getElapsedTime();
    for (const f of st.figures) applyPose(f, t);
  }
  if (!xrWanted() || !xr.ready) composer.render();
  xrTick();
});

// ------------------------------------------------------------------ textures / materials
const texLoader = new THREE.TextureLoader();
const texCache = new Map();
// The game's address modes (sampler flags): wrap, mirror, clamp, border (drawn as clamp).
const WRAP = [THREE.RepeatWrapping, THREE.MirroredRepeatWrapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping];
function tex(name, srgb, addr = [0, 0]) {
  const k = name + (srgb ? ':s' : '') + ':' + addr.join('');
  if (!texCache.has(k)) {
    const t = texLoader.load('/baked/' + encodeURIComponent(name));
    t.flipY = false;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = WRAP[addr[0]] ?? THREE.RepeatWrapping;
    t.wrapT = WRAP[addr[1]] ?? THREE.RepeatWrapping;
    t.anisotropy = 4;
    texCache.set(k, t);
  }
  return texCache.get(k);
}
const ghostMat = new THREE.MeshBasicMaterial({ color: 0xff5050, wireframe: true, transparent: true, opacity: 0.25, depthWrite: false });
const missingMat = new THREE.MeshStandardMaterial({ color: 0xff00ff, roughness: 0.8, emissive: 0x330033 });

function makeMaterial(m) {
  if (!m || m.missing) return missingMat;
  const p = { roughness: 1, metalness: 1, side: m.doubleSided ? THREE.DoubleSide : THREE.FrontSide };
  const a = m.address || {};
  if (m.color) p.map = tex(m.color, true, a.color);
  if (m.normal) { p.normalMap = tex(m.normal, false, a.normal); p.normalScale = new THREE.Vector2(1, -1); }
  if (m.orm) { p.roughnessMap = tex(m.orm, false, a.orm); p.metalnessMap = p.roughnessMap; }
  if (m.emissive) { p.emissiveMap = tex(m.emissive, true, a.emissive); p.emissive = new THREE.Color(0xffffff); }
  if (m.alphaUsed) {
    if (m.transparent) { p.transparent = true; p.depthWrite = !m.alphaTest; p.alphaTest = Math.min(m.alphaTest || 0.02, 0.5); }
    else p.alphaTest = m.alphaTest > 0 ? m.alphaTest : 0.5;
  }
  if (m.spec) {   // specular colour (RGB) and strength (A): the mask's red times the colour table's specular colour
    p.specularColorMap = tex(m.spec, true, a.spec);
    p.specularIntensityMap = p.specularColorMap;
    return new THREE.MeshPhysicalMaterial(p);
  }
  return new THREE.MeshStandardMaterial(p);
}

// ------------------------------------------------------------------ poses (world-space rotations about each joint, parents first)
const deg = THREE.MathUtils.degToRad;
const POSES = {
  bind: () => ({}),
  idle: () => ({ j_ude_a_l: [[0, 0, 1, -35]], j_ude_a_r: [[0, 0, 1, 35]], j_ude_b_l: [[1, 0, 0, -15]], j_ude_b_r: [[1, 0, 0, -15]] }),
  run: () => ({
    j_ude_a_l: [[0, 0, 1, -30], [1, 0, 0, -40]], j_ude_a_r: [[0, 0, 1, 30], [1, 0, 0, 40]],
    j_ude_b_l: [[1, 0, 0, -70]], j_ude_b_r: [[1, 0, 0, -70]],
    j_asi_a_l: [[1, 0, 0, -50]], j_asi_c_l: [[1, 0, 0, 70]], j_asi_d_l: [[1, 0, 0, 20]],
    j_asi_a_r: [[1, 0, 0, 25]], j_asi_c_r: [[1, 0, 0, 40]], j_asi_d_r: [[1, 0, 0, -25]],
    j_sk_f_a_l: [[1, 0, 0, -35]], j_sk_f_a_r: [[1, 0, 0, -20]], j_sk_b_a_l: [[1, 0, 0, 15]], j_sk_b_a_r: [[1, 0, 0, 15]],
    j_sebo_b: [[1, 0, 0, 12]], j_kao: [[0, 1, 0, 25]],
  }),
  armsup: () => ({ j_ude_a_l: [[0, 0, 1, 80]], j_ude_a_r: [[0, 0, 1, -80]], j_ude_b_l: [[0, 0, 1, 20]], j_ude_b_r: [[0, 0, 1, -20]] }),
  sit: () => ({
    j_asi_a_l: [[1, 0, 0, -90]], j_asi_a_r: [[1, 0, 0, -90]], j_asi_c_l: [[1, 0, 0, 90]], j_asi_c_r: [[1, 0, 0, 90]],
    j_sk_f_a_l: [[1, 0, 0, -70]], j_sk_f_a_r: [[1, 0, 0, -70]], j_sk_s_a_l: [[1, 0, 0, -45]], j_sk_s_a_r: [[1, 0, 0, -45]],
    j_ude_a_l: [[0, 0, 1, -40]], j_ude_a_r: [[0, 0, 1, 40]], _drop: 0.42,
  }),
  walk: (t) => {
    const s = Math.sin(t * 4), c = Math.cos(t * 4);
    return {
      j_ude_a_l: [[0, 0, 1, -38], [1, 0, 0, 22 * s]], j_ude_a_r: [[0, 0, 1, 38], [1, 0, 0, -22 * s]],
      j_ude_b_l: [[1, 0, 0, -18]], j_ude_b_r: [[1, 0, 0, -18]],
      j_asi_a_l: [[1, 0, 0, -32 * s]], j_asi_a_r: [[1, 0, 0, 32 * s]],
      j_asi_c_l: [[1, 0, 0, 35 * Math.max(0, c)]], j_asi_c_r: [[1, 0, 0, 35 * Math.max(0, -c)]],
      j_sk_f_a_l: [[1, 0, 0, -22 * s]], j_sk_f_a_r: [[1, 0, 0, 22 * s]],
      j_kosi: [[0, 1, 0, 6 * s]], j_kao: [[0, 1, 0, -4 * s]],
    };
  },
};

// ------------------------------------------------------------------ game animations as poses
const animCache = new Map();
async function getAnim(race, kind) {
  const k = race + ':' + kind;
  if (!animCache.has(k)) {
    animCache.set(k, get(`/api/anim?race=${race}&kind=${kind}`).then((a) => {
      const bin = atob(a.data), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      a.data = new Float32Array(bytes.buffer);
      return a;
    }));
  }
  return animCache.get(k);
}
/** Apply the pose chosen in the Pose box: a game animation for the figure's race, or a built-in test pose. */
function applyPose(f, t = 0) {
  const v = $('pose').value;
  if (!v.startsWith('g:')) { f.pose(v, t); return; }
  const kind = v.split(':')[1];
  if (!f.sc.race) { f.pose('bind'); return; }        // monsters and weapons: no human animations
  const a = f.anims?.[kind];
  if (a) { f.playAnim(a, v.endsWith(':anim') ? t : 0); return; }
  (f.anims ||= {})[kind] = null;
  getAnim(f.sc.race, kind).then((an) => { f.anims[kind] = an; f.playAnim(an, v.endsWith(':anim') ? clock.getElapsedTime() : 0); })
    .catch((e) => { status('Pose failed: ' + e.message); f.pose('idle'); });
}

// ------------------------------------------------------------------ figure: one resolved scene drawn in 3D
class Figure {
  constructor(sc, blob, offsetX, label) {
    this.sc = sc; this.blob = blob; this.label = label;
    this.group = new THREE.Group(); this.group.position.x = offsetX; root.add(this.group);
    this.group.scale.setScalar(sc.scale || 1);       // racial height scaling for the height slider
    const sk = sc.skeleton;
    this.nb = sk.names.length;
    // the game's bust slider: a local scale on the breast bones
    this.bustS = sc.bust ? new THREE.Matrix4().makeScale(...sc.bust) : null;
    this.isBust = sk.names.map((n) => n === 'j_mune_l' || n === 'j_mune_r');
    this.bind = sk.world.map((w) => new THREE.Matrix4().fromArray(w));
    this.joint = this.bind.map((m) => new THREE.Vector3().setFromMatrixPosition(m));
    this.index = Object.fromEntries(sk.names.map((n, i) => [n, i]));
    this.deltas = this.bind.map(() => new THREE.Matrix4());
    this.bindInv = this.bind.map((m) => m.clone().invert());
    this.bindLocal = this.bind.map((m, i) => {
      const p = sk.parents[i];
      return p >= 0 ? this.bindInv[p].clone().multiply(m) : m.clone();
    });
    this.world = this.bind.map(() => new THREE.Matrix4());
    this.mats = sc.materials.map(makeMaterial);
    this.models = sc.models.map((m, mi) => this.buildModel(m, mi));
    this.skelLines = this.buildSkeletonLines();
  }

  f32(r) { return new Float32Array(this.blob, r[0], r[1]); }
  u32(r) { return new Uint32Array(this.blob, r[0], r[1]); }
  u16(r) { return new Uint16Array(this.blob, r[0], r[1]); }
  u8(r) { return new Uint8Array(this.blob, r[0], r[1]); }

  buildModel(m, mi) {
    const nb = m.bones.length;
    const deform = m.deform ? m.deform.map((d) => new THREE.Matrix4().fromArray(d)) : null;
    const model = { info: m, nb, deform, palette: new Float32Array(16 * (nb + 1)), meshes: [], key: `${m.slot}:${m.request}` };
    for (const [k, me] of m.meshes.entries()) {
      const g = new THREE.BufferGeometry();
      const base = this.f32(me.pos), nrm = this.f32(me.nrm), uv4 = this.f32(me.uv), col = this.u8(me.col);
      const n = me.vertexCount;
      const uv0 = new Float32Array(n * 2), uv1 = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) { uv0[2 * i] = uv4[4 * i]; uv0[2 * i + 1] = uv4[4 * i + 1]; uv1[2 * i] = uv4[4 * i + 2]; uv1[2 * i + 1] = uv4[4 * i + 3]; }
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(base), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nrm), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv0, 2));
      g.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
      const idx0 = this.u32(me.idx);
      g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx0), 1));
      const shapes = me.shapes.map((s) => ({ name: s.name, values: this.u32(s.values) }));
      const matIdx = me.material;
      const mat = matIdx >= 0 ? this.mats[matIdx] : missingMat;
      const matInfo = matIdx >= 0 ? this.sc.materials[matIdx] : null;
      const mesh = new THREE.Mesh(g, [mat, ghostMat]);
      mesh.frustumCulled = false;
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData = { model: mi, mesh: k };
      this.group.add(mesh);
      model.meshes.push({ me, g, mesh, base, nrm, bi: this.u16(me.bi), bw: this.f32(me.bw), idx0, shapes, mat, matInfo, col });
    }
    return model;
  }

  buildSkeletonLines() {
    const pos = new Float32Array(this.nb * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffd35a, depthTest: false, transparent: true }));
    lines.renderOrder = 10;
    lines.visible = false;
    this.group.add(lines);
    return lines;
  }

  pose(name, t = 0) {
    const spec = POSES[name] ? POSES[name](t) : {};
    const sk = this.sc.skeleton;
    const T = new THREE.Matrix4(), R = new THREE.Matrix4(), Ti = new THREE.Matrix4(), Q = new THREE.Matrix4();
    for (let i = 0; i < this.nb; i++) {
      const n = sk.names[i], p = sk.parents[i];
      const d = this.deltas[i];
      if (p >= 0) d.copy(this.deltas[p]); else d.identity();
      const rots = spec[n];
      if (rots) {
        R.identity();
        for (const [x, y, z, a] of rots) R.premultiply(Q.makeRotationAxis(new THREE.Vector3(x, y, z).normalize(), deg(a)));
        const j = this.joint[i];
        T.makeTranslation(j.x, j.y, j.z); Ti.makeTranslation(-j.x, -j.y, -j.z);
        d.multiply(T).multiply(R).multiply(Ti);
      }
      if (this.bustS && this.isBust[i]) d.multiply(this.bind[i]).multiply(this.bustS).multiply(this.bindInv[i]);
      if (spec._drop && (n === 'n_hara' || (p < 0 && !this.index.n_hara))) {
        const h = this.joint[this.index.j_kosi ?? i]?.y ?? 1;
        d.premultiply(new THREE.Matrix4().makeTranslation(0, -spec._drop * h, 0));
      }
    }
    this.skin();
  }

  /** Pose from a game animation (local translation / rotation / scale per track) at time t seconds. */
  playAnim(a, t) {
    const sk = this.sc.skeleton;
    if (a._mapFor !== this) {         // track index for each of this figure's bones
      a._map = new Int32Array(this.nb).fill(-1);
      const byName = Object.fromEntries(a.tracks.map((n, i) => [n, i]));
      sk.names.forEach((n, i) => { if (n in byName) a._map[i] = byName[n]; });
      a._mapFor = this;
    }
    const nf = a.frames, ft = ((t * a.fps) % nf + nf) % nf;
    const i0 = Math.floor(ft), i1 = (i0 + 1) % nf, u = ft - i0, T = a.tracks.length;
    const d = a.data, P0 = new THREE.Vector3(), P1 = new THREE.Vector3(), Q0 = new THREE.Quaternion(),
      Q1 = new THREE.Quaternion(), S0 = new THREE.Vector3(), S1 = new THREE.Vector3(), L = new THREE.Matrix4();
    for (let i = 0; i < this.nb; i++) {
      const tr = a._map[i], p = sk.parents[i];
      if (tr >= 0) {
        const o0 = (i0 * T + tr) * 10, o1 = (i1 * T + tr) * 10;
        P0.set(d[o0], d[o0 + 1], d[o0 + 2]).lerp(P1.set(d[o1], d[o1 + 1], d[o1 + 2]), u);
        Q0.set(d[o0 + 3], d[o0 + 4], d[o0 + 5], d[o0 + 6]).slerp(Q1.set(d[o1 + 3], d[o1 + 4], d[o1 + 5], d[o1 + 6]), u);
        S0.set(d[o0 + 7], d[o0 + 8], d[o0 + 9]).lerp(S1.set(d[o1 + 7], d[o1 + 8], d[o1 + 9]), u);
        L.compose(P0, Q0, S0);
      } else L.copy(this.bindLocal[i]);
      if (this.bustS && this.isBust[i]) L.multiply(this.bustS);
      if (p >= 0) this.world[i].multiplyMatrices(this.world[p], L); else this.world[i].copy(L);
      this.deltas[i].multiplyMatrices(this.world[i], this.bindInv[i]);
    }
    this.skin();
  }

  skin() {
    for (const model of this.models) {
      const pal = model.palette, m = model.info;
      const tmp = new THREE.Matrix4();
      for (let i = 0; i < model.nb; i++) {
        const g = m.bones[i];
        tmp.copy(g >= 0 ? this.deltas[g] : new THREE.Matrix4());
        if (model.deform) tmp.multiply(model.deform[i]);
        tmp.toArray(pal, 16 * i);
      }
      new THREE.Matrix4().toArray(pal, 16 * model.nb);   // "no bone"
      for (const ms of model.meshes) skinMesh(ms, pal, model.nb);
    }
    this.updateSkeletonLines();
  }

  updateSkeletonLines() {
    const pos = this.skelLines.geometry.attributes.position.array;
    const sk = this.sc.skeleton, v = new THREE.Vector3(), w = new THREE.Vector3();
    for (let i = 0; i < this.nb; i++) {
      const p = sk.parents[i];
      v.copy(this.joint[i]).applyMatrix4(this.deltas[i]);
      w.copy(p >= 0 ? this.joint[p] : this.joint[i]).applyMatrix4(p >= 0 ? this.deltas[p] : this.deltas[i]);
      pos.set([w.x, w.y, w.z, v.x, v.y, v.z], 6 * i);
    }
    this.skelLines.geometry.attributes.position.needsUpdate = true;
  }

  refresh() {
    // visibility, attributes, shapes, colour mode
    const mode = $('colorMode').value, showHidden = $('vHidden').checked, wire = $('vWire').checked;
    const sel = this.index[st.selectedBone];
    for (const [mi, model] of this.models.entries()) {
      const m = model.info;
      const ov = st.overrides[model.key] || {};
      const slotHidden = !!m.hidden && !ov.forceShow;
      const userOff = ov.off === true;
      for (const ms of model.meshes) {
        // shapes
        const idx = ms.g.index.array;
        idx.set(ms.idx0);
        for (const s of ms.shapes) {
          const on = ov.shapes?.[s.name] ?? m.shapesOn.includes(s.name);
          if (!on) continue;
          const v = s.values;
          for (let i = 0; i < v.length; i += 2) idx[v[i]] = v[i + 1];
        }
        ms.g.index.needsUpdate = true;
        // groups: visible submeshes on material 0, hidden ones on the ghost
        ms.g.clearGroups();
        const covered = new Uint8Array(ms.me.indexCount / 3 | 0);
        const drawMain = !slotHidden && !userOff && !(ms.matInfo && ms.matInfo.visible === false);
        for (const sub of ms.me.submeshes) {
          let show = drawMain;
          for (const a of sub.attrs) {
            const r = ov.attrs?.[a] ?? m.attrs[a]?.show;
            if (r === false) show = false;
          }
          if (show) ms.g.addGroup(sub.start, sub.count, 0);
          else if (showHidden) ms.g.addGroup(sub.start, sub.count, 1);
          for (let t = sub.start / 3; t < (sub.start + sub.count) / 3; t++) covered[t] = 1;
        }
        let runStart = -1;
        for (let t = 0; t <= covered.length; t++) {
          if (t < covered.length && !covered[t]) { if (runStart < 0) runStart = t; }
          else if (runStart >= 0) {
            if (drawMain) ms.g.addGroup(runStart * 3, (t - runStart) * 3, 0);
            else if (showHidden) ms.g.addGroup(runStart * 3, (t - runStart) * 3, 1);
            runStart = -1;
          }
        }
        // colour mode; Dawntrail character shaders multiply the surface by vertex colour set 0
        let mat = ms.mat;
        if (mode === 'material' && !wire && ['character.shpk', 'characterlegacy.shpk'].includes(ms.matInfo?.shader)) {
          const colors = ms.g.attributes.color.array, n = ms.me.vertexCount;
          for (let v = 0; v < n; v++) for (let c = 0; c < 3; c++) colors[3 * v + c] = ms.col[4 * v + c] / 255;
          ms.g.attributes.color.needsUpdate = true;
          if (!mat.vertexColors) { mat.vertexColors = true; mat.needsUpdate = true; }
        }
        if (mode !== 'material' || wire) {
          const c = mode === 'source' ? SRC_COLOR[m.source] ?? 0xffffff : mode === 'slot' ? SLOT_COLOR[m.slot] ?? 0xffffff : 0xffffff;
          mat = ms.flat || (ms.flat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, side: THREE.DoubleSide }));
          mat.color.setHex(mode === 'material' ? 0xcccccc : c);
          mat.vertexColors = mode === 'weights';
          mat.wireframe = wire;
          mat.needsUpdate = true;
          if (mode === 'weights') weightColors(ms, model, sel);
        }
        if ($('light').value === 'unlit' && mode === 'material' && !wire && mat.map) {   // texture colours, no shading
          const b = ms.basic || (ms.basic = new THREE.MeshBasicMaterial());
          Object.assign(b, { map: mat.map, side: mat.side, alphaTest: mat.alphaTest, transparent: mat.transparent,
            vertexColors: mat.vertexColors });
          b.needsUpdate = true;
          mat = b;
        }
        ms.mesh.material = [mat, ghostMat];
      }
    }
    this.skelLines.visible = $('vSkel').checked;
  }

  dispose() {
    root.remove(this.group);
    this.group.traverse((o) => { o.geometry?.dispose(); });
    for (const m of this.mats) if (m !== missingMat) m.dispose();
  }

  bounds() {
    const b = new THREE.Box3();
    for (const model of this.models) for (const ms of model.meshes) { ms.g.computeBoundingBox(); b.union(ms.g.boundingBox); }
    b.translate(this.group.position);
    return b;
  }
}

function skinMesh(ms, pal, nb) {
  const P = ms.base, N = ms.nrm, bi = ms.bi, bw = ms.bw;
  const out = ms.g.attributes.position.array, on = ms.g.attributes.normal.array;
  const n = ms.me.vertexCount;
  for (let v = 0; v < n; v++) {
    const px = P[3 * v], py = P[3 * v + 1], pz = P[3 * v + 2];
    const nx = N[3 * v], ny = N[3 * v + 1], nz = N[3 * v + 2];
    let x = 0, y = 0, z = 0, a = 0, b = 0, c = 0, wsum = 0;
    for (let k = 0; k < 8; k++) {
      const w = bw[8 * v + k];
      if (w <= 0) continue;
      let j = bi[8 * v + k]; if (j > nb) j = nb;
      const o = 16 * j;
      x += w * (pal[o] * px + pal[o + 4] * py + pal[o + 8] * pz + pal[o + 12]);
      y += w * (pal[o + 1] * px + pal[o + 5] * py + pal[o + 9] * pz + pal[o + 13]);
      z += w * (pal[o + 2] * px + pal[o + 6] * py + pal[o + 10] * pz + pal[o + 14]);
      a += w * (pal[o] * nx + pal[o + 4] * ny + pal[o + 8] * nz);
      b += w * (pal[o + 1] * nx + pal[o + 5] * ny + pal[o + 9] * nz);
      c += w * (pal[o + 2] * nx + pal[o + 6] * ny + pal[o + 10] * nz);
      wsum += w;
    }
    if (wsum <= 0) { x = px; y = py; z = pz; a = nx; b = ny; c = nz; }
    const l = Math.hypot(a, b, c) || 1;
    out[3 * v] = x; out[3 * v + 1] = y; out[3 * v + 2] = z;
    on[3 * v] = a / l; on[3 * v + 1] = b / l; on[3 * v + 2] = c / l;
  }
  ms.g.attributes.position.needsUpdate = true;
  ms.g.attributes.normal.needsUpdate = true;
}

function weightColors(ms, model, sel) {
  const colors = ms.g.attributes.color.array, n = ms.me.vertexCount;
  const bones = model.info.bones;
  for (let v = 0; v < n; v++) {
    let w = 0;
    for (let k = 0; k < 8; k++) {
      const j = ms.bi[8 * v + k];
      if (j < bones.length && bones[j] === sel) w += ms.bw[8 * v + k];
    }
    const unknown = (() => { for (let k = 0; k < 8; k++) { const j = ms.bi[8 * v + k]; if (ms.bw[8 * v + k] > 0 && j < bones.length && bones[j] < 0) return true; } return false; })();
    if (unknown) { colors.set([1, 0, 1], 3 * v); continue; }
    colors.set([0.15 + 0.85 * w, 0.15 + 0.5 * w * (1 - w) * 4 * 0.5, 0.35 * (1 - w)], 3 * v);
  }
  ms.g.attributes.color.needsUpdate = true;
}

// ------------------------------------------------------------------ UI: mods and options

// ------------------------------------------------------------------ game-shader renderer (xivrender)
// The game's own compiled shaders, run on the GPU by apps/xivrender with the game's pass structure (G-buffer, shadow
// mask, directional lighting, composite, semi-transparency, tone mapping). The page sends the resolved scene once
// (models, material paths, the mod's file redirections, character colours), then per frame the camera, light and
// every model's skinning matrices; the frame comes back as raw RGBA and is drawn over the WebGL canvas.
const xr = { port: null, starting: null, busy: false, pending: false, sig: '', sceneSeq: 0, ready: false,
  canvas: $('xr'), info: $('xrInfo'), notes: [], ms: 0 };
xr.ctx = xr.canvas.getContext('2d');
function xrWanted() {
  return $('renderer').value === 'game' && $('colorMode').value === 'material' && !$('vWire').checked
    && $('light').value !== 'unlit' && st.figures.length > 0;
}
async function xrPort() {
  if (xr.port) return xr.port;
  xr.starting ||= get('/api/render_info').then((r) => { xr.port = r.port; return r.port; })
    .catch((e) => { xr.starting = null; throw e; });
  return xr.starting;
}
function xrUrl(path) { return `http://127.0.0.1:${xr.port}${path}`; }
/** World matrix of a figure (side-by-side offset, racial height scale). */
function figureMatrix(f) { f.group.updateMatrixWorld(true); return f.group.matrixWorld; }
async function xrSetScene() {
  xr.ready = false;
  const f = st.figures[0];
  if (!f || !f.sc.render) return;
  const seq = ++xr.sceneSeq;
  try {
    await xrPort();
    // one figure per scene shown (the mod, and vanilla beside it), each with its own file redirections
    const body = { figures: st.figures.map((fig) => {
      const r = fig.sc.render || { redirects: {}, models: [] };
      return { redirects: r.redirects, customize: r.customize,
        models: r.models.map((m, i) => ({ id: m.slot + ':' + i, mdl: m.mdl, materials: m.materials, stains: m.stains || [],
          decal: m.decal, decalColor: m.decalColor })) };
    }) };
    const res = await fetch(xrUrl('/scene'), { method: 'POST', body: JSON.stringify(body) });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    if (seq !== xr.sceneSeq) return;
    xr.ready = true; xr.sig = ''; xr.notes = [];
    xrRequest();
  } catch (e) { xr.info.textContent = 'game renderer unavailable: ' + e.message; }
}
/** The lighting preset as the game's light inputs: sun/moon direction and colour, L1 ambient from sky and ground. */
function xrEnv() {
  const l = LIGHTS[$('light').value] || LIGHTS.neutral;
  const sky = +$('lightAmb').value / 100;
  const c = (hex, k) => { const x = new THREE.Color(hex); return [x.r * k, x.g * k, x.b * k]; };
  // three's lights are physical (Lambert = albedo / pi); the game's light buffers carry N.L x colour
  const keyC = c(l.key, l.keyI / Math.PI);
  const skyC = c(l.sky, l.amb * sky / Math.PI), gnd = c(l.ground, l.amb * sky / Math.PI);
  const sh = [0, 1, 2].map((i) => [0, (skyC[i] - gnd[i]) / 2, 0, (skyC[i] + gnd[i]) / 2]);
  const bg = new THREE.Color(0x1b1e24);
  // a preset fitted to in-game footage carries the game renderer's own values; the sky light slider scales the sky terms
  const x = l.xr;
  const fitted = x ? { lightDiffuse: x.sun, lightSpecular: x.sun, ambientSh: x.sh.map((r) => r.map((v) => v * sky)),
    reflection: x.reflection.map((v) => v * sky), reflectionGround: x.reflectionGround,
    cameraLightColor: [x.camera, x.camera, x.camera], cameraLight: x.cameraLight } : {};
  return { lightDir: [KEY_DIR.x, KEY_DIR.y, KEY_DIR.z], lightDiffuse: keyC, lightSpecular: keyC, ambientSh: sh,
    reflection: c(l.sky, l.env * sky * 2), shadows: $('vShadow').checked, ao: $('vAo').checked, aoSamples: 1,
    background: [Math.sqrt(bg.r), Math.sqrt(bg.g), Math.sqrt(bg.b)], time: clock.getElapsedTime(),
    ...fitted, ...(window.pmpv.envOverride || {}) };   // then devtools / calibration scripts
}
function xrFrameState() {
  const w = Math.min(2560, Math.round(canvas.clientWidth * window.devicePixelRatio));
  const h = Math.min(1600, Math.round(canvas.clientHeight * window.devicePixelRatio));
  const models = [], arrays = [];
  const M = new THREE.Matrix4(), P = new THREE.Matrix4();
  for (const [fi, f] of st.figures.entries()) {
  const G = figureMatrix(f);
  for (const [i, model] of f.models.entries()) {
    const m = model.info, ov = st.overrides[model.key] || {};
    const hidden = Object.keys(m.attrs).filter((a) => (ov.attrs?.[a] ?? m.attrs[a]?.show) === false);
    for (const [a, v] of Object.entries(ov.attrs || {})) if (v === false && !hidden.includes(a)) hidden.push(a);
    const shapes = (m.shapeNames || []).filter((s) => ov.shapes?.[s] ?? m.shapesOn.includes(s));
    const visible = !(m.hidden && !ov.forceShow) && ov.off !== true;
    const bones = new Float32Array(16 * model.nb);
    for (let b = 0; b < model.nb; b++) {
      P.fromArray(model.palette, 16 * b);
      M.multiplyMatrices(G, P).toArray(bones, 16 * b);
    }
    arrays.push(bones);
    models.push({ figure: fi, index: i, visible, hiddenAttributes: hidden, shapes, boneCount: model.nb, world: G.toArray() });
  }
  }
  const cam = { eye: camera.position.toArray(), target: controls.target.toArray(), up: [0, 1, 0], fovY: camera.fov,
    near: Math.max(camera.near, 0.01) };
  return { head: { width: w, height: h, camera: cam, env: xrEnv(), models, format: 'rgba' }, arrays };
}
function xrRequest() { if (xrWanted() && xr.ready) xrSend(); }
async function xrSend(refine = false) {
  if (xr.busy) { xr.pending = true; return; }
  xr.busy = true; xr.pending = false;
  try {
    const s = xrFrameState();
    // once the view rests, one refined frame: ambient occlusion averaged over 8 noise patterns (the game's TAA)
    if (refine) s.head.env.aoSamples = 8;
    const json = new TextEncoder().encode(JSON.stringify(s.head));
    const floatBytes = s.arrays.reduce((n, a) => n + a.byteLength, 0);
    const bytes = new Uint8Array(4 + json.length + floatBytes);
    new DataView(bytes.buffer).setUint32(0, json.length, true);
    bytes.set(json, 4);
    let o = 4 + json.length;
    for (const a of s.arrays) { bytes.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), o); o += a.byteLength; }
    const t0 = performance.now();
    const r = await fetch(xrUrl('/frame'), { method: 'POST', body: bytes });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
    const w = +r.headers.get('X-Width'), h = +r.headers.get('X-Height');
    const px = new Uint8ClampedArray(await r.arrayBuffer());
    if (xrWanted()) {
      if (xr.canvas.width !== w || xr.canvas.height !== h) { xr.canvas.width = w; xr.canvas.height = h; }
      for (let i = 3; i < px.length; i += 4) px[i] = 255;
      xr.ctx.putImageData(new ImageData(px, w, h), 0, 0);
      xr.canvas.hidden = false;
      xr.ms = Math.round(performance.now() - t0);
      xr.info.textContent = `game shaders · ${w}×${h} · ${r.headers.get('X-Ms')} ms render, ${xr.ms} ms total`;
      if (+r.headers.get('X-Notes') !== xr.notes.length) xrNotes();
    }
  } catch (e) {
    xr.info.textContent = 'game renderer: ' + e.message;
  } finally {
    xr.busy = false;
    if (xr.pending) xrSend();
  }
}
async function xrNotes() {
  try {
    xr.notes = (await (await fetch(xrUrl('/log'))).json()).log || [];
    const f = st.figures[0];
    if (f) { renderProblems(f.sc); }
  } catch (e) { /* not important */ }
}
/** Called every animation frame: a new game frame whenever the view, pose or light changed. */
function xrTick() {
  const on = xrWanted();
  xr.canvas.hidden = !on || !xr.ready;
  if (!on) {
    xr.info.textContent = $('renderer').value === 'game' && st.figures.length ? 'WebGL preview (diagnostic view)' : '';
    return;
  }
  const pv = $('pose').value;
  const sig = [camera.position.toArray().map((v) => v.toFixed(4)), controls.target.toArray().map((v) => v.toFixed(4)), camera.fov,
    canvas.clientWidth, canvas.clientHeight, $('light').value, $('lightAz').value, $('lightEl').value, $('lightAmb').value,
    $('vShadow').checked, pv, (pv === 'walk' || pv.endsWith(':anim')) ? clock.getElapsedTime().toFixed(2) : '',
    JSON.stringify(st.overrides)].join('|');
  if (sig !== xr.sig) { xr.sig = sig; xr.changedAt = performance.now(); xr.refined = false; xrRequest(); }
  else if (!xr.refined && !xr.busy && xr.ready && performance.now() - (xr.changedAt || 0) > 400) { xr.refined = true; xrSend(true); }
}
window.pmpv.xr = xr;
window.pmpv.frameState = () => xrFrameState();    // the next /frame request (camera, pose, light), for tuning scripts
/** A still from the game renderer at any size (PNG), e.g. for captures: refined AO, current view and light. */
window.pmpv.captureFrame = async (w, h) => {
  const s = xrFrameState();
  Object.assign(s.head, { width: w, height: h, format: 'png' });
  s.head.env.aoSamples = 8;
  const json = new TextEncoder().encode(JSON.stringify(s.head));
  const floatBytes = s.arrays.reduce((n, a) => n + a.byteLength, 0);
  const bytes = new Uint8Array(4 + json.length + floatBytes);
  new DataView(bytes.buffer).setUint32(0, json.length, true);
  bytes.set(json, 4);
  let o = 4 + json.length;
  for (const a of s.arrays) { bytes.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), o); o += a.byteLength; }
  const r = await fetch(xrUrl('/frame'), { method: 'POST', body: bytes });
  if (!r.ok) throw new Error(r.statusText);
  return r.blob();
};

async function init() {
  st.races = await get('/api/races');
  $('race').innerHTML = st.races.map((r) => `<option value="${r.code}">${esc(r.label)} (${r.code})</option>`).join('');
  st.mods = await get('/api/mods');
  $('modList').innerHTML = '<option value="">(no mod: vanilla)</option>' +
    st.mods.map((m) => `<option value="${esc(m.path)}">${esc(m.name)}</option>`).join('');
  buildGear({});
  await loadPalette();
  const q = new URLSearchParams(location.search);
  if (q.get('mod')) { $('modPath').value = q.get('mod'); $('modList').value = q.get('mod'); await openMod(q.get('mod')); }
}

async function openMod(path) {
  st.path = path || '';
  st.open = null; st.settings = {}; st.overrides = {};
  $('optionsSec').hidden = true;
  if (!path) { $('modInfo').textContent = 'Vanilla game files only.'; return; }
  status('Opening mod…');
  try {
    const o = await post('/api/open', { path });
    st.open = o; st.settings = { ...o.settings };
    const m = o.mod;
    const pm = o.penumbraManips;
    $('modInfo').innerHTML = `<b>${esc(m.name)}</b> ${m.version ? 'v' + esc(m.version) : ''}<br>${esc(m.author)}<br>
      ${m.fileCount} files · ${o.files.length} redirections · ${o.swaps.length} swaps ·
      ${Object.entries(o.manipCounts).map(([k, v]) => `${v} ${k}`).join(', ') || 'no manipulations'}
      ${pm && pm.bad?.length ? `<div class="why">Penumbra's reader drops manipulations: ${pm.bad.map(esc).join('; ')}</div>` : ''}
      <details><summary>description</summary><pre>${esc(m.description)}</pre></details>`;
    buildOptions();
    applySubject(o.subject);
    status('');
    await load();
  } catch (e) { status('Open failed: ' + e.message); }
}

function buildOptions() {
  const box = $('options');
  const groups = st.open?.mod.groups || [];
  $('optionsSec').hidden = !groups.length;
  box.innerHTML = '';
  for (const g of groups) {
    const d = document.createElement('div');
    d.className = 'opt-group';
    d.innerHTML = `<div><span class="gname">${esc(g.name)}</span><span class="gtype">${esc(g.type)} · priority ${g.priority}</span></div>`;
    const cur = st.settings[g.index] ?? g.default;
    if (g.type === 'Single') {
      const s = document.createElement('select');
      s.innerHTML = g.options.map((o, i) => `<option value="${i}" ${i === cur ? 'selected' : ''}>${esc(o.name)}</option>`).join('');
      s.onchange = () => { st.settings[g.index] = +s.value; load(); };
      d.appendChild(s);
    } else {
      g.options.forEach((o, i) => {
        const l = document.createElement('label');
        l.title = o.description || '';
        l.innerHTML = `<input type="checkbox" ${(cur >> i) & 1 ? 'checked' : ''}> ${esc(o.name)} <span class="muted">${o.files} files${o.manips ? ', ' + o.manips + ' meta' : ''}</span>`;
        l.querySelector('input').onchange = (ev) => {
          const v = st.settings[g.index] ?? g.default;
          st.settings[g.index] = ev.target.checked ? v | (1 << i) : v & ~(1 << i);
          load();
        };
        d.appendChild(l);
      });
    }
    if (g.description) d.title = g.description;
    box.appendChild(d);
  }
}

// ------------------------------------------------------------------ UI: subject
function buildGear(gear) {
  const t = $('gear');
  t.innerHTML = SLOTS.map((s) => `<tr data-slot="${s}"><td>${SLOT_LABEL[s]}</td>
    <td><input class="item" list="itemList" placeholder="item name or set id" data-slot="${s}"></td>
    <td><input class="num set" type="number" min="0" placeholder="set" value="${gear[s] ? gear[s][0] : ''}"></td>
    <td><input class="num var" type="number" min="0" placeholder="var" value="${gear[s] ? gear[s][1] : ''}"></td>
    <td><input class="num dye" data-d="0" type="number" min="0" max="255" placeholder="dye" title="Dye 1 (Stain id); the game shaders recolour the colour table like the game" value="${gear[s]?.[2] || ''}"></td>
    <td><input class="num dye" data-d="1" type="number" min="0" max="255" placeholder="dye 2" title="Dye 2 (Stain id)" value="${gear[s]?.[3] || ''}"></td></tr>`).join('');
  for (const inp of t.querySelectorAll('input.item')) {
    let timer;
    inp.oninput = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const items = await get(`/api/items?slot=${inp.dataset.slot}&q=${encodeURIComponent(inp.value)}`);
        st.lastItems[inp.dataset.slot] = items;
        $('itemList').innerHTML = items.map((i) => `<option value="${esc(i.name)}">e${String(i.set).padStart(4, '0')} v${i.variant}</option>`).join('');
      }, 200);
    };
    inp.onchange = () => {
      const it = (st.lastItems[inp.dataset.slot] || []).find((i) => i.name === inp.value);
      if (!it) return;
      const row = inp.closest('tr');
      row.querySelector('.set').value = it.set;
      row.querySelector('.var').value = it.variant;
      load();
    };
  }
  for (const n of t.querySelectorAll('input.num')) n.onchange = () => load();
}

function applySubject(s) {
  const kind = s.subject || 'character';
  $('subjectKind').value = kind;
  $('charForm').hidden = kind !== 'character';
  $('creatureForm').hidden = kind === 'character';
  if (kind === 'character') {
    $('race').value = s.race || 'c0101';
    $('face').value = s.face || 1; $('hair').value = s.hair || 1; $('tail').value = s.tail || s.ear || 1;
    buildGear(s.gear || {});
    loadPalette();
  } else {
    $('cId').value = s.id; $('cBody').value = s.body ?? 1; $('cVar').value = s.variant ?? 1;
    $('cBodyLabel').textContent = kind === 'demihuman' ? 'Equip set' : 'Body';
  }
  const cr = st.open?.targets.creatures || [];
  $('creatureTargets').innerHTML = cr.length ? `In this mod (${cr.length}): <select>${cr.map((c, i) =>
    `<option value="${i}" ${c.kind === kind && c.id === s.id && c.body === s.body ? 'selected' : ''}>${c.kind} ${c.id} / ${c.body} (${c.files} files)</option>`).join('')}</select>` : '';
  const pick = $('creatureTargets').querySelector('select');
  if (pick) pick.onchange = () => {
    const c = cr[+pick.value];
    applySubject({ subject: c.kind, id: c.id, body: c.body, variant: 1 }); load();
  };
}

// ------------------------------------------------------------------ the game's colour palettes (human.cmp)
async function loadPalette() {
  const race = $('race').value;
  const p = await get(`/api/palette?race=${race}&clan=${$('clan').value || ''}`);
  st.palette = p;
  const cur = +$('clan').value;
  $('clan').innerHTML = p.clans.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  if (p.clans.some((c) => c.id === cur)) $('clan').value = cur;
  for (const k of ['skin', 'hair', 'highlight', 'eye']) {
    if (st.colors[k] == null || st.colors[k] >= p[k].swatches.length) st.colors[k] = p[k].default;
  }
  renderSwatches();
}
function renderSwatches() {
  if (!st.palette) return;
  for (const b of document.querySelectorAll('button.sw')) {
    const k = b.dataset.kind;
    b.style.background = st.palette[k].swatches[st.colors[k]];
    b.title = `${k} colour #${st.colors[k] + 1}`;
  }
}
let palKind = null;
function openPalette(kind) {
  const pop = $('palPop');
  if (palKind === kind && !pop.hidden) { pop.hidden = true; return; }
  palKind = kind;
  pop.innerHTML = st.palette[kind].swatches.map((c, i) =>
    `<span style="background:${c}" class="${i === st.colors[kind] ? 'on' : ''}" title="#${i + 1}" data-i="${i}"></span>`).join('');
  pop.hidden = false;
  for (const sp of pop.querySelectorAll('span')) sp.onclick = () => {
    st.colors[kind] = +sp.dataset.i;
    if (st.design) for (const k of kind === 'eye' ? ['eye', 'eyeLeft'] : [kind]) delete st.design[k];   // the pick wins over the design
    if (kind === 'highlight') $('hlOn').checked = true;
    pop.hidden = true; renderSwatches(); load();
  };
}
async function pasteGlamourer() {
  $('glamText').value = '';
  try { $('glamText').value = (await navigator.clipboard.readText()) || ''; } catch (e) { /* paste by hand */ }
  $('glamDlg').hidden = false;
  $('glamText').focus();
}
async function applyGlamourer() {
  try {
    const s = await post('/api/glamourer', { text: $('glamText').value });
    $('glamDlg').hidden = true;
    $('subjectKind').value = 'character'; $('charForm').hidden = false; $('creatureForm').hidden = true;
    if (s.race) $('race').value = s.race;
    if (s.clan) { $('clan').innerHTML = `<option value="${s.clan}">${s.clan}</option>`; $('clan').value = s.clan; }
    for (const k of ['face', 'hair', 'tail', 'height', 'bust']) if (s[k] != null) $(k).value = s[k];
    $('heightVal').textContent = $('height').value; $('bustVal').textContent = $('bust').value;
    for (const [k, f] of [['skin', 'skinIndex'], ['hair', 'hairIndex'], ['eye', 'eyeIndex']]) if (s[f] != null) st.colors[k] = s[f];
    if ('highlightIndex' in s) { $('hlOn').checked = s.highlightIndex != null; if (s.highlightIndex != null) st.colors.highlight = s.highlightIndex; }
    if (s.features != null) for (const c of document.querySelectorAll('.feat')) c.checked = !!((s.features >> +c.dataset.bit) & 1);
    if (s.facePaint != null) { $('facePaint').value = s.facePaint; $('paintFlip').checked = !!s.facePaintReversed; }
    if (s.facePaintIndex != null) $('paintColor').value = s.facePaintIndex;
    st.design = s.design || null;      // the design's advanced colours (skin, hair, eyes, lips, face paint colour, ...)
    for (const row of $('gear').querySelectorAll('tr')) {
      const slot = row.dataset.slot;
      if (!(slot in (s.gear || {}))) continue;
      const g = s.gear[slot];
      row.querySelector('.set').value = g ? g[0] : '';
      row.querySelector('.var').value = g ? g[1] : '';
      for (const d of row.querySelectorAll('.dye')) d.value = g?.[2 + +d.dataset.d] || '';
      row.querySelector('.item').value = '';
    }
    $('glamInfo').textContent = [s.name ? `"${s.name}"` : 'design', ...(s.notes || [])].join(' · ');
    await loadPalette();
    load();
  } catch (e) { alert('Not a Glamourer design: ' + e.message); }
}

function readSubject() {
  const kind = $('subjectKind').value;
  const customize = { texSize: $('texFull').checked ? 4096 : 1024 };
  if (kind !== 'character') return { subject: kind, kind, id: +$('cId').value, body: +$('cBody').value, variant: +$('cVar').value, customize };
  const gear = {};
  for (const row of $('gear').querySelectorAll('tr')) {
    const s = row.dataset.slot, set = row.querySelector('.set').value, v = row.querySelector('.var').value;
    const dyes = [...row.querySelectorAll('.dye')].map((d) => +d.value || 0);
    if (set !== '') gear[s] = [+set, v === '' ? 1 : +v, ...dyes];
  }
  const race = $('race').value;
  let features = 0;
  for (const c of document.querySelectorAll('.feat')) if (c.checked) features |= 1 << +c.dataset.bit;
  const c = st.colors;
  return { subject: 'character', race, clan: +$('clan').value || null, face: +$('face').value, hair: +$('hair').value,
    tail: +$('tail').value, ear: +$('tail').value, height: +$('height').value, bust: +$('bust').value, gear, customize, features,
    beard: $('beard').checked, skinIndex: c.skin, hairIndex: c.hair, highlightIndex: $('hlOn').checked ? c.highlight : null,
    eyeIndex: c.eye, collection: $('useCollection').checked,
    facePaint: +$('facePaint').value || 0, facePaintIndex: +$('paintColor').value || 0, facePaintReversed: $('paintFlip').checked,
    design: st.design || undefined };
}

// ------------------------------------------------------------------ loading
let loadSeq = 0;
async function load() {
  const seq = ++loadSeq;
  const subject = readSubject();
  status('Resolving… (the first load of a mod decodes its textures, which can take a while)');
  try {
    const want = [post('/api/scene', { path: st.path, settings: st.settings, subject })];
    if ($('vVanilla').checked && st.path) want.push(post('/api/scene', { path: '', settings: {}, subject }));
    const scenes = await Promise.all(want);
    const blobs = await Promise.all(scenes.map((s) => fetch('/api/blob/' + s.blob).then((r) => r.arrayBuffer())));
    if (seq !== loadSeq) return;
    for (const f of st.figures) f.dispose();
    st.figures = [];
    const gap = 1.0;
    scenes.forEach((s, i) => {
      const f = new Figure(s, blobs[i], i === 0 ? (scenes.length > 1 ? -gap / 2 : 0) : gap / 2, i === 0 ? 'mod' : 'vanilla');
      st.figures.push(f);
    });
    for (const f of st.figures) { applyPose(f); f.refresh(); }
    xrSetScene();
    frame();
    fitShadow();
    renderPanels();
    const sc = scenes[0];
    $('hud').innerHTML = `${esc(sc.race || sc.subject)} · ${sc.models.length} models · ${sc.materials.length} materials · ${sc.seconds}s` +
      (scenes.length > 1 ? '<br>left: with mod · right: vanilla' : '');
    status('');
  } catch (e) { if (seq === loadSeq) status('Load failed: ' + e.message); }
}

function frame(view = 'keep') {
  const b = new THREE.Box3();
  const close = view === 'head' || view === 'feet';
  for (const f of close ? st.figures.slice(0, 1) : st.figures) b.union(f.bounds());
  if (b.isEmpty()) return;
  let c = b.getCenter(new THREE.Vector3());
  const size = b.getSize(new THREE.Vector3());
  let h = Math.max(size.y, size.x * 0.8, 0.5);
  const dirs = { front: [0, 0.15, 1], side: [1, 0.1, 0], back: [0, 0.15, -1], head: [0.35, 0.1, 1], feet: [0.4, 0.3, 1] };
  let dir = camera.position.clone().sub(controls.target).normalize();
  if (dirs[view]) dir = new THREE.Vector3(...dirs[view]).normalize();
  else if (!dir.lengthSq() || !isFinite(dir.x)) dir = new THREE.Vector3(0, 0.15, 1).normalize();
  if (view === 'head') { c = new THREE.Vector3(c.x, b.max.y - size.y * 0.09, c.z); h = size.y * 0.16; }
  if (view === 'feet') { c = new THREE.Vector3(c.x, b.min.y + size.y * 0.08, c.z); h = size.y * 0.2; }
  controls.target.copy(c);
  camera.position.copy(c).addScaledVector(dir, h * 1.9);
  camera.near = Math.max(h / 400, 0.002); camera.far = h * 100; camera.updateProjectionMatrix();
}
for (const b of document.querySelectorAll('.camtools button')) b.onclick = () => frame(b.dataset.view);

// ------------------------------------------------------------------ panels
function renderPanels() {
  const f = st.figures[0];
  if (!f) return;
  const sc = f.sc;
  renderModels(f);
  renderProblems(sc);
  renderTrace(sc);
  renderFiles(sc);
  renderMeta(sc);
  renderMaterials(sc);
  $('boneList').innerHTML = sc.skeleton.names.map((n) => `<option value="${n}">`).join('');
  $('legend').innerHTML = $('colorMode').value === 'source'
    ? Object.entries(SRC_COLOR).map(([k, c]) => `<span style="--c:#${c.toString(16).padStart(6, '0')}">${k}</span>`).join('')
    : $('colorMode').value === 'weights' ? '<span style="--c:#ff3030">weight 1</span><span style="--c:#262659">0</span><span style="--c:#ff00ff">unknown bone</span>' : '';
}

function renderModels(f) {
  const box = $('models');
  box.innerHTML = '';
  for (const model of f.models) {
    const m = model.info;
    const ov = st.overrides[model.key] || (st.overrides[model.key] = {});
    const tr = f.sc.trace[m.trace];
    const d = document.createElement('div');
    d.className = 'm' + (m.hidden ? ' hiddenslot' : '');
    const attrs = Object.entries(m.attrs);
    const otherAttrs = new Set(m.meshes.flatMap((me) => me.submeshes.flatMap((s) => s.attrs)));
    for (const [a] of attrs) otherAttrs.delete(a);
    d.innerHTML = `<div class="mh"><input type="checkbox" ${ov.off ? '' : 'checked'} title="draw">
      <span class="slot">${esc(m.slot)}</span>${srcBadge(m.source)}
      ${m.modelRace && f.sc.race && m.modelRace !== f.sc.race ? `<span class="why">${m.modelRace} model + deformer</span>` : ''}</div>
      <div class="path">${esc(m.request)}${tr.file && tr.file !== m.request ? '<br>← ' + esc(tr.file) : ''}${tr.option ? ' <i>(' + esc(tr.option) + ')</i>' : ''}</div>
      ${m.hidden ? `<div class="why">hidden: ${m.hidden.map(esc).join('; ')} <label class="inline"><input type="checkbox" class="force" ${ov.forceShow ? 'checked' : ''}> draw anyway</label></div>` : ''}
      ${m.unknownBones.length ? `<div class="why" style="color:var(--missing)">bones not in skeleton: ${m.unknownBones.map(esc).join(', ')}</div>` : ''}
      <div class="attrs"></div>`;
    d.querySelector('.mh input').onchange = (ev) => { ov.off = !ev.target.checked; refreshAll(); };
    const force = d.querySelector('.force');
    if (force) force.onchange = (ev) => { ov.forceShow = ev.target.checked; refreshAll(); };
    const chips = d.querySelector('.attrs');
    const addChip = (label, on, title, cls, toggle) => {
      const c = document.createElement('span');
      c.className = 'chip ' + cls + (on ? '' : ' off');
      c.textContent = label; c.title = title;
      c.onclick = () => { toggle(!on); refreshAll(); renderModels(f); };
      chips.appendChild(c);
    };
    for (const [a, info] of attrs) {
      const on = ov.attrs?.[a] ?? info.show;
      addChip(a, on, info.why, '', (v) => { (ov.attrs ||= {})[a] = v; });
    }
    for (const a of otherAttrs) {
      const on = ov.attrs?.[a] ?? true;
      addChip(a, on, 'no rule hides this attribute here', '', (v) => { (ov.attrs ||= {})[a] = v; });
    }
    for (const s of m.shapeNames) {
      const on = ov.shapes?.[s] ?? m.shapesOn.includes(s);
      addChip(s, on, m.shapesOn.includes(s) ? 'switched on by what else is worn' : 'shape key (off by default here)', 'shape',
        (v) => { (ov.shapes ||= {})[s] = v; });
    }
    box.appendChild(d);
  }
}
function refreshAll() { for (const f of st.figures) f.refresh(); }

function filterText() { return $('filter').value.toLowerCase(); }
function renderProblems(sc) {
  const q = filterText();
  // what the game-shader renderer noticed while drawing (shader inputs nothing provides, unknown constants)
  const game = (typeof xr !== 'undefined' && xrWanted() ? xr.notes : []).map((t) => ({ level: 'render', text: t, ref: null }));
  const rows = sc.problems.concat(game).filter((p) => !q || p.text.toLowerCase().includes(q));
  $('nProblems').textContent = sc.problems.filter((p) => p.level === 'error').length || '';
  $('tab-problems').innerHTML = rows.length ? `<table class="t"><tr><th>level</th><th>problem</th></tr>${rows.map((p) =>
    `<tr data-ref="${p.ref ?? ''}"><td class="lvl ${p.level}">${p.level}</td><td class="mono">${esc(p.text)}</td></tr>`).join('')}</table>`
    : '<p class="muted">No problems found for this setup.</p>';
  for (const tr of $('tab-problems').querySelectorAll('tr[data-ref]')) tr.onclick = () => {
    if (tr.dataset.ref === '') return;
    showTab('trace'); const el = document.querySelector(`#tab-trace [data-id="${tr.dataset.ref}"]`);
    if (el) { el.classList.add('sel'); el.scrollIntoView({ block: 'center' }); }
  };
}

function renderTrace(sc) {
  const kids = {};
  for (const e of sc.trace) (kids[e.parent ?? 'root'] ||= []).push(e);
  const q = filterText();
  const line = (e) => {
    const extra = [];
    if (e.deformer) extra.push(`deformer ${e.deformer}`);
    if (e.eqdp) extra.push('EQDP: ' + e.eqdp.map((c) => `${c.race} model=${c.model ? 1 : 0} (${c.source})`).join(' → '));
    if (e.imc && e.imc.entry) extra.push(`IMC v${e.variant}: material v${String(e.imc.entry.MaterialId).padStart(4, '0')}, mask 0x${e.imc.entry.AttributeMask.toString(16)} (${e.imc.source})`);
    if (e.imc && !e.imc.entry && e.kind === 'model') extra.push('no IMC entry');
    if (e.est) extra.push(`EST ${e.est.slot} ${e.est.set} → skeleton ${e.est.skeleton} (${e.est.source})`);
    if (e.shader) extra.push(e.shader);
    return `<div class="line" data-id="${e.id}"><span class="kind">${esc(e.kind)}${e.slot ? ' ' + esc(e.slot) : ''}</span>
      ${srcBadge(e.status === 'error' ? 'error' : e.source)} <span class="mono">${esc(e.request)}${e.file && e.file !== e.request ? ' ← ' + esc(e.file) : ''}</span>
      ${e.option ? `<span class="muted">${esc(e.option)}</span>` : ''}${extra.length ? `<span class="muted">· ${extra.map(esc).join(' · ')}</span>` : ''}</div>`;
  };
  const show = (e) => !q || JSON.stringify(e).toLowerCase().includes(q);
  const tree = (pid) => (kids[pid] || []).map((e) => {
    const sub = tree(e.id);
    return show(e) || sub ? line(e) + (sub ? `<div class="node">${sub}</div>` : '') : '';
  }).join('');
  $('tab-trace').innerHTML = `<div class="tree">${tree('root')}</div>`;
}

function renderFiles(sc) {
  if (!st.open) { $('tab-files').innerHTML = '<p class="muted">No mod open.</p>'; return; }
  const used = new Set(sc.trace.filter((e) => e.source === 'mod' || e.source === 'swap').map((e) => e.request));
  const q = filterText();
  const rows = st.open.files.filter((f) => !q || f.path.includes(q) || f.option.toLowerCase().includes(q));
  const nUsed = st.open.files.filter((f) => used.has(f.path)).length;
  $('tab-files').innerHTML = `<p class="muted">${nUsed} of ${st.open.files.length} redirections are requested by this preview
    (others belong to other races, slots, variants or options). Swaps: ${st.open.swaps.length}.</p>
    <table class="t"><tr><th>used</th><th>game path</th><th>file in mod</th><th>option</th></tr>${rows.map((f) =>
    `<tr><td>${used.has(f.path) ? '●' : ''}${f.present ? '' : ' <span class="lvl error">absent</span>'}</td><td class="mono">${esc(f.path)}</td>
     <td class="mono">${esc(f.inner)}</td><td>${esc(f.option)}</td></tr>`).join('')}
    ${st.open.swaps.map((s) => `<tr><td>${used.has(s.path) ? '●' : ''} swap</td><td class="mono">${esc(s.path)}</td><td class="mono">→ ${esc(s.to)}</td><td>${esc(s.option)}</td></tr>`).join('')}</table>`;
}

function renderMeta(sc) {
  let h = '';
  if (sc.eqp) {
    h += `<h2>EQP (combined ${esc(sc.eqp.value)})</h2><table class="t"><tr><th>slot</th><th>bits from</th><th>entry source</th><th>flags</th></tr>`;
    for (const s of ['top', 'dwn', 'glv', 'sho', 'met']) {
      const e = sc.eqp[s];
      h += `<tr><td>${SLOT_LABEL[s]}</td><td>${SLOT_LABEL[e.takenFrom]}</td><td>${esc(e.source)}</td><td class="mono">${e.flags.map(esc).join(' ')}</td></tr>`;
    }
    h += '</table>';
  }
  const q = filterText();
  const ms = (sc.manips || []).filter((m) => !q || JSON.stringify(m).toLowerCase().includes(q));
  h += `<h2 style="margin-top:12px">Active manipulations (${sc.manips.length})</h2><table class="t"><tr><th>type</th><th>manipulation</th><th>option</th></tr>
    ${ms.slice(0, 400).map((m) => `<tr><td>${esc(m.type)}</td><td class="mono">${esc(JSON.stringify(m.manip))}</td><td>${esc(m.option)}</td></tr>`).join('')}</table>`;
  if (sc.conflicts?.length) h += `<h2 style="margin-top:12px">Conflicts inside the mod (${sc.conflicts.length})</h2><table class="t">
    ${sc.conflicts.map((c) => `<tr><td class="mono">${esc(c.path || c.manip)}</td><td>wins: ${esc(c.winner)}</td><td>loses: ${esc(c.loser)}</td></tr>`).join('')}</table>`;
  $('tab-meta').innerHTML = h;
}

function renderMaterials(sc) {
  $('tab-materials').innerHTML = `<div class="mats">${sc.materials.map((m) => `<div class="mat">
    <div class="mono">${esc(m.path)}</div>
    ${m.missing ? '<div class="lvl error">missing</div>' : `<div class="muted">${esc(m.shader)} · ${m.doubleSided ? 'double-sided' : 'backfaces hidden'}${m.transparent ? ' · transparent' : ''}${m.alphaTest ? ' · alpha ' + m.alphaTest : ''}</div>
    <div>${['color', 'normal', 'orm', 'emissive'].filter((k) => m[k]).map((k) => `<img title="${k}" src="/baked/${encodeURIComponent(m[k])}">`).join('')}</div>
    <div class="mono muted">${Object.entries(m.roles || {}).map(([r, p]) => `${r}: ${esc(p)}`).join('<br>')}</div>
    ${(m.notes || []).map((n) => `<div class="why">${esc(n)}</div>`).join('')}`}</div>`).join('')}</div>`;
}

// ------------------------------------------------------------------ all races
async function checkRaces() {
  const subject = readSubject();
  if (subject.subject !== 'character') { $('racesOut').innerHTML = '<p class="muted">Characters only.</p>'; return; }
  $('racesOut').innerHTML = '<p class="muted">Resolving 18 races…</p>';
  try {
    const r = await post('/api/races_check', { path: st.path, settings: st.settings, subject });
    const slots = r.slots;
    $('racesOut').innerHTML = `<table class="t racegrid"><tr><th>race</th>${slots.map((s) => `<th>${SLOT_LABEL[s] || s}</th>`).join('')}<th>problems</th></tr>
      ${r.rows.map((row) => `<tr><td>${esc(row.label)}</td>${slots.map((s) => {
        const c = row.slots[s];
        if (!c) return '<td></td>';
        const cls = c.source === 'missing' ? 'bad' : c.deformed ? 'def' : c.source === 'mod' ? 'ok' : '';
        return `<td class="${cls}" title="${esc(c.request)}${c.hidden ? '\nhidden: ' + esc(c.hidden.join('; ')) : ''}">${esc(c.source)}${c.deformed ? ' ' + esc(c.modelRace) + '→' : ''}${c.hidden ? ' (hidden)' : ''}</td>`;
      }).join('')}<td>${row.errors ? `<span class="lvl error">${row.errors} errors</span> ` : ''}${row.warns ? `<span class="lvl warn">${row.warns} warnings</span>` : ''}
        <span class="muted">${esc(row.first || '')}</span></td></tr>`).join('')}</table>
      <p class="muted">mod = served by the mod · game = vanilla file · cRRRR→ = another race's model reshaped by the racial deformer.
      Click a race name in the Race box to look at it.</p>`;
  } catch (e) { $('racesOut').innerHTML = `<p class="lvl error">${esc(e.message)}</p>`; }
}

// ------------------------------------------------------------------ events
function showTab(name) {
  for (const b of document.querySelectorAll('.tabs button[data-tab]')) b.classList.toggle('on', b.dataset.tab === name);
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('on', t.id === 'tab-' + name);
}
for (const b of document.querySelectorAll('.tabs button[data-tab]')) b.onclick = () => showTab(b.dataset.tab);
$('dockToggle').onclick = () => { $('dock').classList.toggle('small'); resize(); };
$('filter').oninput = () => { const f = st.figures[0]; if (f) { renderProblems(f.sc); renderTrace(f.sc); renderFiles(f.sc); renderMeta(f.sc); } };
$('modList').onchange = () => { $('modPath').value = $('modList').value; openMod($('modList').value); };
$('openBtn').onclick = () => openMod($('modPath').value.trim().replace(/^"|"$/g, ''));
$('loadBtn').onclick = () => load();
$('modItemsBtn').onclick = () => { if (st.open) { applySubject(st.open.subject); load(); } };
$('subjectKind').onchange = () => applySubject({ subject: $('subjectKind').value, id: +$('cId').value, body: +$('cBody').value, variant: +$('cVar').value,
  race: $('race').value, gear: readSubject().gear });
for (const id of ['face', 'hair', 'tail', 'texFull', 'cId', 'cBody', 'cVar', 'beard', 'hlOn', 'useCollection', 'facePaint', 'paintColor', 'paintFlip']) $(id).onchange = () => load();
$('race').onchange = async () => { await loadPalette(); load(); };
$('clan').onchange = async () => { await loadPalette(); load(); };
$('height').oninput = () => { $('heightVal').textContent = $('height').value; };
$('height').onchange = () => load();
$('bust').oninput = () => { $('bustVal').textContent = $('bust').value; };
$('bust').onchange = () => load();
for (const b of document.querySelectorAll('button.sw')) b.onclick = () => openPalette(b.dataset.kind);
$('glamBtn').onclick = () => pasteGlamourer();
$('glamCancel').onclick = () => { $('glamDlg').hidden = true; };
$('glamApply').onclick = () => applyGlamourer();
$('light').onchange = () => { applyLight(); refreshAll(); updateAo(); };
$('vAo').onchange = () => { updateAo(); xr.sig = ''; };
for (const id of ['lightAz', 'lightEl', 'lightAmb']) $(id).oninput = () => applyLight();
for (const c of document.querySelectorAll('.feat')) c.onchange = () => load();
$('pose').onchange = () => { for (const f of st.figures) applyPose(f, clock.getElapsedTime()); };
for (const id of ['colorMode', 'vWire', 'vHidden', 'vSkel']) $(id).onchange = () => { refreshAll(); renderPanels(); updateAo(); };
$('vVanilla').onchange = () => load();
$('vGrid').onchange = () => { grid.visible = $('vGrid').checked; };
$('vShadow').onchange = () => { key.castShadow = $('vShadow').checked; };
$('renderer').onchange = () => { xr.sig = ''; updateAo(); };
$('boneSearch').onchange = () => { st.selectedBone = $('boneSearch').value.trim(); if ($('colorMode').value !== 'weights') $('colorMode').value = 'weights'; refreshAll(); renderPanels(); };
$('racesBtn').onclick = () => checkRaces();
canvas.addEventListener('dblclick', (ev) => {
  // double-click a mesh: show its model in the trace
  const r = canvas.getBoundingClientRect();
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera);
  const meshes = []; for (const f of st.figures) f.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const hit = ray.intersectObjects(meshes, false)[0];
  if (!hit) return;
  const f = st.figures.find((x) => x.group === hit.object.parent);
  const m = f.models[hit.object.userData.model];
  const me = m.meshes[hit.object.userData.mesh];
  status(`${m.info.slot}: ${m.info.request} · mesh ${hit.object.userData.mesh} · ${me.me.materialName}`);
  showTab('trace');
  const el = document.querySelector(`#tab-trace [data-id="${m.info.trace}"]`);
  for (const x of document.querySelectorAll('#tab-trace .sel')) x.classList.remove('sel');
  if (el) { el.classList.add('sel'); el.scrollIntoView({ block: 'center' }); }
});
// drop a .pmp anywhere on the page
window.addEventListener('dragover', (ev) => { ev.preventDefault(); });
window.addEventListener('drop', async (ev) => {
  ev.preventDefault();
  const file = ev.dataTransfer.files[0];
  if (!file) return;
  status(`Uploading ${file.name}…`);
  try {
    const r = await fetch('/api/upload', { method: 'POST', headers: { 'X-File-Name': encodeURIComponent(file.name) }, body: file });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error || r.statusText);
    $('modPath').value = j.path;
    await openMod(j.path);
  } catch (e) { status('Upload failed: ' + e.message); }
});
// tell the desktop app this window is open, and when it closes
setInterval(() => fetch('/api/ping').catch(() => {}), 2000);
window.addEventListener('pagehide', () => navigator.sendBeacon('/api/bye'));
applyLight();
updateAo();
init().catch((e) => status('Startup failed: ' + e.message));

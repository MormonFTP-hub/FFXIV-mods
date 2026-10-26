// Run in the viewer page's devtools console (or a browser-automation tool) to prepare light calibration:
// set up the outfit, race and camera so the figure lines up with a video frame, then save the frame request and scene.
//   cal.cam(yawDeg, distance, eyeY, targetY, fovDeg, targetX)   camera orbiting the figure (yaw 0 = in front)
//   await cal.shot('name.png')                                   game-shader still into work/captures (to check alignment)
//   await cal.save('fending')                                    work/captures/cal_state_fending.png + cal_scene_fending.png
// Then copy those two to work/calibration/state_fending.bin and scene_fending.json and run tools/calibrate_light.py.
window.cal = {
  cam(yawDeg, dist, eyeY, targetY, fov, tx = 0) {
    const p = window.pmpv, t = yawDeg * Math.PI / 180;
    p.camera.fov = fov; p.camera.updateProjectionMatrix();
    p.controls.target.set(tx, targetY, 0);
    p.camera.position.set(tx + Math.sin(t) * dist, eyeY, Math.cos(t) * dist);
    p.camera.lookAt(p.controls.target); p.controls.update();
  },
  async upload(name, body) {
    const r = await fetch('/api/capture', { method: 'POST', headers: { 'X-File-Name': name }, body });
    return (await r.json()).path;
  },
  async shot(name, w = 1728, h = 1080) { return cal.upload(name, await window.pmpv.captureFrame(w, h)); },
  async save(name, w = 864, h = 540) {
    const s = window.pmpv.frameState();
    Object.assign(s.head, { width: w, height: h, format: 'rgba' });
    const json = new TextEncoder().encode(JSON.stringify(s.head));
    const n = s.arrays.reduce((k, a) => k + a.byteLength, 0);
    const bytes = new Uint8Array(4 + json.length + n);
    new DataView(bytes.buffer).setUint32(0, json.length, true); bytes.set(json, 4);
    let o = 4 + json.length;
    for (const a of s.arrays) { bytes.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), o); o += a.byteLength; }
    const scene = { figures: window.pmpv.st().figures.map((fig) => {
      const r = fig.sc.render || { redirects: {}, models: [] };
      return { redirects: r.redirects, customize: r.customize,
        models: r.models.map((m, i) => ({ id: m.slot + ':' + i, mdl: m.mdl, materials: m.materials, stains: m.stains || [] })) };
    }) };
    return [await cal.upload(`cal_state_${name}.png`, bytes), await cal.upload(`cal_scene_${name}.png`, JSON.stringify(scene))];
  },
};

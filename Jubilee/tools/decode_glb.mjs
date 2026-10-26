// Undo EXT_meshopt_compression in a psylocke.gg .glb: every compressed buffer view is decoded into one plain
// BIN chunk, so tools/srcdata.py can read the accessors directly. Image URIs (CDN hashes) are left as they are.
//
// usage: node tools/decode_glb.mjs <in.glb> <out.glb>
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// packages live in apps/npm (npm install --prefix apps/npm meshoptimizer three)
const { MeshoptDecoder } = createRequire(new URL('../apps/npm/package.json', import.meta.url))('meshoptimizer');

const [src, dst] = process.argv.slice(2);
const buf = readFileSync(src);
const jsonLen = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;
const bin = buf.subarray(binStart, binStart + buf.readUInt32LE(20 + jsonLen));
if (gltf.buffers.some((b, i) => b.uri && i === 0)) throw new Error('expected the BIN chunk as buffer 0');

await MeshoptDecoder.ready;
const parts = [];
let offset = 0;
for (const view of gltf.bufferViews) {
  const ext = view.extensions?.EXT_meshopt_compression;
  let data;
  if (ext) {
    if (ext.buffer !== 0) throw new Error('compressed data outside the BIN chunk');
    data = new Uint8Array(ext.count * ext.byteStride);
    const source = new Uint8Array(bin.buffer, bin.byteOffset + (ext.byteOffset ?? 0), ext.byteLength);
    MeshoptDecoder.decodeGltfBuffer(data, ext.count, ext.byteStride, source, ext.mode, ext.filter ?? 'NONE');
    delete view.extensions.EXT_meshopt_compression;
    if (!Object.keys(view.extensions).length) delete view.extensions;
  } else {
    if (view.buffer !== 0) throw new Error('uncompressed view outside the BIN chunk');
    data = new Uint8Array(bin.buffer, bin.byteOffset + (view.byteOffset ?? 0), view.byteLength);
  }
  const pad = (4 - (offset % 4)) % 4;
  if (pad) { parts.push(new Uint8Array(pad)); offset += pad; }
  view.buffer = 0;
  view.byteOffset = offset;
  view.byteLength = data.length;
  parts.push(data);
  offset += data.length;
}
const tail = (4 - (offset % 4)) % 4;
if (tail) { parts.push(new Uint8Array(tail)); offset += tail; }
gltf.buffers = [{ byteLength: offset }];
for (const key of ['extensionsUsed', 'extensionsRequired'])
  if (gltf[key]) gltf[key] = gltf[key].filter((e) => e !== 'EXT_meshopt_compression');

let json = Buffer.from(JSON.stringify(gltf), 'utf8');
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + json.length + 8 + offset, 8);
const chunk = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
writeFileSync(dst, Buffer.concat([header, chunk(json.length, 0x4e4f534a), json, chunk(offset, 0x004e4942),
  ...parts.map((p) => Buffer.from(p.buffer, p.byteOffset, p.byteLength))]));
console.log(`decoded ${gltf.bufferViews.length} buffer views, ${offset} bytes -> ${dst}`);

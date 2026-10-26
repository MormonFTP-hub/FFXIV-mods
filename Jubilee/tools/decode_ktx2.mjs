// Transcode psylocke.gg KTX2 textures (Basis UASTC, zstd) to raw RGBA8 with the Basis Universal transcoder that
// ships with three.js. Writes <out>/<hash>.rgba plus <out>/<hash>.json {width, height}; tools/srcdata.py turns them
// into PNGs. Only mip 0 of layer 0 is kept.
//
// usage: node tools/decode_ktx2.mjs <outdir> <file.ktx2> [...]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// three is installed in apps/npm (npm install --prefix apps/npm meshoptimizer three)
const libDir = fileURLToPath(new URL('../apps/npm/node_modules/three/examples/jsm/libs/basis/', import.meta.url));
const require = createRequire(import.meta.url);
// three's package is "type": "module", so its CommonJS transcoder is run with an explicit module wrapper
const transcoderJs = join(libDir, 'basis_transcoder.js');
const mod = { exports: {} };
new Function('module', 'exports', 'require', '__filename', '__dirname', readFileSync(transcoderJs, 'utf8'))(
  mod, mod.exports, require, transcoderJs, libDir);
const BASIS = mod.exports;
const RGBA32 = 13;   // three's KTX2Loader TranscoderFormat.RGBA32

const [out, ...files] = process.argv.slice(2);
const basis = await BASIS({ wasmBinary: readFileSync(join(libDir, 'basis_transcoder.wasm')) });
basis.initializeBasis();
for (const f of files) {
  const name = basename(f).replace(/\.ktx2$/, '');
  if (existsSync(join(out, name + '.json'))) continue;
  const k = new basis.KTX2File(new Uint8Array(readFileSync(f)));
  if (!k.isValid()) throw new Error('invalid KTX2 ' + f);
  const width = k.getWidth(), height = k.getHeight();
  if (!k.startTranscoding()) throw new Error('startTranscoding failed ' + f);
  const dst = new Uint8Array(k.getImageTranscodedSizeInBytes(0, 0, 0, RGBA32));
  if (!k.transcodeImage(dst, 0, 0, 0, RGBA32, 0, -1, -1)) throw new Error('transcode failed ' + f);
  writeFileSync(join(out, name + '.rgba'), dst);
  writeFileSync(join(out, name + '.json'), JSON.stringify({ width, height, uastc: k.isUASTC(), alpha: k.getHasAlpha() }));
  k.close(); k.delete();
  console.log(`${name.slice(0, 12)} ${width}x${height}`);
}

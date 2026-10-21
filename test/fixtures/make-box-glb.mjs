// Writes a minimal valid .glb (one coloured box, 1 x 2 x 1 m) for the model-loader test.
// Usage: node test/fixtures/make-box-glb.mjs <out.glb>
import fs from 'node:fs';

const out = process.argv[2] ?? 'test/fixtures/box.glb';
const P = [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 2, -0.5], [-0.5, 2, -0.5], [-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 2, 0.5], [-0.5, 2, 0.5]];
const I = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5, 3, 7, 6, 3, 6, 2, 0, 1, 5, 0, 5, 4];
const pos = Buffer.alloc(P.length * 12);
P.forEach((p, i) => p.forEach((v, j) => pos.writeFloatLE(v, i * 12 + j * 4)));
const idx = Buffer.alloc(I.length * 2);
I.forEach((v, i) => idx.writeUInt16LE(v, i * 2));
const bin = Buffer.concat([pos, idx, Buffer.alloc((4 - ((pos.length + idx.length) % 4)) % 4)]);
const json = {
  asset: { version: '2.0', generator: 'gametool test fixture' },
  scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'box' }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
  materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.55, 0.36, 0.48, 1], metallicFactor: 0 } }],
  buffers: [{ byteLength: bin.length }],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pos.length, target: 34962 }, { buffer: 0, byteOffset: pos.length, byteLength: idx.length, target: 34963 }],
  accessors: [
    { bufferView: 0, componentType: 5126, count: P.length, type: 'VEC3', min: [-0.5, 0, -0.5], max: [0.5, 2, 0.5] },
    { bufferView: 1, componentType: 5123, count: I.length, type: 'SCALAR' },
  ],
};
let js = Buffer.from(JSON.stringify(json));
js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
const chunk = (type, data) => { const h = Buffer.alloc(8); h.writeUInt32LE(data.length, 0); h.writeUInt32LE(type, 4); return Buffer.concat([h, data]); };
fs.writeFileSync(out, Buffer.concat([header, chunk(0x4e4f534a, js), chunk(0x004e4942, bin)]));
console.log('wrote', out);

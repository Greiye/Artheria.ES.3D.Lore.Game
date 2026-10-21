// .glb model loader (owner request 2026-10-21). Drop `public/models/<slot>.glb` into the repo and the
// game swaps that slot's placeholder for the model. Missing or broken file → the placeholder stays (§0 rule 1).
// Models are served next to index.html (not inlined), so they only download when they exist and the
// single-file build stays small. Draco and Meshopt compression are both supported.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export interface ModelSlot {
  id: string;                    // file name without .glb, e.g. "natalie"
  placeholder: THREE.Object3D;   // hidden once the model loads
  height: number;                // the model is scaled to this height (m), feet on the ground
  parent?: THREE.Object3D;       // where the model goes (default: the placeholder's parent)
  faceYaw?: number;              // extra rotation so the model faces the right way
}

const MODEL_DIR = './models/';
let loader: GLTFLoader | null = null;
function getLoader(): GLTFLoader {
  if (loader) return loader;
  const draco = new DRACOLoader();
  draco.setDecoderPath('./draco/');   // public/draco: fetched only when a Draco-compressed model needs it
  loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

// A6/A3 look: untextured models get the world's 3-step toon ramp; textured ones render unlit (see below).
const ramp = new THREE.DataTexture(new Uint8Array([150, 205, 255]), 3, 1, THREE.RedFormat);
ramp.magFilter = ramp.minFilter = THREE.NearestFilter;
ramp.needsUpdate = true;
function toonify(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const conv = (mat: THREE.Material) => {
      const src = mat as THREE.MeshStandardMaterial;
      if (!('color' in src)) return mat;
      // Mega Man Legends-style models carry their light painted into the texture: show it unlit.
      if (src.map) return new THREE.MeshBasicMaterial({ map: src.map, color: src.color, transparent: src.transparent, alphaTest: src.alphaTest, side: src.side });
      return new THREE.MeshToonMaterial({ color: src.color, map: src.map ?? null, gradientMap: ramp, transparent: src.transparent, alphaTest: src.alphaTest, side: src.side });
    };
    m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material);
    m.castShadow = m.receiveShadow = true;
  });
}

declare const __MODEL_IDS__: string[];
// Which slots have a file: the build's list of public/models/*.glb. `?models=a,b` overrides it (tests).
// A double-clicked file:// page can't fetch files, so it keeps placeholders unless a test opts in.
const params = new URLSearchParams(location.search);
export const availableModels: Set<string> = params.has('models')
  ? new Set(params.get('models')!.split(',').filter(Boolean))
  : new Set(location.protocol === 'file:' ? [] : __MODEL_IDS__);

export const loadedModels = new Map<string, THREE.Object3D>();
export const failedModels = new Map<string, string>();

export function loadModel(id: string): Promise<THREE.Object3D | null> {
  return new Promise((resolve) => {
    getLoader().load(MODEL_DIR + id + '.glb', (gltf) => {
      toonify(gltf.scene);
      resolve(gltf.scene);
    }, undefined, (err) => {
      // A missing file is normal (no model made yet): note it quietly, keep the placeholder.
      failedModels.set(id, String((err as Error)?.message ?? err));
      resolve(null);
    });
  });
}

// Fit a loaded model to its slot: scale to `height`, feet at the placeholder's base, same position.
export async function fillSlot(slot: ModelSlot): Promise<boolean> {
  if (!availableModels.has(slot.id)) return false;
  const model = await loadModel(slot.id);
  if (!model) return false;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const k = size.y > 1e-6 ? slot.height / size.y : 1;
  model.scale.setScalar(k);
  const centre = box.getCenter(new THREE.Vector3());
  const holder = new THREE.Group();
  model.position.set(-centre.x * k, -box.min.y * k, -centre.z * k);
  holder.add(model);
  holder.rotation.y = slot.faceYaw ?? 0;
  holder.name = 'model:' + slot.id;
  const parent = slot.parent ?? slot.placeholder.parent;
  if (!parent) return false;
  if (!slot.parent) holder.position.copy(slot.placeholder.position);
  parent.add(holder);
  slot.placeholder.visible = false;
  slot.placeholder.userData.replacedBy = holder;
  loadedModels.set(slot.id, holder);
  return true;
}

// Fire-and-forget for every slot; the game never waits on models (F2.1 fade-in is not delayed).
export function fillSlots(slots: ModelSlot[]): Promise<boolean[]> {
  return Promise.all(slots.map((s) => fillSlot(s).catch(() => false)));
}

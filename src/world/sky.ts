import * as THREE from 'three';
import { shaftTexture } from '../tex/pixel';

// Rebuild R1: golden-hour sky, sun, fog, light shafts and drifting motes (docs/vision.md "Lighting glue").
// F2.2 still holds: a low orange sun (< 15°) and long shadows; the sky is teal overhead (Sacrifire)
// fading to warm gold at the horizon so the forest reads bright, not dusky.

export const SKY = {
  zenith: '#3F7FA6',
  upper: '#7FB3BF',
  horizon: '#EBCB92',
  glow: '#FFD9A0',
  fog: '#D9C79E',
  sunLight: '#FFC488',
  hemiSky: '#BFD8D2',
  hemiGround: '#4B5A2C',
};

export interface Sky {
  sun: THREE.DirectionalLight;
  sunDir: THREE.Vector3;
  shafts: THREE.Group;
  update(t: number, camera: THREE.Camera): void;
}

const noRaycast = () => {};

export function buildSky(scene: THREE.Scene, elevDeg: number, azDeg: number): Sky {
  const el = THREE.MathUtils.degToRad(elevDeg), az = THREE.MathUtils.degToRad(azDeg);
  // Azimuth measured from -Z (straight ahead at spawn) toward +X.
  const sunDir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  scene.background = new THREE.Color(SKY.fog);
  scene.fog = new THREE.Fog(SKY.fog, 28, 85);
  scene.add(new THREE.HemisphereLight(SKY.hemiSky, SKY.hemiGround, 1.25));
  const sun = new THREE.DirectionalLight(SKY.sunLight, 2.4);
  sun.position.copy(sunDir).multiplyScalar(90);
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 200;
  sun.shadow.bias = -0.0015;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // Sky dome: vertex-coloured gradient, warmest toward the sun. PLACEHOLDER: a sky shader with clouds.
  const skyGeo = new THREE.SphereGeometry(180, 48, 24);
  const col: number[] = [];
  const cZ = new THREE.Color(SKY.zenith), cU = new THREE.Color(SKY.upper), cH = new THREE.Color(SKY.horizon), cG = new THREE.Color(SKY.glow), c = new THREE.Color();
  const sp = skyGeo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < sp.count; i++) {
    v.fromBufferAttribute(sp, i).normalize();
    const up = THREE.MathUtils.clamp(v.y, 0, 1), toSun = Math.max(0, v.dot(sunDir));
    c.copy(cH).lerp(cU, Math.pow(up, 0.45)).lerp(cZ, Math.pow(up, 1.6)).lerp(cG, Math.pow(toSun, 8) * 0.9);
    col.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const dome = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.name = 'sky';
  dome.raycast = noRaycast;
  scene.add(dome);
  // Sun disc: over-bright so bloom haloes it.
  const disc = new THREE.Mesh(new THREE.CircleGeometry(6, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFE6B8').multiplyScalar(1.5), fog: false, depthWrite: false, side: THREE.DoubleSide }));
  disc.position.copy(sunDir).multiplyScalar(170);
  disc.lookAt(0, 0, 0);
  disc.raycast = noRaycast;
  scene.add(disc);

  // Light shafts: soft additive planes leaning along the sun direction, through the canopy gaps.
  // Cheap stand-ins for volumetric god rays (no extra pass, works on Low).
  const shafts = new THREE.Group();
  shafts.name = 'light-shafts';
  const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTexture(), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const geo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  // Artistic, not physical: the sun is low (F2.2) but the shafts fall steeply (55°) like Sacrifire's,
  // leaning toward the sun's azimuth. Each one turns about its own axis to face the camera.
  const flat = new THREE.Vector3(sunDir.x, 0, sunDir.z).normalize();
  const axis = flat.multiplyScalar(Math.cos(THREE.MathUtils.degToRad(55))).add(new THREE.Vector3(0, Math.sin(THREE.MathUtils.degToRad(55)), 0)).normalize();
  const spots: [number, number, number][] = [[-7, -6, 3.2], [6.5, -9, 2.6], [-11, 5, 2.2], [9, 4, 3.0], [-3.5, -12, 2.4], [13, -3, 2.0], [-15, -8, 2.8], [4, 13, 2.2], [-9, 15, 2.6]];
  for (const [x, z, w] of spots) {
    const m = new THREE.Mesh(geo, shaftMat);
    m.scale.set(w, 16, 1);
    m.position.set(x, -0.5, z);
    m.raycast = noRaycast;
    shafts.add(m);
  }
  scene.add(shafts);

  // Drifting motes / pollen catching the light (Sacrifire, DDLC fanart).
  const N = 240, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = i * 2.399, r = 2 + Math.sqrt(i / N) * 22;
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = 0.4 + (i * 0.618 % 1) * 4; pos[i * 3 + 2] = Math.sin(a) * r;
    seed[i] = i * 0.37;
  }
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: new THREE.Color('#FFE2A8').multiplyScalar(1.3), size: 0.045, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  motes.raycast = noRaycast;
  motes.name = 'motes';
  scene.add(motes);
  const base = pos.slice();

  return {
    sun, sunDir, shafts,
    update(t: number, camera: THREE.Camera) {
      const toCam = new THREE.Vector3(), n = new THREE.Vector3(), xa = new THREE.Vector3(), basis = new THREE.Matrix4();
      for (const m of shafts.children) {
        toCam.copy(camera.position).sub(m.position);
        n.copy(toCam).addScaledVector(axis, -axis.dot(toCam)).normalize();
        xa.crossVectors(axis, n).normalize();
        basis.makeBasis(xa, axis, n);
        m.quaternion.setFromRotationMatrix(basis);
      }
      shaftMat.opacity = 0.18 + Math.sin(t * 0.5) * 0.04;
      const p = mg.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < N; i++) {
        p.array[i * 3] = base[i * 3] + Math.sin(t * 0.21 + seed[i]) * 0.6;
        p.array[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.33 + seed[i] * 1.7) * 0.35;
        p.array[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.17 + seed[i]) * 0.6;
      }
      p.needsUpdate = true;
    },
  };
}

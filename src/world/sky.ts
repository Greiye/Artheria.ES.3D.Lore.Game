import * as THREE from 'three';
import { shaftTexture } from '../tex/pixel';

// Rebuild R1: golden-hour sky, sun, fog, light shafts and drifting motes (docs/vision.md "Lighting glue").
// F2.2 still holds: a low orange sun (< 15°) and long shadows; the sky is teal overhead (Sacrifire)
// fading to warm gold at the horizon so the forest reads bright, not dusky.

// Storybook restyle S3: a bright storybook sky (deep blue overhead, pale toward a warm horizon) and
// lighter, bluer haze, after the "Echoes of Avalon" boards; the sun stays low and warm (F2.2).
const SKY = {
  zenith: '#3A78C8',
  upper: '#78AEE0',
  horizon: '#E8E2C8',
  glow: '#FFE2A8',
  fog: '#C8DCE6',
  sunLight: '#FFD8A8',
  hemiSky: '#D0E4F0',
  hemiGround: '#6A7A3A',
};

// v0.04 time of day. The game starts at a dark sunset (bring a torch); sleeping on the bedroll moves it on:
// day -> sunset -> night -> day. Each phase sets the sun (or moon), sky gradient, haze, fill light and shafts.
// Style pass 1: warm key light, cool (teal / slate) fill from below.
export type TimeOfDay = 'day' | 'sunset' | 'night';
export const NEXT_TIME: Record<TimeOfDay, TimeOfDay> = { day: 'sunset', sunset: 'night', night: 'day' };
interface Phase {
  elev: number; az: number; sun: string; sunI: number; hemiSky: string; hemiGround: string; hemiI: number;
  zenith: string; upper: string; horizon: string; glow: string; fog: string; shafts: number; disc: string; stars: number;
}
const PHASES: Record<TimeOfDay, Phase> = {
  day: { elev: 38, az: 38, sun: '#FFEACA', sunI: 2.6, hemiSky: '#D4E8F6', hemiGround: '#5A7458', hemiI: 1.35,
    zenith: SKY.zenith, upper: SKY.upper, horizon: '#E8EEEC', glow: '#FFF2D0', fog: SKY.fog, shafts: 0.12, disc: '#FFF4DC', stars: 0 },
  // Darker than the old golden hour: the sun is nearly down, the fill is dim and violet.
  sunset: { elev: 6, az: 38, sun: '#FF9A50', sunI: 1.55, hemiSky: '#9AA8CC', hemiGround: '#3E4652', hemiI: 0.66,
    zenith: '#22346E', upper: '#5E64A0', horizon: '#F0A070', glow: '#FFB060', fog: '#8E8098', shafts: 0.16, disc: '#FFC890', stars: 0.25 },
  // v0.06 W3: a cooler, darker fill with a stronger moon key, so lanterns carry the scene and shapes still read.
  night: { elev: 32, az: 218, sun: '#86A2E8', sunI: 0.42, hemiSky: '#2C3C66', hemiGround: '#0C0C14', hemiI: 0.24,
    zenith: '#050918', upper: '#0E1834', horizon: '#222C48', glow: '#3A4668', fog: '#0E1426', shafts: 0, disc: '#DCE6FF', stars: 1 },
};

export interface Sky {
  sun: THREE.DirectionalLight;
  sunDir: THREE.Vector3;
  shafts: THREE.Group;
  readonly time: TimeOfDay;
  readonly elevationDeg: number;
  setTime(t: TimeOfDay): void;
  update(t: number, camera: THREE.Camera): void;
}

const noRaycast = () => {};

// Azimuth measured from -Z (straight ahead at spawn) toward +X.
const dirOf = (elevDeg: number, azDeg: number, out = new THREE.Vector3()) => {
  const el = THREE.MathUtils.degToRad(elevDeg), az = THREE.MathUtils.degToRad(azDeg);
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
};

export function buildSky(scene: THREE.Scene, elevDeg: number, azDeg: number): Sky {
  const sunDir = dirOf(elevDeg, azDeg);
  scene.background = new THREE.Color(SKY.fog);
  scene.fog = new THREE.Fog(SKY.fog, 28, 85);
  const hemi = new THREE.HemisphereLight(SKY.hemiSky, SKY.hemiGround, 1.25);
  scene.add(hemi);
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
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3));
  const paintDome = (p: Pick<Phase, 'zenith' | 'upper' | 'horizon' | 'glow'>) => {
    const cZ = new THREE.Color(p.zenith), cU = new THREE.Color(p.upper), cH = new THREE.Color(p.horizon), cG = new THREE.Color(p.glow), c = new THREE.Color();
    const sp = skyGeo.attributes.position, col = skyGeo.attributes.color as THREE.BufferAttribute, v = new THREE.Vector3();
    for (let i = 0; i < sp.count; i++) {
      v.fromBufferAttribute(sp, i).normalize();
      const up = THREE.MathUtils.clamp(v.y, 0, 1), toSun = Math.max(0, v.dot(sunDir));
      c.copy(cH).lerp(cU, Math.pow(up, 0.45)).lerp(cZ, Math.pow(up, 1.6)).lerp(cG, Math.pow(toSun, 8) * 0.9);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  };
  paintDome(SKY);
  const dome = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.name = 'sky';
  dome.renderOrder = 10;   // drawn after the world, so depth testing skips every pixel already covered
  dome.raycast = noRaycast;
  scene.add(dome);
  // Sun disc: over-bright so bloom haloes it.
  const disc = new THREE.Mesh(new THREE.CircleGeometry(6, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFE6B8').multiplyScalar(1.5), fog: false, depthWrite: false, side: THREE.DoubleSide }));
  disc.position.copy(sunDir).multiplyScalar(170);
  disc.lookAt(0, 0, 0);
  disc.raycast = noRaycast;
  disc.renderOrder = 11;
  scene.add(disc);
  // Stars, for dusk and night.
  const starPos: number[] = [];
  for (let i = 0; i < 500; i++) {
    const a = i * 2.399, y = 0.12 + (i * 0.618 % 1) * 0.88, r = Math.sqrt(1 - y * y);
    starPos.push(Math.cos(a) * r * 172, y * 172, Math.sin(a) * r * 172);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: '#E8EEFF', size: 1.1, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  stars.name = 'stars'; stars.raycast = noRaycast; stars.renderOrder = 11;
  scene.add(stars);

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
  const spots: [number, number, number][] = [[-7, -6, 3.2], [6.5, -9, 2.6], [-11, 5, 2.2], [9, 4, 3.0], [-3.5, -12, 2.4], [13, -3, 2.0], [-15, -8, 2.8]];
  // One instanced mesh: a single draw call for every shaft.
  const shaftMesh = new THREE.InstancedMesh(geo, shaftMat, spots.length);
  shaftMesh.raycast = noRaycast;
  shaftMesh.frustumCulled = false;
  shafts.add(shaftMesh);
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
  let shaftBase = 0.18;

  let time: TimeOfDay = 'day', elev = elevDeg;
  return {
    sun, sunDir, shafts,
    get time() { return time; },
    get elevationDeg() { return elev; },
    setTime(t: TimeOfDay) {
      const p = PHASES[t];
      time = t; elev = p.elev;
      dirOf(p.elev, p.az, sunDir);
      sun.position.copy(sunDir).multiplyScalar(90);
      sun.color.set(p.sun); sun.intensity = p.sunI;
      hemi.color.set(p.hemiSky); hemi.groundColor.set(p.hemiGround); hemi.intensity = p.hemiI;
      (scene.fog as THREE.Fog).color.set(p.fog);
      (scene.background as THREE.Color).set(p.fog);
      paintDome(p);
      disc.position.copy(sunDir).multiplyScalar(170); disc.lookAt(0, 0, 0);
      (disc.material as THREE.MeshBasicMaterial).color.set(p.disc).multiplyScalar(t === 'night' ? 1.1 : 1.5);
      disc.scale.setScalar(t === 'night' ? 0.55 : 1);
      shafts.visible = p.shafts > 0; shaftBase = p.shafts;
      starMat.opacity = p.stars;
    },
    update(t: number, camera: THREE.Camera) {
      const toCam = new THREE.Vector3(), n = new THREE.Vector3(), xa = new THREE.Vector3(), basis = new THREE.Matrix4(), sp0 = new THREE.Vector3(), q0 = new THREE.Quaternion(), sc0 = new THREE.Vector3();
      spots.forEach(([x, z, w], i) => {
        sp0.set(x, -0.5, z);
        toCam.copy(camera.position).sub(sp0);
        n.copy(toCam).addScaledVector(axis, -axis.dot(toCam)).normalize();
        xa.crossVectors(axis, n).normalize();
        basis.makeBasis(xa, axis, n);
        q0.setFromRotationMatrix(basis);
        shaftMesh.setMatrixAt(i, basis.compose(sp0, q0, sc0.set(w, 16, 1)));
      });
      shaftMesh.instanceMatrix.needsUpdate = true;
      shaftMat.opacity = shaftBase + Math.sin(t * 0.5) * 0.04;
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

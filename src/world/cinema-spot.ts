import * as THREE from 'three';
import { buildScreen } from '../cinema';
import { buildFigure } from './figure';
import type { World } from './index';

// v0.04 cinema: the Projectionist (a placeholder, never in the lore) shows short reels by Mike and friends
// (assets/cinema/) on a screen in a gap of the town ring.
export function buildCinemaSpot(world: World): { reelScreen: THREE.Mesh; projectionistHit: THREE.Mesh } {
  const cin = world.town.cinema, cc = Math.cos(cin.ry), cs = Math.sin(cin.ry);
  const cinAt = (lx: number, lz: number) => new THREE.Vector3(cin.x + lx * cc + lz * cs, 0, cin.z - lx * cs + lz * cc);
  const reelScreen = buildScreen();
  reelScreen.position.copy(cinAt(0, 0.02)).setY(1.95); reelScreen.rotation.y = cin.ry;
  world.scene.add(reelScreen);
  const projectionist = buildFigure({ skin: '#E0B890', hair: '#2A2A30', primary: '#2E3A5A', secondary: '#C9A36B', boots: '#2A221C', accent: '#F2C27A', hairStyle: 'cap', scarf: '#B8463A', build: 1.0 }, 1.75);
  const pj = cinAt(1.9, 1.0);
  projectionist.position.copy(pj); projectionist.rotation.y = cin.ry - 0.5; projectionist.name = 'standee:projectionist';
  world.scene.add(projectionist);
  world.colliders.push({ kind: 'circle', x: pj.x, z: pj.z, r: 0.35 });
  const projectionistHit = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
  projectionistHit.position.copy(pj).setY(0.9); projectionistHit.name = 'projectionist'; world.scene.add(projectionistHit);
  return { reelScreen, projectionistHit };
}

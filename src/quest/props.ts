import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { QUEST } from './quest';

// B2 in the world: the clue props (one merged mesh), a rune glint over each clue not yet found (one
// merged mesh, it blooms), invisible hitboxes for E, and the blue lead light. Three draw calls at most.
type Part = [THREE.BufferGeometry, string];
const col = new THREE.Color();
function tinted(g: THREE.BufferGeometry, hex: string) {
  const n = g.index ? g.toNonIndexed() : g;
  col.set(hex);
  const c = new Float32Array(n.attributes.position.count * 3);
  for (let i = 0; i < c.length; i += 3) { c[i] = col.r; c[i + 1] = col.g; c[i + 2] = col.b; }
  n.setAttribute('color', new THREE.BufferAttribute(c, 3));
  n.deleteAttribute('uv');
  return n;
}
const box = (w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) => new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y, z);

function propParts(kind: string): Part[] {
  switch (kind) {
    case 'string': return [[box(0.5, 0.01, 0.012, 0, 0.01, 0, 0.4), '#D8CBA6'], [box(0.3, 0.01, 0.012, 0.18, 0.01, 0.1, -0.6), '#D8CBA6']];
    case 'lantern': return [[box(0.16, 0.22, 0.16, 0, 0.08, 0).rotateZ(1.3), '#3A3A3E'], [box(0.1, 0.12, 0.1, 0.02, 0.08, 0).rotateZ(1.3), '#F2C94C']];
    case 'tracks': return Array.from({ length: 7 }, (_, i): Part => [box(0.12, 0.012, 0.26, (i % 2 ? 0.14 : -0.14) + i * 0.15, 0.006, -i * 0.75, -0.2), '#4A3A28']);
    case 'page': return [[box(0.2, 0.006, 0.26, 0, 0.003, 0, 0.3), '#EFE3C4'], [box(0.2, 0.007, 0.03, 0, 0.004, -0.1, 0.3), '#A8322A']];
    case 'tally': return [0, 1, 2, 3, 4].map((i): Part => [box(0.014, 0.22, 0.01, -0.09 + i * 0.045, 0, 0).rotateZ(i === 4 ? 1.1 : 0.06), '#2A2620']);
    case 'ash': return [[new THREE.RingGeometry(0.45, 0.62, 12).rotateX(-Math.PI / 2).translate(0, 0.01, 0), '#5FA8D8']];
    case 'ration': return [[box(0.34, 0.12, 0.24, 0, 0.06, 0, 0.5), '#9A7A4A'], [box(0.12, 0.05, 0.1, 0.22, 0.03, 0.12), '#C9A86A']];
    default: return [[box(0.2, 0.2, 0.2, 0, 0.1, 0), '#ff00ff']];
  }
}

export class QuestProps {
  readonly hitboxes = new Map<string, THREE.Mesh>();
  readonly lead: THREE.Mesh;
  readonly leadHit: THREE.Mesh;
  private props = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }));
  private glints = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x3FE0E8, transparent: true, opacity: 0.85 }));

  constructor(scene: THREE.Scene) {
    this.props.name = 'clues'; this.props.raycast = () => {};
    this.glints.name = 'clueGlints'; this.glints.raycast = () => {};
    scene.add(this.props, this.glints);
    const hidden = new THREE.MeshBasicMaterial({ visible: false });
    for (const c of QUEST.clues) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(c.prop === 'tracks' ? 1.4 : 0.9, 0.9, c.prop === 'tracks' ? 4.6 : 0.9), hidden);
      h.position.set(c.at[0], Math.max(0.35, c.at[1]), c.at[2] - (c.prop === 'tracks' ? 2.2 : 0));
      h.name = 'clue:' + c.id;
      scene.add(h);
      this.hitboxes.set(c.id, h);
    }
    this.lead = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: 0x6FB8FF }));
    this.lead.name = 'lead'; this.lead.visible = false; this.lead.raycast = () => {};
    this.leadHit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2, 1.4), hidden);
    this.leadHit.name = 'leadHit'; this.leadHit.visible = false;
    scene.add(this.lead, this.leadHit);
  }

  // Rebuild both merged meshes: every clue prop stays (it's evidence); found ones lose their glint.
  sync(found: string[]) {
    const parts: THREE.BufferGeometry[] = [], glints: THREE.BufferGeometry[] = [];
    for (const c of QUEST.clues) {
      const [x, y, z] = c.at;
      for (const [g, hex] of propParts(c.prop)) parts.push(tinted(g.translate(x, y, z), hex));
      if (!found.includes(c.id)) glints.push(new THREE.OctahedronGeometry(0.07, 0).toNonIndexed().scale(1, 1.6, 1).translate(x, y + 0.75, z).deleteAttribute('uv'));
      this.hitboxes.get(c.id)!.userData.found = found.includes(c.id);
    }
    this.props.geometry.dispose();
    this.props.geometry = mergeGeometries(parts.map((g) => { g.computeVertexNormals(); return g; }));
    this.glints.geometry.dispose();
    this.glints.geometry = glints.length ? mergeGeometries(glints) : new THREE.BufferGeometry();
    this.glints.visible = glints.length > 0;
  }

  showLead(where: string | null) {
    const l = where ? (QUEST.leads as Record<string, { at: number[] }>)[where] : null;
    this.lead.visible = this.leadHit.visible = !!l;
    if (l) { this.lead.position.set(l.at[0], 1.2, l.at[2]); this.leadHit.position.set(l.at[0], 1, l.at[2]); }
  }

  update(t: number) {
    this.glints.position.y = Math.sin(t * 2.4) * 0.05;
    if (this.lead.visible) { this.lead.rotation.y = t * 1.5; this.lead.position.y = 1.2 + Math.sin(t * 1.8) * 0.12; }
  }
}

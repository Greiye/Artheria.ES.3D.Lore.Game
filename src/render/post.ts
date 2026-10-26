import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Phase A polish: a light cinematic grade (HD-2D / backlog B15 notes): cool shadows, warm highlights,
// a touch more saturation. Kept subtle so the flat Legends colours still read.
const GradeShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 g = mix(vec3(l), c.rgb, 1.12);                                  // saturation
      g += (1.0 - smoothstep(0.0, 0.35, l)) * vec3(-0.012, 0.0, 0.025);    // cool shadows
      g += smoothstep(0.45, 1.0, l) * vec3(0.03, 0.012, -0.02);            // warm highlights
      gl_FragColor = vec4(max(g, 0.0), c.a);
    }`,
};

// Rebuild R1 (docs/vision.md, Sacrifire/HD-2D lighting): optional post effects behind the
// "Post effects" graphics toggle. Off = one plain render (Low preset, phones). On = bloom on
// the bright things only (sun, rune glow, lanterns, light shafts) at half resolution.
export class Post {
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private bloom: UnrealBloomPass;
  enabled = false;

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, camera);
    const size = renderer.getSize(new THREE.Vector2());
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.55, 0.5, 0.82);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new ShaderPass(GradeShader));
    this.composer.addPass(new OutputPass());
  }

  setEnabled(on: boolean) { this.enabled = on; }

  setSize(w: number, h: number) {
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
  }

  render(scene: THREE.Scene, camera: THREE.Camera) {
    if (!this.enabled) { this.renderer.render(scene, camera); return; }
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.composer.render();
  }
}

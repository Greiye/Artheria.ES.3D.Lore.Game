import * as THREE from 'three';

// Style pass 1: one colour grade for every built-in material, folded into the last step of each fragment shader
// (before the sRGB encode), so it costs no extra pass and works on Low. Works in linear light:
// a little more saturation, shadows lifted toward teal, highlights warmed (the storybook / MML look).
// Must run before the first material compiles (main.ts imports this first).
const GRADE = /* glsl */`
{
  vec3 c = gl_FragColor.rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l), c, 1.14), 0.0);
  float sh = 1.0 - smoothstep(0.0, 0.22, l);
  c += vec3(0.0, 0.0025, 0.005) * sh;
  c *= mix(vec3(1.0), vec3(1.05, 1.015, 0.94), smoothstep(0.25, 0.9, l));
  gl_FragColor.rgb = c;
}
`;
if (!THREE.ShaderChunk.colorspace_fragment.includes('storybook grade')) {
  THREE.ShaderChunk.colorspace_fragment = `// storybook grade${GRADE}${THREE.ShaderChunk.colorspace_fragment}`;
}

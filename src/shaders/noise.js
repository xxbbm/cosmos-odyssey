// Shared 3D value noise. No textures, network assets, or generated image maps.
export const noise = /* glsl */ `
float hash31(vec3 p) {
  p = fract(p * .1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f*f*(3.-2.*f);
  return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),
                 mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),
                 mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p) {
  float sum=0., a=.5;
  mat3 m=mat3(0.,.8,.6,-.8,.36,-.48,-.6,-.48,.64);
  for(int i=0;i<5;i++) { sum+=a*noise3(p); p=m*p*2.03+17.1; a*=.49; }
  return sum;
}
`;

export const surfaceVertex = /* glsl */ `
varying vec3 vLocal;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vLocal = position;
  vec4 world = modelMatrix * vec4(position,1.);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix)*normal);
  gl_Position = projectionMatrix*viewMatrix*world;
}
`;

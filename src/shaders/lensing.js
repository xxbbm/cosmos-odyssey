import { noise } from "./noise";
export const lensVertex = /*glsl*/ `
varying vec2 vUv;
varying vec3 vWorld;
void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}
`;
export const lensFragment = /*glsl*/ `
${noise}
uniform vec3 uCamera;
uniform vec3 uCenter;
uniform float uTime;
uniform float uLens;
uniform float uPresence;
varying vec2 vUv;
varying vec3 vWorld;
float background(vec3 direction){
  vec2 uv=vec2(atan(direction.z,direction.x),asin(clamp(direction.y,-1.,1.)));
  vec2 grid=uv*310.;vec2 cell=floor(grid),p=fract(grid)-.5;
  float seed=hash31(vec3(cell,11.));
  return step(.996,seed)*exp(-dot(p,p)*1600.)*.42;
}
void main(){
  if(uPresence<.001){discard;}
  vec3 ray=normalize(vWorld-uCenter-uCamera);
  float angularMomentum=dot(cross(uCamera,ray),cross(uCamera,ray));
  vec3 position=uCamera+ray*max(0.,dot(-uCamera,ray)-45.);
  vec3 radiance=vec3(0.);float transmission=1.;bool captured=false;
  for(int i=0;i<120;i++){
    float radius=length(position);
    if(radius<.85){captured=true;break;}
    if(radius>70.&&dot(position,ray)>0.)break;
    float stride=clamp((radius-.75)*.115,.02,2.5);
    float r2=radius*radius;
    vec3 acceleration=-position*(1.275*uLens*angularMomentum/(r2*r2*radius));
    vec3 midpointRay=normalize(ray+acceleration*stride*.5);
    vec3 next=position+midpointRay*stride;
    float nextR2=dot(next,next);
    vec3 nextAcceleration=-next*(1.275*uLens*angularMomentum/(nextR2*nextR2*sqrt(nextR2)));
    ray=normalize(ray+(acceleration+nextAcceleration)*stride*.5);
    if(position.y*next.y<0.){
      float fraction=position.y/(position.y-next.y);
      vec3 hit=mix(position,next,fraction);
      float r=length(hit.xz);
      if(r>2.3&&r<8.6){
        float azimuth=atan(hit.z,hit.x);
        float grain=noise3(vec3(hit.xz*2.7,uTime*.045))*.65+noise3(vec3(hit.xz*10.,uTime*.08))*.35;
        float filaments=.65+.35*noise3(vec3(r*35.,sin(azimuth)*4.,cos(azimuth)*4.+uTime*.04));
        float heat=pow(2.3/r,.8);
        vec3 thermal=mix(vec3(1.4,.38,.095),vec3(3.1,2.25,1.4),heat);
        vec3 velocity=normalize(vec3(-hit.z,0.,hit.x));
        float doppler=pow(clamp(1.+dot(velocity,ray)*.42,.45,1.5),1.3);
        float rim=smoothstep(2.3,2.7,r)*(1.-smoothstep(6.9,8.6,r));
        radiance+=transmission*thermal*(.55+grain*.65)*filaments*doppler*rim;
        transmission*=.22;
      }
    }
    position=next;
  }
  if(!captured)radiance+=transmission*vec3(.8,.88,1.)*background(ray);
  float edge=1.-smoothstep(.86,1.,max(abs(vUv.x-.5),abs(vUv.y-.5))*2.);
  gl_FragColor=vec4(radiance,edge*uPresence);
}
`;

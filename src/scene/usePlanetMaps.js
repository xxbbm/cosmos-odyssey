import { useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { noise } from "../shaders/noise";

const vertex = /*glsl*/ `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const shared = /*glsl*/ `
${noise}
varying vec2 vUv;
float detail(vec3 p){float result=0.,a=.5;for(int i=0;i<8;i++){result+=noise3(p)*a;p=p*2.03+vec3(17.7,31.1,9.7);a*=.5;}return result;}
float ellipse(vec2 p,vec2 center,vec2 radius){return (length((p-center)/radius)-1.)*min(radius.x,radius.y);}
vec3 sphere(vec2 ll){return vec3(cos(ll.y)*cos(ll.x),sin(ll.y),cos(ll.y)*sin(ll.x));}
`;
const terrain = /*glsl*/ `
${shared}
void main(){
  vec2 ll=(vUv-.5)*vec2(6.2831853,3.14159265);
  vec3 p=sphere(ll);
  vec2 warped=ll+vec2(detail(p*8.+7.)-.5,detail(p*8.+37.)-.5)*.09;
  float land=10.;
  // Continental silhouettes are analytic fields; all coast/terrain detail is
  // generated from 3D fractal noise, so the longitude seam is continuous.
  land=min(land,ellipse(warped,vec2(.25,.39),vec2(.44,.30)));
  land=min(land,ellipse(warped,vec2(.32,-.08),vec2(.30,.51)));
  land=min(land,ellipse(warped,vec2(.45,-.48),vec2(.17,.23)));
  land=min(land,ellipse(warped,vec2(.61,.08),vec2(.22,.12)));
  land=min(land,ellipse(warped,vec2(.25,.83),vec2(.39,.25)));
  land=min(land,ellipse(warped,vec2(.4,1.10),vec2(.13,.25)));
  land=min(land,ellipse(warped,vec2(1.26,.91),vec2(1.10,.37)));
  land=min(land,ellipse(warped,vec2(1.37,.40),vec2(.18,.38)));
  land=min(land,ellipse(warped,vec2(.80,.40),vec2(.24,.19)));
  land=min(land,ellipse(warped,vec2(1.90,.23),vec2(.22,.42)));
  land=min(land,ellipse(warped,vec2(2.32,-.48),vec2(.39,.22)));
  land=min(land,ellipse(warped,vec2(-1.92,.85),vec2(.68,.45)));
  land=min(land,ellipse(warped,vec2(-1.64,.46),vec2(.43,.30)));
  land=min(land,ellipse(warped,vec2(-1.40,.18),vec2(.22,.25)));
  land=min(land,ellipse(warped,vec2(-1.08,-.30),vec2(.32,.54)));
  land=min(land,ellipse(warped,vec2(-1.21,-.79),vec2(.15,.40)));
  land=min(land,ellipse(warped,vec2(-.65,1.18),vec2(.26,.24)));
  land+= (detail(p*110.)-.5)*.023+(noise3(p*420.)-.5)*.006;
  float mask=1.-smoothstep(-.002,.004,land);
  float fine=detail(p*175.);
  float terrain=detail(p*39.+4.);
  float desert=smoothstep(.18,.40,ll.y)*(1.-smoothstep(.55,.73,ll.y));
  desert*=smoothstep(.34,.65,detail(p*9.));
  vec3 forest=mix(vec3(.026,.046,.018),vec3(.11,.12,.065),terrain);
  vec3 soil=mix(forest,vec3(.23,.175,.105),desert);
  soil*=.72+fine*.65;
  float mountain=pow(1.-abs(noise3(p*83.)*2.-1.),7.)*smoothstep(.52,.7,terrain);
  soil=mix(soil,vec3(.17,.16,.135),mountain*.65);
  float ice=smoothstep(1.25,1.45,abs(ll.y)+terrain*.04);
  vec3 ocean=mix(vec3(.0025,.012,.027),vec3(.013,.065,.075),exp(-abs(land)*70.));
  vec3 color=mix(ocean,soil,mask);
  color=mix(color,vec3(.64,.71,.74)*(fine*.2+.85),ice);
  gl_FragColor=vec4(color,max(mask,ice));
}`;
const clouds = /*glsl*/ `
${shared}
void main(){
  vec2 ll=(vUv-.5)*vec2(6.2831853,3.14159265);
  vec2 center=vec2(.4,-.32),delta=ll-center;
  float angle=exp(-dot(delta,delta)/.06)*5.5;
  delta=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*delta;
  ll=mix(ll,center+delta,smoothstep(.38,.02,length(ll-center)));
  ll.x+=sin(ll.y*12.)*.04;
  vec3 p=sphere(ll);
  vec3 warp=vec3(detail(p*3.4),detail(p*3.4+11.),detail(p*3.4+37.));
  float weather=detail(p*10.+warp*2.8);
  float fine=detail(p*155.);
  float coverage=smoothstep(.495,.65,weather)*(.62+fine*.45);
  float wisps=smoothstep(.465,.61,detail(p*33.+warp*4.))*smoothstep(.49,.58,weather)*.22;
  gl_FragColor=vec4(clamp(coverage+wisps,0.,1.),fine,weather,1.);
}`;

export default function usePlanetMaps() {
  const { gl } = useThree();
  const resources = useMemo(() => {
    const options = {
      type: THREE.UnsignedByteType,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: true,
      depthBuffer: false,
    };
    const terrainTarget = new THREE.WebGLRenderTarget(2048, 1024, options),
      cloudTarget = new THREE.WebGLRenderTarget(2048, 1024, options);
    for (const target of [terrainTarget, cloudTarget]) {
      target.texture.wrapS = THREE.RepeatWrapping;
      target.texture.wrapT = THREE.ClampToEdgeWrapping;
    }
    return { terrainTarget, cloudTarget };
  }, []);
  useLayoutEffect(() => {
    const scene = new THREE.Scene(),
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: terrain,
      depthWrite: false,
      depthTest: false,
    });
    scene.add(new THREE.Mesh(geometry, material));
    const previous = gl.getRenderTarget();
    gl.setRenderTarget(resources.terrainTarget);
    gl.render(scene, camera);
    material.fragmentShader = clouds;
    material.needsUpdate = true;
    gl.setRenderTarget(resources.cloudTarget);
    gl.render(scene, camera);
    gl.setRenderTarget(previous);
    geometry.dispose();
    material.dispose();
    return () => {
      resources.terrainTarget.dispose();
      resources.cloudTarget.dispose();
    };
  }, [gl, resources]);
  return {
    terrain: resources.terrainTarget.texture,
    clouds: resources.cloudTarget.texture,
  };
}

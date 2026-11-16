import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Effect, BlendFunction } from "postprocessing";
import * as THREE from "three";
const fragment = /*glsl*/ `
uniform float uStrength;
uniform float uKind;
uniform float uTime;
uniform vec2 uCenter;
void mainImage(const in vec4 inputColor,const in vec2 uv,out vec4 outputColor){
  if(uStrength<.00001||uKind<1.5){outputColor=inputColor;return;}
  if(uKind>5.5){
    vec2 radial=(uv-uCenter)*uStrength*.12;
    vec4 blurred=inputColor*.18;
    for(int i=1;i<=6;i++){vec2 point=clamp(uv-radial*float(i)/6.,vec2(.001),vec2(.999));blurred+=texture2D(inputBuffer,point)*(.82/6.);}
    outputColor=blurred;return;
  }
  vec2 offset=vec2(0.);
  if(uKind<2.5){
    offset.x=sin(uv.y*34.+uTime*.25)*sin(uv.y*67.-uTime*.1)*uStrength*.004;
    offset.y=sin(uv.x*23.+uv.y*19.)*uStrength*.0015;
  }else if(uKind<3.5){
    offset.x=sin(uv.y*94.)*uStrength*.003;
  }else if(uKind<4.5){
    vec2 delta=uv-uCenter;float radius=length(delta);
    offset=delta*uStrength*.007/(.045+radius*radius);
  }else{
    offset=(uv-uCenter)*uStrength*.009;
  }
  vec2 point=clamp(uv+offset,vec2(.001),vec2(.999));
  vec4 color=texture2D(inputBuffer,point);
  if(uKind>2.5&&uKind<3.5){color.r=texture2D(inputBuffer,point+vec2(uStrength*.0008,0.)).r;color.b=texture2D(inputBuffer,point-vec2(uStrength*.0008,0.)).b;}
  outputColor=color;
}`;
class OpticalEffect extends Effect {
  constructor() {
    super("ObservatoryOptics", fragment, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([
        ["uStrength", new THREE.Uniform(0)],
        ["uKind", new THREE.Uniform(0)],
        ["uTime", new THREE.Uniform(0)],
        ["uCenter", new THREE.Uniform(new THREE.Vector2(0.5, 0.5))],
      ]),
    });
  }
}
export default function ObservatoryOptics({ journey }) {
  const effect = useMemo(() => new OpticalEffect(), []),
    projected = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => () => effect.dispose(), [effect]);
  useFrame(({ clock, camera }) => {
    const j = journey.current,
      site = j.site;
    const warp = j.busy && j.mode === "warp";
    effect.uniforms.get("uStrength").value = j.reduced
      ? 0
      : warp
        ? Math.sin(j.phase * Math.PI) ** 2
        : j.experience === "site"
          ? Math.sin(site.effectPhase * Math.PI) ** 2
          : 0;
    effect.uniforms.get("uKind").value = warp ? 6 : site.effect;
    effect.uniforms.get("uTime").value = clock.elapsedTime;
    projected.set(120, 0, -100).project(camera);
    effect.uniforms
      .get("uCenter")
      .value.set(
        THREE.MathUtils.clamp(projected.x * 0.5 + 0.5, 0.1, 0.9),
        THREE.MathUtils.clamp(projected.y * 0.5 + 0.5, 0.1, 0.9),
      );
  });
  return <primitive object={effect} dispose={null} />;
}

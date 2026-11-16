import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import { Flare } from "./Bodies";
import { ParticleField } from "./particles";
import { stageVisible } from "./cinematic";
import { surfaceVertex, noise } from "../shaders/noise";
import { atmosphereFragment } from "../shaders/planet";

const stellarFragment = /* glsl */ `
${noise}
uniform float uTime;
uniform vec3 uColor;
uniform float uPresence;
varying vec3 vLocal;
varying vec3 vWorld;
varying vec3 vNormal;
void main(){
  vec3 p=normalize(vLocal);
  float cells=fbm(p*19.+vec3(uTime*.025,0.,0.));
  float granules=noise3(p*175.+vec3(uTime*.016));
  float pores=pow(1.-granules,3.);
  float detail=noise3(p*440.+uTime*.02);
  vec3 view=normalize(cameraPosition-vWorld);
  float limb=.45+.55*pow(max(dot(normalize(vNormal),view),0.),.4);
  float activity=smoothstep(.56,.8,fbm(p*7.));
  vec3 color=uColor*(.8+cells*.9+granules*.55+detail*.12-pores*.75-activity*.5)*limb;
  gl_FragColor=vec4(color*uPresence,1.);
}
`;
const coronaFragment = /*glsl*/ `${noise}
uniform float uTime;uniform vec3 uColor;uniform float uPresence;varying vec3 vWorld;varying vec3 vNormal;varying vec3 vLocal;
void main(){float facing=abs(dot(normalize(vNormal),normalize(cameraPosition-vWorld)));float rim=pow(1.-facing,3.5);float filaments=fbm(normalize(vLocal)*17.+uTime*.008);gl_FragColor=vec4(uColor*1.5,rim*(.09+filaments*.34)*uPresence);}`;
const haloFragment = /*glsl*/ `uniform vec3 uColor;uniform float uPresence;varying vec2 vUv;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float angle=atan(p.y,p.x);float rays=.75+.25*pow(abs(sin(angle*11.+sin(angle*7.))),8.);float halo=exp(-r*r*16.)*.19*rays;gl_FragColor=vec4(uColor*1.3,halo*uPresence);}`;

export default function BinaryDawn({ journey, mobile }) {
  const root = useRef(),
    primary = useRef(),
    secondary = useRef(),
    orbit = useRef();
  const sun = useMemo(
    () => ({
      uTime: { value: 0 },
      uPresence: { value: 1 },
      uColor: { value: new THREE.Color("#e5e4d9") },
    }),
    [],
  );
  const dwarf = useMemo(
    () => ({
      uTime: { value: 0 },
      uPresence: { value: 1 },
      uColor: { value: new THREE.Color("#ff8e49") },
    }),
    [],
  );
  const atmosphere = useMemo(
    () => ({
      uOpacity: { value: 1.4 },
      uSun: { value: new THREE.Vector3(166.4, 1.4, -187) },
    }),
    [],
  );
  const temperatureColor = useMemo(() => new THREE.Color(), []);
  const stellarPosition = useMemo(
    () => new THREE.Vector3(166.4, 1.4, -187),
    [],
  );
  useFrame(({ clock, camera }, dt) => {
    const j = journey.current;
    root.current.visible = stageVisible(j, 5);
    if (!root.current.visible) return;
    const time = j.reduced ? 0 : clock.elapsedTime;
    primary.current.material.uniforms.uTime.value = time;
    secondary.current.material.uniforms.uTime.value = time;
    sun.uPresence.value =
      1 -
      THREE.MathUtils.smoothstep(
        camera.position.distanceTo(stellarPosition),
        65,
        125,
      );
    dwarf.uPresence.value = sun.uPresence.value;
    const kelvin = j.site.params.temperature,
      t = kelvin < 5800 ? (kelvin - 3500) / 2300 : (kelvin - 5800) / 6200;
    if (kelvin < 5800)
      temperatureColor.setRGB(
        1.7,
        THREE.MathUtils.lerp(0.42, 1.35, t),
        THREE.MathUtils.lerp(0.12, 1.05, t),
      );
    else
      temperatureColor.setRGB(
        THREE.MathUtils.lerp(1.7, 0.69, t),
        THREE.MathUtils.lerp(1.35, 0.91, t),
        THREE.MathUtils.lerp(1.05, 1.6, t),
      );
    sun.uColor.value.lerp(
      temperatureColor,
      1 - Math.exp(-Math.min(dt, 0.05) * 4),
    );
    orbit.current.rotation.z = Math.sin(time * 0.035) * 0.05;
  });
  return (
    <group ref={root} position={[170, 0, -185]}>
      <group ref={orbit}>
        <mesh ref={primary} position={[-3.6, 1.4, -2]}>
          <sphereGeometry args={[2.35, 80, 64]} />
          <shaderMaterial
            vertexShader={surfaceVertex}
            fragmentShader={stellarFragment}
            uniforms={sun}
          />
        </mesh>
        <mesh position={[-3.6, 1.4, -2]} scale={1.055}>
          <sphereGeometry args={[2.35, 80, 64]} />
          <shaderMaterial
            vertexShader={surfaceVertex}
            fragmentShader={coronaFragment}
            uniforms={sun}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <Billboard position={[-3.6, 1.4, -2.1]}>
          <mesh>
            <planeGeometry args={[19, 19]} />
            <shaderMaterial
              vertexShader={
                "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
              }
              fragmentShader={haloFragment}
              uniforms={sun}
              transparent
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </Billboard>
        <mesh ref={secondary} position={[8, 3, -30]}>
          <sphereGeometry args={[0.45, 64, 48]} />
          <shaderMaterial
            vertexShader={surfaceVertex}
            fragmentShader={stellarFragment}
            uniforms={dwarf}
          />
        </mesh>
        <Flare
          position={[8, 3, -29.9]}
          size={4}
          color="#d3aa81"
          opacity={0.2}
        />
      </group>
      <mesh position={[0, -2.5, 5]}>
        <sphereGeometry args={[5.7, 128, 96]} />
        <meshBasicMaterial color="#000102" />
      </mesh>
      <mesh position={[0, -2.5, 5]} scale={1.009}>
        <sphereGeometry args={[5.7, 192, 128]} />
        <shaderMaterial
          vertexShader={surfaceVertex}
          fragmentShader={atmosphereFragment}
          uniforms={atmosphere}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

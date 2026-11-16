import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import { surfaceVertex } from "../shaders/noise";
import {
  earthFragment,
  cloudSurfaceFragment,
  atmosphereFragment,
  giantFragment,
  ringVertex,
  ringFragment,
} from "../shaders/planet";
import usePlanetMaps from "./usePlanetMaps";
import {
  cloudVertex,
  cloudFragment,
  flareFragment,
  galaxyFragment,
  galaxyDustFragment,
} from "../shaders/space";
import { lensVertex, lensFragment } from "../shaders/lensing";
import { ParticleField, seededRandom } from "./particles";
import { stageVisible, stageArrival } from "./cinematic";

export const WORLDS = {
  earth: [1.2, -1.5, 0],
  giant: [40, 2, -18],
  nebula: [80, 0, -60],
  hole: [120, 0, -100],
};

export function Flare({
  color = "#ffe6bd",
  opacity = 1,
  size = 12,
  renderOrder = 0,
  ...props
}) {
  const uniforms = useMemo(
    () => ({
      uOpacity: { value: opacity },
      uColor: { value: new THREE.Color(color) },
    }),
    [color, opacity],
  );
  return (
    <Billboard {...props}>
      <mesh renderOrder={renderOrder}>
        <planeGeometry args={[size, size]} />
        <shaderMaterial
          vertexShader={cloudVertex}
          fragmentShader={flareFragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </Billboard>
  );
}

export function Earth({ journey }) {
  const group = useRef(),
    surface = useRef(),
    clouds = useRef();
  const maps = usePlanetMaps();
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uSun: { value: new THREE.Vector3(-10, 4, -5) },
      uAlbedo: { value: maps.terrain },
      uCloud: { value: maps.clouds },
    }),
    [maps.terrain, maps.clouds],
  );
  useFrame(({ clock }, dt) => {
    group.current.visible = stageVisible(journey.current, 0);
    if (!group.current.visible) return;
    surface.current.material.uniforms.uTime.value = journey.current.reduced
      ? 0
      : clock.elapsedTime;
    clouds.current.material.uniforms.uTime.value =
      surface.current.material.uniforms.uTime.value;
    if (!journey.current.reduced)
      surface.current.rotation.y += Math.min(dt, 0.05) * 0.001;
  });
  return (
    <group ref={group}>
      <group position={WORLDS.earth} rotation={[0.08, -1.85, -0.17]}>
        <mesh ref={surface}>
          <sphereGeometry args={[3.28, 128, 96]} />
          <shaderMaterial
            uniforms={uniforms}
            vertexShader={surfaceVertex}
            fragmentShader={earthFragment}
          />
        </mesh>
        <mesh ref={clouds} scale={1.0023}>
          <sphereGeometry args={[3.28, 192, 128]} />
          <shaderMaterial
            uniforms={uniforms}
            vertexShader={surfaceVertex}
            fragmentShader={cloudSurfaceFragment}
            transparent
            depthWrite={false}
          />
        </mesh>
        <mesh scale={1.006}>
          <sphereGeometry args={[3.28, 192, 128]} />
          <shaderMaterial
            uniforms={uniforms}
            vertexShader={surfaceVertex}
            fragmentShader={atmosphereFragment}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
      <Flare position={[-10, 4, -5]} size={9} opacity={0.35} color="#e5e1d5" />
    </group>
  );
}

function RingDebris({ mobile }) {
  const instanced = useRef();
  const count = mobile ? 2600 : 6500;
  useLayoutEffect(() => {
    const rand = seededRandom(71),
      dummy = new THREE.Object3D(),
      color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      let r = 3.45 + rand() * 3.3;
      if (Math.abs(r - 4.75) < 0.1) r += 0.2;
      const angle = rand() * Math.PI * 2;
      dummy.position.set(
        Math.cos(angle) * r,
        Math.sin(angle) * r,
        (rand() - 0.5) * 0.025,
      );
      dummy.rotation.set(rand() * 6, rand() * 6, rand() * 6);
      dummy.scale.setScalar(0.003 + Math.pow(rand(), 4) * 0.017);
      dummy.updateMatrix();
      instanced.current.setMatrixAt(i, dummy.matrix);
      color.setHSL(0.105, 0.04 + rand() * 0.08, 0.3 + rand() * 0.3);
      instanced.current.setColorAt(i, color);
    }
    instanced.current.instanceMatrix.needsUpdate = true;
    instanced.current.instanceColor.needsUpdate = true;
  }, [count]);
  return (
    <instancedMesh
      ref={instanced}
      args={[null, null, count]}
      receiveShadow
      frustumCulled={false}
    >
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={1} metalness={0} />
    </instancedMesh>
  );
}

export function RingedGiant({ journey, mobile }) {
  const group = useRef(),
    surface = useRef();
  const target = useMemo(() => {
    const t = new THREE.Object3D();
    t.position.set(...WORLDS.giant);
    return t;
  }, []);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uSun: { value: new THREE.Vector3(28, 12, -9) },
    }),
    [],
  );
  useFrame(({ clock }) => {
    group.current.visible = stageVisible(journey.current, 1);
    if (group.current.visible)
      surface.current.material.uniforms.uTime.value = journey.current.reduced
        ? 0
        : clock.elapsedTime;
  });
  return (
    <group ref={group}>
      <primitive object={target} />
      <directionalLight
        target={target}
        position={[28, 12, -9]}
        intensity={3.5}
        color="#ffedd2"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={1}
        shadow-camera-far={35}
        shadow-bias={-0.0003}
      />
      <ambientLight intensity={0.12} />
      <group position={WORLDS.giant} rotation={[0.38, -0.15, -0.28]}>
        <mesh ref={surface} castShadow>
          <sphereGeometry args={[2.6, 112, 80]} />
          <shaderMaterial
            vertexShader={surfaceVertex}
            fragmentShader={giantFragment}
            uniforms={uniforms}
          />
        </mesh>
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <mesh receiveShadow>
            <ringGeometry args={[3.25, 6.9, 256, 1]} />
            <shaderMaterial
              uniforms={uniforms}
              vertexShader={ringVertex}
              fragmentShader={ringFragment}
              transparent
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
          <RingDebris mobile={mobile} />
        </group>
      </group>
      <Flare position={[31, 7, -25]} size={6} opacity={0.2} color="#d4cfc0" />
    </group>
  );
}

export function Nursery({ journey, mobile }) {
  const group = useRef();
  const materials = useRef([]);
  const layers = useMemo(() => {
    const rand = seededRandom(92);
    return Array.from({ length: mobile ? 10 : 17 }, (_, i) => ({
      position: [(rand() - 0.5) * 15, (rand() - 0.5) * 9, -18 + i * 2.2],
      size: 13 + rand() * 12,
      uniforms: {
        uTime: { value: 0 },
        uSeed: { value: i * 6.7 },
        uOpacity: { value: 0.48 },
        uColor: {
          value: new THREE.Color(
            ["#1c648c", "#76506f", "#a6804b", "#175867"][i % 4],
          ),
        },
      },
    }));
  }, [mobile]);
  useFrame(({ clock }) => {
    const j = journey.current;
    group.current.visible = stageVisible(j, 2);
    if (!group.current.visible) return;
    materials.current.forEach((m, i) => {
      if (!m) return;
      m.uniforms.uTime.value = j.reduced ? 0 : clock.elapsedTime;
      const stagger =
        j.busy && j.to === 2
          ? THREE.MathUtils.smoothstep(
              j.phase,
              0.48 + i * 0.008,
              0.78 + i * 0.009,
            )
          : 1;
      m.uniforms.uOpacity.value = 0.48 * stagger;
    });
  });
  return (
    <group ref={group} position={WORLDS.nebula}>
      {layers.map((layer, i) => (
        <Billboard key={i} position={layer.position}>
          <mesh rotation={[0, 0, i * 2.4]}>
            <planeGeometry args={[layer.size, layer.size]} />
            <shaderMaterial
              ref={(m) => {
                materials.current[i] = m;
              }}
              vertexShader={cloudVertex}
              fragmentShader={cloudFragment}
              uniforms={layer.uniforms}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </Billboard>
      ))}
      <ParticleField
        count={mobile ? 1500 : 4500}
        kind="nebula"
        journey={journey}
      />
      <Flare position={[-2.5, 1, -5]} size={13} color="#c2e3ff" />
      <Flare position={[4, -1.3, -12]} size={10} color="#ffcb8c" />
      <Flare position={[1.1, 3.2, 4]} size={7} color="#d2b4e7" opacity={0.7} />
    </group>
  );
}

export function Singularity({ journey }) {
  const group = useRef(),
    plane = useRef(),
    material = useRef();
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLens: { value: 1 },
      uPresence: { value: 1 },
      uCamera: { value: new THREE.Vector3() },
      uCenter: { value: new THREE.Vector3(...WORLDS.hole) },
    }),
    [],
  );
  useFrame(({ clock, camera }) => {
    const j = journey.current;
    group.current.visible = stageVisible(j, 3);
    if (!group.current.visible) return;
    material.current.uniforms.uTime.value = journey.current.reduced
      ? 0
      : clock.elapsedTime;
    material.current.uniforms.uCamera.value
      .copy(camera.position)
      .sub(uniforms.uCenter.value);
    material.current.uniforms.uLens.value = j.site.live.lens;
    material.current.uniforms.uPresence.value =
      1 -
      THREE.MathUtils.smoothstep(
        camera.position.distanceTo(uniforms.uCenter.value),
        38,
        65,
      );
    plane.current.quaternion.copy(camera.quaternion);
  });
  return (
    <group ref={group} position={WORLDS.hole}>
      <mesh ref={plane}>
        <planeGeometry args={[20, 20]} />
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={lensVertex}
          fragmentShader={lensFragment}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export function GalaxyGlow({ journey }) {
  const mat = useRef(),
    dust = useRef(),
    group = useRef();
  const uniforms = useMemo(
    () => ({ uOpacity: { value: 1 }, uTime: { value: 0 } }),
    [],
  );
  const center = useMemo(() => new THREE.Vector3(...WORLDS.hole), []);
  useFrame(({ clock, camera }) => {
    const j = journey.current;
    group.current.visible = stageVisible(j, 4);
    const distance = camera.position.distanceTo(center);
    mat.current.uniforms.uOpacity.value =
      0.0006 + 0.9994 * THREE.MathUtils.smoothstep(distance, 200, 1800);
    dust.current.uniforms.uOpacity.value = mat.current.uniforms.uOpacity.value;
    mat.current.uniforms.uTime.value = j.reduced ? 0 : clock.elapsedTime;
    group.current.rotation.z = j.reduced ? 0 : clock.elapsedTime * 0.0012;
  });
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <group ref={group}>
        <mesh>
          <planeGeometry args={[56, 56]} />
          <shaderMaterial
            ref={mat}
            uniforms={uniforms}
            vertexShader={cloudVertex}
            fragmentShader={galaxyFragment}
            transparent
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh position={[0, 0, 0.01]} renderOrder={3}>
          <planeGeometry args={[56, 56]} />
          <shaderMaterial
            ref={dust}
            uniforms={{ uOpacity: { value: 1 } }}
            vertexShader={cloudVertex}
            fragmentShader={galaxyDustFragment}
            transparent
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}

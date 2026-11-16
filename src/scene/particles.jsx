import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { pointVertex, pointFragment } from "../shaders/space";
import { stageVisible, stageArrival } from "./cinematic";

export function seededRandom(seed = 1) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ParticleField({
  count,
  kind = "stars",
  journey,
  opacity = 1,
  ...props
}) {
  const mat = useRef(),
    group = useRef();
  const { gl } = useThree();
  const isGalaxy = kind.startsWith("galaxy"),
    isDust = kind === "galaxy-dust";
  const data = useMemo(() => {
    const rand = seededRandom(isGalaxy ? (isDust ? 74 : 41) : 17);
    const positions = new Float32Array(count * 3),
      colors = new Float32Array(count * 3),
      sizes = new Float32Array(count);
    const cold = new THREE.Color("#8dbbff"),
      warm = new THREE.Color("#ffcd8f");
    const white = new THREE.Color("#fff1d8"),
      red = new THREE.Color("#dd8770");
    const outer = ["#8e9fb9", "#a0adc0", "#b0a7b5", "#93a7b2"].map(
      (c) => new THREE.Color(c),
    );
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      let x, y, z;
      if (isGalaxy) {
        const bulge = i < count * (isDust ? 0.05 : 0.24);
        const r = Math.pow(rand(), bulge ? 2.3 : 0.65) * (bulge ? 3.7 : 26);
        const armIndex = i % 2,
          arm = armIndex * Math.PI;
        const diffuse = !bulge && i % 4 === 0;
        let spin = diffuse
          ? rand() * Math.PI * 2
          : Math.log(1 + r) * 1.65 + arm;
        spin += Math.sin(r * 0.73 + arm) * 0.13;
        if (!diffuse && i % 7 === 0) spin += (0.6 * r) / 26;
        const scatter = Math.pow(rand(), 1.4) * (rand() > 0.5 ? 1 : -1);
        x = Math.cos(spin) * r + scatter * (r * 0.29 + 0.25);
        z = Math.sin(spin) * r + (rand() - 0.5) * r * 0.23;
        y =
          (rand() - 0.5) *
          (bulge
            ? Math.max(0.25, 2.4 - r * 0.4)
            : (isDust ? 1.1 : 0.24) + 0.7 * Math.exp(-r * 0.2));
        color
          .copy(r < 1.5 ? white : warm)
          .lerp(outer[i % 4], THREE.MathUtils.smoothstep(r, 1, 18));
        const brightness = isDust
          ? 0.2 + rand() * 0.2
          : 0.019 + Math.pow(rand(), 7) * 0.22;
        color.multiplyScalar(brightness * (diffuse ? 0.5 : 1));
        sizes[i] = isDust
          ? 2.4 + rand() * 3.4
          : 0.045 + Math.pow(rand(), 6) * 0.25;
      } else if (kind === "nebula") {
        const a = rand() * Math.PI * 2,
          r = 2 + rand() * 13;
        x = Math.cos(a) * r;
        y = Math.sin(a) * r * 0.65;
        z = (rand() - 0.5) * 32;
        color.copy(i % 3 ? cold : warm).multiplyScalar(0.4 + rand() * 1.7);
        sizes[i] = 0.07 + Math.pow(rand(), 5) * 0.6;
      } else {
        const theta = rand() * Math.PI * 2,
          phi = Math.acos(2 * rand() - 1),
          r = 10000 + rand() * 10000;
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.cos(phi);
        z = r * Math.sin(phi) * Math.sin(theta);
        const t = rand();
        color
          .copy(t < 0.18 ? warm : t < 0.24 ? red : t < 0.62 ? cold : white)
          .multiplyScalar(0.4 + rand() * 0.8);
        sizes[i] = 0.5 + Math.pow(rand(), 12) * 1.6;
      }
      positions.set([x, y, z], i * 3);
      colors.set([color.r, color.g, color.b], i * 3);
    }
    return { positions, colors, sizes };
  }, [count, kind, isGalaxy, isDust]);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uStretch: { value: 0 },
      uOpacity: { value: opacity },
      uReveal: { value: 1 },
      uSoft: { value: isDust ? 1 : 0 },
      uBackground: { value: kind === "stars" ? 1 : 0 },
    }),
    [opacity, isDust, kind],
  );
  useFrame(({ clock, camera }) => {
    const j = journey.current;
    group.current.visible = !isGalaxy || stageVisible(j, 4);
    if (!group.current.visible) return;
    const u = mat.current.uniforms;
    u.uTime.value = j.reduced ? 0 : clock.elapsedTime;
    u.uPixelRatio.value = gl.getPixelRatio();
    u.uStretch.value =
      kind === "stars" && !j.reduced
        ? Math.min(0.6, j.speed * 6 + j.warp * 0.3)
        : 0;
    const distance = Math.hypot(
      camera.position.x - 120,
      camera.position.y,
      camera.position.z + 100,
    );
    u.uOpacity.value =
      opacity *
      (isGalaxy
        ? 0.0006 + 0.9994 * THREE.MathUtils.smoothstep(distance, 200, 1800)
        : 1);
    u.uReveal.value = 1;
    if (isGalaxy)
      group.current.rotation.y = j.reduced ? 0 : clock.elapsedTime * 0.0012;
  });
  return (
    <group ref={group} {...props}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[data.positions, 3]}
          />
          <bufferAttribute attach="attributes-aColor" args={[data.colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[data.sizes, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={mat}
          uniforms={uniforms}
          vertexShader={pointVertex}
          fragmentShader={pointFragment}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

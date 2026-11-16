import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  FXAA,
  Noise,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { surfaceVertex } from "../shaders/noise";
import { skyFragment } from "../shaders/space";
import { ParticleField } from "./particles";
import { Earth, RingedGiant, Singularity, GalaxyGlow, WORLDS } from "./Bodies";
import NebulaVolume from "./NebulaVolume";
import { SHOTS } from "./cinematic";
import { createSiteRoutes, sampleRoute, sampleSite } from "./routes";
import { WORLD, COLLIDERS, GIANT_ROTATION } from "./world";
import BinaryDawn from "./BinaryDawn";
import CosmicWeb from "./CosmicWeb";
import ObservatoryOptics from "./ObservatoryOptics";

const UP = new THREE.Vector3(0, 1, 0);
const RING_RIGHT = new THREE.Vector3(1, 0, 0).applyQuaternion(GIANT_ROTATION);

function CameraRig({ journey, onReady }) {
  const ready = useRef(0),
    warmed = useRef(false),
    previous = useRef(0),
    collisions = useRef(0),
    statistics = useRef({ time: 0, frames: 0 });
  const routes = useMemo(createSiteRoutes, []);
  const vectors = useMemo(
    () => ({
      position: new THREE.Vector3(),
      target: new THREE.Vector3(),
      offset: new THREE.Vector3(),
      aux: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      spherical: new THREE.Spherical(),
    }),
    [],
  );
  const { gl, camera, scene } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event) => {
      event.preventDefault();
      journey.current.contextLost?.();
    };
    canvas.addEventListener("webglcontextlost", lost);
    let mounted = true;
    gl.compileAsync(scene, camera)
      .then(() => {
        if (mounted) warmed.current = true;
      })
      .catch(() => {
        warmed.current = true;
      });
    if (import.meta.env.DEV) {
      const context = gl.getContext(),
        info = context.getExtension("WEBGL_debug_renderer_info");
      canvas.dataset.renderer = info
        ? context.getParameter(info.UNMASKED_RENDERER_WEBGL)
        : context.getParameter(context.RENDERER);
      canvas.dataset.worldPersistent = "true";
    }
    return () => {
      mounted = false;
      canvas.removeEventListener("webglcontextlost", lost);
    };
  }, [gl, camera, scene, journey]);
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.04),
      j = journey.current,
      { position, target, offset, aux, q, spherical } = vectors;
    let fov, roll;
    if (j.experience === "site") {
      const site = j.site,
        p = site.progress;
      const shot = sampleSite(routes, p, position, target);
      fov = shot.fov;
      roll = shot.roll;
      site.effect = shot.index + 1;
      site.effectPhase = shot.t;
      site.chapter = shot.chapter;
      for (const key of [
        "ringTilt",
        "probe",
        "lens",
        "orbitYaw",
        "orbitPitch",
        "depth",
        "zoom",
      ])
        site.live[key] = THREE.MathUtils.damp(
          site.live[key],
          site.params[key],
          j.reduced ? 30 : 4,
          dt,
        );
      const ringWeight =
        1 - THREE.MathUtils.smoothstep(Math.abs(p - 2), 0.1, 0.42);
      if (ringWeight > 0) {
        q.setFromAxisAngle(RING_RIGHT, site.live.ringTilt * ringWeight);
        position.sub(WORLD.giant).applyQuaternion(q).add(WORLD.giant);
        target.sub(WORLD.giant).applyQuaternion(q).add(WORLD.giant);
      }
      const galaxyWeight = THREE.MathUtils.smoothstep(p, 4.5, 4.94);
      if (galaxyWeight > 0) {
        site.focus.lerp(site.selectedPosition, 1 - Math.exp(-dt * 2.5));
        offset.copy(position).sub(WORLD.hole);
        spherical.setFromVector3(offset);
        spherical.theta += site.live.orbitYaw * galaxyWeight;
        spherical.phi = THREE.MathUtils.clamp(
          spherical.phi + site.live.orbitPitch * galaxyWeight,
          0.22,
          1.45,
        );
        spherical.radius *= THREE.MathUtils.lerp(
          1,
          site.live.zoom * (1 + site.live.depth * 2.1),
          galaxyWeight,
        );
        position.setFromSpherical(spherical).add(WORLD.hole);
        q.setFromAxisAngle(UP, site.live.orbitYaw * galaxyWeight);
        target.sub(WORLD.hole).applyQuaternion(q).add(WORLD.hole);
        aux.copy(site.focus).sub(WORLD.hole).multiplyScalar(galaxyWeight);
        position.add(aux);
        target.add(aux);
      }
      j.speed = THREE.MathUtils.damp(
        j.speed,
        Math.min(
          0.1,
          (Math.abs(p - previous.current) / Math.max(0.001, dt)) * 0.025,
        ),
        4,
        dt,
      );
      previous.current = p;
      j.progress = p / 5;
    } else if (j.busy && j.flight) {
      const t = sampleRoute(j.flight, j.phase, position, target),
        a = SHOTS[j.from],
        b = SHOTS[j.to];
      fov = THREE.MathUtils.lerp(a.fov, b.fov, t);
      roll = THREE.MathUtils.lerp(a.roll, b.roll, t);
      j.warp = j.mode === "warp" ? Math.sin(j.phase * Math.PI) ** 2 : 0;
      j.speed = Math.sin(j.phase * Math.PI) ** 2 * 0.018;
      j.progress = THREE.MathUtils.lerp(j.from / 5, j.to / 5, t);
      j.site.effect = 0;
    } else {
      const shot = SHOTS[j.stage];
      position.set(...shot.position);
      target.set(...shot.target);
      j.sceneTime += dt;
      if (!j.reduced) {
        offset
          .copy(position)
          .sub(target)
          .applyAxisAngle(UP, Math.sin(j.sceneTime * 0.018) * 0.006);
        position.copy(target).add(offset);
      }
      fov = shot.fov;
      roll = shot.roll;
      j.speed = THREE.MathUtils.damp(j.speed, 0, 3, dt);
      j.site.effect = 0;
    }
    // Safety guard is a last resort; sampled routes are independently checked
    // against the larger body margins before shipping.
    for (const body of COLLIDERS) {
      const distance = position.distanceTo(body.center),
        minimum = body.radius + 0.18;
      if (distance < minimum) {
        offset.copy(position).sub(body.center).normalize();
        position.copy(body.center).addScaledVector(offset, minimum);
        collisions.current++;
      }
    }
    j.posePosition.copy(position);
    j.poseTarget.copy(target);
    if (camera.aspect < 0.8) {
      fov = Math.min(
        82,
        THREE.MathUtils.radToDeg(
          2 *
            Math.atan(
              (Math.tan(THREE.MathUtils.degToRad(fov) * 0.5) * 0.8) /
                camera.aspect,
            ),
        ),
      );
      const framing =
        j.experience === "site"
          ? 1
          : j.experience === "handoff"
            ? THREE.MathUtils.smootherstep(j.phase, 0.65, 1)
            : 0;
      const galaxyFraming =
        j.experience === "site"
          ? THREE.MathUtils.smoothstep(j.site.progress, 4.5, 4.95)
          : 0;
      if (galaxyFraming) target.lerp(j.site.focus, galaxyFraming * 0.9);
      target.y -=
        position.distanceTo(target) * (0.2 + galaxyFraming * 0.2) * framing;
    }
    if (!j.reduced) {
      position.x += Math.sin(clock.elapsedTime * 0.27) * 0.0015;
      position.y += Math.sin(clock.elapsedTime * 0.33) * 0.0015;
    }
    camera.position.copy(position);
    camera.lookAt(target);
    camera.rotateZ(roll);
    j.focus.copy(target);
    if (Math.abs(camera.fov - fov) > 0.001) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    if (ready.current < 6 && warmed.current) {
      ready.current++;
      if (ready.current === 5) onReady();
    }
    if (import.meta.env.DEV && rawDt < 0.2) {
      statistics.current.time += rawDt;
      statistics.current.frames++;
      if (statistics.current.time > 1.2) {
        Object.assign(gl.domElement.dataset, {
          fps: String(
            Math.round(statistics.current.frames / statistics.current.time),
          ),
          dpr: String(gl.getPixelRatio()),
          scene: String(j.stage),
          chapter: String(j.site.chapter),
          progress: j.site.progress.toFixed(3),
          position: camera.position
            .toArray()
            .map((v) => v.toFixed(2))
            .join(","),
          experience: j.experience,
          mode: j.mode,
          collisions: String(collisions.current),
        });
        statistics.current = { time: 0, frames: 0 };
      }
    }
  }, -2);
  return null;
}

function Effects({ journey }) {
  const chroma = useRef(),
    offset = useMemo(() => new THREE.Vector2(0.000015, 0.000008), []);
  useFrame(() => {
    const value = journey.current.reduced
      ? 0
      : 0.000015 + journey.current.speed * 0.002;
    chroma.current?.offset.set(value, value * 0.4);
  });
  return (
    <EffectComposer multisampling={0} mergeMode="none">
      <Bloom
        intensity={0.27}
        luminanceThreshold={1.1}
        luminanceSmoothing={0.32}
        mipmapBlur
      />
      <ObservatoryOptics journey={journey} />
      <ChromaticAberration
        ref={chroma}
        offset={offset}
        radialModulation
        modulationOffset={0.6}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <FXAA />
      <Vignette eskil={false} offset={0.22} darkness={0.28} />
      <Noise opacity={0.0035} />
    </EffectComposer>
  );
}
function Galaxy({ journey, mobile }) {
  return (
    <group position={WORLDS.hole} rotation={[0.12, 0.3, 0.08]} scale={38}>
      <GalaxyGlow journey={journey} />
      <ParticleField
        count={mobile ? 65000 : 100000}
        kind="galaxy"
        journey={journey}
      />
      <ParticleField
        count={mobile ? 5000 : 10000}
        kind="galaxy-dust"
        journey={journey}
        opacity={0.045}
      />
    </group>
  );
}
export default function Universe({ journey, onReady, paused }) {
  const mobile = useMemo(
    () => window.matchMedia("(max-width:760px)").matches,
    [],
  );
  const [quality, setQuality] = useState(
    Math.min(window.devicePixelRatio, 1.5),
  );
  return (
    <Canvas
      className="universe"
      aria-label="连续宇宙空间"
      tabIndex={-1}
      frameloop={paused ? "never" : "always"}
      shadows
      dpr={quality}
      camera={{ position: SHOTS[0].position, fov: 42, near: 0.03, far: 50000 }}
      gl={{
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
        toneMapping: THREE.NoToneMapping,
        toneMappingExposure: 1,
      }}
    >
      <color attach="background" args={["#020205"]} />
      <PerformanceMonitor
        bounds={() => [48, 75]}
        flipflops={3}
        onDecline={() => setQuality((q) => Math.max(1, q - 0.15))}
        onIncline={() =>
          setQuality((q) =>
            Math.min(Math.max(1, window.devicePixelRatio), 1.5, q + 0.1),
          )
        }
        onFallback={() => setQuality(1)}
      />
      <CameraRig journey={journey} onReady={onReady} />
      <mesh>
        <sphereGeometry args={[25000, 32, 24]} />
        <shaderMaterial
          vertexShader={surfaceVertex}
          fragmentShader={skyFragment}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
      <ParticleField count={mobile ? 1800 : 3500} journey={journey} />
      <Earth journey={journey} />
      <RingedGiant journey={journey} mobile={mobile} />
      <NebulaVolume journey={journey} mobile={mobile} />
      <Singularity journey={journey} />
      <Galaxy journey={journey} mobile={mobile} />
      <BinaryDawn journey={journey} mobile={mobile} />
      <CosmicWeb journey={journey} mobile={mobile} />
      <Effects journey={journey} />
    </Canvas>
  );
}

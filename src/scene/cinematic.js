import * as THREE from "three";
import { INTRO_POSES, buildRoute } from "./routes.js";
export const CHAPTER_NAMES = [
  "Orbital dawn",
  "The ringed giant",
  "Stellar nursery",
  "Beyond the horizon",
  "Spiral galaxy nebula",
  "Observatory",
];
export const SHOTS = INTRO_POSES;
export const TRANSITION_DURATION = 3.5;
export const TRANSITIONS = [
  { mode: "limb", duration: 3.5 },
  { mode: "rings", duration: 3.5 },
  { mode: "dust", duration: 3.5 },
  { mode: "scale", duration: 3.5 },
  { mode: "warp", duration: 3.5 },
];
export const SITE_IDS = [
  "observatory",
  "light",
  "rings",
  "nursery",
  "horizon",
  "web",
];
export function createJourney(reduced = false) {
  const chapter = SITE_IDS.indexOf(window.location.hash.slice(1));
  const isSite = chapter >= 0,
    stage = isSite ? 5 : 0;
  return {
    stage,
    from: stage,
    to: stage,
    phase: 0,
    busy: false,
    mode: "idle",
    experience: isSite ? "site" : "intro",
    reduced,
    ready: false,
    progress: 0,
    speed: 0,
    warp: 0,
    sceneTime: 0,
    pointer: { x: 0, y: 0 },
    focus: new THREE.Vector3(),
    posePosition: new THREE.Vector3(...SHOTS[stage].position),
    poseTarget: new THREE.Vector3(...SHOTS[stage].target),
    site: {
      progress: isSite ? chapter : 0,
      chapter: Math.max(0, chapter),
      effect: 0,
      effectPhase: 0,
      selection: 0,
      request: null,
      params: {
        temperature: 5800,
        ringTilt: 0,
        probe: 1,
        lens: 1,
        orbitYaw: 0,
        orbitPitch: 0,
        depth: 0,
        zoom: 1,
      },
      live: {
        ringTilt: 0,
        probe: 0,
        lens: 1,
        orbitYaw: 0,
        orbitPitch: 0,
        depth: 0,
        zoom: 1,
      },
      focus: new THREE.Vector3(120, 0, -100),
      selectedPosition: new THREE.Vector3(120, 0, -100),
    },
  };
}
// Astronomical bodies are never created or removed at a chapter boundary.
// Three.js frustum/depth culling, angular scale and intervening matter reveal them.
export function stageVisible() {
  return true;
}
export function stageArrival() {
  return 1;
}
export function makeFlight(from, to, mode, currentPosition, currentTarget) {
  const start = {
    ...SHOTS[from],
    position: currentPosition?.toArray() ?? SHOTS[from].position,
    target: currentTarget?.toArray() ?? SHOTS[from].target,
  };
  return buildRoute(start, SHOTS[to], mode);
}

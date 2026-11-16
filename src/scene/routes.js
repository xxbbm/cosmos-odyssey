import * as THREE from "three";
import { WORLD, GIANT_ROTATION, ringPoint } from "./world.js";

const V = (value) =>
  value instanceof THREE.Vector3 ? value.clone() : new THREE.Vector3(...value);
export const ease = (t) => {
  t = THREE.MathUtils.clamp(t, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const gaze = (value) => V(value);

export const INTRO_POSES = [
  {
    position: [-1.6, 1.5, 5.9],
    target: [0.1, 0.1, -0.3],
    fov: 42,
    roll: -0.025,
  },
  {
    position: [45.2, 4.6, -6.8],
    target: [39.1, 2.1, -18],
    fov: 43,
    roll: -0.12,
  },
  { position: [78, 1.3, -36], target: [81, 0.7, -64], fov: 48, roll: 0.02 },
  { position: [121, 2.4, -77], target: [120, 0, -100], fov: 40, roll: -0.015 },
  { position: [620, 2200, 1800], target: [120, 0, -100], fov: 41, roll: -0.1 },
  {
    position: [171, 3.5, -159],
    target: [162.8, 2.5, -185],
    fov: 31,
    roll: -0.035,
  },
];
export const SITE_POSES = [
  INTRO_POSES[5],
  { position: [163, 2, -180], target: [164.9, 1.5, -187], fov: 40, roll: 0 },
  { position: [33.5, 5.8, -7.5], target: [41.2, 2, -18], fov: 43, roll: 0.1 },
  { position: [88, 1.8, -41], target: [82, 0, -66], fov: 48, roll: -0.025 },
  { position: [116, 3, -78], target: [115.5, 0, -100], fov: 42, roll: 0 },
  { position: [620, 2200, 1800], target: [690, 0, -250], fov: 45, roll: -0.08 },
];

function curveRoute(start, end, positions, targets, kind) {
  const points = [V(start.position), ...positions.map(V), V(end.position)];
  const looks = [V(start.target), ...targets.map(V), V(end.target)];
  if (points.length !== looks.length)
    throw new Error(`Unpaired camera keys: ${kind}`);
  const positionCurve = new THREE.CatmullRomCurve3(
    points,
    false,
    "centripetal",
  );
  const targetCurve = new THREE.CatmullRomCurve3(looks, false, "centripetal");
  positionCurve.arcLengthDivisions = 1200;
  positionCurve.updateArcLengths();
  return {
    kind,
    start,
    end,
    points,
    looks,
    positionCurve,
    targetCurve,
    sample(phase, position, target) {
      let time = ease(phase);
      if (kind === "warp") time = 1 - Math.pow(1 - time, 3.6);
      // One parameter drives BOTH the eye and the gaze. Independent arc-length
      // mappings were the reason the old view turned before the eye arrived.
      const u = positionCurve.getUtoTmapping(time);
      positionCurve.getPoint(u, position);
      targetCurve.getPoint(u, target);
      return time;
    },
  };
}

function ringPass(start, end) {
  const inverse = GIANT_ROTATION.clone().invert();
  const local = V(start.position).sub(WORLD.giant).applyQuaternion(inverse);
  const destination = V(end.position).sub(WORLD.giant).applyQuaternion(inverse);
  const angle0 = Math.atan2(local.z, local.x),
    angle1 = Math.atan2(destination.z, destination.x);
  let turn = angle1 - angle0;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  const gate = ringPoint(angle1, 4.75);
  const beyond = gate
    .clone()
    .add(V(end.target).sub(gate).normalize().multiplyScalar(15));
  const points = [],
    targets = [];
  for (let k = 1; k <= 3; k++) {
    const f = k / 4;
    points.push(
      ringPoint(
        angle0 + turn * f,
        THREE.MathUtils.lerp(
          Math.max(10, Math.hypot(local.x, local.z)),
          6.4,
          f,
        ),
        THREE.MathUtils.lerp(Math.max(3, local.y), 1.6, f),
      ),
    );
    targets.push(
      k === 1 ? gaze(WORLD.giant) : k === 2 ? gate.clone() : beyond.clone(),
    );
  }
  points.push(
    ringPoint(angle1, 4.75, 1.25),
    gate,
    ringPoint(angle1, 4.75, -1.25),
    ringPoint(angle1, 8.7, -1.5),
    new THREE.Vector3(62, 1, -34),
  );
  targets.push(
    beyond.clone(),
    beyond.clone(),
    beyond.clone(),
    new THREE.Vector3(77, 2, -67),
    V(end.target),
  );
  return curveRoute(start, end, points, targets, "rings");
}

export function buildRoute(start, end, kind) {
  if (kind === "rings") return ringPass(start, end);
  if (kind === "scale") {
    const center = WORLD.hole.clone(),
      a = V(start.position).sub(center),
      b = V(end.position).sub(center);
    const r0 = a.length(),
      r1 = b.length();
    a.normalize();
    b.normalize();
    const look0 = V(start.target),
      look1 = V(end.target),
      scratch = new THREE.Vector3();
    return {
      kind,
      start,
      end,
      points: [V(start.position), V(end.position)],
      sample(phase, position, target) {
        const t = ease(phase);
        position
          .copy(a)
          .lerp(b, t)
          .normalize()
          .multiplyScalar(
            Math.exp(THREE.MathUtils.lerp(Math.log(r0), Math.log(r1), t)),
          )
          .add(center);
        target.copy(look0).lerp(look1, t);
        return t;
      },
    };
  }
  if (kind === "limb")
    return curveRoute(
      start,
      end,
      [
        [-0.8, 3.1, 5.2],
        [4, 4.2, 3.5],
        [14, 6, 0],
        [29, 6, -3],
        [41, 5.5, -3],
      ],
      [
        [1.2, -0.5, 0],
        [9, 2, -1],
        [21, 2, -8],
        [36, 2, -18],
        [40, 2, -18],
      ],
      kind,
    );
  if (kind === "dust")
    return curveRoute(
      start,
      end,
      [
        [80, 1.8, -49],
        [82.5, 1, -61],
        [83, 1, -69],
        [95, 2, -77],
        [110, 3, -81],
      ],
      [
        [82, 1, -65],
        [85, 0.3, -76],
        [108, 1, -97],
        [120, 0, -100],
        [120, 0, -100],
      ],
      kind,
    );
  if (kind === "warp") {
    const direction = V(start.position).sub(WORLD.hole).normalize();
    return curveRoute(
      start,
      end,
      [
        WORLD.hole.clone().addScaledVector(direction, 900),
        WORLD.hole.clone().addScaledVector(direction, 180),
        [126, 6, -89],
        [123.4, 2.2, -99],
        [140, 6, -138],
        [157, 6, -154],
      ],
      [
        WORLD.hole,
        WORLD.hole,
        [125, 1, -105],
        [143, 3, -142],
        [166, 2, -183],
        [169, 2.5, -185],
      ],
      kind,
    );
  }
  if (kind === "stellar-close")
    return curveRoute(
      start,
      end,
      [
        [169, 5, -165],
        [165, 4, -172],
        [162.8, 2.8, -177],
      ],
      [
        [166.4, 1.4, -187],
        [166.4, 1.4, -187],
        [165, 1.5, -187],
      ],
      kind,
    );
  if (kind === "solar-return")
    return curveRoute(
      start,
      end,
      [
        [159, 10, -172],
        [136, 14, -145],
        [92, 15, -92],
        [54, 11, -42],
        [31, 8, -21],
      ],
      [
        [166.4, 1.4, -187],
        [110, 7, -100],
        [69, 4, -55],
        [40, 2, -18],
        [40, 2, -18],
      ],
      kind,
    );
  throw new Error(`Unknown camera route: ${kind}`);
}

export function sampleRoute(route, phase, position, target) {
  return route.sample(THREE.MathUtils.clamp(phase, 0, 1), position, target);
}
export const SITE_KINDS = [
  "stellar-close",
  "solar-return",
  "rings",
  "dust",
  "scale",
];
export function createSiteRoutes() {
  return SITE_KINDS.map((kind, i) =>
    buildRoute(SITE_POSES[i], SITE_POSES[i + 1], kind),
  );
}
export function sampleSite(routes, progress, position, target) {
  const p = THREE.MathUtils.clamp(progress, 0, 5),
    index = Math.min(4, Math.floor(p)),
    fraction = p - index;
  const t = THREE.MathUtils.clamp((fraction - 0.24) / 0.66, 0, 1);
  const blend = sampleRoute(routes[index], t, position, target);
  return {
    index,
    t,
    blend,
    kind: SITE_KINDS[index],
    chapter: Math.round(p),
    fov: THREE.MathUtils.lerp(
      SITE_POSES[index].fov,
      SITE_POSES[index + 1].fov,
      blend,
    ),
    roll: THREE.MathUtils.lerp(
      SITE_POSES[index].roll,
      SITE_POSES[index + 1].roll,
      blend,
    ),
  };
}

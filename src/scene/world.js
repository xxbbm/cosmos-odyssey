import * as THREE from "three";

export const WORLD = {
  earth: new THREE.Vector3(1.2, -1.5, 0),
  giant: new THREE.Vector3(40, 2, -18),
  nursery: new THREE.Vector3(80, 0, -60),
  hole: new THREE.Vector3(120, 0, -100),
  sun: new THREE.Vector3(166.4, 1.4, -187),
  planet: new THREE.Vector3(170, -2.5, -180),
};
export const GIANT_ROTATION = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(0.38, -0.15, -0.28),
);
export const RING_NORMAL = new THREE.Vector3(0, 1, 0).applyQuaternion(
  GIANT_ROTATION,
);
export const COLLIDERS = [
  { name: "Earth", center: WORLD.earth, radius: 3.28, margin: 0.35 },
  { name: "Saturn", center: WORLD.giant, radius: 2.6, margin: 0.4 },
  { name: "Photosphere", center: WORLD.sun, radius: 2.35, margin: 0.4 },
  { name: "Eclipse planet", center: WORLD.planet, radius: 5.7, margin: 0.45 },
  { name: "Event horizon", center: WORLD.hole, radius: 0.85, margin: 0.3 },
];
export function ringPoint(angle, radius, height = 0) {
  return new THREE.Vector3(
    Math.cos(angle) * radius,
    height,
    Math.sin(angle) * radius,
  )
    .applyQuaternion(GIANT_ROTATION)
    .add(WORLD.giant);
}
export function ringCoordinates(point) {
  const local = point
    .clone()
    .sub(WORLD.giant)
    .applyQuaternion(GIANT_ROTATION.clone().invert());
  return { radius: Math.hypot(local.x, local.z), height: local.y };
}

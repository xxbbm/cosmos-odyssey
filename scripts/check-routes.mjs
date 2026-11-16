import assert from "node:assert/strict";
import { Vector3 } from "three";
import {
  INTRO_POSES,
  SITE_POSES,
  SITE_KINDS,
  buildRoute,
  sampleRoute,
  createSiteRoutes,
  sampleSite,
} from "../src/scene/routes.js";
import { COLLIDERS, ringCoordinates } from "../src/scene/world.js";

const eye = new Vector3(),
  target = new Vector3();
const cases = [
  ...["limb", "rings", "dust", "scale", "warp"].map((kind, i) => ({
    name: `intro-${i}`,
    route: buildRoute(INTRO_POSES[i], INTRO_POSES[i + 1], kind),
  })),
  ...SITE_KINDS.map((kind, i) => ({
    name: `site-${i}`,
    route: buildRoute(SITE_POSES[i], SITE_POSES[i + 1], kind),
  })),
];

for (const { name, route } of cases) {
  let clearance = Infinity,
    nearest = "",
    invalidRingSamples = 0;
  for (let i = 0; i <= 5000; i++) {
    sampleRoute(route, i / 5000, eye, target);
    assert.ok(
      [...eye.toArray(), ...target.toArray()].every(Number.isFinite),
      `${name}: finite coordinates`,
    );
    assert.ok(eye.distanceTo(target) > 0.1, `${name}: non-collapsed gaze`);
    for (const body of COLLIDERS) {
      const gap = eye.distanceTo(body.center) - body.radius - body.margin;
      if (gap < clearance) {
        clearance = gap;
        nearest = body.name;
      }
    }
    if (route.kind === "rings") {
      const ring = ringCoordinates(eye);
      if (
        Math.abs(ring.height) < 0.055 &&
        ring.radius > 3.25 &&
        ring.radius < 6.9 &&
        Math.abs(ring.radius - 4.75) > 0.12
      )
        invalidRingSamples++;
    }
  }
  assert.ok(clearance >= 0, `${name}: penetrated ${nearest}`);
  assert.equal(invalidRingSamples, 0, `${name}: crossed a solid ring`);
  for (const [phase, pose] of [
    [0, route.start],
    [1, route.end],
  ]) {
    sampleRoute(route, phase, eye, target);
    assert.ok(
      eye.distanceTo(new Vector3(...pose.position)) < 1e-7,
      `${name}: eye endpoint`,
    );
    assert.ok(
      target.distanceTo(new Vector3(...pose.target)) < 1e-7,
      `${name}: gaze endpoint`,
    );
  }
  console.log(
    `${name}: ${route.kind}; minimum clearance ${clearance.toFixed(3)} (${nearest})`,
  );
}
const siteRoutes = createSiteRoutes();
SITE_POSES.forEach((pose, i) => {
  sampleSite(siteRoutes, i, eye, target);
  assert.ok(
    eye.distanceTo(new Vector3(...pose.position)) < 1e-7,
    `Site ${i}: chapter hold`,
  );
});
console.log(
  "PASS: 50,010 route samples, collision margins, Cassini gap, synchronized gaze and chapter holds.",
);

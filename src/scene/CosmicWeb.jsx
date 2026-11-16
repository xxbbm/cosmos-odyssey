import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { seededRandom } from "./particles";
import { WORLD } from "./world";

const vertex = /*glsl*/ `
attribute float aSize;attribute float aIndex;
uniform float uDpr;uniform float uSelected;
varying float vSelected;
void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vSelected=1.-step(.1,abs(aIndex-uSelected));gl_PointSize=clamp(aSize*uDpr*200./max(1.,-mv.z),1.,18.)*(1.+vSelected*.5);gl_Position=projectionMatrix*mv;}`;
const fragment = /*glsl*/ `
uniform float uOpacity;varying float vSelected;
void main(){vec2 p=gl_PointCoord-.5;float r=dot(p,p);float halo=exp(-r*22.),core=exp(-r*160.);vec3 color=mix(vec3(.4,.55,.75),vec3(1.4,.98,.53),vSelected);gl_FragColor=vec4(color*(halo+core),halo*uOpacity);}`;
const filamentVertex = /*glsl*/ `attribute float aSize;attribute vec3 aColor;uniform float uDpr;varying vec3 vColor;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vColor=aColor;gl_PointSize=clamp(aSize*uDpr*200./max(1.,-mv.z),1.,18.);gl_Position=projectionMatrix*mv;}`;
const filamentFragment = /*glsl*/ `uniform float uOpacity;varying vec3 vColor;void main(){float r=length(gl_PointCoord-.5);float mist=exp(-r*r*20.);gl_FragColor=vec4(vColor,mist*uOpacity);}`;

export default function CosmicWeb({ journey, mobile }) {
  const lines = useRef(),
    lineGeometry = useRef(),
    nodesMaterial = useRef(),
    dustMaterial = useRef();
  const previous = useRef(-1),
    projected = useMemo(() => new THREE.Vector3(), []);
  const data = useMemo(() => {
    const rand = seededRandom(711),
      nodes = [WORLD.hole.clone()];
    for (let i = 1; i < 29; i++) {
      const a = rand() * Math.PI * 2,
        r = 1800 + rand() * 5100;
      nodes.push(
        new THREE.Vector3(
          Math.cos(a) * r,
          (rand() - 0.5) * 4100,
          Math.sin(a) * r,
        ).add(WORLD.hole),
      );
    }
    const edges = [];
    nodes.forEach((node, i) =>
      nodes
        .map((other, k) => ({ k, d: node.distanceToSquared(other) }))
        .filter((x) => x.k !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
        .forEach((x) => {
          if (x.k > i) edges.push([i, x.k]);
        }),
    );
    const linePositions = new Float32Array(edges.length * 6),
      lineColors = new Float32Array(edges.length * 6);
    edges.forEach(([a, b], i) => {
      linePositions.set(nodes[a].toArray(), i * 6);
      linePositions.set(nodes[b].toArray(), i * 6 + 3);
    });
    const positions = new Float32Array(nodes.length * 3),
      sizes = new Float32Array(nodes.length),
      ids = new Float32Array(nodes.length);
    nodes.forEach((node, i) => {
      positions.set(node.toArray(), i * 3);
      sizes[i] = 260 + rand() * 240;
      ids[i] = i;
    });
    const bends = edges.map(
      () =>
        new THREE.Vector3(
          (rand() - 0.5) * 1300,
          (rand() - 0.5) * 900,
          (rand() - 0.5) * 1300,
        ),
    );
    const count = mobile ? 26000 : 52000,
      dustPositions = new Float32Array(count * 3),
      dustSizes = new Float32Array(count),
      dustColors = new Float32Array(count * 3);
    const gaussian = () =>
      Math.sqrt(-2 * Math.log(Math.max(0.0001, rand()))) *
      Math.cos(rand() * Math.PI * 2);
    for (let i = 0; i < count; i++) {
      const edge = i % edges.length,
        [a, b] = edges[edge],
        t = rand();
      const p = nodes[a]
        .clone()
        .lerp(nodes[b], t)
        .addScaledVector(bends[edge], Math.sin(t * Math.PI));
      const cluster = i % 4 === 0,
        width = cluster ? 130 : 35 + Math.sin(t * Math.PI) * 70;
      if (cluster) p.copy(nodes[i % nodes.length]);
      p.x += gaussian() * width;
      p.y += gaussian() * width;
      p.z += gaussian() * width;
      dustPositions.set(p.toArray(), i * 3);
      dustSizes[i] = cluster ? 30 + rand() * 110 : 15 + rand() * 65;
      const warmth = cluster ? 0.55 : 0.08;
      dustColors.set(
        [0.23 + warmth, 0.32 + warmth * 0.7, 0.5 + warmth * 0.23],
        i * 3,
      );
    }
    return {
      nodes,
      edges,
      linePositions,
      lineColors,
      positions,
      sizes,
      ids,
      dustPositions,
      dustSizes,
      dustColors,
    };
  }, [mobile]);
  const uniforms = useMemo(
    () => ({
      uDpr: { value: 1 },
      uSelected: { value: 0 },
      uOpacity: { value: 0 },
    }),
    [],
  );
  const filaments = useMemo(
    () => ({ uDpr: { value: 1 }, uOpacity: { value: 0 } }),
    [],
  );
  useEffect(() => {
    journey.current.site.nodes = data.nodes;
    return () => {
      journey.current.site.nodes = [];
    };
  }, [journey, data]);
  useFrame(({ camera, gl }) => {
    const site = journey.current.site,
      distance = camera.position.distanceTo(WORLD.hole);
    const opacity = THREE.MathUtils.smoothstep(distance, 3300, 7800);
    nodesMaterial.current.uniforms.uOpacity.value = opacity;
    nodesMaterial.current.uniforms.uDpr.value = gl.getPixelRatio();
    lines.current.opacity = opacity * 0.045;
    dustMaterial.current.uniforms.uOpacity.value = opacity * 0.21;
    dustMaterial.current.uniforms.uDpr.value = gl.getPixelRatio();
    if (site.request && opacity > 0.2) {
      let best = -1,
        bestDistance = 0.075;
      data.nodes.forEach((node, i) => {
        projected.copy(node).project(camera);
        const d = Math.hypot(
          projected.x - site.request.x,
          projected.y - site.request.y,
        );
        if (projected.z < 1 && projected.z > 0 && d < bestDistance) {
          best = i;
          bestDistance = d;
        }
      });
      site.request = null;
      if (best >= 0) {
        site.selection = best;
        site.selectedPosition.copy(data.nodes[best]);
        site.onSelection?.(best);
      }
    }
    if (site.selection !== previous.current) {
      previous.current = site.selection;
      nodesMaterial.current.uniforms.uSelected.value = site.selection;
      data.edges.forEach(([a, b], i) => {
        const active = a === site.selection || b === site.selection;
        const color = active ? [0.65, 0.48, 0.26] : [0.12, 0.19, 0.28];
        data.lineColors.set(color, i * 6);
        data.lineColors.set(color, i * 6 + 3);
      });
      lineGeometry.current.attributes.color.needsUpdate = true;
    }
  });
  return (
    <group>
      <lineSegments frustumCulled={false}>
        <bufferGeometry ref={lineGeometry}>
          <bufferAttribute
            attach="attributes-position"
            args={[data.linePositions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[data.lineColors, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          ref={lines}
          vertexColors
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[data.positions, 3]}
          />
          <bufferAttribute attach="attributes-aSize" args={[data.sizes, 1]} />
          <bufferAttribute attach="attributes-aIndex" args={[data.ids, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={nodesMaterial}
          uniforms={uniforms}
          vertexShader={vertex}
          fragmentShader={fragment}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[data.dustPositions, 3]}
          />
          <bufferAttribute
            attach="attributes-aSize"
            args={[data.dustSizes, 1]}
          />
          <bufferAttribute
            attach="attributes-aColor"
            args={[data.dustColors, 3]}
          />
        </bufferGeometry>
        <shaderMaterial
          ref={dustMaterial}
          uniforms={filaments}
          vertexShader={filamentVertex}
          fragmentShader={filamentFragment}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

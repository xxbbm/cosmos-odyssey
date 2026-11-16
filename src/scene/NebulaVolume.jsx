import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useFBO } from "@react-three/drei";
import * as THREE from "three";
import { noise, surfaceVertex } from "../shaders/noise";
import { stageVisible } from "./cinematic";
import { ParticleField, seededRandom } from "./particles";
import { Flare } from "./Bodies";
import { cloudVertex } from "../shaders/space";
import { INTRO_POSES } from "./routes";
import { COLLIDERS } from "./world";

const CENTER = new THREE.Vector3(80, 0, -60);

const fragment = /*glsl*/ `
${noise}
uniform vec3 uCamera;
uniform float uTime;
varying vec3 vLocal;
vec2 intersectBox(vec3 ro,vec3 rd){vec3 inv=1./rd;vec3 a=(-vec3(23.,13.,23.)-ro)*inv,b=(vec3(23.,13.,23.)-ro)*inv;vec3 lo=min(a,b),hi=max(a,b);return vec2(max(max(lo.x,lo.y),lo.z),min(min(hi.x,hi.y),hi.z));}
float gas(vec3 p){
  vec3 q=p*vec3(.15,.073,.14);
  q.x+=noise3(p*.055)*2.2;
  float n=noise3(q)*.7+noise3(q*2.5+4.)*.3;
  float edge=1.-smoothstep(.6,1.,max(max(abs(p.x)/23.,abs(p.y)/13.),abs(p.z)/23.));
  float cavity=.48+.52*smoothstep(1.,8.,abs(p.x+sin(p.z*.13)*3.));
  return smoothstep(.38,.72,n)*edge*cavity;
}
void main(){
  vec3 rd=normalize(vLocal-uCamera);
  vec2 hit=intersectBox(uCamera,rd);
  float begin=max(0.,hit.x),end=hit.y;
  if(end<=begin){gl_FragColor=vec4(0.);return;}
  float stepSize=(end-begin)/10.;
  float jitter=hash31(vec3(gl_FragCoord.xy,7.));
  vec3 color=vec3(0.);float opacity=0.;
  for(int i=0;i<10;i++){
    vec3 p=uCamera+rd*(begin+(float(i)+jitter)*stepSize);
    float density=gas(p+vec3(uTime*.005,0.,0.));
    float alpha=1.-exp(-density*stepSize*.16);
    float lightA=1./(1.+dot(p-vec3(-3.,2.,-7.),p-vec3(-3.,2.,-7.))*.018);
    float lightB=1./(1.+dot(p-vec3(8.,-2.,-13.),p-vec3(8.,-2.,-13.))*.015);
    vec3 scatter=vec3(.012,.022,.037)+vec3(.17,.12,.065)*lightA+vec3(.025,.09,.12)*lightB;
    float shadow=.3+.7*noise3(p*.12+vec3(3.,1.,4.));
    color+=(1.-opacity)*scatter*shadow*alpha*2.8;
    opacity+=(1.-opacity)*alpha;
    if(opacity>.97)break;
  }
  gl_FragColor=vec4(color/max(opacity,.001),opacity*.22);
}`;
const gasSheet = /*glsl*/ `
${noise}
uniform vec3 uColor;
uniform float uSeed;
uniform float uTime;
varying vec2 vUv;
void main(){
  vec2 q=vUv-.5;
  vec3 p=vec3(q*5.,uSeed+uTime*.001);
  float warp=fbm(p*1.3);
  float n=fbm(p+warp*1.8);
  float edge=1.-smoothstep(.18,.49,length(q));
  float shape=pow(smoothstep(.28,.72,n),1.7)*edge;
  float small=fbm(vec3(q*50.,uSeed+6.));
  vec3 c=uColor*(.35+n*.8)*(small*.4+.6);
  gl_FragColor=vec4(c,shape*.65);
}`;
const pillarSheet = /*glsl*/ `
${noise}
uniform float uSeed;
varying vec2 vUv;
void main(){
  vec2 q=vUv-.5;
  float n=fbm(vec3(q*12.,uSeed));
  float x=q.x+sin(q.y*7.+n*3.)*.10;
  float width=.04+(.5-q.y)*.21+n*.08;
  float pillar=1.-smoothstep(width*.5,width,abs(x));
  pillar*=smoothstep(.48,.23,q.y)*(1.-smoothstep(.28,.5,abs(q.y)));
  float fibers=fbm(vec3(q*60.,uSeed+3.));
  float edge=pow(1.-abs(pillar*2.-1.),5.);
  vec3 c=vec3(.003,.004,.006)+vec3(.14,.095,.045)*edge*(.3+fibers*.7);
  gl_FragColor=vec4(c,pillar*(.68+fibers*.25));
}`;
const quadVertex = /*glsl*/ `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const compositeFragment = /*glsl*/ `uniform sampler2D uTexture;uniform vec2 uProbe;uniform float uStrength;uniform float uAspect;uniform float uDistance;varying vec2 vUv;void main(){vec4 c=texture2D(uTexture,vUv);vec2 d=(vUv-uProbe)*vec2(uAspect,1.);float light=exp(-dot(d,d)*13.)*uStrength;vec3 color=c.rgb/max(c.a,.001);color*=1.+light*3.4;color+=vec3(.12,.16,.19)*light*min(c.a*4.,1.);gl_FragColor=vec4(color,clamp(c.a,0.,1.)*uDistance);}`;
const sheetTextureFragment = /*glsl*/ `uniform sampler2D uTexture;varying vec2 vUv;void main(){gl_FragColor=texture2D(uTexture,vUv);}`;

export default function NebulaVolume({ journey, mobile }) {
  const root = useRef(),
    quad = useRef(),
    compositeMaterial = useRef();
  const { size, gl, camera } = useThree();
  const volumeScale = mobile ? 0.67 : 0.55;
  const target = useFBO(
    Math.max(128, Math.floor(size.width * volumeScale)),
    Math.max(128, Math.floor(size.height * volumeScale)),
    { type: THREE.HalfFloatType, depthBuffer: true },
  );
  const volume = useMemo(() => {
    const scene = new THREE.Scene();
    const uniforms = {
      uCamera: { value: new THREE.Vector3() },
      uTime: { value: 0 },
    };
    const geometry = new THREE.BoxGeometry(46, 26, 46);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: surfaceVertex,
      fragmentShader: fragment,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(80, 0, -60);
    scene.add(mesh);
    const maskGeometry = new THREE.SphereGeometry(1, 48, 32);
    const maskMaterial = new THREE.ShaderMaterial({
      vertexShader: surfaceVertex,
      fragmentShader: "void main(){gl_FragColor=vec4(0.);}",
      depthWrite: true,
    });
    COLLIDERS.filter((body) => body.name !== "Event horizon").forEach(
      (body) => {
        const mask = new THREE.Mesh(maskGeometry, maskMaterial);
        mask.position.copy(body.center);
        mask.scale.setScalar(body.radius);
        scene.add(mask);
      },
    );
    return {
      scene,
      material,
      geometry,
      maskGeometry,
      maskMaterial,
      clear: new THREE.Color(),
      cards: [],
    };
  }, []);
  const sheets = useMemo(() => {
    const random = seededRandom(61);
    return Array.from({ length: mobile ? 6 : 9 }, (_, i) => ({
      position: [(random() - 0.5) * 21, (random() - 0.5) * 13, -18 + i * 3.1],
      size: 18 + random() * 15,
      uniforms: {
        uColor: {
          value: new THREE.Color(
            i % 3 === 0 ? "#916e44" : i % 3 === 1 ? "#376b8a" : "#59637d",
          ),
        },
        uSeed: { value: i * 7.1 },
        uTime: { value: 0 },
      },
    }));
  }, [mobile]);
  useLayoutEffect(() => {
    const geometry = new THREE.PlaneGeometry(1, 1),
      cards = [],
      maps = [];
    const bakeScene = new THREE.Scene(),
      bakeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
      bakeGeometry = new THREE.PlaneGeometry(2, 2);
    const previous = gl.getRenderTarget();
    const add = (position, size, angle, shader, uniforms, order, blending) => {
      const map = new THREE.WebGLRenderTarget(
        512,
        shader === pillarSheet ? 1024 : 512,
        {
          type: THREE.HalfFloatType,
          depthBuffer: false,
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
        },
      );
      const baker = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: quadVertex,
        fragmentShader: shader,
        depthTest: false,
        depthWrite: false,
      });
      const bakeMesh = new THREE.Mesh(bakeGeometry, baker);
      bakeScene.add(bakeMesh);
      gl.setRenderTarget(map);
      gl.render(bakeScene, bakeCamera);
      bakeScene.remove(bakeMesh);
      baker.dispose();
      maps.push(map);
      const material = new THREE.ShaderMaterial({
        uniforms: { uTexture: { value: map.texture } },
        vertexShader: cloudVertex,
        fragmentShader: sheetTextureFragment,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(position[0] + 80, position[1], position[2] - 60);
      mesh.scale.set(size[0], size[1], 1);
      mesh.renderOrder = order;
      const orientation = new THREE.Matrix4().lookAt(
        new THREE.Vector3(...INTRO_POSES[2].position),
        new THREE.Vector3(...INTRO_POSES[2].target),
        new THREE.Vector3(0, 1, 0),
      );
      mesh.quaternion.setFromRotationMatrix(orientation);
      mesh.rotateZ(angle);
      material.side = THREE.DoubleSide;
      volume.scene.add(mesh);
      cards.push({ mesh, angle, material });
    };
    sheets.forEach((sheet, i) =>
      add(
        sheet.position,
        [sheet.size, sheet.size],
        i * 1.8,
        gasSheet,
        sheet.uniforms,
        1,
        THREE.AdditiveBlending,
      ),
    );
    add(
      [-4, -3, -5],
      [10, 24],
      -0.16,
      pillarSheet,
      { uSeed: { value: 9 } },
      4,
      THREE.NormalBlending,
    );
    add(
      [8, -4, -14],
      [12, 22],
      0.16,
      pillarSheet,
      { uSeed: { value: 19 } },
      4,
      THREE.NormalBlending,
    );
    gl.setRenderTarget(previous);
    bakeGeometry.dispose();
    volume.cards = cards;
    gl.compileAsync(volume.scene, camera).catch(() => {});
    return () => {
      cards.forEach((card) => {
        volume.scene.remove(card.mesh);
        card.material.dispose();
      });
      maps.forEach((map) => map.dispose());
      geometry.dispose();
      volume.cards = [];
    };
  }, [volume, sheets, gl, camera]);
  const composite = useMemo(
    () => ({
      uTexture: { value: target.texture },
      uProbe: { value: new THREE.Vector2(0.5, 0.5) },
      uStrength: { value: 0 },
      uAspect: { value: 1 },
      uDistance: { value: 1 },
    }),
    [target],
  );
  useEffect(
    () => () => {
      volume.geometry.dispose();
      volume.material.dispose();
      volume.maskGeometry.dispose();
      volume.maskMaterial.dispose();
    },
    [volume],
  );
  useFrame(({ camera, clock }) => {
    const active =
      stageVisible(journey.current, 2) &&
      camera.position.distanceTo(CENTER) < 70;
    root.current.visible = active;
    quad.current.visible = active;
    if (!active) return;
    const j = journey.current,
      weight =
        j.experience === "site"
          ? 1 -
            THREE.MathUtils.smoothstep(
              Math.abs(j.site.progress - 3),
              0.15,
              0.55,
            )
          : 0;
    const u = compositeMaterial.current.uniforms;
    u.uStrength.value = j.site.live.probe * weight;
    u.uAspect.value = size.width / size.height;
    u.uDistance.value =
      1 -
      THREE.MathUtils.smoothstep(camera.position.distanceTo(CENTER), 37, 70);
    u.uProbe.value.set(j.pointer.x * 0.5 + 0.5, j.pointer.y * 0.5 + 0.5);
    volume.material.uniforms.uCamera.value.copy(camera.position).sub(CENTER);
    volume.material.uniforms.uTime.value = journey.current.reduced
      ? 0
      : clock.elapsedTime;
    const previous = gl.getRenderTarget(),
      alpha = gl.getClearAlpha();
    gl.getClearColor(volume.clear);
    gl.setRenderTarget(target);
    gl.setClearColor(0x000000, 0);
    gl.clear();
    gl.render(volume.scene, camera);
    gl.setRenderTarget(previous);
    gl.setClearColor(volume.clear, alpha);
  }, -0.5);
  return (
    <>
      <mesh ref={quad} frustumCulled={false} renderOrder={2}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          ref={compositeMaterial}
          vertexShader={quadVertex}
          fragmentShader={compositeFragment}
          uniforms={composite}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <group ref={root} position={[80, 0, -60]}>
        <ParticleField
          count={mobile ? 700 : 1600}
          kind="nebula"
          journey={journey}
          opacity={0.35}
        />
        <Flare
          position={[-3, 2, -7]}
          size={8}
          color="#e4d5b9"
          opacity={0.6}
          renderOrder={5}
        />
        <Flare
          position={[8, -2, -13]}
          size={5}
          color="#b2c9dc"
          opacity={0.5}
          renderOrder={5}
        />
      </group>
    </>
  );
}

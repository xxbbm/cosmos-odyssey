import { noise } from "./noise";

export const pointVertex = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelRatio;
uniform float uStretch;
uniform float uOpacity;
uniform float uReveal;
uniform float uSoft;
uniform float uBackground;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec3 p=position;
  p.y+=uSoft*sin(uTime*.06+p.x*.3)*.03;
  vec4 mv=modelViewMatrix*vec4(p,1.);
  vColor=aColor;
  float stagger=fract(sin(dot(position,vec3(12.9898,78.233,41.3)))*43758.5453)*.35;
  vAlpha=uOpacity*(.97+.03*sin(uTime*.14+position.x)) * smoothstep(stagger,stagger+.6,uReveal);
  float scale=length(modelMatrix[0].xyz);
  float pixels=mix(aSize*scale*(120./max(1.,-mv.z)),aSize,uBackground);
  gl_PointSize=clamp(pixels*uPixelRatio,.5,16.)*(1.+uStretch);
  gl_Position=projectionMatrix*mv;
}
`;
export const pointFragment = /* glsl */ `
uniform float uStretch;
uniform float uSoft;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec2 uv=gl_PointCoord-.5;
  uv.x*=1.+uStretch;
  float d=length(uv);
  float glow=exp(-d*d*25.);
  float core=exp(-d*d*190.);
  gl_FragColor=vec4(vColor*(glow+core*.7*(1.-uSoft)),smoothstep(.5,.1,d)*vAlpha);
}
`;

export const skyFragment = /* glsl */ `
${noise}
varying vec3 vLocal;
void main(){
  vec3 p=normalize(vLocal);
  float dust=fbm(p*4.+9.);
  float wisps=pow(fbm(p*9.+fbm(p*4.)*2.),4.);
  vec3 c=vec3(.0003,.0004,.0007)+vec3(.002,.003,.005)*wisps;
  gl_FragColor=vec4(c,1.);
}
`;

export const cloudVertex = /* glsl */ `
varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`;
export const cloudFragment = /* glsl */ `
${noise}
uniform float uTime;
uniform float uSeed;
uniform float uOpacity;
uniform vec3 uColor;
varying vec2 vUv;
void main(){
  vec2 q=vUv-.5;
  float edge=smoothstep(.53,.05,length(q));
  vec3 p=vec3(q*4.,uSeed+uTime*.013);
  float n=fbm(p+fbm(p*1.3)*1.7);
  float tendril=pow(smoothstep(.27,.78,n),1.8);
  float hollow=smoothstep(.06,.32,length(q+vec2(.07,-.04)));
  float a=tendril*edge*(.3+hollow*.7)*uOpacity;
  vec3 color=uColor*(.45+n*1.3);
  gl_FragColor=vec4(color,a);
}
`;

export const flareFragment = /* glsl */ `
uniform float uOpacity;
uniform vec3 uColor;
varying vec2 vUv;
void main(){
  vec2 p=(vUv-.5)*2.;
  float r=length(p);
  float core=exp(-r*r*4500.);
  float halo=exp(-r*15.)*.12;
  float streak=exp(-abs(p.y)*700.)*exp(-abs(p.x)*6.)*.025;
  float rays=0.;
  vec3 c=uColor*(core*5.+halo+streak);
  gl_FragColor=vec4(c,(core+halo+streak+rays)*uOpacity);
}
`;

// A view-aligned, analytic lensing approximation: asymmetric relativistic disk,
// upper/lower lensed images, photon ring and a gravitationally deflected starfield.
export const blackHoleFragment = /* glsl */ `
${noise}
uniform float uTime;
uniform float uOpacity;
uniform float uTilt;
varying vec2 vUv;
float stars(vec2 uv){
  vec2 grid=uv*105.;vec2 cell=floor(grid);vec2 f=fract(grid)-.5;
  float h=hash31(vec3(cell,6.));
  return step(.982,h)*exp(-dot(f,f)*900.)*(.4+h);
}
void main(){
  vec2 p=(vUv-.5)*2.;
  float r=length(p);
  float horizon=.203;
  float angle=atan(p.y,p.x);
  vec2 deflect=p*(1.+.065/max(.02,r*r));
  float backdrop=stars(deflect);
  vec3 color=vec3(.5,.65,1.)*backdrop*.6;
  float photon=exp(-abs(r-horizon*1.075)*330.);
  float diskR=length(vec2(p.x,p.y/(.14+uTilt*.04)));
  float diskMask=smoothstep(.19,.23,diskR)*(1.-smoothstep(.68,.95,diskR));
  float bands=sin(diskR*190.-uTime*1.8+fbm(vec3(p*35.,uTime*.05))*4.)*.5+.5;
  float turbulence=fbm(vec3(p.x*22.,p.y*65.,uTime*.12));
  float disk=diskMask*(.6+bands*.35+turbulence*.45);
  disk*=exp(-diskR*1.5);
  float arcRadius=length(vec2(p.x,p.y*.85));
  float arc=exp(-abs(arcRadius-.295)*52.)*smoothstep(-.015,.045,p.y);
  arc*=smoothstep(.36,.16,abs(p.x));
  float lower=exp(-abs(length(vec2(p.x,p.y*1.2))-.337)*95.)*smoothstep(.015,-.06,p.y)*.3;
  float doppler=clamp(.85-p.x*1.2,.25,1.7);
  vec3 hot=mix(vec3(1.8,.43,.065),vec3(2.9,1.9,.9),clamp(.5-p.x,.0,1.));
  color+=hot*(disk+arc*.9+lower)*doppler*1.25;
  color+=vec3(2.3,1.3,.56)*photon*1.1;
  color+=vec3(.24,.075,.018)*exp(-r*5.)*.35;
  // The event horizon occludes the far side of the luminous disk.
  color*=smoothstep(horizon*.96,horizon*1.02,r);
  float alpha=smoothstep(1.,.78,r)*uOpacity;
  gl_FragColor=vec4(color,alpha);
}
`;

export const galaxyFragment = /* glsl */ `
${noise}
uniform float uOpacity;
uniform float uTime;
varying vec2 vUv;
void main(){
  vec2 p=(vUv-.5)*2.; float r=length(p);
  float a=atan(p.y,p.x);
  float dust=fbm(vec3(p*21.,4.+uTime*.003));
  float warp=fbm(vec3(p*8.,3.));
  float phase=a*2.+log(1.+r*26.)*3.3+warp*1.4+sin(r*17.)*.25;
  float spiral=pow(.5+.5*cos(phase),3.);
  float arms=spiral*exp(-r*2.6)*smoothstep(0.,.1,r)*(.2+dust*1.5);
  float core=exp(-r*21.);
  float edge=1.-smoothstep(.78,.98,r);
  float glow=(arms*1.25+core*2.4+.085*exp(-r*3.))*edge;
  vec3 outer=mix(vec3(.24,.29,.4),vec3(.32,.27,.32),dust*.4);
  vec3 color=mix(vec3(1.,.77,.5),outer,smoothstep(.02,.5,r));
  float breath=.99+.01*sin(uTime*.13);
  gl_FragColor=vec4(color*glow*breath,edge*uOpacity*.7);
}
`;

export const galaxyDustFragment = /*glsl*/ `
${noise}
uniform float uOpacity;
varying vec2 vUv;
void main(){
  vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x);
  float n=fbm(vec3(p*24.,17.));
  float lane=pow(.5+.5*cos(a*2.+log(1.+r*26.)*3.3+n*1.3+.65),10.);
  float alpha=lane*smoothstep(.06,.19,r)*(1.-smoothstep(.65,.94,r))*smoothstep(.3,.7,n)*.14;
  gl_FragColor=vec4(.0015,.0018,.0025,alpha*uOpacity);
}`;

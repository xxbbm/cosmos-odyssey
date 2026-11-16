import { noise } from "./noise";

export const earthFragment = /* glsl */ `
${noise}
uniform float uTime;
uniform float uOpacity;
uniform vec3 uSun;
uniform sampler2D uAlbedo;
uniform sampler2D uCloud;
varying vec3 vLocal;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec3 p=normalize(vLocal), N=normalize(vNormal);
  vec3 L=normalize(uSun-vWorld), V=normalize(cameraPosition-vWorld);
  float day=dot(N,L);
  vec2 uv=vec2(atan(p.z,p.x)/6.2831853+.5,asin(p.y)/3.14159265+.5);
  vec4 ground=texture2D(uAlbedo,uv);
  float land=ground.a;
  vec3 albedo=ground.rgb;
  float cloud=texture2D(uCloud,uv+vec2(uTime*.000008,0.)).r;
  float diffuse=max(day,0.);
  vec3 color=albedo*(.008+diffuse*1.8)*(1.-cloud*.22);
  vec3 H=normalize(L+V);
  float spec=pow(max(dot(N,H),0.),420.)*(1.-land)*(1.-cloud)*max(day,0.);
  color+=vec3(.68,.72,.74)*spec*.24;
  float cities=pow(noise3(p*450.),18.)*land;
  cities*=smoothstep(.08,-.2,day)*(1.-cloud)*smoothstep(.52,.67,noise3(p*27.))*2.5;
  color+=vec3(1.,.55,.14)*cities;
  float fresnel=pow(1.-max(dot(N,V),0.),3.8);
  color+=vec3(.025,.14,.3)*fresnel*smoothstep(-.3,.4,day)*.3;
  color+=vec3(.8,.23,.06)*fresnel*exp(-abs(day)*12.)*.25;
  gl_FragColor=vec4(color,uOpacity);
}
`;

export const cloudSurfaceFragment = /*glsl*/ `
uniform sampler2D uCloud;
uniform float uTime;
uniform vec3 uSun;
varying vec3 vLocal;
varying vec3 vWorld;
varying vec3 vNormal;
void main(){
  vec3 p=normalize(vLocal),N=normalize(vNormal),L=normalize(uSun-vWorld);
  vec2 uv=vec2(atan(p.z,p.x)/6.2831853+.5,asin(p.y)/3.14159265+.5)+vec2(uTime*.000008,0.);
  vec4 weather=texture2D(uCloud,uv);
  float day=dot(N,L),light=max(day,0.);
  float shape=.77+weather.g*.4;
  vec3 c=vec3(.73,.78,.8)*(.008+light*1.7)*shape;
  gl_FragColor=vec4(c,weather.r*.91);
}`;

export const atmosphereFragment = /* glsl */ `
uniform float uOpacity;
uniform vec3 uSun;
varying vec3 vWorld;
varying vec3 vNormal;
void main(){
  vec3 N=normalize(vNormal),V=normalize(cameraPosition-vWorld);
  float grazing=abs(dot(N,V));
  float rim=pow(max(0.,1.-grazing),4.5)*smoothstep(0.,.15,grazing);
  float light=smoothstep(-.35,.6,dot(N,normalize(uSun-vWorld)));
  vec3 c=mix(vec3(.005,.035,.1),vec3(.08,.26,.53),light);
  gl_FragColor=vec4(c,rim*(.03+light*.6)*uOpacity);
}
`;

export const giantFragment = /* glsl */ `
${noise}
uniform float uTime;
uniform float uOpacity;
uniform vec3 uSun;
varying vec3 vLocal;
varying vec3 vWorld;
varying vec3 vNormal;
void main(){
  vec3 p=normalize(vLocal);
  float turb=fbm(vec3(p.x*12.+uTime*.004,p.y*28.,p.z*12.));
  float band=sin(p.y*65.+turb*.9+noise3(p*45.)*.25)*.5+.5;
  float fine=fbm(vec3(p.x*19.,p.y*160.,p.z*19.));
  vec3 color=mix(vec3(.28,.235,.17),vec3(.58,.52,.41),smoothstep(.05,.95,band));
  color=mix(color,vec3(.9,.81,.65),smoothstep(.48,.8,fine)*.45);
  color*=.8+fine*.45;
  float light=max(dot(normalize(vNormal),normalize(uSun-vWorld)),0.);
  color*=.009+light*1.1;
  vec3 V=normalize(cameraPosition-vWorld);
  color+=vec3(.4,.25,.12)*pow(1.-max(dot(normalize(vNormal),V),0.),4.)*light*.4;
  gl_FragColor=vec4(color,uOpacity);
}
`;

export const ringVertex = /* glsl */ `
varying vec3 vLocal;
varying vec3 vWorld;
void main(){vLocal=position;vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}
`;
export const ringFragment = /* glsl */ `
${noise}
uniform float uOpacity;
varying vec3 vLocal;
varying vec3 vWorld;
void main(){
  float r=length(vLocal.xy);
  float bands=noise3(vec3(r*180.,0.,0.))*.18+noise3(vec3(r*430.,1.,0.))*.08;
  float a=.16+bands;
  a*=smoothstep(3.25,3.45,r)*(1.-smoothstep(6.5,6.9,r));
  a*=1.-(1.-smoothstep(.045,.105,abs(r-4.75)))*.98;
  a*=1.-(1.-smoothstep(.025,.055,abs(r-5.6)))*.75;
  vec3 c=mix(vec3(.14,.135,.12),vec3(.48,.45,.37),noise3(vec3(r*13.,2.,0.)));
  // Analytic occlusion of sunlight by the gas giant onto its ring plane.
  vec3 light=normalize(vec3(-6.,5.,4.));
  float rayT=max(0.,-dot(vLocal,light));
  float shadow=smoothstep(2.35,2.7,length(vLocal+light*rayT));
  c*=mix(.035,1.,shadow);
  gl_FragColor=vec4(c,a*uOpacity);
}
`;

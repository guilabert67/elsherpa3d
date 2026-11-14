// El Sherpa 3D · visor 3D de montañas de España
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {fmt,esc,fetchT,M_LAT,mLon,dist,mX,mY,hm,bboxOf,demIGN,gridH,eleIGN,routeNumbers,MODES,routeBR,routeReport,levelsPerPoint,
 trailsWithDifficulty,trailSummary,trailCardHTML,barHTML,SAC_TXT,MTB_TXT,DIF_COL,NODATA_COL,readRouteFile,gpxText,download,safeName,drawProfile,profileIndex,sunPos,weather,wmoTxt} from './comun.js';

// Catálogo: coordenadas de la cumbre de referencia (OpenStreetMap/Nominatim, comprobadas el 14-11-2026)
const CAT = [
 ['Pirineos',[
  ['Ordesa y Monte Perdido','Monte Perdido',42.6755,0.0344,16],
  ['Maladeta','Aneto',42.6311,0.6567,14],
  ['Posets','Pico de Posets',42.6546,0.4352,12],
  ['Pica d\'Estats','Pica d\'Estats',42.6670,1.3979,12],
  ['Collarada','Collarada',42.7142,-0.4706,10],
  ['Sierra de Guara','Tozal de Guara',42.2887,-0.2294,14],
  ['Pedraforca','Pollegó Superior',42.2399,1.7029,10],
  ['Serra del Cadí','Vulturó',42.2858,1.6364,16]]],
 ['Cordillera Cantábrica y Galicia',[
  ['Picos de Europa (Macizo Central)','Torre Cerredo',43.1978,-4.8529,16],
  ['Naranjo de Bulnes','Picu Urriellu',43.2008,-4.8177,10],
  ['Ubiña','Peña Ubiña',43.0183,-5.9567,12],
  ['Ancares','Cuíña',42.8442,-6.8328,12],
  ['Trevinca','Pena Trevinca',42.2424,-6.7961,14]]],
 ['País Vasco y Navarra',[
  ['Urkiola','Anboto',43.0879,-2.5962,10],
  ['Gorbeia','Cruz de Gorbeia',43.0339,-2.7814,12],
  ['Aralar','Txindoki (Larrunarri)',43.0227,-2.0884,12]]],
 ['Sistema Ibérico',[
  ['Moncayo','Moncayo',41.7872,-1.8397,14],
  ['Picos de Urbión','Urbión',42.0114,-2.8785,12],
  ['Sierra de la Demanda','San Lorenzo',42.2426,-2.9726,12],
  ['Sierra Cebollera','Cebollera',41.9980,-2.6736,12],
  ['Javalambre','Alto de las Barracas',40.0773,-1.0907,14],
  ['Penyagolosa','Penyagolosa',40.2228,-0.3497,12]]],
 ['Sistema Central',[
  ['La Pedriza','Manzanares el Real',40.7646,-3.8913,12],
  ['Peñalara','Peñalara',40.8500,-3.9561,12],
  ['Siete Picos','Siete Picos',40.7815,-4.0334,10],
  ['Sierra de Ayllón','Pico del Lobo',41.1832,-3.4663,12],
  ['Sierra de Gredos','Almanzor',40.2460,-5.2975,14],
  ['Sierra de Béjar','Canchal de la Ceja',40.3045,-5.7289,12],
  ['Peña de Francia','Peña de Francia',40.5123,-6.1690,10],
  ['Sierra de Gata','Jálama',40.2387,-6.7556,12]]],
 ['Centro y Sur',[
  ['Montes de Toledo','Rocigalgo',39.5275,-4.6157,14],
  ['Sierra Nevada','Mulhacén',37.0534,-3.3116,16],
  ['Sierra Mágina','Mágina',37.7260,-3.4641,12],
  ['Sierra de las Nieves','Torrecilla',36.6759,-4.9962,12],
  ['Sierra de Grazalema','El Torreón',36.7657,-5.4225,12],
  ['Torcal de Antequera','El Torcal',36.9698,-4.5369,8],
  ['Aitana','Aitana',38.6496,-0.2661,12]]],
 ['Cataluña',[
  ['Montserrat','Sant Jeroni',41.6054,1.8115,10],
  ['Montseny','Turó de l\'Home',41.7765,2.4348,14]]],
 ['Islas',[
  ['Serra de Tramuntana','Puig Major',39.8072,2.7941,14],
  ['Teide','Teide',28.2727,-16.6423,18],
  ['Cumbre de Gran Canaria','Roque Nublo',27.9708,-15.6126,14],
  ['Caldera de Taburiente','Roque de los Muchachos',28.7542,-17.8849,14]]]
];

const $=s=>document.querySelector(s);
const MOBILE=matchMedia('(pointer:coarse)').matches;

// ---------- Avisos de estado ----------
const LOG={};let stTimer=null;
function setStatus(k,html,cls=''){LOG[k]={html,cls};renderStatus()}
function clearStatus(k){delete LOG[k];renderStatus()}
function renderStatus(){const k=Object.keys(LOG);$('#stTxt').innerHTML=k.map(x=>`<div class="${LOG[x].cls}">${LOG[x].html}</div>`).join('');$('#status').classList.toggle('show',k.length>0);
 clearTimeout(stTimer);if(k.length&&k.every(x=>LOG[x].cls==='ok'))stTimer=setTimeout(()=>{for(const x of Object.keys(LOG))if(LOG[x].cls==='ok')delete LOG[x];renderStatus()},6000)}
const setProg=f=>$('#prog i').style.width=Math.round(f*100)+'%';
// direcciones de datos usadas por la zona (para guardarla sin conexión)
let zoneUrls=new Set();globalThis.__sherpaRec=u=>zoneUrls.add(u);
async function getData(url,ms){return fetchT(url,ms)}

// ---------- Escena ----------
const canvas=$('#c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new THREE.Scene();scene.background=new THREE.Color(0xa9c6d8);
const camera=new THREE.PerspectiveCamera(45,1,10,400000);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;controls.dampingFactor=.08;controls.screenSpacePanning=false;controls.maxPolarAngle=Math.PI*0.47;
controls.mouseButtons={LEFT:THREE.MOUSE.PAN,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.ROTATE};
controls.touches={ONE:THREE.TOUCH.PAN,TWO:THREE.TOUCH.DOLLY_ROTATE};
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();if(sel)drawProf()}
addEventListener('resize',resize);
const MAXTEX=renderer.capabilities.maxTextureSize;
const texLimit=()=>Math.min(MAXTEX,MOBILE?2048:($('#cHiTex').checked?8192:4096));
const blank=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);blank.needsUpdate=true;

// uniformes comunes a todas las mallas
const U={uShade:{value:1},uHypso:{value:0},uCont:{value:0},uContInt:{value:20},uHmin:{value:0},uHmax:{value:2000},uExag:{value:1},
 uSun:{value:new THREE.Vector3(-.5,.6,-.5).normalize()},uSlope:{value:0},uNight:{value:0},uFog:{value:new THREE.Vector2(30000,90000)}};
const VS=`attribute float hgt;attribute vec2 guv;uniform float uExag;
varying vec2 vUv,vGuv,vP;varying vec3 vN,vN0;varying float vH,vFog;
void main(){vUv=uv;vGuv=guv;vN0=normal;vN=normalize(vec3(normal.x,normal.y/uExag,normal.z));vH=hgt;vP=position.xz;
 vec4 mv=modelViewMatrix*vec4(position.x,position.y*uExag,position.z,1.);vFog=-mv.z;gl_Position=projectionMatrix*mv;}`;
const FS=`uniform sampler2D uMap,uOver,uShadow;uniform float uUseMap,uUseOver,uUseShadow,uShade,uHypso,uCont,uContInt,uHmin,uHmax,uSlope,uNight,uUseHole;
uniform vec3 uSun;uniform vec4 uHole;uniform vec2 uFog;
varying vec2 vUv,vGuv,vP;varying vec3 vN,vN0;varying float vH,vFog;
vec3 ramp(float t){vec3 c0=vec3(.36,.55,.33),c1=vec3(.62,.70,.40),c2=vec3(.86,.80,.52),c3=vec3(.74,.55,.38),c4=vec3(.60,.52,.48),c5=vec3(.97,.97,.97);
 t=clamp(t,0.,1.)*5.;if(t<1.)return mix(c0,c1,t);if(t<2.)return mix(c1,c2,t-1.);if(t<3.)return mix(c2,c3,t-2.);if(t<4.)return mix(c3,c4,t-3.);return mix(c4,c5,t-4.);}
void main(){
 if(uUseHole>.5&&vP.x>uHole.x&&vP.x<uHole.z&&vP.y>uHole.y&&vP.y<uHole.w)discard;
 vec3 n=normalize(vN);
 vec3 col=uUseMap>.5?texture2D(uMap,vUv).rgb:vec3(.82,.82,.80);
 if(uHypso>.5){vec3 h=ramp((vH-uHmin)/max(uHmax-uHmin,1.));col=uUseMap>.5?mix(col,h,.55):h;}
 if(uShade>.5){float lit=max(dot(n,uSun),0.);if(uUseShadow>.5)lit*=texture2D(uShadow,vGuv).r;col*=uUseMap>.5?(.48+.64*lit):(.28+.86*lit);}
 if(uNight>.5)col*=.32;
 if(uSlope>.5){float s=degrees(acos(clamp(normalize(vN0).y,0.,1.)));
  if(s>=45.)col=mix(col,vec3(.61,.15,.69),.75);else if(s>=40.)col=mix(col,vec3(.96,.26,.21),.7);else if(s>=35.)col=mix(col,vec3(1.,.6,0.),.65);else if(s>=30.)col=mix(col,vec3(1.,.92,.23),.6);}
 if(uCont>.5){float v=vH/uContInt;float w=fwidth(v);float l=1.-smoothstep(0.,1.,abs(fract(v-.5)-.5)/max(w,1e-4));
  float vi=vH/(uContInt*5.);float wi=fwidth(vi);float li=1.-smoothstep(0.,1.6,abs(fract(vi-.5)-.5)/max(wi,1e-4));col=mix(col,vec3(.42,.22,.08),max(l*.55,li*.85));}
 if(uUseOver>.5){vec4 o=texture2D(uOver,vUv);col=mix(col,o.rgb,o.a);}
 col=mix(col,vec3(.66,.78,.85),smoothstep(uFog.x,uFog.y,vFog));
 gl_FragColor=vec4(col,1.);}`;

// ---------- Capas de terreno (zona base y parche de detalle) ----------
let Z=null,LB=null,LP=null,loadSeq=0;
function newLayer(kind,bb){const u={uMap:{value:blank},uUseMap:{value:0},uOver:{value:blank},uUseOver:{value:0},uShadow:{value:blank},uUseShadow:{value:0},uHole:{value:new THREE.Vector4()},uUseHole:{value:0}};
 return {kind,bb,u,grid:null,merc:null,mesh:null,ways:[],pts:[],wmt:null,over:null,overTex:null,seq:0}}
function disposeLayer(L){if(!L)return;if(L.mesh){scene.remove(L.mesh);L.mesh.geometry.dispose();L.mesh.material.dispose();L.mesh.children.forEach(c=>{c.geometry.dispose();c.material.dispose()})}
 for(const k of ['uMap','uOver','uShadow'])if(L.u[k].value!==blank)L.u[k].value.dispose();L.seq=-1}
const toLocal=(lat,lon)=>[(lon-Z.lon)*Z.mx,-(lat-Z.lat)*M_LAT];
const toLatLon=(x,z)=>[Z.lat-z/M_LAT,Z.lon+x/Z.mx];
const inBB=(b,lat,lon)=>lat>b.s&&lat<b.n&&lon>b.w&&lon<b.e;
function hAt(lat,lon){if(LP&&LP.grid&&inBB(LP.bb,lat,lon)){const v=gridH(LP.grid,lat,lon);if(v!=null)return v}return LB&&LB.grid?gridH(LB.grid,lat,lon):null}
function hLocal(x,z){const [la,lo]=toLatLon(x,z);return hAt(la,lo)}
function buildMesh(L){
 const g=L.grid,{W,H}=g,n=W*H;const pos=new Float32Array(n*3),hg=new Float32Array(n),uv=new Float32Array(n*2),guv=new Float32Array(n*2);
 const zm=20,X0=mX(L.bb.w,zm),X1=mX(L.bb.e,zm),Y0=mY(L.bb.n,zm),Y1=mY(L.bb.s,zm);L.merc={X0,X1,Y0,Y1,zm};
 for(let j=0;j<H;j++){const lat=g.lat0-j*g.dLat;const vy=1-(mY(lat,zm)-Y0)/(Y1-Y0);
  for(let i=0;i<W;i++){const k=j*W+i,lon=g.lon0+i*g.dLon;const [x,z]=toLocal(lat,lon);const h=g.data[k];
   pos[k*3]=x;pos[k*3+1]=h;pos[k*3+2]=z;hg[k]=h;uv[k*2]=(mX(lon,zm)-X0)/(X1-X0);uv[k*2+1]=vy;guv[k*2]=i/(W-1);guv[k*2+1]=j/(H-1)}}
 const idx=new Uint32Array((W-1)*(H-1)*6);let q=0;
 for(let j=0;j<H-1;j++)for(let i=0;i<W-1;i++){const a=j*W+i,b=a+1,c=a+W,d=c+1;idx[q++]=a;idx[q++]=c;idx[q++]=b;idx[q++]=b;idx[q++]=c;idx[q++]=d}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('hgt',new THREE.BufferAttribute(hg,1));
 geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setAttribute('guv',new THREE.BufferAttribute(guv,2));geo.setIndex(new THREE.BufferAttribute(idx,1));geo.computeVertexNormals();
 const mat=new THREE.ShaderMaterial({uniforms:{...U,...L.u},vertexShader:VS,fragmentShader:FS,extensions:{derivatives:true}});
 L.mesh=new THREE.Mesh(geo,mat);L.mesh.frustumCulled=false;
 // faldón para que no se vean huecos por los bordes
 const base=g.mn-150;const sp=[];const edge=[];
 for(let i=0;i<W;i++)edge.push(i);for(let j=1;j<H;j++)edge.push(j*W+W-1);for(let i=W-2;i>=0;i--)edge.push((H-1)*W+i);for(let j=H-2;j>=0;j--)edge.push(j*W);
 for(let e=0;e<edge.length-1;e++){const a=edge[e],b=edge[e+1];sp.push(pos[a*3],pos[a*3+1],pos[a*3+2],pos[b*3],pos[b*3+1],pos[b*3+2],pos[a*3],base,pos[a*3+2],pos[b*3],pos[b*3+1],pos[b*3+2],pos[b*3],base,pos[b*3+2],pos[a*3],base,pos[a*3+2])}
 const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(sp,3));
 L.mesh.add(new THREE.Mesh(sg,new THREE.ShaderMaterial({uniforms:{uExag:U.uExag},side:THREE.DoubleSide,
  vertexShader:'uniform float uExag;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position.x,position.y*uExag,position.z,1.);}',
  fragmentShader:'void main(){gl_FragColor=vec4(.36,.30,.24,1.);}'})));
 scene.add(L.mesh);
}

// ---------- Carga de una zona ----------
async function loadZone(z){
 const seq=++loadSeq;stopFly();$('#card').classList.remove('show');
 zoneUrls=new Set();
 z.mx=mLon(z.lat);z.big=z.size>30;z.hiTex=$('#cHiTex').checked;
 const h=z.size*500;const bb={s:z.lat-h/M_LAT,n:z.lat+h/M_LAT,w:z.lon-h/z.mx,e:z.lon+h/z.mx};z.bb=bb;
 setStatus('zona',`Cargando ${esc(z.name)}…`);
 let res=+$('#selDem').value;if(res===5&&z.size>8){res=25;setStatus('dem5','Zona de más de 8 km: se usa el MDT de 25 m.','wa')}else clearStatus('dem5');
 setStatus('dem',`Descargando el relieve (MDT ${res} m del IGN)…`);setProg(.05);
 let g;try{g=await demIGN(bb,res,MOBILE?800:1100)}catch(e){if(seq===loadSeq){clearStatus('zona');setStatus('dem','No se pudo descargar el relieve de '+esc(z.name)+': '+esc(e.message)+'. Sigues viendo la zona anterior; pulsa «Recargar» en unos segundos.','er')}return}
 if(seq!==loadSeq)return;
 clearStatus('zona');Z=z;$('#zname').textContent=`${z.name}${z.sub?' · '+z.sub:''} · ${z.size} km`;document.title=z.name+' · El Sherpa 3D';z.res=res;
 labelsEl.innerHTML='';labels=[];parks=new Map();renderParks();
 disposeLayer(LP);LP=null;disposeLayer(LB);
 LB=newLayer('base',bb);LB.grid=g;LB.seq=seq;buildMesh(LB);
 U.uHmin.value=g.mn;U.uHmax.value=g.mx;U.uFog.value.set(z.size*2500,z.size*7500);
 setStatus('dem',`Relieve: ${fmt(g.W)}×${fmt(g.H)} puntos, celda de ${fmt(g.cellM)} m${g.scaled?' (reducido para una zona grande)':''} · de ${fmt(g.mn)} a ${fmt(g.mx)} m${g.nod?` · ${fmt(g.nod)} celdas sin dato puestas a 0 (mar)`:''}.`,'ok');
 frameCamera(z.view);z.view=null;
 updateShare();computeShadows(LB);
 loadImagery(LB);loadOSM(LB,Z.big?12:z.size<=15?14:13,!Z.big);if(!Z.big)loadTrails(LB);else{$('#trailSum').innerHTML='<div class="mut">En zonas grandes los senderos salen al acercarte.</div>'}if($('#cWmt').checked)loadWmt(LB);
 drawOverlay(LB);
}
function frameCamera(view){
 const g=LB.grid,half=Z.size*500,cy=(g.mn+g.mx)/2*U.uExag.value;
 if(view){camera.position.set(...view.p);controls.target.set(...view.t)}else{controls.target.set(0,cy,0);camera.position.set(0,cy+half*1.15,half*1.55)}
 controls.maxDistance=half*6;controls.minDistance=40;camera.far=half*12;camera.updateProjectionMatrix();controls.update();
}

// ---------- Parche de detalle para zonas grandes ----------
let patchBusy=false,patchCheck=0;
function checkPatch(){
 if(!Z||!Z.big||patchBusy||!LB||!LB.grid)return;
 const d=camera.position.distanceTo(controls.target);if(d>14000*U.uExag.value)return;
 const [lat,lon]=toLatLon(controls.target.x,controls.target.z);
 if(LP&&dist([lat,lon],LP.c)<3000)return;
 loadPatch(lat,lon);
}
async function loadPatch(lat,lon){
 patchBusy=true;const seq=loadSeq;const h=5000;const b=Z.bb;
 lat=Math.min(b.n-h/M_LAT,Math.max(b.s+h/M_LAT,lat));lon=Math.min(b.e-h/Z.mx,Math.max(b.w+h/Z.mx,lon));
 const bb={s:lat-h/M_LAT,n:lat+h/M_LAT,w:lon-h/Z.mx,e:lon+h/Z.mx};
 setStatus('patch','Cargando el detalle de esta parte (10 km)…');
 try{const g=await demIGN(bb,25,600);if(seq!==loadSeq){patchBusy=false;return}
  const L=newLayer('patch',bb);L.grid=g;L.c=[lat,lon];L.seq=seq;buildMesh(L);
  const old=LP;LP=L;disposeLayer(old);
  const [x0,z0]=toLocal(bb.n,bb.w),[x1,z1]=toLocal(bb.s,bb.e);LB.u.uHole.value.set(x0,z0,x1,z1);LB.u.uUseHole.value=1;
  computeShadows(LP);loadImagery(LP);loadOSM(LP,14,true);loadTrails(LP);if($('#cWmt').checked)loadWmt(LP);drawOverlay(LP);
  setStatus('patch','Detalle cargado alrededor del centro de la vista.','ok')}
 catch(e){setStatus('patch','No se pudo cargar el detalle: '+esc(e.message),'wa')}
 patchBusy=false;
}

// ---------- Imagen de fondo (teselas WMTS / XYZ) ----------
const BASES={
 pnoa:{max:19,url:(z,x,y)=>`https://www.ign.es/wmts/pnoa-ma?layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix=${z}&TileCol=${x}&TileRow=${y}`,name:'Satélite PNOA (IGN)'},
 base:{max:17,url:(z,x,y)=>`https://www.ign.es/wmts/ign-base?layer=IGNBaseTodo&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix=${z}&TileCol=${x}&TileRow=${y}`,name:'Mapa base IGN'},
 mtn:{max:16,url:(z,x,y)=>`https://www.ign.es/wmts/mapa-raster?layer=MTN&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix=${z}&TileCol=${x}&TileRow=${y}`,name:'MTN (IGN)'},
 otm:{max:17,url:(z,x,y)=>`https://${'abc'[(x+y)%3]}.tile.opentopomap.org/${z}/${x}/${y}.png`,name:'OpenTopoMap'}
};
let baseKey='pnoa';
async function tilesToCanvas(bb,maxZ,urlFn,lim,key,label){
 let zm=maxZ;while(zm>6&&Math.max(mX(bb.e,zm)-mX(bb.w,zm),mY(bb.s,zm)-mY(bb.n,zm))>lim)zm--;
 const X0=mX(bb.w,zm),X1=mX(bb.e,zm),Y0=mY(bb.n,zm),Y1=mY(bb.s,zm);const cw=Math.ceil(X1-X0),ch=Math.ceil(Y1-Y0);
 const cv=document.createElement('canvas');cv.width=cw;cv.height=ch;const cx=cv.getContext('2d');
 const jobs=[];for(let ty=Math.floor(Y0/256);ty<=Math.floor(Y1/256);ty++)for(let tx=Math.floor(X0/256);tx<=Math.floor(X1/256);tx++)jobs.push([tx,ty]);
 const N=jobs.length;let done=0,fail=0;
 const work=async()=>{while(jobs.length){const [tx,ty]=jobs.shift();if(key&&key.cancel)return;let ok=false;
  for(let t=0;t<2&&!ok;t++){try{const b=await (await getData(urlFn(zm,tx,ty),20000)).blob();const im=await createImageBitmap(b);cx.drawImage(im,tx*256-X0,ty*256-Y0);im.close&&im.close();ok=true}catch(e){}}
  if(!ok)fail++;done++;if(label&&(done%10===0||done===N)){setProg(done/N);setStatus(label[0],`${label[1]}: ${done} de ${N} teselas…`)}}};
 await Promise.all(Array.from({length:8},work));
 return {cv,N,fail,zm,mpp:(bb.n-bb.s)*M_LAT/ch};
}
const imgJobs=new WeakMap();
async function loadImagery(L){
 if(!L)return;const prev=imgJobs.get(L);if(prev)prev.cancel=true;const key={};imgJobs.set(L,key);
 if(baseKey==='none'){L.u.uUseMap.value=0;clearStatus('img'+L.kind);return}
 const B=BASES[baseKey];const lim=L.kind==='base'&&Z.big?Math.min(texLimit(),4096):texLimit();
 const sk='img'+L.kind;if(L.kind==='base')setStatus(sk,`Descargando ${B.name}…`);
 const r=await tilesToCanvas(L.bb,B.max,B.url,lim,key,L.kind==='base'?[sk,'Descargando '+B.name]:null);
 if(key.cancel||L.seq<0)return;
 const tex=new THREE.CanvasTexture(r.cv);tex.colorSpace=THREE.NoColorSpace;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 if(L.u.uMap.value!==blank)L.u.uMap.value.dispose();L.u.uMap.value=tex;L.u.uUseMap.value=1;
 if(L.kind==='base')setStatus(sk,`${B.name}: ${r.N-r.fail} de ${r.N} teselas (≈${fmt(r.mpp,1)} m por píxel)${r.fail?` · ${r.fail} fallaron: verás manchas; pulsa «Recargar»`:''}.`,r.fail?'wa':'ok');
 else if(r.fail)setStatus('imgpatch',`Detalle: ${r.fail} de ${r.N} teselas de imagen fallaron.`,'wa');
}

// ---------- OpenStreetMap (OpenFreeMap): senderos, cumbres, refugios, espacios protegidos ----------
let MVT=null,OFM_URL=null,parks=new Map();
async function mvtLib(){if(!MVT){const [a,b]=await Promise.all([import('https://cdn.jsdelivr.net/npm/@mapbox/vector-tile@2.0.3/+esm'),import('https://cdn.jsdelivr.net/npm/pbf@4.0.1/+esm')]);MVT={VectorTile:a.VectorTile,Pbf:b.default}}return MVT}
const t2ll=(tx,ty,px,py,ext,z)=>{const n=2**z,x=(tx+px/ext)/n,y=(ty+py/ext)/n;return [Math.atan(Math.sinh(Math.PI*(1-2*y)))*180/Math.PI,x*360-180]};
async function loadOSM(L,zt,wantWays){
 const seq=L.seq;const isBase=L.kind==='base';
 const myParks=new Map();
 setStatus('osm'+L.kind,isBase?'Descargando senderos, nombres y espacios protegidos (OpenStreetMap)…':'Descargando senderos del detalle…');
 try{
  const {VectorTile,Pbf}=await mvtLib();
  if(!OFM_URL)OFM_URL=(await (await getData('https://tiles.openfreemap.org/planet',15000)).json()).tiles[0];
  const n=2**zt,b=L.bb;const tx=lon=>Math.floor((lon+180)/360*n),ty=lat=>Math.floor(mY(lat,zt)/256);
  const jobs=[];for(let y=ty(b.n);y<=ty(b.s);y++)for(let x=tx(b.w);x<=tx(b.e);x++)jobs.push([x,y]);
  const N=jobs.length;let done=0,fail=0;const ways=[],pts=[];
  const work=async()=>{while(jobs.length){const [x,y]=jobs.shift();if(L.seq!==seq)return;
   try{const buf=await (await getData(OFM_URL.replace('{z}',zt).replace('{x}',x).replace('{y}',y),20000)).arrayBuffer();if(L.seq!==seq)return;const vt=new VectorTile(new Pbf(buf));
    const tr=vt.layers.transportation;if(wantWays&&tr)for(let i=0;i<tr.length;i++){const f=tr.feature(i);const c=f.properties.class;if(c!=='path'&&c!=='track')continue;
     const ext=tr.extent;for(const ring of f.loadGeometry())ways.push({k:c,g:ring.map(p=>t2ll(x,y,p.x,p.y,ext,zt))})}
    const mp=vt.layers.mountain_peak;if(mp)for(let i=0;i<mp.length;i++){const f=mp.feature(i),p=f.properties;if(!p.name||!/^(peak|volcano|saddle)$/.test(p.class))continue;
     const q=f.loadGeometry()[0][0];const [la,lo]=t2ll(x,y,q.x,q.y,mp.extent,zt);if(inBB(b,la,lo))pts.push({name:p.name,ele:p.ele,lat:la,lon:lo,t:p.class})}
    const po=vt.layers.poi;if(po)for(let i=0;i<po.length;i++){const f=po.feature(i),p=f.properties;if(!/^(alpine_hut|wilderness_hut)$/.test(p.subclass))continue;
     const q=f.loadGeometry()[0][0];const [la,lo]=t2ll(x,y,q.x,q.y,po.extent,zt);if(inBB(b,la,lo))pts.push({name:p.name||'Refugio',lat:la,lon:lo,hut:1})}
    const pk=vt.layers.park;if(isBase&&pk)for(let i=0;i<pk.length;i++){const f=pk.feature(i),p=f.properties;if(f.type!==3||!p.name)continue;const ext=pk.extent;
     let P=myParks.get(p.name);if(!P){P={name:p.name,cls:p.class,lines:[]};myParks.set(p.name,P)}
     for(const ring of f.loadGeometry()){let cur=[];const edge=q=>q.x<=0||q.x>=ext||q.y<=0||q.y>=ext;
      for(let k=0;k<ring.length;k++){const a=ring[k],c=ring[(k+1)%ring.length];
       const seam=edge(a)&&edge(c)&&((a.x<=0&&c.x<=0)||(a.x>=ext&&c.x>=ext)||(a.y<=0&&c.y<=0)||(a.y>=ext&&c.y>=ext));
       if(seam){if(cur.length>1)P.lines.push(cur);cur=[];continue}
       if(!cur.length)cur.push(t2ll(x,y,a.x,a.y,ext,zt));cur.push(t2ll(x,y,c.x,c.y,ext,zt))}
      if(cur.length>1)P.lines.push(cur)}}
   }catch(e){fail++}
   done++;if(done%6===0||done===N)setStatus('osm'+L.kind,`${isBase?'Senderos y nombres':'Detalle'}: ${done} de ${N} teselas…`)}};
  await Promise.all(Array.from({length:6},work));
  if(L.seq!==seq)return;
  if(!L.diffWays)L.ways=ways;L.pts=pts;if(isBase)parks=myParks;
  setStatus('osm'+L.kind,`OpenStreetMap${isBase?'':' (detalle)'}: ${wantWays?fmt(ways.length)+' tramos de sendero o pista, ':''}${fmt(pts.length)} nombres${isBase?`, ${fmt(parks.size)} espacios protegidos`:''}${fail?` · ${fail} de ${N} teselas fallaron`:''}.`,fail?'wa':'ok');
  if(isBase&&Z.big&&!wantWays)setStatus('osmhint','En zonas grandes los senderos aparecen al acercarte (con el detalle).','ok');
 }catch(e){if(L.seq===seq)setStatus('osm'+L.kind,'Senderos y nombres no disponibles ahora ('+esc(e.message)+'). El relieve y la imagen sí están.','wa');return}
 renderParks();drawOverlay(L);buildLabels();
}
const PARK_TXT={national_park:'parque nacional',nature_reserve:'reserva natural',protected_area:'espacio protegido',conservation:'conservación',sustainable:'uso sostenible'};
async function loadTrails(L){
 const seq=L.seq;setStatus('tr'+L.kind,'Pidiendo la dificultad de los senderos (OpenStreetMap)…');
 try{const r=await trailsWithDifficulty(L.bb);if(L.seq!==seq)return;
  L.ways=r.ways;L.diffWays=true;
  const s=trailSummary(r.ways);L.trailSum=s;renderTrailSum();
  setStatus('tr'+L.kind,`Senderos con dificultad: ${fmt(r.ways.length)} tramos (${fmt(s.total/1000,1)} km), fuente ${esc(r.src)}${r.errs.length?' (las anteriores no respondieron)':''}.`,'ok');
  drawOverlay(L)}
 catch(e){if(L.seq===seq){setStatus('tr'+L.kind,'La dificultad de los senderos no está disponible ahora ('+esc((e.errs||[e.message]).join(' · '))+'). Se ven los senderos sin dificultad.','wa');renderTrailSum()}}
}
function renderTrailSum(){const L=LP&&LP.trailSum?LP:LB;const s=L&&L.trailSum;const how=$('#selTrailCol').value;
 $('#trailLeg').innerHTML=how==='tipo'?'<span><i style="background:#d22a1e"></i>sendero</span><span><i style="background:#8a4b16"></i>pista</span>'
  :how==='sac'?[1,2,3,4,5,6].map(i=>`<span><i style="background:${DIF_COL[i-1]}"></i>${SAC_TXT[i]}</span>`).join('')+`<span><i style="background:${NODATA_COL}"></i>sin dato</span>`
  :[0,1,2,3,4,5].map(i=>`<span><i style="background:${DIF_COL[i]}"></i>${MTB_TXT[i]}</span>`).join('')+`<span><i style="background:${NODATA_COL}"></i>sin dato</span><span>· línea discontinua = estimada</span>`;
 if(!s){$('#trailSum').innerHTML='';return}
 $('#trailSum').innerHTML=`<div class="mut" style="margin-top:4px">${L===LP?'En el detalle':'En la zona'}: ${fmt(s.total/1000,1)} km de senderos y pistas. Toca uno para ver su ficha.</div>`+
  (how==='mtb'?barHTML([...[0,1,2,3,4,5].map(i=>[MTB_TXT[i],s.mtb[i],DIF_COL[i]]),['sin dato',s.mtbNone,NODATA_COL]])+`<div class="mut">${fmt(s.mtbReal/s.total*100)} % con dato de OpenStreetMap, ${fmt(s.mtbEst/s.total*100)} % estimado por el tipo de camino.</div>`
   :barHTML([...[1,2,3,4,5,6].map(i=>[SAC_TXT[i],s.sac[i],DIF_COL[i-1]]),['sin dato',s.sac[0],NODATA_COL]]))}
function renderParks(){const a=[...parks.values()];$('#parkList').innerHTML=a.length?a.map(p=>`<div>▢ ${esc(p.name)}</div>`).join(''):'<div>Sin espacios protegidos en esta zona (según OpenStreetMap).</div>'}

// ---------- Rutas señalizadas (Waymarked Trails) ----------
async function loadWmt(L){
 const lim=Math.min(texLimit(),L.kind==='base'&&Z.big?2048:4096);const key={};L.wmtKey&&(L.wmtKey.cancel=true);L.wmtKey=key;
 setStatus('wmt'+L.kind,'Descargando rutas señalizadas…');
 const [h,m]=await Promise.all([tilesToCanvas(L.bb,17,(z,x,y)=>`https://tile.waymarkedtrails.org/hiking/${z}/${x}/${y}.png`,lim,key),tilesToCanvas(L.bb,17,(z,x,y)=>`https://tile.waymarkedtrails.org/mtb/${z}/${x}/${y}.png`,lim,key)]);
 if(key.cancel||L.seq<0)return;h.cv.getContext('2d').drawImage(m.cv,0,0);L.wmt=h.cv;
 setStatus('wmt'+L.kind,`Rutas señalizadas (Waymarked Trails): ${h.N+m.N-h.fail-m.fail} de ${h.N+m.N} teselas.`,h.fail+m.fail?'wa':'ok');drawOverlay(L);
}

// ---------- Lo que se dibuja encima del relieve ----------
function drawOverlay(L){
 if(!L||!L.merc||!Z)return;
 const lim=Math.min(texLimit(),L.kind==='base'&&Z.big?2048:(MOBILE?2048:4096));const zm=L.merc.zm,W0=L.merc.X1-L.merc.X0,H0=L.merc.Y1-L.merc.Y0,sc=lim/Math.max(W0,H0);
 const cw=Math.ceil(W0*sc),ch=Math.ceil(H0*sc);
 if(!L.over||L.over.width!==cw||L.over.height!==ch){L.over=document.createElement('canvas');L.over.width=cw;L.over.height=ch;if(L.overTex){L.overTex.dispose();L.overTex=null}}
 const cx=L.over.getContext('2d');cx.clearRect(0,0,cw,ch);
 const P=(lat,lon)=>[(mX(lon,zm)-L.merc.X0)*sc,(mY(lat,zm)-L.merc.Y0)*sc];
 const mpp=(L.bb.n-L.bb.s)*M_LAT/ch;const px=m=>Math.max(1,m/mpp);let any=false;
 const line=(pts,ll)=>{cx.beginPath();pts.forEach((p,i)=>{const q=ll?ll(p):p;const [x,y]=P(q[0],q[1]);i?cx.lineTo(x,y):cx.moveTo(x,y)})};
 cx.lineCap='round';cx.lineJoin='round';
 if($('#cWmt').checked&&L.wmt){cx.globalAlpha=.85;cx.drawImage(L.wmt,0,0,cw,ch);cx.globalAlpha=1;any=true}
 if($('#cParks').checked&&parks.size){cx.setLineDash([px(60),px(30)]);for(const p of parks.values())for(const l of p.lines){line(l);cx.strokeStyle='rgba(0,0,0,.5)';cx.lineWidth=px(14)+2;cx.stroke();cx.strokeStyle='#8bff6b';cx.lineWidth=px(9)+1;cx.stroke()}cx.setLineDash([]);any=true}
 if($('#cTrails').checked&&L.ways.length){const how=L.diffWays?$('#selTrailCol').value:'tipo';
  for(const w of L.ways){const tr=w.k==='track';line(w.g);cx.setLineDash([]);cx.strokeStyle='rgba(255,255,255,.6)';cx.lineWidth=px(tr?7:6)+2;cx.stroke();
   let col,dash=[];if(how==='sac'){col=w.sac?DIF_COL[w.sac-1]:NODATA_COL}else if(how==='mtb'){col=w.mtb.l==null?NODATA_COL:DIF_COL[w.mtb.l];if(w.mtb.l!=null&&!w.mtb.real)dash=[px(16),px(7)]}
   else{col=tr?'#8a4b16':'#d22a1e';dash=tr?[]:[px(14),px(8)]}
   cx.strokeStyle=col;cx.lineWidth=px(tr?5:4.5)+1;cx.setLineDash(dash);cx.stroke()}cx.setLineDash([]);any=true}
 for(const a of acts){if(!a.vis)continue;line(a.pts);cx.strokeStyle='rgba(0,0,0,.45)';cx.lineWidth=px(9)+2;cx.stroke();cx.strokeStyle=a.color;cx.lineWidth=px(6)+1;cx.stroke();any=true}
 for(const r of routes){if(!r.vis)continue;const p=r.pts;line(p);cx.strokeStyle='rgba(0,0,0,.6)';cx.lineWidth=px(16)+3;cx.stroke();
  if(r.lv){for(let i=1;i<p.length;i++){const L_=r.lv[i];const l=r.bike?L_[1]:(L_[0]?L_[0]-1:null);cx.beginPath();const [a,b]=P(p[i-1][0],p[i-1][1]),[c,d]=P(p[i][0],p[i][1]);cx.moveTo(a,b);cx.lineTo(c,d);cx.strokeStyle=l==null?NODATA_COL:DIF_COL[l];cx.lineWidth=px(12)+1.5;cx.stroke()}}
  else{cx.strokeStyle=r.color;cx.lineWidth=px(12)+1.5;cx.stroke()}any=true}
 if(!L.overTex){L.overTex=new THREE.CanvasTexture(L.over);L.overTex.colorSpace=THREE.NoColorSpace;L.overTex.anisotropy=4}
 L.overTex.needsUpdate=true;L.u.uOver.value=L.overTex;L.u.uUseOver.value=any?1:0;
}
const redraw=()=>{drawOverlay(LB);drawOverlay(LP)};

// ---------- Sol real y sombras ----------
let sunOn=false;
function sunDate(){const d=$('#sunDate').value?new Date($('#sunDate').value+'T00:00'):new Date();d.setHours(0,0,0,0);return new Date(d.getTime()+(+$('#sunHour').value)*3600000)}
function applySun(){
 if(!sunOn||!Z){U.uNight.value=0;const a=+$('#rSun').value*Math.PI/180;U.uSun.value.set(Math.sin(a)*.75,.62,-Math.cos(a)*.75).normalize();for(const L of [LB,LP])if(L)L.u.uUseShadow.value=0;return}
 const d=sunDate();const s=sunPos(d,Z.lat,Z.lon);const az=s.az*Math.PI/180,al=s.alt*Math.PI/180;
 $('#sunHourTxt').textContent=String(Math.floor(+$('#sunHour').value)).padStart(2,'0')+':'+String(Math.round((+$('#sunHour').value%1)*60)).padStart(2,'0');
 U.uSun.value.set(Math.sin(az)*Math.cos(al),Math.max(Math.sin(al),.02),-Math.cos(az)*Math.cos(al)).normalize();U.uNight.value=s.alt<=0?1:0;
 $('#sunTxt').textContent=s.alt<=0?`El sol está bajo el horizonte (${fmt(s.alt,1)}°).`:`Sol a ${fmt(s.alt,1)}° de altura, rumbo ${fmt(s.az)}° (0° = norte). Hora de tu dispositivo.`;
 clearTimeout(applySun.t);applySun.t=setTimeout(()=>{computeShadows(LB);computeShadows(LP)},120);
}
function computeShadows(L){
 if(!L||!L.grid)return;if(!sunOn){L.u.uUseShadow.value=0;return}
 const s=sunPos(sunDate(),Z.lat,Z.lon);const g=L.grid;const st=Math.max(1,Math.ceil(Math.max(g.W,g.H)/(MOBILE?256:448)));
 const W=Math.ceil(g.W/st),H=Math.ceil(g.H/st);const out=new Uint8Array(W*H);
 if(s.alt>0){const az=s.az*Math.PI/180,tanA=Math.tan(s.alt*Math.PI/180);const dE=Math.sin(az),dN=Math.cos(az);const cellX=g.dLon*Z.mx,cellY=g.dLat*M_LAT;const maxD=Math.min(20000,(U.uHmax.value-U.uHmin.value)/Math.max(tanA,.01)+200);
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){const gi=Math.min(i*st,g.W-1),gj=Math.min(j*st,g.H-1);const h0=g.data[gj*g.W+gi]+3;let lit=255;
   for(let d=cellX*1.5;d<maxD;d*=1.12){const fi=gi+dE*d/cellX,fj=gj-dN*d/cellY;const rh=h0+d*tanA;let hh;
    if(fi>=0&&fj>=0&&fi<g.W-1&&fj<g.H-1)hh=g.data[Math.round(fj)*g.W+Math.round(fi)];else{if(L.kind==='base')break;const la=g.lat0-fj*g.dLat,lo=g.lon0+fi*g.dLon;hh=LB&&LB.grid?gridH(LB.grid,la,lo):null;if(hh==null)break}
    if(hh>rh){lit=0;break}if(rh>U.uHmax.value)break}
   out[j*W+i]=lit}}
 const tex=new THREE.DataTexture(out,W,H,THREE.RedFormat,THREE.UnsignedByteType);tex.unpackAlignment=1;tex.magFilter=tex.minFilter=THREE.LinearFilter;tex.needsUpdate=true;
 if(L.u.uShadow.value!==blank)L.u.uShadow.value.dispose();L.u.uShadow.value=tex;L.u.uUseShadow.value=1;
}

// ---------- Etiquetas y ficha de cumbre ----------
const labelsEl=$('#labels');let labels=[];
function buildLabels(){
 labelsEl.innerHTML='';labels=[];if(!LB||!LB.grid)return;const seen=new Set();
 const all=[...LB.pts,...(LP?LP.pts:[])].sort((a,b)=>(a.t==='saddle')-(b.t==='saddle')||(parseFloat(b.ele)||0)-(parseFloat(a.ele)||0));
 for(const p of all){const key=p.name+'|'+Math.round(p.lat*400)+'|'+Math.round(p.lon*400);if(seen.has(key))continue;seen.add(key);
  const h=hAt(p.lat,p.lon);if(h==null)continue;const [x,z]=toLocal(p.lat,p.lon);
  const el=document.createElement('div');el.className='lb'+(p.hut?' hut':p.t==='saddle'?' sad':'');
  const ele=p.ele&&!isNaN(parseFloat(p.ele))?Math.round(parseFloat(p.ele)):null;
  el.innerHTML=`${p.hut?'⌂ ':''}${esc(p.name)}${ele!=null?`<small>${fmt(ele)} m</small>`:''}`;el.onclick=e=>{e.stopPropagation();showCard(p,h)};
  labelsEl.appendChild(el);labels.push({el,x,z,h,vis:false})}
 labelsEl.style.display=$('#cLabels').checked?'':'none';
}
const _v=new THREE.Vector3();let lbFrame=0;
function updateLabels(){
 if(!labels.length||labelsEl.style.display==='none')return;
 const occl=(lbFrame++%6)===0;const W=innerWidth,H=innerHeight,ex=U.uExag.value,cp=camera.position,placed=[];
 for(const L of labels){_v.set(L.x,L.h*ex+4,L.z).project(camera);
  if(_v.z>1||_v.x<-1.1||_v.x>1.1||_v.y<-1.1||_v.y>1.1){if(L.vis){L.el.style.display='none';L.vis=false}continue}
  if(occl){L.hid=false;const dx=L.x-cp.x,dy=L.h*ex+15-cp.y,dz=L.z-cp.z;for(let s=1;s<24;s++){const t=s/24;const hh=hLocal(cp.x+dx*t,cp.z+dz*t);if(hh!=null&&hh*ex>cp.y+dy*t){L.hid=true;break}}}
  const sx=(_v.x+1)/2*W,sy=(1-_v.y)/2*H;let clash=L.hid;if(!clash)for(const p of placed)if(Math.abs(p[0]-sx)<90&&Math.abs(p[1]-sy)<16){clash=true;break}
  if(clash||placed.length>=60){if(L.vis){L.el.style.display='none';L.vis=false}continue}
  placed.push([sx,sy]);if(!L.vis){L.el.style.display='';L.vis=true}L.el.style.left=sx+'px';L.el.style.top=sy+'px'}
}
async function showCard(p,h){
 const ele=p.ele&&!isNaN(parseFloat(p.ele))?Math.round(parseFloat(p.ele)):null;const eleU=ele??Math.round(h);
 const kind=p.hut?'Refugio':p.t==='saddle'?'Collado':p.t==='volcano'?'Volcán':'Cumbre';
 $('#cardBody').innerHTML=`<h3>${kind}</h3><div style="font-size:16px;font-weight:700">${esc(p.name)}</div>
  <table><tr><td>Altitud</td><td>${ele!=null?fmt(ele)+' m (OpenStreetMap)':''}${ele!=null?'<br>':''}${fmt(h)} m (relieve del IGN)</td></tr>
  <tr><td>Coordenadas</td><td>${fmt(p.lat,5)}, ${fmt(p.lon,5)}</td></tr></table>
  <h3>Tiempo previsto a ${fmt(eleU)} m</h3><div id="wx" class="mut">Consultando Open-Meteo…</div>
  <div class="row"><a class="btn" href="rutas.html#hike;${p.lat.toFixed(5)},${p.lon.toFixed(5)}">⤳ Planificar ruta desde aquí</a></div>`;
 $('#card').classList.add('show');
 try{const w=await weather(p.lat,p.lon,eleU);const c=w.current,d=w.daily;
  $('#wx').innerHTML=`<div style="margin-bottom:6px"><b>Ahora:</b> ${fmt(c.temperature_2m,0)} °C (sensación ${fmt(c.apparent_temperature,0)} °C), ${wmoTxt(c.weather_code)}, viento ${fmt(c.wind_speed_10m)} km/h con rachas de ${fmt(c.wind_gusts_10m)} km/h.</div>
  <table>${d.time.map((t,i)=>`<tr><td>${new Date(t+'T12:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric'})}</td><td>${wmoTxt(d.weather_code[i])} · ${fmt(d.temperature_2m_min[i])}/${fmt(d.temperature_2m_max[i])} °C · ${fmt(d.precipitation_sum[i],1)} mm · rachas ${fmt(d.wind_gusts_10m_max[i])} km/h</td></tr>`).join('')}</table>
  <div class="mut" style="margin-top:4px">Previsión de Open-Meteo corregida a esa altitud. En montaña el tiempo cambia rápido: mira también AEMET.</div>`}
 catch(e){$('#wx').textContent='No se pudo consultar el tiempo ('+e.message+').'}
}
$('#cardX').onclick=()=>$('#card').classList.remove('show');

// ---------- Rutas (ficheros, planificador, dibujadas) ----------
const routes=[];const COLORS=['#ffe14d','#4dd2ff','#ff7bd8','#9cff6b','#ffa64d'];let routeN=0;
function addRoute(r){r.id=++routeN;r.vis=true;r.color=r.color||COLORS[(routeN-1)%COLORS.length];routes.push(r);renderRouteList();redraw();return r}
function routeInside(r){return Z&&Z.bb&&r.pts.every(p=>inBB(Z.bb,p[0],p[1]))}
async function zoneFor(pts,name){const b=bboxOf(pts);const lat=(b.s+b.n)/2,lon=(b.w+b.e)/2;const ext=Math.max((b.n-b.s)*M_LAT,(b.e-b.w)*mLon(lat))/1000*1.2;
 const o=[...$('#selSize').options].map(o=>+o.value);const size=o.find(v=>v>=ext)||o[o.length-1];$('#selSize').value=size;
 if(ext>60)setStatus('rt2','La ruta mide más de 60 km de lado: se muestra la parte central.','wa');
 await loadZone({name,sub:'ruta',lat,lon,size})}
async function addRouteFiles(files){let ok=0,first=null;const errs=[];
 for(const f of files){try{const r=await readRouteFile(f);const R=addRoute({name:r.name,pts:r.pts,kind:'file',sport:r.sport});ok++;first=first||R}catch(e){errs.push(f.name+': '+e.message)}}
 setStatus('rt',`Rutas: ${ok} de ${files.length} cargadas.${errs.length?' Fallos → '+errs.map(esc).join(' · '):''}`,errs.length?'wa':'ok');
 if(first){if(!routeInside(first))await zoneFor(first.pts,first.name);selectRoute(first)}}
function renderRouteList(){
 $('#routeList').innerHTML=routes.map(r=>{const N=routeNumbers(r.pts);return `<div class="route"><label><input type="checkbox" data-r="${r.id}" ${r.vis?'checked':''}><span class="sw" style="background:${r.lv?'linear-gradient(90deg,#2e7d32,#fbc02d,#e53935)':r.color}"></span>${esc(r.name)}</label>
  <span class="mut">${fmt(N.D/1000,1)} km${N.mx!=null?' · +'+fmt(N.up)+' m':''}</span><button class="btn" data-go="${r.id}" title="Ver perfil">⌖</button><button class="btn" data-del="${r.id}" title="Quitar">✕</button></div>`}).join('')+(routes.some(r=>r.lv)?`<div class="mut" style="margin-top:4px">Las rutas con degradado van coloreadas por dificultad: verde fácil → rojo difícil, gris sin dato.</div>`:'');
}
$('#routeList').addEventListener('change',e=>{const id=+e.target.dataset.r;const r=routes.find(x=>x.id===id);if(r){r.vis=e.target.checked;redraw()}});
$('#routeList').addEventListener('click',async e=>{const g=+e.target.dataset.go,d=+e.target.dataset.del;
 if(g){const r=routes.find(x=>x.id===g);if(!routeInside(r))await zoneFor(r.pts,r.name);selectRoute(r)}
 if(d){const i=routes.findIndex(x=>x.id===d);if(i>=0){if(sel===routes[i])closeProf();if(routes[i]===draw.route)draw.route=null;routes.splice(i,1);renderRouteList();redraw()}}});
$('#fRoute').addEventListener('change',e=>{if(e.target.files.length)addRouteFiles([...e.target.files]);e.target.value=''});
let dragN=0;
addEventListener('dragenter',e=>{e.preventDefault();dragN++;$('#drop').classList.add('show')});
addEventListener('dragleave',()=>{dragN--;if(dragN<=0)$('#drop').classList.remove('show')});
addEventListener('dragover',e=>e.preventDefault());
addEventListener('drop',e=>{e.preventDefault();dragN=0;$('#drop').classList.remove('show');const f=[...e.dataTransfer.files].filter(f=>/\.(gpx|kml|kmz|tcx|fit)$/i.test(f.name));if(f.length)addRouteFiles(f);else setStatus('rt','Solo se admiten GPX, KML, KMZ, TCX o FIT.','wa')});

// ---------- Perfil de la ruta seleccionada + marcador 3D + sobrevuelo ----------
let sel=null,selN=null,geo=null;
const mk=new THREE.Group();const mkS=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),new THREE.MeshBasicMaterial({color:0xffeb3b,depthTest:false}));mkS.renderOrder=10;
const mkL=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0,1,0)]),new THREE.LineBasicMaterial({color:0xffeb3b,depthTest:false}));mkL.renderOrder=10;
mk.add(mkS,mkL);mk.visible=false;scene.add(mk);let mkIdx=null;
async function selectRoute(r){sel=r;fly.d=0;stopFly();
 if(!r.ign){r.ign=true;setStatus('ele','Leyendo la altitud del IGN (MDT 25 m) para las cifras de la ruta…');
  try{const e=await eleIGN(r.pts);r.eleSrc=e.src;setStatus('ele','Cifras calculadas con '+esc(e.src)+(e.note?' · '+esc(e.note):'')+'.','ok')}
  catch(e){for(const p of r.pts)if(p[2]==null||isNaN(p[2])){const h=hAt(p[0],p[1]);if(h!=null)p[2]=h}r.eleSrc='altitud del fichero o del relieve cargado';setStatus('ele','No se pudo leer el MDT del IGN ('+esc(e.message)+'): las cifras usan la altitud del fichero.','wa')}
  if(sel!==r)return}
 selN=routeNumbers(r.pts);$('#profName').textContent=r.name;
 $('#profStats').textContent=`${fmt(selN.D/1000,2)} km · +${fmt(selN.up)} / −${fmt(selN.dn)} m${selN.mx!=null?' · máx '+fmt(selN.mx)+' m':''}${r.watch?` · reloj: ${fmt(r.watch.dist/1000,2)} km, +${fmt(r.watch.asc)} m`:''}`;
 $('#profile').classList.add('show');document.body.classList.add('prof');drawProf();
}
function drawProf(hx){geo=drawProfile($('#pc'),sel&&sel.pts,selN,{hx,lv:sel&&sel.lv,bike:sel&&sel.bike})}
function closeProf(){stopFly();sel=null;$('#profile').classList.remove('show');document.body.classList.remove('prof');mk.visible=false;$('#tip').style.display='none'}
$('#bProfX').onclick=closeProf;
function placeMarker(i){if(!sel)return;mkIdx=i;const p=sel.pts[i];const [x,z]=toLocal(p[0],p[1]);const h=(p[2]??hAt(p[0],p[1])??0)*U.uExag.value;
 mk.position.set(x,h,z);const s=Math.max(4,camera.position.distanceTo(mk.position)*0.006);mkS.scale.setScalar(s);mkL.scale.set(1,s*12,1);mk.visible=true}
const pcv=$('#pc');
function profPoint(clientX){if(!sel||!geo)return null;const r=pcv.getBoundingClientRect();return profileIndex(geo,selN,clientX-r.left)}
pcv.addEventListener('pointermove',e=>{const i=profPoint(e.clientX);if(i==null)return;stopFly();
 const p=sel.pts[i];const d=selN.cum[i];const s=selN.sl.find(s=>d>=s[0]&&d<=s[1]);drawProf(geo.X(d));placeMarker(i);
 const tip=$('#tip');tip.style.display='block';tip.style.left=Math.min(e.clientX+12,innerWidth-200)+'px';tip.style.top=(pcv.getBoundingClientRect().top-28)+'px';
 tip.textContent=`km ${fmt(d/1000,2)} · ${p[2]!=null?fmt(p[2])+' m':''}${s?' · '+fmt(s[2])+' %':''}`});
pcv.addEventListener('pointerleave',()=>{$('#tip').style.display='none';if(!fly.on){drawProf()}});
pcv.addEventListener('click',e=>{const i=profPoint(e.clientX);if(i==null)return;const p=sel.pts[i];const [x,z]=toLocal(p[0],p[1]);const h=(p[2]??0)*U.uExag.value;
 const off=camera.position.clone().sub(controls.target);controls.target.set(x,h,z);camera.position.copy(controls.target).add(off);controls.update()});
const fly={on:false,d:0,last:0};
function startFly(){if(!sel)return;fly.on=true;fly.d=fly.d>=selN.D-1?0:fly.d;fly.last=performance.now();$('#bFly').textContent='⏸ Pausa'}
function stopFly(){if(!fly.on)return;fly.on=false;$('#bFly').textContent='▶ Sobrevolar'}
$('#bFly').onclick=()=>fly.on?stopFly():startFly();
canvas.addEventListener('pointerdown',()=>stopFly());
function idxAt(d){const c=selN.cum;let lo=0,hi=c.length-1;while(lo<hi){const m=(lo+hi)>>1;if(c[m]<d)lo=m+1;else hi=m}return lo}
function ptAt(d){const i=idxAt(d);const p=sel.pts[i];const [x,z]=toLocal(p[0],p[1]);return new THREE.Vector3(x,(p[2]??0)*U.uExag.value,z)}
function stepFly(now){
 const dt=Math.min(.1,(now-fly.last)/1000);fly.last=now;fly.d+=dt*120*(+$('#flySpeed').value);
 if(fly.d>=selN.D){fly.d=selN.D;stopFly()}
 const p=ptAt(fly.d),ahead=ptAt(Math.min(selN.D,fly.d+300)),back=ptAt(Math.max(0,fly.d-300));
 const dir=ahead.clone().sub(back);dir.y=0;if(dir.lengthSq()<1)dir.set(0,0,-1);dir.normalize();
 const want=p.clone().addScaledVector(dir,-650);want.y=Math.max(p.y,(hLocal(want.x,want.z)??0)*U.uExag.value)+380;
 controls.target.lerp(p,.12);camera.position.lerp(want,.06);
 const i=idxAt(fly.d);placeMarker(i);drawProf(geo?geo.X(selN.cum[i]):null);
}

// ---------- Dibujar una ruta sobre el relieve ----------
const draw={on:false,wps:[],route:null,seq:0,res:null};const wpGroup=new THREE.Group();scene.add(wpGroup);
function pick(clientX,clientY){const v=new THREE.Vector2(clientX/innerWidth*2-1,-(clientY/innerHeight)*2+1);const ray=new THREE.Raycaster();ray.setFromCamera(v,camera);
 const o=ray.ray.origin,d=ray.ray.direction,ex=U.uExag.value,stp=Math.max(5,Z.size*1.5);let prev=null;
 for(let t=0;t<Z.size*5000;t+=stp){const x=o.x+d.x*t,y=o.y+d.y*t,z=o.z+d.z*t;const h=hLocal(x,z);if(h!=null&&h*ex>=y){
   let a=prev??t-stp,b=t;for(let k=0;k<12;k++){const m=(a+b)/2;const hm_=hLocal(o.x+d.x*m,o.z+d.z*m);if(hm_!=null&&hm_*ex>=o.y+d.y*m)b=m;else a=m}
   return toLatLon(o.x+d.x*b,o.z+d.z*b)}prev=t}return null}
function setDraw(on){draw.on=on;$('#bDraw').textContent=on?'■ Terminar':'✎ Empezar a dibujar';$('#bDraw').classList.toggle('on',on);$('#drawHint').style.display=on?'block':'none';
 ['bDrawUndo','bDrawLoop','bDrawClear'].forEach(i=>$('#'+i).disabled=!on&&!draw.wps.length);if(on)document.querySelectorAll('.pn').forEach(x=>x.classList.remove('open'))}
$('#bDraw').onclick=()=>setDraw(!draw.on);
$('#bDrawUndo').onclick=()=>{draw.wps.pop();drawRouteUpdate()};
$('#bDrawLoop').onclick=()=>{if(draw.wps.length>1){draw.wps.push(draw.wps[0].slice());drawRouteUpdate()}};
$('#bDrawClear').onclick=()=>{draw.wps=[];drawRouteUpdate()};
$('#drawMode').onchange=()=>drawRouteUpdate();
let tap=null;
canvas.addEventListener('pointerdown',e=>{tap={x:e.clientX,y:e.clientY,t:performance.now()}});
canvas.addEventListener('pointerup',e=>{if(!tap||!Z||!LB)return;if(Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>6||performance.now()-tap.t>500)return;
 const ll=pick(e.clientX,e.clientY);if(!ll)return;
 if(draw.on){draw.wps.push(ll);drawRouteUpdate();return}
 if($('#cTrails').checked)trailCard(ll)});
function segDist(p,a,b){const kx=mLon(p[0]);const ax=(a[1]-p[1])*kx,ay=(a[0]-p[0])*M_LAT,bx=(b[1]-p[1])*kx,by=(b[0]-p[0])*M_LAT;const dx=bx-ax,dy=by-ay;const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/((dx*dx+dy*dy)||1)));return Math.hypot(ax+t*dx,ay+t*dy)}
function trailCard(ll){const tol=Math.max(20,camera.position.distanceTo(controls.target)*0.012);let best=null,bd=tol;
 for(const L of [LP,LB]){if(!L||!L.ways)continue;for(const w of L.ways){const g=w.g;for(let i=1;i<g.length;i++){const d=segDist(ll,g[i-1],g[i]);if(d<bd){bd=d;best=w}}}if(best)break}
 if(!best)return;
 if(!best.mtb){$('#cardBody').innerHTML=`<h3>${best.k==='track'?'Pista':'Sendero'}</h3><div class="mut">Sin datos de dificultad: la fuente con dificultad no respondió para esta zona.</div>`;$('#card').classList.add('show');return}
 $('#cardBody').innerHTML=`<h3>${best.k==='track'?'Pista':best.k==='steps'?'Escalones':'Sendero'}</h3><div style="font-size:15px;font-weight:700">${esc(best.tags.name||best.tags.ref||'Sin nombre')}</div>`+trailCardHTML(best);
 $('#card').classList.add('show')}
const WPG=new THREE.SphereGeometry(1,12,8),WPM=[0x1a9c3d,0xffffff,0xc62828].map(c=>new THREE.MeshBasicMaterial({color:c,depthTest:false}));
function drawWps3D(){wpGroup.clear();const ex=U.uExag.value;draw.wps.forEach((w,i)=>{const [x,z]=toLocal(w[0],w[1]);const h=(hAt(w[0],w[1])??0)*ex;
 const m=new THREE.Mesh(WPG,WPM[i===0?0:i===draw.wps.length-1?2:1]);m.renderOrder=11;m.position.set(x,h,z);m.userData.wp=true;wpGroup.add(m)})}
async function drawRouteUpdate(){
 const my=++draw.seq;drawWps3D();['bDrawUndo','bDrawLoop','bDrawClear'].forEach(i=>$('#'+i).disabled=!draw.wps.length&&!draw.on);
 if(draw.wps.length<2){if(draw.route){routes.splice(routes.indexOf(draw.route),1);if(sel===draw.route)closeProf();draw.route=null;renderRouteList();redraw()}
  $('#drawReport').innerHTML='';$('#drawMsg').textContent=draw.wps.length?'Toca el siguiente punto.':'La ruta sigue los caminos reales (BRouter) y te dice distancia, desnivel, dificultad y si vale para la actividad.';return}
 const mode=$('#drawMode').value;$('#drawMsg').textContent='Calculando la ruta por caminos…';
 let r;try{r=await routeBR(draw.wps,mode)}catch(e){if(my!==draw.seq)return;const b=(e.body||'').toLowerCase();
  $('#drawMsg').innerHTML=`<div class="w er">${e.status===500&&/not found|no route|target|position/.test(b)?'No hay camino entre esos puntos para esta actividad. Acerca los puntos a un camino.':'No se pudo calcular la ruta ('+esc(e.message)+').'}</div>`;return}
 if(my!==draw.seq)return;
 r.eleSrc='BRouter (satélite SRTM, menos precisa)';try{const e=await eleIGN(r.pts);r.eleSrc=e.src;r.eleNote=e.note}catch(e){r.eleNote='No se pudo leer el MDT del IGN ('+e.message+'): se usa la altitud de BRouter.'}
 if(my!==draw.seq)return;
 r.far=draw.wps.map((w,i)=>[i,Math.min(...r.pts.map(p=>dist(w,p)))]).filter(x=>x[1]>150);
 const rep=routeReport(r,mode);draw.res=r;
 const lv=r.noDiff?null:levelsPerPoint(r.pts,rep.N.cum,r.segs,r.brLen).map(l=>[l[0],l[1]]);
 const name='Ruta dibujada ('+MODES[mode].name+')';
 if(draw.route){Object.assign(draw.route,{name,pts:r.pts,lv,bike:MODES[mode].bike,ign:true});renderRouteList();redraw()}else draw.route=addRoute({name,pts:r.pts,lv,bike:MODES[mode].bike,kind:'drawn',ign:true});
 $('#drawMsg').textContent='';
 $('#drawReport').innerHTML=rep.html+`<div class="row"><button class="btn p" id="bDrawGpx">⬇ GPX para el GPS</button><a class="btn" href="rutas.html#${mode};${draw.wps.map(p=>p[0].toFixed(5)+','+p[1].toFixed(5)).join(';')}">Abrir en el planificador</a></div>`;
 $('#bDrawGpx').onclick=()=>{const n=name+' '+new Date().toISOString().slice(0,10);download(safeName(n)+'.gpx',gpxText(n,r.pts,mode==='hike'?'hiking':'mountain_biking'),'application/gpx+xml')};
 selectRoute(draw.route);
}

// ---------- Actividades del Garmin ----------
const acts=[];const SPORT_COL=s=>/Bici/.test(s||'')?'#2979ff':/Carrera/.test(s||'')?'#ff1744':/Senderismo|Caminata|Alpinismo|Raquetas/.test(s||'')?'#ff9100':'#d500f9';
function simplify(pts,m=8){const out=[pts[0]];let last=pts[0];for(let i=1;i<pts.length-1;i++)if(dist(last,pts[i])>=m){out.push(pts[i]);last=pts[i]}out.push(pts[pts.length-1]);return out}
async function loadActs(files){
 files=files.filter(f=>/\.(fit|gpx|tcx)$/i.test(f.name));if(!files.length){$('#actMsg').textContent='No hay ficheros FIT, GPX o TCX en lo elegido.';return}
 let ok=0,noGps=0,bad=0;
 for(let i=0;i<files.length;i++){const f=files[i];if(i%5===0){$('#actMsg').textContent=`Leyendo ${i+1} de ${files.length}…`;await new Promise(r=>setTimeout(r))}
  try{const r=await readRouteFile(f);if(r.pts.length<2){noGps++;continue}
   const pts=simplify(r.pts);acts.push({name:r.name,date:r.date,sport:r.sport||'Actividad',pts,bb:bboxOf(pts),color:SPORT_COL(r.sport),vis:false,watch:r.dist?{dist:r.dist,asc:r.asc}:null});ok++}
  catch(e){if(/puntos/.test(e.message))noGps++;else bad++}}
 acts.sort((a,b)=>(b.date||0)-(a.date||0));
 $('#actMsg').textContent=`${files.length} ficheros: ${ok} actividades con GPS, ${noGps} sin GPS (gimnasio, pádel…), ${bad} que no se pudieron leer.`;
 ['bActZone','bActNone'].forEach(i=>$('#'+i).disabled=!acts.length);$('#qAct').style.display=acts.length?'':'none';$('#actList').style.display=acts.length?'':'none';renderActs();
}
function renderActs(){const q=$('#qAct').value.trim().toLowerCase();
 const list=acts.map((a,i)=>[a,i]).filter(([a])=>!q||((a.date?a.date.toISOString().slice(0,10):'')+' '+a.sport+' '+a.name).toLowerCase().includes(q)).slice(0,300);
 $('#actList').innerHTML=list.map(([a,i])=>`<div class="it" data-a="${i}"><span><input type="checkbox" data-av="${i}" ${a.vis?'checked':''}> <span class="sw" style="background:${a.color}"></span>${a.date?a.date.toLocaleDateString('es-ES'):'—'} · ${esc(a.sport)}</span><small>${a.watch?fmt(a.watch.dist/1000,1)+' km · +'+fmt(a.watch.asc)+' m':''}</small></div>`).join('')}
$('#qAct').oninput=renderActs;
$('#fAct').onchange=e=>{loadActs([...e.target.files]);e.target.value=''};
$('#fActDir').onchange=e=>{loadActs([...e.target.files]);e.target.value=''};
$('#actList').addEventListener('click',async e=>{const v=e.target.dataset.av;if(v!=null){acts[+v].vis=e.target.checked;redraw();return}
 const it=e.target.closest('.it');if(!it)return;const a=acts[+it.dataset.a];a.vis=true;
 const R={name:`${a.sport} ${a.date?a.date.toLocaleDateString('es-ES'):''}`,pts:a.pts.map(p=>p.slice()),watch:a.watch};
 if(!(Z&&Z.bb&&a.pts.every(p=>inBB(Z.bb,p[0],p[1]))))await zoneFor(a.pts,R.name);
 renderActs();redraw();selectRoute(R);document.querySelectorAll('.pn').forEach(x=>x.classList.remove('open'))});
$('#bActZone').onclick=()=>{if(!Z)return;let n=0;for(const a of acts){const b=a.bb;a.vis=!(b.n<Z.bb.s||b.s>Z.bb.n||b.e<Z.bb.w||b.w>Z.bb.e);if(a.vis)n++}
 $('#actMsg').textContent=`${n} actividades pasan por esta zona.`;renderActs();redraw()};
$('#bActNone').onclick=()=>{acts.forEach(a=>a.vis=false);renderActs();redraw()};

// ---------- Paneles y controles ----------
document.querySelectorAll('#bar button[data-p]').forEach(b=>b.addEventListener('click',()=>{const p=$('#'+b.dataset.p);const open=!p.classList.contains('open');
 document.querySelectorAll('.pn').forEach(x=>x.classList.remove('open'));document.querySelectorAll('#bar button').forEach(x=>x.classList.remove('on'));
 if(open){p.classList.add('open');b.classList.add('on');if(b.dataset.p==='pMas'){updateShare();renderSaved()}}}));
canvas.addEventListener('pointerdown',()=>{document.querySelectorAll('.pn').forEach(x=>x.classList.remove('open'));document.querySelectorAll('#bar button').forEach(x=>x.classList.remove('on'))});
$('#bPlan').onclick=()=>{location.href='rutas.html'+(Z?`#ver;${Z.lat.toFixed(5)},${Z.lon.toFixed(5)}`:'')};
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
function renderCat(f=''){f=norm(f.trim());let h='';
 CAT.forEach(([g,items],gi)=>{const its=items.map((it,ii)=>[it,ii]).filter(([it])=>!f||norm(g+' '+it[0]+' '+it[1]).includes(f));if(!its.length)return;
  h+=`<div class="g">${g}</div>`+its.map(([it,ii])=>`<div class="it" data-c="${gi},${ii}"><span>${esc(it[0])}</span><small>${esc(it[1])}</small></div>`).join('')});
 $('#catList').innerHTML=h||'<p class="mut" style="padding:8px">Nada en el catálogo. Usa el buscador de arriba.</p>'}
renderCat();$('#qCat').oninput=e=>renderCat(e.target.value);renderTrailSum();
const nearestSize=s=>{const o=[...$('#selSize').options].map(o=>+o.value);return o.find(v=>v>=s)||o[o.length-1]};
const closePanels=()=>document.querySelectorAll('.pn').forEach(x=>x.classList.remove('open'));
$('#catList').onclick=e=>{const it=e.target.closest('.it');if(!it)return;const [gi,ii]=it.dataset.c.split(',').map(Number);const c=CAT[gi][1][ii];
 $('#selSize').value=nearestSize(c[4]);loadZone({name:c[0],sub:c[1],lat:c[2],lon:c[3],size:+$('#selSize').value});closePanels()};
$('#fSearch').onsubmit=async e=>{e.preventDefault();const q=$('#qSearch').value.trim();if(!q)return;$('#searchRes').innerHTML='<p class="mut">Buscando…</p>';
 try{const j=await (await fetchT('https://nominatim.openstreetmap.org/search?format=json&limit=8&countrycodes=es&accept-language=es&q='+encodeURIComponent(q),15000)).json();
  $('#searchRes').innerHTML=j.length?'<div class="list">'+j.map((r,i)=>`<div class="it" data-s="${i}"><span>${esc(r.display_name.split(',').slice(0,3).join(','))}</span><small>${esc(r.type)}</small></div>`).join('')+'</div>':'<p class="mut">Sin resultados en España.</p>';
  $('#searchRes').onclick=ev=>{const it=ev.target.closest('.it');if(!it)return;const r=j[+it.dataset.s];loadZone({name:r.display_name.split(',')[0],sub:r.display_name.split(',').slice(1,3).join(',').trim(),lat:+r.lat,lon:+r.lon,size:+$('#selSize').value});closePanels()}}
 catch(err){$('#searchRes').innerHTML='<p class="mut">El buscador (Nominatim) no responde: '+esc(err.message)+'</p>'}};
document.querySelectorAll('[data-mv]').forEach(b=>b.onclick=()=>{if(!Z)return;const [dx,dy]=b.dataset.mv.split(',').map(Number);const st=Z.size*500;
 loadZone({name:Z.name,sub:'desplazado',lat:Z.lat+dy*st/M_LAT,lon:Z.lon+dx*st/Z.mx,size:Z.size})});
$('#bReload').onclick=()=>{if(Z)loadZone({name:Z.name,sub:Z.sub,lat:Z.lat,lon:Z.lon,size:+$('#selSize').value})};
$('#selSize').onchange=()=>{if(Z)loadZone({name:Z.name,sub:Z.sub,lat:Z.lat,lon:Z.lon,size:+$('#selSize').value})};
$('#selDem').onchange=()=>{if(Z)loadZone({name:Z.name,sub:Z.sub,lat:Z.lat,lon:Z.lon,size:Z.size})};
document.querySelectorAll('input[name=base]').forEach(r=>r.onchange=()=>{baseKey=r.value;loadImagery(LB);if(LP)loadImagery(LP);updateShare()});
$('#cHiTex').onchange=()=>{loadImagery(LB);if(LP)loadImagery(LP);redraw()};
$('#cShade').onchange=e=>U.uShade.value=e.target.checked?1:0;
$('#cHypso').onchange=e=>U.uHypso.value=e.target.checked?1:0;
$('#cSlope').onchange=e=>{U.uSlope.value=e.target.checked?1:0;$('#slopeLeg').style.display=e.target.checked?'':'none'};
$('#cCont').onchange=e=>U.uCont.value=e.target.checked?1:0;
$('#selCont').onchange=e=>{U.uContInt.value=+e.target.value;$('#cCont').checked=true;U.uCont.value=1};
$('#cTrails').onchange=redraw;$('#selTrailCol').onchange=()=>{renderTrailSum();redraw()};$('#cParks').onchange=redraw;
$('#cWmt').onchange=e=>{if(e.target.checked){if(LB&&!LB.wmt)loadWmt(LB);if(LP&&!LP.wmt)loadWmt(LP)}redraw()};
$('#cLabels').onchange=e=>labelsEl.style.display=e.target.checked?'':'none';
$('#rExag').oninput=e=>{const v=+e.target.value,r=v/U.uExag.value;U.uExag.value=v;$('#vExag').textContent=fmt(v,1)+'×';controls.target.y*=r;camera.position.y*=r;controls.update();drawWps3D()};
$('#rSun').oninput=applySun;
$('#cSun').onchange=e=>{sunOn=e.target.checked;$('#sunBox').style.display=sunOn?'':'none';$('#lightRow').style.display=sunOn?'none':'';if(sunOn&&!$('#sunDate').value)setNow();applySun()};
function setNow(){const d=new Date();$('#sunDate').value=d.toISOString().slice(0,10);$('#sunHour').value=Math.round((d.getHours()+d.getMinutes()/60)*4)/4}
$('#bNow').onclick=()=>{setNow();applySun()};$('#sunDate').onchange=applySun;$('#sunHour').oninput=applySun;
$('#bFull').onclick=async()=>{try{document.fullscreenElement?await document.exitFullscreen():await document.documentElement.requestFullscreen()}catch(e){setStatus('fs','Este navegador no permite pantalla completa aquí.','wa')}};
$('#compass').onclick=()=>{const t=controls.target,p=camera.position;const d=Math.hypot(p.x-t.x,p.z-t.z);camera.position.set(t.x,p.y,t.z+d);controls.update()};
$('#bTop').onclick=()=>{const t=controls.target;const d=camera.position.distanceTo(t);camera.position.set(t.x,t.y+d,t.z+1);controls.update()};
canvas.addEventListener('dblclick',e=>{if(draw.on||!Z)return;const ll=pick(e.clientX,e.clientY);if(!ll)return;
 loadZone({name:'Zona elegida',sub:`${fmt(ll[0],4)}, ${fmt(ll[1],4)}`,lat:ll[0],lon:ll[1],size:Z.size})});

// ---------- Compartir ----------
function updateShare(){if(!Z)return;const t=controls.target,p=camera.position;
 history.replaceState(null,'',`#${Z.lat.toFixed(5)},${Z.lon.toFixed(5)},${Z.size},${baseKey},${encodeURIComponent(Z.name)},${[p.x,p.y,p.z,t.x,t.y,t.z].map(v=>Math.round(v)).join(',')}`);$('#shareUrl').value=location.href}
$('#bCopy').onclick=async()=>{updateShare();try{await navigator.clipboard.writeText($('#shareUrl').value);$('#bCopy').textContent='Copiado'}catch(e){$('#shareUrl').select();$('#bCopy').textContent='Cópialo a mano'}setTimeout(()=>$('#bCopy').textContent='Copiar',2000)};
controls.addEventListener('end',()=>{clearTimeout(updateShare.t);updateShare.t=setTimeout(updateShare,600)});

// ---------- Sin conexión ----------
const SAVED='sherpa-zonas',CACHE_SAVE='sherpa-guardado';
const getSaved=()=>{try{return JSON.parse(localStorage.getItem(SAVED)||'[]')}catch(e){return []}};
async function renderSaved(){const s=getSaved();
 $('#savedList').innerHTML=s.length?'<div class="list" style="margin-top:6px">'+s.map((z,i)=>`<div class="it" data-z="${i}"><span>${esc(z.name)}</span><small>${z.size} km · ${new Date(z.date).toLocaleDateString('es-ES')}</small></div>`).join('')+'</div>':'';
 try{const e=await navigator.storage.estimate();$('#storeTxt').textContent=`Ocupado en este dispositivo: ${fmt(e.usage/1048576,0)} MB.`}catch(_){}}
$('#savedList').onclick=e=>{const it=e.target.closest('.it');if(!it)return;const z=getSaved()[+it.dataset.z];$('#selSize').value=z.size;if(z.res)$('#selDem').value=z.res;$('#cHiTex').checked=!!z.hiTex;
 if(z.base){baseKey=z.base;const r=document.querySelector(`input[name=base][value="${z.base}"]`);r&&(r.checked=true)}loadZone({name:z.name,lat:z.lat,lon:z.lon,size:z.size});closePanels()};
$('#bSave').onclick=async()=>{if(!Z)return;if(!('caches' in window)){setStatus('save','Este navegador no permite guardar datos para usar sin conexión.','wa');return}
 try{await navigator.storage.persist()}catch(_){}
 const urls=[...zoneUrls];let ok=0,fail=0;const c=await caches.open(CACHE_SAVE);setStatus('save',`Guardando ${urls.length} ficheros de la zona…`);
 for(let i=0;i<urls.length;i++){const u=urls[i];try{let r=await caches.match(u);if(!r){r=await fetch(u);if(!r.ok)throw 0}await c.put(u,r.clone());ok++}catch(e){fail++}if(i%25===0){setProg(i/urls.length)}}
 const s=getSaved().filter(z=>!(z.lat===Z.lat&&z.lon===Z.lon&&z.size===Z.size));s.unshift({name:Z.name,lat:Z.lat,lon:Z.lon,size:Z.size,res:Z.res,hiTex:Z.hiTex,base:baseKey,date:Date.now()});try{localStorage.setItem(SAVED,JSON.stringify(s.slice(0,30)))}catch(_){}
 setStatus('save',`Zona guardada para usar sin conexión: ${ok} de ${urls.length} ficheros${fail?` (${fail} no se pudieron guardar)`:''}.`,fail?'wa':'ok');renderSaved()};
$('#bClearCache').onclick=async()=>{try{await caches.delete(CACHE_SAVE);await caches.delete('sherpa-auto');localStorage.removeItem(SAVED)}catch(_){}setStatus('save','Datos guardados borrados.','ok');renderSaved()};
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(e=>setStatus('sw','El modo sin conexión no se pudo activar ('+esc(e.message)+').','wa'));

// ---------- Bucle ----------
let lastPatch=0;
function loop(now){requestAnimationFrame(loop);
 if(fly.on&&sel)stepFly(now);controls.update();
 const az=Math.atan2(camera.position.x-controls.target.x,camera.position.z-controls.target.z);$('#compass span').style.transform=`rotate(${-90+az*180/Math.PI}deg)`;
 if(mk.visible&&mkIdx!=null&&!fly.on)placeMarker(mkIdx);
 const s=Math.max(3,camera.position.distanceTo(controls.target)*0.004);wpGroup.children.forEach(m=>m.scale.setScalar(s));
 renderer.render(scene,camera);updateLabels();
 if(now-lastPatch>900){lastPatch=now;checkPatch()}}
resize();requestAnimationFrame(loop);

// ---------- Arranque ----------
(function start(){
 const raw=decodeURIComponent(location.hash.slice(1));
 if(raw==='ruta'){let r=null;try{r=JSON.parse(localStorage.getItem('montanas3d-ruta')||'null')}catch(e){}
  if(r&&r.pts&&r.pts.length>1){const pts=r.pts.map(p=>[p[0],p[1],p[2]]);const lv=r.pts[0].length>=5?r.pts.map(p=>[p[3],p[4]]):null;
   const R=addRoute({name:r.name||'Ruta',pts,lv,bike:!!r.bike,kind:'planner',ign:true});zoneFor(pts,R.name).then(()=>selectRoute(R));return}
  setStatus('rt','No llegó ninguna ruta desde el planificador.','wa')}
 const h=raw.split(',');
 if(h.length>=3&&!isNaN(+h[0])&&!isNaN(+h[1])&&h[0]!==''){
  if(BASES[h[3]]||h[3]==='none'){baseKey=h[3];const r=document.querySelector(`input[name=base][value="${h[3]}"]`);r&&(r.checked=true)}
  const size=nearestSize(+h[2]||12);$('#selSize').value=size;const z={name:h[4]||'Zona compartida',lat:+h[0],lon:+h[1],size};
  if(h.length>=11){const v=h.slice(5,11).map(Number);if(v.every(x=>!isNaN(x)))z.view={p:v.slice(0,3),t:v.slice(3,6)}}
  loadZone(z);return}
 const c=CAT[4][1][0];loadZone({name:c[0],sub:c[1],lat:c[2],lon:c[3],size:c[4]});
})();

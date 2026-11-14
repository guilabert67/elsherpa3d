// El Sherpa 3D · funciones comunes del visor 3D y del planificador de rutas.
// Todo lo que calcula cifras (distancia, desnivel, pendientes, tiempos, dificultad) está aquí,
// para que las dos páginas den exactamente lo mismo.

export const fmt=(n,d=0)=>(n==null||isNaN(n))?'—':n.toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d});
export const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export async function fetchT(url,ms=30000,opt={}){
 if(!opt.method&&globalThis.__sherpaRec)globalThis.__sherpaRec(url);
 const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);
 try{const r=await fetch(url,{...opt,signal:c.signal});if(!r.ok){const e=new Error('HTTP '+r.status);e.status=r.status;e.body=await r.text().catch(()=>'');throw e}return r}
 catch(e){if(e.name==='AbortError'){const x=new Error('sin respuesta en '+Math.round(ms/1000)+' s');x.timeout=true;throw x}throw e}
 finally{clearTimeout(t)}
}
export const M_LAT=110574, mLon=lat=>111320*Math.cos(lat*Math.PI/180);
export const dist=(a,b)=>Math.hypot((b[0]-a[0])*M_LAT,(b[1]-a[1])*mLon((a[0]+b[0])/2));
export const mX=(lon,z)=>(lon+180)/360*256*2**z;
export const mY=(lat,z)=>{const s=Math.sin(lat*Math.PI/180);return (.5-Math.log((1+s)/(1-s))/(4*Math.PI))*256*2**z};
export const hm=t=>{let h=Math.floor(t),m=Math.round((t-h)*60);if(m===60){h++;m=0}return `${h} h ${String(m).padStart(2,'0')} min`};
export const bboxOf=pts=>{let s=90,n=-90,w=180,e=-180;for(const p of pts){if(p[0]<s)s=p[0];if(p[0]>n)n=p[0];if(p[1]<w)w=p[1];if(p[1]>e)e=p[1]}return {s,n,w,e}};

// ---------- Relieve del IGN (WCS de IDEE): TIFF sin comprimir ----------
export function parseTiff(buf){
 const d=new DataView(buf);const le=d.getUint16(0)===0x4949;const u16=o=>d.getUint16(o,le),u32=o=>d.getUint32(o,le);
 if(u16(2)!==42)throw new Error('la respuesta del MDT no es un TIFF');
 const ifd=u32(4),n=u16(ifd),T={};
 for(let i=0;i<n;i++){const e=ifd+2+i*12,tag=u16(e),type=u16(e+2),cnt=u32(e+4);const inl=(type===3&&cnt<=2)||(type===4&&cnt===1);T[tag]={type,cnt,off:e+8,inl,val:inl?(type===3?u16(e+8):u32(e+8)):u32(e+8)}}
 const W=T[256].val,H=T[257].val,bps=T[258].val,sf=T[339]?T[339].val:1;
 if(T[259].val!==1)throw new Error('TIFF comprimido (tipo '+T[259].val+')');
 if(bps!==16&&bps!==32)throw new Error('TIFF de '+bps+' bits');
 const arr=t=>{const a=[];const base=t.inl?t.off:t.val;for(let i=0;i<t.cnt;i++)a.push(t.cnt===1?t.val:(t.type===3?u16(base+i*2):u32(base+i*4)));return a};
 const offs=arr(T[273]),cnts=arr(T[279]);const out=new Float32Array(W*H);let k=0;const bpp=bps/8;
 for(let s=0;s<offs.length;s++)for(let j=0;j<cnts[s]&&k<W*H;j+=bpp)out[k++]=bps===16?(sf===2?d.getInt16(offs[s]+j,le):d.getUint16(offs[s]+j,le)):(sf===3?d.getFloat32(offs[s]+j,le):d.getInt32(offs[s]+j,le));
 if(k!==W*H)throw new Error(`TIFF incompleto: ${k} de ${W*H} celdas`);
 const dbl=(t,c)=>Array.from({length:c},(_,i)=>d.getFloat64(t.val+i*8,le));const sc=dbl(T[33550],3),tp=dbl(T[33922],6);
 return {W,H,data:out,lon0:tp[3],lat0:tp[4],dLon:sc[0],dLat:sc[1]};
}
// bb {s,n,w,e}; res 25 o 5; maxPx: si la rejilla sale mayor, el servidor la reduce (SCALESIZE)
export async function demIGN(bb,res=25,maxPx=1100){
 const cell=res/M_LAT;const wpx=Math.round((bb.e-bb.w)*mLon((bb.s+bb.n)/2)/res),hpx=Math.round((bb.n-bb.s)*M_LAT/res);
 let url=`https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&FORMAT=image/tiff&COVERAGEID=Elevacion4258_${res}&SUBSET=Lat(${bb.s.toFixed(6)},${bb.n.toFixed(6)})&SUBSET=Long(${bb.w.toFixed(6)},${bb.e.toFixed(6)})`;
 let scaled=false;if(Math.max(wpx,hpx)>maxPx){const f=maxPx/Math.max(wpx,hpx);url+=`&SCALESIZE=Long(${Math.round(wpx*f)}),Lat(${Math.round(hpx*f)})`;scaled=true}
 const g=parseTiff(await (await fetchT(url,90000)).arrayBuffer());
 let mn=1e9,mx=-1e9,nod=0;for(let i=0;i<g.data.length;i++){let v=g.data[i];if(!(v>-500&&v<9000)){g.data[i]=0;nod++;v=0}if(v<mn)mn=v;if(v>mx)mx=v}
 // centro del primer píxel
 return {...g,lon0:g.lon0+g.dLon/2,lat0:g.lat0-g.dLat/2,mn,mx,nod,res,scaled,cellM:g.dLat*M_LAT};
}
export function gridH(g,lat,lon){
 const fx=(lon-g.lon0)/g.dLon,fy=(g.lat0-lat)/g.dLat;if(fx<0||fy<0||fx>g.W-1||fy>g.H-1)return null;
 const i=Math.min(Math.floor(fx),g.W-2),j=Math.min(Math.floor(fy),g.H-2),a=fx-i,b=fy-j,H=g.data,W=g.W;
 return (H[j*W+i]*(1-a)+H[j*W+i+1]*a)*(1-b)+(H[(j+1)*W+i]*(1-a)+H[(j+1)*W+i+1]*a)*b;
}
// Pone en pts[i][2] la altitud del MDT 25 m. Devuelve el texto de la fuente.
export async function eleIGN(pts){
 const b=bboxOf(pts),m=0.003;const bb={s:b.s-m,n:b.n+m,w:b.w-m,e:b.e+m};
 if((bb.n-bb.s)*M_LAT>80000||(bb.e-bb.w)*mLon(bb.s)>80000)return {src:'la del propio fichero o de BRouter',note:'Ruta de más de 80 km de lado: no se pide el relieve del IGN.'};
 const g=await demIGN(bb,25,4000);let bad=0;
 for(const p of pts){const v=gridH(g,p[0],p[1]);if(v==null)bad++;else p[2]=v}
 return {src:bad?`MDT 25 m del IGN (${bad} puntos sin dato)`:'MDT 25 m del IGN'};
}

// ---------- Cifras de una ruta ----------
// Desnivel con umbral de 3 m (igual en todas las páginas).
export const UMBRAL_DESNIVEL=3;
export function routeNumbers(pts){
 const cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+dist(pts[i-1],pts[i]));
 let up=0,dn=0,last=null,mx=-1e9,mn=1e9;
 for(const p of pts){const e=p[2];if(e==null||isNaN(e))continue;if(e>mx)mx=e;if(e<mn)mn=e;if(last==null){last=e;continue}const df=e-last;if(Math.abs(df)>=UMBRAL_DESNIVEL){df>0?up+=df:dn-=df;last=e}}
 // pendientes por tramos de 100 m
 const sl=[];let j0=0,maxUp=0,maxDn=0;const bins=SLOPES.map(()=>0);
 for(let i=1;i<pts.length;i++){if(cum[i]-cum[j0]>=100||i===pts.length-1){const dd=cum[i]-cum[j0];
  if(dd>0&&pts[i][2]!=null&&pts[j0][2]!=null){const g=(pts[i][2]-pts[j0][2])/dd*100;sl.push([cum[j0],cum[i],g]);bins[slopeClass(g)]+=dd;if(g>maxUp)maxUp=g;if(g<maxDn)maxDn=g}j0=i}}
 return {cum,D:cum[cum.length-1],up,dn,mx:mx>-1e9?mx:null,mn:mn<1e9?mn:null,sl,bins,maxUp,maxDn};
}
export const SLOPES=[[5,'#4caf50','< 5 %'],[10,'#cddc39','5–10 %'],[15,'#ffc107','10–15 %'],[20,'#ff7043','15–20 %'],[1e9,'#c62828','> 20 %']];
export const slopeClass=g=>SLOPES.findIndex(s=>Math.abs(g)<s[0]);
// Norma DIN 33466: 4 km/h en llano, 300 m/h subiendo, 500 m/h bajando; el mayor + la mitad del menor.
export function timeDIN(D,up,dn){const h=D/1000/4,v=up/300+dn/500;return Math.max(h,v)+Math.min(h,v)/2}

// ---------- BRouter con perfiles propios (devuelven la dificultad de cada tramo) ----------
export const MODES={
 hike:{profile:'hiking-mountain',file:'hiking-mountain.brf',name:'Senderismo',bike:false,
  txt:'Prefiere senderos y caminos de montaña y evita carreteras. Tiempo con la norma DIN 33466 (4 km/h en llano, 300 m/h de subida, 500 m/h de bajada).'},
 mtb:{profile:'mtb',file:'mtb.brf',name:'BTT',bike:true,
  txt:'Bici de montaña: pistas y senderos rodables, evitando los tramos prohibidos a la bici cuando OpenStreetMap lo indica. Tiempo estimado por BRouter.'},
 track:{profile:'trekking',file:'trekking.brf',name:'Pistas',bike:true,
  txt:'Bici por pistas y caminos fáciles, con algo de asfalto si hace falta. Tiempo estimado por BRouter.'}
};
const profIds={};
async function customProfile(mode){
 if(profIds[mode])return profIds[mode];
 const txt=await (await fetchT(new URL('perfiles/'+MODES[mode].file,import.meta.url).href,20000)).text();
 const j=await (await fetchT('https://brouter.de/brouter/profile',30000,{method:'POST',body:txt})).json();
 if(!j.profileid)throw new Error(j.error||'BRouter no aceptó el perfil');
 return profIds[mode]=j.profileid;
}
export async function routeBR(wps,mode){
 const ll=wps.map(p=>p[1].toFixed(6)+','+p[0].toFixed(6)).join('|');
 const go=async prof=>(await fetchT(`https://brouter.de/brouter?lonlats=${ll}&profile=${prof}&alternativeidx=0&format=geojson`,60000)).json();
 let j,noDiff=false,profNote='';
 try{const id=await customProfile(mode);
  try{j=await go(id)}catch(e){if(e.status===500&&/profile/i.test(e.body||'')){delete profIds[mode];j=await go(await customProfile(mode))}else throw e}}
 catch(e){if(e.status===500&&!/profile/i.test(e.body||''))throw e;noDiff=true;profNote=e.message;j=await go(MODES[mode].profile)}
 const f=j.features[0],pr=f.properties;
 const pts=f.geometry.coordinates.map(c=>[c[1],c[0],c[2]!=null?c[2]:null]);
 const msgs=pr.messages||[];const hdr=msgs[0]||[];const iT=hdr.indexOf('WayTags'),iD=hdr.indexOf('Distance');
 const segs=msgs.slice(1).map(m=>({d:+m[iD],tags:Object.fromEntries((m[iT]||'').split(' ').filter(Boolean).map(t=>{const k=t.indexOf('=');return [t.slice(0,k),t.slice(k+1)]}))}));
 return {pts,segs,brTime:+pr['total-time'],brLen:+pr['track-length'],noDiff,profNote};
}

// ---------- Dificultad técnica ----------
export const SAC={hiking:1,mountain_hiking:2,demanding_mountain_hiking:3,alpine_hiking:4,demanding_alpine_hiking:5,difficult_alpine_hiking:6};
export const SAC_TXT=['','T1 senderismo','T2 montaña','T3 montaña exigente','T4 alpino','T5 alpino exigente','T6 alpino difícil'];
export const MTB_TXT=['S0 fácil','S1 algo técnico','S2 técnico','S3 muy técnico','S4 extremo (a pie con la bici)','S5 o más (no ciclable)'];
export const DIF_COL=['#2e7d32','#9ccc65','#fbc02d','#fb8c00','#e53935','#6a1b9a','#000000'];
export const NODATA_COL='#78909c';
export const sacLevel=t=>SAC[t.sac_scale]||0; // 0 = sin dato
// Escala MTB: dato real de OpenStreetMap si está; si no, estimación con reglas fijas (ver README).
export function mtbLevel(t){
 if(t['mtb:scale']!=null&&/^\d/.test(t['mtb:scale']))return {l:Math.min(5,parseInt(t['mtb:scale'])),real:true};
 const hw=t.highway||'',sm=t.smoothness||'',sac=sacLevel(t);
 const smL={excellent:0,very_good:0,good:0,intermediate:1,bad:1,very_bad:2,horrible:3,very_horrible:4,impassable:5}[sm];
 if(hw==='steps')return {l:4,real:false};
 if(sac)return {l:Math.max(Math.min(sac,5),smL??0),real:false};
 if(hw==='track'){const tt={grade1:0,grade2:0,grade3:0,grade4:1,grade5:1}[t.tracktype]??0;return {l:Math.max(tt,smL??0),real:false}}
 if(/^(path|footway|bridleway|cycleway)$/.test(hw)){return smL!=null?{l:smL,real:false}:{l:null,real:false}}
 if(hw)return {l:0,real:false};
 return {l:null,real:false};
}
// Reparte los tramos de BRouter sobre los puntos de la ruta: devuelve por punto [sac, mtb, mtbReal]
export function levelsPerPoint(pts,cum,segs,brLen){
 const out=pts.map(()=>[0,null,false]);if(!segs||!segs.length)return out;
 const D=cum[cum.length-1]||1,k=(brLen||D)/D;let acc=0,s=0,end=segs[0].d;
 for(let i=0;i<pts.length;i++){const x=cum[i]*k;while(s<segs.length-1&&x>end){s++;end+=segs[s].d}
  const t=segs[s].tags;const m=mtbLevel(t);out[i]=[sacLevel(t),m.l,m.real]}
 return out;
}
export function difficultySummary(segs){
 const sac=[0,0,0,0,0,0,0],mtb=[0,0,0,0,0,0],r={sac,mtb,mtbReal:0,mtbEst:0,mtbNone:0,total:0,steps:0,noBike:0,priv:0,ty:{asfalto:0,pista:0,sendero:0,escalones:0,otro:0}};
 for(const s of segs||[]){const t=s.tags,d=s.d;r.total+=d;sac[sacLevel(t)]+=d;
  const m=mtbLevel(t);if(m.l==null)r.mtbNone+=d;else{mtb[m.l]+=d;m.real?r.mtbReal+=d:r.mtbEst+=d}
  const hw=t.highway||'',paved=/^(asphalt|paved|concrete|paving_stones|sett)$/.test(t.surface||'');
  if(hw==='steps'){r.ty.escalones+=d;r.steps+=d}else if(hw==='track')r.ty[paved?'asfalto':'pista']+=d;
  else if(/^(path|footway|bridleway|via_ferrata)$/.test(hw))r.ty[paved?'asfalto':'sendero']+=d;else if(hw)r.ty.asfalto+=d;else r.ty.otro+=d;
  if(t.bicycle==='no'||t.bicycle==='dismount')r.noBike+=d;
  if(/^(private|no)$/.test(t.access||'')||/^(private|no)$/.test(t.foot||''))r.priv+=d}
 // nivel de la ruta: el más alto que suma al menos 100 m (para no calificar por un paso suelto)
 const lvl=(a,from)=>{for(let i=a.length-1;i>=from;i--)if(a[i]>=100)return i;return null};
 const mx=(a,from)=>{for(let i=a.length-1;i>=from;i--)if(a[i]>0)return i;return null};
 r.sacRoute=lvl(sac,1);r.sacMax=mx(sac,1);r.mtbRoute=lvl(mtb,0);r.mtbMax=mx(mtb,0);
 return r;
}
export function barHTML(parts){const T=parts.reduce((a,p)=>a+p[1],0);if(!T)return '';
 return `<div class="bar">${parts.filter(p=>p[1]>0).map(p=>`<i title="${esc(p[0])}" style="width:${p[1]/T*100}%;background:${p[2]}"></i>`).join('')}</div><div class="leg">${parts.filter(p=>p[1]>0).map(p=>`<span><i style="background:${p[2]}"></i>${esc(p[0])}: ${fmt(p[1]>=1000?p[1]/1000:p[1],p[1]>=1000?1:0)} ${p[1]>=1000?'km':'m'} (${fmt(p[1]/T*100)} %)</span>`).join('')}</div>`}

// Informe completo (HTML) de una ruta. r: {pts,segs,brTime,noDiff,far,imported,eleSrc,eleNote}, mode: hike|mtb|track
export function routeReport(r,mode){
 const N=routeNumbers(r.pts);const M=MODES[mode];const dif=difficultySummary(r.segs);const warn=[];
 let tTxt;if(!M.bike)tTxt=hm(timeDIN(N.D,N.up,N.dn))+' <span class="mut">(DIN 33466, sin paradas)</span>';
 else if(!r.imported&&r.brTime)tTxt=hm(r.brTime/3600)+' <span class="mut">(estimación de BRouter, sin paradas)</span>';
 else tTxt='<span class="mut">sin estimación para bici en rutas importadas</span>';
 if(r.far&&r.far.length)warn.push(['wa',`${r.far.length===1?'Un punto de paso queda':r.far.length+' puntos de paso quedan'} a más de 150 m de cualquier camino (el ${r.far.map(x=>x[0]+1).join(', ')}). La ruta pasa por el camino más cercano.`]);
 if(dif.priv)warn.push(['er',`${fmt(dif.priv)} m por caminos marcados como privados o de paso prohibido.`]);
 if(M.bike){
  if(dif.noBike)warn.push(['er',`${fmt(dif.noBike)} m por tramos donde la bici está prohibida o hay que bajarse.`]);
  const s4=dif.mtb[4]+dif.mtb[5];if(s4)warn.push(['er',`${fmt(s4)} m de nivel S4 o más: no ciclables, a pie con la bici.`]);
  if(dif.mtb[3])warn.push(['wa',`${fmt(dif.mtb[3])} m de nivel S3 (muy técnico).`]);
  if(N.maxUp>20)warn.push(['wa',`Rampas de subida de hasta ${fmt(N.maxUp)} % (en tramos de 100 m).`]);
 }else{
  if(dif.sacMax>=4)warn.push(['er',`Terreno alpino (hasta T${dif.sacMax}, ${fmt(dif.sac[4]+dif.sac[5]+dif.sac[6])} m): requiere experiencia y material.`]);
  else if(dif.sacMax===3)warn.push(['wa',`${fmt(dif.sac[3])} m de sendero de montaña exigente (T3): pasos con manos o expuestos.`]);
 }
 if(r.noDiff)warn.push(['wa','No se pudo pedir la dificultad a BRouter ('+esc(r.profNote||'perfil no disponible')+'): la ruta se ha trazado con su perfil estándar, sin ese dato.']);
 if(r.imported)warn.push(['wa','Ruta importada: no trae el tipo de camino, así que no se puede comprobar si vale para la actividad ni su dificultad.']);
 if(!r.imported&&!r.noDiff&&!warn.some(w=>w[0]!=='ok'))warn.push(['ok',`Ruta válida para ${M.name.toLowerCase()} según OpenStreetMap: sin prohibiciones ni tramos conflictivos conocidos.`]);
 if(r.eleNote)warn.push(['wa',esc(r.eleNote)]);
 // dificultad
 let difHTML='';
 if(!r.imported&&!r.noDiff&&dif.total){
  const sacParts=[[ 'sin dato',dif.sac[0],NODATA_COL],...[1,2,3,4,5,6].map(i=>[SAC_TXT[i],dif.sac[i],DIF_COL[i-1]])];
  const mtbParts=[...[0,1,2,3,4,5].map(i=>[MTB_TXT[i],dif.mtb[i],DIF_COL[i]]),['sin dato',dif.mtbNone,NODATA_COL]];
  const head=M.bike?`<div><b>Dificultad BTT de la ruta: ${dif.mtbRoute!=null?MTB_TXT[dif.mtbRoute]:'sin datos suficientes'}</b>${dif.mtbMax!=null&&dif.mtbMax!==dif.mtbRoute?` · tramos sueltos hasta ${MTB_TXT[dif.mtbMax].split(' ')[0]}`:''}</div>`
   :`<div><b>Dificultad de la ruta: ${dif.sacRoute?SAC_TXT[dif.sacRoute]:'sin datos de dificultad'}</b>${dif.sacMax&&dif.sacMax!==dif.sacRoute?` · tramos sueltos hasta T${dif.sacMax}`:''}</div>`;
  difHTML=`<h3>Dificultad técnica</h3>${head}
   ${M.bike?`<div class="mut" style="margin:6px 0 2px">Escala MTB (S0–S5)</div>${barHTML(mtbParts)}<div class="mut">${fmt(dif.mtbReal/dif.total*100)} % con dato de OpenStreetMap · ${fmt(dif.mtbEst/dif.total*100)} % estimado por el tipo de camino · ${fmt(dif.mtbNone/dif.total*100)} % sin dato.</div>`:''}
   <div class="mut" style="margin:6px 0 2px">Escala SAC de senderos (T1–T6)</div>${barHTML(sacParts)}
   <div class="mut">El nivel de la ruta es el más alto que suma al menos 100 m.</div>`;
 }
 const tyC={asfalto:'#90a4ae',pista:'#a1662f',sendero:'#e53935',escalones:'#8e24aa',otro:'#555'};
 const tyHTML=dif.total?'<h3>Tipo de camino</h3>'+barHTML(Object.entries(dif.ty).map(([k,v])=>[k,v,tyC[k]])):'';
 const slHTML='<h3>Pendientes</h3>'+barHTML(N.bins.map((v,i)=>[SLOPES[i][2],v,SLOPES[i][1]]));
 const html=`<h3>Ruta</h3><table>
  <tr><td>Distancia</td><td><b>${fmt(N.D/1000,2)} km</b></td></tr>
  <tr><td>Desnivel positivo</td><td><b>+${fmt(N.up)} m</b></td></tr>
  <tr><td>Desnivel negativo</td><td>−${fmt(N.dn)} m</td></tr>
  <tr><td>Altitud máxima / mínima</td><td>${N.mx!=null?fmt(N.mx)+' / '+fmt(N.mn)+' m':'—'}</td></tr>
  <tr><td>Rampa máxima (100 m)</td><td>${fmt(N.maxUp)} % subiendo · ${fmt(-N.maxDn)} % bajando</td></tr>
  <tr><td>Tiempo</td><td>${tTxt}</td></tr></table>
  <div class="mut" style="margin-top:4px">Altitud: ${esc(r.eleSrc||'—')}. Desnivel con umbral de ${UMBRAL_DESNIVEL} m.</div>
  ${difHTML}${slHTML}${tyHTML}<h3>¿Es válida?</h3>${warn.map(w=>`<div class="w ${w[0]}">${w[1]}</div>`).join('')}`;
 return {html,N,dif};
}

// ---------- Ficheros de ruta: GPX, KML, KMZ, TCX y FIT ----------
export async function readRouteFile(f){
 const ext=f.name.split('.').pop().toLowerCase();
 if(ext==='fit')return parseFIT(await f.arrayBuffer(),f.name);
 let txt;
 if(ext==='kmz'){const JSZip=(await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default;const zip=await JSZip.loadAsync(await f.arrayBuffer());const k=Object.keys(zip.files).find(n=>n.toLowerCase().endsWith('.kml'));if(!k)throw new Error('el KMZ no lleva ningún KML dentro');txt=await zip.files[k].async('string')}
 else txt=await f.text();
 const x=new DOMParser().parseFromString(txt,'application/xml');if(x.querySelector('parsererror'))throw new Error('fichero mal formado');
 const pts=[];let date=null;
 if(ext==='gpx'){for(const p of x.querySelectorAll('trkpt,rtept')){const e=p.querySelector('ele');pts.push([+p.getAttribute('lat'),+p.getAttribute('lon'),e?+e.textContent:null])}
  const t=x.querySelector('trkpt time,metadata time');if(t)date=new Date(t.textContent)}
 else if(ext==='tcx'){for(const p of x.querySelectorAll('Trackpoint')){const la=p.querySelector('LatitudeDegrees'),lo=p.querySelector('LongitudeDegrees'),e=p.querySelector('AltitudeMeters');if(la&&lo)pts.push([+la.textContent,+lo.textContent,e?+e.textContent:null])}
  const t=x.querySelector('Activity Id');if(t)date=new Date(t.textContent)}
 else{const cs=[...x.getElementsByTagName('coordinates')].concat([...x.getElementsByTagNameNS('*','coord')]);
  for(const c of cs){if(c.localName==='coord'){const [lo,la,e]=c.textContent.trim().split(/\s+/).map(Number);pts.push([la,lo,isNaN(e)?null:e]);continue}
   for(const t of c.textContent.trim().split(/\s+/)){const [lo,la,e]=t.split(',').map(Number);if(!isNaN(la)&&!isNaN(lo))pts.push([la,lo,isNaN(e)?null:e])}}}
 if(pts.length<2)throw new Error('no tiene puntos de recorrido');
 return {name:f.name.replace(/\.[^.]+$/,''),pts,date,sport:null};
}
const SPORT={1:'Carrera',2:'Bici',11:'Caminata',12:'Esquí de fondo',13:'Esquí',16:'Alpinismo',17:'Senderismo',21:'Bici eléctrica',35:'Raquetas'};
const SUB={3:'trail',8:'montaña',46:'gravel',47:'eléctrica de montaña',127:'eléctrica enduro'};
// Lector propio de ficheros FIT de Garmin: solo saca posiciones, altitud, fecha y resumen.
export function parseFIT(buf,name='actividad'){
 const d=new DataView(buf);const hs=d.getUint8(0);
 if(String.fromCharCode(d.getUint8(8),d.getUint8(9),d.getUint8(10),d.getUint8(11))!=='.FIT')throw new Error('no es un fichero FIT');
 const end=Math.min(hs+d.getUint32(4,true),buf.byteLength);let o=hs;const defs={};const pts=[];const ses={};let lastTs=0;
 const SZ={0:1,1:1,2:1,3:2,4:2,5:4,6:4,7:1,8:4,9:8,10:1,11:2,12:4,13:1,14:8,15:8,16:8};
 const rd=(type,off,le)=>{switch(type&0x1F){case 1:return d.getInt8(off);case 2:case 0:case 10:case 13:return d.getUint8(off);case 3:return d.getInt16(off,le);case 4:case 11:return d.getUint16(off,le);
  case 5:return d.getInt32(off,le);case 6:case 12:return d.getUint32(off,le);case 8:return d.getFloat32(off,le);default:return null}};
 const INV={1:0x7F,2:0xFF,0:0xFF,10:0,13:0xFF,3:0x7FFF,4:0xFFFF,11:0,5:0x7FFFFFFF,6:0xFFFFFFFF,12:0};
 while(o<end){const h=d.getUint8(o++);
  if(!(h&0x80)&&(h&0x40)){const lt=h&0x0F;const arch=d.getUint8(o+1);const le=arch===0;const gm=d.getUint16(o+2,le);const nf=d.getUint8(o+4);o+=5;const fl=[];
   for(let i=0;i<nf;i++){fl.push([d.getUint8(o),d.getUint8(o+1),d.getUint8(o+2)]);o+=3}let dev=0;
   if(h&0x20){const nd=d.getUint8(o++);for(let i=0;i<nd;i++){dev+=d.getUint8(o+1);o+=3}}
   defs[lt]={gm,le,fl,dev};continue}
  const lt=(h&0x80)?((h>>5)&3):(h&0x0F);const df=defs[lt];if(!df)throw new Error('FIT dañado (mensaje sin definición)');
  const v={};let p=o;
  for(const [num,size,bt] of df.fl){const s=SZ[bt&0x1F];if(s&&size===s){const x=rd(bt,p,df.le);if(x!==INV[bt&0x1F])v[num]=x}p+=size}
  o=p+df.dev;
  if(df.gm===20){const la=v[0],lo=v[1];if(la!=null&&lo!=null){const alt=v[78]!=null?v[78]/5-500:v[2]!=null?v[2]/5-500:null;pts.push([la*180/2**31,lo*180/2**31,alt])}}
  else if(df.gm===18){if(v[5]!=null)ses.sport=v[5];if(v[6]!=null)ses.sub=v[6];if(v[2]!=null)ses.start=v[2];if(v[9]!=null)ses.dist=v[9]/100;if(v[22]!=null)ses.asc=v[22];if(v[8]!=null)ses.timer=v[8]/1000}
 }
 const date=ses.start!=null?new Date((ses.start+631065600)*1000):null;
 const sport=(SPORT[ses.sport]||'Actividad')+(SUB[ses.sub]?' ('+SUB[ses.sub]+')':'');
 return {name,pts,date,sport,sportCode:ses.sport,subCode:ses.sub,dist:ses.dist,asc:ses.asc,timer:ses.timer};
}
export function gpxText(name,pts,type){
 return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="El Sherpa 3D (BRouter + MDT IGN)" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>${esc(name)}</name></metadata>\n<trk><name>${esc(name)}</name>${type?`<type>${type}</type>`:''}<trkseg>\n`+
  pts.map(p=>`<trkpt lat="${p[0].toFixed(6)}" lon="${p[1].toFixed(6)}">${p[2]!=null?`<ele>${p[2].toFixed(1)}</ele>`:''}</trkpt>`).join('\n')+`\n</trkseg></trk>\n</gpx>\n`;
}
export function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)}
export const safeName=s=>s.replace(/[^\wáéíóúüñÁÉÍÓÚÜÑ .()-]/g,'').trim()||'ruta';

// ---------- Perfil de altitud (canvas) ----------
// opts: {hx: x del cursor, lv: niveles por punto, bike}
export function drawProfile(cv,pts,N,opts={}){
 const r=cv.getBoundingClientRect(),dpr=devicePixelRatio||1;cv.width=Math.max(1,r.width*dpr);cv.height=Math.max(1,r.height*dpr);const c=cv.getContext('2d');c.scale(dpr,dpr);
 const W=r.width,H=r.height;c.clearRect(0,0,W,H);
 if(!pts||!N||!N.D){c.fillStyle='#9fb3a8';c.font='13px system-ui';c.fillText(opts.empty||'El perfil de altitud aparece aquí cuando hay una ruta.',16,H/2);return null}
 const strip=opts.lv?8:0;const pad={l:46,r:12,t:10,b:20+strip};let mn=N.mn,mx=N.mx;if(mn==null){mn=0;mx=100}
 const rng=Math.max(50,mx-mn),lo=mn-rng*.08,hi=mx+rng*.08;const cum=N.cum,D=N.D;
 const X=d=>pad.l+d/D*(W-pad.l-pad.r),Y=e=>pad.t+(1-(e-lo)/(hi-lo))*(H-pad.t-pad.b);
 c.strokeStyle='rgba(255,255,255,.08)';c.fillStyle='#9fb3a8';c.font='11px system-ui';c.lineWidth=1;
 const st=[10,20,50,100,200,250,500,1000].find(s=>(hi-lo)/s<=5)||1000;
 for(let e=Math.ceil(lo/st)*st;e<=hi;e+=st){const y=Y(e);c.beginPath();c.moveTo(pad.l,y);c.lineTo(W-pad.r,y);c.stroke();c.fillText(fmt(e)+' m',4,y+4)}
 const ks=[0.5,1,2,5,10,20,50,100].find(s=>D/1000/s<=10)||100;
 for(let k=0;k<=D/1000+1e-9;k+=ks)c.fillText(fmt(k,ks<1?1:0)+' km',X(k*1000)-10,H-6);
 for(const [a,b,g] of N.sl){c.fillStyle=SLOPES[slopeClass(g)][1]+'cc';c.beginPath();let first=true;
  for(let i=0;i<pts.length;i++){if(cum[i]<a||cum[i]>b||pts[i][2]==null)continue;const x=X(cum[i]),y=Y(pts[i][2]);if(first){c.moveTo(x,H-pad.b);c.lineTo(x,y);first=false}else c.lineTo(x,y)}
  c.lineTo(X(b),H-pad.b);c.closePath();c.fill()}
 c.strokeStyle='#fff';c.lineWidth=1.5;c.beginPath();let f=true;for(let i=0;i<pts.length;i++){if(pts[i][2]==null)continue;const x=X(cum[i]),y=Y(pts[i][2]);f?c.moveTo(x,y):c.lineTo(x,y);f=false}c.stroke();
 if(opts.lv){const y0=H-pad.b+2;for(let i=1;i<pts.length;i++){const L=opts.lv[i];const l=opts.bike?L[1]:(L[0]?L[0]-1:null);c.fillStyle=l==null?NODATA_COL:DIF_COL[l];c.fillRect(X(cum[i-1]),y0,Math.max(1,X(cum[i])-X(cum[i-1])+.5),strip-2)}}
 if(opts.hx!=null){c.strokeStyle='#ffeb3b';c.beginPath();c.moveTo(opts.hx,pad.t);c.lineTo(opts.hx,H-pad.b);c.stroke()}
 return {X,pad,W,D};
}
// índice del punto bajo la x del perfil
export function profileIndex(geo,N,x){if(!geo)return null;const d=Math.max(0,Math.min(1,(x-geo.pad.l)/(geo.W-geo.pad.l-geo.pad.r)))*N.D;let lo=0,hi=N.cum.length-1;while(lo<hi){const m=(lo+hi)>>1;if(N.cum[m]<d)lo=m+1;else hi=m}return lo}

// ---------- Sol (fórmulas astronómicas estándar, precisión ~0,5°) ----------
export function sunPos(date,lat,lon){
 const rad=Math.PI/180,e=23.4397*rad,d=date.valueOf()/86400000-0.5+2440588-2451545;
 const M=rad*(357.5291+0.98560028*d),C=rad*(1.9148*Math.sin(M)+0.02*Math.sin(2*M)+0.0003*Math.sin(3*M)),L=M+C+rad*102.9372+Math.PI;
 const dec=Math.asin(Math.sin(L)*Math.sin(e)),ra=Math.atan2(Math.sin(L)*Math.cos(e),Math.cos(L));
 const H=rad*(280.16+360.9856235*d)+lon*rad-ra,ph=lat*rad;
 const alt=Math.asin(Math.sin(ph)*Math.sin(dec)+Math.cos(ph)*Math.cos(dec)*Math.cos(H));
 const az=Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(ph)-Math.tan(dec)*Math.cos(ph));
 return {alt:alt/rad,az:((az/rad+180)%360+360)%360}; // az desde el norte, en sentido horario
}

// ---------- Tiempo en un punto (Open-Meteo) ----------
const WMO={0:'despejado',1:'casi despejado',2:'nubes y claros',3:'cubierto',45:'niebla',48:'niebla con escarcha',51:'llovizna débil',53:'llovizna',55:'llovizna intensa',56:'llovizna helada',57:'llovizna helada',61:'lluvia débil',63:'lluvia',65:'lluvia fuerte',66:'lluvia helada',67:'lluvia helada',71:'nieve débil',73:'nieve',75:'nieve fuerte',77:'granizo menudo',80:'chubascos',81:'chubascos',82:'chubascos fuertes',85:'chubascos de nieve',86:'chubascos de nieve fuertes',95:'tormenta',96:'tormenta con granizo',99:'tormenta con granizo'};
export const wmoTxt=c=>WMO[c]??'—';
export async function weather(lat,lon,ele){
 const u=`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}${ele!=null?'&elevation='+Math.round(ele):''}&current=temperature_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max&timezone=Europe%2FMadrid&forecast_days=3`;
 return (await fetchT(u,15000)).json();
}

// ---------- Senderos con su dificultad (OpenStreetMap) ----------
// Fuentes probadas el 14-11-2026 desde la conexión de Emilio; se usa la primera que responda.
const lineLen=g=>{let d=0;for(let i=1;i<g.length;i++)d+=dist(g[i-1],g[i]);return d};
const HW='path|track|footway|bridleway|steps|via_ferrata|cycleway';
export const TRAIL_SOURCES=[
 {name:'OpenStreetMap Francia (Overpass)',run:async b=>{
  const q=`[out:json][timeout:60];way["highway"~"^(${HW})$"](${b.s.toFixed(5)},${b.w.toFixed(5)},${b.n.toFixed(5)},${b.e.toFixed(5)});out tags geom qt;`;
  const j=await (await fetchT('https://overpass.openstreetmap.fr/api/interpreter',60000,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(q)})).json();
  if(j.remark&&!j.elements.length)throw new Error(j.remark.slice(0,80));
  return j.elements.filter(e=>e.geometry&&e.geometry.length>1).map(e=>({id:e.id,tags:e.tags||{},g:e.geometry.map(p=>[p.lat,p.lon])}))}},
 {name:'Geofabrik (Postpass)',run:async b=>{
  const sql=`SELECT osm_id, tags, geom FROM postpass_line WHERE tags->>'highway' IN (${HW.split('|').map(h=>`'${h}'`).join(',')}) AND geom && ST_MakeEnvelope(${b.w.toFixed(5)},${b.s.toFixed(5)},${b.e.toFixed(5)},${b.n.toFixed(5)},4326)`;
  const j=await (await fetchT('https://postpass.geofabrik.de/api/0.2/interpreter',60000,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(sql)})).json();
  const out=[];for(const f of j.features||[]){let t=f.properties.tags;if(typeof t==='string')try{t=JSON.parse(t)}catch(_){t={}}
   const gs=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.type==='MultiLineString'?f.geometry.coordinates:[];
   for(const l of gs)if(l.length>1)out.push({id:f.properties.osm_id,tags:t||{},g:l.map(c=>[c[1],c[0]])})}
  return out}},
 {name:'Overpass (Alemania)',run:async b=>{
  const q=`[out:json][timeout:60];way["highway"~"^(${HW})$"](${b.s.toFixed(5)},${b.w.toFixed(5)},${b.n.toFixed(5)},${b.e.toFixed(5)});out tags geom qt;`;
  const j=await (await fetchT('https://overpass-api.de/api/interpreter',30000,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(q)})).json();
  return j.elements.filter(e=>e.geometry&&e.geometry.length>1).map(e=>({id:e.id,tags:e.tags||{},g:e.geometry.map(p=>[p.lat,p.lon])}))}}
];
// Devuelve {ways:[{id,tags,g,k,sac,mtb:{l,real},len}], src, errs}
export async function trailsWithDifficulty(b){
 const errs=[];
 for(const s of TRAIL_SOURCES){try{const w=await s.run(b);
   for(const x of w){x.k=x.tags.highway;x.sac=sacLevel(x.tags);x.mtb=mtbLevel(x.tags);x.len=lineLen(x.g)}
   return {ways:w,src:s.name,errs}}catch(e){errs.push(s.name+': '+e.message)}}
 const e=new Error('ninguna fuente de senderos con dificultad responde');e.errs=errs;throw e;
}
export function trailSummary(ways){const sac=[0,0,0,0,0,0,0],mtb=[0,0,0,0,0,0],r={sac,mtb,mtbReal:0,mtbEst:0,mtbNone:0,total:0};
 for(const w of ways){r.total+=w.len;sac[w.sac||0]+=w.len;if(w.mtb.l==null)r.mtbNone+=w.len;else{mtb[w.mtb.l]+=w.len;w.mtb.real?r.mtbReal+=w.len:r.mtbEst+=w.len}}return r}
export function trailCardHTML(w){const t=w.tags;const SURF={asphalt:'asfalto',paved:'pavimentado',unpaved:'sin pavimentar',gravel:'grava',ground:'tierra',dirt:'tierra',grass:'hierba',rock:'roca',rocks:'roca',stone:'piedra',sand:'arena',compacted:'compactado',fine_gravel:'grava fina',pebblestone:'cantos',wood:'madera',mud:'barro'};
 const SM={excellent:'excelente',very_good:'muy bueno',good:'bueno',intermediate:'regular',bad:'malo',very_bad:'muy malo',horrible:'horrible',very_horrible:'muy horrible',impassable:'intransitable'};
 const HWT={path:'sendero',track:'pista',footway:'camino peatonal',bridleway:'camino de herradura',steps:'escalones',via_ferrata:'vía ferrata',cycleway:'carril bici'};
 return `<table>
 <tr><td>Tipo</td><td>${HWT[w.k]||esc(w.k)}${t.tracktype?' ('+esc(t.tracktype.replace('grade','tipo '))+')':''}</td></tr>
 <tr><td>Dificultad a pie</td><td>${w.sac?SAC_TXT[w.sac]:'sin dato'}</td></tr>
 <tr><td>Dificultad BTT</td><td>${w.mtb.l==null?'sin dato':MTB_TXT[w.mtb.l]+(w.mtb.real?'':' (estimada)')}${t['mtb:scale:uphill']?' · subida: S'+esc(t['mtb:scale:uphill']):''}</td></tr>
 ${t.surface?`<tr><td>Firme</td><td>${SURF[t.surface]||esc(t.surface)}</td></tr>`:''}
 ${t.smoothness?`<tr><td>Estado</td><td>${SM[t.smoothness]||esc(t.smoothness)}</td></tr>`:''}
 ${t.bicycle?`<tr><td>Bici</td><td>${t.bicycle==='no'?'prohibida':t.bicycle==='dismount'?'hay que bajarse':t.bicycle==='yes'||t.bicycle==='designated'?'permitida':esc(t.bicycle)}</td></tr>`:''}
 ${/^(private|no)$/.test(t.access||'')?`<tr><td>Acceso</td><td>${t.access==='private'?'privado':'prohibido'}</td></tr>`:''}
 <tr><td>Longitud</td><td>${fmt(w.len)} m</td></tr></table>
 <div class="mut" style="margin-top:4px">Datos de OpenStreetMap (<a href="https://www.openstreetmap.org/way/${w.id}" target="_blank" rel="noopener">ver el camino</a>).</div>`}

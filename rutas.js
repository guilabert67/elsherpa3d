// El Sherpa 3D · planificador de rutas (senderismo, BTT y pistas)
import {fmt,esc,fetchT,dist,M_LAT,mLon,MODES,routeBR,eleIGN,routeReport,routeNumbers,levelsPerPoint,DIF_COL,NODATA_COL,SLOPES,slopeClass,SAC_TXT,MTB_TXT,trailsWithDifficulty,trailCardHTML,
 readRouteFile,gpxText,download,safeName,drawProfile,profileIndex} from './comun.js';
const $=s=>document.querySelector(s);
let mode='hike';

// ---------- Mapa ----------
const ignW=(srv,layer,f)=>`https://www.ign.es/wmts/${srv}?layer=${layer}&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=${f}&TileMatrix={z}&TileCol={x}&TileRow={y}`;
const IGN='© <a href="https://www.ign.es">IGN/CNIG</a> (CC BY 4.0)';
const bases={
 'Mapa topográfico IGN (MTN)':L.tileLayer(ignW('mapa-raster','MTN','image/jpeg'),{maxZoom:19,maxNativeZoom:16,attribution:IGN}),
 'Mapa base IGN':L.tileLayer(ignW('ign-base','IGNBaseTodo','image/jpeg'),{maxZoom:19,maxNativeZoom:17,attribution:IGN}),
 'Satélite PNOA (IGN)':L.tileLayer(ignW('pnoa-ma','OI.OrthoimageCoverage','image/jpeg'),{maxZoom:19,attribution:IGN}),
 'OpenTopoMap':L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxZoom:19,maxNativeZoom:17,subdomains:'abc',attribution:'© OpenStreetMap, SRTM · estilo © <a href="https://opentopomap.org">OpenTopoMap</a> (CC BY-SA)'})
};
const WMT='Rutas © <a href="https://waymarkedtrails.org">Waymarked Trails</a> (CC BY-SA)';
const overs={
 'Rutas señalizadas a pie (GR, PR, SL)':L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png',{maxZoom:19,maxNativeZoom:18,opacity:.8,attribution:WMT}),
 'Rutas señalizadas BTT':L.tileLayer('https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png',{maxZoom:19,maxNativeZoom:18,opacity:.8,attribution:WMT})
};
const map=L.map('map',{doubleClickZoom:false}).setView([40.7646,-3.8913],13);
let baseName='Mapa topográfico IGN (MTN)';try{const b=localStorage.getItem('rutas-base');if(b&&bases[b])baseName=b}catch(_){}
bases[baseName].addTo(map);overs['Rutas señalizadas a pie (GR, PR, SL)'].addTo(map);
L.control.layers(bases,overs,{collapsed:true}).addTo(map);L.control.scale({imperial:false}).addTo(map);
map.on('baselayerchange',e=>{try{localStorage.setItem('rutas-base',e.name)}catch(_){}});

// ---------- Senderos coloreados por dificultad ----------
const trCanvas=L.canvas({padding:.3});const trLayer=L.layerGroup().addTo(map);let trWays=[],trKey='',trBusy=false;
function trLegend(){const how=$('#selTr').value;$('#trLeg').innerHTML=(how==='sac'?[1,2,3,4,5,6].map(i=>`<span><i style="background:${DIF_COL[i-1]}"></i>${SAC_TXT[i]}</span>`):[0,1,2,3,4,5].map(i=>`<span><i style="background:${DIF_COL[i]}"></i>${MTB_TXT[i]}</span>`)).join('')+`<span><i style="background:${NODATA_COL}"></i>sin dato</span>`+(how==='mtb'?'<span>· discontinua = estimada</span>':'')}
function trDraw(){trLayer.clearLayers();if(!$('#cTr').checked)return;const how=$('#selTr').value;
 for(const w of trWays){const col=how==='sac'?(w.sac?DIF_COL[w.sac-1]:NODATA_COL):(w.mtb.l==null?NODATA_COL:DIF_COL[w.mtb.l]);
  L.polyline(w.g,{renderer:trCanvas,color:col,weight:w.k==='track'?4:3,opacity:.9,interactive:false,dashArray:how==='mtb'&&w.mtb.l!=null&&!w.mtb.real?'7 5':null}).addTo(trLayer)}}
// modo consulta: el toque muestra la ficha del sendero más cercano en vez de poner un punto
let query=false;$('#bQuery').onclick=()=>{query=!query;$('#bQuery').classList.toggle('p',query);$('#bQuery').textContent=query?'ℹ Toca un sendero (pulsa para volver a trazar)':'ℹ Consultar un sendero'};
function segPx(p,a,b){const dx=b.x-a.x,dy=b.y-a.y;const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/((dx*dx+dy*dy)||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)}
function trailAt(latlng){const p=map.latLngToContainerPoint(latlng);let best=null,bd=18;
 for(const w of trWays){let q=map.latLngToContainerPoint(w.g[0]);for(let i=1;i<w.g.length;i++){const c=map.latLngToContainerPoint(w.g[i]);const d=segPx(p,q,c);if(d<bd){bd=d;best=w}q=c}}return best}
async function trLoad(){
 if(!$('#cTr').checked){trLayer.clearLayers();return}
 const b=map.getBounds();const bb={s:b.getSouth(),n:b.getNorth(),w:b.getWest(),e:b.getEast()};
 const area=(bb.n-bb.s)*M_LAT*(bb.e-bb.w)*mLon(bb.s)/1e6;
 if(map.getZoom()<13||area>250){$('#trMsg').textContent='Acércate al mapa para ver la dificultad de cada sendero; tócalo para ver su ficha.';return}
 const m=.01;const big={s:Math.floor((bb.s-m)/.02)*.02,n:Math.ceil((bb.n+m)/.02)*.02,w:Math.floor((bb.w-m)/.02)*.02,e:Math.ceil((bb.e+m)/.02)*.02};
 const key=[big.s,big.n,big.w,big.e].map(x=>x.toFixed(2)).join(',');if(key===trKey||trBusy)return;
 trBusy=true;$('#trMsg').textContent='Pidiendo la dificultad de los senderos…';
 try{const r=await trailsWithDifficulty(big);trWays=r.ways;trKey=key;trDraw();$('#trMsg').textContent=`${fmt(r.ways.length)} tramos con su dificultad (fuente: ${r.src}). Tócalos para ver su ficha.`}
 catch(e){$('#trMsg').textContent='La dificultad de los senderos no está disponible ahora ('+(e.errs||[e.message]).join(' · ')+').'}
 trBusy=false;
}
map.on('moveend',()=>{clearTimeout(trLoad.t);trLoad.t=setTimeout(trLoad,500)});
$('#cTr').onchange=()=>{trKey='';trLoad();trDraw()};$('#selTr').onchange=()=>{trLegend();trDraw()};trLegend();setTimeout(trLoad,300);

// ---------- Puntos de paso ----------
let wps=[],res=null,N=null,LV=null,imported=false,hoverMk=null,fitOnce=false;const wpLayer=L.layerGroup().addTo(map),routeLayer=L.layerGroup().addTo(map);
const wpIcon=(i,n)=>L.divIcon({className:'',html:`<div class="wp ${i===0?'s':i===n-1&&n>1?'e':''}"></div>`,iconSize:[16,16],iconAnchor:[8,8]});
function drawWps(){wpLayer.clearLayers();wps.forEach((p,i)=>{const m=L.marker(p,{draggable:true,icon:wpIcon(i,wps.length),zIndexOffset:1000}).addTo(wpLayer);
 m.on('dragend',()=>{const ll=m.getLatLng();wps[i]=[ll.lat,ll.lng];route()});m.on('click',()=>{wps.splice(i,1);drawWps();route()})})}
map.on('click',e=>{if(query){const w=trailAt(e.latlng);if(w)L.popup({maxWidth:280}).setLatLng(e.latlng).setContent(`<b>${esc(w.tags.name||w.tags.ref||(w.k==='track'?'Pista':'Sendero'))}</b>`+trailCardHTML(w)).openOn(map);else setMsg('No hay ningún sendero con datos justo ahí. Acércate más o toca encima de la línea.','wa');return}
 if(imported){imported=false;clearRoute()}wps.push([e.latlng.lat,e.latlng.lng]);drawWps();route()});
$('#bUndo').onclick=()=>{wps.pop();drawWps();route()};
$('#bClear').onclick=()=>{wps=[];imported=false;drawWps();clearRoute();setMsg('')};
$('#bLoop').onclick=()=>{if(wps.length<2)return setMsg('Pon al menos dos puntos.','wa');wps.push(wps[0].slice());drawWps();route()};
$('#bBack').onclick=()=>{if(wps.length<2)return setMsg('Pon al menos dos puntos.','wa');wps=wps.concat(wps.slice(0,-1).reverse());drawWps();route()};
document.querySelectorAll('#mode button').forEach(b=>b.onclick=()=>{mode=b.dataset.m;document.querySelectorAll('#mode button').forEach(x=>x.classList.toggle('on',x===b));$('#modeTxt').textContent=MODES[mode].txt;
 const h=overs['Rutas señalizadas a pie (GR, PR, SL)'],m=overs['Rutas señalizadas BTT'];if(mode==='hike'){map.addLayer(h);map.removeLayer(m)}else{map.addLayer(m);map.removeLayer(h)}
 if(imported)show();else route()});
$('#modeTxt').textContent=MODES[mode].txt;
$('#selCol').onchange=()=>{if(res)drawRoute()};
function setMsg(t,c=''){$('#msg').innerHTML=t?`<div class="w ${c}">${t}</div>`:''}
function clearRoute(){routeLayer.clearLayers();res=N=LV=null;$('#stats').innerHTML='';prof();['bGpx','b3d','bShare'].forEach(i=>$('#'+i).disabled=true);history.replaceState(null,'',location.pathname)}

// ---------- Trazado ----------
let rSeq=0,rTimer=null;
function route(){clearTimeout(rTimer);rTimer=setTimeout(doRoute,250)}
async function doRoute(){
 const my=++rSeq;imported=false;
 if(wps.length<2){clearRoute();if(wps.length===1)setMsg('Ahora toca el siguiente punto.');return}
 if(wps.length>40)return setMsg('Máximo 40 puntos de paso.','wa');
 setMsg('Calculando la ruta por caminos…');
 let r;try{r=await routeBR(wps,mode)}catch(e){if(my!==rSeq)return;const b=(e.body||'').toLowerCase();
  setMsg(e.status===500&&/not found|no route|target|from-position|to-position/.test(b)?'No hay camino entre esos puntos para esta actividad. Acerca los puntos a un camino o cambia de actividad.':e.timeout?'BRouter no responde. Inténtalo otra vez en unos segundos.':'No se pudo calcular la ruta ('+esc(e.message)+(e.body?': '+esc(e.body.slice(0,140)):'')+').','er');return}
 if(my!==rSeq)return;
 r.far=wps.map((w,i)=>[i,Math.min(...r.pts.map(p=>dist(w,p)))]).filter(x=>x[1]>150);
 r.name='Ruta '+MODES[mode].name;r.eleSrc='BRouter (satélite SRTM, menos precisa)';
 setMsg('Leyendo la altitud del IGN…');
 try{const e=await eleIGN(r.pts);r.eleSrc=e.src;r.eleNote=e.note}catch(e){r.eleNote='No se pudo leer el MDT del IGN ('+e.message+'): se usa la altitud de BRouter.'}
 if(my!==rSeq)return;
 res=r;show();setMsg('');
 if(fitOnce){fitOnce=false;map.fitBounds(L.polyline(res.pts.map(p=>[p[0],p[1]])).getBounds(),{padding:[30,30]})}
}
function show(){
 const rep=routeReport(res,mode);N=rep.N;LV=levelsPerPoint(res.pts,N.cum,res.segs,res.brLen);
 $('#stats').innerHTML=rep.html;drawRoute();prof();
 ['bGpx','b3d','bShare'].forEach(i=>$('#'+i).disabled=false);
 if(!imported)history.replaceState(null,'',`#${mode};${wps.map(p=>p[0].toFixed(5)+','+p[1].toFixed(5)).join(';')}`);
}
function colorAt(i){const how=$('#selCol').value;
 if(how==='act')return mode==='hike'?'#ff3d00':'#2962ff';
 if(how==='pend'){const d=N.cum[i];const s=N.sl.find(s=>d>=s[0]&&d<=s[1]);return s?SLOPES[slopeClass(s[2])][1]:'#888'}
 if(!LV||res.imported||res.noDiff)return mode==='hike'?'#ff3d00':'#2962ff';
 const L_=LV[i];const l=MODES[mode].bike?L_[1]:(L_[0]?L_[0]-1:null);return l==null?NODATA_COL:DIF_COL[l]}
function drawRoute(){routeLayer.clearLayers();const P=res.pts;
 L.polyline(P.map(p=>[p[0],p[1]]),{color:'#000',weight:8,opacity:.45,interactive:false}).addTo(routeLayer);
 // el tramo P[i-1]→P[i] lleva el color del punto i (igual que el visor)
 let col=colorAt(1),run=[[P[0][0],P[0][1]]];
 for(let i=1;i<P.length;i++){const c=colorAt(i);if(c!==col){L.polyline(run,{color:col,weight:5,opacity:.95,interactive:false}).addTo(routeLayer);run=[[P[i-1][0],P[i-1][1]]];col=c}run.push([P[i][0],P[i][1]])}
 L.polyline(run,{color:col,weight:5,opacity:.95,interactive:false}).addTo(routeLayer)}

// ---------- Perfil ----------
const pc=$('#pc'),tip=$('#tip');let geo=null;
function prof(hx){geo=drawProfile(pc,res&&res.pts,N,{hx,lv:res&&!res.imported&&!res.noDiff?LV:null,bike:MODES[mode].bike,empty:'El perfil de altitud aparece aquí cuando trazas una ruta.'})}
addEventListener('resize',()=>prof());
pc.addEventListener('pointermove',e=>{if(!res||!geo)return;const r=pc.getBoundingClientRect();const i=profileIndex(geo,N,e.clientX-r.left);const p=res.pts[i];
 prof(geo.X(N.cum[i]));const s=N.sl.find(s=>N.cum[i]>=s[0]&&N.cum[i]<=s[1]);
 tip.style.display='block';tip.style.left=Math.min(e.clientX-r.left+10,r.width-200)+'px';tip.style.top='6px';
 tip.textContent=`km ${fmt(N.cum[i]/1000,2)} · ${p[2]!=null?fmt(p[2])+' m':''}${s?' · '+fmt(s[2])+' %':''}`;
 if(!hoverMk)hoverMk=L.circleMarker(p,{radius:7,color:'#000',weight:2,fillColor:'#ffeb3b',fillOpacity:1}).addTo(map);else hoverMk.setLatLng(p)});
pc.addEventListener('pointerleave',()=>{tip.style.display='none';prof();if(hoverMk){map.removeLayer(hoverMk);hoverMk=null}});

// ---------- Guardar, importar, 3D, compartir ----------
$('#bGpx').onclick=()=>{if(!res)return;const name=res.name+' '+new Date().toISOString().slice(0,10);download(safeName(name)+'.gpx',gpxText(name,res.pts,mode==='hike'?'hiking':'mountain_biking'),'application/gpx+xml')};
$('#fG').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
 try{setMsg('Leyendo el fichero…');const r=await readRouteFile(f);wps=[];drawWps();
  const rr={pts:r.pts,segs:[],name:r.name,far:[],imported:true,eleSrc:'la del propio fichero'};
  try{const e2=await eleIGN(rr.pts);rr.eleSrc=e2.src;rr.eleNote=e2.note}catch(err){rr.eleNote='No se pudo leer el MDT del IGN: se usa la altitud del fichero.'}
  imported=true;res=rr;rSeq++;show();setMsg(r.sport?`${esc(r.sport)}${r.date?' del '+r.date.toLocaleDateString('es-ES'):''}${r.dist?` · según el reloj: ${fmt(r.dist/1000,2)} km y +${fmt(r.asc)} m`:''}`:'','ok');
  map.fitBounds(L.polyline(rr.pts.map(p=>[p[0],p[1]])).getBounds(),{padding:[20,20]})}
 catch(err){setMsg('No se pudo leer el fichero: '+esc(err.message),'er')}};
$('#b3d').onclick=()=>{if(!res)return;try{
 localStorage.setItem('montanas3d-ruta',JSON.stringify({name:res.name,mode,bike:MODES[mode].bike,pts:res.pts.map((p,i)=>[+p[0].toFixed(6),+p[1].toFixed(6),p[2]!=null?Math.round(p[2]*10)/10:null,...(LV&&!res.imported&&!res.noDiff?[LV[i][0],LV[i][1]]:[])])}));
 location.href='index.html#ruta'}catch(e){setMsg('Tu navegador no deja pasar la ruta al visor 3D. Descarga el GPX y ábrelo allí.','wa')}};
$('#bShare').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);setMsg('Enlace copiado.','ok')}catch(e){setMsg('Copia este enlace: '+esc(location.href),'wa')}};

// ---------- Buscar y posición ----------
$('#fS').onsubmit=async e=>{e.preventDefault();const q=$('#qS').value.trim();if(!q)return;$('#sRes').innerHTML='<div class="mut">Buscando…</div>';
 try{const j=await (await fetchT('https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=es&accept-language=es&q='+encodeURIComponent(q),15000)).json();
  $('#sRes').innerHTML=j.length?j.map((r,i)=>`<div class="it" data-i="${i}">${esc(r.display_name.split(',').slice(0,3).join(','))}</div>`).join(''):'<div class="mut">Sin resultados en España.</div>';
  $('#sRes').onclick=ev=>{const it=ev.target.closest('.it');if(!it)return;const r=j[+it.dataset.i];map.setView([+r.lat,+r.lon],15);$('#sRes').innerHTML=''}}
 catch(err){$('#sRes').innerHTML='<div class="mut">El buscador no responde ('+esc(err.message)+').</div>'}};
$('#bMe').onclick=()=>{if(!navigator.geolocation)return setMsg('Este navegador no da la posición.','wa');
 navigator.geolocation.getCurrentPosition(p=>map.setView([p.coords.latitude,p.coords.longitude],15),()=>setMsg('No se pudo obtener tu posición (permiso denegado o sin señal).','wa'),{enableHighAccuracy:true,timeout:15000})};

// ---------- Arranque ----------
(function(){const h=decodeURIComponent(location.hash.slice(1));if(!h)return prof();const parts=h.split(';');
 if(parts[0]==='ver'){const c=(parts[1]||'').split(',').map(Number);if(c.length===2&&c.every(n=>!isNaN(n)))map.setView(c,13);history.replaceState(null,'',location.pathname);return prof()}
 if(MODES[parts[0]]){mode=parts[0];document.querySelectorAll('#mode button').forEach(x=>x.classList.toggle('on',x.dataset.m===mode));$('#modeTxt').textContent=MODES[mode].txt;
  if(mode!=='hike'){map.removeLayer(overs['Rutas señalizadas a pie (GR, PR, SL)']);map.addLayer(overs['Rutas señalizadas BTT'])}}
 wps=parts.slice(1).map(s=>s.split(',').map(Number)).filter(p=>p.length===2&&p.every(n=>!isNaN(n)));
 if(wps.length){drawWps();map.fitBounds(L.latLngBounds(wps),{padding:[40,40],maxZoom:15});fitOnce=true;route()}else prof()})();
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});

// El Sherpa 3D · funcionamiento sin conexión
// - La propia web: primero la red con 4 s de margen; si no contesta, lo guardado.
// - Librerías de jsdelivr: lo guardado primero (caché «sherpa-libs», que no se borra al cambiar de versión).
// - Datos de mapas y relieve (IGN, IDEE, OpenFreeMap, Waymarked Trails, OpenTopoMap): lo guardado primero;
//   lo nuevo va a «sherpa-auto», recortada a 2500 ficheros y sin ficheros de más de 3 MB.
//   El índice de OpenFreeMap (/planet) va siempre primero por la red, porque cambia de versión.
//   Las zonas guardadas a mano van a «sherpa-guardado», que no se recorta.
// - BRouter, Nominatim, Open-Meteo y las consultas de senderos: solo con conexión.
const SHELL='sherpa-web-v2',LIBS='sherpa-libs',AUTO='sherpa-auto',MAX_AUTO=2500,MAX_BYTES=3*1024*1024;
const FILES=['./','index.html','rutas.html','visor.js','rutas.js','comun.js','manifest.webmanifest','iconos/icono-192.png','iconos/icono-512.png',
 'perfiles/mtb.brf','perfiles/hiking-mountain.brf','perfiles/trekking.brf'];
const DATA=/(^|\.)(ign\.es|idee\.es|openfreemap\.org|waymarkedtrails\.org|opentopomap\.org)$/;
self.addEventListener('install',e=>{e.waitUntil(caches.open(SHELL).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n.startsWith('sherpa-web-')&&n!==SHELL).map(n=>caches.delete(n)))).then(()=>self.clients.claim()))});
let puts=0;
async function trim(){const c=await caches.open(AUTO);const k=await c.keys();if(k.length>MAX_AUTO)for(const r of k.slice(0,k.length-MAX_AUTO))await c.delete(r)}
const timeout=(p,ms)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('lento')),ms))]);
async function putIfSmall(cacheName,req,r){const b=await r.blob();if(b.size>MAX_BYTES)return;
 await (await caches.open(cacheName)).put(req,new Response(b,{status:r.status,statusText:r.statusText,headers:r.headers}));if(cacheName===AUTO&&++puts%100===0)trim()}
self.addEventListener('fetch',e=>{
 const req=e.request;if(req.method!=='GET')return;const u=new URL(req.url);
 if(u.origin===location.origin){
  e.respondWith(timeout(fetch(req),4000).then(r=>{if(r.ok){const cl=r.clone();caches.open(SHELL).then(c=>c.put(req,cl))}return r})
   .catch(()=>caches.match(req,{ignoreSearch:true}).then(r=>r||caches.match('index.html')).then(r=>r||fetch(req))));return}
 if(u.hostname==='cdn.jsdelivr.net'){
  e.respondWith(caches.match(req).then(m=>m||fetch(req).then(r=>{if(r.ok&&r.type!=='opaque'){const cl=r.clone();caches.open(LIBS).then(c=>c.put(req,cl))}return r})));return}
 if(u.hostname==='tiles.openfreemap.org'&&!u.pathname.endsWith('.pbf')){
  e.respondWith(fetch(req).then(r=>{if(r.ok){const cl=r.clone();caches.open(AUTO).then(c=>c.put(req,cl))}return r}).catch(()=>caches.match(req)));return}
 if(DATA.test(u.hostname)){
  e.respondWith(caches.match(req).then(m=>m||fetch(req).then(r=>{if(r.ok&&r.type!=='opaque')putIfSmall(AUTO,req,r.clone()).catch(()=>{});return r})));return}
});

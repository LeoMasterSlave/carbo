// Rete prima, cache come riserva offline: gli aggiornamenti arrivano subito.
// Lo scanner ZXing (js/vendor) non è precaricato: entra in cache al primo uso.
const V="carbo-beta-v12",F=["./","index.html","manifest.webmanifest","icon-180.png","icon-192.png","icon-512.png",
  "css/app.css","js/app.js","js/engine/ai.js","js/engine/fooddb.js","js/data/backup.js","js/data/library.js",
  "js/data/products.js","js/lib/barcode.js","js/features/reminders.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(F)).then(()=>self.skipWaiting()))});
// Cancella solo le versioni precedenti di QUESTA app: sullo stesso dominio possono vivere altre app (es. la beta).
const MINE=x=>x.replace(/\d+$/,"")===V.replace(/\d+$/,"");
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V&&MINE(x)).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET"||new URL(e.request.url).origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(V).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)));
});

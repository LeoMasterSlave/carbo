// Rete prima, cache come riserva offline: gli aggiornamenti arrivano subito.
// Le richieste saltano la cache HTTP del browser (GitHub Pages: max-age=600), così dopo un rilascio
// non si mescolano file vecchi e nuovi. Lo scanner ZXing (js/vendor) non è precaricato: entra in cache al primo uso.
const V="carbo-beta-v30",F=["./","index.html","manifest.webmanifest","icon-180.png","icon-192.png","icon-512.png",
  "css/app.css","js/app.js","js/engine/ai.js","js/engine/fooddb.js","js/engine/describe.js","js/data/backup.js","js/data/library.js",
  "js/data/restore.js","js/data/idb.js","js/data/csv.js",
  "js/data/products.js","js/data/catalog.js","data/foods-it.json","data/foods-crea.json","data/foods-stime.json","data/portions-it.json","js/lib/barcode.js","js/features/reminders.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(F.map(u=>new Request(u,{cache:"reload"})))).then(()=>self.skipWaiting()))});
// Cancella solo le versioni precedenti di QUESTA app: sullo stesso dominio possono vivere altre app (es. la beta).
const MINE=x=>x.replace(/\d+$/,"")===V.replace(/\d+$/,"");
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V&&MINE(x)).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const q=e.request;
  if(q.method!=="GET"||new URL(q.url).origin!==location.origin)return;
  // "no-cache": il browser chiede sempre conferma al server (304 se il file non è cambiato)
  const net=q.mode==="navigate"?new Request(q.url,{cache:"no-cache",credentials:"same-origin"}):new Request(q,{cache:"no-cache"});
  e.respondWith(fetch(net).then(r=>{const c=r.clone();caches.open(V).then(x=>x.put(q,c));return r}).catch(()=>caches.match(q)));
});

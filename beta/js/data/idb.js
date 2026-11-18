// Copia di sicurezza automatica in IndexedDB (decisione dell'utente, 18/11/2026).
// localStorage resta l'archivio principale (la v1 in produzione legge "carbo"): qui si conserva solo
// una copia delle stesse stringhe, per recuperare i dati se Safari svuota localStorage.
// Record: "latest" (ultima copia) e "day:AAAA-MM-GG" (una al giorno, ultime 7). Mai lancia errori.
const DB_NAME = "carbo-safety", STORE = "snap", KEEP_DAYS = 7;
const KEYS = ["carbo", "carbo_lib"];
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    if (typeof indexedDB === "undefined") return rej(new Error("no idb"));
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE) };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error("blocked"));
  }).catch(e => { dbp = null; throw e });
  return dbp;
}
const tx = (mode, fn) => open().then(db => new Promise((res, rej) => {
  const t = db.transaction(STORE, mode), s = t.objectStore(STORE);
  const out = fn(s);
  t.oncomplete = () => res(out && "result" in out ? out.result : undefined);
  t.onerror = t.onabort = () => rej(t.error);
}));
const ls = k => { try { return localStorage.getItem(k) } catch (e) { return null } };
const mealsIn = raw => { try { const o = JSON.parse(raw || "null"); return o && Array.isArray(o.meals) ? o.meals.length : 0 } catch (e) { return 0 } };
const day = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// true se localStorage non ha nessun dato di Carbo (né pasti né libreria): caso "svuotato dal sistema".
export const storageLooksCleared = () => KEYS.every(k => ls(k) == null);

// Salva la copia attuale. Non scrive se localStorage è vuoto: non si sovrascrive mai una copia buona con il niente.
let hold = false;
// In attesa della scelta dell'utente (recupera / inizia da zero) non si scrive: la copia buona resta intatta.
export const setSafetyHold = b => { hold = !!b };
export async function saveSafety() {
  if (hold || storageLooksCleared()) return false;
  const snap = { ts: Date.now(), carbo: ls("carbo"), carbo_lib: ls("carbo_lib"), meals: mealsIn(ls("carbo")) };
  try {
    await tx("readwrite", s => { s.put(snap, "latest"); s.put(snap, "day:" + day()) });
    const keys = await tx("readonly", s => s.getAllKeys());
    const days = (keys || []).filter(k => String(k).startsWith("day:")).sort();
    if (days.length > KEEP_DAYS) await tx("readwrite", s => days.slice(0, days.length - KEEP_DAYS).forEach(k => s.delete(k)));
    return true;
  } catch (e) { return false }
}
export async function readSafety() {
  try { return (await tx("readonly", s => s.get("latest"))) || null } catch (e) { return null }
}
// Riporta in localStorage la copia "latest". Solo le chiavi presenti nella copia.
export async function restoreSafety() {
  const c = await readSafety();
  if (!c) return null;
  try {
    for (const k of KEYS) if (c[k] != null) localStorage.setItem(k, c[k]);
    return c;
  } catch (e) { return null }
}

let timer = null;
// Copia ritardata: più salvataggi ravvicinati diventano una sola scrittura.
export function scheduleSafety(ms = 1500) { clearTimeout(timer); timer = setTimeout(saveSafety, ms) }
export const safetyMeals = mealsIn;

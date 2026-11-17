// Ripristino da backup (file creato da backup.js).
// Regole: si controlla tutto prima di toccare i dati; "Unisci" aggiunge solo ciò che manca e non
// modifica nulla di esistente; "Sostituisci" salva prima una copia di sicurezza dei dati attuali.
// I pasti restano nel formato v1 (localStorage["carbo"]), quindi la versione in produzione li legge.

import { BACKUP_FORMAT, SCHEMA_VERSION, checksum } from "./backup.js";
import { foodKey } from "./library.js";

const SAFE_KEY = "carbo_prerestore";
const num = x => typeof x === "number" && isFinite(x);

// Un pasto è accettato solo se ha la forma che l'app sa leggere; gli altri vengono contati e scartati.
function validMeal(m) {
  return m && typeof m === "object" && typeof m.id === "string" && m.id && num(m.ts) && m.ts > 0 &&
    typeof m.type === "string" && Array.isArray(m.items) && num(m.total) &&
    m.items.every(i => i && typeof i.n === "string" && num(i.g) && i.g >= 0 && num(i.c100) && i.c100 >= 0 && i.c100 <= 100);
}

// Legge e controlla il testo di un file di backup. Non modifica nulla.
export function parseBackup(text) {
  let o;
  try { o = JSON.parse(text) } catch (e) { return { ok: false, err: "Il file non è un backup leggibile (JSON non valido)." } }
  if (!o || o.format !== BACKUP_FORMAT || !o.data || typeof o.data !== "object")
    return { ok: false, err: "Questo file non è un backup di Carbo." };
  if (!(o.schemaVersion >= 1)) return { ok: false, err: "Versione del backup non riconosciuta." };
  if (o.schemaVersion > SCHEMA_VERSION)
    return { ok: false, err: "Il backup è stato creato da una versione più recente di Carbo: aggiorna l'app e riprova." };
  const d = o.data;
  const sumOk = !!(o.checksum && o.checksum.alg === "fnv1a32" && o.checksum.value === checksum(JSON.stringify(d)));
  const all = Array.isArray(d.meals) ? d.meals : [];
  const meals = all.filter(validMeal);
  const lib = d.library && typeof d.library === "object" ? d.library : null;
  const arr = x => Array.isArray(x) ? x : [];
  const ts = meals.map(m => m.ts);
  return {
    ok: true, sumOk, exportedAt: o.exportedAt || null, appVersion: o.appVersion || "?",
    meals, skipped: all.length - meals.length,
    goal: num(d.goal) && d.goal > 0 ? d.goal : null,
    library: lib ? {
      favorites: arr(lib.favorites).filter(f => f && f.n && num(f.c100)),
      recents: arr(lib.recents).filter(f => f && f.n && num(f.c100)),
      recipes: arr(lib.recipes).filter(r => r && r.id && r.n && Array.isArray(r.ingredients)),
      products: lib.products && typeof lib.products === "object" && !Array.isArray(lib.products) ? lib.products : {}
    } : null,
    settings: d.settings && typeof d.settings === "object" ? d.settings : {},
    from: ts.length ? Math.min(...ts) : null, to: ts.length ? Math.max(...ts) : null
  };
}

// Cosa succederebbe unendo il backup ai dati attuali (per l'anteprima).
export function mergePreview(state, lib, b) {
  const ids = new Set(state.meals.map(m => m.id));
  const newMeals = b.meals.filter(m => !ids.has(m.id)).length;
  const L = b.library || { favorites: [], recipes: [], products: {} };
  const fk = new Set(lib.favorites.map(foodKey)), rid = new Set(lib.recipes.map(r => r.id));
  return {
    newMeals, sameMeals: b.meals.length - newMeals,
    newFav: L.favorites.filter(f => !fk.has(foodKey(f))).length,
    newRcp: L.recipes.filter(r => !rid.has(r.id)).length,
    newProd: Object.keys(L.products).filter(k => !(lib.products || {})[k]).length
  };
}

// Unisci: aggiunge pasti (per id), preferiti (per alimento), ricette (per id) e prodotti (per EAN) mancanti.
// Nulla di esistente viene modificato. Restituisce nuovi oggetti; i dati vanno salvati dal chiamante.
export function mergeInto(state, lib, b) {
  const ids = new Set(state.meals.map(m => m.id));
  const meals = [...state.meals, ...b.meals.filter(m => !ids.has(m.id))].sort((x, y) => x.ts - y.ts);
  const L = b.library;
  let nl = lib;
  if (L) {
    const fk = new Set(lib.favorites.map(foodKey)), rid = new Set(lib.recipes.map(r => r.id));
    nl = {
      ...lib,
      favorites: [...lib.favorites, ...L.favorites.filter(f => !fk.has(foodKey(f)))],
      recipes: [...lib.recipes, ...L.recipes.filter(r => !rid.has(r.id))],
      products: { ...L.products, ...(lib.products || {}) }
    };
  }
  return { state: { ...state, meals, goal: state.goal ?? b.goal }, lib: nl };
}

// Sostituisci: i dati del backup prendono il posto di quelli attuali.
export function replaceWith(state, lib, b) {
  const L = b.library;
  return {
    state: { ...state, meals: b.meals.slice().sort((x, y) => x.ts - y.ts), goal: b.goal },
    lib: L ? { ...lib, favorites: L.favorites, recents: L.recents, recipes: L.recipes, products: L.products } : lib
  };
}

// Copia di sicurezza dei dati attuali prima di sostituirli (una sola, la più recente).
// Restituisce false se lo spazio non basta: in quel caso NON si deve sostituire.
export function saveSafetyCopy() {
  try {
    const copy = { ts: Date.now(), carbo: localStorage.getItem("carbo"), carbo_lib: localStorage.getItem("carbo_lib") };
    localStorage.setItem(SAFE_KEY, JSON.stringify(copy));
    return JSON.parse(localStorage.getItem(SAFE_KEY)).ts === copy.ts;
  } catch (e) { return false }
}
export function safetyCopy() {
  try { const o = JSON.parse(localStorage.getItem(SAFE_KEY) || "null"); return o && o.ts ? o : null } catch (e) { return null }
}
// Rimette i dati com'erano prima dell'ultima sostituzione.
export function restoreSafetyCopy() {
  const c = safetyCopy(); if (!c) return false;
  try {
    if (c.carbo == null) localStorage.removeItem("carbo"); else localStorage.setItem("carbo", c.carbo);
    if (c.carbo_lib == null) localStorage.removeItem("carbo_lib"); else localStorage.setItem("carbo_lib", c.carbo_lib);
    return true;
  } catch (e) { return false }
}

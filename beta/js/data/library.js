// Libreria personale: preferiti, recenti e ricette.
// Salvata in localStorage["carbo_lib"], separata dai pasti (localStorage["carbo"], formato v1 invariato).
//
// Regola dello snapshot: preferiti, recenti e ricette conservano i propri valori (nome, CHO/100, unità).
// I pasti salvati copiano questi valori al momento della registrazione: modificare una ricetta
// o un preferito non cambia mai lo storico.

const KEY = "carbo_lib";
export const LIB_VERSION = 1;
const MAX_RECENTS = 15;

// products: {ean: {n, brand, c100, u, serving, src:"off"|"manual", ts}} — prodotti scansionati o inseriti a mano
const empty = () => ({ v: LIB_VERSION, favorites: [], recents: [], recipes: [], products: {} });
let readOnly = false; // libreria scritta da una versione più recente: non la sovrascrivo

export function loadLib() {
  let raw = null;
  try { raw = localStorage.getItem(KEY) } catch (e) { return empty() }
  if (!raw) return empty();
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") throw 0;
    if (o.v > LIB_VERSION) { readOnly = true }
    return {
      ...empty(), ...o,
      favorites: Array.isArray(o.favorites) ? o.favorites : [],
      recents: Array.isArray(o.recents) ? o.recents : [],
      recipes: Array.isArray(o.recipes) ? o.recipes : [],
      products: o.products && typeof o.products === "object" && !Array.isArray(o.products) ? o.products : {}
    };
  } catch (e) {
    // dati illeggibili: li metto da parte invece di cancellarli
    try { localStorage.setItem(KEY + "_corrupt_" + Date.now(), raw) } catch (_) {}
    return empty();
  }
}
export function saveLib(lib) {
  if (readOnly) return false;
  try { localStorage.setItem(KEY, JSON.stringify(lib)); return true } catch (e) { return false }
}
export const isReadOnly = () => readOnly;

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const r2 = x => Math.round(x * 100) / 100;

// ---- alimenti
// Uno "snapshot" di alimento: {n, c100, u, ref?}. ref = nome della voce nel database interno.
export function snapFood(i) {
  const f = { n: String(i.n).slice(0, 80), c100: r2(+i.c100 || 0), u: i.u === "ml" ? "ml" : "g" };
  if (i.db) f.ref = i.db;
  if (i.ean) f.ean = i.ean;
  if (i.cid) f.cid = i.cid; // voce del catalogo esterno (es. "usda:171719"), distinta da ref
  if (i.pz && i.pz.w > 0) f.pz = { w: i.pz.w, l: i.pz.l === "porzione" ? "porzione" : "pezzo", ...(i.pz.t ? { t: String(i.pz.t).slice(0, 60) } : {}) };
  return f;
}
export const foodKey = f => f.ref ? "db:" + f.ref : f.cid ? "c:" + f.cid + "|" + r2(f.c100) : "n:" + String(f.n).toLowerCase().trim() + "|" + r2(f.c100) + "|" + (f.u || "g");

// ---- preferiti {id, n, c100, u, ref?, g}
export function findFav(lib, item) { const k = foodKey(snapFood(item)); return lib.favorites.find(f => foodKey(f) === k) || null }
export function addFav(lib, item) {
  const ex = findFav(lib, item);
  if (ex) { if (item.g > 0) ex.g = r2(item.g); return ex }
  const f = { id: uid(), ...snapFood(item), g: item.g > 0 ? r2(item.g) : 0 };
  lib.favorites.unshift(f);
  return f;
}
export function removeFav(lib, id) {
  const k = lib.favorites.findIndex(f => f.id === id);
  return k < 0 ? null : { item: lib.favorites.splice(k, 1)[0], index: k };
}

// ---- recenti {n, c100, u, ref?, g, ts}: derivati dai pasti salvati, mai scelti a mano
export function pushRecents(lib, items, ts = Date.now()) {
  for (const i of items) {
    if (i.rid || !(i.g > 0)) continue; // le ricette hanno il loro elenco
    const f = { ...snapFood(i), g: r2(i.g), ts };
    const k = foodKey(f);
    lib.recents = [f, ...lib.recents.filter(x => foodKey(x) !== k)];
  }
  lib.recents = lib.recents.slice(0, MAX_RECENTS);
}

// ---- ricette {id, n, photo?, servings, ingredients:[{n,g,u,c100,ref?}], created, updated}
export function recipeStats(r) {
  const ing = r.ingredients || [];
  const w = ing.reduce((s, i) => s + (+i.g || 0), 0);
  const cho = ing.reduce((s, i) => s + (+i.g || 0) * (+i.c100 || 0) / 100, 0);
  const sv = Math.max(1, +r.servings || 1);
  return { w, cho, servings: sv, servW: w / sv, servCho: cho / sv, c100: w > 0 ? cho / w * 100 : 0 };
}
export function newRecipe(name, servings, items) {
  const now = Date.now();
  return {
    id: uid(), n: String(name).trim().slice(0, 80), servings: Math.max(1, Math.round(+servings || 1)),
    ingredients: items.filter(i => i.g > 0).map(i => ({ ...snapFood(i), g: r2(i.g) })),
    created: now, updated: now
  };
}
// Elemento del piatto per una porzione di ricetta: un solo alimento con il peso della porzione.
export function recipePlateItem(r, portions = 1) {
  const s = recipeStats(r);
  return { n: r.n, g: Math.round(s.servW * portions), u: "g", c100: r2(s.c100), rid: r.id, ask: [], cand: [], typ: Math.round(s.servW) };
}

export function libCounts(lib) { return { favorites: lib.favorites.length, recipes: lib.recipes.length, recents: lib.recents.length } }

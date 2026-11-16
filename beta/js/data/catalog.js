// Catalogo alimenti da fonti esterne (beta/data/foods-it.json, generato da tools/usda/build.mjs).
// SEPARATO dal DB del motore AI (js/engine/fooddb.js): qui non si importa né si modifica DB,
// quindi il riconoscimento delle foto non cambia. Usato solo da ricerca e inserimento manuale.
// Base dei valori: c100 = g di carboidrati disponibili per 100 g di parte edibile.

const URL_CAT = new URL("../../data/foods-it.json", import.meta.url);
let foods = [], byCid = new Map(), loading = null;

const validUnit = u => u && typeof u.t === "string" && u.w > 0 && u.w <= 2000;
const valid = f => f && typeof f.cid === "string" && /^[a-z]+:\S+$/.test(f.cid) && f.n && f.c100 >= 0 && f.c100 <= 100;

// Carica una sola volta; se la rete manca riprova alla chiamata successiva. Non lancia mai.
export function loadCatalog() {
  if (!loading) loading = fetch(URL_CAT).then(r => r.ok ? r.json() : null).then(j => {
    if (!j || j.format !== "carbo-catalog" || !Array.isArray(j.foods)) throw new Error("catalogo non valido");
    foods = j.foods.filter(valid).map(f => ({ ...f, u: f.u === "ml" ? "ml" : "g", units: (f.units || []).filter(validUnit) }));
    byCid = new Map(foods.map(f => [f.cid, f]));
    return foods;
  }).catch(() => { loading = null; return foods });
  return loading;
}
export const catalogFoods = () => foods;
export const catByCid = cid => byCid.get(cid) || null;

// Provenienza: prefisso dell'identificativo ("usda:171719" → "usda").
export const SRC_LABEL = { usda: "USDA", crea: "CREA", off: "OFF", db: "Carbo", manual: "Mio" };
export const srcOf = cid => String(cid || "").split(":")[0];

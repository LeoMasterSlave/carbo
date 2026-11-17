// Catalogo alimenti da fonti esterne (beta/data/foods-it.json, generato da tools/usda/build.mjs).
// SEPARATO dal DB del motore AI (js/engine/fooddb.js): qui non si importa né si modifica DB,
// quindi il riconoscimento delle foto non cambia. Usato solo da ricerca e inserimento manuale.
// Base dei valori: c100 = g di carboidrati disponibili per 100 g di parte edibile.

// Due file: foods-it.json (USDA, verificato) e foods-stime.json (elenco dell'utente, tools/userdb/build.mjs:
// stime "est:" ed etichette "lab:", con intervallo), più foods-crea.json (tabelle CREA "crea:", tools/crea/build.mjs).
// Il primo ha la precedenza in caso di cid uguale.
const URL_CATS = ["../../data/foods-it.json", "../../data/foods-crea.json", "../../data/foods-stime.json"].map(p => new URL(p, import.meta.url));
let foods = [], byCid = new Map(), fileDbPortions = new Map(), loading = null;

const validUnit = u => u && typeof u.t === "string" && u.w > 0 && u.w <= 2000;
const validRange = r => Array.isArray(r) && r.length === 2 && r[0] >= 0 && r[1] >= r[0];
const valid = f => f && typeof f.cid === "string" && /^[a-z]+:\S+$/.test(f.cid) && f.n && f.c100 >= 0 && f.c100 <= 100;
const cleanUnit = u => ({ t: u.t, w: u.w, l: u.l === "pezzo" ? "pezzo" : "porzione", ...(u.base ? { base: u.base } : {}), ...(u.src ? { src: u.src } : {}), ...(validRange(u.r) ? { r: u.r } : {}) });
const getCat = url => fetch(url).then(r => r.ok ? r.json() : null).then(j => {
  if (!j || j.format !== "carbo-catalog" || !Array.isArray(j.foods)) throw new Error("catalogo non valido");
  return j;
});

// Carica una sola volta; un file che manca non blocca l'altro; se la rete manca riprova alla chiamata successiva. Non lancia mai.
export function loadCatalog() {
  if (!loading) loading = Promise.allSettled(URL_CATS.map(getCat)).then(rs => {
    const ok = rs.filter(r => r.status === "fulfilled").map(r => r.value);
    if (!ok.length) throw new Error("catalogo non disponibile");
    const seen = new Set(), all = [];
    for (const j of ok) for (const f of j.foods.filter(valid)) {
      if (seen.has(f.cid)) continue; seen.add(f.cid);
      all.push({ ...f, u: f.u === "ml" ? "ml" : "g", units: (f.units || []).filter(validUnit).map(cleanUnit),
        ...(validRange(f.rng) ? { rng: f.rng } : { rng: undefined }), rel: f.rel === "etichetta" || f.rel === "stima" ? f.rel : undefined });
    }
    foods = all;
    byCid = new Map(foods.map(f => [f.cid, f]));
    // porzioni del file per voci del DB del motore: solo il peso (i carboidrati restano quelli del DB)
    fileDbPortions = new Map();
    for (const j of ok) for (const [k, v] of Object.entries(j.dbPortions || {}))
      fileDbPortions.set(k, (Array.isArray(v) ? v : []).filter(validUnit).map(u => ({ t: u.t, w: u.w, l: u.l === "pezzo" ? "pezzo" : "porzione", src: "file" })));
    if (rs.some(r => r.status === "rejected")) loading = null; // un file mancante si riprova più tardi
    return foods;
  }).catch(() => { loading = null; return foods });
  return loading;
}
export const catalogFoods = () => foods;
export const catByCid = cid => byCid.get(cid) || null;

// Porzioni standard (beta/data/portions-it.json, LARN 2014) per le voci del DB del motore, per nome.
// Solo suggerimenti mostrati come pulsanti: non cambiano DB, matching o pesi stimati dall'AI.
const URL_POR = new URL("../../data/portions-it.json", import.meta.url);
let portions = new Map(), porLoading = null;
export function loadPortions() {
  if (!porLoading) porLoading = fetch(URL_POR).then(r => r.ok ? r.json() : null).then(j => {
    if (!j || j.format !== "carbo-portions" || !j.map) throw new Error("porzioni non valide");
    const src = j.source && j.source.id || "larn";
    portions = new Map(Object.entries(j.map).map(([k, v]) => [k, (Array.isArray(v) ? v : []).filter(validUnit)
      .map(u => ({ t: u.t, w: u.w, l: u.l === "pezzo" ? "pezzo" : "porzione", src }))]).filter(([, v]) => v.length));
    return portions;
  }).catch(() => { porLoading = null; return portions });
  return porLoading;
}
// LARN prima, poi le porzioni del file con un peso diverso (porzioni alternative legittime).
export const portionsFor = name => {
  const a = portions.get(name) || [], b = (fileDbPortions.get(name) || []).filter(x => !a.some(y => y.w === x.w));
  return a.length || b.length ? [...a, ...b] : null;
};
// Testo sotto i pulsanti di porzione, in base alla provenienza.
export function portionSourceText(us) {
  const s = new Set((us || []).map(u => u.src));
  const larn = s.has("larn2014"), file = s.has("file");
  return larn && file ? "porzioni: LARN e tuo elenco" : larn ? "porzioni standard LARN" : file ? "porzioni dal tuo elenco" : "";
}

// Provenienza: prefisso dell'identificativo ("usda:171719" → "usda").
// est = stima dal file dell'utente, lab = etichetta del produttore riportata nel file.
export const SRC_LABEL = { usda: "USDA", crea: "CREA", off: "OFF", db: "Carbo", manual: "Mio", est: "Stima", lab: "Etichetta" };
export const srcOf = cid => String(cid || "").split(":")[0];

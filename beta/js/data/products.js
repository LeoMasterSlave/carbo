// Prodotti confezionati da codice a barre.
// Ordine di ricerca: prodotti salvati sul telefono (inseriti o corretti a mano) → Open Food Facts.
// A Open Food Facts viene inviato solo il codice a barre.

const OFF = "https://world.openfoodfacts.org/api/v2/product/";
const FIELDS = "code,product_name,product_name_it,generic_name_it,brands,quantity,nutriments,serving_quantity,serving_size";

export class ProductError extends Error { constructor(code, msg) { super(msg); this.code = code } }

const num = v => (v === "" || v == null || isNaN(+v)) ? null : +v;
const dec = s => +String(s).replace(",", ".");

// Peso di un pezzo (merendina, biscotto…) o di una porzione, dai dati della confezione.
// Restituisce {w, l:"pezzo"|"porzione"} oppure null. Solo grammi: per i liquidi resta il volume.
const PIECE = /biscott|merendin|pezz|barrett|snack|wafer|unit|piece|biscuit|bar\b|cookie|tortin|cornett|brioch|fett|crostatin|pacchett|monoporz/i;
export function pieceOf(p) {
  const qt = String(p.quantity || ""), sv = String(p.serving_size || "");
  // confezioni multiple: "10 x 30 g", "6×35g"
  const mp = qt.match(/(\d+)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*g\b/i);
  if (mp && dec(mp[2]) > 0) return { w: dec(mp[2]), l: "pezzo" };
  // "2 biscotti (25 g)", "1 merendina (35 g)", "1 portion (30 g)"
  const m = sv.match(/^\s*(\d+(?:[.,]\d+)?)\s*([^\d(]*?)\s*\(\s*(\d+(?:[.,]\d+)?)\s*g\s*\)/i);
  if (m && dec(m[1]) > 0 && dec(m[3]) > 0) {
    const n = dec(m[1]), w = dec(m[3]) / n;
    return { w: Math.round(w * 10) / 10, l: PIECE.test(m[2]) ? "pezzo" : n === 1 ? "porzione" : "pezzo" };
  }
  // porzione senza conteggio: "30 g", "30.0g"
  const sq = num(p.serving_quantity);
  if (sq > 0 && sq <= 500 && (!sv || /^\s*\d+(?:[.,]\d+)?\s*g\s*$/i.test(sv))) return { w: Math.round(sq * 10) / 10, l: "porzione" };
  return null;
}

// Normalizza la risposta di Open Food Facts. c100 = null se il dato manca o non è plausibile.
export function parseOFF(p, code) {
  const n = String(p.product_name_it || p.product_name || p.generic_name_it || "").trim().slice(0, 80);
  const brand = String(p.brands || "").split(",")[0].trim().slice(0, 40);
  const nu = p.nutriments || {};
  let c = num(nu.carbohydrates_100g);
  if (c == null && num(nu.carbohydrates) != null && (nu.carbohydrates_unit || "g") === "g") c = num(nu.carbohydrates);
  if (!(c >= 0 && c <= 100)) c = null;
  const u = /\b\d+(?:[.,]\d+)?\s*(ml|cl|dl|l)\b/i.test(p.quantity || "") ? "ml" : "g";
  const pz = u === "g" ? pieceOf(p) : null;
  return { ean: code, n: n || "", brand, c100: c == null ? null : Math.round(c * 10) / 10, u, serving: num(p.serving_quantity), pz, src: "off" };
}

export async function fetchOFF(code, { timeout = 10000 } = {}) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(`${OFF}${encodeURIComponent(code)}.json?fields=${FIELDS}`, { signal: ctl.signal });
    if (res.status === 404) return null;
    if (!res.ok) throw new ProductError("http", res.status === 429 ? "Troppe ricerche: riprova tra un minuto." : "Open Food Facts non risponde ora.");
    const j = await res.json().catch(() => null);
    if (!j || j.status !== 1 || !j.product) return null;
    return parseOFF(j.product, code);
  } catch (e) {
    if (e instanceof ProductError) throw e;
    if (e && e.name === "AbortError") throw new ProductError("timeout", "Open Food Facts sta impiegando troppo tempo.");
    throw new ProductError("offline", "Nessuna connessione: inserisci i valori a mano.");
  } finally { clearTimeout(t) }
}

// Cerca prima tra i prodotti salvati, poi online. Restituisce {product|null, from:"local"|"off"|null}.
export async function lookupProduct(lib, code) {
  const local = lib.products && lib.products[code];
  if (local) return { product: { ...local, ean: code }, from: "local" };
  const p = await fetchOFF(code);
  return { product: p, from: p ? "off" : null };
}

// Salva o aggiorna un prodotto sul telefono. Se l'utente ha cambiato i valori, la fonte diventa "manual".
export function rememberProduct(lib, p, edited) {
  if (!lib.products || typeof lib.products !== "object") lib.products = {};
  lib.products[p.ean] = {
    n: String(p.n).trim().slice(0, 80), brand: p.brand || "", c100: Math.round((+p.c100 || 0) * 10) / 10,
    u: p.u === "ml" ? "ml" : "g", serving: p.serving || null, pz: cleanPz(p.pz), src: edited ? "manual" : (p.src || "manual"), ts: Date.now()
  };
}
// {w,l} valido (peso del pezzo tra 0,1 e 1000 g) oppure null.
export function cleanPz(pz) {
  const w = pz && Math.round(+pz.w * 10) / 10;
  // t = descrizione facoltativa della porzione scelta (es. "1 medio (Ø 6,4 cm)")
  return w >= 0.1 && w <= 1000 ? { w, l: pz.l === "porzione" ? "porzione" : "pezzo", ...(pz.t ? { t: String(pz.t).slice(0, 60) } : {}) } : null;
}
export const pzPlural = (l, n) => l === "porzione" ? (n === 1 ? "porzione" : "porzioni") : (n === 1 ? "pezzo" : "pezzi");

export const productLabel = p => p.brand && !String(p.n).toLowerCase().includes(p.brand.toLowerCase()) ? `${p.n} (${p.brand})` : p.n;

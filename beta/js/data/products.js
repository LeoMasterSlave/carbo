// Prodotti confezionati da codice a barre.
// Ordine di ricerca: prodotti salvati sul telefono (inseriti o corretti a mano) → Open Food Facts.
// A Open Food Facts viene inviato solo il codice a barre.

const OFF = "https://world.openfoodfacts.org/api/v2/product/";
const FIELDS = "code,product_name,product_name_it,generic_name_it,brands,quantity,nutriments,serving_quantity";

export class ProductError extends Error { constructor(code, msg) { super(msg); this.code = code } }

const num = v => (v === "" || v == null || isNaN(+v)) ? null : +v;

// Normalizza la risposta di Open Food Facts. c100 = null se il dato manca o non è plausibile.
export function parseOFF(p, code) {
  const n = String(p.product_name_it || p.product_name || p.generic_name_it || "").trim().slice(0, 80);
  const brand = String(p.brands || "").split(",")[0].trim().slice(0, 40);
  const nu = p.nutriments || {};
  let c = num(nu.carbohydrates_100g);
  if (c == null && num(nu.carbohydrates) != null && (nu.carbohydrates_unit || "g") === "g") c = num(nu.carbohydrates);
  if (!(c >= 0 && c <= 100)) c = null;
  const u = /\b\d+(?:[.,]\d+)?\s*(ml|cl|dl|l)\b/i.test(p.quantity || "") ? "ml" : "g";
  return { ean: code, n: n || "", brand, c100: c == null ? null : Math.round(c * 10) / 10, u, serving: num(p.serving_quantity), src: "off" };
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
    u: p.u === "ml" ? "ml" : "g", serving: p.serving || null, src: edited ? "manual" : (p.src || "manual"), ts: Date.now()
  };
}

export const productLabel = p => p.brand && !String(p.n).toLowerCase().includes(p.brand.toLowerCase()) ? `${p.n} (${p.brand})` : p.n;

// Test automatici di Carbo 2.0 (beta). Uso:  node tools/test/run.mjs
// Non usano rete né browser: localStorage, FileReader e fetch dei file locali sono simulati qui.
// Tutti devono essere verdi prima della promozione (Fase 5.13). Exit code 1 se un test fallisce.
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BETA = join(ROOT, "beta");
const mod = p => import(pathToFileURL(join(BETA, p)).href);

// ---- ambiente simulato
const store = new Map();
globalThis.localStorage = {
  getItem: k => store.has(k) ? store.get(k) : null,
  setItem: (k, v) => { store.set(k, String(v)) },
  removeItem: k => { store.delete(k) },
  clear: () => store.clear()
};
globalThis.FileReader = class { readAsDataURL(b) { b.arrayBuffer().then(a => { this.result = "data:" + (b.type || "") + ";base64," + Buffer.from(a).toString("base64"); this.onload() }, e => this.onerror(e)) } };
const realFetch = globalThis.fetch;
let aiCalls = [], aiReply = null;
globalThis.fetch = async (u, o) => {
  const s = String(u);
  if (s.startsWith("file:")) { try { return new Response(readFileSync(fileURLToPath(s)), { status: 200 }) } catch (e) { return new Response("", { status: 404 }) } }
  if (s.includes("generativelanguage")) {
    aiCalls.push({ u: s, b: JSON.parse(o.body) });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(aiReply) }] } }] }), { status: 200, headers: { "content-type": "application/json" } });
  }
  throw new TypeError("rete non disponibile nei test: " + s);
};

let pass = 0, fail = 0;
const ok = (name, cond, info = "") => { if (cond) { pass++; console.log("  ✓ " + name) } else { fail++; console.log("  ✗ " + name + (info ? "  → " + info : "")) } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) } return (h >>> 0).toString(16).padStart(8, "0") };

// ---- 1. Motore AI invariato (stessa prova usata dal 16/11/2026 nel browser)
console.log("1. Motore AI (ai.js, fooddb.js)");
{
  aiReply = { items: [
    { nome: "Spaghetti al pomodoro", grammi: 250, unita: "g", cho_per_100g: 25, confidenza_alimento: "alta", confidenza_peso: "media" },
    { nome: "Pane", grammi: 40, unita: "g", cho_per_100g: 50, confidenza_alimento: "alta", confidenza_peso: "alta" },
    { nome: "Coca cola", grammi: 330, unita: "g", cho_per_100g: 11, confidenza_alimento: "alta", confidenza_peso: "alta" },
    { nome: "Focaccia", grammi: null, unita: "g", cho_per_100g: 40, confidenza_alimento: "media", confidenza_peso: "bassa", domanda: "Quanto pesa?" }] };
  store.clear(); store.set("carbo_prov", "gemini"); store.set("carbo_key_gemini", "TEST-FAKE");
  aiCalls = [];
  const ai = await mod("js/engine/ai.js");
  const r = await ai.analyzePhoto(new Blob([new Uint8Array([255, 216, 255, 217])], { type: "image/jpeg" }), "", () => {});
  const b = aiCalls[0].b, texts = b.contents[0].parts.filter(p => p.text).map(p => p.text).join("\n");
  const items = r.items.map(i => [i.c100, i.g]);
  const total = Math.round(r.items.reduce((s, i) => s + i.g * i.c100 / 100, 0) * 10) / 10;
  ok("hash del prompt = 5a9885b0", fnv(texts) === "5a9885b0", fnv(texts));
  ok("primo modello = gemini-2.5-flash-lite", r.model === "gemini-2.5-flash-lite", r.model);
  ok("totale = 133,1 g", total === 133.1, String(total));
  ok("voci = 31/250 g, 55/40 g, 10,6/317,3 ml, 45/0 g", eq(items, [[31, 250], [55, 40], [10.6, 317.3], [45, 0]]), JSON.stringify(items));
}

// ---- 2. Descrivi il piatto: stessi passaggi del motore (fromAI), domanda sul peso riscritta
console.log("2. Descrivi il piatto (describe.js)");
{
  aiReply = { items: [{ nome: "Pane", grammi: 40, unita: "g", cho_per_100g: 50, confidenza_alimento: "alta", confidenza_peso: "alta" }] };
  aiCalls = [];
  const { describeMeal } = await mod("js/engine/describe.js");
  const r = await describeMeal("due fette di pane", () => {}, [{ q: "Quanto?", a: "40 g" }]);
  const prompt = aiCalls[0].b.contents[0].parts.map(p => p.text).join("");
  ok("una chiamata solo testo, con il testo dell'utente", aiCalls.length === 1 && prompt.includes("due fette di pane") && !aiCalls[0].b.contents[0].parts.some(p => p.inline_data));
  ok("chiarimenti dell'utente nel prompt", prompt.includes("40 g"));
  ok("Pane riconosciuto dal DB (55 g/100 g)", r.items.length === 1 && r.items[0].c100 === 55, JSON.stringify(r.items[0]));
}

// ---- 3. Backup → ripristino → stessi dati
console.log("3. Backup e ripristino");
{
  store.clear();
  const { buildBackup } = await mod("js/data/backup.js");
  const { parseBackup, replaceWith, mergeInto } = await mod("js/data/restore.js");
  const state = { goal: 180, meals: [
    { id: "m1", ts: 1763400000000, type: "Pranzo", total: 77.5, items: [{ n: "Pasta cruda", g: 100, u: "g", c100: 72, ref: "Pasta cruda" }, { n: "Pane", g: 10, u: "g", c100: 55 }] },
    { id: "m2", ts: 1763420000000, type: "Cena", total: 30, items: [{ n: "Riso", g: 100, u: "g", c100: 30, cid: "crea:1", pz: { w: 100, l: "porzione" } }] }] };
  const lib = { v: 1, favorites: [{ id: "f1", n: "Pane", c100: 55, u: "g", g: 50 }], recents: [], recipes: [{ id: "r1", n: "Lasagna", ingredients: [{ n: "Pasta", g: 100, c100: 72 }], servings: 4 }], products: { "8000000000001": { n: "Biscotti", c100: 70, u: "g", src: "off" } }, foodEdits: { "crea:120010": { c100: 2 } } };
  const text = JSON.stringify(buildBackup(state, lib));
  const b = parseBackup(text);
  ok("backup leggibile, checksum valido", b.ok && b.sumOk);
  const rep = replaceWith({ meals: [], goal: null }, { v: 1, favorites: [], recents: [], recipes: [], products: {}, foodEdits: {} }, b);
  ok("Sostituisci riporta pasti e obiettivo identici", eq(rep.state.meals, state.meals) && rep.state.goal === 180);
  ok("Sostituisci riporta preferiti, ricette, prodotti, correzioni", eq(rep.lib.favorites, lib.favorites) && eq(rep.lib.recipes, lib.recipes) && eq(rep.lib.products, lib.products) && eq(rep.lib.foodEdits, lib.foodEdits));
  const m = mergeInto(state, lib, b);
  ok("Unisci con gli stessi dati non duplica nulla", m.state.meals.length === 2 && m.lib.favorites.length === 1 && m.lib.recipes.length === 1);
  const bad = parseBackup(text.replace('"total":77.5', '"total":78.5'));
  ok("file alterato: checksum non valido segnalato", bad.ok && !bad.sumOk);
  ok("file non Carbo rifiutato", !parseBackup('{"a":1}').ok);
}

// ---- 4. Correzioni degli alimenti (Correggi alimenti)
console.log("4. Correggi alimenti (catalog.js)");
{
  const cat = await mod("js/data/catalog.js");
  await cat.loadCatalog();
  const n0 = cat.catalogFoods().length;
  ok("cataloghi caricati (USDA + CREA + elenco)", n0 > 900, String(n0));
  const v = cat.cleanFoodEdit({ n: "  Alici  ", c100: "2.04", units: [{ t: "piatto", w: 120 }, { t: "", w: 5 }, { t: "troppo", w: 5000 }], hidden: false });
  ok("validazione: nome ripulito, c100 arrotondato, porzioni non valide scartate", eq(v, { n: "Alici", c100: 2, units: [{ t: "piatto", w: 120 }] }), JSON.stringify(v));
  ok("validazione: c100 fuori 0–100 ignorato", cat.cleanFoodEdit({ c100: 140 }) === null);
  const id = "crea:120010", orig = cat.catOriginal(id);
  cat.setFoodEdits({ [id]: { c100: 9.9, n: "Alice (mia)" } });
  const e = cat.catByCid(id);
  ok("correzione applicata alla voce", e.c100 === 9.9 && e.n === "Alice (mia)" && e.edited);
  ok("valore originale del file invariato", cat.catOriginal(id).c100 === orig.c100);
  cat.setFoodEdits({ [id]: { hidden: true } });
  ok("voce nascosta esclusa dalla ricerca ma leggibile per cid", !cat.catalogFoods().some(f => f.cid === id) && !!cat.catByCid(id));
  cat.setFoodEdits({});
  ok("senza correzioni torna come nel file", cat.catalogFoods().length === n0 && cat.catByCid(id).c100 === orig.c100);
}

// ---- 5. Normalizzazione CREA e cataloghi leggeri
console.log("5. Dati CREA e cataloghi dell'app");
{
  const full = JSON.parse(readFileSync(join(BETA, "data", "fonti", "foods-crea.json"), "utf8")).foods;
  const val = s => s === "tr" ? 0 : s === "" || s == null ? null : +String(s).replace(",", ".");
  const r1 = x => Math.round(x * 10) / 10;
  const wrong = full.filter(f => { const p = val(f.src.orig.cho100), z = val(f.src.orig.zuc100); return f.c100 !== (z >= p ? p : r1((p - z) / 1.1 + z)) });
  ok(`CREA: c100 = amido + zuccheri per tutte le ${full.length} voci`, wrong.length === 0, wrong.slice(0, 3).map(f => f.cid).join(", "));
  const basmati = full.find(f => /basmati/i.test(f.n) && /crud/i.test(f.n));
  ok("CREA: riso basmati crudo 75,5 (pubblicato 82,9)", !!basmati && basmati.c100 === 75.5, basmati && String(basmati.c100));
  ok("CREA: zucchero da tavola escluso", !full.some(f => /^zucchero$/i.test(f.n)));
  for (const name of ["foods-it.json", "foods-crea.json", "foods-stime.json"]) {
    const a = JSON.parse(readFileSync(join(BETA, "data", "fonti", name), "utf8")).foods;
    const s = JSON.parse(readFileSync(join(BETA, "data", name), "utf8")).foods;
    ok(`${name}: versione dell'app = completa senza provenienza`, eq(a.map(({ src, ...x }) => x), s) && !s.some(f => f.src));
  }
}

// ---- 6. Libreria: dati vecchi e danneggiati
console.log("6. Libreria (library.js)");
{
  store.clear();
  store.set("carbo_lib", JSON.stringify({ v: 1, favorites: [{ id: "f", n: "Pane", c100: 55 }], recents: [], recipes: [] }));
  const L = await import(pathToFileURL(join(BETA, "js/data/library.js")).href + "?a");
  const a = L.loadLib();
  ok("libreria precedente ad alpha.16: preferiti conservati, correzioni vuote", a.favorites.length === 1 && eq(a.foodEdits, {}) && eq(a.products, {}));
  store.set("carbo_lib", "{rotto");
  const b = L.loadLib();
  ok("libreria illeggibile: messa da parte, non cancellata", b.favorites.length === 0 && [...store.keys()].some(k => k.startsWith("carbo_lib_corrupt_")));
  store.set("carbo_lib", JSON.stringify({ v: 99, favorites: [] }));
  const L2 = await import(pathToFileURL(join(BETA, "js/data/library.js")).href + "?b");
  L2.loadLib();
  ok("libreria di una versione più recente: non sovrascritta", L2.saveLib(L2.loadLib()) === false && JSON.parse(store.get("carbo_lib")).v === 99);
}

// ---- 7. File protetti e versioni
console.log("7. File protetti e versioni");
{
  const sw = readFileSync(join(BETA, "sw.js"), "utf8"), bk = readFileSync(join(BETA, "js/data/backup.js"), "utf8");
  const precache = JSON.parse("[" + sw.match(/F=\[([\s\S]*?)\];/)[1] + "]");
  const missing = precache.filter(p => p !== "./" && (() => { try { readFileSync(join(BETA, p)); return false } catch (e) { return true } })());
  ok("ogni file precaricato dal service worker esiste", missing.length === 0, missing.join(", "));
  ok("versione del SW e dell'app presenti", /carbo-beta-v\d+/.test(sw) && /APP_VERSION = "2\.0\.0-/.test(bk));
  const prodSw = readFileSync(join(ROOT, "sw.js"), "utf8");
  ok("produzione: SW ancora carbo-v8 (non toccata dalla beta)", /carbo-v8/.test(prodSw));
}

globalThis.fetch = realFetch;
console.log(`\n${pass} superati, ${fail} falliti`);
process.exit(fail ? 1 : 0);

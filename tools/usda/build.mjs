// Preparazione dati USDA FoodData Central (SR Legacy, CC0) per il catalogo Carbo.
// NON fa parte dell'app: gira in locale con Node e produce un file di candidati da rivedere.
//
// Uso:
//   node tools/usda/build.mjs find <cartella-csv> "apples, raw"   → cerca descrizioni e mostra i CHO
//   node tools/usda/build.mjs build <cartella-csv>                → legge selection.json, scrive usda-candidates.json
//
// <cartella-csv> = FoodData_Central_sr_legacy_food_csv_2018-04 estratto (scaricabile da fdc.nal.usda.gov).
// Normalizzazione approvata: c100 = "Carbohydrate, by difference" − "Fiber, total dietary" (g/100 g parte edibile).

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const NUT = { 1005: "cbd", 1079: "fiber", 2000: "sugars", 1009: "starch", 1051: "water" };
const DATASET = "USDA FoodData Central, SR Legacy (04/2018)";

// CSV con virgolette doppie (formato FDC).
function* rows(file) {
  const txt = readFileSync(file, "utf8");
  let i = 0, row = [], f = "", q = false, head = null;
  const push = () => { row.push(f); f = "" };
  for (; i <= txt.length; i++) {
    const ch = txt[i];
    if (q) { if (ch === '"') { if (txt[i + 1] === '"') { f += '"'; i++ } else q = false } else f += ch; continue }
    if (ch === '"') q = true;
    else if (ch === ",") push();
    else if (ch === "\n" || ch === undefined) {
      if (f !== "" || row.length) { push(); if (!head) head = row; else yield Object.fromEntries(head.map((h, k) => [h, row[k]])) }
      row = []; if (ch === undefined) break;
    } else if (ch !== "\r") f += ch;
  }
}

function load(dir) {
  const foods = new Map();
  for (const r of rows(join(dir, "food.csv"))) foods.set(r.fdc_id, { fdc: r.fdc_id, desc: r.description, cat: r.food_category_id, nut: {}, portions: [] });
  for (const r of rows(join(dir, "food_nutrient.csv"))) {
    const k = NUT[r.nutrient_id]; if (!k) continue;
    const f = foods.get(r.fdc_id); if (f) f.nut[k] = +r.amount;
  }
  const units = new Map([...rows(join(dir, "measure_unit.csv"))].map(r => [r.id, r.name]));
  for (const r of rows(join(dir, "food_portion.csv"))) {
    const f = foods.get(r.fdc_id); if (!f) continue;
    const u = units.get(r.measure_unit_id);
    f.portions.push({ seq: +r.seq_num, label: [r.amount, u && u !== "undetermined" ? u : "", r.portion_description, r.modifier].filter(Boolean).join(" ").trim(), g: +r.gram_weight });
  }
  return foods;
}

const r1 = x => Math.round(x * 10) / 10;
// Normalizzazione + controlli. Restituisce {c100, flags}.
export function normalizeUSDA(n) {
  const flags = [];
  if (!(n.cbd >= 0)) return { c100: null, flags: ["cho-mancanti"] };
  let c = n.cbd;
  if (n.fiber >= 0) c -= n.fiber; else flags.push("fibra-mancante");
  if (c < 0) { flags.push("negativo-azzerato"); c = 0 }
  if (n.starch >= 0 && n.sugars >= 0) {
    const sum = n.starch + n.sugars;
    // differenza > 2 g o > 15%: by difference include anche altro (acidi organici, errori di misura)
    if (Math.abs(c - sum) > Math.max(2, 0.15 * c)) flags.push(`diff-vs-amido+zuccheri:${r1(c - sum)}`);
  }
  return { c100: r1(c), flags };
}

const [, , cmd, dir, query] = process.argv;
if (!cmd || !dir) { console.error("Uso: node build.mjs find|build <cartella-csv> [testo]"); process.exit(1) }
const foods = load(dir);

if (cmd === "find") {
  const q = String(query || "").toLowerCase();
  for (const f of foods.values()) if (f.desc.toLowerCase().includes(q)) {
    const { c100, flags } = normalizeUSDA(f.nut);
    console.log(`${f.fdc}\t${c100}\tcbd=${f.nut.cbd} fib=${f.nut.fiber ?? "-"} amido=${f.nut.starch ?? "-"} zuc=${f.nut.sugars ?? "-"}\t${f.desc}${flags.length ? "\t[" + flags.join(",") + "]" : ""}`);
  }
} else if (cmd === "build") {
  // Genera il catalogo dell'app. Una voce entra solo se: CHO e fibra presenti, nessun flag, ogni porzione trovata in USDA.
  const sel = JSON.parse(readFileSync(join(HERE, "selection.json"), "utf8"));
  const out = [], problems = [];
  for (const s of sel.foods) {
    const f = foods.get(String(s.fdc));
    if (!f) { problems.push(`${s.n}: fdc ${s.fdc} non trovato`); continue }
    const { c100, flags } = normalizeUSDA(f.nut);
    if (c100 == null || flags.length) { problems.push(`${s.n}: escluso (${flags.join(",") || "CHO mancanti"})`); continue }
    const units = [];
    for (const u of s.units || []) {
      const p = f.portions.find(x => x.seq === u.seq);
      if (!p || !(p.g > 0)) { problems.push(`${s.n}: porzione seq ${u.seq} assente in USDA, scartata`); continue }
      units.push({ t: u.l, w: r1(p.g), l: u.pl === "porzione" ? "porzione" : "pezzo", base: "edibile", src: `USDA: ${p.label}` });
    }
    const orig = Object.fromEntries(Object.entries(f.nut).filter(([k]) => k !== "water").map(([k, v]) => [k, v]));
    out.push({
      cid: `usda:${f.fdc}`, n: s.n, ...(s.a ? { a: s.a } : {}), cat: s.cat, it: s.it,
      c100, u: "g", units,
      src: { db: "usda", ds: DATASET, id: +f.fdc, desc: f.desc, orig, formula: "carboidrati per differenza − fibra totale" }
    });
  }
  const outFile = join(HERE, "..", "..", "beta", "data", "fonti", "foods-it.json"); // completo; la versione per l'app la scrive tools/slim/build.mjs
  writeFileSync(outFile, JSON.stringify({
    format: "carbo-catalog", version: 1, generated: new Date().toISOString().slice(0, 10),
    basis: "g di carboidrati disponibili per 100 g di parte edibile",
    sources: { usda: { name: "USDA FoodData Central", dataset: DATASET, license: "CC0 1.0",
      citation: "U.S. Department of Agriculture, Agricultural Research Service. FoodData Central. fdc.nal.usda.gov" } },
    foods: out
  }, null, 1) + "\n");
  console.log(`${out.length} voci → ${outFile}`); if (problems.length) console.log("Note:\n" + problems.join("\n"));
  for (const o of out) console.log(`${o.n.padEnd(20)} ${String(o.c100).padStart(5)} g/100  ${o.units.map(u => `${u.t}=${u.w}g`).join(" | ")}`);
} else { console.error("Comando sconosciuto"); process.exit(1) }

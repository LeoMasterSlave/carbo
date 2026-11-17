// Converte tools/crea/alimenti-crea.csv (foglio "Carboidrati e porzioni" di database_alimenti.xlsx,
// fornito dall'utente; fonte dichiarata: CREA, Tabelle di composizione degli alimenti, agg. dicembre 2019)
// nel catalogo beta/data/foods-crea.json. Separato dal DB del motore AI: fooddb.js non viene toccato.
// Uso:  node tools/crea/build.mjs
//
// Regole:
//  - c100 = carboidrati disponibili per 100 g di parte edibile, come nel file. "tr" (tracce) → 0, segnato tr:1.
//  - porzione standard CREA come pulsante solo se coerente con i carboidrati per porzione del file:
//    peso edibile (CHO porzione ≈ c100 × peso) oppure peso lordo (≈ c100 × peso × parte edibile).
//    Se non torna con nessuna delle due, la porzione non si importa (elenco nel REPORT). Nessun valore inventato.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const CSV = join(HERE, "alimenti-crea.csv");
const OUT = join(ROOT, "beta", "data", "foods-crea.json");
const REPORT = join(HERE, "REPORT.md");
const FILE_NAME = "database_alimenti.xlsx";

function parseCSV(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++ } else q = false } else f += ch; continue }
    if (ch === '"') q = true;
    else if (ch === ",") { row.push(f); f = "" }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(f); f = ""; if (row.some(x => x !== "")) rows.push(row); row = [] }
    else f += ch;
  }
  if (f !== "" || row.length) { row.push(f); if (row.some(x => x !== "")) rows.push(row) }
  const [h, ...body] = rows;
  return body.map((r, k) => Object.fromEntries([...h.map((c, j) => [c.trim(), (r[j] ?? "").trim()]), ["_row", k + 2]]));
}
const r1 = x => Math.round(x * 10) / 10;
const val = s => s === "tr" ? 0 : s === "" ? null : +String(s).replace(",", ".");
// Nomi rovinati dall'esportazione (virgolette): solo pulizia tipografica, nessun cambio di significato.
const cleanName = s => s.replace(/"+/g, "").replace(/\s+/g, " ").trim();

const rows = parseCSV(readFileSync(CSV, "utf8"));
const rep = { tr: [], noPor: [], gross: [], badPor: [], skipped: [], renamed: [] };
const foods = [];
for (const r of rows) {
  const c100 = val(r.carboidrati_g_100g);
  if (!(c100 >= 0 && c100 <= 100)) { rep.skipped.push({ r, why: `carboidrati/100 g non leggibili ("${r.carboidrati_g_100g}")` }); continue }
  const n = cleanName(r.alimento);
  if (n !== r.alimento) rep.renamed.push({ r, n });
  if (r.carboidrati_g_100g === "tr") rep.tr.push(r);
  const w = parseFloat(r.porzione_standard_g), ed = parseFloat(r.parte_edibile), cp = val(r.carboidrati_g_porzione);
  const units = [];
  if (w > 0 && w <= 2000) {
    const unit = (ww, t) => units.push({ t, w: r1(ww), l: "porzione", base: "edibile", src: "CREA" });
    if (cp == null || c100 === 0) unit(w, "1 porzione CREA");
    else {
      const tol = x => Math.abs(x - cp) <= Math.max(0.15, cp * 0.06);
      if (tol(c100 * w / 100)) unit(w, "1 porzione CREA");
      else if (ed > 0 && ed < 100 && tol(c100 * w * ed / 10000)) { unit(w * ed / 100, `1 porzione CREA (${w} g lordi)`); rep.gross.push({ r, w, ed }) }
      else rep.badPor.push({ r, w, cp, exp: r1(c100 * w / 100) });
    }
  } else rep.noPor.push(r);
  const code = r.codice_alimento;
  if (!/^\d+$/.test(code)) { rep.skipped.push({ r, why: "codice mancante" }); continue }
  foods.push({
    cid: `crea:${code}`, n, cat: r.categoria.toLowerCase(), c100, u: "g",
    ...(r.carboidrati_g_100g === "tr" ? { tr: 1 } : {}),
    units,
    src: { db: "crea", file: FILE_NAME, row: r._row, code, orig: { cho100: r.carboidrati_g_100g, choPor: r.carboidrati_g_porzione, zuc100: r.zuccheri_g_100g, por: r.porzione_standard_g, edibile: r.parte_edibile } }
  });
}
foods.sort((a, b) => a.n.localeCompare(b.n, "it"));
const cids = new Set(); for (const f of foods) { if (cids.has(f.cid)) throw new Error("cid duplicato " + f.cid); cids.add(f.cid) }

writeFileSync(OUT, JSON.stringify({
  format: "carbo-catalog", version: 1, generated: new Date().toISOString().slice(0, 10),
  basis: "g di carboidrati disponibili per 100 g di parte edibile (CREA); tr = tracce, conteggiate come 0",
  sources: { crea: { name: "CREA – Centro di ricerca Alimenti e Nutrizione", dataset: "Tabelle di composizione degli alimenti (agg. dicembre 2019)", url: "https://www.alimentinutrizione.it/tabelle-nutrizionali", file: FILE_NAME } },
  foods
}) + "\n");

const L = [];
const rr = x => `riga ${x._row ?? x.r._row}: ${(x.alimento ?? x.r.alimento)}`;
L.push("# Import CREA → beta/data/foods-crea.json", "", `Generato da \`node tools/crea/build.mjs\` da ${FILE_NAME}. Righe lette: ${rows.length}.`, "");
L.push(`- Voci importate: **${foods.length}**`, `- Con porzione standard: ${foods.filter(f => f.units.length).length} (di cui ${rep.gross.length} convertite da peso lordo a edibile)`,
  `- Porzione non importata perché incoerente con i CHO per porzione: ${rep.badPor.length}`, `- Senza porzione nel file: ${rep.noPor.length}`,
  `- Tracce (tr → 0): ${rep.tr.length}`, `- Scartate: ${rep.skipped.length}`, "");
L.push("## Porzioni non importate (incoerenti)", "", "| riga | alimento | porzione | CHO porzione file | atteso da c100 |", "|---|---|---|---|---|", ...rep.badPor.map(x => `| ${x.r._row} | ${x.r.alimento} | ${x.w} g | ${x.cp} | ${x.exp} |`), "");
L.push("## Porzioni in peso lordo (convertite in edibile)", ...rep.gross.map(x => `- ${rr(x)} — ${x.w} g lordi × ${x.ed}% = ${r1(x.w * x.ed / 100)} g`), "");
L.push("## Tracce", ...rep.tr.map(r => `- ${rr(r)}`), "");
L.push("## Nomi ripuliti", ...rep.renamed.map(x => `- ${rr(x)} → ${x.n}`), "");
if (rep.skipped.length) L.push("## Scartate", ...rep.skipped.map(x => `- ${rr(x)} — ${x.why}`), "");
writeFileSync(REPORT, L.join("\n") + "\n");
console.log(L.slice(0, 11).join("\n"));

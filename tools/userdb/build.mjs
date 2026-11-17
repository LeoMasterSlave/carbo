// Converte tools/userdb/alimenti-260.csv (elenco fornito dall'utente) nel catalogo
// beta/data/foods-stime.json, separato dal DB del motore AI.
// Uso:  node tools/userdb/build.mjs
//
// Regole (decise con l'utente):
//  - un valore centrale per i calcoli (c100) + intervallo visibile (rng, e r per porzione);
//  - crudo e cotto distinti: lo stato va nel nome, mai indovinato;
//  - doppioni effettivi eliminati, porzioni alternative legittime conservate;
//  - pasta fresca e ripiena in revisione: NON importata;
//  - fonte e affidabilità distinte: "etichetta" (lab:) o "stima" (est:);
//  - fooddb.js è solo LETTO per riconoscere i doppioni: nessuna modifica al motore.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const CSV = join(HERE, "alimenti-260.csv");
const OUT = join(ROOT, "beta", "data", "foods-stime.json");
const REPORT = join(HERE, "REPORT.md");
const FILE_NAME = "database_carbo_260_alimenti.csv";

const { DB } = await import(pathToFileURL(join(ROOT, "beta", "js", "engine", "fooddb.js")).href);
const USDA = JSON.parse(readFileSync(join(ROOT, "beta", "data", "foods-it.json"), "utf8")).foods;

// ---------- CSV
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
const fold = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();
const slug = s => fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const r1 = x => Math.round(x * 10) / 10;
const num = s => +String(s).replace(",", ".");

// ---------- regole manuali (motivate nel REPORT)
// Pasta fresca e ripiena: valori dubbi, restano in revisione.
const REVIEW = new Set(["Pasta fresca all'uovo", "Tagliatelle all'uovo", "Tortellini freschi", "Cappelletti freschi", "Ravioli ricotta e spinaci", "Culurgiones", "Cannelloni ricotta e spinaci", "Seadas"]);
// Stesso alimento del DB del motore con un altro nome: la riga diventa solo una porzione in più.
const DUP_DB = {
  "Latte vaccino": "Latte", "Pasta secca": "Pasta cruda", "Cola zuccherata": "Coca-Cola", "Insalata verde": "Insalata",
  "Piselli cotti": "Piselli", "Avena in fiocchi": "Fiocchi d'avena", "Piadina classica": "Piadina", "Lasagne al ragù": "Lasagna",
  "Riso in bianco cotto": "Riso cotto", "Polenta cotta": "Polenta", "Croissant crema nocciola": "Croissant farcito",
  "Panino prosciutto e formaggio": "Panino al prosciutto", "Parmigiana di melanzane": "Parmigiana", "Arancino al ragù": "Arancino",
  "Sushi misto": "Sushi (nigiri/maki)", "Toast prosciutto e sottiletta": "Toast prosciutto e formaggio", "Cappuccino": "Cappuccino"
};
// Già nel catalogo USDA (fonte verificata): la stima non si importa.
const DUP_USDA = new Set(["Mandarini", "Clementine", "Albicocche", "Prugne", "Ananas", "Mango", "Ciliegie", "Fichi freschi", "Melone", "Datteri secchi"]);
// Nomi con lo stato (crudo/secco/cotto) che il file indica solo nell'unità.
const NAME = {
  "Cous cous": "Cous cous secco", "Farro": "Farro crudo", "Orzo perlato": "Orzo perlato crudo", "Riso basmati": "Riso basmati crudo",
  "Riso integrale": "Riso integrale crudo", "Riso venere": "Riso venere crudo", "Pasta integrale": "Pasta integrale cruda",
  "Pasta senza glutine mais/riso": "Pasta senza glutine (mais/riso) cruda", "Quinoa": "Quinoa secca", "Bulgur": "Bulgur secco",
  "Patate dolci": "Patate dolci cotte", "Mais": "Mais scolato", "Polenta": "Farina di mais",
  "Cous cous con verdure": "Cous cous con verdure (peso cotto)", "Latte macchiato": "Latte macchiato (ml di latte)",
  "bevanda di soia non zuccherata": "Bevanda di soia non zuccherata"
};
// Etichetta della porzione quando il file pesa un ingrediente e non il piatto.
const UNIT_T = { "Polenta": "1 porzione di polenta (farina)", "Caffellatte": "1 caffellatte", "Cappuccino": "1 cappuccino", "Latte macchiato": "1 latte macchiato" };
// Piatti pesati sull'ingrediente base: il peso da inserire è quello della base.
const BASE = { "pasta secca": "peso della pasta a crudo", "secchi": "peso della pasta a crudo", "riso secco": "peso del riso a crudo",
  "pastina secca": "peso della pastina a crudo", "pane carasau": "peso del pane carasau", "base": "peso della piadina", "pane": "peso del pane" };
const BASE_BY_NAME = { "Fregola al pomodoro": "peso della fregola a crudo" };
// Verdure e simili: il file non dice se il peso è crudo o cotto. Lo diciamo, senza indovinare.
const STATE_UNKNOWN = new Set(["Peperoni", "Finocchi", "Broccoli", "Cavolfiore", "Spinaci", "Cipolla", "Funghi", "Zucca", "Asparagi", "Fagiolini", "Carciofi", "Cavolo cappuccio", "Fave fresche", "Edamame"]);

const RAW = /\b(crud[oiae]|secc[oaie]|secchi|secche|farina secca|fresche)\b/i;
const COOKED = /\b(cott[oiae]|scolat[oiae])\b/i;
const STATE_IN_NAME = /\b(crud[oiae]|secc[oaie]|secchi|secche|cott[oiae]|scolat[oiae]|peso)\b/i;

// ---------- interpretazione di una riga
function parseRow(r) {
  const out = { row: r._row, src: r.alimento, cat: r.categoria };
  const q = num(r.quantita_porzione), un = r.unita;
  const cho = r.carboidrati_g_stimati.split("-").map(num);
  if (cho.some(x => !(x >= 0))) return { ...out, err: "valore CHO non leggibile" };
  out.lo = cho[0]; out.hi = cho[1] ?? cho[0];
  const m0 = un.match(/^(g|ml)\b\s*(.*)$/i);
  let w, u = "g", t = null, base = null, label = null, stateTxt = un;
  if (m0) {
    w = q; u = m0[1].toLowerCase(); const rest = m0[2].trim();
    const par = rest.match(/\(([^)]*)\)/);
    if (par) label = /^[\d\s\-–]+$/.test(par[1]) ? `${par[1].trim()} pezzi` : par[1].trim();
    const rr = rest.replace(/\([^)]*\)/, "").trim().toLowerCase();
    if (rr === "latte") base = "latte";
    else if (rr === "pane") base = "pane";
  } else {
    const m = un.match(/\((?:circa\s*)?([\d.]+)\s*(g|ml)\b(?:\s*circa)?\s*([^)]*)\)/i) || un.match(/^porzione:\s*([\d.]+)\s*(g|ml)\b\s*(.*)$/i);
    if (!m) return { ...out, err: `nessun peso nell'unità "${un}"` };
    w = num(m[1]); u = m[2].toLowerCase();
    const extra = m[3].replace(/edibili/i, "").trim().toLowerCase();
    const word = un.replace(/\(.*\)/, "").replace(/^porzione:.*$/i, "porzione").trim();
    const nq = Number.isInteger(q) ? q : r1(q);
    label = `${nq} ${word}`;
    if (BASE[extra] || BASE_BY_NAME[r.alimento]) base = extra || "base";
    else if (extra) stateTxt = extra;
  }
  if (!(w > 0 && w <= 2000)) return { ...out, err: "peso non valido" };
  out.w = w; out.u = u;
  out.st = RAW.test(stateTxt) ? "r" : COOKED.test(stateTxt) ? "c" : null;
  // nome finale
  let n = NAME[r.alimento] || r.alimento;
  n = n.charAt(0).toUpperCase() + n.slice(1);
  const baseTxt = BASE_BY_NAME[r.alimento] || (base && base !== "latte" ? BASE[base] : null);
  if (baseTxt) { n = `${n} (${baseTxt})`; out.st = null; out.dish = true }
  out.n = n;
  out.t = UNIT_T[r.alimento] || label || "1 porzione";
  out.l = /pezz|biscott|barrett|fett[ae]\b|panino|tramezzino|piadina|pizza|medio|piccol|bowl/i.test(out.t) && !/porzione|piatto/i.test(out.t) ? "pezzo" : "porzione";
  out.rel = r.tipo_fonte === "Produttore / etichetta" ? "etichetta" : "stima";
  out.orig = { q: r.quantita_porzione, unita: un, cho: r.carboidrati_g_stimati, fonte: r.fonte_o_note, tipo: r.tipo_fonte, stato: r.stato_verifica, ...(r.url_fonte_generale ? { url: r.url_fonte_generale } : {}) };
  return out;
}

// ---------- DB del motore (sola lettura)
function dbMatch(p) {
  if (DUP_DB[p.src]) return DB.find(d => d.n === DUP_DB[p.src]) || null;
  // piatti pesati sull'ingrediente base e righe rinominate per lo stato: non sono la voce DB omonima
  if (p.dish || NAME[p.src]) return null;
  const k = fold(p.src);
  const hits = DB.filter(d => fold(d.n) === k || (d.a || []).some(a => fold(a) === k));
  if (!hits.length) return null;
  return hits.find(d => p.st && d.st === p.st) || hits.find(d => !d.st || !p.st) || null;
}

// ---------- costruzione
const rows = parseCSV(readFileSync(CSV, "utf8"));
const rep = { review: [], skipped: [], usda: [], dbPort: [], dbSame: [], merged: [], errors: [] };
const foods = new Map(), dbPortions = {};
const unitOf = p => ({ t: p.t, w: p.w, l: p.l, r: [p.lo, p.hi], src: "file", row: p.row });

for (const r of rows) {
  if (REVIEW.has(r.alimento)) { rep.review.push(r); continue }
  if (DUP_USDA.has(r.alimento)) { rep.usda.push(r); continue }
  const p = parseRow(r);
  if (p.err && !p.w) { rep.skipped.push({ r, why: p.err }); continue }
  if (p.err) { rep.errors.push({ r, why: p.err }); continue }
  const d = dbMatch(p);
  if (d) {
    if ((d.u || "g") !== p.u) { rep.skipped.push({ r, why: `stesso alimento di "${d.n}" nel DB, ma in ${p.u} invece di ${d.u || "g"}: porzione non aggiunta` }); continue }
    const list = dbPortions[d.n] ??= [];
    const fc = r1((p.lo + p.hi) / 2 / p.w * 100);
    if (list.some(x => x.w === p.w)) { rep.dbSame.push({ r, db: d.n, w: p.w }); continue }
    list.push(unitOf(p));
    rep.dbPort.push({ r, db: d.n, w: p.w, u: p.u, t: p.t, fc, dc: d.c });
    continue;
  }
  // voce nuova: se il file indica crudo/cotto, il nome deve dirlo (regola "crudo e cotto distinti")
  if (p.st && !STATE_IN_NAME.test(p.n) && !/farina/i.test(p.n)) { rep.errors.push({ r, why: `stato "${p.st}" non espresso nel nome "${p.n}"` }); continue }
  const key = fold(p.n);
  let f = foods.get(key);
  if (!f) {
    f = { n: p.n, u: p.u, cat: p.cat, rel: p.rel, st: p.st, dish: !!p.dish, unknownState: STATE_UNKNOWN.has(r.alimento), rows: [] };
    foods.set(key, f);
  } else {
    if (f.u !== p.u) { rep.errors.push({ r, why: "stesso nome, unità diversa" }); continue }
    if (f.rel !== p.rel) f.rel = "stima"; // misto: vale la più prudente
    rep.merged.push({ r, into: f.n, same: true });
  }
  f.rows.push(p);
}

// porzioni del file già presenti come porzioni LARN della stessa voce DB: non si ripetono
const LARN = JSON.parse(readFileSync(join(ROOT, "beta", "data", "portions-it.json"), "utf8")).map;
for (const [k, list] of Object.entries(dbPortions)) {
  const larnW = new Set((LARN[k] || []).map(x => x.w));
  dbPortions[k] = list.filter(x => { if (larnW.has(x.w)) { rep.dbSame.push({ r: { _row: x.row, alimento: k }, db: k, w: x.w, larn: true }); return false } return true });
  if (!dbPortions[k].length) delete dbPortions[k];
}

const out = [];
for (const f of foods.values()) {
  const per = f.rows.map(p => ({ lo: p.lo / p.w * 100, hi: p.hi / p.w * 100, mid: (p.lo + p.hi) / 2 / p.w * 100 }));
  const c100 = r1(per.reduce((s, x) => s + x.mid, 0) / per.length);
  const rng = [r1(Math.min(...per.map(x => x.lo))), r1(Math.max(...per.map(x => x.hi)))];
  if (!(c100 >= 0 && c100 <= 100)) { rep.errors.push({ r: { _row: f.rows[0].row, alimento: f.n }, why: `c100 fuori scala (${c100})` }); continue }
  const units = []; const seen = new Set();
  for (const p of f.rows) { const k = `${p.w}|${p.t}`; if (seen.has(k)) { rep.merged.push({ r: { _row: p.row, alimento: p.src }, into: f.n, exact: true }); continue } seen.add(k); units.push(unitOf(p)) }
  units.sort((a, b) => a.w - b.w);
  const pre = f.rel === "etichetta" ? "lab" : "est";
  out.push({
    cid: `${pre}:${slug(f.n)}`, n: f.n, ...(f.rows[0].src !== f.n ? { a: [...new Set(f.rows.map(p => fold(p.src)))] } : {}),
    cat: fold(f.cat), c100, rng, u: f.u, rel: f.rel, ...(f.st ? { st: f.st } : {}), ...(f.unknownState ? { stx: 1 } : {}), ...(f.dish || /piatti composti/i.test(f.cat) ? { cmp: true } : {}),
    units: units.map(({ row, ...u }) => u),
    src: { db: "file", file: FILE_NAME, rows: f.rows.map(p => p.row), orig: f.rows.map(p => p.orig) }
  });
}
out.sort((a, b) => a.n.localeCompare(b.n, "it"));
const cids = new Set(); for (const f of out) { if (cids.has(f.cid)) throw new Error("cid duplicato " + f.cid); cids.add(f.cid) }
const dbP = Object.fromEntries(Object.entries(dbPortions).map(([k, v]) => [k, v.map(({ row, ...u }) => u)]));

writeFileSync(OUT, JSON.stringify({
  format: "carbo-catalog", version: 1, generated: new Date().toISOString().slice(0, 10),
  basis: "g di carboidrati disponibili per 100 g (o 100 ml) del peso indicato nel nome; c100 = media dei punti centrali, rng = intervallo",
  sources: { file: { name: "Elenco alimenti fornito dall'utente", file: FILE_NAME, note: "Valori indicativi: stime (est:) o etichette dichiarate dal produttore (lab:). Non verificati su fonte primaria." } },
  foods: out, dbPortions: dbP
}, null, 1) + "\n");

// ---------- report
const L = [];
const rr = x => `riga ${x.r._row}: ${x.r.alimento}`;
L.push(`# Import elenco 260 alimenti → beta/data/foods-stime.json`, "", `Generato da \`node tools/userdb/build.mjs\`. Righe lette: ${rows.length}.`, "");
L.push(`- Nuove voci di catalogo: **${out.length}** (etichetta: ${out.filter(f => f.rel === "etichetta").length}, stima: ${out.filter(f => f.rel === "stima").length})`);
L.push(`- Porzioni aggiunte a voci del DB del motore: **${Object.values(dbP).flat().length}** su ${Object.keys(dbP).length} voci`);
L.push(`- Doppioni non importati: ${rep.dbSame.length} (porzione già presente) + ${rep.usda.length} (già nel catalogo USDA) + ${rep.merged.filter(m => m.exact).length} (righe identiche)`);
L.push(`- In revisione (non importate): ${rep.review.length}`, `- Senza peso (non importate): ${rep.skipped.length}`, `- Errori: ${rep.errors.length}`, "");
L.push("## In revisione (pasta fresca e ripiena)", ...rep.review.map(r => `- riga ${r._row}: ${r.alimento} — ${r.quantita_porzione} ${r.unita}, ${r.carboidrati_g_stimati} g`), "");
L.push("## Senza peso", ...rep.skipped.map(x => `- ${rr(x)} — ${x.why}`), "");
L.push("## Già nel catalogo USDA", ...rep.usda.map(r => `- riga ${r._row}: ${r.alimento}`), "");
L.push("## Porzioni aggiunte a voci del DB (solo il peso; i carboidrati restano quelli del DB)", "", "| riga | alimento nel file | voce DB | porzione | CHO/100 file | CHO/100 DB |", "|---|---|---|---|---|---|",
  ...rep.dbPort.filter(x => dbP[x.db] && dbP[x.db].some(u => u.w === x.w)).map(x => `| ${x.r._row} | ${x.r.alimento} | ${x.db} | ${x.t} = ${x.w} ${x.u} | ${x.fc} | ${x.dc}${Math.abs(x.fc - x.dc) > Math.max(2, x.dc * .25) ? " ⚠️" : ""} |`), "");
L.push("## Porzioni non aggiunte (stesso peso già presente)", ...rep.dbSame.map(x => `- ${rr(x)} → ${x.db} ${x.w}${x.larn ? " (già LARN)" : ""}`), "");
L.push("## Righe unite in una voce", ...rep.merged.map(x => `- ${rr(x)} → ${x.into}${x.exact ? " (porzione identica: scartata)" : " (stesso alimento)"}`), "");
L.push("## Stato crudo/cotto non indicato nel file", ...out.filter(f => f.stx).map(f => `- ${f.n}`), "");
if (rep.errors.length) L.push("## Errori", ...rep.errors.map(x => `- ${rr(x)} — ${x.why}`), "");
writeFileSync(REPORT, L.join("\n"));
console.log(L.slice(0, 12).join("\n"));
if (rep.errors.length) { console.log(rep.errors.map(x => `ERR ${rr(x)} — ${x.why}`).join("\n")); process.exitCode = 1 }

// Scrive i cataloghi usati dall'app (beta/data/foods-*.json) a partire da quelli completi in beta/data/fonti/.
// Toglie solo il campo "src" di ogni alimento (righe del file d'origine, valori pubblicati, formule):
// l'interfaccia non lo legge. Nomi, carboidrati, porzioni, intervalli e affidabilità restano identici;
// lo script lo verifica campo per campo e si ferma se qualcosa non torna.
// Uso:  node tools/slim/build.mjs   (dopo ogni build di usda, userdb o crea)
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "beta", "data");
const FILES = ["foods-it.json", "foods-crea.json", "foods-stime.json"];
let tot0 = 0, tot1 = 0;
for (const name of FILES) {
  const fullPath = join(DATA, "fonti", name), outPath = join(DATA, name);
  const full = JSON.parse(readFileSync(fullPath, "utf8"));
  if (full.format !== "carbo-catalog" || !Array.isArray(full.foods)) throw new Error(name + ": formato inatteso");
  const foods = full.foods.map(({ src, ...rest }) => rest);
  const slim = { ...full, full: "fonti/" + name, foods };
  // controllo: ogni alimento ha gli stessi campi e valori, tranne src
  full.foods.forEach((f, i) => {
    const { src, ...a } = f;
    if (JSON.stringify(a) !== JSON.stringify(foods[i])) throw new Error(`${name}: differenza in ${f.cid}`);
  });
  writeFileSync(outPath, JSON.stringify(slim) + "\n");
  const s0 = statSync(fullPath).size, s1 = statSync(outPath).size;
  tot0 += s0; tot1 += s1;
  console.log(`${name}: ${foods.length} alimenti, ${Math.round(s0 / 1024)} KB → ${Math.round(s1 / 1024)} KB`);
}
console.log(`totale: ${Math.round(tot0 / 1024)} KB → ${Math.round(tot1 / 1024)} KB`);

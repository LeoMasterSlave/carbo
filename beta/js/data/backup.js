// Backup JSON. Il file contiene pasti, obiettivo e preferenze AI non segrete.
// La chiave API NON viene mai inclusa.
// Il checksum è sincrono (FNV-1a 32 bit) così la condivisione parte ancora
// dentro il gesto dell'utente, come richiede Safari.

export const BACKUP_FORMAT = "carbo-backup";
export const SCHEMA_VERSION = 2; // 2: aggiunta la libreria (preferiti, recenti, ricette)
export const APP_VERSION = "2.0.0-alpha.7";
const LAST_KEY = "carbo_last_backup";

export function checksum(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const ls = k => { try { return localStorage.getItem(k) } catch (e) { return null } };

export function buildBackup(state, lib) {
  const data = {
    meals: state.meals || [],
    goal: state.goal ?? null,
    library: lib || null,
    settings: { prov: ls("carbo_prov"), mode: ls("carbo_mode"), theme: ls("carbo_theme"), reminders: ls("carbo_rem") }
  };
  return {
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    counts: { meals: data.meals.length, favorites: lib ? lib.favorites.length : 0, recipes: lib ? lib.recipes.length : 0 },
    checksum: { alg: "fnv1a32", value: checksum(JSON.stringify(data)) },
    data
  };
}

export function lastBackup() { return +ls(LAST_KEY) || null }

// Consegna un file all'utente. Su telefono usa il foglio di condivisione ("Salva su File",
// Calendario…), altrove lo scarica. Restituisce "shared", "downloaded" oppure "cancel".
export async function saveFile(blob, name, title) {
  const file = typeof File === "function" ? new File([blob], name, { type: blob.type }) : null;
  if (file && navigator.canShare && matchMedia("(pointer:coarse)").matches && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return "shared" }
    catch (e) { if (e && e.name === "AbortError") return "cancel" }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return "downloaded";
}
export const dayStamp = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export async function exportBackup(state, lib) {
  const json = JSON.stringify(buildBackup(state, lib), null, 1);
  const how = await saveFile(new Blob([json], { type: "application/json" }), `carbo-backup-${dayStamp()}.json`, "Backup Carbo");
  if (how !== "cancel") try { localStorage.setItem(LAST_KEY, String(Date.now())) } catch (e) {}
  return how;
}

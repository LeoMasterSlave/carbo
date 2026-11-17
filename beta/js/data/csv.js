// Export CSV dei pasti per fogli di calcolo (Excel, Numbers, Fogli Google).
// Una riga per alimento. Separatore ";" e virgola decimale, come si aspetta Excel in italiano.
// Solo lettura: non modifica i dati.

const pad = n => String(n).padStart(2, "0");
const dec = x => String(Math.round(x * 10) / 10).replace(".", ",");
const cell = v => { const s = String(v ?? ""); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s };

export function mealsCSV(meals) {
  const head = ["Data", "Ora", "Pasto", "Alimento", "Quantità", "Unità", "CHO per 100", "CHO alimento (g)", "CHO pasto (g)", "ID pasto"];
  const rows = [head];
  for (const m of meals.slice().sort((a, b) => a.ts - b.ts)) {
    const d = new Date(m.ts), day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, hh = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const items = m.items.length ? m.items : [{ n: "", g: 0, u: "", c100: 0 }];
    for (const i of items)
      rows.push([day, hh, m.type, i.n, dec(+i.g || 0), i.u || "g", dec(+i.c100 || 0), dec((+i.g || 0) * (+i.c100 || 0) / 100), dec(+m.total || 0), m.id]);
  }
  // BOM: Excel riconosce l'UTF-8 (accenti) solo con questo prefisso
  return "﻿" + rows.map(r => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

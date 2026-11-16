// Promemoria dei pasti.
// Livello base (questo file): avviso discreto in Oggi, solo con l'app aperta, solo per i pasti attivi,
// solo nelle 3 ore successive all'orario e mai più di uno alla volta. "Non oggi" lo zittisce fino a domani.
// Ad app chiusa: file .ics con eventi ricorrenti per il Calendario del telefono (nessun server).
// Le notifiche push vere richiedono un backend: non incluse.

const KEY = "carbo_rem", OFF_KEY = "carbo_rem_off";
export const REM_TYPES = ["Colazione", "Pranzo", "Cena"];
const DEF = { Colazione: { on: false, t: "08:00" }, Pranzo: { on: false, t: "13:00" }, Cena: { on: false, t: "20:00" } };
const WINDOW_MIN = 180;

const valid = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
export function loadRem() {
  let o = null; try { o = JSON.parse(localStorage.getItem(KEY) || "null") } catch (e) {}
  const meals = {};
  for (const k of REM_TYPES) {
    const m = o && o.meals && o.meals[k];
    meals[k] = { on: !!(m && m.on), t: m && valid(m.t) ? m.t : DEF[k].t };
  }
  return { meals, nudge: o ? o.nudge !== false : true };
}
export function saveRem(r) { try { localStorage.setItem(KEY, JSON.stringify(r)) } catch (e) {} }

const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function offToday(now) {
  try { const o = JSON.parse(localStorage.getItem(OFF_KEY) || "null"); return o && o.day === dayKey(now) ? o.types : [] } catch (e) { return [] }
}
export function snooze(type, now = new Date()) {
  const types = [...new Set([...offToday(now), type])];
  try { localStorage.setItem(OFF_KEY, JSON.stringify({ day: dayKey(now), types })) } catch (e) {}
}

// Il promemoria da mostrare ora, oppure null.
export function dueReminder(rem, meals, now = new Date()) {
  if (!rem.nudge) return null;
  const today = dayKey(now), mins = now.getHours() * 60 + now.getMinutes(), off = offToday(now);
  const logged = new Set(meals.filter(m => dayKey(new Date(m.ts)) === today).map(m => m.type));
  let best = null;
  for (const type of REM_TYPES) {
    const r = rem.meals[type];
    if (!r.on || logged.has(type) || off.includes(type)) continue;
    const [h, m] = r.t.split(":").map(Number), at = h * 60 + m;
    if (mins >= at && mins - at <= WINDOW_MIN && (!best || at > best.at)) best = { type, at };
  }
  return best && best.type;
}

// Calendario: eventi giornalieri ricorrenti in ora locale (senza fuso: segue il fuso del telefono).
const icsEsc = s => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const stampUTC = d => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
export function buildICS(rem, appUrl, now = new Date()) {
  const on = REM_TYPES.filter(t => rem.meals[t].on);
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Carbo//Promemoria pasti//IT", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Carbo"];
  const d = now, ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  for (const t of on) {
    const hm = rem.meals[t].t.replace(":", "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:carbo-${t.toLowerCase()}-${ymd}@carbo`,
      `DTSTAMP:${stampUTC(now)}`,
      `DTSTART:${ymd}T${hm}00`,
      "DURATION:PT5M",
      "RRULE:FREQ=DAILY",
      `SUMMARY:${icsEsc("Carbo · " + t)}`,
      `DESCRIPTION:${icsEsc("Se ti va, registra " + ({ Colazione: "la colazione", Pranzo: "il pranzo", Cena: "la cena" }[t]) + " in Carbo.")}`,
      ...(appUrl ? [`URL:${appUrl}`] : []),
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEsc("Carbo · " + t)}`, "TRIGGER:PT0M", "END:VALARM",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return { text: lines.join("\r\n") + "\r\n", count: on.length };
}

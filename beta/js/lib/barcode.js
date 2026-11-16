// Scanner di codici a barre (EAN-13, EAN-8, UPC-A, UPC-E).
// 1) BarcodeDetector nativo, se il browser lo offre (Chrome Android, alcuni desktop).
// 2) Altrimenti ZXing, caricato solo ora (Safari iOS non ha BarcodeDetector).
// Serve HTTPS (o localhost) per accedere alla fotocamera.

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];
const ZXING_URL = new URL("../vendor/zxing-library-0.21.3.min.js", import.meta.url).href;

export class ScanError extends Error { constructor(code, msg) { super(msg); this.code = code } }

let zxingPromise = null;
function loadZXing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  if (!zxingPromise) zxingPromise = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = ZXING_URL; s.async = true;
    s.onload = () => window.ZXing ? res(window.ZXing) : rej(new Error("ZXing assente"));
    s.onerror = () => { zxingPromise = null; s.remove(); rej(new Error("ZXing non caricato")) };
    document.head.appendChild(s);
  });
  return zxingPromise;
}

async function nativeDetector() {
  if (!("BarcodeDetector" in window)) return null;
  try {
    const sup = await window.BarcodeDetector.getSupportedFormats();
    const formats = FORMATS.filter(f => sup.includes(f));
    if (!formats.length) return null;
    const d = new window.BarcodeDetector({ formats });
    return async src => { const r = await d.detect(src); return r.length ? r[0].rawValue : null };
  } catch (e) { return null }
}

async function zxingDecoder() {
  const Z = await loadZXing();
  const hints = new Map();
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]);
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  const reader = new Z.MultiFormatReader();
  reader.setHints(hints);
  return canvas => {
    try {
      const bmp = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(canvas)));
      return reader.decodeWithState(bmp).getText();
    } catch (e) { return null } // nessun codice in questo fotogramma
    finally { reader.reset() }
  };
}

// Cifra di controllo GS1 (EAN-8, UPC-A, EAN-13).
function gs1ok(code) {
  const d = code.split("").map(Number), check = d.pop();
  const sum = d.reverse().reduce((s, x, i) => s + x * (i % 2 ? 1 : 3), 0);
  return (10 - sum % 10) % 10 === check;
}
export function cleanCode(raw) { return String(raw || "").replace(/\D/g, "") }
export function isValidCode(raw) {
  const c = cleanCode(raw);
  if (c.length === 8) return true;           // EAN-8 o UPC-E: per UPC-E la cifra di controllo richiede espansione
  if (c.length === 12 || c.length === 13) return gs1ok(c);
  return false;
}
// UPC-A (12 cifre) → EAN-13 con lo zero iniziale, come lo registra Open Food Facts.
export function normalizeCode(raw) { const c = cleanCode(raw); return c.length === 12 ? "0" + c : c }

export const scannerSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

// Avvia la fotocamera nel <video> e chiama onCode(codice) alla prima lettura sicura.
// Restituisce {stop, mode}. Le letture a 8 cifre devono ripetersi due volte (UPC-E non ha controllo semplice).
export async function startScanner(video, { onCode, onStatus } = {}) {
  if (!scannerSupported()) throw new ScanError("nocam", "Questo browser non permette di usare la fotocamera.");
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } });
  } catch (e) {
    if (e && (e.name === "NotAllowedError" || e.name === "SecurityError")) throw new ScanError("denied", "Accesso alla fotocamera negato. Puoi consentirlo nelle impostazioni del browser, oppure scrivere il codice.");
    throw new ScanError("nocam", "Fotocamera non disponibile. Scrivi il codice qui sotto.");
  }
  let stopped = false, timer = null, last = null;
  const stop = () => { stopped = true; clearTimeout(timer); stream.getTracks().forEach(t => t.stop()); video.srcObject = null };
  video.setAttribute("playsinline", ""); video.muted = true; video.srcObject = stream;
  try { await video.play() } catch (e) { /* alcuni browser partono comunque */ }

  let mode = "native", detect = await nativeDetector(), decode = null;
  if (!detect) {
    mode = "zxing"; onStatus && onStatus("Preparo lo scanner…");
    try { decode = await zxingDecoder() }
    catch (e) { stop(); throw new ScanError("lib", "Non riesco a caricare lo scanner. Scrivi il codice qui sotto.") }
  }
  if (stopped) return { stop, mode };
  onStatus && onStatus("Inquadra il codice a barre");

  const cv = document.createElement("canvas"), ctx = cv.getContext("2d", { willReadFrequently: true });
  const tick = async () => {
    if (stopped) return;
    let code = null;
    try {
      if (video.readyState >= 2 && video.videoWidth) {
        if (mode === "native") code = await detect(video);
        else {
          // solo la fascia centrale, ridotta: più veloce e coerente con il mirino
          const vw = video.videoWidth, vh = video.videoHeight, band = Math.round(vh * .5), s = Math.min(1, 960 / vw);
          cv.width = Math.round(vw * s); cv.height = Math.round(band * s);
          ctx.drawImage(video, 0, (vh - band) / 2, vw, band, 0, 0, cv.width, cv.height);
          code = decode(cv);
        }
      }
    } catch (e) { code = null }
    if (stopped) return;
    if (code && isValidCode(code)) {
      const c = cleanCode(code);
      if (c.length !== 8 || c === last) { stop(); onCode && onCode(normalizeCode(c)); return }
      last = c;
    }
    timer = setTimeout(tick, mode === "native" ? 120 : 160);
  };
  tick();
  return { stop, mode };
}

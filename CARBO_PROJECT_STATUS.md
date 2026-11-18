# Carbo — stato del progetto

Ultimo aggiornamento: 18/11/2026 (Descrivi il piatto §9.14; catalogo CREA §9.13; roadmap §10) · versione beta `2.0.0-alpha.18`, pubblicata su `/carbo/beta/` il 18/11/2026 (copia di sicurezza IndexedDB §4.1; SW v27, commit `0996043`). Regola dell'utente: pubblicare la beta dopo ogni modifica verificata
Legenda: ✅ implementato e verificato · 🟡 implementato, non verificato su iPhone · ⏳ pianificato · ❓ non verificato

## 1. Stack e struttura

- PWA statica: HTML + CSS + JavaScript vanilla (moduli ES nativi). Nessun framework, nessuna build, nessun `package.json`, nessun test automatico nel repo.
- Hosting: GitHub Pages, repo `leomasterslave/carbo`, ramo `main`, root.
- Unica dipendenza esterna: `@zxing/library` 0.21.3 (UMD, Apache-2.0), copiata in locale e caricata solo all'apertura dello scanner.
- Servizi esterni: Gemini API, Anthropic API (chiamati dal browser con la chiave dell'utente), Open Food Facts API v2 (solo il codice EAN).

| Percorso | URL | Ruolo |
|---|---|---|
| `index.html` | `/carbo/` | **v1 in produzione**: tutta l'app in un file (~620 righe, CSS + markup + JS inline) |
| `sw.js` | | SW v1, cache `carbo-v8` |
| `manifest.webmanifest`, `icon-*.png` | | PWA v1 |
| `beta/` | `/carbo/beta/` | **Carbo 2.0 beta** (redesign) |
| `beta/index.html` | | markup delle viste, del pannello Aggiungi e dello scanner |
| `beta/css/app.css` | | design system + componenti (file unico) |
| `beta/js/app.js` | | tutta la logica di interfaccia (render, navigazione, piatto, ricerca, scanner, promemoria, pannelli) |
| `beta/js/engine/ai.js` | | motore AI (codice spostato da v1) + adapter `analyzePhoto` |
| `beta/js/engine/fooddb.js` | | DB alimenti, matching, normalizzazione (codice spostato da v1) |
| `beta/js/data/backup.js` | | export JSON, checksum, consegna del file (condivisione/download) |
| `beta/js/data/restore.js` | | ripristino da backup: `parseBackup` (controlli + checksum), `mergePreview`, `mergeInto`, `replaceWith`, copia di sicurezza `carbo_prerestore` |
| `beta/js/data/csv.js` | | `mealsCSV`: export CSV (una riga per alimento, `;` e virgola decimale, BOM UTF-8) |
| `beta/js/data/library.js` | | preferiti, recenti, ricette, prodotti (`carbo_lib`) |
| `beta/js/data/products.js` | | Open Food Facts, prodotti salvati, peso del pezzo/porzione |
| `beta/js/lib/barcode.js` | | scanner: `BarcodeDetector` → fallback ZXing, controllo GS1 |
| `beta/js/features/reminders.js` | | promemoria in-app + generazione `.ics` |
| `beta/js/vendor/` | | ZXing minificato + README con licenza e hash SHA-384 |
| `beta/js/data/catalog.js` | | caricamento del catalogo esterno (`loadCatalog` legge `foods-it.json` + `foods-stime.json`, `catByCid`, `portionsFor` = LARN + porzioni del file, `portionSourceText`, etichette di fonte). Non importa `fooddb.js` |
| `beta/data/foods-stime.json` | | catalogo dall'elenco dell'utente: 158 voci (`est:` stima, `lab:` etichetta) con `c100` centrale, `rng` intervallo, `r` per porzione; `dbPortions` = porzioni in più per 29 voci del DB (§9.12). Non modificare a mano: rigenerare con `tools/userdb/build.mjs` |
| `tools/userdb/` | (fuori dall'app) | `alimenti-260.csv` (copia del file dell'utente), `build.mjs` (regole di conversione), `REPORT.md` (esclusi, doppioni, revisione) |
| `beta/data/foods-it.json` | | catalogo alimenti generato (oggi 9 voci USDA, 7,5 KB). Non modificare a mano: rigenerare con `tools/usda/build.mjs` |
| `beta/data/portions-it.json` | | porzioni standard LARN 2014 per 62 voci del DB del motore, per nome (§9.11). Caricate da `catalog.js` (`loadPortions`, `portionsFor`) |
| `beta/sw.js` | | SW beta, cache `carbo-beta-v18` (precarica anche `foods-stime.json`), network-first con `cache:"no-cache"` (e precarica con `cache:"reload"`): salta la cache HTTP di Pages (`max-age=600`), così dopo un rilascio non si mescolano file vecchi e nuovi. Precarica anche catalogo, porzioni, `catalog.js`, `restore.js`, `csv.js` |
| `tools/usda/` | (fuori dall'app) | `build.mjs` (find/build), `selection.json` (selezione curata + esclusi con motivo) → genera `beta/data/foods-it.json` |
| `CARBO_PROJECT_STATUS.md` | | questo report |

**Fonte di sviluppo:** la 2.0 è stata sviluppata fuori dal repo (cartella di lavoro temporanea della sessione Claude) e copiata in `beta/`. Le uniche differenze volute di `beta/` sono: nome "Carbo Beta" / "Carbo β" (manifest, `<title>`, `apple-mobile-web-app-title`) e nome cache SW `carbo-beta-vN`. D'ora in poi `beta/` va trattato come sorgente.

## 2. Funzionalità

### v1 (produzione, `/carbo/`) ✅
Foto → stima AI dei carboidrati, correzione tramite DB, conferme bloccanti, crudo/cotto, g/ml, obiettivo giornaliero, storico, impostazioni AI.

### 2.0 beta (`/carbo/beta/`)
| Funzione | Stato |
|---|---|
| Navigazione Oggi · Diario · + (pannello Aggiungi) · Altro | ✅ |
| Analisi foto tramite motore AI invariato | ✅ (provato con chiamata simulata) |
| Ricerca unificata (ricette, preferiti, prodotti salvati, DB, catalogo USDA) con etichette di fonte, e alimento personalizzato | ✅ |
| Catalogo USDA (9 frutti) con porzioni selezionabili a chip | ✅ (browser) |
| Altro → Fonti dei dati (Carbo, USDA, OFF, CREA in uso, inseriti da te) | ✅ (browser) |
| Eliminazione pasto con "Annulla", modifica pasto salvato | ✅ |
| Preferiti con quantità abituale, ultimi 15 alimenti recenti | ✅ |
| Ricette (dal piatto, porzioni, CHO per porzione) | ✅ |
| Scanner barcode + Open Food Facts + inserimento manuale + prodotti ricordati | 🟡 provato con fotocamera simulata |
| Quantità a pezzi/porzioni per prodotti scansionati | 🟡 |
| Promemoria: avviso in Oggi (finestra di 3 h, "Non oggi") + file `.ics` ricorrente | 🟡 `.ics` non provato su iOS |
| Export backup JSON (foglio di condivisione su telefono) | 🟡 |
| Tema Sistema/Chiaro/Scuro | ✅ |
| Porzioni standard LARN come pulsanti per 62 voci del DB | ✅ (browser) |
| Ripristino da backup con anteprima, Unisci / Sostituisci, copia di sicurezza e "Riporta i dati a prima del ripristino" | ✅ (browser; scelta del file su iPhone non provata) |
| Export CSV per foglio di calcolo | ✅ (browser; apertura in Numbers/Excel non provata) |
| Calendario mensile nel Diario (totale per giorno, tocco = filtro) | ✅ (browser) |
| Copia di un pasto (anche di un altro giorno) come nuovo pasto di oggi | ✅ (browser) |
| `navigator.storage.persist()` con stato in Altro → Dati | ✅ (browser: richiesta e messaggio) · ❓ concessione reale su iPhone |
| IndexedDB (copia di sicurezza automatica + recupero) | ✅ (browser, alpha.18) |
| Notifiche push | ⏳ escluse (servirebbe un backend) |

## 3. Motore AI — NON MODIFICARE

- Provider: Gemini (predefinito) o Anthropic, scelto in Altro → Analisi AI.
- Modelli (`beta/js/engine/ai.js`, `MODELS`):
  - Gemini, modalità veloce: `gemini-2.5-flash-lite` → `gemini-flash-lite-latest` → `gemini-2.5-flash`. Modalità accurata: `gemini-2.5-flash` → `gemini-flash-latest` → `gemini-2.5-flash-lite`.
  - Anthropic, modalità veloce: `claude-haiku-5-5` → `claude-sonnet-5-5`. Modalità accurata: ordine inverso.
- Flusso:
  1. `shrink` ridimensiona la foto (960 px, JPEG 0,82).
  2. `callAI` manda il prompt fisso con strategia *hedged*: se il primo modello non risponde entro 5 s, o dà un errore ritentabile, parte il secondo (timeout 25 s).
  3. La risposta JSON passa per `fromAI` (`fooddb.js`), che riconduce gli alimenti al DB, sostituisce i CHO con quelli del DB e assegna confidenza e conferme.
  4. `analyzePhoto(blob, hint, stage)` → `{items, model}`: è l'unico punto usato dalla UI.
- Chiave API: solo in `localStorage` (`carbo_key_gemini` / `carbo_key_anthropic`), inviata solo al provider. Mai inclusa nel backup.
- Intoccabili: `MODELS`, prompt, `shrink`, `httpErr`, `askModel`, `callAI`, DB e funzioni di `fooddb.js`, regola "non si salva con voci da confermare", nomi delle chiavi `carbo_prov`, `carbo_mode`, `carbo_key_*`.
- Verifica di regressione usata: risposta Gemini simulata (spaghetti al pomodoro 250 g, pane 40 g, coca cola 330 g, focaccia senza peso) → hash FNV del prompt `5a9885b0`, 4 elementi, totale 133,1 g. Identici tra v1, alpha.4 e alpha.5 (ripetuta il 16/11/2026 dopo l'integrazione del catalogo; `DB` resta di 92 voci). ❓ Lo script di verifica non è nel repo: viene eseguito nel browser.

## 4. Dati

- Persistenza: solo `localStorage`, stessa origine `leomasterslave.github.io` per v1 e beta → **v1 e beta condividono gli stessi dati**.

| Chiave | Contenuto | Usata da |
|---|---|---|
| `carbo` | `{goal, meals:[{id, ts, type, items:[{n, g, u, c100, ref?, rid?, ean?, cid?, pz?}], total, edited?}]}` | v1 + beta (formato compatibile; v1 ignora i campi nuovi) |
| `carbo_prov`, `carbo_mode`, `carbo_key_*` | impostazioni e chiavi AI | v1 + beta |
| `carbo_lib` | `{favorites, recents, recipes, products:{[ean]:{n, brand, c100, u, serving, pz?, src, ts}}}` | beta |
| `carbo_theme`, `carbo_rem`, `carbo_rem_off`, `carbo_last_backup` | tema, promemoria, rinvii, data dell'ultimo backup | beta |
| `carbo_prerestore` | `{ts, carbo, carbo_lib}`: copia dei dati prima dell'ultimo "Sostituisci" (una sola) | beta |

- Regola dello snapshot: ogni pasto salva `c100`, `g` e `total` al momento del salvataggio. Modificare ricette, preferiti o prodotti non cambia i pasti passati (✅ verificato).
- `pz` = `{w: grammi di 1 pezzo, l: "pezzo"|"porzione", t?: descrizione della porzione scelta}`.
- `cid` = identificativo della voce del catalogo esterno (`usda:<fdc_id>`, in futuro `crea:<codice>`), distinto da `ref` (nome nel DB del motore). È salvato in pasti, preferiti, recenti e ingredienti delle ricette; la chiave del preferito diventa `c:<cid>|<c100>`. Le voci senza `cid` mantengono la chiave di prima.
- Catalogo (`beta/data/foods-it.json`): `{format:"carbo-catalog", version, basis, sources, foods:[{cid, n, a?, cat, it, c100, u, units:[{t, w, l, base:"edibile", src}], src:{db, ds, id, desc, orig, formula}}]}`.
- Libreria corrotta: viene messa da parte, non cancellata (guardia di sola lettura in `library.js`).
- Backup: `{format:"carbo-backup", schemaVersion:2, appVersion, exportedAt, counts, checksum:{fnv1a32}, data:{meals, goal, library, settings}}`.
- Migrazione: nessuna necessaria finora (formato additivo).

### 4.1 Fase 4 — dati e Diario (17/11/2026, alpha.7, verificata nel browser, pubblicata; non provata su iPhone)
- **Ripristino** (Altro → Dati → "Ripristina da backup"):
  - si sceglie il file e si vede un'anteprima, senza alcuna modifica ai dati: data e versione del backup, pasti e periodo, preferiti/ricette/prodotti, cosa aggiungerebbe "Unisci", dati attuali;
  - controlli: JSON valido, `format`, `schemaVersion` (≤ 2; più recente = rifiutato), checksum FNV; i pasti di forma non valida vengono scartati e contati;
  - **Unisci**: aggiunge solo pasti (per `id`), preferiti (per alimento), ricette (per `id`) e prodotti (per EAN) mancanti; non modifica nulla di esistente; ripeterlo non aggiunge doppioni;
  - **Sostituisci**: solo con checksum corretto, doppio tocco, e solo dopo aver salvato `carbo_prerestore` (se lo spazio non basta non sostituisce);
  - "Riporta i dati a prima del ripristino" (doppio tocco) rimette `carbo` e `carbo_lib` della copia;
  - libreria di una versione più recente: si ripristinano solo i pasti.
- **Storage persistente**: `navigator.storage.persisted()` all'avvio, `persist()` dopo il primo pasto salvato; messaggio "protetta / non protetta" in Dati. ❓ Su iOS la concessione dipende dal sistema (di solito serve l'app installata in Home).
- **Calendario** nel Diario: mese corrente con totale del giorno (senza colori di giudizio), mesi precedenti, giorni futuri disattivati; toccare un giorno filtra lo storico, "Mostra tutti i giorni" toglie il filtro; funziona insieme alla ricerca.
- **Copia pasto**: aprendo un pasto salvato compare "Copia come nuovo pasto": il piatto diventa un pasto nuovo con l'ora attuale, da controllare e salvare. L'originale non cambia.
- **CSV**: Altro → Dati → "Esporta CSV"; colonne Data, Ora, Pasto, Alimento, Quantità, Unità, CHO per 100, CHO alimento, CHO pasto, ID pasto.
- Verifiche (localhost, dati di prova con 4 pasti):
  - JSON non valido e backup "più recente" rifiutati con messaggio;
  - Unisci: +1 pasto, pasto illeggibile ignorato, 4 pasti esistenti identici, +1 preferito; seconda unione: 0 aggiunte;
  - checksum alterato: avviso e niente "Sostituisci";
  - Sostituisci: primo tocco non cambia nulla; dopo il secondo restano 1 pasto e l'obiettivo del backup; copia di sicurezza identica ai dati precedenti; "Riporta" li rimette **identici byte per byte**;
  - calendario: 4 giorni con totale, filtro su un giorno, giorno vuoto, ritorno a tutti, mese precedente, mese successivo disattivato;
  - copia di un pasto del 14/11: nuovo pasto oggi con gli stessi alimenti e lo stesso totale (48,5 g), originale invariato;
  - CSV: intestazione + 6 righe per 6 alimenti, decimali con virgola;
  - motore AI: hash `5a9885b0`, 133,1 g, `gemini-2.5-flash-lite`;
  - nessun errore in console; 375 px senza scorrimento orizzontale; `git diff` su `beta/js/engine` e sui file di produzione vuoto;
  - dati di prova riportati allo stato iniziale.
- **IndexedDB — ✅ deciso e fatto (18/11/2026, alpha.18).** L'utente ha approvato la proposta: `localStorage` resta l'archivio principale fino alla promozione (la v1 legge `carbo`); IndexedDB (`carbo-safety`, store `snap`) tiene solo una copia delle stesse stringhe `carbo` e `carbo_lib`. La migrazione vera si farà con la promozione (Fase 5).
  - Modulo `js/data/idb.js`. Record `latest` + uno al giorno (`day:AAAA-MM-GG`, ultimi 7). Scrittura 1,5 s dopo ogni salvataggio (pasti, libreria, correzioni), 3 s dopo l'avvio e quando l'app va in secondo piano.
  - Mai una copia vuota sopra una buona: se `carbo` e `carbo_lib` mancano entrambi non si scrive.
  - Se all'avvio `localStorage` è vuoto e c'è una copia con dati: riquadro in Oggi "Recupera" / "Inizia da zero" (doppio tocco). Finché l'utente non sceglie la copia non viene sovrascritta.
  - Impostazioni → Dati mostra data e numero di pasti dell'ultima copia. Non sostituisce il backup (stesso telefono).
  - ✅ Browser: copia scritta, svuotamento simulato → riquadro con data e 2 pasti, copia protetta durante l'attesa, "Recupera" riporta i 2 pasti, "Inizia da zero" con conferma, stato in Impostazioni, nessun errore; dati di prova cancellati. ✅ Online: SW v27. ❓ Non provato su iPhone (comportamento di Safari quando svuota i dati).

## 5. Interfaccia

- Viste (`beta/index.html`):
  - `#v-oggi`: totale del giorno, obiettivo, avviso promemoria, pasti, pasti mancanti.
  - `#v-diario`: calendario mensile `#cal` + storico con ricerca.
  - `#v-altro` (scheda **Impostazioni** dalla alpha.11, icona a ingranaggio; id interno invariato): Alimenti (pannelli `#p-fav`, `#p-rcp`), Promemoria, Personalizzazione, Analisi AI, Dati, Applicazione (pannelli `#p-src` Fonti dei dati e `#p-info` **Crediti e avvertenze**: stime dell'AI, non è un dispositivo medico, dati e privacy, riconoscimenti). L'avvertenza AI non è più nel pannello Aggiungi (richiesta dell'utente, 17/11/2026).
- Piatto: le voci del catalogo hanno l'etichetta di fonte (`.tag.src`) e i chip delle porzioni (`.chips`/`.chip`). Toccare un chip imposta 1 porzione e passa al conteggio a pezzi; i grammi restano modificabili.
- Pannello Aggiungi `#sheet`: tipo di pasto, Foto / Codice a barre, ricerca, piatto, salva come ricetta, totale e Salva. Su telefono si chiude trascinando verso il basso; da 768 px in su è una finestra modale.
- Pannello Aggiungi, alpha.10 (17/11/2026, richiesta dell'utente; verificato nel browser, pubblicato con commit `56ea08e` e verificato online; non provato su iPhone):
  - a ricerca vuota: tendine `details.pdrop` **Preferiti**, **Recenti**, **Ricette** (in fondo), chiuse di default con il numero di voci; l'ultima apertura è ricordata in `carbo_drops` (solo comodità, nessun dato dei pasti). Nei risultati di ricerca le ricette sono in fondo;
  - righe di ricerca: il nome ha tutta la larghezza, i dettagli vanno a capo sotto quando non ci stanno. Testo ridotto a "≈ 76,3 g/100 g · STIMA" (l'intervallo è nei dettagli);
  - piatto compatto: nome, tag, "g/100", porzioni e quantità. Toccando il nome (`data-more`, freccia) si aprono intervallo, note di affidabilità, porzione in g di CHO e fonte delle porzioni. `more` resta solo nell'interfaccia e non viene salvato;
  - avvertenze (`.note.fine`) a 10 px;
  - alpha.12: dopo la scelta (porzione toccata o grammi confermati, nessuna domanda aperta) l'alimento si riduce a **nome + carboidrati** (`.item.min`; resta solo il tag "Confidenza bassa" dell'AI). Toccando il nome si riapre con dettagli e controlli; i pulsanti +/− lo tengono aperto (`hold`) finché non si ritocca il nome. `hold`/`more` non vengono salvati. Le voci da preferiti/recenti con quantità partono ridotte;
  - zoom disattivato: viewport `maximum-scale=1, user-scalable=no`, `touch-action:manipulation`, blocco di `gesturestart` e del pinch (Safari iOS ignora `user-scalable`). ⚠️ Chi ha bisogno di ingrandire deve usare lo Zoom di iOS (Accessibilità);
  - tipo di pasto automatico in base all'ora: c'era già (`defaultType`: <10 Colazione, <15 Pranzo, <18 Spuntino, poi Cena), applicato all'apertura del pannello con il piatto vuoto.
- Scanner `#scanner`: mirino, inserimento manuale del codice, scheda prodotto.
- Dock in vetro con tre schede e pulsante + centrale; toast con "Annulla".
- Design system (`beta/css/app.css`, `:root`):
  - Tema scuro: `#191816` / `#22201D` / `#2B2824` / testo `#EEE9DF` / secondario `#A49B8F` / accento `#E59A70` / divisori `#37332E`.
  - Tema chiaro derivato, con accento `#A84A1C` per avere contrasto sufficiente.
  - Serif di sistema (`ui-serif`) per titoli e numeri, sans di sistema per l'interfaccia, `tnum` sui numeri, densità compatta, nessun web font.
  - L'accento è riservato ai carboidrati e all'azione primaria.

## 6. Stato dello sviluppo

- Roadmap e percentuali: vedi §10.
- Completato: Fasi 0–3 (audit; moduli + export; preferiti/recenti/ricette; barcode + promemoria) e i pezzi/porzioni per i prodotti.
- Fase D completata nel browser: USDA (§9.10), LARN (§9.11), elenco utente (§9.12), CREA (§9.13).
- Aggiunte fuori roadmap (18/11/2026, richieste dall'utente): Descrivi il piatto (§9.14), mini chat con l'AI (§9.15), Correggi alimenti per tutti gli alimenti (§9.16).
- Pubblicate: alpha.5 (`c83e149`, 16/11/2026), alpha.6 (`1d5942a`, 17/11/2026).
- Fase 4 completata nel browser: 5 attività in alpha.7 (17/11/2026), copia di sicurezza IndexedDB in alpha.18 (18/11/2026, §4.1).
- In attesa: test della beta su iPhone da parte dell'utente.
- Problemi noti:
  1. Non verificati su iPhone reale: fotocamera/ZXing, apertura `.ics`, foglio di condivisione del backup, trascinamento del pannello, installazione in Home.
  2. Dati condivisi tra v1 e beta: le modifiche fatte nella beta sono reali.
  3. Il SW v1 (`sw.js`), quando si aggiorna, cancella tutte le cache diverse da `carbo-v8`, compresa quella della beta. Impatto: solo la riserva offline. Il SW 2.0 elimina solo le proprie versioni.
  4. ~~Nessun ripristino da backup~~: risolto in alpha.7 (§4.1), da provare su iPhone (scelta del file da "File").
  5. Storage persistente richiesto da alpha.7, ma su iOS la concessione non è garantita senza installazione in Home: i backup restano necessari.
  6. Due schede aperte si sovrascrivono lo stato (eredità v1).
  7. Open Food Facts spesso non ha il peso del pezzo: in quel caso lo inserisce l'utente, e viene ricordato.
  8. `app.js` (~47 KB) e `app.css` sono file unici, più grandi della suddivisione prevista nella Fase 0.
  9. Nessun test automatico versionato.
  10. ~~Catalogo piccolo~~: ora 1090 alimenti (DB interno 92 + USDA 9 + CREA 831 + elenco utente 158). Nomi CREA tecnici ("Pere, fresche, Abate Fetel"): la ricerca "mela" non trova le "Mele" CREA.
  13. Le funzioni AI aggiunte il 18/11 (Descrivi, mini chat) sono provate solo con risposte simulate: manca la prova con una chiave reale.
  11. Nel piatto i chip delle porzioni vanno a capo uno per riga su telefono (colonna del nome stretta): funzionano, ma l'impaginazione si può migliorare.
  12. Se dopo aver scelto una porzione si inseriscono grammi a mano, il chip resta evidenziato come unità di riferimento (comportamento voluto, ma da valutare con l'utente).

## 7. Prossimi interventi (priorità)

1. Fase V: prova su iPhone di alpha.18 con chiave reale (Descrivi, mini chat, CREA, Correggi alimenti, stato della copia di sicurezza) e delle 5 voci di V; correggere quello che emerge.
2. Fase 5 (include la migrazione vera a IndexedDB): rifinitura e accessibilità, test finale, promozione della beta a produzione (sostituire la root con `beta/` togliendo le differenze "Beta"; richiede l'approvazione dell'utente).
3. Dati: pasta fresca e ripiena da rivedere con una fonte (§9.12); sinonimi comuni per i nomi CREA (es. "mela" → "Mele, fresche…").
4. Facoltativo: suite di regressione del motore AI nel repo.

## 8. Decisioni e vincoli

- Evoluzione, non riscrittura. Motore AI invariato (`ai.js`, `fooddb.js`) e usato tramite `analyzePhoto`; le descrizioni passano da `describe.js`, che riusa chiave, modelli e `fromAI` senza modificarli.
- Dal 18/11/2026 (alpha.17, scelta dell'utente): le correzioni dell'utente alle voci del DB interno si applicano **dopo** il motore, al valore usato nel piatto, anche per foto e descrizioni. Il motore e i suoi file restano identici (hash `5a9885b0`, 133,1 g); cambia il risultato mostrato solo se l'utente ha corretto quella voce.
- Nessuna build e nessun framework: moduli ES serviti direttamente da Pages.
- Mai perdere i dati: formato additivo, niente rinomina delle chiavi, dati corrotti messi da parte e non cancellati, e prima di ogni migrazione un backup.
- Snapshot nutrizionale obbligatorio nei pasti.
- La chiave API resta sul dispositivo e non entra mai nel backup. A Open Food Facts va solo l'EAN.
- Promemoria non invasivi né colpevolizzanti, senza backend (in-app + `.ics`).
- Barcode: ZXing caricato su richiesta (iOS non ha `BarcodeDetector`), EAN validati con checksum GS1, UPC-A normalizzato a EAN-13.
- La beta vive in `/carbo/beta/` dello stesso repo; la produzione `/carbo/` non va toccata fino alla promozione.
- Ogni rilascio della beta: aumentare `APP_VERSION` (`beta/js/data/backup.js`) e la versione della cache in `beta/sw.js`.
- Questo file va aggiornato a ogni modifica significativa.

## 9. Sistema alimentare (audit 16/11/2026, poi integrazione USDA)

### 9.1 Stato attuale
- `beta/js/engine/fooddb.js` `DB`: 92 voci, 109 sinonimi, 4 coppie crudo/cotto, 6 liquidi (ml + densità), 3 piatti composti, 9 valori provvisori. Solo 12 voci hanno una fonte (`s`); le altre 80 sono "valori medi indicativi" della v1, non ricontrollati.
- Il campo `g` della voce è una porzione tipica usata solo come segnaposto, mai come peso.
- **Il DB fa parte del motore AI**: `fromAI` → `dbMatch` sostituisce i CHO stimati dall'AI con quelli del DB. Aggiungere o cambiare voci nel DB cambia i risultati dell'AI.
- Altri livelli già presenti:
  - `products.js`: prodotti per EAN (OFF + inseriti a mano), con `pz` = peso del pezzo o della porzione;
  - `library.js`: preferiti, recenti e ricette come snapshot;
  - `app.js` `renderSug`: ricerca su ricette, preferiti e DB, più l'alimento personalizzato.
- Duplicati e incoerenze nel DB:
  - "Pizza margherita" e "Pizza (trancio)" hanno lo stesso valore (33), così come "Succo di frutta" (11) e "Succo d'arancia" (10);
  - "Noci / mandorle" e "Prosciutto" sono voci generiche che coprono alimenti diversi;
  - la base dei valori è mista: alcuni sono presi da etichette, altri da tabelle ❓.
- Copertura mancante (verificata sull'elenco): gran parte della frutta (ciliegie, albicocche, ananas, mandarini, frutta secca ed essiccata), bibite zuccherate diverse dalla cola, bevande vegetali, legumi crudi, pani speciali, merendine generiche, frutta sciroppata, salse.

### 9.2 Fonti esterne
| Fonte | Accesso | Licenza | Uso proposto |
|---|---|---|---|
| CREA (alimentinutrizione.it, aggiornamento dic. 2019) | Solo pagine web per alimento: nessuna API e nessun download trovati. Ogni scheda riporta parte edibile, CHO disponibili, amido, zuccheri, fibra e una porzione standard | Nessuna licenza esplicita: vietata la copia "senza una chiara indicazione della fonte". ❓ L'estrazione di una parte sostanziale può essere coperta dal diritto *sui generis* UE sulle banche dati | Fonte primaria per gli alimenti generici italiani, **dopo** aver chiesto conferma a CREA-AN; nel frattempo solo valori puntuali con citazione |
| USDA FoodData Central | API con chiave data.gov (1.000 richieste/ora; DEMO_KEY 30/ora) + download in blocco | CC0, pubblico dominio; attribuzione richiesta ma non obbligatoria | Complementare: estrazione offline (Foundation / SR Legacy) dei soli alimenti assenti in CREA, con nomi italiani curati. Nessuna chiamata dall'app: la chiave finirebbe nel codice pubblico |
| Open Food Facts | API v2 per EAN (già integrata); limiti di frequenza non pubblicati ❓ | ODbL + DbCL; attribuzione "© Open Food Facts contributors"; obbligo di condividere con la stessa licenza i database derivati | Resta per barcode e confezionati. Non va fuso nel catalogo statico distribuito con l'app (ODbL). Cache solo sul dispositivo |
| LARN 2024 (SINU) | Documenti PDF | ❓ non verificata | Porzioni standard di riferimento (frutta 150 g; pane 50 g; sostituti del pane, cereali e biscotti 30 g; prodotti da forno dolci 30 g). Valori da ricontrollare sul documento ufficiale SINU |

### 9.3 Incompatibilità individuate
1. **Base dei carboidrati.** CREA esprime i CHO disponibili in equivalenti di monosaccaridi, con l'amido moltiplicato per 1,1. Verifica: riso basmati crudo = amido 74,4 × 1,1 + zuccheri 1,1 = 82,9. Le etichette UE (e quindi OFF) indicano i carboidrati in peso, quindi sullo stesso riso ≈ 75,5. Sui cibi amidacei la differenza è ≈ +9–10%.
2. USDA indica i carboidrati "by difference", cioè **fibra compresa**: per ottenere i disponibili bisogna sottrarre la fibra totale.
3. I valori sono per 100 g di **parte edibile** (CREA, USDA), mentre l'utente spesso pesa il frutto intero o conosce solo "1 mela".
4. Liquidi: le fonti danno valori per 100 g, la UI usa ml, quindi serve la densità.
5. Nomi: CREA usa nomi tecnici ("Riso Basmati, crudo"), USDA è in inglese; il DB e il matching usano nomi comuni e sinonimi.
6. Ampliare `DB` modifica il motore AI → vietato senza approvazione esplicita.

### 9.4 Proposta originale (approvata il 16/11/2026, con le decisioni del §9.5)
- **Livelli separati.** Il DB del motore resta congelato. Nuovo catalogo `beta/data/foods-it.json`, generato offline da uno script versionato (`tools/`), usato solo da ricerca e inserimento manuale. Priorità nella ricerca: ricette > preferiti/recenti > prodotti salvati > DB del motore > catalogo CREA > USDA. Nomi duplicati con il DB nascosti.
- **Normalizzazione:** un solo campo `c100` = CHO disponibili in g per 100 g di parte edibile, in **peso** come in etichetta.
  - CREA: amido + zuccheri.
  - USDA: carboidrati by difference − fibra.
  - Si conservano anche il valore originale e la fonte (`src`, `id`) per tracciabilità.
  - Liquidi: `c100ml = c100 × densità`.
  - ✅ Deciso: base a peso; per CREA amido + zuccheri (§9.5).
- **Tre concetti distinti:**
  1. valore nutrizionale (`c100`, con fonte);
  2. peso convenzionale (`units:[{l, w, src}]`, per esempio "1 mela media 150 g", "1 fetta di pane 30 g", "1 lattina 330 ml": sono suggerimenti con fonte, e distinguono peso lordo e netto/parte edibile);
  3. quantità effettiva (`g` dell'elemento, scelta o confermata dall'utente e salvata come snapshot).
- **Porzioni automatiche:** chip toccabili sotto l'alimento ("1 media · 150 g"). Non vengono mai applicate senza un tocco, come la regola attuale "porzione tipica = solo suggerimento". Si riusa il modello `pz` già presente (`products.js`), esteso a più unità. Fonti: porzioni standard CREA/LARN e pesi medi per pezzo, citati.
- **Cache:**
  - catalogo statico versionato, caricato alla prima ricerca e messo in cache dal SW (≈ 100–200 KB stimati ❓);
  - OFF: prodotti confermati in `carbo_lib.products` (già esistente), più una cache delle risposte grezze con scadenza (30 giorni) e dei "non trovato" (24 h);
  - passaggio a IndexedDB insieme alla Fase 4;
  - nessuna chiamata USDA a runtime.
- **Snapshot:** gli elementi salvati aggiungono `src` (`crea` / `usda` / `off` / `db` / `manual`) e restano immutabili. Nessuna modifica ai pasti esistenti.
- **Ordine di lavoro:**
  1. decisione sulla base CHO e richiesta a CREA;
  2. modello `units` e chip porzioni sui dati esistenti (DB + prodotti);
  3. script e catalogo USDA (CC0) per le lacune;
  4. catalogo CREA dopo il via libera;
  5. solo su richiesta, aggiornamento del DB del motore con test di regressione AI.

### 9.5 Decisioni approvate (16/11/2026)
1. Base unica: g di CHO disponibili per 100 g, coerenti con le etichette UE.
2. CREA: **amido + zuccheri** (a peso). Decisione aggiornata il 16/11/2026: sostituisce "amido × 1,1 + zuccheri", che corrisponde al valore CREA pubblicato in monosaccaridi. Il valore CREA pubblicato si conserva come `orig`.
3. USDA: carboidrati by difference − fibra totale.
4. OFF: carboidrati dichiarati in etichetta.
5. Il DB del motore AI resta **congelato**.
6. Catalogo separato in `beta/data/foods-it.json`.
7. Porzioni convenzionali = suggerimenti da toccare, mai applicate senza conferma.
8. Distinti peso lordo, parte edibile e quantità consumata.
9. Si conservano fonte, id originale e valore originale.
10. ~~CREA: nessuna estrazione in massa finché i diritti di riuso non sono chiariti.~~ Superata il 18/11/2026: l'utente ha scelto di importare e pubblicare l'elenco CREA (§9.13).

**✅ Risolto (decisioni 1 e 2):** l'utente ha scelto amido + zuccheri, coerente con la base a peso.
- Conseguenze note: sui cibi amidacei il valore CREA normalizzato è ≈ 7–9% più basso del valore pubblicato e delle etichette di pasta (pasta 66,3 contro 70,9–71,2 in etichetta), mentre per il riso è in linea con le etichette (75,5 contro 76–78).
- Per la frutta (amido ≈ 0) non cambia nulla.
- Nell'interfaccia va indicato che il valore deriva da CREA ed è normalizzato.
- Se una scheda non ha amido o zuccheri, la voce non entra nel catalogo (non si ricava il valore dal totale).

### 9.6 Formule verificate e confronto tra fonti
Formula CREA ricalcolata da amido e zuccheri sulle schede: 6 casi su 6 coincidono con il valore pubblicato (scarto ≤ 0,05).

| Alimento | DB motore (congelato) | CREA pubblicato = a×1,1+z (`orig`) | **CREA a+z (valore adottato)** | USDA cbd−fibra | OFF etichette | Note |
|---|---|---|---|---|---|---|
| Mela con buccia | 14 | 10,0 (CREA 007120) | 10,0 | 11,4 (fdc 171688) | — | DB +23/+40%. Parte edibile CREA 85%, porzione 150 g |
| Banana | 21 | 17,4 (007510) | 17,2 | 20,2 (173944) | dati OFF inutilizzabili (banane essiccate) | DB +4/+21%. Parte edibile 65% |
| Pasta di semola cruda | 72 | 72,7 (000800) | 66,3 | 71,5 (169736) | 70,9–71,2 (Barilla) | Fonti coerenti tranne la somma a peso |
| Riso crudo | 80 | 82,9 basmati (000130) | 75,5 | 78,7 parboiled/long grain (168877) | 76–78 basmati (6 prodotti) | Varietà diverse |
| Pane | 55 | 59,5 pane bianco tipo 0 (000530) | 54,3 | 46,7 pane americano (174924) | 47–51 (pancarrè) | **USDA non adatto al pane italiano** |
| Patate lesse | 17 | 16,9 (006515) | 15,4 | 18,2 (170440) | 17,9 (1 prodotto) | — |

Discrepanze da tenere presenti:
- La frutta nel DB del motore è più alta del 20–40% rispetto a CREA. Il DB resta congelato: la discrepanza va mostrata e decisa in seguito, con test di regressione dell'AI.
- USDA rappresenta prodotti americani (pane, bevande, merendine): va usato solo per alimenti "neutri" (frutta, bevande vegetali, frutta secca).
- Le porzioni USDA sono in misure americane (cup, NLEA serving): vanno riviste a mano. ❓ Da verificare sulla documentazione SR se `gram_weight` sia sempre riferito alla parte edibile.
- Il pacchetto CSV Foundation Foods 10/2026 scaricato non contiene `food.csv` né `food_nutrient.csv` ❓. Per ora si usa SR Legacy 04/2018 (definitivo, non più aggiornato).

### 9.7 Strumento USDA (fuori dall'app)
- `tools/usda/build.mjs`: script Node senza dipendenze.
  - `node tools/usda/build.mjs find <cartella-csv> "<testo>"` cerca un alimento e mostra i CHO normalizzati;
  - `node tools/usda/build.mjs build <cartella-csv>` legge `tools/usda/selection.json` e scrive `beta/data/foods-it.json`.
  - Una voce entra solo se ha CHO e fibra, non ha flag (valore negativo, scarto > max(2 g, 15%) rispetto ad amido + zuccheri) e ogni porzione esiste in USDA.
- I dati grezzi USDA non sono nel repo: si scaricano da fdc.nal.usda.gov (SR Legacy CSV, circa 6 MB zip). `usda-candidates.json` è stato sostituito dal catalogo.

### 9.8 Integrazione con la ricerca: verifica (analisi del codice)
- Nessuna interferenza con l'AI se il catalogo resta un array separato:
  - `dbMatch` usa `IDX`, costruito una sola volta da `DB` al caricamento di `fooddb.js`;
  - `fromAI` legge solo `DB`.
  - Vincolo: non fare mai `push` nell'array `DB` esportato.
- Punti da adattare in `beta/js/app.js`:
  - `renderSug` costruisce i suggerimenti con `data-f` = indice in `DB`: il catalogo deve usare un attributo proprio (`data-c`);
  - `itemFromFood` e `snapFood`/`foodKey` (`library.js`) riconoscono solo `ref` = nome nel DB: per il catalogo serve un `cid` (es. `usda:171719`) che entri nella chiave del preferito;
  - i suggerimenti di candidati dell'AI (`data-alt` → `dbByName`) restano solo sul DB.
- Sovrapposizioni dei nomi (provate con `dbMatch`): "pesca sciroppata", "latte di mandorla" e "latte di soia" risultano ambigui con Pesca e Latte. Nella ricerca le voci del catalogo restano separate e hanno nomi completi.
- Ordine dei risultati: ricette > preferiti/recenti > prodotti salvati > DB motore > catalogo. Le voci del catalogo con lo stesso nome di una voce del DB vengono mostrate sotto "Altre fonti" solo se il valore differisce di più del 10%.

### 9.9 Attribuzione delle fonti (proposta)
- Ogni voce del catalogo: `src:{db, id, desc, orig, formula}`. Ogni elemento salvato in un pasto: `src:"usda:171719"` / `"crea:000800"` / `"off:<ean>"` / `"db"` / `"manual"`, solo informativo e immutabile.
- Nell'interfaccia: etichetta breve nella riga di ricerca e nella riga del piatto (CREA · USDA · OFF · Carbo · Mio) e una pagina **Altro → Fonti dei dati** con le citazioni:
  - CREA: "CREA Centro di ricerca Alimenti e Nutrizione", con URL, obbligatoria;
  - USDA: citazione suggerita (CC0);
  - OFF: "© Open Food Facts contributors", ODbL.
- Attuazione (alpha.5): nei pasti si salva `cid` (non un campo `src` separato); la fonte si ricava dal prefisso. Le voci del DB mostrano "Carbo", i prodotti "OFF" o "Mio", il catalogo "USDA".

### 9.10 Integrazione USDA (16/11/2026) — completata e verificata nel browser
**Revisione dei 13 candidati** (`tools/usda/selection.json`):
- Formula ricontrollata a mano (es. ciliegie 16,01 − 2,1 = 13,9). Per tutte le voci incluse lo scarto rispetto ad amido + zuccheri è < 2 g.
- **Incluse 9 voci**, con c100 in g/100 g di parte edibile:

| Voce | c100 | Porzioni |
|---|---|---|
| Ciliegie | 13,9 | 1 ciliegia 8,2 g |
| Albicocche | 9,1 | 1 albicocca 35 g |
| Ananas | 11,7 | 1 fetta sottile 56 / 1 fetta 84 / 1 fetta grande 166 g |
| Mandarini | 11,5 | 1 piccolo 76 / medio 88 / grande 120 g |
| Fichi | 16,3 | 1 piccolo 40 / medio 50 / grande 64 g |
| Prugne | 10,0 | 1 prugna 66 g |
| Mango | 13,4 | 1 mango senza buccia né nocciolo 336 g |
| Melone cantalupo | 7,3 | 1 fetta (1/8) di melone piccolo 55 / medio 69 / grande 102 g |
| Datteri Medjool | 68,3 | 1 dattero senza nocciolo 24 g |

- **Escluse 4 voci**, con il motivo registrato in `selection.json`:
  - pesche sciroppate: sciroppo denso USA, dipende dal prodotto;
  - bevanda alle mandorle: dati incoerenti, 1 cup = 262 g;
  - bevanda di soia: prodotto zuccherato USA;
  - tè freddo: marca USA.
  - Per tutte e quattro si consiglia il codice a barre.
- Porzioni:
  - tenute solo quelle "a pezzo" presenti in USDA, con i diametri convertiti in cm;
  - escluse le misure a volume (cup) e le porzioni di etichetta USA (NLEA);
  - nessuna porzione inventata.
- Lordo e parte edibile: tutte le porzioni sono marcate `base:"edibile"`. Lo indicano le descrizioni USDA ("yields", "without refuse", "pitted"; 1 cup di ciliegie con nocciolo = 138 g contro 154 g senza). ❓ La definizione ufficiale nella documentazione SR non è stata letta (il PDF non era leggibile). Il peso lordo non è disponibile nel CSV FDC e quindi non è indicato.

**File nuovi o modificati** (nessuna modifica a `beta/js/engine/*` né ai file della root di produzione; verificato con `git status`/`diff`):
- nuovi: `beta/data/foods-it.json`, `beta/js/data/catalog.js`;
- modificati:
  - `beta/js/app.js`: ricerca, `itemFromCat`, chip, salvataggio di `cid`, avvio del catalogo;
  - `beta/js/data/library.js`: `cid` in `snapFood`/`foodKey`, `pz.t`;
  - `beta/js/data/products.js`: `cleanPz` conserva `t`;
  - `beta/index.html`: voce e pannello Fonti;
  - `beta/css/app.css`: chip, etichette, pagina Fonti;
  - `beta/sw.js`: v14, precarica il catalogo;
  - `beta/js/data/backup.js`: `APP_VERSION` alpha.5;
  - `tools/usda/*`.

**Verifiche eseguite** (localhost, `/beta/`, dati di prova con 3 pasti "storici" nel formato v1/alpha.4):
- Ricerca: "mandarin" → Mandarini · USDA; "melone" → Melone cantalupo · USDA; "mela" → preferito + DB "Carbo" (nessun duplicato); "pingui" → Prodotti · OFF; "pesca" → solo la voce DB.
- Inserimento e calcolo:
  - mandarino aggiunto senza peso → richiesta bloccante;
  - chip "1 medio" → 88 g = 10,1 g di CHO; + 1 pezzo = 176 g → 20,2 g;
  - 150 g scritti a mano → 17,3 g;
  - datteri 30 g → 20,5 g; totale 40,7 g.
- Preferiti: stella → "2 pezzi abituali", salvati con `cid` e `pz.t`. Recenti: "Mandarini · 2 pezzi".
- Ricetta dal piatto: ingredienti con `cid`; 2 porzioni → 20 g a porzione.
- Pasto salvato con `cid` e `pz`. Riaprendolo per modificarlo, i chip ritornano dal catalogo.
- **Pasti precedenti identici byte per byte** dopo tutte le operazioni.
- Motore AI: hash del prompt `5a9885b0`, 4 elementi, 133,1 g, modello `gemini-2.5-flash-lite`. `DB.length` = 92, nessuna voce USDA nel DB, `dbMatch("mandarini")` = nessun risultato (come prima).
- Console: nessun errore. Layout a 375 px senza scorrimento orizzontale.
- **Non verificato:** iPhone reale; comportamento offline del catalogo dopo l'aggiornamento del SW.

### 9.11 Porzioni standard LARN (17/11/2026) — verificate nel browser, pubblicate in alpha.6 (non provate su iPhone)
- Richiesta dell'utente: una misura standard per gli alimenti comuni (piatto di pasta, pane, frutta…).
- Fonte: SINU, LARN IV Revisione (2014), "Standard quantitativi delle porzioni", Tabella 1 (PDF ufficiale SINU, testo estratto e letto riga per riga). La V Revisione (2024) non è stata trovata in forma consultabile: ❓ eventuali valori cambiati (es. pizza) non sono verificati.
- Regola LARN: porzioni riferite al **crudo, al netto degli scarti**, salvo latte e derivati, pane, prodotti da forno e dolciumi (pronti al consumo).
- `beta/data/portions-it.json`: 62 voci del DB del motore (chiave = nome, letto in sola lettura; `fooddb.js` invariato, `DB.length` = 92). Esempi:
  - pasta cruda / riso crudo 80 g;
  - gnocchi 150 g; lasagna 250 g; pizza al piatto 350 g;
  - pane 50 g; cracker e grissini 30 g; croissant 50 g (farcito 70 g);
  - frutta 150 g; yogurt 125 g; latte 125 ml;
  - succo 200 ml; lattina 330 ml; vino 125 ml;
  - legumi 150 g; verdure 200 g; insalata 80 g.
- **Non hanno porzioni** le voci cotte di cereali (pasta, riso, couscous, farro, orzo cotti, polenta): la porzione LARN è a crudo e convertirla richiederebbe un fattore di cottura senza fonte. Per un piatto di pasta si usa "Peso a crudo", che mostra 80 g.
- Non hanno porzioni nemmeno patate, toast, focaccia, Nutella, piatti composti e alimenti che non sono nella tabella.
- Banana, kiwi, fragole, uva e anguria hanno "1 porzione di frutta" (150 g), non "1 frutto": la tabella non dà il peso di una banana.
- Comportamento:
  - i pulsanti compaiono anche sulle voci riconosciute dall'AI, ma non cambiano il peso stimato finché non si toccano;
  - cambiando crudo/cotto la porzione scelta viene tolta;
  - con le bevande l'unità mostrata è ml (corretto anche "in tutto").
- Verifiche:
  - pasta cruda 80 g = 57,6 g di CHO; 2 porzioni = 115,2 g;
  - lattina 330 ml = 35 g; pane 50 g; banana 150 g = 31,5 g, poi 120 g scritti a mano = 25,2 g;
  - un alimento senza peso blocca il salvataggio;
  - il pasto salvato contiene `ref` e `pz.t`; modificandolo i pulsanti ricompaiono;
  - pasti precedenti identici;
  - motore AI: hash `5a9885b0`, 133,1 g, `gemini-2.5-flash-lite`;
  - nessun errore in console; 375 px senza scorrimento orizzontale;
  - `git diff` su `beta/js/engine` vuoto.
- Altri file: `catalog.js` (caricamento), `app.js` (`unitsOf`, `askPortion`, chip con unità, crudo/cotto), `index.html` (voce LARN in Fonti), `app.css` (`.chsrc`), `sw.js` v15, `backup.js` alpha.6.

### 9.12 Elenco alimenti dell'utente (17/11/2026) — verificato nel browser, pubblicato in alpha.9 (non provato su iPhone)
- Fonte: `database_carbo_260_alimenti.csv` fornito dall'utente (260 righe: 214 stime "da verificare", 32 con porzione da documento istituzionale e CHO stimati, 14 da etichetta del produttore). Copia in `tools/userdb/alimenti-260.csv`.
- Regole dell'utente, come sono state applicate da `tools/userdb/build.mjs`:
  - **valore centrale + intervallo:** `c100` = media dei punti centrali per 100 g, usata nei calcoli; `rng` (per 100 g) e `r` (g di CHO per porzione) sono mostrati con "≈" e "stima lo–hi";
  - **crudo/cotto:** lo stato indicato dal file va nel nome (es. "Riso basmati crudo", "Quinoa secca", "Patate dolci cotte"); lo script si ferma se manca. I piatti pesati su un ingrediente lo dicono: "Pasta al pomodoro (peso della pasta a crudo)". 14 verdure senza stato nel file mostrano "l'elenco non indica se crudo o cotto";
  - **doppioni:** 3 righe identiche (Kinder Cards, Choco Fresh, Maxi King) unite; 10 frutti già USDA esclusi; le voci uguali al DB del motore non diventano nuove voci: aggiungono solo una porzione con un peso diverso (es. Banana 120 g, Latte 200 ml, Nutella 15/30 g, Patate lesse 200 g), mentre i carboidrati restano quelli del DB. 46 porzioni con un peso già presente sono state scartate;
  - **pasta fresca e ripiena in revisione, non importata (8):** pasta fresca all'uovo, tagliatelle all'uovo, tortellini, cappelletti, ravioli ricotta e spinaci, culurgiones, cannelloni ricotta e spinaci, seadas;
  - **fonti distinte:** tag "Stima" (`est:`) o "Etichetta" (`lab:`, 9 voci Kinder), oltre a USDA e Carbo. In `src` ci sono riga e valori originali del file;
  - **motore separato:** `fooddb.js` è solo letto dallo script; il riconoscimento delle foto non cambia.
- Non importate perché senza peso (4): Toast prosciutto e sottiletta, Sushi misto, Kebab in piadina; Cappuccino (nel file in ml di latte, nel DB in g). Dettaglio riga per riga in `tools/userdb/REPORT.md`.
- ⚠️ Lo scarto tra file e DB è segnalato nel REPORT (es. Kiwi 11,5 contro 9 g/100 g). Il valore del DB non è stato cambiato.
- Interfaccia (`app.js`): nella ricerca "≈ 79,4 (77,5–81,3) g/100 g · STIMA"; nel piatto, intervallo e note ("valore indicativo: se hai la confezione usa il codice a barre", "da etichetta: verifica che il formato sia lo stesso", "piatto composto: valore medio"); sotto i pulsanti: "porzioni dal tuo elenco" / "porzioni: LARN e tuo elenco". Pagina Fonti: voce "Il tuo elenco alimenti".
- Verifiche (browser, localhost):
  - catalogo con 167 voci (9 USDA + 149 stime + 9 etichette);
  - Riso basmati 80 g ≈ 63,5 g (stima 62–65); Broccoli con la nota sullo stato; Kinder Cards 1 pezzo = 14,3 g; Latte 200 ml dal file accanto a 125 ml LARN;
  - il pasto salvato ha gli stessi campi di sempre (`n`, `g`, `u`, `c100`, `cid`/`ref`, `pz`), i 4 pasti esistenti sono identici e i dati di prova sono stati ripristinati;
  - motore AI: hash `5a9885b0`, 133,1 g, `gemini-2.5-flash-lite`;
  - console senza errori; 375 px senza scorrimento orizzontale;
  - `git diff` vuoto su `beta/js/engine`, `foods-it.json`, `portions-it.json` e sui file di produzione.
- Online (17/11/2026, dopo il push): cache `carbo-beta-v18` attiva, versione alpha.9, ricerca "basmati" e "kinder" corrette, voce Fonti presente, `foods-stime.json` in cache, nessun errore in console.
- iPhone (17/11/2026, screenshot dell'utente): ✅ Riso basmati crudo (≈ 79,4, stima 77,5–81,3; 80 g ≈ 63,5 g, stima 62–65) · ✅ Kinder Cards ETICHETTA 14,3 g · ✅ Banana 150 g + 120 g = 25,2 g, "porzioni: LARN e tuo elenco" · ✅ Broccoli con nota crudo/cotto · ✅ Pasta al pomodoro senza nota del codice a barre · ✅ totale piatto 173,5 g corretto · ✅ pagina Fonti.
- ✅ iPhone offline (modalità aereo, screenshot dell'utente): ricerca "pasta" con le voci STIMA funzionante.
- ❓ Non verificati su iPhone: esclusione dei tortellini, salvataggio del pasto.

### 9.13 Catalogo CREA (18/11/2026) — verificato nel browser e online, pubblicato in alpha.13/14 (non provato su iPhone)
- Fonte: `database_alimenti.xlsx` fornito dall'utente (832 righe dalle tabelle CREA, agg. dicembre 2019). L'utente ha deciso di importarlo e pubblicarlo assumendosi la questione dei diritti di riuso (sostituisce la regola §9.5.10). Restano da citare CREA e l'URL (fatto nella pagina Fonti).
- Script `tools/crea/build.mjs` → `beta/data/foods-crea.json` (831 voci, `cid` `crea:<codice>`), report `tools/crea/REPORT.md`. Il DB del motore non è toccato.
- Regola §9.5.2 applicata: c100 = amido + zuccheri = (pubblicato − zuccheri) / 1,1 + zuccheri; il pubblicato resta in `src.orig`. 230 voci cambiano (es. riso basmati crudo 82,9 → 75,5, come in §9.6).
- "tr" (tracce) = 0 (21 voci). Escluso lo zucchero (104,5 anche normalizzato: resta la voce del DB). Porzione standard CREA come pulsante (827 voci); 3 porzioni incoerenti con i CHO per porzione del file non importate (patate fritte, una varietà di pere, pomodorini).
- Ricerca: ordine a parità di rango per nome più corto; fino a 8 voci di catalogo (prima 6).
- ✅ Browser: 831 voci caricate, ricerca "pane/pere/uova/parmigiano", voce CREA nel piatto con porzione, 375 px senza overflow, pasti salvati invariati, nessun errore. ✅ Online: SW v23, 831 voci, basmati 75,5.

### 9.14 Descrivi il piatto (18/11/2026) — verificato nel browser (AI simulata) e online
- Nuovo modulo `js/engine/describe.js`: stessa chiave, stessi modelli e stessa cascata delle foto; prompt testuale proprio; risultati passati da `fromAI` (valori del DB quando c'è corrispondenza). `ai.js` invariato (hash del prompt foto `5a9885b0`, totale 133,1 g).
- Interfaccia: pulsante "Descrivi il piatto" sotto Foto/Codice a barre → campo (es. "kebab medio") + "Stima i carboidrati". Le voci si **aggiungono** al piatto con il tag di confidenza; quantità non indicata → porzione media con "confidenza bassa" e nota. Niente si salva prima di "Salva pasto".
- ❓ Non provato con una chiave reale né su iPhone.

### 9.15 Mini chat con l'AI (18/11/2026) — verificata nel browser (AI simulata) e online, alpha.15
- Dopo una foto o una descrizione, se l'AI ha dubbi compare una piccola chat sotto il messaggio: al massimo 3 domande per giro e 2 giri.
- Domande: la "domanda" dell'AI (con il nome dell'alimento); "Cos'è di preciso…?" solo se l'AI non ha riconosciuto l'alimento con sicurezza; "Quanto ne hai mangiato…?" se la quantità è incerta o manca.
- Risposte: si scrive e si invia, oppure "Non lo so" / "Va bene così". Dopo l'ultima risposta la stima si rifà: per le foto le risposte entrano nell'indizio di `analyzePhoto` (`ai.js` invariato, hash `5a9885b0` con indizio vuoto); per le descrizioni vanno a `describeMeal` come chiarimenti.
- Si sostituiscono solo le voci di quella foto o di quella descrizione (`via`/`batch`, campi solo di interfaccia, non salvati). Corretto anche: una nuova foto non cancella più le voci da descrizione.
- ✅ Browser: domanda → risposta → stima aggiornata (descrizione e foto), "Non lo so" senza nuova chiamata, 375 px senza overflow, pasti salvati invariati, nessun errore. ✅ Online: SW v24, alpha.15. ❓ Non provata con una chiave reale né su iPhone.

### 9.16 Correggi alimenti (18/11/2026) — verificato nel browser e online, alpha.16
- Impostazioni → Alimenti → **Correggi alimenti**: cerca tra le voci dei cataloghi (CREA, stime, etichette, USDA), modifica nome, carboidrati/100 e porzioni, oppure nascondi le voci obsolete; "Ripristina l'originale" toglie la correzione. Filtro "Solo corretti o nascosti".
- Le correzioni stanno in `carbo_lib.foodEdits` (`{cid: {n?, c100?, units?, hidden?, at}}`) e vengono sovrapposte ai file al caricamento (`catalog.js`: `setFoodEdits`, `catAll`, `catOriginal`). I file JSON e il DB del motore non cambiano; le voci nascoste restano leggibili per i riferimenti esistenti.
- ~~Il database interno di Carbo non si corregge da qui~~ — alpha.17: su richiesta dell'utente ("rendi tutto modificabile") anche le 92 voci del DB interno si correggono (chiave `db:<nome>`). In `app.js`: `fixDb` applica la correzione dopo `fromDB`/`fromAI`/cambio voce/crudo-cotto; ricerca con nome e valore corretti, voci nascoste escluse; porzioni corrette da `portionsFor`. Preferiti, recenti e pasti conservano il loro valore. Il cambio crudo↔cotto converte i grammi con i valori originali del DB.
- ✅ alpha.17 nel browser: Pane 55 → 50 in ricerca ("modificato"), nel piatto con le porzioni, e sul risultato di una foto (UI 50; motore invariato: hash `5a9885b0`, 133,1 g, Pane 55 dentro il motore); pasti invariati; nessun errore. ✅ Online: SW v26.
- Ricerca: le voci corrette mostrano "modificato"; i pasti già salvati, i preferiti e i recenti conservano i loro valori (regola dello snapshot).
- Backup: `foodEdits` è nel backup (dentro `library`). Unisci: aggiunge le correzioni mancanti, quelle attuali vincono. Sostituisci: prende quelle del backup; un backup precedente ad alpha.16 (senza il campo) lascia quelle attuali.
- ✅ Browser (375 px): correzione salvata e ricaricata, porzioni duplicate unite, voce corretta nel piatto con il nuovo valore, voce nascosta assente dalla ricerca, ripristino, validazione (0–100), backup → parse → unisci con le correzioni, pasti invariati, nessun errore. ✅ Online: SW v25, alpha.16, pannello funzionante.

## 10. Roadmap generale

Le percentuali sono calcolate così: attività concluse e verificate ÷ attività della fase. "Verificata" significa provata nel browser (Claude Browser) o con un test; la verifica su iPhone è una fase a sé (V).

| Fase | Attività (✅ concluse) | Stato | % |
|---|---|---|---|
| 0 Audit | ✅ audit del codice v1 | Completata | 100% (1/1) |
| 1 Base 2.0 | ✅ moduli · ✅ adapter AI · ✅ export JSON · ✅ design system · ✅ navigazione · ✅ pannello Aggiungi | Completata | 100% (6/6) |
| 2 Libreria | ✅ preferiti · ✅ recenti · ✅ ricette · ✅ modifica pasti/annulla | Completata | 100% (4/4) |
| 3 Barcode e promemoria | ✅ scanner · ✅ OFF + prodotti ricordati · ✅ pezzi/porzioni · ✅ avviso in-app · ✅ `.ics` | Completata (browser) | 100% (5/5) |
| V Validazione iPhone | ⬜ installazione in Home · ⬜ fotocamera/ZXing · ⬜ `.ics` · ⬜ condivisione backup · ⬜ trascinamento pannello | In attesa dell'utente | 0% (0/5) |
| D Database alimenti | ✅ audit · ✅ decisioni · ✅ formule verificate · ✅ confronto fonti · ✅ script USDA · ✅ verifica integrazione ricerca · ✅ regola CREA (amido + zuccheri) · ✅ revisione porzioni USDA · ✅ `foods-it.json` · ✅ ricerca + suggerimenti porzione · ✅ pagina Fonti · ✅ porzioni standard LARN · ✅ elenco utente come stime (§9.12) · ✅ catalogo CREA (§9.13) | Completata (browser) | 100% (14/14) |
| 4 Dati e Diario | ✅ ripristino verificato · ✅ `storage.persist` · ✅ calendario · ✅ copia pasto · ✅ export CSV · ✅ IndexedDB (copia di sicurezza, §4.1) | Completata (browser) | 100% (6/6) |
| 5 Rilascio | ⬜ rifinitura e accessibilità · ⬜ test finale · ⬜ promozione di `beta/` in produzione | Pianificata | 0% (0/3) |

**Complessivo: 36/44 attività = 82%.** Restano V (5, prove su iPhone) e Fase 5 (3).

- Fase attuale: **V – Validazione iPhone**, 0/5 spuntate (l'utente riferisce che le funzioni di alpha.8 funzionano su iPhone; ❓ voci non spuntate una per una). Fasi 0–4 e D completate nel browser.
- Bloccato: V dipende dall'utente.
- Dipendenze: la Fase 5 dipende da V.
- Prossimo intervento:
  1. provare alpha.18 su iPhone con una chiave reale e spuntare le 5 voci di V;
  2. rivedere la pasta fresca e ripiena con una fonte (etichetta o tabella), poi reimportarla;
  3. Fase 5: rifinitura e accessibilità, test finale, promozione (con approvazione).

### Registro sessioni
- 16/11/2026: Fasi 0–3; beta pubblicata in `/carbo/beta/`; pezzi/porzioni; report creato; audit del DB alimenti; fattibilità USDA (script + 13 candidati + confronti); regola CREA decisa: amido + zuccheri; catalogo USDA (9 voci) integrato in ricerca, chip porzioni, pagina Fonti, verificato nel browser; alpha.5 pubblicata (commit `c83e149`).
- 17/11/2026: porzioni standard LARN 2014 per 62 voci del DB (pulsanti, mai automatici), verificate nel browser; alpha.6 pubblicata (commit `1d5942a`).
- 17/11/2026: Fase 4 al 83% — ripristino da backup (anteprima, Unisci, Sostituisci con copia di sicurezza, annullamento), storage persistente, calendario nel Diario, copia pasto, export CSV; verificati nel browser; alpha.7 pubblicata. IndexedDB rinviato per decisione.
- 17/11/2026: subito dopo la pubblicazione di alpha.7 il browser serviva `index.html` nuovo con `app.js` vecchio (cache HTTP di GitHub Pages, 10 minuti, che il SW non aggirava). Corretto in alpha.8: SW v17 con `no-cache`/`reload`; verificato in locale (installazione, controllo della pagina, copia offline, nessun errore). ❓ Il primo avvio dopo l'aggiornamento passa ancora dal vecchio SW: può servire riaprire l'app una seconda volta.
- 17/11/2026: l'utente riferisce che le funzioni di alpha.8 funzionano su iPhone. Spiegato CREA. Elenco di 260 alimenti integrato come catalogo di stime separato (`foods-stime.json`, 158 voci + porzioni per 29 voci DB; 8 righe di pasta fresca/ripiena in revisione), verificato nel browser; alpha.9 pubblicata (commit `1b4cc56`; commit con il git di GitHub Desktop perché G-Helper bloccava i clic, push dal pulsante di GitHub Desktop) e verificata online, poi su iPhone (anche offline).
- 17/11/2026: alpha.10 in locale — tendine Preferiti/Recenti/Ricette, nomi leggibili nella ricerca, piatto compatto con dettagli al tocco, avvertenze più piccole, zoom disattivato. Verificata nel browser (375 px, salvataggio invariato, motore AI `5a9885b0`/133,1 g, nessun errore); pubblicata (commit `56ea08e`) e verificata online: SW v19, versione alpha.10, righe di ricerca compatte, nessun errore.
- 17/11/2026: alpha.11 in locale — "Altro" diventa "Impostazioni"; nuova pagina Crediti e avvertenze con l'avvertenza AI (tolta dal pannello Aggiungi). Verificata nel browser (375 px, navigazione tra i pannelli, nessun errore); pubblicata (commit `805750c`) e verificata online (SW v20, scheda "Impostazioni", nessun errore). 
- 17/11/2026: alpha.12 — alimento del piatto ridotto a nome + carboidrati dopo la scelta. Verificata nel browser (porzione → ridotto, riapertura, +/−, campo grammi che non sparisce mentre si scrive, salvataggio senza campi nuovi, motore AI `5a9885b0`/133,1 g, nessun errore); pubblicata.
- 18/11/2026: alpha.13 — "Descrivi il piatto" (§9.14) e catalogo CREA da `database_alimenti.xlsx` (§9.13, import deciso dall'utente). alpha.14 — valori CREA normalizzati ad amido + zuccheri (regola §9.5.2, dimenticata in alpha.13). Verificate nel browser e online (commit `328199d`, `7c34b53`; SW v23). Fase D completata.
- 18/11/2026: alpha.15 — mini chat per rispondere alle domande dell'AI dopo foto o descrizione (§9.15). Verificata nel browser con AI simulata e online (commit `fe38711`, SW v24).
- 18/11/2026: alpha.16 — Correggi alimenti: correzioni e voci nascoste per i cataloghi, nel backup (§9.16). Verificata nel browser e online (commit `e4f3429`, SW v25). Spiegato all'utente che più chiavi API non migliorano la precisione.
- 18/11/2026: alpha.17 — "rendi tutto modificabile": correzioni anche per il DB interno, applicate dopo il motore (§8, §9.16). Verificata nel browser e online (commit `680263a`, SW v26).
- 18/11/2026: alpha.18 — IndexedDB come copia di sicurezza automatica con recupero (§4.1, approvato dall'utente). Verificata nel browser e online (commit `0996043`, SW v27). Fase 4 completata: 36/44 = 82%.

# Carbo — stato del progetto

Ultimo aggiornamento: 16/11/2026 (Fase D: catalogo USDA integrato, §9.10; roadmap §10) · versione beta locale `2.0.0-alpha.5` (online: `2.0.0-alpha.4`, commit `6fa3951`; alpha.5 non ancora pubblicata)
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
| `beta/js/data/library.js` | | preferiti, recenti, ricette, prodotti (`carbo_lib`) |
| `beta/js/data/products.js` | | Open Food Facts, prodotti salvati, peso del pezzo/porzione |
| `beta/js/lib/barcode.js` | | scanner: `BarcodeDetector` → fallback ZXing, controllo GS1 |
| `beta/js/features/reminders.js` | | promemoria in-app + generazione `.ics` |
| `beta/js/vendor/` | | ZXing minificato + README con licenza e hash SHA-384 |
| `beta/js/data/catalog.js` | | caricamento del catalogo esterno (`loadCatalog`, `catByCid`, etichette di fonte). Non importa `fooddb.js` |
| `beta/data/foods-it.json` | | catalogo alimenti generato (oggi 9 voci USDA, 7,5 KB). Non modificare a mano: rigenerare con `tools/usda/build.mjs` |
| `beta/sw.js` | | SW beta, cache `carbo-beta-v14`, network-first; precarica anche catalogo e `catalog.js` |
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
| Altro → Fonti dei dati (Carbo, USDA, OFF, CREA "non integrato", inseriti da te) | ✅ (browser) |
| Eliminazione pasto con "Annulla", modifica pasto salvato | ✅ |
| Preferiti con quantità abituale, ultimi 15 alimenti recenti | ✅ |
| Ricette (dal piatto, porzioni, CHO per porzione) | ✅ |
| Scanner barcode + Open Food Facts + inserimento manuale + prodotti ricordati | 🟡 provato con fotocamera simulata |
| Quantità a pezzi/porzioni per prodotti scansionati | 🟡 |
| Promemoria: avviso in Oggi (finestra di 3 h, "Non oggi") + file `.ics` ricorrente | 🟡 `.ics` non provato su iOS |
| Export backup JSON (foglio di condivisione su telefono) | 🟡 |
| Tema Sistema/Chiaro/Scuro | ✅ |
| Ripristino da backup, export CSV, calendario nel Diario, copia pasto da altro giorno | ⏳ |
| IndexedDB, `navigator.storage.persist()` | ⏳ non implementati |
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

- Regola dello snapshot: ogni pasto salva `c100`, `g` e `total` al momento del salvataggio. Modificare ricette, preferiti o prodotti non cambia i pasti passati (✅ verificato).
- `pz` = `{w: grammi di 1 pezzo, l: "pezzo"|"porzione", t?: descrizione della porzione scelta}`.
- `cid` = identificativo della voce del catalogo esterno (`usda:<fdc_id>`, in futuro `crea:<codice>`), distinto da `ref` (nome nel DB del motore). È salvato in pasti, preferiti, recenti e ingredienti delle ricette; la chiave del preferito diventa `c:<cid>|<c100>`. Le voci senza `cid` mantengono la chiave di prima.
- Catalogo (`beta/data/foods-it.json`): `{format:"carbo-catalog", version, basis, sources, foods:[{cid, n, a?, cat, it, c100, u, units:[{t, w, l, base:"edibile", src}], src:{db, ds, id, desc, orig, formula}}]}`.
- Libreria corrotta: viene messa da parte, non cancellata (guardia di sola lettura in `library.js`).
- Backup: `{format:"carbo-backup", schemaVersion:2, appVersion, exportedAt, counts, checksum:{fnv1a32}, data:{meals, goal, library, settings}}`.
- Migrazione: nessuna necessaria finora (formato additivo). IndexedDB e la migrazione verificata sono rinviati alla Fase 4.

## 5. Interfaccia

- Viste (`beta/index.html`):
  - `#v-oggi`: totale del giorno, obiettivo, avviso promemoria, pasti, pasti mancanti.
  - `#v-diario`: storico con ricerca.
  - `#v-altro`: Alimenti (pannelli `#p-fav`, `#p-rcp`), Promemoria, Personalizzazione, Analisi AI, Dati, Applicazione (pannello `#p-src` Fonti dei dati).
- Piatto: le voci del catalogo hanno l'etichetta di fonte (`.tag.src`) e i chip delle porzioni (`.chips`/`.chip`). Toccare un chip imposta 1 porzione e passa al conteggio a pezzi; i grammi restano modificabili.
- Pannello Aggiungi `#sheet`: tipo di pasto, Foto / Codice a barre, ricerca, piatto, salva come ricetta, totale e Salva. Su telefono si chiude trascinando verso il basso; da 768 px in su è una finestra modale.
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
- Fase D: catalogo USDA integrato e verificato nel browser (§9.10). Resta solo CREA, bloccato.
- In attesa: test della beta su iPhone da parte dell'utente; pubblicazione di alpha.5 (commit/push non ancora fatti).
- Problemi noti:
  1. Non verificati su iPhone reale: fotocamera/ZXing, apertura `.ics`, foglio di condivisione del backup, trascinamento del pannello, installazione in Home.
  2. Dati condivisi tra v1 e beta: le modifiche fatte nella beta sono reali.
  3. Il SW v1 (`sw.js`), quando si aggiorna, cancella tutte le cache diverse da `carbo-v8`, compresa quella della beta. Impatto: solo la riserva offline. Il SW 2.0 elimina solo le proprie versioni.
  4. Nessun ripristino da backup: l'export esiste, l'import no.
  5. Nessuna richiesta di storage persistente: su iOS, senza installazione in Home, i dati possono essere cancellati.
  6. Due schede aperte si sovrascrivono lo stato (eredità v1).
  7. Open Food Facts spesso non ha il peso del pezzo: in quel caso lo inserisce l'utente, e viene ricordato.
  8. `app.js` (~47 KB) e `app.css` sono file unici, più grandi della suddivisione prevista nella Fase 0.
  9. Nessun test automatico versionato.
  10. Catalogo piccolo (9 voci): utile solo per frutta mancante dal DB. CREA bloccato in attesa dei diritti.
  11. Nel piatto i chip delle porzioni vanno a capo uno per riga su telefono (colonna del nome stretta): funzionano, ma l'impaginazione si può migliorare.
  12. Se dopo aver scelto una porzione si inseriscono grammi a mano, il chip resta evidenziato come unità di riferimento (comportamento voluto, ma da valutare con l'utente).

## 7. Prossimi interventi (priorità)

1. Correggere quello che emerge dai test su iPhone.
2. Ripristino da backup verificato (anteprima, Unisci/Sostituisci, backup automatico prima di sostituire) + `navigator.storage.persist()`.
3. Fase 4: Diario a calendario, copia di un pasto da un altro giorno, export CSV, migrazione a IndexedDB con verifica e conservazione dei dati v1.
4. Fase 5: rifinitura e accessibilità, poi promozione della beta a produzione (sostituire la root con `beta/` togliendo le differenze "Beta"). ❓ Il contenuto preciso della Fase 5 non è documentato qui.
5. Facoltativo: suite di regressione del motore AI nel repo.
6. Fase D: pubblicare alpha.5 in `/carbo/beta/` (con approvazione); contattare CREA-AN per i diritti di riuso. Eventuale ampliamento della selezione USDA (solo alimenti "neutri" assenti dal DB).

## 8. Decisioni e vincoli

- Evoluzione, non riscrittura. Motore AI invariato e usato solo tramite `analyzePhoto`.
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
10. CREA: nessuna estrazione in massa finché i diritti di riuso non sono chiariti.

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

## 10. Roadmap generale

Le percentuali sono calcolate così: attività concluse e verificate ÷ attività della fase. "Verificata" significa provata nel browser (Claude Browser) o con un test; la verifica su iPhone è una fase a sé (V).

| Fase | Attività (✅ concluse) | Stato | % |
|---|---|---|---|
| 0 Audit | ✅ audit del codice v1 | Completata | 100% (1/1) |
| 1 Base 2.0 | ✅ moduli · ✅ adapter AI · ✅ export JSON · ✅ design system · ✅ navigazione · ✅ pannello Aggiungi | Completata | 100% (6/6) |
| 2 Libreria | ✅ preferiti · ✅ recenti · ✅ ricette · ✅ modifica pasti/annulla | Completata | 100% (4/4) |
| 3 Barcode e promemoria | ✅ scanner · ✅ OFF + prodotti ricordati · ✅ pezzi/porzioni · ✅ avviso in-app · ✅ `.ics` | Completata (browser) | 100% (5/5) |
| V Validazione iPhone | ⬜ installazione in Home · ⬜ fotocamera/ZXing · ⬜ `.ics` · ⬜ condivisione backup · ⬜ trascinamento pannello | In attesa dell'utente | 0% (0/5) |
| D Database alimenti | ✅ audit · ✅ decisioni · ✅ formule verificate · ✅ confronto fonti · ✅ script USDA · ✅ verifica integrazione ricerca · ✅ regola CREA (amido + zuccheri) · ✅ revisione porzioni USDA · ✅ `foods-it.json` · ✅ ricerca + suggerimenti porzione · ✅ pagina Fonti · ⛔ catalogo CREA | In corso (resta solo CREA, bloccato) | 92% (11/12) |
| 4 Dati e Diario | ⬜ ripristino verificato · ⬜ `storage.persist` · ⬜ calendario · ⬜ copia pasto · ⬜ export CSV · ⬜ IndexedDB | Pianificata | 0% (0/6) |
| 5 Rilascio | ⬜ rifinitura e accessibilità · ⬜ test finale · ⬜ promozione di `beta/` in produzione | Pianificata | 0% (0/3) |

**Complessivo: 27/42 attività = 64%.**

- Fase attuale: **D – Database alimenti**, 92%: tutto fatto tranne CREA, che è bloccato. In parallelo, V attende i test dell'utente.
- Bloccato:
  - ⛔ catalogo CREA, finché non sono chiariti i diritti di riuso (serve contattare CREA-AN);
  - V dipende dall'utente.
- Dipendenze:
  - la parte CREA del catalogo dipende solo dai diritti di riuso (regola e struttura pronte: `cid` `crea:<codice>`);
  - la Fase 5 dipende da V e dalla Fase 4.
- Prossimo intervento:
  1. pubblicare alpha.5 su `/carbo/beta/` (commit e push con GitHub Desktop, su approvazione);
  2. Fase 4: ripristino da backup verificato + `navigator.storage.persist()` (proteggono i dati prima di IndexedDB).

### Registro sessioni
- 16/11/2026: Fasi 0–3; beta pubblicata in `/carbo/beta/`; pezzi/porzioni; report creato; audit del DB alimenti; fattibilità USDA (script + 13 candidati + confronti); regola CREA decisa: amido + zuccheri; catalogo USDA (9 voci) integrato in ricerca, chip porzioni, pagina Fonti, verificato nel browser (alpha.5, non pubblicata).

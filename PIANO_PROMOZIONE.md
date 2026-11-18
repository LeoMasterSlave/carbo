# Piano di promozione: Carbo 2.0 beta → produzione

Bozza del 18/11/2026 (Fase 5.12). **Da approvare.** Finché non c'è l'approvazione esplicita, la produzione (`/carbo/`) non cambia.

## 1. Situazione attuale

| | Produzione (`/carbo/`) | Beta (`/carbo/beta/`) |
|---|---|---|
| Codice | `index.html` unico (v1), 54 KB | `beta/` modulare, alpha.20 |
| Service worker | `sw.js`, cache `carbo-v8`; in attivazione cancella **tutte** le altre cache dell'origine | `beta/sw.js`, cache `carbo-beta-vN`; cancella solo le proprie |
| Dati | `localStorage["carbo"]` | stesso `localStorage["carbo"]` + `carbo_lib`, `carbo_rem`, `carbo_theme`… + copia di sicurezza IndexedDB `carbo-safety` |
| Nome, icona | "Carbo", icone v1 chiare | "Carbo Beta" / "Carbo β", icone Terracotta, maskable |

I pasti sono già condivisi: la beta legge e scrive gli stessi pasti della v1, nello stesso formato. **La promozione non richiede di convertire i pasti.**

## 2. Differenze da togliere nella copia promossa
- `<title>`, `apple-mobile-web-app-title`, manifest `name`/`short_name`: "Carbo".
- Nome della cache del SW: `carbo-v9` (prefisso `carbo-v`, così la nuova versione cancella `carbo-v8` e non tocca `carbo-beta-*`).
- Nient'altro: percorsi relativi. Ricerca del 18/11/2026 su `beta/` (js, html, css, manifest): "Beta"/"β"/"carbo-beta" compaiono solo in questi 4 punti; nessun percorso `/beta/` nel codice. Da ripetere prima del passo 3.

## 3. Passi (un commit ciascuno, verificati prima del successivo)
1. **Prerequisiti:** Fase V completata su iPhone; `node tools/test/run.mjs` tutto verde; backup JSON esportato dall'utente dall'app attuale.
2. **Copia di sicurezza della v1:** `index.html`, `sw.js`, `manifest.webmanifest` e icone della root copiati in `v1/` (servita su `/carbo/v1/`, utile anche come piano B consultabile).
3. **Promozione:** contenuto di `beta/` copiato nella root con le differenze del §2; `beta/` resta pubblicata com'è per un periodo di sicurezza (almeno 2 settimane).
4. **Verifica online:** nuova `sw.js` con `carbo-v9`; app aperta dalla Home su iPhone: pasti presenti e invariati, preferiti e ricette presenti, offline funzionante, AI con chiave reale.
5. **Dopo 2 settimane senza problemi:** IndexedDB come archivio principale (§5) e, solo dopo, rimozione di `beta/` (o redirect).

## 4. Service worker: passaggio da `carbo-v8`
- Chi ha la v1 installata: alla prima apertura dopo la promozione la v1 chiede la rete per prima, quindi riceve subito il nuovo `index.html`; il browser scarica il nuovo `sw.js`, che si installa (`skipWaiting`) e in attivazione cancella `carbo-v8`. La riserva offline è sostituita, non persa: la nuova cache viene riempita durante l'installazione, prima della cancellazione.
- Possibile un'apertura "mista" (nuova pagina, vecchio SW ancora attivo): innocua, perché il vecchio SW chiede la rete per prima. Già osservato in alpha.8: al massimo serve riaprire l'app una volta.
- Rischio noto: finché un telefono esegue il SW v1, le sue attivazioni cancellano anche la cache della beta. Non tocca i dati (localStorage e IndexedDB non sono cache).

## 5. Archivio principale in IndexedDB (fase successiva, non insieme alla promozione)
Proposta: **non** cambiarlo nello stesso momento della promozione. Motivo: finché i pasti restano in `localStorage["carbo"]`, tornare alla v1 è immediato e senza perdite, perché la v1 legge gli stessi dati. Dopo 2 settimane stabili:
1. backup automatico (copia di sicurezza IndexedDB già esistente + `carbo_prerestore`) prima della migrazione;
2. scrittura in IndexedDB come archivio principale e, per un periodo, anche in `localStorage` (doppia scrittura) così un ritorno indietro resta possibile;
3. test automatici dedicati in `tools/test/` prima del rilascio.

## 6. Ritorno indietro in un passo
- Un solo commit che ripristina la root dalla copia `v1/` del passo 2, con la cache del SW rinominata `carbo-v10` (nome nuovo, così i telefoni scaricano davvero la v1 e la sua attivazione cancella `carbo-v9`).
- I dati restano: pasti in `localStorage["carbo"]`, letti dalla v1. Si perdono solo le funzioni nuove (preferiti, ricette, correzioni restano salvati in `carbo_lib` e tornano con la versione 2).
- Tempo: un commit + pubblicazione di GitHub Pages (circa 1 minuto) + una riapertura dell'app.

## 7. Cosa vede chi ha la v1 installata
- Alla prima apertura con rete: la nuova interfaccia, con tutti i pasti già presenti. Nessuna azione richiesta.
- Senza rete: la v1 dalla cache, fino alla prima apertura con rete.
- Nome e icona sulla Home: iOS li legge quando si aggiunge l'app; possono restare quelli vecchi finché non si rimuove e si aggiunge di nuovo l'icona (i dati non si perdono: stanno nel sito, non nell'icona). ❓ Da verificare sull'iPhone dell'utente.
- La chiave AI della v1 (`carbo_key_<servizio>`) è la stessa: non va reinserita.

## 8. Cosa serve dall'utente
- Completare la Fase V su iPhone (alpha.20).
- Approvare questo piano (o indicare cosa cambiare).
- Dire esplicitamente "promuovi" quando si vuole eseguire il passo 3.

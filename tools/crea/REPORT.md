# Import CREA → beta/data/foods-crea.json

Generato da `node tools/crea/build.mjs` da database_alimenti.xlsx. Righe lette: 832.

- Voci importate: **831**
- Con porzione standard: 827 (di cui 0 convertite da peso lordo a edibile)
- Porzione non importata perché incoerente con i CHO per porzione: 3
- Senza porzione nel file: 1
- Normalizzate ad amido + zuccheri (valore diverso dal pubblicato): 230
- Tracce (tr → 0): 21
- Scartate: 1

## Normalizzazione amido + zuccheri (esempi con lo scarto maggiore)

| riga | alimento | pubblicato | adottato |
|---|---|---|---|
| 278 | Farina di manioca | 87.2 | 79.3 |
| 415 | Mais, amido | 87 | 79.2 |
| 289 | Fecola di patate | 90.7 | 83.3 |
| 681 | Riso Basmati, crudo | 82.9 | 75.5 |
| 688 | Riso, parboiled | 81.3 | 73.9 |
| 684 | Riso, brillato | 80.4 | 73.1 |
| 519 | Pane azzimo | 81.7 | 74.4 |
| 279 | Farina di riso | 79.1 | 71.9 |
| 632 | Pop corn | 77.9 | 70.8 |
| 683 | Riso Venere, crudo | 80.4 | 73.3 |
| 213 | Corn flakes | 87.4 | 80.4 |
| 686 | Riso, integrale | 77.4 | 70.5 |
| 690 | Riso, soffiato, da prima colazione | 85.1 | 78.2 |
| 726 | Semola | 76.9 | 70.1 |
| 219 | Couscous, crudo | 76.5 | 69.8 |

## Porzioni non importate (incoerenti)

| riga | alimento | porzione | CHO porzione file | atteso da c100 |
|---|---|---|---|---|
| 551 | Patate, fritte | 200 g | 23.9 | 59.8 |
| 577 | Pere, fresche, Max-Red Barlett | 150 g | 12.2 | 15 |
| 630 | Pomodorini ciliegino, freschi | 250 g | 14.4 | 18 |

## Porzioni in peso lordo (convertite in edibile)

## Tracce
- riga 70: Bevanda alcolica, Brandy
- riga 71: Bevanda alcolica, Grappa
- riga 78: Bevanda alcolica, Vino da pasto bianco
- riga 79: Bevanda alcolica, Vino da pasto rosso
- riga 80: Bevanda alcolica, Whisky
- riga 209: Coppa
- riga 320: Formaggio cremoso spalmabile
- riga 441: Melù o pesce molo
- riga 472: Mortadella Bologna IGP
- riga 515: Pancetta arrotolata
- riga 535: Parmigiano Reggiano DOP
- riga 635: Prezzemolo, fresco
- riga 746: Stracchino
- riga 786: Uova di gallina, albume
- riga 787: Uova di gallina, intero
- riga 788: Uova di gallina, intero, congelato
- riga 789: Uova di gallina, intero, cotto, a frittata o strapazzato
- riga 790: Uova di gallina, intero, cotto, alla coque o sodo
- riga 792: Uova di gallina, tuorlo
- riga 793: Uova di gallina, tuorlo, congelato
- riga 794: Uova di gallina, tuorlo, cotto, in camicia

## Nomi ripuliti
- riga 2: Caramelle tipo ""mou → Caramelle tipo mou

## Scartate
- riga 823: Zucchero, saccarosio — valore oltre 100 g/100 g anche normalizzato (104.5): zuccheri espressi in monosaccaridi


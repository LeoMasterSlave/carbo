# Import CREA → beta/data/foods-crea.json

Generato da `node tools/crea/build.mjs` da database_alimenti.xlsx. Righe lette: 832.

- Voci importate: **831**
- Con porzione standard: 827 (di cui 0 convertite da peso lordo a edibile)
- Porzione non importata perché incoerente con i CHO per porzione: 3
- Senza porzione nel file: 1
- Tracce (tr → 0): 21
- Scartate: 1

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
- riga 823: Zucchero, saccarosio — carboidrati/100 g non leggibili ("104.5")


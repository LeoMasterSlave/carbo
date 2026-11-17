# Import elenco 260 alimenti → beta/data/foods-stime.json

Generato da `node tools/userdb/build.mjs`. Righe lette: 260.

- Nuove voci di catalogo: **158** (etichetta: 9, stima: 149)
- Porzioni aggiunte a voci del DB del motore: **30** su 29 voci
- Doppioni non importati: 46 (porzione già presente) + 10 (già nel catalogo USDA) + 3 (righe identiche)
- In revisione (non importate): 8
- Senza peso (non importate): 4
- Errori: 0

## In revisione (pasta fresca e ripiena)
- riga 10: Pasta fresca all'uovo — 120.0 g crudi, 32-38 g
- riga 61: Ravioli ricotta e spinaci — 150.0 g, 35-45 g
- riga 104: Tagliatelle all'uovo — 120.0 g fresche, 34-40 g
- riga 105: Tortellini freschi — 150.0 g, 38-48 g
- riga 106: Cappelletti freschi — 150.0 g, 35-45 g
- riga 225: Culurgiones — 6.0 pezzi (circa 180 g), 45-55 g
- riga 227: Seadas — 1.0 pezzo (100 g), 35-45 g
- riga 242: Cannelloni ricotta e spinaci — 250.0 g, 35-50 g

## Senza peso
- riga 66: Toast prosciutto e sottiletta — nessun peso nell'unità "toast (4 fette pancarrè)"
- riga 188: Cappuccino — stesso alimento di "Cappuccino" nel DB, ma in ml invece di g: porzione non aggiunta
- riga 211: Sushi misto — nessun peso nell'unità "pezzi"
- riga 220: Kebab in piadina — nessun peso nell'unità "porzione"

## Già nel catalogo USDA
- riga 139: Mandarini
- riga 140: Clementine
- riga 141: Albicocche
- riga 142: Prugne
- riga 143: Ananas
- riga 144: Melone
- riga 145: Mango
- riga 146: Ciliegie
- riga 150: Fichi freschi
- riga 151: Datteri secchi

## Porzioni aggiunte a voci del DB (solo il peso; i carboidrati restano quelli del DB)

| riga | alimento nel file | voce DB | porzione | CHO/100 file | CHO/100 DB |
|---|---|---|---|---|---|
| 4 | Pancarrè | Pancarrè | 2 fette = 50 g | 49 | 48 |
| 15 | Gnocchi di patate | Gnocchi di patate | 1 porzione = 200 g | 30 | 32 |
| 16 | Patate lesse | Patate lesse | 1 porzione = 200 g | 17 | 17 |
| 17 | Pizza margherita | Pizza margherita | 1 pizza = 300 g | 30.8 | 33 |
| 18 | Focaccia | Focaccia semplice | 1 porzione = 100 g | 50 | 45 |
| 24 | Croissant vuoto | Croissant vuoto | 1 medio = 60 g | 54.2 | 48 |
| 25 | Croissant crema nocciola | Croissant farcito | 1 medio = 75 g | 57.3 | 54 |
| 28 | Nutella | Nutella | 1 porzione = 15 g | 57.3 | 57 |
| 29 | Nutella | Nutella | 1 porzione = 30 g | 57.7 | 57 |
| 33 | Latte vaccino | Latte | 1 porzione = 200 ml | 4.8 | 5 |
| 38 | Banana | Banana | 1 porzione = 120 g | 22.1 | 21 |
| 43 | Kiwi | Kiwi | 1 porzione = 100 g | 11.5 | 9 ⚠️ |
| 44 | Anguria | Anguria | 1 porzione = 200 g | 7.5 | 8 |
| 48 | Cioccolato al latte | Cioccolato al latte | 1 porzione = 20 g | 55 | 56 |
| 65 | Panino prosciutto e formaggio | Panino al prosciutto | 1 porzione = 120 g | 43.8 | 43 |
| 67 | Focaccia prosciutto e mozzarella | Focaccia farcita | 1 porzione = 150 g | 51.7 | 45 |
| 68 | Hamburger con pane | Hamburger con pane | 1 porzione = 180 g | 26.4 | 25 |
| 70 | Patatine fritte | Patate fritte | 1 porzione = 150 g | 33.3 | 38 |
| 76 | Ketchup | Ketchup | 1 porzione = 20 g | 25 | 25 |
| 84 | Piadina classica | Piadina | 1 porzione = 100 g | 51.5 | 52 |
| 87 | Panino all'olio | Panino | 1 porzione = 60 g | 53.3 | 57 |
| 112 | Avena in fiocchi | Fiocchi d'avena | 1 porzione = 40 g | 62.5 | 60 |
| 125 | Tiramisù | Tiramisù | 1 porzione = 120 g | 29.2 | 30 |
| 196 | Vino | Vino | 1 porzione = 150 ml | 1.3 | 3 |
| 205 | Riso in bianco cotto | Riso cotto | 1 porzione = 180 g | 27.8 | 28 |
| 206 | Polenta cotta | Polenta | 1 porzione = 250 g | 16 | 16 |
| 213 | Parmigiana di melanzane | Parmigiana | 1 porzione = 250 g | 8 | 6 |
| 222 | Arancino al ragù | Arancino | 1 pezzo = 180 g | 27.8 | 30 |
| 232 | Patate al forno | Patate al forno | 1 porzione = 200 g | 18 | 20 |
| 236 | Spinacina impanata | Spinacina impanata | 1 porzione = 100 g | 18.5 | 21 |

## Porzioni non aggiunte (stesso peso già presente)
- riga 55: Caffellatte → Latte 200
- riga 95: Maccheroni → Pasta cruda 80
- riga 96: Fusilli → Pasta cruda 80
- riga 97: Rigatoni → Pasta cruda 80
- riga 98: Penne → Pasta cruda 80
- riga 99: Spaghetti → Pasta cruda 80
- riga 100: Linguine → Pasta cruda 80
- riga 101: Farfalle → Pasta cruda 80
- riga 177: Latte scremato → Latte 200
- riga 240: Focaccia farcita → Focaccia farcita 150
- riga 2: Pane → Pane 50 (già LARN)
- riga 3: Pane integrale → Pane integrale 50 (già LARN)
- riga 5: Cracker → Cracker 30 (già LARN)
- riga 6: Grissini → Grissini 30 (già LARN)
- riga 7: Fette biscottate → Fette biscottate 30 (già LARN)
- riga 8: Pasta cruda → Pasta cruda 80 (già LARN)
- riga 9: Riso crudo → Riso crudo 80 (già LARN)
- riga 19: Cereali da colazione → Cereali da colazione 30 (già LARN)
- riga 20: Muesli → Muesli 30 (già LARN)
- riga 21: Biscotti secchi → Biscotti secchi 30 (già LARN)
- riga 23: Gocciole → Gocciole 30 (già LARN)
- riga 30: Miele → Miele 20 (già LARN)
- riga 31: Marmellata → Marmellata 20 (già LARN)
- riga 32: Latte → Latte 125 (già LARN)
- riga 34: Yogurt bianco → Yogurt bianco 125 (già LARN)
- riga 35: Yogurt alla frutta → Yogurt alla frutta 125 (già LARN)
- riga 37: Mela → Mela 150 (già LARN)
- riga 39: Pera → Pera 150 (già LARN)
- riga 40: Arancia → Arancia 150 (già LARN)
- riga 41: Uva → Uva 150 (già LARN)
- riga 42: Fragole → Fragole 150 (già LARN)
- riga 51: Gelato → Gelato 100 (già LARN)
- riga 52: Succo d'arancia → Succo d'arancia 200 (già LARN)
- riga 53: Coca-Cola → Coca-Cola 330 (già LARN)
- riga 60: Lasagna → Lasagna 250 (già LARN)
- riga 71: Ceci cotti → Ceci cotti 150 (già LARN)
- riga 72: Lenticchie cotte → Lenticchie cotte 150 (già LARN)
- riga 73: Fagioli cotti → Fagioli cotti 150 (già LARN)
- riga 74: Piselli → Piselli 150 (già LARN)
- riga 154: Carote → Carote 200 (già LARN)
- riga 155: Pomodori → Pomodori 200 (già LARN)
- riga 156: Zucchine → Zucchine 200 (già LARN)
- riga 157: Melanzane → Melanzane 200 (già LARN)
- riga 163: Insalata → Insalata 80 (già LARN)
- riga 182: Mozzarella → Mozzarella 100 (già LARN)
- riga 195: Birra → Birra 330 (già LARN)

## Righe unite in una voce
- riga 113: Farina di mais → Farina di mais (stesso alimento)
- riga 134: Kinder Cards → Kinder Cards (stesso alimento)
- riga 135: Kinder Choco Fresh → Kinder Choco Fresh (stesso alimento)
- riga 136: Kinder Maxi King → Kinder Maxi King (stesso alimento)
- riga 134: Kinder Cards → Kinder Cards (porzione identica: scartata)
- riga 135: Kinder Choco Fresh → Kinder Choco Fresh (porzione identica: scartata)
- riga 136: Kinder Maxi King → Kinder Maxi King (porzione identica: scartata)

## Stato crudo/cotto non indicato nel file
- Asparagi
- Broccoli
- Carciofi
- Cavolfiore
- Cavolo cappuccio
- Cipolla
- Edamame
- Fagiolini
- Fave fresche
- Finocchi
- Funghi
- Peperoni
- Spinaci
- Zucca

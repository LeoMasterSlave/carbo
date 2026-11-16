// Motore alimenti: database, matching e normalizzazione delle stime.
// Codice spostato senza modifiche da index.html v1 (righe 261-375).
// Database alimenti. Voce: [nome, CHO per 100 g (per 100 ml se u:"ml"), porzione tipica (solo suggerimento, mai usata come peso), opzioni]
// opzioni: a = sinonimi · pair/st = coppia crudo(r)/cotto(c) · u = "ml" liquido, d = densità g/ml (approssimata) · p = valore PROVVISORIO · cmp = piatto composto (peso complessivo) · s = fonte · nt = nota
// Le voci senza "s" sono valori medi indicativi della versione precedente, non ricontrollati uno per uno.
const PASTA=["pasta","pasta di semola","spaghetti","spaghettoni","penne","rigatoni","fusilli","farfalle","tagliatelle","linguine","maccheroni","paccheri","tortiglioni","bucatini","mezze maniche","pastina","orecchiette","conchiglie","ditalini"];
const RISO=["riso","riso bianco"];
const DB=[
["Pasta cotta",31,180,{a:PASTA,pair:"pasta",st:"c"}],["Pasta cruda",72,80,{a:PASTA,pair:"pasta",st:"r"}],["Riso cotto",28,180,{a:RISO,pair:"riso",st:"c"}],["Riso crudo",80,80,{a:RISO,pair:"riso",st:"r"}],["Risotto",30,200],["Gnocchi di patate",32,200],["Pizza margherita",33,300],
["Pane",55,50,{a:["pane bianco","pane comune"]}],["Pane integrale",45,50],
["Pancarrè",48,30,{a:["pancarre","pan carre","pane in cassetta","pane a fette","pane bianco a fette"],s:"Etichette pancarrè 47-51 g/100 g (Altroconsumo, Carrefour 47; Schär e Sfornasole 48; Mulino Bianco 51)"}],
["Panino",57,120,{a:["panino bianco","panino all'olio","rosetta","panino morbido"],p:1,s:"Panini all'olio: tabella INRAN/CREA ≈ 54-58, scheda generica 57, etichetta Panificio Recchia 51"}],
["Panino al prosciutto",43,120,{a:["panino con prosciutto","panino prosciutto"],cmp:1,p:1,s:"Derivato: Panino 57 × 75% pane + prosciutto cotto 0 g CHO",nt:"Peso complessivo. Assume 75% pane e 25% prosciutto cotto."}],
["Toast prosciutto e formaggio",38,120,{a:["toast","toast prosciutto formaggio","toast al prosciutto","toast con prosciutto e formaggio"],cmp:1,p:1,s:"Derivato: Pancarrè 48 × 80% pane + prosciutto e formaggio ≈ 0 g CHO",nt:"Peso complessivo. Assume 80% pancarrè e 20% ripieno."}],
["Focaccia semplice",45,80,{a:["focaccia","focaccia bianca","focaccia genovese","focaccia pugliese"],p:1,s:"Nessuna fonte primaria trovata. Valori pubblici molto variabili (25-63 g/100 g; mediana 36 su 15 prodotti Open Food Facts)",nt:"Valore provvisorio, molto variabile."}],
["Focaccia farcita",45,150,{a:["focaccia ripiena","focaccia prosciutto e mozzarella","focaccia con prosciutto","focaccia con formaggio","focaccia con prosciutto e mozzarella"],cmp:1,p:1,s:"Come focaccia semplice: il ripieno non aggiunge CHO ma abbassa i CHO per 100 g",nt:"Provvisorio: se puoi, pesa la sola focaccia."}],
["Grissini",72,20],["Fette biscottate",75,10],["Cracker",70,30],["Piadina",52,100],
["Croissant vuoto",48,65,{a:["croissant","cornetto","cornetto vuoto","croissant semplice"],p:1,s:"Etichette croissant classico ≈ 46-50 g/100 g (G. Cova 50, Selex ≈ 48). Tabella generica INRAN/CREA più bassa: 38"}],
["Croissant farcito",54,70,{a:["croissant farcito","croissant alla crema","croissant al cioccolato","croissant alla nocciola","croissant con crema di nocciola","croissant con crema","cornetto alla crema","cornetto al cioccolato","cornetto farcito"],p:1,s:"Etichette croissant farciti: Melegatti crema 54, Dolciando ciliegia 55, Bauli cioccolato 50"}],
["Biscotti secchi",75,30],
["Gocciole",65.7,30,{a:["gocciole pavesi","biscotti gocciole","biscotti con gocce di cioccolato"],s:"Etichetta Pavesi Gocciole: carboidrati 65,7 g/100 g"}],
["Cereali da colazione",75,40,{a:["corn flakes","cornflakes","cereali","fiocchi di mais"]}],["Fiocchi d'avena",60,40],["Muesli",63,40],["Couscous cotto",23,180],["Polenta",16,200],["Farro cotto",25,180],["Orzo cotto",28,180],["Lenticchie cotte",16,150],["Ceci cotti",20,150],["Fagioli cotti",17,150],["Piselli",10,100],["Patate lesse",17,200],["Patate fritte",38,150,{a:["patatine fritte","french fries"]}],["Patate al forno",20,200],
["Mela",14,180],["Banana",21,120],["Arancia",9,200],["Pera",15,180],["Fragole",6,150],["Uva",17,150],["Kiwi",9,100],["Pesca",9,150],["Anguria",8,300],
["Succo di frutta",11,200,{u:"ml",d:1.04}],["Latte",5,200,{u:"ml",d:1.03,a:["caffellatte","caffe latte","latte parzialmente scremato","latte intero","latte scremato"]}],
["Yogurt bianco",5,125,{a:["yogurt bianco naturale","yogurt naturale"]}],["Yogurt alla frutta",16,125],["Gelato",25,100],["Cioccolato fondente",35,20],["Cioccolato al latte",56,20],["Nutella",57,15],["Marmellata",60,20],["Miele",80,10],["Zucchero",100,5],["Torta (media)",50,80],["Tiramisù",30,100],
["Pomodori",3,150],["Carote",7,100],["Zucchine",2,200],["Insalata",2,80],["Melanzane",3,150],["Verdure miste",4,200],["Passata di pomodoro",5,100],["Ragù",6,80],
["Spinacina impanata",21,100,{a:["spinacina","spinacine","cotoletta di spinaci","cotolette di spinaci"],p:1,s:"Findus pepite di spinaci 21 g/100 g (scheda Fankal); altre etichette di spinaci impanati arrivano a ≈ 32. Controlla la confezione",nt:"Valore provvisorio: gli impanati variano molto."}],
["Ketchup",25,15,{a:["salsa ketchup"],s:"Valore generico 24,8 g/100 g (FatSecret/USDA); etichetta Kraft 24; prodotti 19-28"}],
["Salsa cocktail",20,15,{p:1,s:"Valore generico 19,9 g/100 g (FatSecret/USDA)"}],
["Pollo",0,150],["Carne rossa",0,150],["Pesce",0,150],["Uova",1,60],["Formaggio",1,50],["Mozzarella",1,100],["Prosciutto",0,50,{a:["prosciutto cotto","prosciutto crudo"]}],["Tonno in scatola",0,80,{a:["tonno"]}],["Olio d'oliva",0,10],["Noci / mandorle",6,30],
["Birra",3,330,{u:"ml",d:1.01}],["Vino",3,125,{u:"ml",d:0.99}],["Coca-Cola",10.6,330,{u:"ml",d:1.04,a:["coca cola","cola"]}],["Succo d'arancia",10,200,{u:"ml",d:1.04,a:["succo di arancia","succo 100% arancia"]}],["Caffè con zucchero",8,50],["Cappuccino",5,150],
["Sushi (nigiri/maki)",30,150],["Hamburger con pane",25,200],["Lasagna",20,250],["Parmigiana",6,200],["Pizza (trancio)",33,150],["Arancino",30,150]
].map(([n,c,g,o])=>({n,c,g,...(o||{})}));

// ---- Matching: nome completo prima, poi la parola principale; ambiguo = non si sovrascrive
const STOP=new Set("di del dello della dei degli delle d dell al allo alla ai agli alle all con in il lo la l i gli le un uno una e ed a da su per".split(" "));
const MOD=new Set("semplice semplici bianco bianca bianchi bianche medio media medi medie grande grandi piccolo piccola piccoli piccole intero intera interi intere fresco fresca freschi fresche naturale naturali normale classico classica tradizionale casalingo casalinga artigianale".split(" "));
const COND=new Set("pomodoro pomodori pomodorini pesto burro olio aglio sugo ragu parmigiano basilico peperoncino".split(" "));
const SPLIT=new Set(["pesca|pesce","pasta|pasto"]);
const norm=s=>String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").split(/[^a-z0-9]+/).filter(t=>t&&!STOP.has(t));
const isRawTok=t=>/^(crud[oaie]|secc[hoaie]+)$/.test(t),isCookTok=t=>/^cott[oaie]$/.test(t);
const eqTok=(a,b)=>a===b||(a.length>3&&b.length>3&&a.slice(0,-1)===b.slice(0,-1)&&/[aeio]$/.test(a)&&/[aeio]$/.test(b)&&!SPLIT.has(a+"|"+b)&&!SPLIT.has(b+"|"+a));
const setEq=(a,b)=>a.length===b.length&&a.every(t=>b.some(u=>eqTok(t,u)));
const isPre=(long,pre)=>pre.length<=long.length&&pre.every((t,i)=>eqTok(t,long[i]));
const IDX=DB.flatMap(f=>[{f,nm:1,t:norm(f.n)},...(f.a||[]).map(a=>({f,nm:0,t:norm(a)}))].map(x=>({...x,t:f.pair?x.t.filter(t=>!isRawTok(t)&&!isCookTok(t)):x.t})));
function dbMatch(name){
  const q0=norm(name);if(!q0.length)return{f:null,amb:[]};
  let st=null;const qS=q0.filter(t=>{if(isRawTok(t)){st="r";return false}if(isCookTok(t)){st=st||"c";return false}return true});
  const hits=[];
  for(const x of IDX){
    const q=x.f.pair?qS:q0;if(!q.length||!x.t.length)continue;
    if(setEq(q,x.t))hits.push({x,k:"exact"});
    else if(q.length>x.t.length&&isPre(q,x.t)){const r=q.slice(x.t.length);
      if(r.every(t=>MOD.has(t)))hits.push({x,k:"mod"});
      else if(x.f.pair&&r.every(t=>MOD.has(t)||COND.has(t)))hits.push({x,k:"cond"});
      else hits.push({x,k:"bad"})}
    else if(x.nm&&q.length<x.t.length&&isPre(x.t,q))hits.push({x,k:"partial"});
  }
  const pick=f=>{if(!f.pair)return f;const want=st||"c";return DB.find(d=>d.pair===f.pair&&d.st===want)||f};
  const uniq=a=>[...new Map(a.map(h=>[pick(h.x.f).n,pick(h.x.f)])).values()];
  const ok=(ks,conf)=>{const u=uniq(hits.filter(h=>ks.includes(h.k)));if(u.length===1){const f=u[0];return{f,conf,st:f.st||null,defSt:!!f.pair&&!st,amb:[]}}return u.length>1?{f:null,amb:u.map(f=>f.n)}:null};
  const r=ok(["exact"],"alta")||ok(["mod"],"alta")||ok(["cond"],"media");
  if(r)return r;
  const rest=uniq(hits.filter(h=>h.k==="partial"||h.k==="bad"));
  const part=uniq(hits.filter(h=>h.k==="partial"));
  if(part.length===1&&!hits.some(h=>h.k==="bad"))return{f:part[0],conf:"media",st:part[0].st||null,defSt:false,amb:[]};
  return{f:null,amb:rest.map(f=>f.n)};
}
const dbByName=n=>DB.find(f=>f.n===n);
function pairOf(i){
  const f=i.db&&dbByName(i.db);if(!f||!f.pair)return null;
  const c=DB.find(x=>x.pair===f.pair&&x.st==="c"),r=DB.find(x=>x.pair===f.pair&&x.st==="r");
  return c&&r?{c,r}:null;
}
// Passaggio crudo<->cotto: conserva i carboidrati. Si applica solo quando l'utente cambia lo stato.
function swapState(i){
  const pr=pairOf(i);if(!pr)return false;
  const toRaw=i.st!=="r",from=toRaw?pr.c:pr.r,to=toRaw?pr.r:pr.c;
  i.g=Math.round(i.g*from.c/to.c);i.c100=to.c;i.db=to.n;i.st=to.st;
  i.n=toRaw?(/cott[oa]/i.test(i.n)?i.n.replace(/cotta/i,"cruda").replace(/cotto/i,"crudo"):i.n+" (a crudo)"):i.n.replace(/\s*\(a crudo\)/i,"").replace(/cruda/i,"cotta").replace(/crudo/i,"cotto");
  return true;
}
// Unità: grammi e millilitri non si mescolano. g->ml solo con densità nota.
function setUnit(i,f,uIn){
  const need=f.u==="ml"?"ml":"g";
  if(uIn===need){i.u=need;return}
  if(f.u==="ml"&&uIn==="g"&&f.d&&i.g>0){i.g=Math.round(i.g/f.d*10)/10;i.u="ml";return}
  i.u=uIn;i.ask.push({k:"unit",t:`Unità: l'AI ha indicato ${uIn}, questa voce è in ${need}`,b:1});
}
const LV={alta:3,media:2,bassa:1},lvOf=v=>({alta:"alta",media:"media",bassa:"bassa"}[String(v||"").toLowerCase()]||null);
const BREADED=/impanat|panat|cotolett|nuggets|bastoncin|crocchett|fritt|arrosticin/i;
function relevel(i){
  const blk=i.ask.some(a=>a.b);
  i.conf=blk?"bassa":(i.ai&&(!i.db||i.lvl!=="alta"||i.prov))?"media":(i.prov?"media":"alta");
}
function fromAI(a){
  const q=Number(a.grammi??a.quantita),uIn=String(a.unita||"g").toLowerCase()==="ml"?"ml":"g";
  const m=dbMatch(a.nome),f=m.f,ca=lvOf(a.confidenza_alimento||a.confidenza),cp=lvOf(a.confidenza_peso||a.confidenza);
  const i={n:String(a.nome).slice(0,80),g:q>0?q:0,u:uIn,c100:Math.max(0,+a.cho_per_100g||0),ai:true,ask:[],cand:[],lvl:"alta"};
  if(f){i.c100=f.c;i.db=f.n;i.st=f.st||null;i.prov=!!f.p;setUnit(i,f,uIn);if(f.cmp)i.ask.push({k:"cmp",t:f.nt||"Piatto composto: controlla il peso complessivo"})}
  else{
    if(m.amb.length){i.cand=m.amb.slice(0,3);i.ask.push({k:"food",t:"Alimento composto o ambiguo: non ho sostituito i valori dell'AI",b:1})}
    if(BREADED.test(i.n))i.ask.push({k:"label",t:"Impanato o fritto: i carboidrati variano, controlla l'etichetta"});
  }
  if(ca==="bassa")i.ask.push({k:"food",t:"Alimento non riconosciuto con sicurezza",b:1});
  if(cp==="bassa")i.ask.push({k:"weight",t:"Quantità non stimabile con sicurezza dalla foto",b:1});
  if(!(i.g>0))i.ask.push({k:"weight",t:"Quantità non stimabile: inseriscila tu",b:1});
  if(a.domanda)i.ask.push({k:"q",t:String(a.domanda).slice(0,120)});
  i.ask=i.ask.filter((x,k,arr)=>arr.findIndex(y=>y.k===x.k&&y.t===x.t)===k);
  const lv=[ca,cp,m.conf==="media"||m.defSt?"media":null].filter(Boolean).map(v=>LV[v]);
  i.lvl=lv.length&&Math.min(...lv)<3?(Math.min(...lv)===1?"bassa":"media"):"alta";
  relevel(i);return i;
}
function fromDB(f){
  const i={n:f.n,g:0,u:f.u||"g",c100:f.c,db:f.n,st:f.st||null,prov:!!f.p,ask:[{k:"weight",t:"Inserisci il peso: non ne assumo uno standard",b:1}],cand:[],typ:f.g};
  if(f.cmp)i.ask.push({k:"cmp",t:f.nt||"Piatto composto"});relevel(i);return i;
}

export{DB,LV,norm,isPre,dbMatch,dbByName,pairOf,swapState,setUnit,relevel,fromAI,fromDB};

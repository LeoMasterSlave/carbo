import{DB,LV,norm,isPre,dbByName,pairOf,swapState,setUnit,relevel,fromDB}from"./engine/fooddb.js";
import{getProv,getKey,getMode,shrink,httpErr,analyzePhoto}from"./engine/ai.js";
import{exportBackup,lastBackup,saveFile,APP_VERSION}from"./data/backup.js";
import{startScanner,isValidCode,cleanCode,normalizeCode}from"./lib/barcode.js";
import{lookupProduct,rememberProduct,productLabel,cleanPz,pzPlural}from"./data/products.js";
import{REM_TYPES,loadRem,saveRem,dueReminder,snooze,buildICS}from"./features/reminders.js";
import{saveSafety,readSafety,restoreSafety,scheduleSafety,storageLooksCleared,setSafetyHold}from"./data/idb.js";
import{loadLib,saveLib,isReadOnly,snapFood,findFav,addFav,removeFav,pushRecents,recipeStats,newRecipe,recipePlateItem}from"./data/library.js";
import{loadCatalog,catalogFoods,catByCid,SRC_LABEL,srcOf,loadPortions,portionsFor,portionSourceText,setFoodEdits,catAll,catOriginal,cleanFoodEdit}from"./data/catalog.js";
import{parseBackup,mergePreview,mergeInto,replaceWith,saveSafetyCopy,safetyCopy,restoreSafetyCopy}from"./data/restore.js";
import{mealsCSV}from"./data/csv.js";

const $=id=>document.getElementById(id);
let cur=[];
let state={meals:[],goal:null};
let lib=loadLib();
const persistLib=()=>{if(!saveLib(lib))toast(isReadOnly()?"Libreria creata da una versione più recente: modifiche non salvate":FULL_MSG);scheduleSafety()};
// Correzioni dell'utente alle voci del database interno ("db:<nome>" in lib.foodEdits).
// fooddb.js e ai.js restano invariati: la correzione si applica DOPO, al valore usato nel piatto
// (ricerca, cambio voce, crudo/cotto, risultati di foto e descrizioni che riconoscono la voce).
const dbEditOf=n=>cleanFoodEdit((lib.foodEdits||{})["db:"+n]);
const dbC=f=>{const e=dbEditOf(f.n);return e&&e.c100!=null?e.c100:f.c};
function fixDb(i){
  if(!i||!i.db)return i;
  const e=dbEditOf(i.db);if(!e)return i;
  if(e.c100!=null)i.c100=e.c100;
  if(e.n&&i.n===i.db)i.n=e.n;
  return i;
}
const dbFoodView=f=>{const e=dbEditOf(f.n);return{cid:"db:"+f.n,n:e&&e.n||f.n,c100:dbC(f),u:f.u||"g",a:f.a,units:portionsFor(f.n)||[],...(e&&e.hidden?{hidden:true}:{}),...(e?{edited:true}:{})}};
const allFoods=()=>[...DB.map(dbFoodView),...catAll()];
const foodByCid=cid=>{if(!cid.startsWith("db:"))return catByCid(cid);const f=dbByName(cid.slice(3));return f?dbFoodView(f):null};
const foodOrig=cid=>{if(!cid.startsWith("db:"))return catOriginal(cid);const f=dbByName(cid.slice(3));return f?{n:f.n,c100:f.c,u:f.u||"g",units:portionsFor(f.n,true)||[]}:null};
let editId=null;
let view="oggi";
const VIEWS=["oggi","diario","altro"];
const TYPES=["Colazione","Pranzo","Spuntino","Cena"];

const tdKey=ts=>{const d=new Date(ts);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const r1=x=>Math.round(x*10)/10;
const itemC=i=>i.g*i.c100/100;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fold=s=>String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
const total=()=>r1(cur.reduce((s,i)=>s+itemC(i),0));
const ico=(d,s=20)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I_X=ico('<path d="M18 6 6 18M6 6l12 12"/>'),I_PLUS=ico('<path d="M5 12h14M12 5v14"/>'),I_MIN=ico('<path d="M5 12h14"/>');
const I_TRASH=ico('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',18),I_PLUS_S=ico('<path d="M5 12h14M12 5v14"/>',14);
const STAR='<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>';
const I_STAR=ico(STAR,18),I_STAR_ON=`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" aria-hidden="true">${STAR}</svg>`;
const I_STAR_S=ico(STAR,14),I_CLOCK=ico('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',14),I_BOOK=ico('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7"/>',14),I_DB=ico('<path d="M5 12h14M12 5v14"/>',14);
const I_CHEV=ico('<path d="m9 6 6 6-6 6"/>',16);
const fmt=x=>String(r1(x)).replace(".",",");

function lsGet(){try{return JSON.parse(localStorage.getItem("carbo")||"null")}catch(e){return null}}
// Restituisce false se il salvataggio non riesce (memoria piena o archivio bloccato) e lo dice all'utente.
const FULL_MSG="Memoria del telefono piena: le ultime modifiche non sono salvate in modo permanente. Esporta un backup e libera spazio.";
function persist(){let ok=true;try{localStorage.setItem("carbo",JSON.stringify(state))}catch(e){ok=false}scheduleSafety();if(!ok)toast(FULL_MSG);return ok}
function mealType(){const c=document.querySelector('input[name=mt]:checked');return c?c.value:"Pranzo"}
function defaultType(){const h=new Date().getHours();return h<10?"Colazione":h<15?"Pranzo":h<18?"Spuntino":"Cena"}
function setType(t){const r=document.querySelector('input[name=mt][value="'+t+'"]');if(r)r.checked=true}
const greet=h=>h<5?"Buonanotte":h<13?"Buongiorno":h<18?"Buon pomeriggio":"Buonasera";

// ---- Oggi e Diario
function mealRow(m){
  const h=new Date(m.ts).toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"});
  return `<article class="meal" data-edit="${m.id}" tabindex="0" aria-label="${esc(m.type)} delle ${h}, ${Math.round(m.total)} grammi. Tocca per modificare"><div class="mh"><span class="mt">${esc(m.type)}</span><span class="mtime">${h}</span></div>
  <p class="mi">${m.items.map(i=>esc(i.n)+" "+Math.round(i.g)+" "+(i.u||"g")).join(" · ")}</p>
  <div class="mv"><span class="num">${Math.round(m.total)}</span><span class="u">g</span></div>
  <button class="ibtn del" data-del="${m.id}" type="button" aria-label="Elimina ${esc(m.type)} delle ${h}">${I_TRASH}</button></article>`;
}
function render(){
  const now=new Date(),today=tdKey(now);
  $("date").textContent=greet(now.getHours())+" · "+now.toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"});
  const tm=state.meals.filter(m=>tdKey(m.ts)===today).sort((a,b)=>a.ts-b.ts);
  const tot=tm.reduce((s,m)=>s+m.total,0);
  $("tot").textContent=Math.round(tot);
  if(document.activeElement!==$("goal"))$("goal").value=state.goal||"";
  const max=Math.max(state.goal||0,tot,1);
  $("bar").innerHTML=tm.map(m=>`<i style="flex:${m.total} 1 0"></i>`).join("")+(max>tot?`<b style="flex:${max-tot} 1 0"></b>`:"");
  const left=state.goal?Math.round(state.goal-tot):null;
  $("goalbar").textContent=left===null?"Nessun obiettivo impostato":left>=0?`Restano ${left} g`:`Oltre di ${-left} g`;
  $("mcount").textContent=tm.length?`${tm.length} ${tm.length===1?"pasto":"pasti"}`:"";
  $("bar").setAttribute("aria-label",tm.length?`${Math.round(tot)} grammi in ${tm.length} ${tm.length===1?"pasto":"pasti"}${state.goal?`, obiettivo ${state.goal} grammi`:""}`:"Nessun pasto");
  renderNudge();
  $("meals").innerHTML=tm.length?tm.map(mealRow).join(""):'<p class="empty">Ancora niente oggi.</p>';
  const miss=TYPES.filter(t=>!tm.some(m=>m.type===t));
  $("slots").innerHTML=miss.length?`<span class="slots-l">Da registrare</span>`+miss.map(t=>`<button class="slot" type="button" data-add="${t}">${I_PLUS_S}${t}</button>`).join(""):"";
  renderHist();
}
// ---- calendario del Diario: un mese alla volta; toccare un giorno filtra lo storico
let calM=null,calDay=null;
const WD=["L","M","M","G","V","S","D"];
function renderCal(){
  const now=new Date();if(!calM)calM=new Date(now.getFullYear(),now.getMonth(),1);
  const y=calM.getFullYear(),mo=calM.getMonth(),days=new Date(y,mo+1,0).getDate(),lead=(new Date(y,mo,1).getDay()+6)%7;
  const tot={};state.meals.forEach(m=>{const k=tdKey(m.ts);tot[k]=(tot[k]||0)+m.total});
  const today=tdKey(now),thisM=y===now.getFullYear()&&mo===now.getMonth();
  const title=calM.toLocaleDateString("it-IT",{month:"long",year:"numeric"});
  let cells=WD.map(d=>`<span class="wd" aria-hidden="true">${d}</span>`).join("")+"<span></span>".repeat(lead);
  for(let d=1;d<=days;d++){
    const k=`${y}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`,t=tot[k],fut=k>today;
    const lab=new Date(y,mo,d).toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"})+(t!=null?`, ${Math.round(t)} grammi`:", nessun pasto");
    cells+=`<button type="button" data-day="${k}" class="${t!=null?"has":""}${k===today?" today":""}" aria-pressed="${calDay===k?"true":"false"}" aria-label="${lab}"${fut?" disabled":""}>${d}<small>${t!=null?Math.round(t):""}</small></button>`;
  }
  const sel=calDay?new Date(calDay+"T12:00").toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"}):"";
  $("cal").innerHTML=`<div class="cal-h"><button class="ibtn" type="button" data-calm="-1" aria-label="Mese precedente"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button><b aria-live="polite">${title}</b><button class="ibtn" type="button" data-calm="1" aria-label="Mese successivo"${thisM?" disabled":""}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button></div><div class="cal-g">${cells}</div>${calDay?`<div class="cal-f"><span>${sel}</span><button class="txt ink" type="button" data-calall>Mostra tutti i giorni</button></div>`:""}`;
}
$("cal").onclick=e=>{
  const m=e.target.closest("[data-calm]");if(m){calM=new Date(calM.getFullYear(),calM.getMonth()+(+m.dataset.calm),1);renderCal();return}
  const d=e.target.closest("[data-day]");if(d){calDay=calDay===d.dataset.day?null:d.dataset.day;renderCal();renderHist();return}
  if(e.target.closest("[data-calall]")){calDay=null;renderCal();renderHist()}
};
function renderHist(){
  renderCal();
  const raw=$("hq").value.trim(),q=fold(raw);
  const hit=m=>(!calDay||tdKey(m.ts)===calDay)&&(!q||fold(m.type).includes(q)||m.items.some(i=>fold(i.n).includes(q)));
  const days={};state.meals.filter(hit).forEach(m=>{(days[tdKey(m.ts)]??=[]).push(m)});
  $("hist").innerHTML=Object.keys(days).sort().reverse().map(k=>{
    const ms=days[k].slice().sort((a,b)=>b.ts-a.ts),t=ms.reduce((s,m)=>s+m.total,0);
    return `<section class="day"><div class="dh"><b>${new Date(k+"T12:00").toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"})}<small>${ms.length} ${ms.length===1?"pasto":"pasti"}</small></b><span class="num">${Math.round(t)} g</span></div>${ms.map(mealRow).join("")}</section>`
  }).join("")||`<p class="empty">${q?`Nessun pasto contiene “${esc(raw)}”${calDay?" in questo giorno":""}.`:calDay?"Nessun pasto in questo giorno.":"Ancora nessun dato."}</p>`;
}

// ---- piatto in composizione
// Voce del catalogo ancora coerente con lo snapshot (stesso c100): serve solo a mostrare intervallo e note.
const catInfo=i=>{const c=i.cid&&catByCid(i.cid);return c&&c.c100===i.c100?c:null};
function valSub(i,u){
  const c=catInfo(i),rg=c&&c.rng&&c.rng[1]>c.rng[0]?c.rng:null,notes=[];
  if(c&&c.rel==="stima"&&!c.cmp)notes.push("valore indicativo: se hai la confezione usa il codice a barre");
  if(c&&c.rel==="etichetta")notes.push("da etichetta: verifica che il formato sia lo stesso");
  if(c&&c.stx)notes.push("l’elenco non indica se crudo o cotto");
  if(c&&c.cmp)notes.push("piatto composto: valore medio, ricette diverse variano");
  return `<span class="sub">${rg?"≈ ":""}${fmt(r1(i.c100))} g ogni 100 ${u}${rg?` · stima ${fmt(rg[0])}–${fmt(rg[1])}`:""}</span>${notes.length?`<span class="sub">${notes.join(" · ")}</span>`:""}`;
}
let showBlock=false;
const blocked=()=>cur.some(i=>i.ask&&i.ask.some(a=>a.b));
// Scelta fatta: quantità presente e niente da confermare. Se l'alimento non è stato riaperto si mostra solo nome + carboidrati.
// "hold" (controlli visibili) e "more" (dettagli) sono solo stato dell'interfaccia: non vengono salvati nel pasto.
const isDone=i=>i.g>0&&!(i.ask||[]).some(a=>a.b)&&!(i.cand&&i.cand.length);
const isMin=i=>isDone(i)&&!i.hold&&!i.more;
const LVL_TXT={alta:"Confidenza alta",media:"Confidenza media",bassa:"Confidenza bassa"};
function renderCur(){
  const itemHTML=(i,k)=>{
    const u=i.u||"g",ask=i.ask||[],pr=pairOf(i);
    const tags=(i.ai?`<span class="tag ${i.conf==="bassa"?"low":""}">${LVL_TXT[i.conf||"media"]}</span>`:"")+(i.prov?`<span class="tag">provvisorio</span>`:"")+(i.rid?`<span class="tag">ricetta</span>`:"")+(i.cid&&SRC_LABEL[srcOf(i.cid)]?`<span class="tag src">${SRC_LABEL[srcOf(i.cid)]}</span>`:"");
    // porzioni convenzionali: si applicano solo toccandole
    const us=unitsOf(i);
    const chips=us?`<div class="chips" role="group" aria-label="Porzioni di ${esc(i.n)}">${us.map((x,n)=>{const on=i.pz&&i.pz.w===x.w&&i.pz.t===x.t;return `<button class="chip" type="button" data-unit="${k}" data-ui="${n}" aria-pressed="${on?"true":"false"}">${esc(x.t)} · ${fmt(x.w)} ${u}</button>`}).join("")}</div>`:"";
    const fv=!i.rid&&findFav(lib,i);
    const star=i.rid?"":`<button class="favb${fv?" on":""}" data-fav="${k}" type="button" aria-pressed="${fv?"true":"false"}" aria-label="${fv?"Togli dai preferiti":"Aggiungi ai preferiti"} ${esc(i.n)}">${fv?I_STAR_ON:I_STAR}</button>`;
    const askH=ask.length||(i.cand&&i.cand.length)?`<div class="ask ${ask.some(a=>a.b)?"":"ok"}" role="status">${ask.map(a=>esc(a.t)).join(" · ")}${i.cand&&i.cand.length?`<div>${i.cand.map(c=>`<button class="alt" data-alt="${k}" data-n="${esc(c)}" type="button">${esc(c)}</button>`).join("")}</div>`:""}${i.g>0&&ask.length?`<div><button class="alt" data-ok="${k}" type="button">Confermo</button></div>`:""}</div>`:"";
    const pz=i.pz&&i.pz.w>0?i.pz:null,byPz=pz&&!i.pzG;
    const pzR=pz&&catInfo(i)&&(us||[]).find(x=>x.w===pz.w&&x.t===pz.t&&x.r&&x.r[1]>x.r[0]);
    const pzSub=pz?`<span class="sub">${esc(pz.t||"1 "+pz.l)} = ${fmt(pz.w)} ${u} (${pzR?"≈ ":""}${fmt(pz.w*i.c100/100)} g CHO${pzR?`, stima ${fmt(pzR.r[0])}–${fmt(pzR.r[1])}`:""})${byPz&&i.g>0?` · ${fmt(i.g)} ${u} in tutto`:""}</span>`:"";
    const unitH=pz?`<button class="gu pzu" data-pzu="${k}" type="button" aria-label="${byPz?"Inserisci in grammi":"Inserisci a "+pzPlural(pz.l,2)}">${byPz?(pz.l==="porzione"?"porz.":"pz"):u}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg></button>`:`<span class="gu">${u}</span>`;
    const stepH=byPz
      ?`<button data-pstep="${k}" data-d="-1" type="button" aria-label="Un ${pz.l} in meno di ${esc(i.n)}">${I_MIN}</button>
   <input type="number" inputmode="decimal" step="0.5" min="0" value="${i.g>0?r1(i.g/pz.w):""}" data-pn="${k}" aria-label="${pzPlural(pz.l,2)} di ${esc(i.n)}">${unitH}
   <button data-pstep="${k}" data-d="1" type="button" aria-label="Un ${pz.l} in più di ${esc(i.n)}">${I_PLUS}</button>`
      :`<button data-step="${k}" data-d="-10" type="button" aria-label="Meno 10 ${u==="ml"?"millilitri":"grammi"} di ${esc(i.n)}">${I_MIN}</button>
   <input type="number" inputmode="decimal" value="${i.g>0?Math.round(i.g*10)/10:""}" placeholder="${i.typ||""}" data-g="${k}" aria-label="${u==="ml"?"Millilitri":"Grammi"} di ${esc(i.n)}">${unitH}
   <button data-step="${k}" data-d="10" type="button" aria-label="Più 10 ${u==="ml"?"millilitri":"grammi"} di ${esc(i.n)}">${I_PLUS}</button>`;
    // scelta fatta: solo nome + carboidrati (resta visibile solo l'avviso di confidenza bassa dell'AI). Toccando il nome si riapre.
    if(isMin(i)){
      const low=i.ai&&i.conf==="bassa"?`<span class="tag low">${LVL_TXT.bassa}</span>`:"";
      return `<div class="item min"><div class="nm"><button class="n nmore" type="button" data-more="${k}" aria-expanded="false" aria-label="${esc(i.n)}, ${fmt(i.g)} ${u}: tocca per modificare">${esc(i.n)}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>${low}</div>
   <div class="c">${r1(itemC(i))}</div>
   <button class="x" data-rm="${k}" type="button" aria-label="Rimuovi ${esc(i.n)}">${I_X}</button></div>`;
    }
    // compatto (nome, valore per 100, porzioni, quantità); toccando il nome: intervallo, note, porzione, fonte delle porzioni
    const c0=catInfo(i),rg0=c0&&c0.rng&&c0.rng[1]>c0.rng[0],open=i.more||i.hold;
    const head=`<button class="n nmore" type="button" data-more="${k}" aria-expanded="${open?"true":"false"}">${esc(i.n)}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>${tags}`;
    const brief=`<span class="sub">${rg0?"≈ ":""}${fmt(r1(i.c100))} g/100 ${u}</span>`;
    const detail=i.more?`<div class="det">${valSub(i,u)}${pzSub}${us&&portionSourceText(us)?`<span class="sub">${portionSourceText(us)}</span>`:""}</div>`:brief;
    return `<div class="item${open?" open":""}"><div class="nm">${head}${detail}${pr?`<label class="chk"><input type="checkbox" data-raw="${k}" ${i.st==="r"?"checked":""}><span>Peso a crudo</span></label>`:""}${chips}${askH}</div>
   <div class="c">${r1(itemC(i))}</div>
   <button class="x" data-rm="${k}" type="button" aria-label="Rimuovi ${esc(i.n)}">${I_X}</button>
   <div class="stp">${stepH}${star}</div></div>`};
  $("items").innerHTML=(showBlock&&blocked()?'<div class="msg err" role="alert">Conferma o correggi gli alimenti segnalati prima di salvare.</div>':"")+(cur.length?cur.map(itemHTML).join(""):'<div class="mut" style="padding:6px 0 2px">Ancora vuoto: fotografa il piatto o cerca un alimento.</div>');
  $("cur").textContent=total();
  announceTotal();
  $("save").disabled=!cur.length;
  $("pacts").classList.toggle("hide",!cur.length);
  if(!cur.length)$("rform").classList.add("hide");
  syncFab();
}
// VoiceOver: il totale del piatto viene letto quando smette di cambiare (non a ogni tocco di +/−)
var totTimer=null,totSaid=null;
function announceTotal(){
  clearTimeout(totTimer);
  totTimer=setTimeout(()=>{const t=total();if(!sheetOpen||t===totSaid)return;totSaid=t;const l=document.getElementById("curLive");if(l)l.textContent=`Totale piatto ${fmt(t)} grammi di carboidrati`},900);
}
function syncFab(){
  const n=cur.length,f=$("fab");
  f.dataset.n=n?String(n):"";
  f.setAttribute("aria-label",n?`Aggiungi pasto, piatto in corso con ${n} ${n===1?"alimento":"alimenti"}`:"Aggiungi pasto");
}

// ---- bottom sheet Aggiungi
const sheet=$("sheet"),scrim=$("scrim");
let sheetOpen=false,lastFocus=null;
const desk=()=>matchMedia("(min-width:768px)").matches;
function openSheet(type){
  if(type)setType(type);else if(!cur.length)setType(defaultType());
  if(sheetOpen)return;
  sheetOpen=true;lastFocus=document.activeElement;
  renderSug();
  sheet.style.transform="";sheet.classList.add("open");scrim.classList.add("open");
  $("main").inert=true;$("dock").inert=true;document.documentElement.classList.add("lock");
  checkKey();
  $("sheetT").focus({preventScroll:true}); // il pannello è già visibile (visibility senza ritardo in apertura)
}
function closeSheet(){
  closeScanner();
  if(!sheetOpen)return;
  sheetOpen=false;
  sheet.classList.remove("open");scrim.classList.remove("open");sheet.style.transform="";
  $("main").inert=false;$("dock").inert=false;document.documentElement.classList.remove("lock");
  if(lastFocus&&lastFocus.focus&&document.contains(lastFocus))lastFocus.focus({preventScroll:true});
}
$("fab").onclick=()=>openSheet();
$("closeSheet").onclick=closeSheet;
scrim.onclick=closeSheet;
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&sheetOpen){if(scannerOpen())closeScanner();else closeSheet()}
  if((e.key==="Enter"||e.key===" ")&&e.target.matches&&e.target.matches(".meal[data-edit]")){e.preventDefault();editMeal(e.target.dataset.edit)}
});
// trascinamento verso il basso per chiudere (solo su telefono)
let drag=null;
$("sheetH").addEventListener("pointerdown",e=>{
  if(desk()||e.target.closest("button"))return;
  drag={y:e.clientY,t:performance.now(),dy:0};sheet.style.transition="none";$("sheetH").setPointerCapture(e.pointerId);
});
$("sheetH").addEventListener("pointermove",e=>{if(!drag)return;drag.dy=Math.max(0,e.clientY-drag.y);sheet.style.transform=`translateY(${drag.dy}px)`});
const endDrag=()=>{
  if(!drag)return;
  const v=drag.dy/Math.max(1,performance.now()-drag.t);sheet.style.transition="";
  if(drag.dy>120||(v>.5&&drag.dy>30))closeSheet();else sheet.style.transform="";
  drag=null;
};
$("sheetH").addEventListener("pointerup",endDrag);
$("sheetH").addEventListener("pointercancel",endDrag);

// ---- navigazione
function go(v){
  if(v==="aggiungi")return openSheet();
  if(v==="impostazioni")v="altro";
  closeSheet();
  if(v==="altro"&&(view==="altro"||panel))showPanel(""); // come su iOS: ritoccare la scheda torna all'inizio
  view=v;
  VIEWS.forEach(n=>{const s=$("v-"+n);s.classList.toggle("hide",n!==v);if(n===v){s.style.animation="none";void s.offsetWidth;s.style.animation=""}});
  document.querySelectorAll("nav button").forEach(b=>{if(b.dataset.v===v)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")});
  window.scrollTo(0,0);
}
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>go(b.dataset.v));

// ---- toast con Annulla
let toastTimer=null,undoFn=null;
function toast(msg,undo){
  $("toastT").textContent=msg;undoFn=undo||null;
  $("toastU").classList.toggle("hide",!undo);
  $("toast").classList.add("show");
  clearTimeout(toastTimer);toastTimer=setTimeout(hideToast,undo?6000:msg.length>70?9000:3000);
}
function hideToast(){$("toast").classList.remove("show");undoFn=null}
$("toastU").onclick=()=>{const f=undoFn;hideToast();if(f)f()};

$("goal").onchange=e=>{state.goal=+e.target.value||null;persist();render()};
$("hq").oninput=renderHist;
document.body.addEventListener("click",e=>{
  const d=e.target.closest("[data-del]");if(d){
    const k=state.meals.findIndex(m=>m.id===d.dataset.del);
    if(k>=0){const [m]=state.meals.splice(k,1);persist();render();
      toast(`Pasto eliminato · ${m.type}`,()=>{state.meals.splice(Math.min(k,state.meals.length),0,m);persist();render()})}
    return;
  }
  const ed=e.target.closest("[data-edit]");if(ed){editMeal(ed.dataset.edit);return}
  const fb=e.target.closest("[data-fav]");if(fb){
    const it=cur[+fb.dataset.fav],ex=findFav(lib,it);
    if(ex){const r=removeFav(lib,ex.id);persistLib();toast(`Tolto dai preferiti · ${it.n}`,()=>{lib.favorites.splice(r.index,0,r.item);persistLib();renderCur();renderLibPanels()})}
    else{const f=addFav(lib,it);persistLib();toast(f.g>0?`Nei preferiti · ${qty(f.g,f.u,f.pz)} abituali`:`Nei preferiti · ${it.n}`)}
    renderCur();renderLibPanels();
  }
  const pn=e.target.closest("[data-panel]");if(pn)showPanel(pn.dataset.panel);
  const ad=e.target.closest("[data-add]");if(ad)openSheet(ad.dataset.add);
  const r=e.target.closest("[data-rm]");if(r){cur.splice(+r.dataset.rm,1);renderCur()}
  // dettagli dell'alimento (solo interfaccia: "more" non viene salvato nel pasto)
  // nome toccato: alimento ridotto → si riapre tutto; aperto → si richiude
  const mo=e.target.closest("[data-more]");if(mo){const it=cur[+mo.dataset.more];if(it){if(isMin(it)){it.hold=true;it.more=true}else if(it.more||it.hold){it.more=false;it.hold=false}else it.more=true;renderCur()}}
  const s=e.target.closest("[data-step]");if(s){const k=+s.dataset.step,it=cur[k];it.g=Math.max(0,Math.round(it.g)+(+s.dataset.d));it.hold=true;setWeight(it);renderCur()}
  const ps=e.target.closest("[data-pstep]");if(ps){const it=cur[+ps.dataset.pstep],w=it.pz.w,n=Math.max(0,Math.round(it.g/w)+(+ps.dataset.d));it.g=r1(n*w);it.hold=true;setWeight(it);renderCur()}
  const ch=e.target.closest("[data-unit]");if(ch){
    // tocco esplicito su una porzione: 1 porzione, poi si conta a pezzi; scelta fatta → l'alimento si riduce
    const it=cur[+ch.dataset.unit],us=it&&unitsOf(it),x=us&&us[+ch.dataset.ui];
    if(x){it.pz=cleanPz({w:x.w,l:x.l,t:x.t});it.pzG=false;it.g=it.pz.w;it.hold=false;it.more=false;setWeight(it);renderCur()}
    return;
  }
  const pu=e.target.closest("[data-pzu]");if(pu){const it=cur[+pu.dataset.pzu];it.pzG=!it.pzG;it.hold=true;renderCur();const f=document.querySelector(`[data-pn="${pu.dataset.pzu}"],[data-g="${pu.dataset.pzu}"]`);if(f)f.focus()}
  const ok=e.target.closest("[data-ok]");if(ok){const it=cur[+ok.dataset.ok];it.ask=[];it.cand=[];relevel(it);renderCur()}
  const alt=e.target.closest("[data-alt]");if(alt){const it=cur[+alt.dataset.alt],f=dbByName(alt.dataset.n);if(f){const u0=it.u||"g";it.n=f.n;it.c100=f.c;it.db=f.n;it.st=f.st||null;it.prov=!!f.p;it.cand=[];it.ask=it.ask.filter(a=>a.k==="weight");if(f.cmp)it.ask.push({k:"cmp",t:f.nt||"Piatto composto"});setUnit(it,f,u0);it.lvl="media";relevel(it);fixDb(it);renderCur()}}
  const g=e.target.closest("[data-go]");if(g)go(g.dataset.go);
});
function setWeight(it){if(it.g>0)it.ask=(it.ask||[]).filter(a=>a.k!=="weight"),relevel(it)}
$("items").addEventListener("input",e=>{
  const pn=e.target.dataset.pn;
  if(pn!=null){const it=cur[pn];it.g=r1(Math.max(0,+e.target.value||0)*it.pz.w);setWeight(it);
    e.target.closest(".item").querySelector(".c").textContent=r1(itemC(it));$("cur").textContent=total();return}
  const k=e.target.dataset.g;if(k==null)return;cur[k].g=Math.max(0,+e.target.value||0);setWeight(cur[k]);
  e.target.closest(".item").querySelector(".c").textContent=r1(itemC(cur[k]));
  $("cur").textContent=total();
});
$("items").addEventListener("change",e=>{
  // quantità confermata (uscita dal campo): scelta fatta → l'alimento si riduce
  const gk=e.target.dataset.g??e.target.dataset.pn;
  if(gk!=null){const it=cur[gk];if(it){it.hold=false;it.more=false}renderCur();return}
  const k=e.target.dataset.raw;if(k==null)return;
  // crudo/cotto: una porzione standard dello stato precedente non vale più per il nuovo
  const it=cur[k],had=unitsOf(it);it.hold=true;swapState(it);fixDb(it);
  if(it.pz&&had&&had.some(x=>x.t===it.pz.t&&x.w===it.pz.w)){delete it.pz;it.pzG=false}
  renderCur();
});
// ---- ricerca unificata: ricette, preferiti, recenti, database
const qty=(g,u,pz)=>{if(!(g>0))return"";const c=cleanPz(pz);if(c){const n=r1(g/c.w);if(Math.abs(n-Math.round(n))<.05)return `${fmt(n)} ${pzPlural(c.l,n)}`}return `${fmt(g)} ${u||"g"}`};
const pickRow=(kind,key,icon,name,info)=>`<button class="sug pick" type="button" data-pick="${kind}" data-k="${esc(key)}"><span class="pn">${icon}<span>${esc(name)}</span></span><small>${info}</small></button>`;
const favRow=f=>pickRow("fav",f.id,I_STAR_S,f.n,[qty(f.g,f.u,f.pz),`${fmt(f.c100)} g/100`].filter(Boolean).join(" · "));
const recRow=(f,k)=>pickRow("rec",k,I_CLOCK,f.n,[qty(f.g,f.u,f.pz),`${fmt(f.c100)} g/100`].filter(Boolean).join(" · "));
const rcpRow=r=>{const s=recipeStats(r);return pickRow("rcp",r.id,I_BOOK,r.n,`${Math.round(s.servCho)} g a porzione`)};
const grp=(t,rows)=>rows.length?`<div class="pgrp"><h3>${t}</h3>${rows.join("")}</div>`:"";
// Tendine del pannello vuoto: chiuse di default, si ricorda quale hai aperto (solo su questo telefono).
const DROP_KEY="carbo_drops";
const dropsOpen=()=>{try{return JSON.parse(localStorage.getItem(DROP_KEY))||{}}catch(e){return{}}};
const drop=(id,t,rows,total)=>rows.length?`<details class="pdrop" data-drop="${id}"${dropsOpen()[id]?" open":""}><summary><span>${t}</span><small>${total}</small></summary>${rows.join("")}</details>`:"";
$("sug").addEventListener("toggle",e=>{const d=e.target.closest&&e.target.closest("[data-drop]");if(!d)return;const o=dropsOpen();o[d.dataset.drop]=d.open;try{localStorage.setItem(DROP_KEY,JSON.stringify(o))}catch(x){}},true);
function renderSug(){
  const raw=$("q").value.trim(),q=raw.toLowerCase(),qf=fold(raw),qn=norm(q);
  if(!q){
    // preferiti e recenti in alto, ricette in fondo
    $("sug").innerHTML=drop("fav","Preferiti",lib.favorites.slice(0,8).map(favRow),lib.favorites.length)+drop("rec","Recenti",lib.recents.slice(0,8).map(recRow),lib.recents.length)+drop("rcp","Ricette",lib.recipes.slice(0,8).map(rcpRow),lib.recipes.length);
    return;
  }
  const rc=lib.recipes.filter(r=>fold(r.n).includes(qf)).slice(0,4).map(rcpRow);
  const fv=lib.favorites.filter(f=>fold(f.n).includes(qf)).slice(0,4).map(favRow);
  const rank=f=>{const n=f.n.toLowerCase();return n===q?0:n.startsWith(q)?1:(f.a||[]).some(a=>a===q)?2:3};
  // prodotti salvati sul telefono (scansionati o inseriti a mano)
  const pr=Object.entries(lib.products||{}).filter(([,p])=>p&&p.n&&fold(productLabel(p)).includes(qf)).slice(0,4)
    .map(([ean,p])=>`<button class="sug" type="button" data-pk="${esc(ean)}"><span>${esc(productLabel(p))}</span><small>${fmt(p.c100)} g/100 ${p.u||"g"}${srcTag(p.src==="off"?"off":"manual")}</small></button>`);
  // DB del motore: stessa ricerca di prima, solo lettura
  // correzioni dell'utente (lib.foodEdits "db:<nome>"): nome e valore mostrati, voci nascoste escluse
  const dbAll=DB.filter(f=>{const e=dbEditOf(f.n);if(e&&e.hidden)return false;return f.n.toLowerCase().includes(q)||(e&&e.n&&e.n.toLowerCase().includes(q))||[f.n,...(f.a||[])].some(p=>qn.length&&isPre(norm(p),qn))});
  const db=dbAll.map((f,k)=>({f,k})).sort((a,b)=>rank(a.f)-rank(b.f)||a.k-b.k).map(x=>x.f).slice(0,6).map(f=>{const e=dbEditOf(f.n);return `<button class="sug" type="button" data-f="${DB.indexOf(f)}"><span>${esc(e&&e.n||f.n)}</span><small>${fmt(dbC(f))} g/100 ${f.u||"g"}${f.p&&!e?" · provv.":""}${srcTag("db")}${e?" · modificato":""}</small></button>`});
  // catalogo esterno: dopo il DB; una voce con lo stesso nome e valore simile (±10%) a una del DB non si ripete
  const same=f=>dbAll.some(d=>fold(d.n)===fold(f.n)&&Math.abs(d.c-f.c100)<=Math.max(.5,d.c*.1));
  const cat=catalogFoods().filter(f=>(fold(f.n).includes(qf)||(f.a||[]).some(a=>fold(a).includes(qf)))&&!same(f))
    .sort((a,b)=>rank(a)-rank(b)||a.n.length-b.n.length).slice(0,8)
    .map(f=>`<button class="sug" type="button" data-c="${esc(f.cid)}"><span>${esc(f.n)}</span><small>${f.rng&&f.rng[1]>f.rng[0]?"≈ ":""}${fmt(f.c100)} g/100 ${f.u}${srcTag(srcOf(f.cid))}${f.edited?" · modificato":""}</small></button>`);
  const foods=[...db,...cat];
  $("sug").innerHTML=(rc.length||fv.length||pr.length?grp("Preferiti",fv)+grp("Prodotti",pr)+grp("Alimenti",foods)+grp("Ricette",rc):foods.join(""))||`<p class="empty">Nessun risultato per “${esc(raw)}”: usa “Alimento non in elenco”.</p>`;
}
const srcTag=s=>SRC_LABEL[s]?` · <span class="srct">${SRC_LABEL[s]}</span>`:"";
// Elemento del piatto da una voce del catalogo: peso da inserire o porzione da scegliere (mai applicata da sola).
function itemFromCat(f){
  const i={n:f.n,g:0,u:f.u||"g",c100:f.c100,cid:f.cid,units:f.units||[],ask:[{k:"weight",t:f.units&&f.units.length?"Scegli una porzione o inserisci il peso":"Inserisci il peso",b:1}],cand:[]};
  relevel(i);return i;
}
// Porzioni del catalogo per uno snapshot salvato, solo se il valore nutrizionale coincide ancora.
const unitsFor=s=>{const c=s.cid&&catByCid(s.cid);return c&&c.c100===s.c100?c.units:null};
// Porzioni da mostrare: catalogo (USDA) oppure porzioni standard LARN della voce DB. Mai per le ricette.
function unitsOf(i){
  if(i.units&&i.units.length)return i.units;
  if(i.rid||!i.db)return null;
  const d=dbByName(i.db),p=d&&(d.c===i.c100||dbC(d)===i.c100)&&(d.u||"g")===(i.u||"g")&&portionsFor(d.n);
  return p&&p.length?p:null;
}
const askPortion=i=>{if(unitsOf(i)&&!(i.g>0))i.ask=(i.ask||[]).map(a=>a.k==="weight"?{...a,t:"Scegli una porzione o inserisci il peso"}:a);return i};
$("q").oninput=renderSug;
// Elemento del piatto da uno snapshot di alimento (preferito o recente), con la quantità abituale.
function itemFromFood(f,g){
  const d=f.ref&&dbByName(f.ref);
  let i;
  // snapshot: il preferito/recente tiene il suo valore anche se la voce del DB è stata corretta dopo
  if(d&&(d.c===f.c100||dbC(d)===f.c100)&&(d.u||"g")===(f.u||"g")){i=fromDB(d);i.n=f.n;i.c100=f.c100}
  else i={n:f.n,g:0,u:f.u||"g",c100:f.c100,ask:[{k:"weight",t:"Inserisci il peso",b:1}],cand:[]};
  if(f.ean)i.ean=f.ean;
  if(f.cid){i.cid=f.cid;const u=unitsFor(f);if(u)i.units=u}
  if(cleanPz(f.pz))i.pz=cleanPz(f.pz);
  if(g>0){i.g=g;setWeight(i)}else relevel(i);
  return i;
}
function addToPlate(i,label){
  cur.push(i);renderCur();
  toast(`Aggiunto: ${label||i.n}${i.g>0?` · ${fmt(i.g)} ${i.u||"g"}`:""}`);
}
$("sug").onclick=e=>{
  const s=e.target.closest("[data-f]");
  if(s){const f=DB[+s.dataset.f];cur.push(askPortion(fixDb(fromDB(f))));$("q").value="";renderSug();renderCur();return}
  const c=e.target.closest("[data-c]");
  if(c){const f=catByCid(c.dataset.c);if(f){cur.push(itemFromCat(f));$("q").value="";renderSug();renderCur()}return}
  const pk=e.target.closest("[data-pk]");
  if(pk){const p=lib.products&&lib.products[pk.dataset.pk];if(p){
    const it={n:productLabel(p),g:0,u:p.u||"g",c100:p.c100,ean:pk.dataset.pk,ask:[{k:"weight",t:"Inserisci la quantità",b:1}],cand:[]};
    if(cleanPz(p.pz))it.pz=cleanPz(p.pz);relevel(it);cur.push(it);$("q").value="";renderSug();renderCur()}return}
  const p=e.target.closest("[data-pick]");if(!p)return;
  const k=p.dataset.k;
  if(p.dataset.pick==="fav"){const f=lib.favorites.find(x=>x.id===k);if(f)addToPlate(itemFromFood(f,f.g))}
  else if(p.dataset.pick==="rec"){const f=lib.recents[+k];if(f)addToPlate(itemFromFood(f,f.g))}
  else if(p.dataset.pick==="rcp"){const r=lib.recipes.find(x=>x.id===k);if(r)addToPlate(recipePlateItem(r,1),`${r.n} (1 porzione)`)}
  $("q").value="";renderSug();
};
$("addc").onclick=()=>{const n=$("cn").value.trim(),c=+$("cc").value;if(!n||!(c>=0)||$("cc").value==="")return;cur.push({n,g:0,u:"g",c100:c,ask:[{k:"weight",t:"Inserisci il peso",b:1}],cand:[],conf:"bassa"});$("cn").value="";$("cc").value="";renderCur()};
function setEditing(id){
  editId=id;
  $("sheetT").textContent=id?"Modifica pasto":"Nuovo pasto";
  $("save").textContent=id?"Aggiorna pasto":"Salva pasto";
  $("clear").textContent=id?"Annulla modifica":"Svuota piatto";
  $("asNew").classList.toggle("hide",!id);
}
// Copia di un pasto (anche di un altro giorno): il piatto resta, diventa un pasto nuovo da salvare ora.
$("asNew").onclick=()=>{if(!editId)return;setEditing(null);setType(defaultType());renderCur();toast("Copia pronta: controlla e salva per aggiungerla a oggi")};
function resetPlate(){cur=[];showBlock=false;photoBlob=null;setEditing(null);$("rform").classList.add("hide");$("shot").classList.add("hide");$("afterPick").classList.add("hide");$("pickBtn").classList.remove("hide");setMsg("");$("hint").value="";$("desc").value="";toggleDesc(false);closeChat();renderCur()}
$("clear").onclick=resetPlate;
$("save").onclick=()=>{
  if(!cur.length)return;
  if(blocked()){showBlock=true;renderCur();$("items").scrollIntoView({behavior:reduced()?"auto":"smooth",block:"start"});return}
  const t=total(),type=mealType();
  // snapshot dei valori usati ora: i pasti non dipendono da preferiti, ricette o database
  const items=cur.map(i=>({n:i.n,g:i.g,u:i.u||"g",c100:i.c100,...(i.db?{ref:i.db}:{}),...(i.rid?{rid:i.rid}:{}),...(i.ean?{ean:i.ean}:{}),...(i.cid?{cid:i.cid}:{}),...(cleanPz(i.pz)?{pz:cleanPz(i.pz)}:{})}));
  const old=editId&&state.meals.find(m=>m.id===editId);
  if(old){old.type=type;old.items=items;old.total=t;old.edited=Date.now()}
  else state.meals.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),ts:Date.now(),type,items,total:t});
  pushRecents(lib,cur);persistLib();
  persist();resetPlate();render();
  if(!old)checkStorage(true); // dopo un pasto salvato il browser concede più facilmente la protezione
  if(!old)go("oggi");else closeSheet();
  toast(`${old?"Pasto aggiornato":"Pasto salvato"} · ${type}, ${Math.round(t)} g`);
};
// ---- modifica di un pasto salvato
function itemFromSaved(s){
  const i={n:s.n,g:s.g,u:s.u||"g",c100:s.c100,ask:[],cand:[]};
  const d=s.ref&&dbByName(s.ref);
  if(d&&(d.c===s.c100||dbC(d)===s.c100)){i.db=d.n;i.st=d.st||null;i.prov=!!d.p}
  if(s.rid)i.rid=s.rid;
  if(s.ean)i.ean=s.ean;
  if(s.cid){i.cid=s.cid;const u=unitsFor(s);if(u)i.units=u}
  if(cleanPz(s.pz))i.pz=cleanPz(s.pz);
  relevel(i);return i;
}
function editMeal(id){
  const m=state.meals.find(x=>x.id===id);if(!m)return;
  if(cur.length&&editId!==id){openSheet();toast("Prima salva o svuota il piatto in corso");return}
  cur=m.items.map(itemFromSaved);showBlock=false;setEditing(id);
  renderCur();openSheet(m.type);
}
// ---- salva il piatto come ricetta
$("asRecipe").onclick=()=>{
  if(blocked()){showBlock=true;renderCur();return}
  const f=$("rform");f.classList.remove("hide");
  const w=cur.reduce((s,i)=>s+(i.g||0),0);
  $("rinfo").textContent=`${cur.length} ${cur.length===1?"ingrediente":"ingredienti"} · ${Math.round(w)} g · ${fmt(total())} g di carboidrati in totale`;
  $("rname").focus();f.scrollIntoView({behavior:reduced()?"auto":"smooth",block:"nearest"});
};
$("rcancel").onclick=()=>$("rform").classList.add("hide");
$("rform").onsubmit=e=>{
  e.preventDefault();
  const n=$("rname").value.trim();if(!n){$("rname").focus();return}
  if(!cur.some(i=>i.g>0)){$("rinfo").textContent="Inserisci almeno un peso.";return}
  const r=newRecipe(n,+$("rserv").value||1,cur.filter(i=>!i.rid));
  if(!r.ingredients.length){$("rinfo").textContent="Una ricetta non può contenere altre ricette.";return}
  lib.recipes.unshift(r);persistLib();
  $("rform").classList.add("hide");$("rname").value="";$("rserv").value="1";
  const s=recipeStats(r);
  toast(`Ricetta salvata · ${Math.round(s.servCho)} g a porzione`);renderSug();renderLibPanels();
};

// ---- foto + analisi AI (il motore è in engine/ai.js)
let photoBlob=null,busy=false;
const reduced=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
const OFFLINE_MSG="Sei offline: l'AI non è raggiungibile. Puoi cercare e aggiungere alimenti anche senza rete.";
function setMsg(t,cls){const m=$("aiMsg");m.className="msg"+(cls?" "+cls:"");m.textContent=t||""}
function checkKey(){$("nokey").classList.toggle("hide",!!getKey())}

$("photo").onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  setMsg("");
  try{photoBlob=await shrink(f)}
  catch(err){photoBlob=null;setMsg("Non riesco a leggere questa foto. Prova con un'altra.","err");return}
  finally{e.target.value=""}
  const old=$("prev").src;if(old&&old.startsWith("blob:"))URL.revokeObjectURL(old);
  $("prev").src=URL.createObjectURL(photoBlob);
  $("shot").classList.remove("hide");$("afterPick").classList.remove("hide");$("pickBtn").classList.add("hide");
  $("analyzeTxt").textContent="Analizza il piatto";checkKey();
};
async function analyze(){
  if(busy||!photoBlob)return;
  if(!getKey()){setMsg("Manca la chiave AI: impostala per analizzare le foto.","err");checkKey();return}
  if(navigator.onLine===false){setMsg(OFFLINE_MSG,"err");return}
  busy=true;setMsg("");
  $("analyze").setAttribute("aria-busy","true");$("analyzeTxt").textContent="Analisi in corso…";$("spin").classList.remove("hide");$("scan").classList.add("on");
  let base="Preparo la foto…";const t0=Date.now();
  const paint=()=>{$("scanTxt").textContent=base+" "+Math.round((Date.now()-t0)/1000)+" s"};
  const stage=t=>{base=t;paint()};
  const tick=setInterval(paint,500);
  try{
    stage("Preparo la foto…");
    closeChat();
    const hint=$("hint").value.trim();
    const {items}=await analyzePhoto(photoBlob,hint,stage);
    if(!items.length){setMsg("Non riconosco cibo in questa foto. Prova con un'altra o aggiungi a mano.")}
    else{
      // sostituisce solo le voci della foto precedente (le voci da descrizione restano)
      cur=cur.filter(i=>!(i.ai&&i.via!=="desc"));
      items.forEach(i=>{fixDb(i);i.via="photo";cur.push(i)});showBlock=false;
      startChat({kind:"photo",hint,qa:[],round:0},items);
      renderCur();
      const low=cur.filter(i=>i.ai&&i.ask.some(a=>a.b)).length,worst=Math.min(...cur.filter(i=>i.ai).map(i=>LV[i.conf]||2));
      setMsg(`Trovati ${items.length} ${items.length===1?"alimento":"alimenti"}. Confidenza complessiva ${worst===1?"bassa":worst===2?"media":"alta"}.${low?` ${low} ${low===1?"voce da confermare":"voci da confermare"}: controlla alimento e quantità.`:" Controlla comunque i valori qui sotto."}`,low?"":"ok");
      $("secPiatto").scrollIntoView({behavior:reduced()?"auto":"smooth",block:"start"});
    }
    $("analyzeTxt").textContent="Analizza di nuovo";
  }catch(err){setMsg(err.message||"Analisi non riuscita.","err");$("analyzeTxt").textContent="Riprova"}
  finally{clearInterval(tick);busy=false;$("analyze").removeAttribute("aria-busy");$("spin").classList.add("hide");$("scan").classList.remove("on")}
}
$("analyze").onclick=analyze;

// ---- "Descrivi il piatto": stima da testo (engine/describe.js). Le voci si aggiungono al piatto.
function toggleDesc(open){
  const o=open??$("descBox").classList.contains("hide");
  $("descBox").classList.toggle("hide",!o);$("descBtn").setAttribute("aria-expanded",String(o));
  if(o){checkKey();$("desc").focus()}
}
$("descBtn").onclick=()=>toggleDesc();
async function describe(){
  const t=$("desc").value.trim();
  if(busy)return;
  if(!t){setMsg("Scrivi cosa mangi, es. “kebab medio”.","err");$("desc").focus();return}
  if(!getKey()){setMsg("Manca la chiave AI: impostala per stimare dalle descrizioni.","err");checkKey();return}
  if(navigator.onLine===false){setMsg(OFFLINE_MSG,"err");return}
  busy=true;setMsg("");
  $("descGo").setAttribute("aria-busy","true");$("dspin").classList.remove("hide");
  let base="Stimo i carboidrati…";const t0=Date.now();
  const paint=()=>{$("descTxt").textContent=base.replace(/…$/,"")+"… "+Math.round((Date.now()-t0)/1000)+" s"};
  const stage=s=>{base=s;paint()};
  const tick=setInterval(paint,500);paint();
  try{
    closeChat();
    const {describeMeal}=await import("./engine/describe.js");
    const {items}=await describeMeal(t,stage);
    if(!items.length){setMsg("Non riconosco cibo in questa descrizione. Prova a essere più preciso o aggiungi a mano.")}
    else{
      const batch="d"+Date.now();
      items.forEach(i=>{fixDb(i);i.via="desc";i.batch=batch;cur.push(i)});showBlock=false;
      startChat({kind:"desc",text:t,batch,qa:[],round:0},items);
      renderCur();
      const low=items.filter(i=>i.ask.some(a=>a.b)).length;
      setMsg(`Aggiunti ${items.length} ${items.length===1?"alimento":"alimenti"} dalla descrizione.${low?` ${low} ${low===1?"voce da confermare":"voci da confermare"}: controlla alimento e quantità.`:" Controlla comunque i valori qui sotto."}`,low?"":"ok");
      $("desc").value="";toggleDesc(false);
      $("secPiatto").scrollIntoView({behavior:reduced()?"auto":"smooth",block:"start"});
    }
  }catch(err){setMsg(err.message||"Stima non riuscita.","err")}
  finally{clearInterval(tick);busy=false;$("descGo").removeAttribute("aria-busy");$("dspin").classList.add("hide");$("descTxt").textContent="Stima i carboidrati"}
}
$("descGo").onclick=describe;

// ---- mini chat: l'AI chiede poche cose (alimento, quantità); le risposte rifanno la stima.
// Foto: le risposte vanno nell'indizio (analyzePhoto, ai.js invariato). Descrizione: passate a describeMeal.
// Niente viene salvato: le voci restano nel piatto come prima, fino a "Salva pasto".
let chat=null;
const MAX_Q=3,MAX_ROUNDS=2;
function questionsFor(items,asked){
  const qs=[];
  for(const i of items){
    const q=i.ask.find(a=>a.k==="q");
    if(q){qs.push(`${i.n}: ${q.t}`);continue}
    // solo se è l'AI a non essere sicura (non per le ambiguità del confronto con il DB)
    if(i.ask.some(a=>a.k==="food"&&/non riconosciuto/.test(a.t)))qs.push(`Cos'è di preciso “${i.n}”?`);
    if(i.ask.some(a=>a.k==="weight"&&a.b))qs.push(`Quanto ne hai mangiato di “${i.n}”? (grammi, pezzi o misura)`);
  }
  return [...new Set(qs)].filter(q=>!asked.has(q)).slice(0,MAX_Q);
}
function startChat(ctx,items){
  const asked=new Set((ctx.qa||[]).map(x=>x.q));
  const qs=ctx.round<MAX_ROUNDS?questionsFor(items,asked):[];
  if(!qs.length){closeChat();return}
  chat={...ctx,qs,k:0,log:(chat&&chat.kind===ctx.kind&&ctx.round>0?chat.log:[]).concat(ctx.round>0?[{ai:1,t:"Ho aggiornato la stima. Ancora una cosa:"}]:[{ai:1,t:"Per essere più preciso:"}])};
  renderChat();
}
function closeChat(){chat=null;$("chat").classList.add("hide");$("chatLog").innerHTML="";$("chatIn").value=""}
function renderChat(wait){
  if(!chat)return closeChat();
  const lines=[...chat.log];
  if(wait)lines.push({ai:1,t:wait,w:1});
  else if(chat.k<chat.qs.length)lines.push({ai:1,t:chat.qs[chat.k]});
  $("chatLog").innerHTML=lines.map(l=>`<p class="bub ${l.ai?"ai":"me"}${l.w?" wait":""}">${esc(l.t)}</p>`).join("");
  $("chat").classList.remove("hide");
  const dis=!!wait;$("chatIn").disabled=dis;$("chatSend").disabled=dis;$("chatSkip").disabled=dis;
}
function chatAnswer(a){
  if(!chat||busy||chat.k>=chat.qs.length)return;
  const q=chat.qs[chat.k];
  chat.log.push({ai:1,t:q},{t:a});chat.qa.push({q,a});chat.k++;
  $("chatIn").value="";
  if(chat.k<chat.qs.length){renderChat();$("chatIn").focus();return}
  // tutte le risposte "non lo so": niente da aggiornare
  if(chat.qa.slice(-chat.qs.length).every(x=>x.a==="Non lo so")){chat.log.push({ai:1,t:"Va bene, lascio la stima così: controlla i valori qui sotto."});chat.k=chat.qs.length;renderChat();$("chatIn").disabled=true;$("chatSend").disabled=true;$("chatSkip").disabled=true;return}
  reestimate();
}
async function reestimate(){
  if(!chat||busy)return;
  if(!getKey()){setMsg("Manca la chiave AI.","err");return}
  const c=chat;busy=true;
  let base="Aggiorno la stima…";const t0=Date.now();
  const paint=()=>renderChat(base+" "+Math.round((Date.now()-t0)/1000)+" s");
  const stage=s=>{base=s.replace("Riconosco gli alimenti…","Aggiorno la stima…").replace("Stimo i carboidrati…","Aggiorno la stima…");paint()};
  const tick=setInterval(paint,500);paint();
  try{
    let items;
    if(c.kind==="photo"){
      if(!photoBlob)throw new Error("La foto non è più disponibile: scattala di nuovo.");
      const qa=c.qa.filter(x=>x.a!=="Non lo so").map(x=>`${x.q} → ${x.a}`).join("; ");
      const hint=((c.hint?c.hint+". ":"")+"Risposte dell'utente alle tue domande: "+qa).slice(0,700);
      ({items}=await analyzePhoto(photoBlob,hint,stage));
      if(items.length){cur=cur.filter(i=>!(i.ai&&i.via!=="desc"));items.forEach(i=>{fixDb(i);i.via="photo";cur.push(i)})}
    }else{
      const {describeMeal}=await import("./engine/describe.js");
      ({items}=await describeMeal(c.text,stage,c.qa.filter(x=>x.a!=="Non lo so")));
      if(items.length){cur=cur.filter(i=>i.batch!==c.batch);items.forEach(i=>{fixDb(i);i.via="desc";i.batch=c.batch;cur.push(i)})}
    }
    clearInterval(tick);busy=false;
    if(!items.length){chat.log.push({ai:1,t:"Non sono riuscito ad aggiornare: lascio la stima di prima."});chat.k=chat.qs.length;renderChat();return}
    showBlock=false;renderCur();
    const tot=items.reduce((s,i)=>s+(i.g>0?i.g*i.c100/100:0),0);
    setMsg(`Stima aggiornata: ${items.map(i=>i.n).join(", ")} · ${fmt(Math.round(tot*10)/10)} g di carboidrati. Controlla i valori qui sotto.`,"ok");
    startChat({...c,round:c.round+1},items);
    if(chat&&chat.round===c.round+1)return;
    // nessuna nuova domanda: chiude con un riepilogo
    chat={...c,qs:[],k:0,log:c.log.concat([{ai:1,t:"Fatto, stima aggiornata. Controlla i valori qui sotto."}])};renderChat();
    $("chatIn").disabled=true;$("chatSend").disabled=true;$("chatSkip").disabled=true;
  }catch(err){
    clearInterval(tick);busy=false;
    chat.log.push({ai:1,t:err.message||"Aggiornamento non riuscito."});chat.k=chat.qs.length;renderChat();
    $("chatIn").disabled=true;$("chatSend").disabled=true;$("chatSkip").disabled=true;
  }
}
$("chatForm").onsubmit=e=>{e.preventDefault();const a=$("chatIn").value.trim();if(a)chatAnswer(a.slice(0,160));else $("chatIn").focus()};
$("chatSkip").onclick=()=>chatAnswer("Non lo so");
$("chatClose").onclick=closeChat;
$("desc").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();describe()}});

// ---- Altro: impostazioni AI (invariate)
$("testKey").onclick=async()=>{
  const k=$("key").value.trim()||getKey(),m=$("keymsg");
  if(!k){m.className="msg err";m.textContent="Incolla prima la chiave.";return}
  try{localStorage.setItem("carbo_key_"+getProv(),k)}catch(_){}
  m.className="msg";m.textContent="Verifico…";
  try{
    const res=getProv()==="gemini"
      ?await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",{headers:{"x-goog-api-key":k}})
      :await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":k,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-haiku-5-5",max_tokens:1,messages:[{role:"user",content:"ok"}]})});
    const j=await res.json().catch(()=>({}));
    if(res.ok){m.className="msg ok";m.textContent="Chiave valida: l'analisi con AI è pronta.";checkKey()}
    else{const e=httpErr(res.status,j);m.className="msg err";m.textContent=(e.status===429||e.status>=500)?"La chiave sembra valida, ma il servizio è occupato ora.":e.message}
  }catch(e){m.className="msg err";m.textContent="Nessuna connessione a internet."}
};

// ---- Altro: dati
let wipeT;
$("wipe").onclick=()=>{
  const b=$("wipe");
  if(b.dataset.arm){
    delete b.dataset.arm;clearTimeout(wipeT);b.textContent="Cancella tutti i pasti";
    const prev=state.meals;state.meals=[];persist();render();$("wipeMsg").textContent="Pasti cancellati.";
    toast("Tutti i pasti cancellati",()=>{state.meals=prev;persist();render();$("wipeMsg").textContent="Pasti ripristinati."});
  }
  else{b.dataset.arm="1";b.textContent="Tocca di nuovo per confermare";wipeT=setTimeout(()=>{delete b.dataset.arm;b.textContent="Cancella tutti i pasti"},4000)}
};
const fmtDay=ts=>new Date(ts).toLocaleDateString("it-IT",{day:"numeric",month:"long",year:"numeric"});
function showLastBackup(){const t=lastBackup();$("bkMsg").className="msg";$("bkMsg").textContent=t?"Ultimo backup: "+fmtDay(t)+".":"Nessun backup ancora: salvane uno ogni tanto."}
$("backup").onclick=async()=>{
  const m=$("bkMsg");m.className="msg";m.textContent="Preparo il backup…";
  try{const r=await exportBackup(state,lib);if(r==="cancel"){showLastBackup();return}
    m.className="msg ok";m.textContent=`Backup pronto: ${state.meals.length} ${state.meals.length===1?"pasto":"pasti"}, ${lib.favorites.length} preferiti, ${lib.recipes.length} ricette. La chiave AI non è inclusa.`}
  catch(e){m.className="msg err";m.textContent="Non sono riuscito a creare il backup."}
};
// ---- Altro: export CSV (solo lettura)
$("csv").onclick=async()=>{
  const m=$("bkMsg");
  if(!state.meals.length){m.className="msg";m.textContent="Nessun pasto da esportare.";return}
  try{const r=await saveFile(new Blob([mealsCSV(state.meals)],{type:"text/csv;charset=utf-8"}),`carbo-pasti-${tdKey(Date.now())}.csv`,"Pasti Carbo");
    if(r!=="cancel"){m.className="msg ok";m.textContent=`CSV pronto: ${state.meals.length} ${state.meals.length===1?"pasto":"pasti"}, una riga per alimento.`}}
  catch(e){m.className="msg err";m.textContent="Non sono riuscito a creare il CSV."}
};
// ---- Altro: ripristino da backup. Prima si legge e si mostra l'anteprima; i dati cambiano solo con Unisci o Sostituisci.
let rsData=null;
const pl=(n,s,p)=>`${n} ${n===1?s:p}`;
$("restore").onclick=()=>{$("rsFile").value="";$("rsFile").click()};
$("rsFile").onchange=async e=>{
  const f=e.target.files&&e.target.files[0];if(!f)return;
  const box=$("rsPrev");
  if(f.size>20*1024*1024){rsData=null;box.classList.remove("hide");box.innerHTML=`<p class="warn">File troppo grande per essere un backup di Carbo.</p><div class="acts"><button class="txt" type="button" data-rs="close">Chiudi</button></div>`;return}
  const b=parseBackup(await f.text());rsData=b.ok?b:null;box.classList.remove("hide");
  if(!b.ok){box.innerHTML=`<p class="warn">${esc(b.err)}</p><div class="acts"><button class="txt" type="button" data-rs="close">Chiudi</button></div>`;return}
  const p=mergePreview(state,lib,b),L=b.library;
  const range=b.from?(tdKey(b.from)===tdKey(b.to)?fmtDay(b.from):`dal ${fmtDay(b.from)} al ${fmtDay(b.to)}`):"";
  box.innerHTML=`<h3>Backup del ${b.exportedAt?fmtDay(Date.parse(b.exportedAt)):"?"} · Carbo ${esc(b.appVersion)}</h3>
   <ul><li>${pl(b.meals.length,"pasto","pasti")}${range?" "+range:""}</li>${L?`<li>${pl(L.favorites.length,"preferito","preferiti")}, ${pl(L.recipes.length,"ricetta","ricette")}, ${pl(Object.keys(L.products).length,"prodotto","prodotti")}</li>`:""}
   <li>Unendo: ${pl(p.newMeals,"pasto nuovo","pasti nuovi")}${p.sameMeals?` (${p.sameMeals} già ${p.sameMeals===1?"presente, resta com'è":"presenti, restano come sono"})`:""}${L?`, ${pl(p.newFav,"preferito","preferiti")}, ${pl(p.newRcp,"ricetta","ricette")}, ${pl(p.newProd,"prodotto","prodotti")}`:""}</li>
   <li>Ora sul telefono: ${pl(state.meals.length,"pasto","pasti")}, ${pl(lib.favorites.length,"preferito","preferiti")}, ${pl(lib.recipes.length,"ricetta","ricette")}</li></ul>
   ${b.skipped?`<p class="warn">${b.skipped} ${b.skipped===1?"pasto non è leggibile e verrà ignorato":"pasti non sono leggibili e verranno ignorati"}.</p>`:""}
   ${b.sumOk?"":`<p class="warn">Il controllo di integrità non corrisponde: il file potrebbe essere stato modificato o danneggiato. Per sicurezza è possibile solo unire.</p>`}
   ${isReadOnly()&&L?`<p class="warn">La libreria su questo telefono è di una versione più recente: verranno ripristinati solo i pasti.</p>`:""}
   <div class="acts"><button class="txt ink" type="button" data-rs="merge">Unisci ai dati attuali</button>${b.sumOk?`<button class="txt danger" type="button" data-rs="replace">Sostituisci tutto</button>`:""}<button class="txt" type="button" data-rs="close">Annulla</button></div>`;
  box.scrollIntoView({block:"nearest",behavior:reduced()?"auto":"smooth"});
};
let rsArm=null;
function applyRestore(next,how){
  state=next.state;persist();
  if(!isReadOnly()){lib=next.lib;persistLib()}
  rsData=null;$("rsPrev").classList.add("hide");$("rsPrev").innerHTML="";
  render();renderLibPanels();renderUndoRestore();
  $("bkMsg").className="msg ok";$("bkMsg").textContent=how;
}
$("rsPrev").onclick=e=>{
  const a=e.target.closest("[data-rs]");if(!a)return;
  const k=a.dataset.rs;
  if(k==="close"||!rsData){rsData=null;$("rsPrev").classList.add("hide");$("rsPrev").innerHTML="";return}
  if(k==="merge"){const p=mergePreview(state,lib,rsData);applyRestore(mergeInto(state,lib,rsData),`Backup unito: ${pl(p.newMeals,"pasto aggiunto","pasti aggiunti")}, nessun dato esistente modificato.`);return}
  if(k==="replace"&&rsData.sumOk){
    if(!a.dataset.arm){a.dataset.arm="1";a.textContent="Tocca di nuovo: sostituisce i dati attuali";clearTimeout(rsArm);rsArm=setTimeout(()=>{delete a.dataset.arm;a.textContent="Sostituisci tutto"},5000);return}
    // copia di sicurezza obbligatoria: senza, non si sostituisce nulla
    if(!saveSafetyCopy()){$("bkMsg").className="msg err";$("bkMsg").textContent="Spazio insufficiente per la copia di sicurezza: esporta prima un backup, oppure usa Unisci.";return}
    const n=rsData.meals.length;applyRestore(replaceWith(state,lib,rsData),`Dati sostituiti: ${pl(n,"pasto","pasti")} dal backup. I dati di prima sono conservati: puoi riportarli con “Riporta i dati a prima del ripristino”.`);
  }
};
let undoArm=null;
function renderUndoRestore(){const c=safetyCopy(),b=$("undoRestore");b.classList.toggle("hide",!c);if(c&&!b.dataset.arm)b.textContent=`Riporta i dati a prima del ripristino (${fmtDay(c.ts)})`}
$("undoRestore").onclick=()=>{
  const b=$("undoRestore");
  if(!b.dataset.arm){b.dataset.arm="1";b.textContent="Tocca di nuovo per confermare";clearTimeout(undoArm);undoArm=setTimeout(()=>{delete b.dataset.arm;renderUndoRestore()},4000);return}
  delete b.dataset.arm;
  if(!restoreSafetyCopy()){$("bkMsg").className="msg err";$("bkMsg").textContent="Non sono riuscito a riportare i dati.";return}
  const l=lsGet();state=l&&l.meals?l:{meals:[],goal:null};lib=loadLib();
  render();renderLibPanels();renderUndoRestore();
  $("bkMsg").className="msg ok";$("bkMsg").textContent=`Dati riportati a prima del ripristino: ${pl(state.meals.length,"pasto","pasti")}.`;
};
// ---- Copia di sicurezza in IndexedDB: offerta di recupero e stato in Impostazioni → Dati
const hm=ts=>new Date(ts).toLocaleString("it-IT",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
function showSafetyOffer(c){
  $("safeTxt").textContent=`I dati di Carbo su questo telefono risultano vuoti, ma c'è una copia di sicurezza del ${hm(c.ts)} con ${pl(c.meals,"pasto","pasti")}. Vuoi recuperarla?`;
  $("safeBox").classList.remove("hide");
}
$("safeYes").onclick=async()=>{
  const c=await restoreSafety();
  if(!c){$("safeTxt").textContent="Non sono riuscito a recuperare la copia. Riprova o usa un backup.";return}
  setSafetyHold(false);$("safeBox").classList.add("hide");
  const l=lsGet();state=l&&l.meals?l:{meals:[],goal:null};lib=loadLib();
  render();renderLibPanels();toast(`Recuperati ${pl(state.meals.length,"pasto","pasti")} dalla copia di sicurezza`);
};
$("safeNo").onclick=()=>{
  const b=$("safeNo");
  if(!b.dataset.arm){b.dataset.arm="1";b.textContent="Tocca di nuovo: la copia verrà sostituita";setTimeout(()=>{if(b.isConnected){delete b.dataset.arm;b.textContent="Inizia da zero"}},5000);return}
  setSafetyHold(false);$("safeBox").classList.add("hide");
};
async function renderSafetyStatus(){
  const c=await readSafety(),m=$("idbMsg");if(!m)return;
  m.textContent=c?`Copia di sicurezza automatica sul telefono: ${hm(c.ts)}, ${pl(c.meals,"pasto","pasti")}. Serve se il telefono cancella i dati dell'app; non sostituisce il backup.`:"Copia di sicurezza automatica: non ancora disponibile su questo telefono.";
}
// ---- Altro: archiviazione persistente. Chiede al browser di non cancellare i dati quando manca spazio.
async function checkStorage(ask){
  const m=$("stMsg");if(!navigator.storage||!navigator.storage.persisted){m.textContent="";return}
  try{
    let p=await navigator.storage.persisted();
    if(!p&&ask&&navigator.storage.persist)p=await navigator.storage.persist();
    m.textContent=p?"Archiviazione protetta: il telefono non cancellerà i pasti per fare spazio.":"Archiviazione non protetta: su iPhone aggiungi Carbo alla schermata Home e fai backup regolari.";
  }catch(e){m.textContent=""}
}

// ---- Altro: pannelli Preferiti e Ricette
let panel="";
var prevPanel="";
function showPanel(p){
  panel=p||"";
  $("altroMain").classList.toggle("hide",!!panel);
  $("p-fav").classList.toggle("hide",panel!=="fav");
  $("p-rcp").classList.toggle("hide",panel!=="rcp");
  $("p-src").classList.toggle("hide",panel!=="src");
  $("p-info").classList.toggle("hide",panel!=="info");
  $("p-food").classList.toggle("hide",panel!=="food");
  renderLibPanels();if(panel==="food"){loadCatalog().then(renderFoodPanel)}window.scrollTo(0,0);
  // VoiceOver: il fuoco va al titolo del pannello aperto; tornando indietro, alla riga che l'aveva aperto
  if(view==="altro"&&p!==undefined){
    if(panel){const h=document.querySelector(`#p-${panel} h1`);if(h){h.tabIndex=-1;h.focus({preventScroll:true})}}
    else if(prevPanel){const b=document.querySelector(`#altroMain [data-panel="${prevPanel}"]`);if(b)b.focus({preventScroll:true})}
  }
  prevPanel=panel;
}

// ---- Correggi alimenti: correzioni sovrapposte ai cataloghi (lib.foodEdits). File e DB del motore invariati.
const FOOD_MAX=30;
const editOf=cid=>(lib.foodEdits||{})[cid]||null;
function foodRowHTML(f,open){
  const o=foodOrig(f.cid)||f,e=editOf(f.cid),u=f.u||"g",src=SRC_LABEL[srcOf(f.cid)]||"";
  const st=f.hidden?"nascosto":f.edited?"corretto":"";
  const units=(f.units||[]).slice(0,6);
  const urow=(x,k)=>`<div class="two urow"><label class="fld2"><span>Porzione</span><input data-fu="t" data-k="${k}" value="${esc(x.t)}" maxlength="40" placeholder="es. 1 fetta"></label><label class="fld2"><span>Peso (${u})</span><input data-fu="w" data-k="${k}" type="number" inputmode="decimal" min="0" max="2000" step="0.1" value="${x.w}"></label></div>`;
  return `<details class="lrow" data-cid="${esc(f.cid)}" ${open?"open":""}><summary><span class="ln"><b>${esc(f.n)}</b><small>${fmt(f.c100)} g/100 ${u} · ${src}${st?` · <span class="srct">${st}</span>`:""}</small></span>${I_CHEV}</summary>
  <div class="led">
    <label class="fld2"><span>Nome</span><input data-fe="n" value="${esc(f.n)}" maxlength="80"></label>
    <label class="fld2"><span>Carboidrati ogni 100 ${u}</span><input data-fe="c100" type="number" inputmode="decimal" min="0" max="100" step="0.1" value="${f.c100}"></label>
    <div data-units>${units.map(urow).join("")}</div>
    <button class="txt ink" type="button" data-fadd ${units.length>=6?"disabled":""}>Aggiungi porzione</button>
    ${e?`<p class="note fine">Originale (${src}): ${esc(o.n)} · ${fmt(o.c100)} g/100 ${u}${(o.units||[]).length?" · "+o.units.map(x=>`${esc(x.t)} ${fmt(x.w)} ${u}`).join(", "):""}</p>`:""}
    <p class="msg" data-fmsg role="status"></p>
    <div class="acts2"><button class="pri" type="button" data-fsave>Salva correzione</button><button class="sec-btn" type="button" data-fhide>${f.hidden?"Mostra di nuovo":"Nascondi"}</button></div>
    ${e?`<button class="txt danger" type="button" data-freset>Ripristina l'originale</button>`:""}
  </div></details>`;
}
function renderFoodPanel(){
  if(panel!=="food")return;
  const q=fold($("fq").value.trim()),only=$("fOnly").getAttribute("aria-pressed")==="true";
  const all=allFoods();
  let list=only?all.filter(f=>editOf(f.cid)):q?all.filter(f=>fold(f.n).includes(q)||fold((foodOrig(f.cid)||f).n).includes(q)||(f.a||[]).some(a=>fold(a).includes(q))):[];
  if(q&&only)list=list.filter(f=>fold(f.n).includes(q));
  list.sort((a,b)=>(fold(a.n).startsWith(q)?0:1)-(fold(b.n).startsWith(q)?0:1)||a.n.length-b.n.length);
  const op=new Set([...document.querySelectorAll("#foodList .lrow[open]")].map(d=>d.dataset.cid));
  $("foodList").innerHTML=!all.length?'<p class="empty">Elenchi non ancora caricati: riprova tra un attimo.</p>'
    :!q&&!only?`<p class="empty">Cerca tra ${all.length} alimenti degli elenchi.</p>`
    :list.length?`<div class="list">${list.slice(0,FOOD_MAX).map(f=>foodRowHTML(f,op.has(f.cid)||list.length===1)).join("")}</div>${list.length>FOOD_MAX?`<p class="empty">Altri ${list.length-FOOD_MAX}: scrivi qualcosa di più preciso.</p>`:""}`
    :`<p class="empty">${only?"Nessun alimento corretto o nascosto.":"Nessun alimento trovato negli elenchi."}</p>`;
}
function foodCountText(){const n=Object.keys(lib.foodEdits||{}).length;return n?String(n):""}
function saveFoodEdit(cid,e,msg){
  if(!lib.foodEdits)lib.foodEdits={};
  if(e)lib.foodEdits[cid]={...e,at:Date.now()};else delete lib.foodEdits[cid];
  if(!saveLib(lib)){toast(isReadOnly()?"Libreria creata da una versione più recente: modifiche non salvate":"Non sono riuscito a salvare la correzione.");lib=loadLib();setFoodEdits(lib.foodEdits);renderFoodPanel();return false}
  scheduleSafety();setFoodEdits(lib.foodEdits);$("foodCount").textContent=foodCountText();renderFoodPanel();renderSug();
  if(msg)toast(msg);return true;
}
$("fq").addEventListener("input",renderFoodPanel);
$("fOnly").onclick=()=>{const b=$("fOnly");b.setAttribute("aria-pressed",String(b.getAttribute("aria-pressed")!=="true"));renderFoodPanel()};
$("foodList").addEventListener("click",e=>{
  const row=e.target.closest(".lrow");if(!row)return;
  const cid=row.dataset.cid,f=foodByCid(cid),o=foodOrig(cid);if(!f||!o)return;
  const m=row.querySelector("[data-fmsg]"),err=t=>{m.className="msg err";m.textContent=t};
  if(e.target.closest("[data-fadd]")){
    const box=row.querySelector("[data-units]"),k=box.children.length;if(k>=6)return;
    box.insertAdjacentHTML("beforeend",`<div class="two urow"><label class="fld2"><span>Porzione</span><input data-fu="t" data-k="${k}" maxlength="40" placeholder="es. 1 fetta"></label><label class="fld2"><span>Peso (${f.u||"g"})</span><input data-fu="w" data-k="${k}" type="number" inputmode="decimal" min="0" max="2000" step="0.1"></label></div>`);
    box.lastElementChild.querySelector("input").focus();return;
  }
  if(e.target.closest("[data-fsave]")){
    const n=row.querySelector('[data-fe="n"]').value.trim(),cs=row.querySelector('[data-fe="c100"]').value.trim().replace(",",".");
    const c=+cs;
    if(!n)return err("Il nome non può essere vuoto.");
    if(cs===""||!(c>=0&&c<=100))return err("Carboidrati: un numero tra 0 e 100 (grammi ogni 100).");
    const units=[];
    for(const r of row.querySelectorAll(".urow")){
      const t=r.querySelector('[data-fu="t"]').value.trim(),ws=r.querySelector('[data-fu="w"]').value.trim().replace(",","."),w=+ws;
      if(!t&&!ws)continue;
      if(!t)return err("Ogni porzione ha bisogno di un nome (es. “1 fetta”).");
      if(!(w>0&&w<=2000))return err(`Peso della porzione “${t}”: tra 1 e 2000.`);
      if(!units.some(x=>x.t.toLowerCase()===t.toLowerCase()&&x.w===w))units.push({t,w});
    }
    const prev=editOf(cid)||{};
    const same=(a,b)=>JSON.stringify((a||[]).map(x=>[x.t,+x.w]))===JSON.stringify((b||[]).map(x=>[x.t,+x.w]));
    const ed={...(n!==o.n?{n}:{}),...(Math.abs(c-o.c100)>1e-9?{c100:c}:{}),...(!same(units,o.units)?{units}:{}),...(prev.hidden?{hidden:true}:{})};
    const clean=cleanFoodEdit(ed);
    saveFoodEdit(cid,clean,clean?`Correzione salvata · ${n}`:`Nessuna differenza dall'originale · ${o.n}`);
    return;
  }
  if(e.target.closest("[data-fhide]")){
    const prev={...(editOf(cid)||{})};delete prev.at;
    if(f.hidden){delete prev.hidden}else prev.hidden=true;
    saveFoodEdit(cid,cleanFoodEdit(prev),f.hidden?`Di nuovo nella ricerca · ${f.n}`:`Nascosto dalla ricerca · ${f.n}`);
    return;
  }
  const rs=e.target.closest("[data-freset]");
  if(rs){
    if(!rs.dataset.arm){rs.dataset.arm="1";rs.textContent="Tocca di nuovo per ripristinare";setTimeout(()=>{if(rs.isConnected){delete rs.dataset.arm;rs.textContent="Ripristina l'originale"}},4000);return}
    saveFoodEdit(cid,null,`Ripristinato l'originale · ${o.n}`);
    return;
  }
});
const favSum=f=>[f.g>0?`${qty(f.g,f.u,f.pz)} abituali`:"quantità non impostata",`${fmt(f.c100)} g/100 ${f.u}`].join(" · ");
const rcpSum=r=>{const s=recipeStats(r);return `${s.servings} ${s.servings===1?"porzione":"porzioni"} · ${Math.round(s.servCho)} g CHO a porzione`};
const totLine=r=>{const s=recipeStats(r);return `Totale ${Math.round(s.w)} g · ${fmt(s.cho)} g CHO. Porzione ${Math.round(s.servW)} g · ${fmt(s.servCho)} g CHO.`};
const openIds=()=>new Set([...document.querySelectorAll(".lrow[open]")].map(d=>d.dataset.id));
function favHTML(f,open){
  return `<details class="lrow" data-id="${f.id}" ${open?"open":""}><summary><span class="ln"><b data-name>${esc(f.n)}</b><small data-sum>${favSum(f)}</small></span>${I_CHEV}</summary>
  <div class="led">
    <label class="fld2"><span>Nome</span><input data-ff="n" value="${esc(f.n)}" maxlength="80"></label>
    <div class="two"><label class="fld2"><span>CHO ogni 100 ${f.u}</span><input data-ff="c100" type="number" inputmode="decimal" min="0" step="0.1" value="${f.c100}"></label>
    <label class="fld2"><span>Quantità abituale (${f.u})</span><input data-ff="g" type="number" inputmode="decimal" min="0" value="${f.g||""}"></label></div>
    <button class="txt danger" type="button" data-favdel>Elimina dai preferiti</button>
  </div></details>`;
}
function rcpHTML(r,open){
  const s=recipeStats(r);
  return `<details class="lrow" data-id="${r.id}" ${open?"open":""}><summary>${r.photo?`<img class="thumb" src="${r.photo}" alt="">`:""}<span class="ln"><b data-name>${esc(r.n)}</b><small data-sum>${rcpSum(r)}</small></span>${I_CHEV}</summary>
  <div class="led">
    <div class="two"><label class="fld2"><span>Nome</span><input data-rf="n" value="${esc(r.n)}" maxlength="80"></label>
    <label class="fld2"><span>Porzioni</span><input data-rf="servings" type="number" inputmode="numeric" min="1" value="${s.servings}"></label></div>
    <div class="ings"><div class="ing ih" aria-hidden="true"><span>Ingrediente</span><span>Quantità</span><span>CHO/100</span><span></span></div>
    ${r.ingredients.map((i,k)=>`<div class="ing"><input data-if="n" data-k="${k}" value="${esc(i.n)}" aria-label="Nome ingrediente ${k+1}"><label class="u"><input data-if="g" data-k="${k}" type="number" inputmode="decimal" min="0" value="${i.g}" aria-label="Quantità di ${esc(i.n)}"><span>${i.u}</span></label><input data-if="c100" data-k="${k}" type="number" inputmode="decimal" min="0" step="0.1" value="${i.c100}" aria-label="Carboidrati ogni 100 di ${esc(i.n)}"><button class="ibtn" type="button" data-ingdel="${k}" aria-label="Rimuovi ${esc(i.n)}">${I_X}</button></div>`).join("")}</div>
    <p class="rt" data-tot>${totLine(r)}</p>
    <div class="racts">
      <button class="pri" type="button" data-ruse>Aggiungi una porzione al piatto</button>
      ${cur.some(i=>!i.rid&&i.g>0)?'<button class="txt ink" type="button" data-rappend>Aggiungi gli ingredienti del piatto in corso</button>':""}
      <label class="txt ink">${r.photo?"Cambia foto":"Aggiungi foto"}<input type="file" accept="image/*" class="sr" data-rphoto></label>
      ${r.photo?'<button class="txt" type="button" data-rphotodel>Togli foto</button>':""}
      <button class="txt danger" type="button" data-rdel>Elimina ricetta</button>
    </div>
  </div></details>`;
}
function renderLibPanels(){
  setFoodEdits(lib.foodEdits);$("foodCount").textContent=foodCountText();renderSafetyStatus();
  $("favCount").textContent=lib.favorites.length||"";
  $("rcpCount").textContent=lib.recipes.length||"";
  const op=openIds();
  if(panel==="fav")$("favList").innerHTML=lib.favorites.length?`<div class="list">${lib.favorites.map(f=>favHTML(f,op.has(f.id))).join("")}</div>`:'<p class="empty">Nessun preferito. Nel piatto, tocca la stella accanto a un alimento.</p>';
  if(panel==="rcp")$("rcpList").innerHTML=lib.recipes.length?`<div class="list">${lib.recipes.map(r=>rcpHTML(r,op.has(r.id))).join("")}</div>`:'<p class="empty">Nessuna ricetta salvata.</p>';
}
const favOf=el=>{const d=el.closest(".lrow");return d&&lib.favorites.find(f=>f.id===d.dataset.id)};
const rcpOf=el=>{const d=el.closest(".lrow");return d&&lib.recipes.find(r=>r.id===d.dataset.id)};
$("favList").addEventListener("change",e=>{
  const f=favOf(e.target),k=e.target.dataset.ff;if(!f||!k)return;
  const v=e.target.value;
  if(k==="n")f.n=v.trim().slice(0,80)||f.n;
  if(k==="c100"){const c=Math.max(0,+v||0);if(c!==f.c100)delete f.ref;f.c100=c}
  if(k==="g")f.g=Math.max(0,+v||0);
  persistLib();
  const d=e.target.closest(".lrow");d.querySelector("[data-sum]").textContent=favSum(f);d.querySelector("[data-name]").textContent=f.n;
});
$("favList").addEventListener("click",e=>{
  if(!e.target.closest("[data-favdel]"))return;
  const f=favOf(e.target);if(!f)return;
  const r=removeFav(lib,f.id);persistLib();renderLibPanels();renderSug();
  toast(`Tolto dai preferiti · ${f.n}`,()=>{lib.favorites.splice(r.index,0,r.item);persistLib();renderLibPanels();renderSug()});
});
function touchRecipe(r,el){
  r.updated=Date.now();persistLib();
  const d=el.closest(".lrow");
  d.querySelector("[data-sum]").textContent=rcpSum(r);d.querySelector("[data-tot]").textContent=totLine(r);d.querySelector("[data-name]").textContent=r.n;
}
$("rcpList").addEventListener("change",async e=>{
  const r=rcpOf(e.target);if(!r)return;const t=e.target;
  if(t.dataset.rf==="n")r.n=t.value.trim().slice(0,80)||r.n;
  else if(t.dataset.rf==="servings"){r.servings=Math.max(1,Math.round(+t.value||1));t.value=r.servings}
  else if(t.dataset.if){
    const i=r.ingredients[+t.dataset.k];if(!i)return;
    if(t.dataset.if==="n")i.n=t.value.trim().slice(0,80)||i.n;
    else{const v=Math.max(0,+t.value||0);if(t.dataset.if==="c100"&&v!==i.c100)delete i.ref;i[t.dataset.if]=v}
  }
  else if(t.matches("[data-rphoto]")){
    const file=t.files[0];if(!file)return;
    const prev=r.photo;
    try{r.photo=await thumb(file)}catch(x){toast("Non riesco a leggere questa foto");return}
    if(!saveLib(lib)){r.photo=prev;toast("Spazio esaurito: foto non salvata");return}
    renderLibPanels();return;
  }
  else return;
  touchRecipe(r,t);
});
$("rcpList").addEventListener("click",e=>{
  const r=rcpOf(e.target);if(!r)return;
  const del=e.target.closest("[data-ingdel]");
  if(del){
    if(r.ingredients.length<=1){toast("Una ricetta deve avere almeno un ingrediente");return}
    r.ingredients.splice(+del.dataset.ingdel,1);r.updated=Date.now();persistLib();renderLibPanels();return;
  }
  if(e.target.closest("[data-ruse]")){cur.push(recipePlateItem(r,1));renderCur();openSheet();toast(`Aggiunto: ${r.n} (1 porzione)`);return}
  if(e.target.closest("[data-rappend]")){
    const add=cur.filter(i=>!i.rid&&i.g>0).map(i=>({...snapFood(i),g:Math.round(i.g*100)/100}));
    r.ingredients.push(...add);r.updated=Date.now();persistLib();renderLibPanels();
    toast(`${add.length} ${add.length===1?"ingrediente aggiunto":"ingredienti aggiunti"} a ${r.n}`);return;
  }
  if(e.target.closest("[data-rphotodel]")){delete r.photo;persistLib();renderLibPanels();return}
  if(e.target.closest("[data-rdel]")){
    const k=lib.recipes.indexOf(r);lib.recipes.splice(k,1);persistLib();renderLibPanels();renderSug();
    toast(`Ricetta eliminata · ${r.n}`,()=>{lib.recipes.splice(k,0,r);persistLib();renderLibPanels();renderSug()});
  }
});
$("newRecipe").onclick=()=>{
  openSheet();
  if(cur.length)$("asRecipe").click();
  else toast("Componi il piatto con gli ingredienti, poi “Salva come ricetta”");
};
// miniatura della ricetta: piccola, per stare comodamente in localStorage
async function thumb(file){
  let bmp;
  try{bmp=await createImageBitmap(file)}
  catch(e){bmp=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=URL.createObjectURL(file)})}
  const w=bmp.width||bmp.naturalWidth,h=bmp.height||bmp.naturalHeight,s=Math.min(1,240/Math.max(w,h));
  const c=document.createElement("canvas");c.width=Math.round(w*s);c.height=Math.round(h*s);
  c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);
  return c.toDataURL("image/jpeg",.7);
}

// ---- codice a barre
let scan=null,scanToken=0,prodCur=null;
const setScanStatus=t=>{$("scanStatus").textContent=t||""};
function stopCam(){scanToken++;if(scan){scan.stop();scan=null}}
async function startCam(){
  stopCam();const tk=scanToken;
  $("vf").classList.remove("off");setScanStatus("Avvio la fotocamera…");
  try{
    const s=await startScanner($("scanVideo"),{
      onStatus:t=>{if(tk===scanToken)setScanStatus(t)},
      onCode:code=>{if(tk!==scanToken)return;scan=null;if(navigator.vibrate)navigator.vibrate(30);$("vf").classList.add("off");findProduct(code)}
    });
    if(tk!==scanToken){s.stop();return} // scanner chiuso mentre la fotocamera partiva
    scan=s;
  }catch(e){if(tk!==scanToken)return;$("vf").classList.add("off");setScanStatus(e.message||"Fotocamera non disponibile.")}
}
// Lo scanner copre il pannello: il resto diventa inerte e il fuoco torna al pulsante all'uscita.
function scanBehind(){return[$("sheetH"),$("sheetB"),document.querySelector(".sheet-f")]}
function openScanner(){
  $("scanner").classList.remove("hide");$("prod").innerHTML="";$("codeIn").value="";
  scanBehind().forEach(e=>e&&(e.inert=true));
  const sh=document.querySelector("#scanner h3");sh.tabIndex=-1;sh.focus({preventScroll:true});
  startCam();
}
function closeScanner(){
  stopCam();const was=!$("scanner").classList.contains("hide");
  $("scanner").classList.add("hide");scanBehind().forEach(e=>e&&(e.inert=false));
  if(was&&sheetOpen)$("scanBtn").focus({preventScroll:true});
}
function scannerOpen(){return!$("scanner").classList.contains("hide")}
$("scanBtn").onclick=openScanner;
$("scanBack").onclick=closeScanner;
document.addEventListener("visibilitychange",()=>{
  if(document.hidden)stopCam();
  else if(!$("scanner").classList.contains("hide")&&!$("prod").innerHTML)startCam();
});
$("codeForm").onsubmit=e=>{
  e.preventDefault();
  const c=cleanCode($("codeIn").value);
  if(!isValidCode(c)){setScanStatus("Codice non valido: controlla le cifre (8, 12 o 13).");$("vf").classList.add("off");return}
  stopCam();$("vf").classList.add("off");findProduct(normalizeCode(c));
};
async function findProduct(code){
  $("codeIn").value=code;setScanStatus("");
  $("prod").innerHTML=`<p class="msg">Cerco il prodotto ${esc(code)}…</p>`;
  const blank={ean:code,n:"",brand:"",c100:null,u:"g"};
  try{const r=await lookupProduct(lib,code);showProduct(r.product||blank,r.product?r.from:"missing")}
  catch(e){showProduct(blank,"error",e.message)}
}
function showProduct(p,from,err){
  const pz=p.u==="g"?cleanPz(p.pz):null;
  prodCur={...p,pz,from,orig:{n:p.n,c100:p.c100,w:pz?pz.w:null},byPz:p.u==="g"};
  const src={off:"Trovato su Open Food Facts",local:"Salvato su questo telefono",missing:"Prodotto non trovato: inserisci i valori dall'etichetta. Lo ricorderò per la prossima volta."}[from]||err;
  const warn=from==="missing"||from==="error";
  $("prod").innerHTML=`<div class="pcard">
    <p class="psrc${warn?" warn":""}">${esc(src)}</p>
    ${p.c100==null&&from==="off"?`<p class="psrc warn">Carboidrati mancanti nel database: leggili sull'etichetta.</p>`:""}
    <label class="fld2"><span>Nome</span><input id="pN" value="${esc(p.n)}" maxlength="80" placeholder="Es. Fette biscottate integrali"></label>
    <p class="pbrand">${p.brand?esc(p.brand)+" · ":""}EAN ${esc(p.ean)}</p>
    ${p.u==="g"?`<div class="two"><label class="fld2"><span>CHO ogni 100 g</span><input id="pC" type="number" inputmode="decimal" min="0" max="100" step="0.1" value="${p.c100??""}"></label>
    <label class="fld2"><span>1 ${pz?pz.l:"pezzo"} pesa (g)</span><input id="pW" type="number" inputmode="decimal" min="0" step="0.1" value="${pz?pz.w:""}" placeholder="dall'etichetta"></label></div>
    <p class="phint" id="pWh">${pz?(from==="local"?"Peso salvato su questo telefono.":"Peso dalla confezione su Open Food Facts: controllalo sull'etichetta."):"Sull'etichetta di solito c'è scritto, per esempio: “1 merendina = 35 g” o “10 x 30 g”. Lo ricorderò."}</p>
    <div class="pq"><div class="seg sm" role="group" aria-label="Quantità in">
      <button type="button" data-pm="pz" aria-pressed="true">${pz&&pz.l==="porzione"?"Porzioni":"Pezzi"}</button><button type="button" data-pm="g" aria-pressed="false">Grammi</button></div>
      <div class="stp pstp"><button type="button" data-pq="-1" aria-label="Uno in meno">${I_MIN}</button><input id="pG" type="number" inputmode="decimal" min="0" step="0.5" value="1" aria-label="Quantità"><span class="gu" id="pGu"></span><button type="button" data-pq="1" aria-label="Uno in più">${I_PLUS}</button></div></div>`
    :`<div class="two"><label class="fld2"><span>CHO ogni 100 ${p.u}</span><input id="pC" type="number" inputmode="decimal" min="0" max="100" step="0.1" value="${p.c100??""}"></label>
    <label class="fld2"><span>Quantità (${p.u})</span><input id="pG" type="number" inputmode="decimal" min="0" placeholder="${p.serving?"Porzione "+Math.round(p.serving):""}"></label></div>`}
    <p class="ptot" id="pT"></p><p class="msg err" id="pE"></p>
    <div class="rbtn"><button class="txt" type="button" id="pAgain">Scansiona un altro</button><button class="pri" type="button" id="pAdd">Aggiungi al piatto</button></div>
  </div>`;
  updProd();
}
// Quantità della scheda prodotto in grammi (o ml), qualunque sia la modalità scelta.
function prodGrams(){
  const q=+$("pG").value||0;
  if(!$("pW")||!prodCur.byPz)return q;
  const w=+$("pW").value||0;return w>0?q*w:0;
}
function prodLabelPz(){return prodCur.pz&&prodCur.pz.l==="porzione"?"porzione":"pezzo"}
function updProd(){
  const cs=$("pC").value,c=+cs,g=prodGrams(),pw=$("pW");
  let t="";
  if(pw){
    const w=+pw.value||0,l=prodLabelPz(),q=+$("pG").value||0;
    $("pGu").textContent=prodCur.byPz?pzPlural(l,q===1?1:2):"g";
    const per=w>0&&cs!==""?`1 ${l} = ${fmt(w*c/100)} g di carboidrati`:"";
    if(prodCur.byPz&&!(w>0))t="Inserisci quanto pesa 1 "+l+", oppure passa a Grammi.";
    else if(cs!==""&&g>0)t=`${prodCur.byPz?`${fmt(q)} ${pzPlural(l,q)} · ${fmt(g)} g → `:""}${fmt(g*c/100)} g di carboidrati`;
    $("pT").innerHTML=esc(t)+(per&&(!prodCur.byPz||q!==1)?`<small>${esc(per)}</small>`:"");
    return;
  }
  $("pT").textContent=cs!==""&&g>0?`${fmt(g*c/100)} g di carboidrati`:"";
}
$("prod").addEventListener("input",updProd);
$("prod").addEventListener("click",e=>{
  if(e.target.closest("#pAgain")){$("prod").innerHTML="";$("codeIn").value="";startCam();return}
  const pm=e.target.closest("[data-pm]");
  if(pm&&prodCur){
    const toPz=pm.dataset.pm==="pz";if(toPz===prodCur.byPz)return;
    const w=+$("pW").value||0,q=+$("pG").value||0;
    // conserva la quantità quando si cambia modalità
    $("pG").value=q>0&&w>0?(toPz?r1(q/w):r1(q*w)):(toPz?1:"");
    $("pG").step=toPz?"0.5":"1";
    prodCur.byPz=toPz;
    document.querySelectorAll("#prod [data-pm]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.pm===pm.dataset.pm)));
    updProd();return;
  }
  const pq=e.target.closest("[data-pq]");
  if(pq&&prodCur){const d=+pq.dataset.pq*(prodCur.byPz?1:10),v=Math.max(0,(+$("pG").value||0)+d);$("pG").value=prodCur.byPz?v:Math.round(v);updProd();return}
  if(!e.target.closest("#pAdd")||!prodCur)return;
  const n=$("pN").value.trim(),cs=$("pC").value,c=+cs,g=r1(prodGrams());
  const wIn=$("pW")?+$("pW").value||0:0,pz=wIn>0?cleanPz({w:wIn,l:prodLabelPz()}):null;
  if(!n){$("pE").textContent="Inserisci il nome del prodotto.";$("pN").focus();return}
  if(cs===""||!(c>=0&&c<=100)){$("pE").textContent="Inserisci i carboidrati ogni 100 (tra 0 e 100).";$("pC").focus();return}
  if($("pW")&&$("pW").value!==""&&!pz){$("pE").textContent="Il peso di 1 "+prodLabelPz()+" deve essere tra 0,1 e 1000 g.";$("pW").focus();return}
  if(prodCur.byPz&&$("pW")&&!pz){$("pE").textContent="Inserisci quanto pesa 1 "+prodLabelPz()+", oppure passa a Grammi.";$("pW").focus();return}
  const edited=n!==prodCur.orig.n||c!==prodCur.orig.c100||(pz?pz.w:null)!==prodCur.orig.w;
  rememberProduct(lib,{...prodCur,n,c100:c,pz},edited);persistLib();
  const it={n:productLabel({n,brand:prodCur.brand}),g:0,u:prodCur.u,c100:c,ask:[],cand:[],ean:prodCur.ean};
  if(pz){it.pz=pz;if(!prodCur.byPz)it.pzG=true}
  if(g>0)it.g=g;else it.ask.push({k:"weight",t:"Inserisci la quantità",b:1});
  relevel(it);closeScanner();
  addToPlate(it,pz&&prodCur.byPz&&g>0?`${it.n} · ${qty(g,"g",pz)}`:null);
});

// ---- promemoria
let rem=loadRem();
function renderRem(){
  for(const t of REM_TYPES){
    document.querySelector(`[data-rt="${t}"]`).value=rem.meals[t].t;
    document.querySelector(`[data-ro="${t}"]`).checked=rem.meals[t].on;
  }
  $("remNudge").checked=rem.nudge;
}
$("remList").addEventListener("change",e=>{
  const t=e.target;
  if(t.dataset.rt){if(t.value)rem.meals[t.dataset.rt].t=t.value}
  else if(t.dataset.ro)rem.meals[t.dataset.ro].on=t.checked;
  else if(t.id==="remNudge")rem.nudge=t.checked;
  else return;
  saveRem(rem);renderNudge();
});
$("remIcs").onclick=async()=>{
  const {text,count}=buildICS(rem,location.href.split("#")[0]);
  if(!count){$("remMsg").textContent="Attiva almeno un promemoria qui sopra, poi aggiungilo al Calendario.";return}
  const how=await saveFile(new Blob([text],{type:"text/calendar"}),"carbo-promemoria.ics","Promemoria Carbo");
  if(how!=="cancel")toast(`${count} ${count===1?"promemoria pronto":"promemoria pronti"}: aprili con il Calendario`);
};
function renderNudge(){
  const t=dueReminder(rem,state.meals);
  $("nudge").classList.toggle("hide",!t);
  if(t){$("nudgeT").textContent=`${t} · vuoi aggiungere il pasto?`;$("nudge").dataset.type=t}
}
$("nudgeAdd").onclick=()=>openSheet($("nudge").dataset.type);
$("nudgeX").onclick=()=>{snooze($("nudge").dataset.type);renderNudge()};
setInterval(()=>{if(!document.hidden)renderNudge()},60000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)render()});

// ---- Altro: tema
const getTheme=()=>{try{return localStorage.getItem("carbo_theme")||"system"}catch(e){return "system"}};
function applyTheme(t){
  const r=document.documentElement;
  if(t==="light"||t==="dark")r.dataset.theme=t;else delete r.dataset.theme;
  const dark=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll("meta[name=theme-color]").forEach(m=>{m.content=t==="system"?(m.media.includes("dark")?"#181614":"#F5F0E8"):(dark?"#181614":"#F5F0E8")});
}
$("theme").onchange=e=>{const t=e.target.value;try{localStorage.setItem("carbo_theme",t)}catch(x){}applyTheme(t)};

// ---- avvio
$("mdl").value=getMode();$("mdl").onchange=e=>{try{localStorage.setItem("carbo_mode",e.target.value)}catch(x){}};
$("prov").value=getProv();$("key").value=getKey();
$("prov").onchange=e=>{try{localStorage.setItem("carbo_prov",e.target.value)}catch(x){}$("key").value=getKey()};
$("key").onchange=e=>{try{localStorage.setItem("carbo_key_"+getProv(),e.target.value.trim())}catch(x){}$("keymsg").className="msg ok";$("keymsg").textContent="Chiave salvata su questo telefono.";checkKey()};
$("ver").textContent=APP_VERSION;
{const t=getTheme(),r=document.querySelector('input[name=theme][value="'+t+'"]');if(r)r.checked=true;applyTheme(t)}
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
// niente zoom nell'app: Safari iOS ignora user-scalable=no, quindi si blocca il gesto di pinch (il doppio tocco è gestito da touch-action nel CSS)
["gesturestart","gesturechange"].forEach(t=>document.addEventListener(t,e=>e.preventDefault(),{passive:false}));
document.addEventListener("touchmove",e=>{if(e.touches.length>1)e.preventDefault()},{passive:false});
// copia di sicurezza (IndexedDB): se Safari ha svuotato localStorage, propone di recuperare; altrimenti aggiorna la copia
const _cleared=storageLooksCleared();
if(_cleared){setSafetyHold(true);readSafety().then(c=>{if(c&&(c.meals>0||c.carbo_lib))showSafetyOffer(c);else setSafetyHold(false)})}
else setTimeout(saveSafety,3000);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")saveSafety()});
const _l=lsGet();if(_l&&_l.meals)state=_l;
setType(defaultType());
showLastBackup();renderUndoRestore();checkStorage(false);
renderRem();
render();renderCur();checkKey();renderLibPanels();
// catalogo esterno in background: la ricerca lo usa appena è pronto
loadPortions().then(()=>{if(sheetOpen)renderSug();if(cur.length)renderCur()});
loadCatalog().then(()=>{if(sheetOpen)renderSug();cur.forEach(i=>{if(i.cid&&!i.units){const u=unitsFor(i);if(u)i.units=u}});if(cur.length)renderCur()});
// Un'altra scheda o finestra di Carbo ha salvato: rileggo i dati invece di sovrascriverli al prossimo salvataggio.
// Il piatto in corso (non ancora salvato) resta com'è.
window.addEventListener("storage",e=>{
  const meals=e.key==="carbo"||e.key===null,lb=e.key==="carbo_lib"||e.key===null;
  if(meals){const l=lsGet();state=l&&l.meals?l:{meals:[],goal:null};if(editId&&!state.meals.some(m=>m.id===editId))editId=null;render()}
  if(lb){lib=loadLib();setFoodEdits(lib.foodEdits);renderLibPanels();if(sheetOpen)renderSug()}
  if(meals||lb)toast("Dati aggiornati da un'altra finestra di Carbo");
});

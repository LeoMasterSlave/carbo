// "Descrivi il piatto": stima da una breve descrizione testuale, senza foto.
// Modulo separato: ai.js (prompt, modelli e chiamate delle foto) resta invariato.
// Usa la stessa chiave, gli stessi modelli e la stessa conversione (fromAI) delle foto.
import{MODELS,getProv,getKey,getMode,httpErr}from"./ai.js";
import{fromAI}from"./fooddb.js";

function unreadable(){const e=new Error("L'AI non ha dato una risposta leggibile.");e.retry=true;return e}
async function askText(prov,model,key,prompt,ctl){
  const to=setTimeout(()=>ctl.abort(),25000);
  try{
    let res;
    if(prov==="gemini"){
      res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:"POST",signal:ctl.signal,headers:{"content-type":"application/json","x-goog-api-key":key},
        body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",maxOutputTokens:1500,...(model==="gemini-2.5-flash"?{thinkingConfig:{thinkingBudget:0}}:{})}})});
    }else{
      res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",signal:ctl.signal,headers:{"content-type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model,max_tokens:1000,messages:[{role:"user",content:prompt}]})});
    }
    const j=await res.json().catch(()=>({}));
    if(!res.ok)throw httpErr(res.status,j);
    const txt=prov==="gemini"?((j.candidates||[])[0]?.content?.parts||[]).map(c=>c.text||"").join(""):(j.content||[]).map(c=>c.text||"").join("");
    const m=txt.match(/\{[\s\S]*\}/);if(!m)throw unreadable();
    try{return JSON.parse(m[0])}catch(_){throw unreadable()}
  }catch(err){
    if(err.name==="AbortError"){const e=new Error("L'AI sta impiegando troppo tempo.");e.retry=true;throw e}
    if(err instanceof TypeError){const e=new Error("Nessuna connessione a internet.");e.retry=false;throw e}
    throw err;
  }finally{clearTimeout(to)}
}

function buildPrompt(text){
  return `Sei un dietologo esperto di cucina italiana. L'utente descrive a parole quello che mangia, senza foto. Per ogni alimento distinto indica nome, quantità e carboidrati disponibili per 100 g (per 100 ml se liquido).
REGOLE:
1) Non inventare alimenti che l'utente non ha nominato. Se non riconosci con sicurezza un alimento, usa "confidenza_alimento":"bassa" e scrivi una domanda breve in "domanda".
2) Quantità: se l'utente indica un peso, un numero di pezzi o una misura (piccolo, medio, grande, mezzo, doppio) usala. Se non indica nulla usa una porzione media tipica italiana e metti "confidenza_peso":"bassa". "grammi" è il peso così come si mangia (cotto, condito). Per i liquidi usa i millilitri e "unita":"ml"; per tutto il resto "unita":"g".
3) Pasta e riso: se l'utente scrive un peso crudo (es. “80 g di pasta cruda”) usa quel peso e scrivi “cruda”/“crudo” nel nome, con i carboidrati del crudo (pasta cruda 72, riso crudo 80); altrimenti il peso è quello cotto (pasta cotta 31, riso cotto 28).
4) Piatti composti (panino, kebab, piadina, pizza, toast): un solo elemento con il nome completo e il peso complessivo. Non scomporre.
5) Usa il nome più semplice e comune dell'alimento.
Descrizione dell'utente: "${text}"
Rispondi SOLO con JSON: {"items":[{"nome":"...","grammi":numero|null,"unita":"g|ml","cho_per_100g":numero,"confidenza_alimento":"alta|media|bassa","confidenza_peso":"alta|media|bassa","domanda":"opzionale"}]}. Se la descrizione non contiene cibo, items vuoto.`;
}

// Stessa strategia delle foto: se un modello è lento (5 s) o occupato, parte il successivo.
function callText(text,stage){
  const prov=getProv(),key=getKey(),models=MODELS[prov][getMode()],prompt=buildPrompt(text);
  return new Promise((resolve,reject)=>{
    let next=0,active=0,done=false,last=null,timer=null;const ctls=[];
    const finish=(fn,v)=>{done=true;clearTimeout(timer);ctls.forEach(c=>c.abort());fn(v)};
    const launch=()=>{
      if(done||next>=models.length)return;
      const i=next++,ctl=new AbortController();ctls.push(ctl);active++;
      stage(i===0?"Stimo i carboidrati…":"Servizio lento o occupato, provo un altro modello…");
      askText(prov,models[i],key,prompt,ctl)
        .then(v=>{if(!done)finish(resolve,{out:v,model:models[i]})})
        .catch(err=>{
          active--;last=err;if(done)return;
          if(!err.retry)return finish(reject,err);
          if(next<models.length){launch()}
          else if(active===0){if(last.status!==429)last.message="Il servizio AI è sovraccarico: ho provato "+models.length+" modelli. Riprova tra qualche minuto o aggiungi a mano.";finish(reject,last)}
        });
      clearTimeout(timer);
      if(next<models.length)timer=setTimeout(launch,5000);
    };
    launch();
  });
}

async function describeMeal(text,stage){
  const t=String(text||"").trim().slice(0,200);
  if(!t)return{items:[],model:null};
  const {out,model}=await callText(t,stage);
  const raw=((out&&out.items)||[]).filter(i=>i&&i.nome);
  return{items:raw.map(fromAI).map(i=>{i.ask=i.ask.map(a=>a.k==="weight"&&/foto/.test(a.t)?{...a,t:"Quantità non indicata: ho usato una porzione media"}:a);return i}),model};
}

export{describeMeal};

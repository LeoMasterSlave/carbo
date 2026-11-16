// Motore AI: foto -> stima. Codice spostato senza modifiche da index.html v1
// (righe 378-379, 491-495, 497, 502-573). Non modificare prompt, modelli o chiamate.
import{fromAI}from"./fooddb.js";
const getProv=()=>{try{return localStorage.getItem("carbo_prov")||"gemini"}catch(e){return "gemini"}};
const getKey=()=>{try{return localStorage.getItem("carbo_key_"+getProv())||""}catch(e){return ""}};
const MODELS={
  gemini:{fast:["gemini-2.5-flash-lite","gemini-flash-lite-latest","gemini-2.5-flash"],accurate:["gemini-2.5-flash","gemini-flash-latest","gemini-2.5-flash-lite"]},
  anthropic:{fast:["claude-haiku-5-5","claude-sonnet-5-5"],accurate:["claude-sonnet-5-5","claude-haiku-5-5"]}
};
const getMode=()=>{try{return localStorage.getItem("carbo_mode")||"fast"}catch(e){return "fast"}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function shrink(file){
  let bmp;
  try{bmp=await createImageBitmap(file)}
  catch(e){bmp=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=URL.createObjectURL(file)})}
  const w=bmp.width||bmp.naturalWidth,h=bmp.height||bmp.naturalHeight,s=Math.min(1,960/Math.max(w,h));
  const c=document.createElement("canvas");c.width=Math.round(w*s);c.height=Math.round(h*s);
  c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);
  return new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error("toBlob")),"image/jpeg",.82));
}
function httpErr(status,body){
  const raw=(body&&body.error&&(body.error.message||body.error.type))||"";
  const e=new Error();e.status=status;
  if((status===400&&/api key|API_KEY/i.test(raw))||status===401||status===403){e.message="Chiave non valida o senza permessi. Controllala in Impostazioni.";e.retry=false}
  else if(status===429){e.message="Limite di richieste raggiunto (piano gratuito). Riprova tra un minuto.";e.retry=true}
  else if(status===404||status>=500||status===529){e.message="Il servizio AI è molto richiesto in questo momento.";e.retry=true}
  else{e.message="L'AI ha rifiutato la richiesta"+(raw?": "+raw.slice(0,120):"")+".";e.retry=false}
  return e;
}
function unreadable(){const e=new Error("L'AI non ha dato una risposta leggibile.");e.retry=true;return e}
async function askModel(prov,model,key,b64,prompt,ctl){
  const to=setTimeout(()=>ctl.abort(),25000);
  try{
    let res;
    if(prov==="gemini"){
      res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:"POST",signal:ctl.signal,headers:{"content-type":"application/json","x-goog-api-key":key},
        body:JSON.stringify({contents:[{parts:[{inline_data:{mime_type:"image/jpeg",data:b64}},{text:prompt}]}],generationConfig:{responseMimeType:"application/json",maxOutputTokens:1500,...(model==="gemini-2.5-flash"?{thinkingConfig:{thinkingBudget:0}}:{})}})});
    }else{
      res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",signal:ctl.signal,headers:{"content-type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model,max_tokens:1000,messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:"image/jpeg",data:b64}},{type:"text",text:prompt}]}]})});
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
function callAI(b64,hint,stage){
  const prov=getProv(),key=getKey(),models=MODELS[prov][getMode()];
  const prompt=`Sei un dietologo esperto di cucina italiana. Analizza la foto del pasto. Per ogni alimento distinto indica nome, quantità e carboidrati disponibili per 100 g (per 100 ml se liquido).
REGOLE:
1) Non inventare ingredienti né pesi. Se non vedi o non riconosci con sicurezza un alimento, o non riesci a stimarne la quantità, dillo: usa confidenza "bassa" e, se utile, scrivi una domanda breve per l'utente in "domanda". Se il peso non è stimabile metti "grammi": null.
2) Quantità: "grammi" è il peso della porzione così com'è nel piatto (cotta, condita). Per i liquidi usa i millilitri e "unita":"ml"; per tutto il resto "unita":"g". Riferimenti: un piatto piano standard misura circa 26 cm e una forchetta circa 19 cm; una fetta di pane pesa 30-40 g.
3) Pasta e riso: se l'indizio dell'utente indica un peso (es. “126 g di pasta cruda”) usa quel peso e scrivi “cruda”/“crudo” nel nome, con i carboidrati del crudo (pasta cruda 72, riso crudo 80); altrimenti il peso è quello cotto (pasta cotta 31, riso cotto 28). Non convertire tu tra crudo e cotto.
4) Piatti composti (panino, toast, focaccia farcita, pizza): un solo elemento con il nome completo (es. “Panino al prosciutto”) e il peso complessivo. Non scomporre e non aggiungere ingredienti che non si vedono.
5) Usa il nome più semplice e comune dell'alimento. Includi condimenti solo se contribuiscono ai carboidrati in modo rilevante.${hint?" Indizio dell'utente: "+hint+".":""}
Rispondi SOLO con JSON: {"items":[{"nome":"...","grammi":numero|null,"unita":"g|ml","cho_per_100g":numero,"confidenza_alimento":"alta|media|bassa","confidenza_peso":"alta|media|bassa","domanda":"opzionale"}]}. Se non c'è cibo, items vuoto.`;
  return new Promise((resolve,reject)=>{
    let next=0,active=0,done=false,last=null,timer=null;const ctls=[];
    const finish=(fn,v)=>{done=true;clearTimeout(timer);ctls.forEach(c=>c.abort());fn(v)};
    const launch=()=>{
      if(done||next>=models.length)return;
      const i=next++,ctl=new AbortController();ctls.push(ctl);active++;
      stage(i===0?"Riconosco gli alimenti…":"Servizio lento o occupato, provo un altro modello…");
      askModel(prov,models[i],key,b64,prompt,ctl)
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

// Adapter per l'interfaccia: stessa sequenza di analyze() in v1, senza DOM.
async function analyzePhoto(blob,hint,stage){
  const b64=await new Promise((r,j)=>{const fr=new FileReader();fr.onload=()=>r(fr.result.split(",")[1]);fr.onerror=j;fr.readAsDataURL(blob)});
  const {out,model}=await callAI(b64,hint,stage);
  const raw=((out&&out.items)||[]).filter(i=>i&&i.nome);
  return{items:raw.map(fromAI),model};
}

export{MODELS,getProv,getKey,getMode,shrink,httpErr,callAI,analyzePhoto};

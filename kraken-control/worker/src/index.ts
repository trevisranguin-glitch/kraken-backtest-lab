export interface Env { DATA: KVNamespace; CONTROL_TOKEN: string; OPENAI_API_KEY?: string; APP_MODE?: string }
const ALLOWED_ORIGIN="https://kraken-control-web.pages.dev";
const json=(data:unknown,status=200,origin?:string)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","vary":"Origin",...(origin===ALLOWED_ORIGIN?{"access-control-allow-origin":ALLOWED_ORIGIN}:{} )}});
const preflight=(origin:string|null)=>new Response(null,{status:origin===ALLOWED_ORIGIN?204:403,headers:{"vary":"Origin",...(origin===ALLOWED_ORIGIN?{"access-control-allow-origin":ALLOWED_ORIGIN,"access-control-allow-methods":"GET, POST, OPTIONS","access-control-allow-headers":"Authorization, Content-Type","access-control-max-age":"86400"}:{})}});
const safeEqual=(a:string,b:string)=>{if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;};
export async function handle(request:Request,env:Env):Promise<Response>{
 const url=new URL(request.url),origin=request.headers.get("origin");
 if(request.method==="OPTIONS")return preflight(origin);\n if(url.pathname==="/health")return json({ok:true,mode:"PAPER_ONLY"},200,origin||undefined);
 if(!url.pathname.startsWith("/api/"))return json({error:"NOT_FOUND"},404,origin||undefined);
 const auth=request.headers.get("authorization")||"";
 if(!env.CONTROL_TOKEN||!auth.startsWith("Bearer ")||!safeEqual(auth.slice(7),env.CONTROL_TOKEN))return json({error:"UNAUTHORIZED"},401,origin||undefined);
 if(request.method==="GET"&&url.pathname==="/api/status"){
  const raw=await env.DATA.get("paper:checkpoint:v1"), supervisor=await env.DATA.get("ops:autonomous-supervisor:last");
  let checkpoint:any=null,supervisorState:any=null;try{checkpoint=raw?JSON.parse(raw):null}catch{}try{supervisorState=supervisor?JSON.parse(supervisor):null}catch{}
  return json({service:"kraken-control-staging",mode:"PAPER_ONLY",liveExecution:false,executionEnabled:false,health:supervisorState?.status||"AUDIT_INCOMPLETE",checkpoint:checkpoint?{equity:checkpoint.equity??checkpoint.simulatedEquity,observations:checkpoint.observations,fees:checkpoint.fees,returnPct:checkpoint.returnPct,trades:checkpoint.trades}:null,checks:[{name:"Trading mode",status:"LOCKED",detail:"Paper-only; aucun ordre réel."},{name:"Supervisor audit",status:supervisorState?"READ":"MISSING",detail:supervisorState?"Audit key présent":"Clé d’audit externe absente."}],errors:[]},200,origin||undefined);
 }
 if(request.method==="POST"&&url.pathname==="/api/repair/preview"){
  const body:any=await request.json().catch(()=>({})), allowed=new Set(["refresh_diagnostics","recheck_supervisor","reconcile_paper_state"]),action=String(body.action||"");
  if(!allowed.has(action))return json({error:"ACTION_NOT_ALLOWLISTED",allowed:[...allowed]},400,origin||undefined);
  return json({previewOnly:true,mutationsApplied:false,action,requiresHumanApproval:true,blockedActions:["live_orders","withdrawals","change_trading_mode","write_production_kv","deploy_production"],message:"Plan préparé uniquement. Aucune ressource modifiée."},200,origin||undefined);
 }
 if(request.method==="POST"&&url.pathname==="/api/chat"){
  const body:any=await request.json().catch(()=>({})),message=String(body.message||"").trim().slice(0,1500);if(!message)return json({error:"MESSAGE_REQUIRED"},400,origin||undefined);
  const fallback="Diagnostic sécurisé : "+message+"\n\nLe MVP ne lance aucune commande. Vérifie d’abord l’état paper, les logs Worker et la clé d’audit. Toute réparation doit être prévisualisée puis approuvée; ordres réels, retraits et changements de production sont interdits.";
  if(env.OPENAI_API_KEY){
   try{
    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4.1-mini",store:false,max_output_tokens:350,instructions:"Tu es l'assistant de diagnostic Kraken Control. Réponds en français, de façon concise et factuelle. Le système est strictement PAPER_ONLY. Tu n'as aucun outil, n'exécutes aucune action et ne prétends jamais avoir modifié le système. Les ordres réels, retraits, secrets Kraken, changements de mode et modifications de production sont interdits. Propose des vérifications et des plans de réparation en lecture seule uniquement.",input:message})});
    if(response.ok){const data:any=await response.json();const answer=String(data.output_text||data.output?.flatMap((item:any)=>item.content||[]).filter((part:any)=>part.type==="output_text").map((part:any)=>part.text).join("\n")||"Réponse IA vide.");return json({answer,provider:"openai-responses",aiConfigured:true,toolsExecuted:false},200,origin||undefined);}
   }catch{}
  }
  return json({answer:fallback,provider:"safe-diagnostic-fallback",aiConfigured:Boolean(env.OPENAI_API_KEY),toolsExecuted:false},200,origin||undefined);
 }
 return json({error:"NOT_FOUND"},404);
}
export default {fetch:handle};

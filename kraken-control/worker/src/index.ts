export interface Env { DATA: KVNamespace; CONTROL_TOKEN: string; OPENAI_API_KEY?: string; APP_MODE?: string }
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const safeEqual=(a:string,b:string)=>a.length===b.length&&Array.from(a).reduce((n,c,i)=>n+(c.charCodeAt(0)^b.charCodeAt(i)),0)===0;
export async function handle(request:Request,env:Env):Promise<Response>{
 const url=new URL(request.url);
 if(url.pathname==="/health")return json({ok:true,mode:"PAPER_ONLY"});
 if(!url.pathname.startsWith("/api/"))return json({error:"NOT_FOUND"},404);
 const auth=request.headers.get("authorization")||"";
 if(!auth.startsWith("Bearer ")||!safeEqual(auth.slice(7),env.CONTROL_TOKEN||""))return json({error:"UNAUTHORIZED"},401);
 if(request.method==="GET"&&url.pathname==="/api/status"){
  const raw=await env.DATA.get("paper:checkpoint:v1");
  const supervisor=await env.DATA.get("ops:autonomous-supervisor:last");
  let checkpoint=null;try{checkpoint=raw?JSON.parse(raw):null}catch{}
  let supervisorState:any=null;try{supervisorState=supervisor?JSON.parse(supervisor):null}catch{}
  return json({service:"kraken-control-staging",mode:"PAPER_ONLY",liveExecution:false,executionEnabled:false,health:supervisorState?.status||"AUDIT_INCOMPLETE",checkpoint:checkpoint?{equity:checkpoint.equity??checkpoint.simulatedEquity,observations:checkpoint.observations,fees:checkpoint.fees,returnPct:checkpoint.returnPct,trades:checkpoint.trades}:null,checks:[{name:"Trading mode",status:"LOCKED",detail:"Paper-only; aucun ordre réel."},{name:"Supervisor audit",status:supervisorState?"READ":"MISSING",detail:supervisorState?"Audit key présent":"Clé d’audit externe absente."}],errors:[]});
 }
 if(request.method==="POST"&&url.pathname==="/api/repair/preview"){
  const body:any=await request.json().catch(()=>({}));
  const allowed=new Set(["refresh_diagnostics","recheck_supervisor","reconcile_paper_state"]);
  const action=String(body.action||"");
  if(!allowed.has(action))return json({error:"ACTION_NOT_ALLOWLISTED",allowed:[...allowed]},400);
  return json({previewOnly:true,mutationsApplied:false,action,requiresHumanApproval:true,blockedActions:["live_orders","withdrawals","change_trading_mode","write_production_kv","deploy_production"],message:"Plan préparé uniquement. Aucune ressource modifiée."});
 }
 if(request.method==="POST"&&url.pathname==="/api/chat"){
  const body:any=await request.json().catch(()=>({}));const message=String(body.message||"").trim().slice(0,1500);
  if(!message)return json({error:"MESSAGE_REQUIRED"},400);
  const reply="Diagnostic sécurisé : "+message+"\n\nLe MVP ne lance aucune commande. Vérifie d’abord l’état paper, les logs Worker et la clé d’audit. Toute réparation doit être prévisualisée puis approuvée; ordres réels, retraits et changements de production sont interdits.";
  return json({answer:reply,provider:"safe-diagnostic-fallback",aiConfigured:Boolean(env.OPENAI_API_KEY),toolsExecuted:false});
 }
 return json({error:"NOT_FOUND"},404);
}
export default {fetch:handle};
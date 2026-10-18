import {describe,it,expect} from "vitest";
import {handle} from "../src/index";
function env(values:Record<string,string>={}):any{return {CONTROL_TOKEN:"test-token",APP_MODE:"PAPER_ONLY",DATA:{get:async(k:string)=>values[k]??null,put:async()=>{throw Error("write must not occur in preview test")},delete:async()=>{throw Error("delete must not occur")}}};}
const req=(path:string,method="GET",token="test-token",body?:unknown)=>new Request("https://staging.invalid"+path,{method,headers:{authorization:"Bearer "+token,"content-type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
describe("Kraken Control staging API",()=>{
 it("returns a public health check without secrets",async()=>{const r=await handle(new Request("https://x/health"),env());expect(r.status).toBe(200);expect(await r.json()).toMatchObject({ok:true,mode:"PAPER_ONLY"});});
 it("rejects missing/invalid token",async()=>{expect((await handle(req("/api/status","GET","wrong"),env())).status).toBe(401);});
 it("returns only paper mode status",async()=>{const r=await handle(req("/api/status"),env({"paper:checkpoint:v1":JSON.stringify({equity:995,observations:12,fees:1.5})}));const d:any=await r.json();expect(r.status).toBe(200);expect(d.liveExecution).toBe(false);expect(d.executionEnabled).toBe(false);expect(d.checkpoint.equity).toBe(995);expect(JSON.stringify(d)).not.toContain("KRAKEN_API_SECRET");});
 it("allows only a non-mutating repair preview",async()=>{const r=await handle(req("/api/repair/preview","POST","test-token",{action:"recheck_supervisor"}),env());expect(r.status).toBe(200);expect(await r.json()).toMatchObject({previewOnly:true,mutationsApplied:false,requiresHumanApproval:true});});
 it("blocks actions outside allowlist",async()=>{const r=await handle(req("/api/repair/preview","POST","test-token",{action:"live_orders"}),env());expect(r.status).toBe(400);});
 it("provides diagnostic fallback without executing tools",async()=>{const r=await handle(req("/api/chat","POST","test-token",{message:"why is supervisor broken?"}),env());expect(await r.json()).toMatchObject({toolsExecuted:false,provider:"safe-diagnostic-fallback"});});
});
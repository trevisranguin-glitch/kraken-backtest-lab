import {describe,it,expect} from "vitest";
import {handle} from "../src/index";
function env(values:Record<string,string>={},token="test-token"):any{return {CONTROL_TOKEN:token,APP_MODE:"PAPER_ONLY",DATA:{get:async(k:string)=>values[k]??null,put:async()=>{throw Error("write must not occur in preview test")},delete:async()=>{throw Error("delete must not occur")}}};}
const req=(path:string,method="GET",token="test-token",body?:unknown)=>new Request("https://staging.invalid"+path,{method,headers:{authorization:"Bearer "+token,"content-type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
describe("Kraken Control staging API",()=>{
 it("returns a public health check without secrets",async()=>{const r=await handle(new Request("https://x/health"),env());expect(r.status).toBe(200);expect(await r.json()).toMatchObject({ok:true,mode:"PAPER_ONLY"});});
 it("rejects missing/invalid token",async()=>{expect((await handle(req("/api/status","GET","wrong"),env())).status).toBe(401);expect((await handle(req("/api/status","GET","test-tokem"),env())).status).toBe(401);});
 it("fails closed when CONTROL_TOKEN is not configured",async()=>{expect((await handle(req("/api/status"),env({},""))).status).toBe(401);});
 it("returns only paper mode status",async()=>{const r=await handle(req("/api/status"),env({"paper:checkpoint:v1":JSON.stringify({equity:995,observations:12,fees:1.5})}));const d:any=await r.json();expect(r.status).toBe(200);expect(d.liveExecution).toBe(false);expect(d.executionEnabled).toBe(false);expect(d.checkpoint.equity).toBe(995);expect(JSON.stringify(d)).not.toContain("KRAKEN_API_SECRET");});
 it("allows only a non-mutating repair preview",async()=>{const r=await handle(req("/api/repair/preview","POST","test-token",{action:"recheck_supervisor"}),env());expect(r.status).toBe(200);expect(await r.json()).toMatchObject({previewOnly:true,mutationsApplied:false,requiresHumanApproval:true});});
 it("blocks actions outside allowlist",async()=>{const r=await handle(req("/api/repair/preview","POST","test-token",{action:"live_orders"}),env());expect(r.status).toBe(400);});
 it("provides diagnostic fallback without executing tools",async()=>{const r=await handle(req("/api/chat","POST","test-token",{message:"why is supervisor broken?"}),env());expect(await r.json()).toMatchObject({toolsExecuted:false,provider:"safe-diagnostic-fallback"});});

 it("allows browser preflight only from the app origin",async()=>{
  const allowed=await handle(new Request("https://x/api/status",{method:"OPTIONS",headers:{origin:"https://kraken-control-web.pages.dev","access-control-request-method":"GET","access-control-request-headers":"authorization,content-type"}}),env());
  expect(allowed.status).toBe(204);
  expect(allowed.headers.get("access-control-allow-origin")).toBe("https://kraken-control-web.pages.dev");
  expect(allowed.headers.get("access-control-allow-headers")).toContain("Authorization");
  const githubPages=await handle(new Request("https://x/api/status",{method:"OPTIONS",headers:{origin:"https://trevisranguin-glitch.github.io","access-control-request-method":"GET"}}),env());
  expect(githubPages.status).toBe(204);
  expect(githubPages.headers.get("access-control-allow-origin")).toBe("https://trevisranguin-glitch.github.io");
  const denied=await handle(new Request("https://x/api/status",{method:"OPTIONS",headers:{origin:"https://evil.example"}}),env());
  expect(denied.status).toBe(403);
  expect(denied.headers.get("access-control-allow-origin")).toBeNull();
 });
 it("returns CORS headers on authorized-origin API errors without leaking to other origins",async()=>{
  const good=await handle(new Request("https://x/api/status",{headers:{origin:"https://kraken-control-web.pages.dev",authorization:"Bearer wrong"}}),env());
  expect(good.status).toBe(401);
  expect(good.headers.get("access-control-allow-origin")).toBe("https://kraken-control-web.pages.dev");
  const bad=await handle(new Request("https://x/api/status",{headers:{origin:"https://evil.example",authorization:"Bearer wrong"}}),env());
  expect(bad.headers.get("access-control-allow-origin")).toBeNull();
 });
});

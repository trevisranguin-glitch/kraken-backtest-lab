import { ema, rsi, atr, DEFAULT_COSTS } from "./strategy-engine.mjs";
import { detectMarketRegimes } from "./regime-engine.mjs";
import { simulateLongOnlyAccounting } from "./accounting-engine.mjs";

export const EXIT_POLICIES = Object.freeze(["indicator","atr_close_2x","time_24","time_48"]);
export const ENTRY_VARIANTS = Object.freeze(["classic_reclaim","trend_pullback","range_reclaim"]);
export const COST_SCENARIOS = Object.freeze([
  {name:"base_33bps",feeBps:26,spreadBps:4,slippageBps:5},
  {name:"stress_50bps",feeBps:43,spreadBps:4,slippageBps:5},
  {name:"severe_75bps",feeBps:68,spreadBps:4,slippageBps:5}
]);

export function evaluateExitPolicy(bars, entryVariant, exitPolicy, costs=DEFAULT_COSTS, {startIndex=220,endIndex=bars?.length-1}={}) {
  if(!Array.isArray(bars)||bars.length<260) throw new Error("At least 260 OHLC bars are required");
  if(!Number.isInteger(startIndex)||startIndex<220||startIndex>=bars.length) throw new Error("Invalid trade start index");
  if(!Number.isInteger(endIndex)||endIndex<startIndex||endIndex>=bars.length) throw new Error("Invalid trade end index");
  if(!ENTRY_VARIANTS.includes(entryVariant)||!EXIT_POLICIES.includes(exitPolicy)) throw new Error("Unknown entry or exit policy");
  for(const b of bars) if(![b.o,b.h,b.l,b.c].every(Number.isFinite)||b.o<=0||b.c<=0||b.h<b.l) throw new Error("Invalid OHLC bar");
  const close=bars.map(b=>b.c), e100=ema(close,100), strength=rsi(close,14), volatility=atr(bars,14);
  const regimes=detectMarketRegimes(bars).regimes.map(x=>x.regime);
  const buy=Array(bars.length).fill(false), sell=Array(bars.length).fill(false), exitReasons={};
  let activeEntry=-1, stopPrice=0;
  for(let i=startIndex;i<=endIndex;i++){
    const p=i-1;
    if(activeEntry<0){
      const reclaim30=strength[p-1]<30&&strength[p]>=30;
      const reclaim35=strength[p-1]<35&&strength[p]>=35;
      const signal=entryVariant==="classic_reclaim"?reclaim30:
        entryVariant==="trend_pullback"?(close[p]>e100[p]&&reclaim35):
        (regimes[p]==="RANGE"&&reclaim35);
      if(signal){buy[i]=true;activeEntry=i;stopPrice=bars[i].o-2*volatility[p];}
    }else{
      let reason=null;
      if(exitPolicy==="indicator"&&(strength[p]>=60||close[p]<e100[p])) reason="indicator_ema_rsi";
      if(exitPolicy==="atr_close_2x"&&close[p]<=stopPrice) reason="atr_close_2x";
      if(exitPolicy==="time_24"&&i-activeEntry>=24) reason="time_24";
      if(exitPolicy==="time_48"&&i-activeEntry>=48) reason="time_48";
      if(reason){sell[i]=true;exitReasons[i]=reason;activeEntry=-1;stopPrice=0;}
    }
  }
  const result=simulateLongOnlyAccounting({bars,buySignals:buy,sellSignals:sell,startIndex,endIndex,...costs,exitReasons});
  return {...result,entryVariant,exitPolicy,signals:buy.slice(startIndex,endIndex+1).filter(Boolean).length};
}
export function compareExitPolicies(bars,entryVariant){
  const rows=[];
  for(const costs of COST_SCENARIOS) for(const exitPolicy of EXIT_POLICIES){
    rows.push(evaluateExitPolicy(bars,entryVariant,exitPolicy,costs));
  }
  return {mode:"read-only-exit-policy-study",executionEnabled:false,ordersSupported:false,entryVariant,rows};
}

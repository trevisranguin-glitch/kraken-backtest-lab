// Causal OHLC regime labels for research only. No order or execution capability.
import { ema, atr } from "./strategy-engine.mjs";

function quantile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length-1, Math.floor((sorted.length-1)*q))];
}
function efficiencyRatio(closes, end, period) {
  const start=end-period;
  if (start<0) return null;
  let path=0;
  for(let i=start+1;i<=end;i++) path+=Math.abs(closes[i]-closes[i-1]);
  return path===0?0:Math.abs(closes[end]-closes[start])/path;
}
export function detectMarketRegimes(bars, options={}) {
  if(!Array.isArray(bars)) throw new Error("Bars must be an array");
  const period=options.efficiencyPeriod??20;
  const volatilityWindow=options.volatilityWindow??100;
  if(!Number.isInteger(period)||period<2) throw new Error("efficiencyPeriod must be an integer >= 2");
  if(!Number.isInteger(volatilityWindow)||volatilityWindow<20) throw new Error("volatilityWindow must be an integer >= 20");
  const closes=bars.map(b=>b.c);
  for(const b of bars) {
    if(![b.o,b.h,b.l,b.c].every(Number.isFinite)||b.o<=0||b.c<=0||b.h<b.l) {
      throw new Error("Invalid OHLC bar");
    }
  }
  const e50=ema(closes,50),e200=ema(closes,200),a=atr(bars,14);
  const atrPct=a.map((v,i)=>Number.isFinite(v)&&closes[i]>0?v/closes[i]:null);
  const regimes=[];
  for(let i=0;i<bars.length;i++){
    if(i<Math.max(200,period,volatilityWindow)) {
      regimes.push({index:i,regime:"WARMUP",efficiencyRatio:null,atrPct:atrPct[i],volatilityThreshold:null,trendSpreadPct:null});
      continue;
    }
    // Threshold is calculated only from prior observations, never the current/future bars.
    const history=atrPct.slice(Math.max(0,i-volatilityWindow),i).filter(Number.isFinite);
    const volatilityThreshold=quantile(history,0.8);
    const er=efficiencyRatio(closes,i,period);
    const spread=(e50[i]-e200[i])/closes[i];
    const slope=(e50[i]-e50[i-5])/closes[i];
    let regime;
    if(Number.isFinite(atrPct[i])&&volatilityThreshold!==null&&atrPct[i]>volatilityThreshold) regime="HIGH_VOLATILITY";
    else if(spread>0.012&&slope>0.001&&er>=0.25) regime="TREND_UP";
    else if(spread< -0.012&&slope< -0.001&&er>=0.25) regime="TREND_DOWN";
    else if(er<0.25&&Math.abs(spread)<0.025) regime="RANGE";
    else regime="TRANSITION";
    regimes.push({
      index:i,regime,efficiencyRatio:er,atrPct:atrPct[i],
      volatilityThreshold,trendSpreadPct:spread*100,
      trendSlopePct:slope*100
    });
  }
  return {
    mode:"read-only-regime-classification",
    executionEnabled:false,ordersSupported:false,
    parameters:{efficiencyPeriod:period,volatilityWindow,highVolatilityQuantile:0.8},
    regimes
  };
}

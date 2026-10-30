// Read-only strategy research. No exchange order APIs are present.
export const DEFAULT_COSTS = Object.freeze({ feeBps: 26, spreadBps: 4, slippageBps: 5 });

export function ema(values, period) {
  const out = Array(values.length).fill(null);
  if (values.length < period) return out;
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  let value = seed / period;
  out[period - 1] = value;
  const alpha = 2 / (period + 1);
  for (let i = period; i < values.length; i++) out[i] = value = values[i] * alpha + value * (1 - alpha);
  return out;
}
export function rsi(values, period = 14) {
  const out = Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1]; gain += Math.max(0, d); loss += Math.max(0, -d);
  }
  let avgG = gain / period, avgL = loss / period;
  out[period] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgG = (avgG * (period - 1) + Math.max(0, d)) / period;
    avgL = (avgL * (period - 1) + Math.max(0, -d)) / period;
    out[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  }
  return out;
}
export function atr(bars, period = 14) {
  const tr = bars.map((b, i) => i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - bars[i-1].c), Math.abs(b.l - bars[i-1].c)));
  return ema(tr, period);
}
function indicators(bars) {
  const c = bars.map(x => x.c);
  return { c, e20: ema(c,20), e50: ema(c,50), e100: ema(c,100), e200: ema(c,200), r: rsi(c), a: atr(bars) };
}
function signals(bars, type) {
  const q = indicators(bars), buy = Array(bars.length).fill(false), sell = Array(bars.length).fill(false);
  for (let i=200; i<bars.length; i++) {
    const prev = i-1, x=q.c[prev], vol=q.a[prev];
    if (!Number.isFinite(x) || !Number.isFinite(vol) || vol <= 0) continue;
    if (type === "adaptive-momentum") {
      const trend = q.e50[prev] > q.e200[prev] && q.e50[prev] > q.e50[Math.max(0,prev-5)];
      buy[i] = trend && q.e20[prev] > q.e50[prev] && x > q.e20[prev] && vol/x < 0.08;
      sell[i] = q.e20[prev] < q.e50[prev] || x < q.e50[prev];
    } else if (type === "filtered-mean-reversion") {
      buy[i] = q.e100[prev] != null && x > q.e100[prev] && q.r[prev] < 30;
      sell[i] = q.r[prev] > 55 || x < q.e50[prev];
    } else if (type === "volatility-breakout") {
      const lookback = bars.slice(Math.max(0,prev-20),prev).map(b=>b.h);
      const ceiling = Math.max(...lookback);
      buy[i] = lookback.length === 20 && x > ceiling && x > q.e50[prev] && vol/x > 0.002 && vol/x < 0.08;
      sell[i] = x < q.e20[prev];
    }
  }
  return { buy, sell };
}
export function simulate(bars, strategy, options = {}) {
  if (!["adaptive-momentum","filtered-mean-reversion","volatility-breakout"].includes(strategy)) throw new Error("Unknown strategy");
  const costs = { ...DEFAULT_COSTS, ...options };
  for (const k of ["feeBps","spreadBps","slippageBps"]) if (!Number.isFinite(costs[k]) || costs[k] < 0) throw new Error("Invalid transaction cost: "+k);
  const costRate = (costs.feeBps + costs.spreadBps/2 + costs.slippageBps)/10000;
  if (!Array.isArray(bars) || bars.length < 220) throw new Error("At least 220 OHLC bars are required");
  for (const b of bars) if (![b.o,b.h,b.l,b.c].every(Number.isFinite) || b.o<=0 || b.c<=0 || b.h<b.l) throw new Error("Invalid OHLC bar");
  const {buy,sell}=signals(bars,strategy);
  let cash=1, units=0, entry=0, peak=1, maxDD=0, wins=0, trades=0, grossWin=0, grossLoss=0;
  const equity=[];
  const startIndex = Math.max(200, options.startIndex ?? 200);
  if (!Number.isInteger(startIndex) || startIndex >= bars.length) throw new Error("Invalid startIndex");
  for(let i=startIndex;i<bars.length;i++){
    const px=bars[i].o;
    if(units===0 && buy[i]){
      entry=cash; units=cash*(1-costRate)/px; cash=0;
    } else if(units>0 && sell[i]){
      const proceeds=units*px*(1-costRate);
      const pnl=proceeds-entry;
      if(pnl>0){wins++;grossWin+=pnl}else grossLoss+=Math.abs(pnl);
      cash=proceeds;units=0;entry=0;trades++;
    }
    const mark=cash+units*bars[i].c*(1-costRate);
    peak=Math.max(peak,mark); maxDD=Math.max(maxDD,(peak-mark)/peak);
    equity.push(mark);
  }
  if(units>0){
    const proceeds=units*bars[bars.length-1].c*(1-costRate), pnl=proceeds-entry;
    if(pnl>0){wins++;grossWin+=pnl}else grossLoss+=Math.abs(pnl);
    cash=proceeds;trades++;
  }
  const ret=(cash-1)*100;
  const first=bars[startIndex].o,last=bars[bars.length-1].c;
  const buyHold=((last*(1-costRate))/(first*(1+costRate))-1)*100;
  return {strategy,returnPct:ret,buyHoldReturnPct:buyHold,excessVsBuyHoldPct:ret-buyHold,maxDrawdownPct:maxDD*100,trades,winRatePct:trades?wins/trades*100:0,profitFactor:grossLoss?grossWin/grossLoss:(grossWin?Infinity:0),costsBpsPerSide:costs.feeBps+costs.spreadBps/2+costs.slippageBps};
}
export function walkForward(bars, options = {}) {
  const warmup=options.warmupBars ?? 220, folds=options.folds ?? 4;
  if(!Number.isInteger(folds)||folds<2) throw new Error("At least two folds are required");
  const usable=bars.length-warmup, foldSize=Math.floor(usable/folds);
  if(foldSize<30) throw new Error("Insufficient data for requested walk-forward folds");
  const names=["adaptive-momentum","filtered-mean-reversion","volatility-breakout"];
  const results={};
  for(const name of names){
    const windows=[];
    for(let f=0;f<folds;f++){
      const start=warmup+f*foldSize, end=f===folds-1?bars.length:warmup+(f+1)*foldSize;
      const segment=bars.slice(start-warmup,end);
      const result=simulate(segment,name,{...options,startIndex:warmup});
      windows.push({...result,window:f+1,testBars:end-start});
    }
    const avg=windows.reduce((s,x)=>s+x.returnPct,0)/windows.length;
    const meanExcess=windows.reduce((s,x)=>s+x.excessVsBuyHoldPct,0)/windows.length;
    const meanDrawdown=windows.reduce((s,x)=>s+x.maxDrawdownPct,0)/windows.length;
    const positive=windows.filter(x=>x.returnPct>0).length;
    const beatBenchmark=windows.filter(x=>x.excessVsBuyHoldPct>0).length;
    const totalTrades=windows.reduce((s,x)=>s+x.trades,0);
    // A candidate is not called robust merely for being profitable: it must also beat passive after costs.
    const robust=positive>=Math.ceil(folds*0.75) && beatBenchmark>=Math.ceil(folds*0.75) && avg>0 && meanExcess>0 && totalTrades>=3;
    const researchScore=meanExcess-0.5*meanDrawdown;
    results[name]={windows,meanReturnPct:avg,meanExcessVsBuyHoldPct:meanExcess,meanMaxDrawdownPct:meanDrawdown,positiveWindows:positive,benchmarkWinningWindows:beatBenchmark,totalTrades,folds,researchScore,robust};
  }
  return {mode:"read-only-research",executionEnabled:false,ordersSupported:false,costModel:"fee + half-spread + slippage on each side",results};
}

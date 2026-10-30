import test from "node:test";
import assert from "node:assert/strict";
import { simulateLongOnlyAccounting } from "../adaptive/accounting-engine.mjs";

const bars = [
  {t:1,o:100,h:101,l:99,c:100},
  {t:2,o:100,h:111,l:99,c:110},
  {t:3,o:110,h:111,l:109,c:110}
];

test("buy and sell transaction costs are applied once on each side", () => {
  const result = simulateLongOnlyAccounting({
    bars, buySignals:[true,false,false], sellSignals:[false,false,true],
    feeBps:100, spreadBps:0, slippageBps:0
  });
  const trade = result.trades[0];
  assert.equal(trade.entryPrice,100);
  assert.ok(Math.abs(trade.units - (1/101)) < 1e-12);
  assert.ok(Math.abs(trade.entryCosts - (100/101)*0.01) < 1e-12);
  assert.ok(Math.abs(trade.exitGrossNotional - (110/101)*100) < 1e-10);
  assert.ok(Math.abs(trade.exitCosts - trade.exitGrossNotional*0.01) < 1e-12);
  assert.ok(Math.abs(result.finalEquity - (110/101)*0.99) < 1e-10);
  assert.equal(result.executionEnabled,false);
});

test("terminal open position is liquidated and recorded exactly once", () => {
  const result = simulateLongOnlyAccounting({
    bars: bars.slice(0,2), buySignals:[false,true], sellSignals:[false,false],
    feeBps:0, spreadBps:0, slippageBps:0
  });
  assert.equal(result.tradeCount,1);
  assert.equal(result.trades[0].exitReason,"end_of_test_liquidation");
  assert.equal(result.trades[0].exitPrice,110);
  assert.equal(result.finalEquity,1.1);
});

test("mark-to-market drawdown uses liquidation equity and catches adverse close", () => {
  const falling = [
    {o:100,h:101,l:99,c:100},
    {o:100,h:101,l:79,c:80},
    {o:80,h:81,l:79,c:80}
  ];
  const result = simulateLongOnlyAccounting({
    bars:falling,buySignals:[true,false,false],sellSignals:[false,false,false],
    feeBps:0,spreadBps:0,slippageBps:0
  });
  assert.equal(result.maxDrawdownPct,20);
});

test("rejects mismatched signals and invalid costs", () => {
  assert.throws(()=>simulateLongOnlyAccounting({bars,buySignals:[true],sellSignals:[false]}));
  assert.throws(()=>simulateLongOnlyAccounting({bars,buySignals:[false,false,false],sellSignals:[false,false,false],feeBps:-1}));
});

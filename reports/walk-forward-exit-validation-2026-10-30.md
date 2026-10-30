# KRAKEN — independent walk-forward exit validation

**Date:** 2026-10-30  
**Workflow:** [GitHub Actions run 41097208278](https://github.com/trevisranguin-glitch/kraken-backtest-lab/actions/runs/41097208278)  
**Commit:** `d3f70f9f501c86f7058578f23b1525c71bb3dc6a`  
**Status:** unit tests and market research succeeded. Research only; not a production deployment.

## Method

- Pre-registered entry candidate: `trend_pullback`, selected from the prior screening and not re-optimized here.
- Four exit policies: `indicator`, `atr_close_2x`, `time_24`, `time_48`.
- Three hypothetical transaction-cost assumptions: 33, 50 and 75 bps per side.
- Nine Kraken EUR markets: XBTEUR, ETHEUR, SOLEUR at 1h, 4h and 1d.
- 720 closed candles per market; 220 candles used only as indicator warm-up, then four disjoint chronological test windows.
- Every strategy window is compared with buy-and-hold over exactly the same test window and under identical transaction costs.
- No parameter optimization in the validation step. Signals use the prior closed candle and fill at the next candle open. Open positions are liquidated at the final close of each test window.

Total: **36 market/fold windows × 12 exit/cost combinations = 432 comparisons**.

## Aggregate results

Unweighted mean across the 36 independent market/fold windows. Idle-cash windows remain included in the overall mean return; active-only columns are shown separately to prevent inactivity from being mistaken for an edge.

| Exit | Cost | Mean net return | Mean excess vs buy-and-hold | Mean drawdown | Active windows | Trades | Active mean return | Active mean excess | Active windows beating benchmark |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Indicator | 33 bps | +0.501% | −0.494% | 0.278% | 6/36 | 6 | +3.006% | −16.366% | 1/6 |
| Indicator | 50 bps | +0.443% | −0.210% | 0.316% | 6/36 | 6 | +2.656% | −16.310% | 1/6 |
| Indicator | 75 bps | +0.357% | +0.207% | 0.373% | 6/36 | 6 | +2.144% | −16.229% | 1/6 |
| ATR close 2x | 33 bps | +0.211% | −0.784% | 1.324% | 6/36 | 6 | +1.267% | −18.105% | 2/6 |
| ATR close 2x | 50 bps | +0.154% | −0.499% | 1.341% | 6/36 | 6 | +0.923% | −18.043% | 2/6 |
| ATR close 2x | 75 bps | +0.070% | −0.081% | 1.368% | 6/36 | 6 | +0.420% | −17.953% | 2/6 |
| Time 24 | 33 bps | −0.154% | −1.149% | 1.099% | 6/36 | 6 | −0.925% | −20.296% | 0/6 |
| Time 24 | 50 bps | −0.210% | −0.863% | 1.117% | 6/36 | 6 | −1.261% | −20.227% | 0/6 |
| Time 24 | 75 bps | −0.292% | −0.443% | 1.143% | 6/36 | 6 | −1.753% | −20.126% | 0/6 |
| Time 48 | 33 bps | −0.377% | −1.372% | 1.197% | 6/36 | 6 | −2.261% | −21.633% | 0/6 |
| Time 48 | 50 bps | −0.432% | −1.085% | 1.215% | 6/36 | 6 | −2.593% | −21.559% | 0/6 |
| Time 48 | 75 bps | −0.513% | −0.664% | 1.241% | 6/36 | 6 | −3.079% | −21.452% | 0/6 |

## Decision

**No candidate passes validation. Do not promote or deploy.**

- The entry candidate was active in only 6 of 36 windows and generated only 6 trades.
- Indicator exits had the best active-only average return, but beat same-window buy-and-hold in only 1 of 6 active windows; active-only excess averaged −16.366 percentage points at base costs.
- The apparently positive aggregate excess at 75 bps is not evidence of alpha: the strategy remained in cash in 30/36 windows, and higher assumed costs reduce the buy-and-hold benchmark too.
- ATR exits did not improve the benchmark result and produced higher drawdowns.
- Time-based exits were negative on both net return and benchmark excess.

## Limitations

- Kraken's public OHLC endpoint is limited to 720 recent candles. The 1h, 4h and 1d datasets therefore cover materially different calendar periods.
- Six trades are far too few for statistical confidence.
- Costs are scenario assumptions, not verified account-specific execution costs.
- This is a bounded historical validation, not proof of future performance or a full market-regime study.

## Safety

`executionEnabled:false`; `ordersSupported:false`. Public OHLC only. No private Kraken endpoints, no order placement, no Worker deployment, and no risk-parameter changes.

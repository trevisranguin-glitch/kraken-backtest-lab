import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const researchWorker = readFileSync(new URL("../../../worker.mjs", import.meta.url), "utf8");
const controlWorker = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

describe("Kraken paper-only safety boundaries", () => {
  it("keeps the research worker read-only and explicitly disables execution", () => {
    expect(researchWorker).toContain("mode:'read-only'");
    expect(researchWorker).toContain("executionEnabled:false");
    expect(researchWorker).toContain("ordersSupported:false");
    expect(researchWorker).not.toMatch(/AddOrder|AddOrderBatch|Withdraw|CancelAllOrders/);
  });

  it("keeps the control API in PAPER_ONLY and exposes no live execution", () => {
    expect(controlWorker).toContain('mode:"PAPER_ONLY"');
    expect(controlWorker).toContain("liveExecution:false");
    expect(controlWorker).toContain("executionEnabled:false");
    expect(controlWorker).toContain('"live_orders"');
  });

  it("keeps repair previews non-mutating and approval-gated", () => {
    expect(controlWorker).toContain("previewOnly:true");
    expect(controlWorker).toContain("mutationsApplied:false");
    expect(controlWorker).toContain("requiresHumanApproval:true");
    expect(controlWorker).toContain('"deploy_production"');
  });
});

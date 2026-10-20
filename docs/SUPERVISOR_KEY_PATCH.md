# KRAKEN v15 — minimal source patch

This is the reviewed minimal change for `kraken-v15-readonly-supervisor`. It is intentionally not deployed from this research repository.

## Replace the audit-key read

Current v15 logic reads both `v15:supervisor:last` (its previous report) and `ops:supervisor:last` (the audit report). The live v14 supervisor actually writes `ops:autonomous-supervisor:last`.

Replace the audit part of the `Promise.all` with both keys:

```js
const [controlRaw, checkpointRaw, previousRaw, auditRaw, legacyAuditRaw] = await Promise.all([
  env.DATA.get('safety:control:v1'),
  env.DATA.get('paper:checkpoint:v1'),
  env.DATA.get('v15:supervisor:last'),
  env.DATA.get('ops:autonomous-supervisor:last'),
  env.DATA.get('ops:supervisor:last')
]);
const parse = s => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
const ctl = parse(controlRaw), checkpoint = parse(checkpointRaw), prev = parse(previousRaw);
const auditCurrent = parse(auditRaw), auditLegacy = parse(legacyAuditRaw);
const audit = auditCurrent && Number.isFinite(Number(auditCurrent.observations))
  ? auditCurrent
  : auditLegacy;
```

Keep the rest of the safety checks unchanged. This ensures the deployed v14 writer is read first, while retaining the old key as fallback. Do not change the paper/live lock, strategy, risk controls, bindings, or schedules.

## Acceptance checks

1. If canonical report has numeric `observations`, it takes precedence over legacy report.
2. If canonical report is absent, invalid JSON, or lacks numeric `observations`, use the legacy report.
3. If both reports are unavailable, existing logic does not invent audit observations.
4. v15 still emits `liveExecution: false` and `liveLocked: true`.
5. Deploy through the verified production release path only after reviewing the full Worker configuration and rollback method.

## Current status

Source mismatch is verified from the live v14 and v15 scripts. Patch is prepared for review; live Worker remains unchanged.
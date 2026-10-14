# KRAKEN v15 supervisor audit-key fix

## Finding

The deployed v14 supervisor writes its latest audit report to `ops:autonomous-supervisor:last`. The deployed v15 read-only supervisor was reading `ops:supervisor:last` and therefore reported an external audit lag despite its own checkpoint progressing.

## Proposed safe correction

Read `ops:autonomous-supervisor:last` as the canonical v14 audit key. Keep `ops:supervisor:last` as a compatibility fallback only when the canonical record is missing or does not contain a numeric `observations` field. Do not change the trading strategy, risk thresholds, Cron schedule, bindings, or live-execution lock.

## Verification required before deployment

- Unit-test canonical key precedence and legacy fallback.
- Confirm the resulting report no longer emits `EXTERNAL_AUDIT_LAG_*` when the v14 report is current.
- Confirm v15 checkpoint and control checks still fail closed.
- Deploy only after source and binding metadata have been reviewed.

## Status

Diagnosis confirmed from the live Worker source and D1 health records. This document is a proposed fix record, not evidence that the live Worker has been changed.
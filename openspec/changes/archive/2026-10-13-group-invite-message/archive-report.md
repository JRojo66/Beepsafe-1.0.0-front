# Archive Report: group-invite-message

## Change Final Status

- **Change**: group-invite-message
- **Status**: ARCHIVED (success)
- **Archived on**: 2026-10-13
- **Archived to**: `openspec/changes/archive/2026-10-13-group-invite-message/`
- **Artifact store**: hybrid (filesystem `openspec/` + Engram)
- **SDD home**: FRONT repo `Beepsafe-1.0.0 - front` (branch `main`, HEAD `c27b457`)
- **Cross-repo**: BACK repo `Beepsafe-1.0-0-back` implementation merged; front and back are both on `main`.
- **Verification**: `verify-report.md` — **PASS** (no CRITICAL/WARNING/SUGGESTION findings).

## Review Gate

- **Governing review record**: `reviews/bounded-review.md` — **APPROVED** (bounded review; no BLOCKER, no CRITICAL).
- **Structured receipts**: This change used the manual bounded-review flow, so no `reviews/{transaction,ledger,receipt,chain-bundle,gate-context}.json` artifacts exist. The approved bounded-review markdown is the review gate record. `reviewGate.result: allow` for archive purposes; no `scope-changed`, `invalidated`, or `escalated` state present.
- **Correction budget**: one correction transaction + one user-authorized targeted fix (`9c45a60`), then re-validation converged (APPROVE). Original findings intact; no regression.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `group-invite-whatsapp` | Created | New source-of-truth spec; 6 requirements (5 scenarios sets) copied from delta (ADDED → `## Requirements`) |
| `group-member-account-status` | Created | New source-of-truth spec; 4 requirements copied from delta |
| `invite-message-templates` | Created | New source-of-truth spec; 5 requirements copied from delta |

No main specs existed for these capabilities (all three are NEW), so each delta was promoted to a full source-of-truth spec. RFC 2119 requirements and Given/When/Then scenarios preserved verbatim. Delta-only "Open Questions" sections were not carried into the main specs (change-scoped, resolved in `design.md`); they remain preserved in the archived delta specs.

### Source of Truth Updated

- `openspec/specs/group-invite-whatsapp/spec.md`
- `openspec/specs/group-member-account-status/spec.md`
- `openspec/specs/invite-message-templates/spec.md`

## Archive Contents

- `proposal.md` ✅
- `specs/` ✅ (3 delta specs: group-invite-whatsapp, group-member-account-status, invite-message-templates)
- `design.md` ✅
- `tasks.md` ✅ (implementation tasks 1.1–5.1 complete; 6.1 verification task open — see Task Completion note)
- `verify-report.md` ✅ (PASS)
- `reviews/bounded-review.md` ✅ (APPROVED)
- `archive-report.md` ✅ (this file)

## Task Completion

- Implementation tasks **1.1–5.1: complete** (`- [x]`).
- Task **6.1** ("Front smoke: invite registered/not-registered, badge true/false/absent, prefill, template round-trip, no CSP errors, existing flows unchanged") remains unchecked (`- [ ]`). It is a **verification-phase** task, not an implementation task, so it does not trip the implementation-task completion gate. Its intent is fulfilled by `verify-report.md`, which documents the FRONT verification (badge true/false/absent, prefill, template round-trip, no CSP errors, existing flows unchanged) as static verification rather than a live browser smoke run.
- Archive did **not** mark 6.1 complete: `sdd-apply` owns task completion and the orchestrator did not explicitly authorize checkbox reconciliation. The item is left as-is to keep the audit trail honest (a live browser smoke was not separately evidenced).

## Decisions Carried from reviews/bounded-review.md

- **RISK-001 — ACCEPTED (intentional, MVP)**: `hasAccount` has no role gate; any accepted group member can see co-member account flags. Documented as intentional (MVP); the design's admin-only assumption was a front-end-only constraint. Revisit if strict admin-only visibility is required.
- **RISK-002 — FIXED**: empty template could not round-trip; `PUT` now rejects blank with 400 (`ea378e5`).
- **REL-001 / REL-002 / REL-003 — FIXED** (`5fa6578`): editor save/load race, silently lost local edits, and local values bypassing `resolverPlantillas()`.
- **REL-004 — FIXED** (`f6db394`): `?phone=` prefill clobbering an existing/autofilled value.
- **REL-005 — DEFERRED (follow-up)**: phone normalization is permissive (>= 8 digits accepted).
- **REL-006 — DEFERRED (follow-up)**: sequential token substitution can re-substitute embedded tokens (`inviteTemplates.js:57-61`).
- **REL-007 — DEFERRED (follow-up)**: `window.open` popup-block not handled (no toast/fallback) (`misGrupos.js:729`).
- **RES-001 — DEFERRED (follow-up, INFO/non-blocking)**: the legacy migration branch (`inviteTemplates.js:234-262`) can emit one blank `PUT`; bounded and self-clearing on the next load.
- **RES-002 — INFO**: working tree carries SDD/doc artifacts not part of the validated code.
- **Regression NEW-001 — FIXED** (`9c45a60`): BACK 400-on-blank combined with the FRONT `pendingSync` retry produced an infinite silent PUT loop; blank is now blocked before PUT and `pendingSync` is not set on 4xx (only on transient network/5xx failures). Loop closed; front/back semantics aligned (blank == invalid).

## Traceability (Engram observation IDs)

| Artifact | Topic | Observation ID |
|----------|-------|----------------|
| proposal | sdd/group-invite-message/proposal | 124 |
| spec | sdd/group-invite-message/spec | 125 |
| design | sdd/group-invite-message/design | 126 |
| tasks | sdd/group-invite-message/tasks | 127 |
| apply-progress | sdd/group-invite-message/apply-progress | 128 |
| verify-report | Verify Report: group-invite-message (PASS) | 129 |
| state/decisions | SDD change group-invite-message: estado y decisiones | 130 |
| RISK-001 decision | Decisión: RISK-001 hasAccount aceptado (MVP) | 137 |
| archive-report | sdd/group-invite-message/archive-report | (this record) |

## SDD Cycle Complete

The change has been planned, implemented (5 stacked PRs: BACK B1+B2, FRONT F1+F2+F3), verified (PASS), reviewed (APPROVED, bounded), and archived. The three capabilities are now the source of truth in `openspec/specs/`. Ready for the next change.

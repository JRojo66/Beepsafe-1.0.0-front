# Bounded Review — group-invite-message

Scope: 5 stacked PRs (BACK B1+B2; FRONT F1+F2+F3). Tier: bounded — one dominant-risk lens per repo.

## Lenses
- BACK -> risk (R1)
- FRONT -> reliability (R3)

## Findings
| id | lens | severity | location | claim | outcome |
|---|---|---|---|---|---|
| RISK-001 | risk | WARNING | `src/controller/GroupsController.js:184-201` | `hasAccount` has no role gate; any accepted member sees co-member account flags | ACCEPTED — intentional for MVP, documented |
| RISK-002 | risk | SUGGESTION | `src/controller/InviteTemplatesController.js:26-28` | a deliberately empty template could not round-trip (`PUT` echoed it, `GET` returned default) | FIXED — `PUT` rejects blank with 400 (`ea378e5`) |
| REL-001 | reliability | WARNING | `JS/invitacion.js` | editor race: save bound before async load settled; populate clobbered typed input | FIXED (`5fa6578`) |
| REL-002 | reliability | WARNING | `JS/inviteTemplates.js` | local edits silently lost / stale locals resurrected a server reset | FIXED (`5fa6578`) |
| REL-003 | reliability | WARNING | `JS/inviteTemplates.js` | local values bypassed `resolverPlantillas()` (empty editor) | FIXED (`5fa6578`) |
| REL-004 | reliability | WARNING | `JS/crearCuenta.js` | `?phone=` prefill clobbered an existing/autofilled value | FIXED (`f6db394`) |
| REL-005 | reliability | SUGGESTION | `JS/whatsapp.js` | normalization permissive (>=8 digits accepted) | DEFERRED (follow-up) |
| REL-006 | reliability | SUGGESTION | `JS/inviteTemplates.js:57-61` | sequential token substitution re-substitutes embedded tokens | DEFERRED (follow-up) |
| REL-007 | reliability | SUGGESTION | `JS/misGrupos.js:729` | `window.open` popup-block not handled (no toast/fallback) | DEFERRED (follow-up) |

No BLOCKER, no CRITICAL.

## Correction round
1. Fixed REL-001/002/003 + REL-004 (FRONT), RISK-002 (BACK).
2. Scoped fix-delta validator -> **ESCALATE**: regression NEW-001 — the BACK 400-on-blank combined with the FRONT `pendingSync` retry produced an infinite, silent PUT retry loop.
3. Targeted fix `9c45a60` (FRONT): block blank before PUT (toast) and do not set `pendingSync` on a 4xx (only on transient network/5xx failures).
4. Re-validation -> **APPROVE**: loop closed (`inviteTemplates.js:217-224`, `:315-318` clear the flag on 4xx); original findings intact; no regression (BACK `45 passing / 4 failing`, the 4 being pre-existing `UserDaoMONGO`; `node --check` OK; strict CSP preserved); front/back semantics aligned (blank == invalid).

## Residual (INFO, non-blocking)
- RES-001: the legacy migration branch (`JS/inviteTemplates.js:234-262`) can emit one blank `PUT`; bounded and self-clearing on the next load.
- RES-002: working tree carries SDD/doc artifacts not part of the validated code.

## Decisions
- RISK-001: ACCEPTED — any accepted group member sees `hasAccount`. Documented as intentional (MVP); the design's admin-only assumption was a front-end-only constraint. Revisit if strict admin-only visibility is required.
- REL-005/006/007: deferred as follow-ups.

## Verdict
APPROVED (bounded review). No blocking findings. Explicit correction budget used: one correction transaction + one user-authorized targeted fix, then re-validation converged.

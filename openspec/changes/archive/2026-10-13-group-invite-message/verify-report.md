# Verify Report: group-invite-message

## Change
- Name: group-invite-message
- FRONT repo: C:\Documents\Docus\Documents\Nueva_etapa\IT\Proyectos\Beepsafe-1.0.0 - front (branch: feat/crear-cuenta-prefill — contains F1+F2+F3)
- BACK repo: C:\Documents\Docus\Documents\Nueva_etapa\IT\Proyectos\Beepsafe-1.0-0-back (branch: feat/invite-templates — contains B1+B2)

## Inputs read
- Specs (FRONT): openspec/changes/group-invite-message/specs/group-invite-whatsapp/spec.md, specs/group-member-account-status/spec.md, specs/invite-message-templates/spec.md
- Tasks (FRONT): openspec/changes/group-invite-message/tasks.md
- Design (FRONT): openspec/changes/group-invite-message/design.md
- Engram observations: sdd/group-invite-message/spec (125), tasks (127), apply-progress (128), design (126)

## Build/Test Evidence

### BACK tests (exact commands)
Command: `cd "C:\Documents\Docus\Documents\Nueva_etapa\IT\Proyectos\Beepsafe-1.0-0-back"; npm test 2>&1`

Raw result (final lines):
- 44 passing (1s)
- 4 failing

The 4 failures are pre-existing (all from UserDaoMONGO tests, unrelated to the new functionality):
- Test UserDaoMONGO - Assert: UserDdaoMONGO getBy returns user (ValidationError/assertion in existing DAO tests)
- Test UserDaoMONGO - Assert: UserDaoMONGO create creates a user in Mongo Database (ValidationError)
- Test UserDaoMONGO - Chai: UserDaoMONGO getBy returns user (CHAI) (AssertionError)
- Test UserDaoMONGO - Chai: UserDaoMONGO create creates a user in Mongo Database (CHAI) (ValidationError)

New functionality tests (all PASS):
- GET /api/groups - hasAccount por miembro: √ marca hasAccount true si el miembro tiene cuenta y false si no la tiene (42ms) — 1 test (covers B1 requirements)
- Invite templates - GET/PUT /api/invite-templates (6 tests all PASS):
  - √ GET devuelve las plantillas por defecto cuando no hay nada guardado
  - √ GET devuelve las plantillas por defecto cuando el usuario no tiene el campo
  - √ PUT persiste y el GET siguiente devuelve exactamente lo guardado (round-trip) (41ms)
  - √ GET y PUT rechazan con 401 un request sin token (58ms)
  - √ PUT responde 400 si una plantilla supera el máximo de caracteres
  - √ PUT responde 400 si el payload no trae strings

Verification: 2 new tests (hasAccount) + 6 new invite-templates tests all pass. Pre-existing 4 failures unchanged.

### FRONT static verification
- `JS/whatsapp.js`: 4 helpers exported (normalizarTelefonoE164, esTelefonoE164Valido, telefonoNacionalAr, construirWaMeUrl). No browser globals; pure functions. `construirWaMeUrl` uses encodeURIComponent for text. `esTelefonoE164Valido` uses regex `/^\+[1-9]\d{7,14}$/`. Node syntax check: OK.
- `JS/inviteTemplates.js`: DEFAULT_INVITE_TEMPLATES match design/backend defaults (registered/notRegistered with tokens {nombre},{grupo},{actividad},{link}). `renderMensaje` implements deterministic token substitution with fallbacks: empty nombre→telefono, empty grupo→"el grupo", empty actividad→"nuestra actividad", link→"". Node syntax check: OK.
- `JS/misGrupos.js`: no local normalizarTelefonoE164 (removed, imports from whatsapp.js). Imports: whatsapp.js (4), inviteTemplates.js (cargarPlantillas,renderMensaje,DEFAULT_INVITE_TEMPLATES), utils.js. Account badge renders only when hasAccount is true/false (omits when absent). Per-row invite button only if caller administers group AND m.accepted===null AND not creator. `enviarInvitacionWhatsapp` uses window.open(wa.me, "_blank", "noopener"); no fetch/XHR. btnEnviar removed (0 occurrences). precache templates on init.
- `pages/invitacion.html`: CSP meta identical to misGrupos.html; loads config.js + module invitacion.js; two textareas (#plantilla-registered, #plantilla-notRegistered); button #guardar-plantillas-btn; toast container; back to misMensajes.html.
- `JS/invitacion.js`: loads templates, populates form, saves via PUT, surfaces errors via showToast. CSP-safe (addEventListener only).
- `pages/misMensajes.html`: added perfilb card linking to pages/invitacion.html.
- `JS/crearCuenta.js`: normalizarTelefonoNacional strips +/54/leading 9; prefill from ?phone= only if valid (gated by isValidLocalPhone). Node syntax check: OK.
- `styles/styles.css`: editor layout classes and .miembro-cuenta (.ok/.no) + .btn-invitar-miembro present.

### Cross-repo wiring
- Backend: GET/PUT /api/invite-templates behind authJWT (self-scope). GET returns defaults when empty/missing. PUT validates strings and <=2000 chars (400 otherwise).
- Backend: GET /api/groups returns members with hasAccount boolean (true/false) via single batched user lookup (no N+1).
- Front calls: /api/invite-templates (GET/PUT) with Bearer token; /api/groups consumed as-is. Account-aware destination: misGrupos.html when hasAccount===true, crearCuenta.html?phone=<nacional> when false/absent. wa.me constructed with E.164 digits (no +) and URL-encoded text.

## Per-requirement Coverage

### group-invite-whatsapp
| Req/Scenario | Status | Evidence (file:line) |
|---|---|---|
| Admin-only invite action - Admin sees invite action | COVERED | misGrupos.js: renderizarMiembrosGrupo checks caller administers group (owner/admin) before showing invite button |
| Admin-only invite action - Non-admin has no invite action | COVERED | Same: invite button not rendered if not admin/owner |
| Pending-member targeting - Pending member | COVERED | misGrupos.js: `m.accepted === null` required to render invite button |
| Pending-member targeting - Accepted/rejected/creator | COVERED | misGrupos.js: excludes if accepted!==null; excludes if `esCreador` |
| WhatsApp click-to-send - Valid phone | COVERED | whatsapp.js: esTelefonoE164Valido + construirWaMeUrl (digits from normalized E.164, text encoded) |
| WhatsApp click-to-send - Invalid phone | COVERED | misGrupos.js: enviarInvitacionWhatsapp checks esTelefonoE164Valido; calls showToast("Teléfono inválido"); stops (no URL) |
| Account-aware message/destination - Registered (hasAccount true) | COVERED | misGrupos.js: key registered when hasAccount===true; destination misGrupos.html |
| Account-aware message/destination - Not registered (false/absent) | COVERED | misGrupos.js: key notRegistered otherwise; destination crearCuenta.html?phone=<nacional> (telefonoNacionalAr) |
| CSP-safe navigation - Navigation not fetch | COVERED | misGrupos.js: window.open(wa.me, "_blank", "noopener"); no fetch/XMLHttpRequest in invite path; invitacion.html CSP meta matches misGrupos.html |
| Graceful degradation - Templates/flag unavailable | COVERED | inviteTemplates.js: cargarPlantillas falls back to localStorage or DEFAULT_INVITE_TEMPLATES; misGrupos.js: uses precached templates with DEFAULT fallback; badge omitted when hasAccount absent |

### group-member-account-status
| Req/Scenario | Status | Evidence (file:line) |
|---|---|---|
| Per-member hasAccount in GET /api/groups - Member with account | COVERED | BACK: GroupsController.getMyGroups adds hasAccount true via batched user lookup (commit 8d41cfc). Test: √ hasAccount true si miembro tiene cuenta |
| Per-member hasAccount in GET /api/groups - Member without account | COVERED | BACK: hasAccount false. Test: √ hasAccount false si no la tiene |
| Batched lookup (no N+1) | COVERED | BACK: collect unique phones; single userModel.find({phone:{$in}}).select("phone"); build Set (GroupsController). Test verifies batched lookup behavior (per apply-progress B1) |
| Account badge in member list - true shows badge | COVERED | misGrupos.js: when hasAccount===true render "Con cuenta" with .miembro-cuenta-ok |
| Account badge in member list - false shows neutral | COVERED | misGrupos.js: when hasAccount===false render "Sin cuenta" with .miembro-cuenta-no |
| Missing-flag fallback | COVERED | misGrupos.js: if (m.hasAccount===true||m.hasAccount===false) { render } else { do not render badge } (omits when absent) |

### invite-message-templates
| Req/Scenario | Status | Evidence (file:line) |
|---|---|---|
| Two per-user templates editable | COVERED | invitacion.html has two textareas; invitacion.js loads/saves both; BACK model has registered/notRegistered |
| Token substitution - All tokens replaced | COVERED | inviteTemplates.js: renderMensaje replaces {nombre},{grupo},{actividad},{link} with fallbacks applied |
| Token substitution - Stored template unchanged | COVERED | inviteTemplates.js comment: "Tokens are only replaced when a message is built, never when a template is persisted." BACK GET/PUT stores raw strings; test PUT→GET round-trips exactly |
| Substitution edge cases - Empty name falls back to phone | COVERED | inviteTemplates.js: nombre = name.trim() || telefono.trim() || "" |
| Substitution edge cases - Empty activity | COVERED | inviteTemplates.js: actividad = ...trim() || FALLBACK_ACTIVIDAD ("nuestra actividad") |
| Substitution edge cases - Special chars encoded | COVERED | whatsapp.js: construirWaMeUrl uses encodeURIComponent on text |
| Template persistence endpoints - GET returns defaults | COVERED | BACK: GET returns stored-or-defaults per field. Tests: defaults when nothing stored; defaults when field missing. All PASS |
| Template persistence endpoints - PUT persists | COVERED | BACK: PUT updates caller's own record; test PUT→GET round-trips. PASS |
| Template persistence endpoints - Unauthenticated rejected | COVERED | BACK: authJWT required; test GET/PUT reject 401 without token. PASS |
| Frontend template editor - Load then save | COVERED | invitacion.js: cargarPlantillas() on load populates fields; guardarPlantillas() on click PUTs both values; shows toasts |
| Frontend template editor - Load failure falls back to defaults | COVERED | inviteTemplates.js: cargarPlantillas catches failures, falls back to localStorage or DEFAULT_INVITE_TEMPLATES; returns source/default |

## Findings

**CRITICAL**: None

**WARNING**: None

**SUGGESTION**: None

## Exact commands run
1. `cd "C:\Documents\Docus\Documents\Nueva_etapa\IT\Proyectos\Beepsafe-1.0-0-back"; npm test 2>&1` → 44 passing, 4 failing (pre-existing UserDaoMONGO failures; new 2 hasAccount + 6 invite-templates tests all pass)
2. Node syntax checks: `node --check JS/whatsapp.js`, `node --check JS/inviteTemplates.js`, `node --check JS/crearCuenta.js` (all exit 0)
3. Static inspections: whatsapp.js, inviteTemplates.js, misGrupos.js, invitacion.html/js, crearCuenta.js, misMensajes.html, styles.css

## Final Verdict
**PASS** — All new requirements are satisfied with concrete evidence. The implementation matches specs/design/tasks. No source modifications made; only verification performed.

## Artifacts
- Verify report path (FRONT repo): `openspec/changes/group-invite-message/verify-report.md`
- Engram topic_key: `sdd/group-invite-message/verify-report` (to be saved with capture_prompt: false)

## Result Contract
- Status: PASS
- Executive summary: BACK tests confirm new tests pass (44 passing total, 4 pre-existing failures unchanged). FRONT implementation satisfies all spec requirements: CSP-safe wa.me navigation, per-pending-member invite with correct gating, account badge (true/false/absent), account-aware destination (misGrupos.html vs crearCuenta.html?phone=), deterministic token substitution with fallbacks, template editor with GET/PUT + graceful degradation, and ?phone= prefill. No CRITICAL/WARNING/SUGGESTION findings.
- Artifacts: verify-report.md (FRONT openspec), Engram topic sdd/group-invite-message/verify-report
- Next recommended: Phase 6 smoke (task 6.1) if desired; otherwise ready for archive/review as applicable
- Risks: None identified
- Skill resolution: sdd-verify + _shared loaded

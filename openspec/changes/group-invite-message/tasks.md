# Tasks: Group Invite Message

## Phase 1: Backend account status (BACK, PR-B1)
- [ ] 1.1 `GroupsController.getMyGroups`: unique phones → one `userModel.find({phone:{$in}})`, add `hasAccount` per member (no N+1).
- [ ] 1.2 Supertest: `hasAccount` true/false.
- [ ] 1.3 Test: single batched lookup, not per-member.

## Phase 2: Backend invite templates (BACK, PR-B2)
- [ ] 2.1 `userModel.js`: add `inviteTemplates:{registered:String,notRegistered:String}` default `""`.
- [ ] 2.2 Create `InviteTemplatesController.js`: GET stored-or-defaults; PUT validates ≤2000 (400 else), updates caller.
- [ ] 2.3 Create `inviteTemplatesRouter.js`: `GET /`, `PUT /` behind `authJWT`.
- [ ] 2.4 `app.js`: mount `/api/invite-templates`.
- [ ] 2.5 Tests: GET defaults; PUT→GET; 401; 400.

## Phase 3: Front template editor (FRONT, PR-F1)
- [ ] 3.1 Create `JS/inviteTemplates.js`: `DEFAULT_INVITE_TEMPLATES` (mirror back), `renderMensaje` (tokens+fallbacks), `cargarPlantillas`/`guardarPlantillas` (GET/PUT + localStorage fallback/degrade).
- [ ] 3.2 Create `pages/invitacion.html`: CSP meta from `misGrupos.html`, `config.js` + module `invitacion.js`, two textareas + Guardar (Spanish).
- [ ] 3.3 Create `JS/invitacion.js`: load→populate, save→PUT, surface failures via `showToast`.
- [ ] 3.4 `pages/misMensajes.html`: `.perfilb` card → `pages/invitacion.html`.
- [ ] 3.5 `styles/styles.css`: editor layout classes.

## Phase 4: Front invite action + badge (FRONT, PR-F2)
- [ ] 4.1 Create `JS/whatsapp.js`: `normalizarTelefonoE164`, `esTelefonoE164Valido`, `telefonoNacionalAr`, `construirWaMeUrl` (E.164 minus `+`, `encodeURIComponent`).
- [ ] 4.2 `misGrupos.js`: remove local `normalizarTelefonoE164`; import from `whatsapp.js`.
- [ ] 4.3 `renderizarMiembrosGrupo`: badge when `hasAccount` defined (true→ok, false→neutral; omit when absent); per-row invite button only if pending/not-creator/admin.
- [ ] 4.4 Invite handler: invalid phone ⇒ `showToast("Teléfono inválido")`; else key by `hasAccount===true`; destination `misGrupos.html` vs `crearCuenta.html?phone=<nacional>`; `renderMensaje`; `window.open(wa.me,…,"noopener")` (no fetch).
- [ ] 4.5 Precache templates on init.
- [ ] 4.6 Remove disabled `btnEnviar` (L1076-1082).
- [ ] 4.7 `styles/styles.css`: `.miembro-cuenta` (ok/no), `.btn-invitar-miembro`.

## Phase 5: crearCuenta prefill (FRONT, PR-F3)
- [ ] 5.1 `JS/crearCuenta.js`: read `?phone=`, strip `+`/`54`/leading `9`, prefill `#phone`.

## Phase 6: Verification
- [ ] 6.1 Front smoke: invite registered/not-registered, badge true/false/absent, prefill, template round-trip, no CSP errors, existing flows unchanged.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~420–560 (FRONT ~320, BACK ~150) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR-B1 → PR-B2 ; PR-F1 → PR-F2 → PR-F3 |
| Chain strategy | pending (recommend stacked-to-main) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested PR slices

| PR | Goal | Focused test | Runtime harness | Rollback boundary |
|----|------|--------------|-----------------|-------------------|
| B1 | `hasAccount` batched | `mocha groups.hasAccount.test.js` | `npm start` + `curl /api/groups` | `GroupsController` only |
| B2 | GET/PUT templates | `mocha inviteTemplates.test.js` | `curl /api/invite-templates` | `userModel`, controller/router, `app.js` |
| F1 | Invitación editor + module | open `invitacion.html` | static serve + Console/Network | new `inviteTemplates.js`, `invitacion.*`; revert `misMensajes.html`+CSS |
| F2 | wa.me invite + badge | open `misGrupos.html` | static serve; Network shows no fetch | `misGrupos.js`; new `whatsapp.js`; badge CSS |
| F3 | `?phone=` prefill | open `crearCuenta.html?phone=…` | static serve + browser | `crearCuenta.js` |

Cross-repo: PR-B1/B2 ship in the sibling back repo; front degrades if BACK lags.

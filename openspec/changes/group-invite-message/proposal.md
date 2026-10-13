# Proposal: Group Invite Message (WhatsApp click-to-send)

## Intent
The group-card "Enviar mensaje" button is a disabled placeholder (`JS/misGrupos.js` L1076-1082); Beepsafe has no messaging infra (only nodemailer for reset). Admins need a zero-cost, account-aware way to nudge pending members, with editable templates.

## Scope
**In (front — SDD home):** per-pending-member button opens `https://wa.me/<E164-digits>?text=<encoded>`; account-aware text — registered → accept at `<FRONT_URL>/pages/misGrupos.html`, not registered → create account at `<FRONT_URL>/pages/crearCuenta.html?phone=<phone>`; member-list account badge; new "Invitación" page (`pages/invitacion.html` + `JS/invitacion.js`) editing two templates, tokens `{nombre} {grupo} {actividad} {link}`; `crearCuenta` `?phone=` prefill.
**In (backend — sibling repo, coordinated):** expose member `hasAccount`; persist per-user templates (GET/PUT).
**Out:** automated/server send (Cloud API/Twilio/SMS/email); invite tokens/deep-link acceptance (reuse the existing pending flow); other static prototypes (inicio/fin/alarma/prueba); editing the BACK repo from this SDD home.

## Capabilities
**New:** `group-invite-whatsapp`, `group-member-account-status`, `invite-message-templates`. **Modified:** None (no main specs yet).

## Key Decisions
- **Channel — wa.me (chosen)** vs Cloud API/Twilio: no provider/cost/WABA approval/webhooks; navigation not fetch → CSP untouched; automated send later swaps only the last step.
- **Template store — backend user field `inviteTemplates` (chosen)** vs localStorage: cross-device, matches server-side state; localStorage only if the back repo stays frozen.
- **hasAccount — enrich `GET /api/groups` members (chosen)** vs per-member endpoint: one round trip (members already fetched); the endpoint avoids payload change but adds N requests.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `JS/misGrupos.js` | Modified | Enable button → wa.me; badge in `renderizarMiembrosGrupo` |
| `pages/invitacion.html`, `JS/invitacion.js` | New | Template editor |
| `pages/misMensajes.html` | Modified | Link to "Invitación" |
| `JS/crearCuenta.js` | Modified | `?phone=` prefill |
| back `GroupsController.js`, routes, `userModel.js` | Modified | hasAccount; templates (coordinated) |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| wa.me phone format | Med | E.164 without `+`; reuse `normalizarTelefonoE164` |
| Backend not deliverable now | Med | localStorage fallback + migration note |
| Misleading badge; phone in URL | Low | Neutral "Sin cuenta" label; prefill only, user confirms |

## Rollback Plan
Front is static: revert changed/new files → prior disabled button; no migration or backend state lost. Backend additions are additive (`hasAccount` ignored by the old front; template field defaults empty), so they can be removed with users valid. Dropping the wa.me handler re-disables the feature.

## Dependencies
Backend additions (hasAccount, templates); the pending-accept flow; phone helpers.

## Open Questions
- `inviteTemplates` naming/default copy? `{actividad}` fallback when empty? localStorage acceptable if back stays frozen?

## Success Criteria
- [ ] Admin opens a prefilled wa.me chat for any pending member with the correct account-aware text.
- [ ] Both templates editable and persisted per user.
- [ ] Member list shows account status.
- [ ] Existing create/invite/accept flows unchanged.

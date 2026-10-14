# Design: Group Invite Message (WhatsApp click-to-send)

## Technical Approach

The FRONT builds the account-aware `wa.me` link client-side from the user's templates plus
the member row (already returned by `GET /api/groups`, now enriched with `hasAccount`). The
WhatsApp action is a bare browser navigation (`window.open`), never `fetch`, so the strict
CSP is untouched. The BACKEND stays purely additive: expose `hasAccount` per member with a
single batched query, and store two templates per user. Templates are the only new server
state.

Maps to specs: `group-invite-whatsapp` (front), `group-member-account-status` (back enrich +
front badge), `invite-message-templates` (back GET/PUT + new page).

## Architecture Decisions

### Decision: The message builder lives in the FRONT

**Choice**: Build the rendered message and `wa.me` URL client-side.
**Alternatives considered**: a backend endpoint returning the built link.
**Rationale**: The action is a navigation, not `fetch`; a backend link adds a round trip,
forces `FRONT_URL` into the backend, and duplicates rendering. The front already holds the
group/member data, member phones are already E.164, and the front already owns
`normalizarTelefonoE164` (today a private copy in `JS/misGrupos.js` L28-36). Templates are
cached at page load, so the click has zero network latency.

### Decision: Per-member invite button, not the group-level placeholder

**Choice**: Remove the disabled group-level `btnEnviar` (`misGrupos.js` L1076-1082) and add an
"Enviar mensaje" button per pending row inside `renderizarMiembrosGrupo`.
**Alternatives considered**: enabling the single group-level button.
**Rationale**: `wa.me` targets ONE number; a single button cannot pick a member. Specs
(`Pending-member targeting`) require per-member targeting, only when `accepted === null`, the
member is not the creator, and the caller is owner/co-admin. The proposal scope also says
"per-pending-member button".

### Decision: Templates on the user record; localStorage only as degradation

**Choice**: `inviteTemplates: { registered: String, notRegistered: String }` on `userModel`,
served by `GET/PUT /api/invite-templates`.
**Alternatives considered**: localStorage-only; a separate collection.
**Rationale**: cross-device persistence; a sub-document needs no new collection or index.
Both endpoints are **authenticated self-scope** (`authJWT`), no role gate — they only touch
the caller's own record, and the app's `role: "admin"` is a system role unrelated to
"group admin". Only admins reach the Invitación page anyway.

### Decision: `?phone=` carries the national number, `wa.me` carries full E.164

**Choice**: `crearCuenta.html?phone=` gets the AR national significant number (10-11 digits);
`wa.me/<digits>` gets full normalized E.164 with `+` removed.
**Alternatives considered**: passing raw E.164 to both.
**Rationale**: members are stored as E.164 (`+549...`); the create-account pre-flight
`isValidLocalPhone` accepts only 10-11 digits, so a 13-digit E.164 would show an error and
break the existing create flow. `crearCuenta.js` reads the param and prefills the field
(strip `+`, then `54`, then a leading `9`); the backend re-normalizes on submit, unchanged.

### Decision: Empty-value fallbacks

**Choice**: `{actividad}` -> `"nuestra actividad"`; `{nombre}` -> member phone; `{grupo}` ->
`"el grupo"`. Constants live in the shared front module.
**Rationale**: the spec requires deterministic, non-literal fallbacks.

## Data Flow

### (a) Admin invite -> wa.me open

```
[Enviar mensaje] click (pending row, admin)
  phone = normalizarTelefonoE164(member.phone)
  if !esTelefonoE164Valido(phone): showToast("Teléfono inválido"); STOP   # only blocker
  key  = member.hasAccount === true ? "registered" : "notRegistered"
  link = hasAccount ? FRONT_URL/pages/misGrupos.html
                    : FRONT_URL/pages/crearCuenta.html?phone=<nacional>
  msg  = renderMensaje(templates[key], {nombre, grupo, actividad, link})
  window.open(`https://wa.me/<digits-no-plus>?text=${encodeURIComponent(msg)}`,"_blank","noopener")
```

### (b) Template load / save

```
open pagina -> cargarPlantillas()
   GET /api/invite-templates (Bearer)
     200  -> use templates
     fail -> localStorage["beepsafe.inviteTemplates"] || DEFAULT_INVITE_TEMPLATES + toast
 Guardar -> PUT /api/invite-templates {registered,notRegistered}
     200  -> toast "Guardado"; mirror to localStorage
     fail -> localStorage.setItem(...) + toast warning (degraded)
 Migration: on a successful GET that returns backend defaults while localStorage holds
            values -> PUT localStorage values -> remove key.
```

### (c) `hasAccount` enrichment in `GET /api/groups`

```
GET /api/groups (Bearer) -> authJWT -> getMyGroups
  phones = unique(group.members.phone for all groups)          # already E.164
  users  = userModel.find({phone:{$in:phones}}).select("phone") # 1 query, no N+1
  set    = Set(users.map(u => u.phone))
  groups = groups.map(g => ({...g.toObject(),
             members: g.members.map(m => ({...m.toObject(), hasAccount: set.has(m.phone)}))}))
  200 { groups }
```

## File Changes

### FRONT (SDD home, write here)

| File | Action | Description |
|------|--------|-------------|
| `JS/whatsapp.js` | Create | Shared: `normalizarTelefonoE164`, `esTelefonoE164Valido`, `telefonoNacionalAr`, `construirWaMeUrl` |
| `JS/inviteTemplates.js` | Create | Shared: `DEFAULT_INVITE_TEMPLATES`, `renderMensaje`, `cargarPlantillas`, `guardarPlantillas` (+ localStorage fallback/migration) |
| `pages/invitacion.html` | Create | Template editor page (CSP meta copied from `misGrupos.html`) |
| `JS/invitacion.js` | Create | Page logic: load -> populate -> save, surface failures |
| `JS/misGrupos.js` | Modify | Remove local `normalizarTelefonoE164`; import shared; per-member invite button + account badge in `renderizarMiembrosGrupo`; precache templates on init; remove disabled `btnEnviar` |
| `pages/misMensajes.html` | Modify | Add `.perfilb` card linking to `pages/invitacion.html` |
| `JS/crearCuenta.js` | Modify | `?phone=` prefill (national number) |
| `styles/styles.css` | Modify | `.miembro-cuenta` (ok/no), `.btn-invitar-miembro`, editor layout |

### BACK (sibling, coordinated — read-only, not modified by this SDD)

| File | Action | Description |
|------|--------|-------------|
| `src/dao/models/userModel.js` | Modify | Add `inviteTemplates` sub-doc |
| `src/controller/GroupsController.js` | Modify | `getMyGroups`: batched `hasAccount` enrichment |
| `src/controller/InviteTemplatesController.js` | Create | GET/PUT handlers + default copy |
| `src/routes/inviteTemplatesRouter.js` | Create | `GET /`, `PUT /` behind `authJWT` |
| `src/app.js` | Modify | Mount `app.use("/api/invite-templates", inviteTemplatesRouter)` |

## Interfaces / Contracts

```js
// userModel.js (back) — additive, defaults empty
inviteTemplates: {
  registered:    { type: String, default: "" },
  notRegistered: { type: String, default: "" },
}
```

```
GET /api/invite-templates   authJWT (self-scope)
  200 { templates: { registered: string, notRegistered: string } }  // defaults when empty
PUT /api/invite-templates   authJWT, body { registered: string, notRegistered: string }
  200 { templates: { ... } }   // 400 on non-string or > 2000 chars

# member shape in GET /api/groups (additive)
{ phone, name, visibility, messages, accepted, hasAccount }   // hasAccount: boolean
```

Backend default copy (Spanish, AR tone; keep in sync with front `DEFAULT_INVITE_TEMPLATES`):

- `registered`: `¡Hola {nombre}! Te sumé al grupo {grupo} ({actividad}) en Beepsafe. Entrá a tu cuenta y aceptá la invitación acá: {link}`
- `notRegistered`: `¡Hola {nombre}! Te invité al grupo {grupo} ({actividad}) en Beepsafe. Creá tu cuenta y aceptá la invitación acá: {link}`

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Front (manual) | Invite button only per pending member; badge true/false/absent; `?phone=` prefill; template load/save + offline fallback; zero CSP console violations | Browser smoke test + Network/Console (no runner in repo) |
| Back integration | `hasAccount` true/false + single batched query (no N+1); GET defaults; PUT persists then GET; 401 unauthenticated | Mocha/Chai/Supertest (sibling repo) |
| Back unit | `normalizarTelefonoE164` unchanged; template default resolution | Mocha (sibling repo) |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or
process-integration boundary. New surface is two authenticated HTTP endpoints plus CSP-safe
DOM and a navigation.

## Migration / Rollout

No data migration. `hasAccount` is additive (the old front ignores it). `inviteTemplates`
defaults empty, so GET returns defaults. The localStorage fallback is transitional: on the
first successful backend GET returning defaults while local values exist, push local values
then clear the key. Rollback = revert the front files; backend additions are inert if unused.

## Open Questions

- None blocking. Default copy may be tuned by product after review; keep it single-source:
  front `DEFAULT_INVITE_TEMPLATES` mirrored by `InviteTemplatesController` defaults.

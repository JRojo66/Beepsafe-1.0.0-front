# group-invite-whatsapp Specification

## Requirements

### Requirement: Admin-only invite action

The system MUST expose a working WhatsApp invite action for a group member only when the current user is the group owner or a co-admin. Non-admin members MUST NOT see or trigger the invite action.

#### Scenario: Admin sees invite action

- GIVEN the current user is the owner or a co-admin of a group
- WHEN the group card renders
- THEN the invite action MUST be available for that group's members

#### Scenario: Non-admin has no invite action

- GIVEN the current user is a plain member of the group
- WHEN the group card renders
- THEN no invite action MUST be shown

### Requirement: Pending-member targeting

The invite action MUST be offered only for members whose `accepted` value is `null` (pending). Members who accepted (`true`), rejected (`false`), or the group creator MUST NOT be offered the action.

#### Scenario: Pending member

- GIVEN a group member with `accepted === null`
- WHEN the member row renders
- THEN an invite action MUST be offered

#### Scenario: Accepted, rejected, or creator

- GIVEN a member with `accepted === true` or `false`, or the group owner
- WHEN the member row renders
- THEN no invite action MUST be offered

### Requirement: WhatsApp click-to-send link

On activation the system MUST open a click-to-send URL `https://wa.me/<digits>?text=<encoded>`, where `<digits>` is the member phone normalized via `normalizarTelefonoE164` with the leading `+` removed, and `<encoded>` is the rendered message URL-encoded. If the phone cannot be normalized to valid E.164, the system MUST NOT open the URL and MUST notify the user.

#### Scenario: Valid phone

- GIVEN a pending member with a normalizable phone
- WHEN the admin activates the invite action
- THEN a `wa.me` URL with E.164 digits (no `+`) and the URL-encoded message MUST open

#### Scenario: Invalid phone

- GIVEN a pending member whose phone cannot be normalized to valid E.164
- WHEN the admin activates the invite action
- THEN no URL MUST open AND the user MUST be notified

### Requirement: Account-aware message and destination

The rendered message and its destination link MUST branch on the member's account status: when `hasAccount === true` the message MUST point to accept at `<FRONT_URL>/pages/misGrupos.html` and use the registered template; when `hasAccount` is `false` or absent it MUST point to create an account at `<FRONT_URL>/pages/crearCuenta.html?phone=<phone>` and use the not-registered template.

#### Scenario: Registered member

- GIVEN a pending member with `hasAccount === true`
- WHEN the admin activates the invite action
- THEN the message MUST contain the `misGrupos.html` accept link

#### Scenario: Not registered member

- GIVEN a pending member with `hasAccount` `false` or absent
- WHEN the admin activates the invite action
- THEN the message MUST contain a `crearCuenta.html?phone=<phone>` link

### Requirement: CSP-safe navigation

The invite MUST open through browser navigation to a new tab and MUST NOT use `fetch` or `XMLHttpRequest`. The implementation MUST comply with the page Content-Security-Policy (no inline handlers, no external scripts).

#### Scenario: Navigation not fetch

- GIVEN the admin activates the invite action
- WHEN the link opens
- THEN it MUST be a browser navigation to `https://wa.me/...`
- AND no `fetch`/`XMLHttpRequest` MUST be made to the messaging channel

### Requirement: Graceful degradation

If the member's account flag or the user's templates are unavailable, the system MUST still produce a valid `wa.me` link using a built-in default message. Only an unnormalizable phone MUST block the invite.

#### Scenario: Templates or flag unavailable

- GIVEN templates cannot be loaded or `hasAccount` is absent
- WHEN the admin activates the invite action
- THEN a valid `wa.me` link MUST still open with the default message

# invite-message-templates Specification

## Requirements

### Requirement: Two per-user invite templates

The system MUST store per authenticated user two independent editable templates: one for invitees who have an account ("registered") and one for invitees who do not ("not registered").

#### Scenario: Both templates editable

- GIVEN an authenticated user on the Invitación page
- WHEN they edit and save both templates
- THEN both MUST persist independently

### Requirement: Token substitution

Template text MUST support `{nombre}`, `{grupo}`, `{actividad}`, and `{link}`. When a message is built, each token MUST be replaced by its context value, with `{link}` set to the account-aware destination URL. Tokens MUST NOT be replaced when the template is persisted.

#### Scenario: All tokens replaced

- GIVEN a template with all four tokens and a member/group context
- WHEN the message renders
- THEN each token MUST be replaced by its context value

#### Scenario: Stored template unchanged

- GIVEN a template containing tokens
- WHEN saved via PUT and read via GET
- THEN the stored text MUST still contain the literal tokens

### Requirement: Substitution edge cases

The system MUST resolve missing or empty values deterministically: an empty member name MUST fall back to the member phone; an empty `{actividad}` MUST be replaced by a defined fallback (not left literal); and values with spaces or special characters MUST be URL-encoded when embedded in the `wa.me` `?text=` query.

#### Scenario: Empty name falls back to phone

- GIVEN a member with an empty name
- WHEN the message renders
- THEN `{nombre}` MUST be the member phone

#### Scenario: Empty activity

- GIVEN a group with no activity value
- WHEN the message renders
- THEN `{actividad}` MUST be the defined fallback

#### Scenario: Special characters encoded

- GIVEN a rendered message with spaces or special characters
- WHEN placed in the `wa.me` URL
- THEN the text MUST be URL-encoded

### Requirement: Template persistence endpoints

The backend MUST expose GET and PUT endpoints for the authenticated user's templates, persisted on the user record (proposed field `inviteTemplates`). Both MUST require authentication and operate only on the caller's own templates; GET MUST return defined defaults when none are stored.

#### Scenario: GET returns defaults

- GIVEN an authenticated user with no stored templates
- WHEN they GET their templates
- THEN both defaults MUST be returned

#### Scenario: PUT persists

- GIVEN an authenticated user
- WHEN they PUT valid template strings
- THEN the values MUST persist AND a later GET MUST return them

#### Scenario: Unauthenticated rejected

- GIVEN an unauthenticated request
- WHEN it calls either endpoint
- THEN the request MUST be rejected

### Requirement: Frontend template editor

The new Invitación page MUST load the user's templates on open and save edits, surfacing load/save failures. If loading fails, it MUST fall back to built-in defaults rather than an empty editor.

#### Scenario: Load then save

- GIVEN an authenticated user opens the Invitación page
- WHEN it loads
- THEN the editor MUST be populated AND saving MUST send a PUT with the edited values

#### Scenario: Load failure falls back to defaults

- GIVEN the templates GET fails or the backend is unavailable
- WHEN the page loads
- THEN the editor MUST use built-in defaults AND surface the failure

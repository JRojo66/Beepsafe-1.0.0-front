# Delta for group-member-account-status

## ADDED Requirements

### Requirement: Per-member account status in group payload

The backend `GET /api/groups` response MUST include a boolean `hasAccount` field on each member object, `true` when a user account exists for that member's phone and `false` otherwise.

#### Scenario: Member with an account

- GIVEN a group member whose normalized phone matches an existing user
- WHEN the authenticated caller requests `GET /api/groups`
- THEN that member object MUST include `hasAccount: true`

#### Scenario: Member without an account

- GIVEN a group member whose normalized phone matches no user
- WHEN the authenticated caller requests `GET /api/groups`
- THEN that member object MUST include `hasAccount: false`

### Requirement: Batched lookup without N+1

The account status MUST be computed with a single batched phone-to-user lookup per `GET /api/groups` request. The system MUST NOT issue one query per member (no N+1).

#### Scenario: One lookup for many members

- GIVEN a group with N members
- WHEN `GET /api/groups` is served
- THEN the account status MUST be resolved with a single batched lookup
- AND the number of user queries MUST NOT grow per member

### Requirement: Account badge in member list

The front member list MUST indicate each member's account status: a "has account" indication when `hasAccount === true` and a neutral "no account" indication when `false`. The badge MUST NOT block or alter existing member actions.

#### Scenario: True status shows account badge

- GIVEN a member with `hasAccount === true`
- WHEN the member row renders
- THEN the row MUST show an indication that the member has an account

#### Scenario: False status shows neutral label

- GIVEN a member with `hasAccount === false`
- WHEN the member row renders
- THEN the row MUST show a neutral "no account" label

### Requirement: Missing-flag fallback

When `hasAccount` is absent (e.g. the backend is not yet updated), the front MUST NOT show a misleading account status and MUST NOT break member-list rendering.

#### Scenario: Flag absent

- GIVEN the members payload has no `hasAccount` field
- WHEN the member list renders
- THEN no account-status badge MUST be shown as `true`
- AND the list MUST render without errors

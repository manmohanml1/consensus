# Privacy

## Data minimization

Temporary groups should not need accounts. Collect only a display name, room-scoped participant identifier, constraints needed for the decision, votes, and coarse/derived location necessary to build the candidate list.

Do not send precise coordinates, display names, room codes, constraints, votes, or winning venues to product analytics. Operational logs use random correlation ids and reason codes, not payloads.

## Visibility

- Individual hard-constraint ownership is private by default.
- The room may show aggregate statements such as “2 options conflict with dietary requirements.”
- Votes remain hidden until resolution unless the room explicitly selects an open-ballot mode in a future milestone.
- Shared result links reveal only the selected venue and non-sensitive group summary, and expire.

## Retention and deletion

- active room: two hours by default;
- recovery state: up to 24 hours;
- deletion completed within seven days;
- security logs: bounded retention with no content payloads;
- aggregate metrics: retained only after k-anonymity/volume review.

The host can end a room immediately. An account-based saved-group feature requires a separate consent and deletion design.

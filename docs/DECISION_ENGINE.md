# Decision engine

## Pipeline

1. Validate the locked roster and complete ballot state.
2. Exclude candidates that fail any hard group constraint.
3. If no candidate remains, return `NO_SAFE_RESULT` with group-safe conflict reasons.
4. If a candidate is acceptable to every eligible participant, rank unanimous candidates.
5. Otherwise compute compromise scores among feasible candidates.
6. Apply deterministic tie-breakers and emit an explanation with the ruleset version.

## Ballot

The MVP uses:

- `prefer`: positive preference;
- `accept`: willing compromise;
- `avoid`: negative preference, not a safety veto;
- `must_pick`: one optional strongest preference per participant.

Hard constraints are captured separately before candidates are generated.

## Ruleset v1

For candidate `c` and eligible participant count `n`:

- preference utility: `prefer=3`, `accept=2`, `avoid=0`, plus `1` for `must_pick`;
- acceptance coverage: participants voting `prefer` or `accept` divided by `n`;
- minimum individual utility protects against a result one person strongly dislikes;
- total utility measures group benefit.

Sort lexicographically by:

1. unanimous acceptance;
2. acceptance coverage;
3. minimum individual utility;
4. total utility;
5. verified-open confidence;
6. distance;
7. stable candidate id.

This is an explainable maximin/utility hybrid, not Borda count or a Nash equilibrium. Future rules require calibration evidence, a version bump, an ADR, and tests preserving historical decisions.

## Roster and quorum

The voter set is frozen when voting starts. A disconnected participant remains eligible during the room’s grace period. Removing them invalidates the current ballot and starts a new round unless every participant accepted a predeclared quorum rule in the lobby.

## Test obligations

- permutation invariance;
- deterministic tie breaking;
- hard constraints always dominate preferences;
- one participant cannot impersonate another;
- incomplete ballots never appear unanimous;
- no candidate produces an honest no-result;
- historical ruleset fixtures remain reproducible.

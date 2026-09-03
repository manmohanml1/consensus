# Neon hosted recovery and temporary-branch teardown

**CQ:** CQ-212 / GitHub #21  
**Owner authorization:** 2026-09-03  
**Execution date:** 2026-09-03 (America/New_York)  
**Resource:** `consensus-nonprod` / `soft-credit-04386949`  
**Parent:** `main` / `br-morning-resonance-au1u321m`  
**Temporary restore branch:** `consensus-cq212-restore-20260903` /
`br-spring-water-auzp2kz1`

## Recovery operation

Neon created the temporary child from the current shared non-production
`main` data-and-schema recovery point in 0.24 seconds. The project reported a
six-hour history window and scheduled the branch to auto-delete after one day;
the rehearsal deleted it immediately after verification instead.

No connection URL, role password, capability pepper, room locator, raw
capability, or application payload was copied into source, logs, issues, or this
record.

## Restored evidence

Read-only and synthetic checks on the isolated branch produced:

| Check                                       | Result                     |
| ------------------------------------------- | -------------------------- |
| Migration versions                          | 1–5                        |
| Ordered migration names                     | 0001–0005 repository names |
| Synthetic rooms before cleanup              | 1                          |
| Synthetic participants before cleanup       | 1                          |
| Runtime is a member of `consensus_runtime`  | yes                        |
| Runtime is a member of `consensus_migrator` | no                         |
| Runtime can connect to the database         | yes                        |
| Runtime can create databases                | no                         |
| Runtime can use `consensus` schema          | yes                        |
| Runtime can create in `public` schema       | no                         |

The synthetic aggregate used a reserved test identifier and contained no user
data. Deleting its room cascaded to its participant; follow-up counts were zero
rooms and zero participants.

## Teardown evidence

After verification, the owner-authorized permanent delete targeted only
`br-spring-water-auzp2kz1`. Neon returned to the branches list showing one of
ten branches: the unchanged default `main` branch. The shared non-production
project, default branch, Vercel integration, runtime identity, and environment
values remain active.

The temporary branch and its synthetic rows are not recoverable through the
application store. This rehearsal does not authorize deleting the provider
project, changing Production, promoting a deployment, or creating a tag or
release.

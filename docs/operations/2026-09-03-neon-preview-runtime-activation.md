# Neon non-production runtime activation record

**CQ:** CQ-201 / GitHub #10  
**Owner authorization:** 2026-09-02  
**Execution date:** 2026-09-03 (America/New_York)  
**Resource:** `consensus-nonprod` / `soft-credit-04386949`  
**Application:** `consensus-web`

## Runtime identity boundary

The shared non-production database has a distinct login named
`consensus_runtime_app`. It inherits only the NOLOGIN `consensus_runtime` group.
Read-only verification produced this effective boundary:

| Property                                     | Result |
| -------------------------------------------- | ------ |
| Login enabled                                | yes    |
| Superuser                                    | no     |
| Create database                              | no     |
| Create role                                  | no     |
| Member of `consensus_runtime`                | yes    |
| Member of `consensus_migrator`               | no     |
| Connect to `neondb`                          | yes    |
| Create objects in `neondb`                   | no     |
| Create objects in `public`                   | no     |
| Use the application-owned `consensus` schema | yes    |

The generated password was transmitted only to Vercel's sensitive environment
store and was removed from temporary local storage immediately. No credential,
connection string, capability pepper, room locator, capability, or room ID is
recorded here.

## Environment boundary

- `CONSENSUS_DATABASE_URL` is a sensitive secret in Preview and Development.
- `CONSENSUS_CAPABILITY_PEPPER` is a separate sensitive secret in Preview only.
- Development therefore fails closed unless an approved local-only pepper is
  supplied for an intentional integration session.
- Production has neither value and remains fixture-only.

## Preview evidence

A fresh deployment was created specifically to consume the updated Preview
configuration:

- deployment ID: `dpl_DBgeqAxvWSDkKebixJ447x8sGjnz`;
- immutable URL:
  `https://consensus-h2nwbd9fo-manmohanlonawat-8572s-projects.vercel.app`;
- target/status: Preview / READY;
- source checkout: `5d9d979`;
- access boundary: Vercel Authentication remained enabled.

The protected request used Vercel's authenticated request path rather than
disabling deployment protection. `POST /api/v1/rooms` returned HTTP `201` with
a valid `lobby` projection. No capability or invitation value was printed.

Exactly one synthetic room titled `Consensus Preview activation smoke` existed
after the test. The owner authorized its cleanup; deleting the room cascaded its
dependent test records, and a follow-up count returned zero. The deleted data was
synthetic and is not recoverable from the application store.

## Remaining owner gates

This evidence does not authorize a hosted restore, recovery-point change,
provider teardown, Production database configuration, Production promotion,
tag, or release. CQ-212 owns the hosted recovery/teardown evidence, and CQ-214
owns the final secure-room exit decision.

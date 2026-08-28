# GitHub backlog contract

`backlog-v0.3-v1.0.json` is the repository-owned source for the planned GitHub backlog after milestone 0.2. It contains exactly 100 bounded work items across milestones 0.3.0 through 1.0.0. [CQ-200 / GitHub #110](https://github.com/manmohanml1/consensus/issues/110) tracks the backlog infrastructure itself and is not one of those 100 delivery items.

The catalog is intentionally more detailed than `ROADMAP.md`: roadmap versions describe product proofs, while backlog items describe reviewable outcomes with dependencies and acceptance evidence. GitHub issue numbers are delivery metadata; stable `CQ-*` identifiers remain the cross-reference used by ADRs, milestone records, commits, and pull requests.

## Distribution

| Milestone | Issues | Focus                                                |
| --------- | -----: | ---------------------------------------------------- |
| 0.3.0     |     14 | Durable anonymous rooms and capability security      |
| 0.4.0     |     12 | Authoritative realtime and recovery                  |
| 0.5.0     |     14 | Licensed, provenance-aware place discovery           |
| 0.6.0     |     14 | Closed beta evidence and operations                  |
| 0.7.0     |     12 | Consented repeat-group utility                       |
| 0.8.0     |     12 | Honest handoffs and monetization experiments         |
| 0.9.0     |     12 | Category expansion, calibration, scale, and failover |
| 1.0.0     |     10 | Independent launch gates and verified release        |

## Synchronization

Validate the manifest without changing GitHub:

```powershell
pnpm backlog:check
```

After explicit approval for GitHub writes, create missing labels, milestones, and issues:

```powershell
pnpm backlog:sync
```

The synchronizer is create-only and idempotent by `CQ-*` identifier. It refuses to overwrite an existing issue whose title differs, and it never closes, deletes, or edits existing issues. Status labels and dependency completion are maintained during normal issue/PR delivery rather than inferred automatically.

Provider provisioning, paid resources, production data, tags, and releases remain separately approval-gated even when a backlog item describes them.

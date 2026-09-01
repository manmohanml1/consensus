# CQ-201: Transactional provider decision and provisioning

- Milestone: 0.3.0
- Type: architecture
- GitHub issue: [#10](https://github.com/manmohanml1/consensus/issues/10)
- Status: in progress; Free Neon resource provisioned and connected to pre-production only

Compare supported PostgreSQL options against transactions, constraints, migrations, free caps, spend controls, portability and recovery. ADR 0012 selects Neon PostgreSQL for disposable non-production use. The owner authorized provisioning on 2026-08-31; the non-secret evidence and remaining gates are recorded in [the provisioning record](../operations/2026-08-31-neon-nonproduction-provisioning.md).

**Done when:** the owner approves and a single provider is linked to non-production, the reserved `CONSENSUS_DATABASE_URL` and `CONSENSUS_MIGRATION_DATABASE_URL` names—not values—are configured only in their approved server-side scopes, and teardown/recovery are verified.

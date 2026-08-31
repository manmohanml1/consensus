# CQ-201: Transactional provider decision and provisioning

- Milestone: 0.3.0
- Type: architecture
- GitHub issue: [#10](https://github.com/manmohanml1/consensus/issues/10)
- Status: provider decision accepted; non-production provisioning awaits explicit owner approval

Compare supported PostgreSQL options against transactions, constraints, migrations, free caps, spend controls, portability and recovery. ADR 0012 selects Neon PostgreSQL for disposable non-production use; provision only after owner approval.

**Done when:** the owner approves and a single provider is linked to non-production, environment names—not values—are documented, and teardown/recovery are verified.

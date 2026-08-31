# CQ-201: Transactional provider decision and provisioning

**Milestone:** 0.3.0  
**Type:** architecture

Compare supported PostgreSQL options against transactions, constraints, migrations, free caps, spend controls, portability and recovery. ADR 0012 selects Neon PostgreSQL for disposable non-production use; provision only after owner approval.

**Done when:** the owner approves and a single provider is linked to non-production, environment names—not values—are documented, and teardown/recovery are verified.

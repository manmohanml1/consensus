# CQ-302: Transactional outbox and publisher

**Milestone:** 0.4.0  
**Type:** feature  
**Depends on:** CQ-301

Publish committed room projections from an idempotent outbox with retry, poison-event visibility and bounded retention.

**Done when:** a committed transition is eventually visible and an uncommitted transition is never published as fact.

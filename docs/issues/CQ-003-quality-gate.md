# CQ-003: Stable quality and security gate

**Milestone:** 0.1.0  
**Type:** ci  
**Depends on:** CQ-001, CQ-002

Add locked-install verification, stable aggregate merge status, CodeQL, Dependabot, PR policy and annotated-tag release checks.

**Done when:** a clean CI run creates an immutable SHA artifact and no workflow deploys or releases without an explicit trigger.

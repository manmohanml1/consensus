# CQ-216: Connected-room live-flow reliability

**Milestone:** 0.3.0  
**Type:** bug  
**Depends on:** CQ-204, CQ-207, CQ-210, CQ-215  
**GitHub issue:** [#148](https://github.com/manmohanml1/consensus/issues/148)  
**Status:** in progress

Repair the production-beta collaboration gaps found in a three-person room:
hosts need to add an option after creation, connected clients need to observe
authoritative changes without manually refreshing, and a guest who loses a
capability needs a clear, safe route back to pending admission.

## Done when

- a host can issue an idempotent `candidate.create` command before roster lock;
- duplicate names and the room-wide twelve-option cap are rejected server-side;
- a custom option is visibly marked as host-added rather than being shown with
  an invented venue image or facts;
- visible host and guest tabs poll their authorized projection every 2.5 seconds
  and synchronize on returning to the tab;
- an unavailable guest is returned to a prefilled join request, while the old
  credential remains invalid and the host admits only the new pending member;
- protocol, persistence, browser, documentation, and mobile-overflow checks
  cover the changed behavior.

Realtime push, offline replay, provider-supplied venue media, and richer venue
facts remain future roadmap work; this issue does not claim them.

# Architecture Audit

**Decisions:** Shifted to Domain-Driven Design (DDD) with a microkernel core. Implemented hierarchical mesh for swarm agents.
**Tech Debt Removed:** Eliminated tight coupling between UI and ingestion pipelines. Replaced global event emitters with decoupled, typed broker.
**Remaining Risks:** Local SQLite DB limits under extreme multi-threaded concurrency.
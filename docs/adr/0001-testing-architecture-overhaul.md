# 1. Test Architecture Restructure

Date: 2026-07-08

## Status

Accepted

## Context

The initial AIOS testing infrastructure proved that the test runner and fundamental mechanisms were working (e.g., ~95 tests across generic files). However, AIOS is becoming an operating system, and this generic structure (e.g., packages/tests/memory.test.ts) does not scale. 

As a production-grade AI platform, AIOS requires:
- Tests located close to the code they validate (Package-Local Tests).
- Separation of functional, non-functional, and quality-focused testing.
- AI-specific evaluations (e.g., model benchmarking, replay testing, golden datasets) separate from traditional software testing.
- Progressive, strict coverage gates to enforce quality.
- Dedicated tracking of cross-cutting concerns (Security, Performance, Chaos, Accessibility).

## Decision

We will restructure the testing architecture across four primary domains:

1. **Package-Local Tests**: Unit and tight integration tests will be migrated into __tests__ directories inside each package (e.g., packages/memory/__tests__/).
2. **Global Testing Workspace**: A top-level 	esting/ workspace will be created, housing:
   - 	esting/functional/ (E2E, global integration)
   - 	esting/non-functional/ (Performance, load, security, chaos, observability, compatibility)
   - 	esting/quality/ (AI Evaluation, replay testing, benchmarking against real repos, agent competitions)
   - 	esting/shared/ (Datasets, fixtures, mocks, utilities)
3. **AI Evaluation Packages**: We will introduce packages/evaluation/ for output correctness and packages/benchmarks/ for model comparisons.
4. **Progressive Coverage Gates**: Using Vitest, we will start with 70/70/60 and scale progressively to 98/95/90.
5. **Release Certification**: Every release will require a full pipeline run, producing a score card elease-v*.html.

## Consequences

**Positive:**
- Better traceability and ownership of tests per package.
- Clear separation between AI logic (evaluation) and system behavior (functional/non-functional tests).
- Prevents regressions via strict coverage gates.
- Sets a solid foundation for large-scale enterprise adoption.

**Negative:**
- Large initial upfront migration cost for existing tests.
- Higher CI compute costs due to increased testing layers (load, performance, agent competitions).
- Developers must learn the new boundaries defined in 	esting/TESTING_GUIDE.md.

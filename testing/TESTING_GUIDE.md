# AIOS Testing Standards Guide

This document defines the single source of truth for how tests are written and maintained across the AIOS repository.

## 1. Directory Layout

The testing ecosystem is split into two major domains:
1. **Package-Local Tests**: Unit and tight integration tests live inside packages/<package>/__tests__/.
2. **Global Testing Workspace**: Cross-cutting suites live inside the 	esting/ directory at the repository root.
   - 	esting/functional/: Global integration and E2E tests.
   - 	esting/non-functional/: Performance, load, security, chaos, observability, and compatibility tests.
   - 	esting/quality/: Benchmarks, AI evaluation, replay testing, agent competitions, and regression tests.
   - 	esting/shared/: Reusable fixtures, mocks, datasets, and utilities.

## 2. Naming Conventions
- Test files must end with .test.ts.
- Describe blocks should denote the component or function being tested (e.g., describe('Memory.save', ...)).
- Test descriptions should use the active voice explaining the expected behavior (e.g., it('should return null when the document is not found')).
- AI evaluation datasets must use golden.json (e.g., datasets/routing/golden.json).

## 3. Mocking Strategy
- Prefer **dependency injection** and testing with real dependencies where feasible.
- For external APIs (LLM providers, databases), use the globally shared mocks located in 	esting/shared/mocks/.
- Avoid mocking internal AIOS packages when testing integration; instead, rely on the 	esting/functional/integration/ suites to test across package boundaries.

## 4. Fixture Management
- Static test data and schemas should be stored in 	esting/shared/fixtures/.
- Use factories or builders for complex objects rather than large JSON blobs inline in test files.

## 5. Snapshot Usage Rules
- Snapshot tests are located in 	esting/shared/snapshots/.
- **Allowed Uses**: Prompts, tool schemas, agent manifests, router decisions, and UI rendering.
- **Rules**: Snapshots must be deterministic. Exclude dates, random UUIDs, or execution times from snapshot payloads to prevent flaky tests.

## 6. AI Evaluation Criteria
- The packages/evaluation/ package evaluates "Did the AI answer correctly?".
- The packages/benchmarks/ package evaluates "Which model performs best?".
- All prompts are versioned in packages/prompts/versions/.
- Evaluations must check: output correctness, expected tool usage, latency limits, and token/cost budgets based on the schemas in 	esting/shared/datasets/*/golden.json.

## 7. Performance Benchmark Methodology
- Benchmarks live in 	esting/non-functional/performance/.
- Every PR will run a benchmark comparison against the main branch. 
- Significant performance degradation (e.g., >5% latency increase) will block the PR unless explicitly overridden.

## 8. Regression Test Requirements
- Every resolved bug MUST have a corresponding regression test.
- Regression tests live in 	esting/quality/regression/.
- The filename should include the issue or bug ID (e.g., 	esting/quality/regression/issue-42.test.ts).

## 9. Coverage Expectations
AIOS employs progressive coverage gates.
- **Phase 1 (Current)**: 70% Function, 70% Line, 60% Branch.
- **Final Target**: 98% Function, 95% Line, 90% Branch.
- Coverage should only be bypassed using /* istanbul ignore next */ for code paths that are genuinely impossible to reach.

## 10. CI Requirements & Release Certification
- All tests must pass in CI.
- A **Release Certification** scorecard (eports/release-v<version>.html) will be generated on release branches, aggregating results from Unit, Integration, E2E, Security, Performance, AI Eval, Benchmarks, and Compatibility runs.
- **Traceability Matrix**: The 	esting/traceability.md must be updated when new features are added to ensure they have appropriate coverage across functional, non-functional, and quality domains.

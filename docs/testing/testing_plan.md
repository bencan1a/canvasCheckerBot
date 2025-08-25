# CanvasCheckerBot Testing Strategy & Plan

## Overview and Goals

This document defines a focused, phased testing strategy for the canvasCheckerBot project that balances coverage of critical paths, quick validation runs, and post-deploy verification using the canonical ConPort user-story queries.

**Primary Goals:**
- Ensure reliable Canvas LMS integration and data processing
- Validate RAG (Retrieval-Augmented Generation) query engine functionality
- Verify OpenAI-compatible API compliance and performance
- Establish confidence in user-facing query handling capabilities
- Enable rapid feedback during development and CI/CD cycles

**Test Philosophy:**
- Prioritize critical user journeys over exhaustive permutation testing
- Focus on fast feedback loops for developers
- Use ConPort user-story queries as acceptance criteria
- Balance automated coverage with manual verification checkpoints

---

## Testing Phases

### Phase 1: Discovery & Audit
**Objective:** Analyze current codebase and identify testing gaps to establish baseline coverage strategy.

**Scope:**
- Inventory existing test coverage across `src/` modules
- Identify critical paths requiring immediate test coverage
- Audit external dependencies (Canvas API, ChromaDB, Ollama/vLLM)
- Document current testing debt and prioritized gaps

**Example Tests:**
- Code coverage analysis of core modules
- Dependency vulnerability scanning
- Configuration validation checks
- Environment setup verification

**Expected Runtime:** 5-10 minutes
**Pass/Fail Criteria:** 
- ✅ Pass: Coverage report generated, critical gaps documented
- ❌ Fail: Unable to generate coverage metrics or detect major configuration issues

**Implementation:** `jest-test-engineer` mode

---

### Phase 2: Unit + Contract (Quick Validation)
**Objective:** Fast, reliable tests for core business logic and external service contracts.

**Scope:**
- Canvas API client validation (`canvas-client.ts`, `canvas-service.ts`)
- RAG query engine core logic (`query-engine.ts`, `rag/`)
- Data transformation and storage modules (`storage.ts`, `student-profile.ts`)
- OpenAI API server contract compliance (`openai-api-server.ts`)

**Example Tests:**
- Canvas API response parsing and error handling
- Vector store query and retrieval accuracy
- Student profile data normalization
- OpenAI API endpoint request/response validation
- Core business logic unit tests (assignments, grades, deadlines)

**Expected Runtime:** 2-3 minutes
**Pass/Fail Criteria:**
- ✅ Pass: >85% unit test coverage on core modules, all mocked external calls succeed
- ❌ Fail: <80% coverage or critical business logic failures

**NPM Command:** `npm run test:unit-quick`
**Implementation:** `jest-test-engineer` mode

---

### Phase 3: Smoke (Quick Health Check)
**Objective:** Rapid validation that all major system components can initialize and respond.

**Scope:**
- Service startup and configuration loading
- Database connectivity (ChromaDB/vector store)
- LLM engine availability (Ollama/vLLM health checks)
- API server basic response validation
- Critical environment variable presence

**Example Tests:**
- Express server starts and responds to health endpoint
- Vector store connection and basic query execution
- LLM engine ping/status check
- Configuration file parsing validation
- Docker container health (if containerized testing)

**Expected Runtime:** 30-60 seconds
**Pass/Fail Criteria:**
- ✅ Pass: All services start successfully, health endpoints respond HTTP 200
- ❌ Fail: Any core service fails to start or health check returns error

**How to run quick suite:**
```bash
npx jest --testPathPatterns=^test/smoke/ --runInBand
npx jest --testPathPattern=^test/integration/ --runInBand
```

**NPM Command:** `npm run test:smoke`
**Implementation:** `jest-test-engineer` mode

---

### Phase 4: Focused Integration (RAG/Query Flows)
**Objective:** Validate end-to-end RAG functionality and query processing pipelines.

**Scope:**
- Canvas data ingestion and vector embedding pipeline
- RAG query processing with real embeddings
- Query engine integration with multiple LLM backends
- Student profile construction and context assembly
- Multi-turn conversation handling

**Example Tests:**
- End-to-end Canvas data sync → vector storage → retrieval flow
- Query processing: "What assignments are due this week?" with mock Canvas data
- RAG context assembly and LLM prompt generation
- Response quality validation for typical student queries
- Performance benchmarking for query response times

**Expected Runtime:** 5-8 minutes
**Pass/Fail Criteria:**
- ✅ Pass: Query flows complete successfully, responses contain relevant Canvas data
- ❌ Fail: RAG pipeline failures, empty responses, or >10s query response times

**NPM Command:** `npm run test:focus`
**Implementation:** `jest-test-engineer` mode with some integration setup

---

### Phase 5: Post-deploy Verification (ConPort User-Story Queries)
**Objective:** Validate deployment using real-world user scenarios from the canonical ConPort query set.

**Scope:**
- Execute selected ConPort user-story queries against live deployment
- Verify responses contain expected Canvas data elements
- Validate user experience quality and response coherence
- Check system performance under realistic query load

**Example Tests:**
- Execute each selected ConPort query and validate response structure
- Verify grade calculation accuracy in responses
- Confirm assignment deadline detection and prioritization
- Validate cross-class performance comparison functionality

**Expected Runtime:** 3-5 minutes
**Pass/Fail Criteria:**
- ✅ Pass: All selected queries return relevant responses with Canvas data
- ❌ Fail: Any query fails, returns empty response, or contains factual errors

**Direct CLI Usage:** `npx node scripts/postdeploy-check.cjs --url https://your-deployed-app.example/api/query`
**NPM Command:** `npm run test:postdeploy`
**Implementation:** `jest-test-engineer` mode with live environment setup

---

## Test Matrix

| Suite Name | Target Files/Modules | Est. Tests | Runtime | Implementer | Acceptance Check |
|------------|---------------------|------------|---------|-------------|------------------|
| Discovery & Audit | `src/**/*.ts`, coverage reports | 5-10 | 5-10 min | jest-test-engineer | Coverage report generated, gaps documented |
| Unit + Contract | `canvas-client.ts`, `query-engine.ts`, `openai-api-server.ts`, `rag/*.ts` | 25-35 | 2-3 min | jest-test-engineer | >85% coverage, all mocked externals pass |
| Smoke Tests | Service startup, health endpoints | 8-12 | 30-60 sec | jest-test-engineer | All services start, health checks return 200 |
| Focused Integration | End-to-end RAG flows, Canvas integration | 15-20 | 5-8 min | jest-test-engineer | Query flows complete, relevant responses |
| Post-deploy Verification | ConPort user-story queries | 6-8 | 3-5 min | jest-test-engineer | All queries return valid Canvas data |

**Total Estimated Tests:** 59-85 tests  
**Total Estimated Runtime:** 15-27 minutes

---

## Recommended ConPort User-Story Queries for Post-Deploy Smoke Tests

From [`test/conport_user_story_queries.json`](../test/conport_user_story_queries.json), the following 6 queries are recommended for post-deploy verification:

### Selected Queries:

1. **`user_provided_list:2`** - *"What assignments are overdue and how badly is that hurting my grades?"*
   - **Rationale:** Tests overdue detection, grade impact calculation, and multi-assignment analysis
   - **Acceptance:** Identifies specific overdue assignments with estimated grade impact

2. **`user_provided_list:4`** - *"How am I doing in Spanish compared to my other classes?"*
   - **Rationale:** Validates cross-class performance comparison and relative standing analysis
   - **Acceptance:** Compares Spanish performance metrics against other classes with relative standings

3. **`user_provided_list:7`** - *"What's due this week that I haven't started yet?"*
   - **Rationale:** Tests deadline filtering, progress tracking, and time-based query processing
   - **Acceptance:** Shows this week's deadlines with progress status, flags unstarted items

4. **`user_provided_list:9`** - *"What homework can I actually get done tonight vs what needs more time?"*
   - **Rationale:** Validates task effort estimation and time-constraint filtering
   - **Acceptance:** Splits tasks by estimated completion time with realistic tonight/later categorization

5. **`user_provided_list:13`** - *"I have 3 hours to study tonight - what will help my grades the most?"*
   - **Rationale:** Tests study optimization, time-budget constraints, and grade impact prioritization
   - **Acceptance:** Prioritizes study activities by grade benefit within 3-hour constraint

6. **`user_provided_list:5`** - *"Are there any big projects coming up that I should start working on now?"*
   - **Rationale:** Validates future planning, project detection, and lead-time recommendations
   - **Acceptance:** Lists upcoming large projects with actionable start recommendations

### Alternative Queries (if primary set fails):
- **`user_provided_list:1`** - *"What should I work on first this weekend?"* (general prioritization)
- **`user_provided_list:8`** - *"Are there any tests or quizzes I should be studying for?"* (assessment detection)

---

## Risk Mitigation Strategies

### High-Risk Areas:
1. **External Service Dependencies**
   - **Risk:** Canvas API, Ollama/vLLM, ChromaDB unavailability during tests
   - **Mitigation:** Mock external services for unit/integration tests; separate live service tests

2. **Flaky Vector Search Results**
   - **Risk:** Embedding similarity scores vary between test runs
   - **Mitigation:** Use deterministic test data; validate response structure over exact content

3. **Long-Running LLM Inference**
   - **Risk:** LLM response generation causes test timeouts
   - **Mitigation:** Implement test timeouts; use smaller/faster models for testing

4. **Canvas Data Variability**
   - **Risk:** Test results depend on specific Canvas course data
   - **Mitigation:** Create standardized test dataset; mock Canvas responses for consistent testing

### Performance Considerations:
- **Parallel Test Execution:** Enable Jest parallel runners for unit tests
- **Test Data Caching:** Cache vector embeddings and Canvas responses between test runs
- **CI Optimization:** Use Docker layer caching for faster CI build times

---

## Implementation Assignment by Mode

| Test Category | Recommended Mode | Primary Responsibilities |
|---------------|------------------|-------------------------|
| Unit + Contract Tests | `jest-test-engineer` | Write Jest tests, setup mocks, coverage analysis |
| Smoke Tests | `jest-test-engineer` | Health checks, service startup validation |
| Integration Tests | `jest-test-engineer` | End-to-end flows, RAG pipeline testing |
| CI/CD Scripts | `devops` | NPM script configuration, CI pipeline setup |
| Documentation | `documentation-writer` | Test documentation, runbook creation |
| Performance Benchmarks | `jest-test-engineer` | Query response time validation, load testing |

---

## NPM Scripts (Proposed)

**Note:** These commands are proposed for implementation in `package.json`. Current scripts: `test`, `test:watch`, `test:coverage`.

```bash
# Quick development validation
npm run test:unit-quick    # Phase 2: Unit + Contract tests only
npm run test:smoke         # Phase 3: Basic health checks

# Comprehensive testing
npm run test:focus         # Phase 4: Integration and RAG flows  
npm run test:postdeploy    # Phase 5: ConPort user-story verification

# CI/CD pipeline commands
npm run test:ci            # All phases except post-deploy
npm run test:full          # All phases including post-deploy
```

---

## Acceptance Criteria for Testing Strategy

**The testing strategy is considered successful when:**

✅ **Green Status Indicators:**
1. All 5 test phases can be executed independently and in sequence
2. Phase 2-4 complete in <10 minutes combined for rapid developer feedback
3. Post-deploy verification successfully executes all 6 selected ConPort queries
4. Test failure provides actionable debugging information (specific module/query failures)
5. CI/CD pipeline can execute full test suite and report results
6. Test coverage reports identify gaps and improvements needed
7. No false positives: test failures indicate actual functional problems

❌ **Failure Conditions:**
- Any phase cannot be executed due to configuration issues
- Post-deploy queries fail to return relevant Canvas data
- Test runtime exceeds 30 minutes for full suite
- High false positive rate (>10% of failures are spurious)

---

## Next Steps

1. **Immediate (next sprint):** Implement Phase 2 & 3 tests for rapid feedback
2. **Short-term (2-3 sprints):** Complete Phase 4 integration tests and CI setup
3. **Long-term (ongoing):** Refine ConPort query validation and expand coverage

This testing strategy prioritizes practical, actionable validation that supports both development velocity and deployment confidence for the canvasCheckerBot project.
## TODO: Re-enable executeWithRetry backoff tests
- [ ] Re-enable and fix the retry/backoff tests in [`test/unit/canvas-client.executeWithRetry.test.ts`](test/unit/canvas-client.executeWithRetry.test.ts:1). These are currently skipped due to timing/fake-timer issues. Suggested fixes:
  - Make `executeWithRetry` test-friendly by injecting a delay/sleep function (default: setTimeout) that tests can stub.
  - Or update tests to use fake timers + `jest.runAllTimersAsync()` / `jest.advanceTimersByTime()` reliably.
  - Add a short follow-up task to re-enable the skipped tests and verify exponential backoff and Retry-After behavior.
# Loop Detection in Workflow Execution Engine

Add a configurable loop guard to [processStep](file:///d:/project%201/backend/src/execution/execution.service.ts#71-165). If any single step is visited more than `MAX_LOOP_ITERATIONS` times within the same execution call chain, the engine stops, logs the error, and marks the execution as `FAILED`.

## Proposed Changes

### Execution Engine

#### [MODIFY] [execution.service.ts](file:///d:/project%201/backend/src/execution/execution.service.ts)

- Add `MAX_LOOP_ITERATIONS = 10` constant at the top of the file
- At the start of [processStep](file:///d:/project%201/backend/src/execution/execution.service.ts#71-165), fetch a **step visit counter map** from the execution's stored `data` field (namespace key `__loopCounters`)
- Increment the counter for the current `stepId`
- If the counter exceeds `MAX_LOOP_ITERATIONS`, **throw** a descriptive `Error` before any other processing — the existing `catch` block then:
  - Creates an `ExecutionLog` with `status: 'failed'` and `errorMessage` describing the loop
  - Updates the execution to `FAILED`
- Persist the updated counters back into `execution.data` via a `prisma.execution.update` before enqueuing the next step

> [!IMPORTANT]
> The counters are stored in `execution.data.__loopCounters` (a JSON field) so they survive across async worker invocations. This is the only reliable cross-job store without adding a new DB column.

---

### Unit Tests

#### [MODIFY] [execution.service.spec.ts](file:///d:/project%201/backend/src/execution/execution.service.spec.ts)

Add two new tests in a `processStep - loop detection` describe block:

1. **Should fail execution when a step is visited more than MAX_LOOP_ITERATIONS times** — seed `__loopCounters: { [stepId]: 10 }` in the mock execution data, call [processStep](file:///d:/project%201/backend/src/execution/execution.service.ts#71-165), assert that `executionLog.create` is called with `status: 'failed'` containing `"Loop detected"`, and `execution.update` is called with `status: 'FAILED'`.

2. **Should allow step within iteration limit** — seed `__loopCounters: { [stepId]: 5 }`, call [processStep](file:///d:/project%201/backend/src/execution/execution.service.ts#71-165), assert normal `'completed'` log is created.

## Verification Plan

### Automated Tests
```bash
cd backend
npm run test src/execution/execution.service.spec.ts
```
Both new tests plus all 15 existing tests must pass.

### Full Suite
```bash
npm run test
```
All 64 tests must pass (0 failures).

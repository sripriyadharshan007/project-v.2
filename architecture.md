# Workflow Automation Engine — System Architecture

## 1. Textual Explanation

The system is composed of four major layers that work together to define, manage, and execute automated workflows.

---

### Layer 1 — Frontend (Next.js)

The frontend is a **Next.js** web application that provides the visual interface for users to:

- Create and manage workflows and their steps/rules via REST API calls
- Visualise workflow graphs using **React Flow**
- Monitor execution status and browse execution logs in real time

It communicates with the backend exclusively via **HTTP REST APIs**, pointing to `http://localhost:3001`.

---

### Layer 2 — Backend API (NestJS)

The **NestJS** API is the backbone of the system. It exposes a clean REST interface and orchestrates all business logic through modular NestJS providers:

| Module | Responsibility |
|---|---|
| **Workflow Module** | CRUD for workflow definitions, input schemas, versioning |
| **Step Module** | CRUD for steps (task / approval / notification) linked to workflows |
| **Rule Module** | CRUD for JEXL-based conditional rules attached to steps |
| **Execution Module** | Starts executions, manages state, exposes cancel/retry endpoints |
| **Rule Engine** | Evaluates JEXL rule conditions against runtime context data |
| **Logs Module** | Creates and queries per-step `ExecutionLog` audit records |
| **Queue Module** | Wraps BullMQ to enqueue and cancel step processing jobs |

Swagger UI is available at `/api-docs`.

---

### Layer 3 — Workflow Engine (Execution Core)

When a workflow is executed, the engine follows this deterministic loop:

1. **Validate** the input against the workflow's `inputSchema`
2. **Create** an [Execution](file:///d:/project%201/backend/src/execution/execution.service.ts#24-68) record (status: `RUNNING`)
3. **Enqueue** the start step as a BullMQ job in Redis
4. **Worker** picks up the job, fetches the step and its rules
5. **Rule Engine** evaluates each rule (sorted by priority) using JEXL
6. The **first matching rule** determines `nextStepId`; if no rules match, the **DEFAULT** rule is used
7. If `nextStepId` is `null` → execution ends (`COMPLETED`)
8. Otherwise → update `currentStepId` and enqueue the next step
9. An **`ExecutionLog`** is written for every step with rule results, timestamps, and any errors

On failure, the step is logged as `failed`, the execution is marked `FAILED`, and the user can trigger a retry.

---

### Layer 4 — Database (PostgreSQL via Prisma)

All state is persisted in **PostgreSQL** through the **Prisma ORM**:

- `workflows`, `steps`, `rules` — workflow definitions
- `executions` — live execution state tracking
- `execution_logs` — immutable audit trail per step

---

### Layer 5 — Queue System (BullMQ + Redis)

**BullMQ** backed by **Redis** handles asynchronous, reliable step processing:

- Jobs are not lost on server restart (Redis persistence)
- Built-in retry support with configurable backoff
- The [ExecutionWorker](file:///d:/project%201/backend/src/execution/execution.worker.ts#17-42) is a `@Processor('workflow_queue')` that processes one step at a time

---

## 2. Architecture Diagram

```mermaid
flowchart TB
    subgraph FE["🖥️ Frontend — Next.js (port 3000)"]
        UI["Workflow Builder UI\n(React Flow)"]
        Pages["Pages: Workflows / Executions / Logs"]
    end

    subgraph API["⚙️ Backend API — NestJS (port 3001)"]
        direction TB
        WF["Workflow Module\n/workflows"]
        ST["Step Module\n/workflows/:id/steps"]
        RL["Rule Module\n/steps/:id/rules"]
        EX["Execution Module\n/workflows/:id/execute"]
        RE["Rule Engine\n(JEXL evaluator)"]
        LG["Logs Module\n(Audit trail)"]
        QU["Queue Module\n(BullMQ wrapper)"]
        WK["Execution Worker\n@Processor('workflow_queue')"]
    end

    subgraph DB["🗄️ PostgreSQL (port 5432)"]
        T1[("workflows")]
        T2[("steps")]
        T3[("rules")]
        T4[("executions")]
        T5[("execution_logs")]
    end

    subgraph RD["🔴 Redis (port 6379)"]
        Q["workflow_queue\n(BullMQ jobs)"]
    end

    %% Frontend → Backend
    UI -->|REST API calls| API
    Pages -->|REST API calls| API

    %% API internal flow
    EX -->|"1. create Execution"| DB
    EX -->|"2. enqueueStep()"| QU
    QU -->|"add job"| Q
    Q  -->|"consume job"| WK
    WK -->|"fetchStep + rules"| DB
    WK -->|"evaluateRules()"| RE
    RE -->|"matched rule"| WK
    WK -->|"write ExecutionLog"| LG
    LG -->|"persist"| DB
    WK -->|"enqueue next step"| QU

    %% Module to DB
    WF -->|Prisma| T1
    ST -->|Prisma| T2
    RL -->|Prisma| T3
    EX -->|Prisma| T4

    %% Styles
    classDef fe fill:#6366f1,color:#fff,stroke:#4338ca
    classDef api fill:#0f172a,color:#fff,stroke:#334155
    classDef db fill:#065f46,color:#fff,stroke:#047857
    classDef rd fill:#7f1d1d,color:#fff,stroke:#991b1b

    class FE fe
    class API api
    class DB db
    class RD rd
```

---

## 3. Request Lifecycle (Sequence)

```mermaid
sequenceDiagram
    participant Client
    participant API as NestJS API
    participant DB as PostgreSQL
    participant Queue as Redis / BullMQ
    participant Worker as ExecutionWorker
    participant Engine as RuleEngine

    Client->>API: POST /workflows/:id/execute { amount: 250, priority: "High" }
    API->>DB: Create Execution (status: RUNNING)
    API->>Queue: Enqueue step job { executionId, stepId }
    API-->>Client: 201 { execution }

    Queue->>Worker: Dequeue job
    Worker->>DB: Fetch Step + Rules
    Worker->>Engine: evaluateRules(rules, context)
    Engine-->>Worker: matched Rule → nextStepId
    Worker->>DB: Write ExecutionLog (status: completed)
    Worker->>DB: Update Execution.currentStepId
    Worker->>Queue: Enqueue next step job

    Note over Worker,Queue: Repeat until nextStepId is null

    Worker->>DB: Update Execution (status: COMPLETED)
```

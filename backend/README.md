# Workflow Automation Engine — Backend

A production-grade **Workflow Automation Engine** built with **NestJS**, **Prisma ORM**, **PostgreSQL**, and **Redis**. It allows users to define workflows with steps and conditional rules, execute them asynchronously via a job queue, and trace every step through detailed execution logs.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [System Architecture](#system-architecture)
4. [Installation Guide](#installation-guide)
5. [Environment Variables](#environment-variables)
6. [Database Setup](#database-setup)
7. [Running the Backend](#running-the-backend)
8. [Running Tests](#running-tests)
9. [API Endpoints](#api-endpoints)
10. [Example Workflow](#example-workflow)
11. [Example Execution](#example-execution)
12. [Execution Logs Example](#execution-logs-example)
13. [Project Folder Structure](#project-folder-structure)

---

## Project Overview

This engine enables users to:

- **Define workflows** with named steps (approval, notification, task)
- **Attach conditional rules** to steps using JEXL expressions
- **Execute workflows** asynchronously with input data
- **Trace execution** step-by-step with detailed logs of rule evaluations and outcomes

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [NestJS](https://nestjs.com/) (Node.js) |
| Language | TypeScript |
| ORM | [Prisma](https://www.prisma.io/) |
| Database | PostgreSQL 15 |
| Queue | [BullMQ](https://docs.bullmq.io/) + Redis 7 |
| Rules Engine | [JEXL](https://github.com/TomFrost/Jexl) |
| API Docs | [Swagger / OpenAPI](https://swagger.io/) |
| Testing | [Jest](https://jestjs.io/) |
| Containerisation | Docker + Docker Compose |

---

## System Architecture

```
┌──────────────┐     POST /execute     ┌────────────────────┐
│   Client     │──────────────────────▶│  ExecutionService  │
└──────────────┘                       └────────┬───────────┘
                                                │ enqueue job
                                       ┌────────▼───────────┐
                                       │    BullMQ Queue     │
                                       │   (Redis-backed)    │
                                       └────────┬───────────┘
                                                │ process job
                                       ┌────────▼───────────┐
                                       │  ExecutionWorker   │
                                       └────────┬───────────┘
                                                │
                         ┌──────────────────────┼──────────────────────┐
                         ▼                      ▼                      ▼
               ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
               │  RuleEngine      │  │  Prisma / PG DB  │  │  ExecutionLog    │
               │  (JEXL eval)     │  │  (state storage) │  │  (audit trail)   │
               └──────────────────┘  └──────────────────┘  └──────────────────┘
```

**Execution flow:**
1. Client calls `POST /workflows/:id/execute` with input data
2. An `Execution` record is created (status: `RUNNING`)
3. The first step is enqueued as a BullMQ job
4. The Worker processes the step, evaluates rules via JEXL
5. The matched rule determines the next step (or ends the workflow)
6. An `ExecutionLog` entry is written for every step
7. On completion, the execution status is set to `COMPLETED`

---

## Installation Guide

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [Docker Desktop](https://docs.docker.com/engine/install/) (for PostgreSQL & Redis)

### Steps

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd backend

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env
# Edit .env with your values (see Environment Variables below)

# 4. Start infrastructure (PostgreSQL + Redis)
docker-compose up -d postgres redis

# 5. Run database migrations
npx prisma migrate dev

# 6. (Optional) Seed sample data
npx ts-node prisma/seed.ts

# 7. Start the dev server
npm run start:dev
```

---

## Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# PostgreSQL connection string
DATABASE_URL="postgresql://admin:password123@localhost:5432/workflow_engine?schema=public"

# Redis connection string (used by BullMQ)
REDIS_URL="redis://localhost:6379"

# API server port
PORT=3001
```

---

## Database Setup

```bash
# Apply all pending migrations
npx prisma migrate dev

# Generate the Prisma client after schema changes
npx prisma generate

# Seed the database with sample workflows
npx ts-node prisma/seed.ts

# Open Prisma Studio (GUI for the database)
npx prisma studio
```

### Database Models

| Model | Purpose |
|---|---|
| `Workflow` | Top-level workflow definition with input schema |
| `Step` | Individual step (task / approval / notification) |
| `Rule` | JEXL condition on a step determining the next step |
| `Execution` | A running instance of a workflow |
| `ExecutionLog` | Per-step audit log of every execution |

---

## Running the Backend

```bash
# Development (watch mode with hot-reload)
npm run start:dev

# Production build
npm run build
npm run start:prod
```

API is available at: **`http://localhost:3001`**  
Swagger docs at: **`http://localhost:3001/api-docs`**

---

## Running Tests

```bash
# Run all unit tests
npm run test

# Watch mode
npm run test:watch

# Generate coverage report
npm run test:cov
```

Test files live alongside their service files as `*.spec.ts`.

---

## API Endpoints

### Workflows

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/workflows` | Create a new workflow |
| `GET` | `/workflows` | List all workflows (paginated) |
| `GET` | `/workflows/:id` | Get workflow by ID |
| `PUT` | `/workflows/:id` | Update a workflow |
| `DELETE` | `/workflows/:id` | Delete a workflow |

### Steps

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/workflows/:workflow_id/steps` | Add a step to a workflow |
| `GET` | `/workflows/:workflow_id/steps` | List steps for a workflow |
| `PUT` | `/steps/:id` | Update a step |
| `DELETE` | `/steps/:id` | Delete a step |

### Rules

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/steps/:step_id/rules` | Add a rule to a step |
| `GET` | `/steps/:step_id/rules` | List rules for a step |
| `PUT` | `/rules/:id` | Update a rule |
| `DELETE` | `/rules/:id` | Delete a rule |

### Execution

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/workflows/:workflow_id/execute` | Start a workflow execution |
| `GET` | `/executions/:id` | Get execution status and logs |
| `POST` | `/executions/:id/cancel` | Cancel a running execution |
| `POST` | `/executions/:id/retry` | Retry a failed execution |

---

## Example Workflow

**Expense Approval** workflow with 4 steps and conditional routing:

```
Manager Approval ──┬──(amount > 100 && priority == "High")──▶ Finance Notification
                   ├──(amount <= 100)──▶ CEO Approval
                   └──(DEFAULT)──▶ Task Rejection
```

### 1. Create Workflow

```bash
curl -X POST http://localhost:3001/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Expense Approval",
    "inputSchema": {
      "amount":   { "type": "number" },
      "country":  { "type": "string" },
      "priority": { "type": "string" }
    }
  }'
```

### 2. Add Steps

```bash
curl -X POST http://localhost:3001/workflows/<WORKFLOW_ID>/steps \
  -H "Content-Type: application/json" \
  -d '{ "name": "Manager Approval", "stepType": "APPROVAL", "order": 1 }'
```

Repeat for `Finance Notification` (NOTIFICATION), `CEO Approval` (APPROVAL), `Task Rejection` (TASK).

### 3. Add Rules to Manager Approval Step

```bash
# Rule 1 — High expense
curl -X POST http://localhost:3001/steps/<MANAGER_STEP_ID>/rules \
  -H "Content-Type: application/json" \
  -d '{
    "condition": "amount > 100 && priority == \"High\"",
    "nextStepId": "<FINANCE_STEP_ID>",
    "priority": 1
  }'

# Rule 2 — Low expense
curl -X POST http://localhost:3001/steps/<MANAGER_STEP_ID>/rules \
  -H "Content-Type: application/json" \
  -d '{
    "condition": "amount <= 100",
    "nextStepId": "<CEO_STEP_ID>",
    "priority": 2
  }'

# Rule 3 — Default fallback
curl -X POST http://localhost:3001/steps/<MANAGER_STEP_ID>/rules \
  -H "Content-Type: application/json" \
  -d '{
    "condition": "true",
    "nextStepId": "<REJECTION_STEP_ID>",
    "priority": 3,
    "isDefault": true
  }'
```

---

## Example Execution

```bash
curl -X POST http://localhost:3001/workflows/<WORKFLOW_ID>/execute \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 250,
    "country": "US",
    "priority": "High"
  }'
```

**Response:**

```json
{
  "id": "exec-uuid",
  "workflowId": "wf-uuid",
  "status": "RUNNING",
  "data": { "amount": 250, "country": "US", "priority": "High" },
  "startedAt": "2026-03-16T08:00:00.000Z"
}
```

**Expected path:** `Manager Approval → Finance Notification → (end)`

---

## Execution Logs Example

```bash
curl http://localhost:3001/executions/<EXECUTION_ID>
```

**Response includes logs:**

```json
{
  "id": "exec-uuid",
  "status": "COMPLETED",
  "logs": [
    {
      "stepName": "Manager Approval",
      "stepType": "APPROVAL",
      "status": "completed",
      "evaluatedRules": [
        { "rule": "amount > 100 && priority == \"High\"", "result": true }
      ],
      "selectedNextStep": "Finance Notification",
      "startedAt": "2026-03-16T08:00:00.000Z",
      "endedAt": "2026-03-16T08:00:01.200Z"
    },
    {
      "stepName": "Finance Notification",
      "stepType": "NOTIFICATION",
      "status": "completed",
      "evaluatedRules": [],
      "selectedNextStep": null,
      "startedAt": "2026-03-16T08:00:01.200Z",
      "endedAt": "2026-03-16T08:00:02.000Z"
    }
  ]
}
```

---

## Project Folder Structure

```
backend/
├── prisma/
│   ├── schema.prisma           # Database models
│   ├── seed.ts                 # Sample workflow seed data
│   └── migrations/             # Prisma migration history
│
├── src/
│   ├── app.module.ts           # Root application module
│   ├── main.ts                 # Application entry point (Swagger, CORS)
│   │
│   ├── prisma/                 # PrismaService (DB client wrapper)
│   │
│   ├── workflow/               # Workflow CRUD module
│   │   ├── workflow.controller.ts
│   │   ├── workflow.service.ts
│   │   ├── workflow.repository.ts
│   │   ├── workflow.module.ts
│   │   └── dto/workflow.dto.ts
│   │
│   ├── steps/                  # Step management module
│   │   ├── steps.controller.ts
│   │   ├── steps.service.ts
│   │   ├── steps.module.ts
│   │   └── dto/steps.dto.ts
│   │
│   ├── rules/                  # Rule management module
│   │   ├── rules.controller.ts
│   │   ├── rules.service.ts
│   │   ├── rules.module.ts
│   │   └── dto/rules.dto.ts
│   │
│   ├── rule-engine/            # JEXL-based rule evaluator
│   │   ├── rule-engine.service.ts
│   │   ├── rule-engine.module.ts
│   │   └── rule-engine.service.spec.ts
│   │
│   ├── execution/              # Workflow execution engine
│   │   ├── execution.controller.ts
│   │   ├── execution.service.ts
│   │   ├── execution.worker.ts  # BullMQ job processor
│   │   ├── execution.module.ts
│   │   └── execution.service.spec.ts
│   │
│   ├── logs/                   # Execution log module
│   │   ├── logs.service.ts
│   │   ├── logs.module.ts
│   │   └── logs.service.spec.ts
│   │
│   └── queue/                  # BullMQ queue configuration
│       ├── queue.service.ts
│       └── queue.module.ts
│
├── .env                        # Environment variables (not committed)
├── nest-cli.json
├── tsconfig.json
├── package.json
└── Dockerfile
```

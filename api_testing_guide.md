# API Testing Guide - Workflow Execution Flow

This guide provides Step-by-step instructions for testing the Expense Approval workflow using cURL. Since UUIDs are dynamically generated at each step, you will need to replace the placeholder UUIDs in subsequent steps with the actual IDs from the previous API responses.

### Base URL
`http://localhost:3001` (Assuming you are running the backend via `npm run start:dev` or docker)

---

## Step 1 — Create Workflow
Endpoint: `POST /workflows`

```bash
curl -X POST http://localhost:3001/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Expense Approval",
    "isActive": true,
    "inputSchema": {
      "amount": {"type": "number", "required": true},
      "country": {"type": "string", "required": true},
      "priority": {"type": "string", "required": true}
    }
  }'
```
> **Action Required**: Save the returned workflow `id` (e.g., `WORKFLOW_ID`) for the next steps.

---

## Step 2 — Add Steps
Endpoint: `POST /workflows/:workflow_id/steps`

Add these 4 steps one by one using your `WORKFLOW_ID` in the URL.

**1. Manager Approval**
```bash
curl -X POST http://localhost:3001/workflows/<WORKFLOW_ID>/steps \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Manager Approval",
    "stepType": "APPROVAL",
    "order": 1
  }'
```
> **Action Required**: Save the returned step `id` as `MANAGER_APPROVAL_STEP_ID`

**2. Finance Notification**
```bash
curl -X POST http://localhost:3001/workflows/<WORKFLOW_ID>/steps \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Finance Notification",
    "stepType": "NOTIFICATION",
    "order": 2
  }'
```
> **Action Required**: Save the returned step `id` as `FINANCE_NOTIFICATION_STEP_ID`

**3. CEO Approval**
```bash
curl -X POST http://localhost:3001/workflows/<WORKFLOW_ID>/steps \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CEO Approval",
    "stepType": "APPROVAL",
    "order": 3
  }'
```
> **Action Required**: Save the returned step `id` as `CEO_APPROVAL_STEP_ID`

**4. Task Rejection**
```bash
curl -X POST http://localhost:3001/workflows/<WORKFLOW_ID>/steps \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Task Rejection",
    "stepType": "TASK",
    "order": 4
  }'
```
> **Action Required**: Save the returned step `id` as `TASK_REJECTION_STEP_ID`

---

## Step 2.5 — Set the Workflow Start Step
*(Optional, but recommended so execution engine knows where to begin if not explicitly provided or defaulted)*
Endpoint: `PUT /workflows/:workflow_id`

```bash
curl -X PUT http://localhost:3001/workflows/<WORKFLOW_ID> \
  -H "Content-Type: application/json" \
  -d '{
    "startStepId": "<MANAGER_APPROVAL_STEP_ID>"
  }'
```

---

## Step 3 — Add Rules
Endpoint: `POST /steps/:step_id/rules`

We are adding these rules to the **Manager Approval** step.

**Rule 1: Priority 1 (High Expense)**
```bash
curl -X POST http://localhost:3001/steps/<MANAGER_APPROVAL_STEP_ID>/rules \
  -H "Content-Type: application/json" \
  -d '{
    "condition": "amount > 100 && priority == \"High\"",
    "nextStepId": "<FINANCE_NOTIFICATION_STEP_ID>",
    "priority": 1
  }'
```

**Rule 2: Priority 2 (Low Expense)**
```bash
curl -X POST http://localhost:3001/steps/<MANAGER_APPROVAL_STEP_ID>/rules \
  -H "Content-Type: application/json" \
  -d '{
    "condition": "amount <= 100",
    "nextStepId": "<CEO_APPROVAL_STEP_ID>",
    "priority": 2
  }'
```

**Rule 3: Default (Fallback)**
```bash
curl -X POST http://localhost:3001/steps/<MANAGER_APPROVAL_STEP_ID>/rules \
  -H "Content-Type: application/json" \
  -d '{
    "condition": "true",
    "nextStepId": "<TASK_REJECTION_STEP_ID>",
    "priority": 3,
    "isDefault": true
  }'
```
*(Note: "true" condition works gracefully for fallback defaults, but `isDefault: true` explicitly flags it for the engine if no other rules match).*

---

## Step 4 — Execute Workflow
Endpoint: `POST /workflows/:workflow_id/execute`

Now provide the test payload to evaluate your rule engine and logic.

```bash
curl -X POST http://localhost:3001/workflows/<WORKFLOW_ID>/execute \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 250,
    "country": "US",
    "priority": "High"
  }'
```

The response will immediately return an `Execution` object containing its generated `id` and status `PENDING` (since it executes asynchronously with BullMQ). 

> **Action Required**: Save the returned execution `id` as `EXECUTION_ID`

---

## Step 5 — Verify Execution Logs
Endpoint: `GET /executions/:id`

To view how your workflow was executed and trace the steps and evaluated rules in real-time.

```bash
curl -X GET http://localhost:3001/executions/<EXECUTION_ID>
```

**Expected Execution Path logs in response:**
1. Manager Approval
2. Finance Notification *(due to "amount > 100 && priority == High")*
3. CEO Approval *(assuming Finance Notification transitions here)*
4. Completed

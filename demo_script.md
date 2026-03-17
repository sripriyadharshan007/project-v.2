# 🎬 Demo Script — Workflow Automation Engine
**Duration:** ~3–5 minutes

---

## [INTRO — 0:00–0:30]

> *Show the app homepage / dashboard at `http://localhost:3000`*

**Narration:**
> "Welcome to the Workflow Automation Engine — a full-stack system for defining, executing, and tracking automated business processes.
>
> Built with NestJS on the backend and Next.js on the frontend, the engine lets you create multi-step workflows with conditional routing rules and execute them asynchronously using a Redis-backed job queue.
>
> In this demo, we'll walk through a complete end-to-end example: an **Expense Approval** workflow."

---

## [STEP 1 — Create a Workflow — 0:30–1:00]

> *Navigate to the Workflows page. Click **Create Workflow**.*

**Narration:**
> "Let's start by creating a new workflow. I'll click **Create Workflow** and give it the name **Expense Approval**.
>
> The workflow accepts three input fields: `amount`, `country`, and `priority` — these will be used by the rules engine later to decide which path to take."

> *Workflow card appears in the list.*

> "The workflow is created and listed here with a status of **Draft**. It's not active yet — we need to add steps first."

---

## [STEP 2 — Add Steps — 1:00–1:45]

> *Click into the workflow. Add steps one by one.*

**Narration:**
> "Now let's define the steps inside this workflow. I'll add four steps:
>
> **Step 1 — Manager Approval** — this is an `approval` type step. A manager reviews the expense.
>
> **Step 2 — Finance Notification** — a `notification` step. If the expense is high priority, finance is alerted.
>
> **Step 3 — CEO Approval** — another `approval` step for smaller expenses that need executive sign-off.
>
> **Step 4 — Task Rejection** — a `task` step that handles the default case and rejects the expense.
>
> Each step has a type, an order, and optional metadata describing the action it should take."

> *All four steps appear in the step list.*

---

## [STEP 3 — Add Rules — 1:45–2:45]

> *Select the Manager Approval step. Add three rules.*

**Narration:**
> "Now comes the powerful part — the **Rules Engine**.
>
> Rules are attached to steps and evaluated in priority order using **JEXL expressions** — a clean, readable condition language.
>
> For the **Manager Approval** step, I'll add three rules:
>
> **Rule 1 — priority 1:** `amount > 100 && priority == "High"` → routes to **Finance Notification**.
> This means: if the expense is over $100 AND marked High priority, escalate to Finance.
>
> **Rule 2 — priority 2:** `amount <= 100` → routes to **CEO Approval**.
> Small expenses go directly to the CEO.
>
> **Rule 3 — DEFAULT:** catches everything else and sends the request to **Task Rejection**.
> This is the fallback — marked with `isDefault: true`."

> *Three rules appear under Manager Approval.*

> "The engine evaluates these rules in order — the **first match wins**. If nothing matches, the default rule kicks in."

---

## [STEP 4 — Execute the Workflow — 2:45–3:30]

> *Click **Execute Workflow**. Enter input data in the form.*

**Narration:**
> "Now let's run this workflow. I'll click **Execute** and provide our test input:
>
> `amount: 250`, `country: US`, `priority: High`
>
> With this data, we'd expect Rule 1 to match — routing from Manager Approval to Finance Notification."

> *Execution is submitted. Response card shows status: `RUNNING`.*

> "The execution is created instantly. Notice the status is **RUNNING** — the engine has enqueued the first step as a background job in **BullMQ via Redis**.
>
> The backend worker picks it up, evaluates the rules, advances the state, and keeps going until there are no more steps."

> *Status updates to `COMPLETED` after a moment.*

> "And there it is — **COMPLETED**. Let's check the logs to see exactly what happened."

---

## [STEP 5 — View Execution Logs — 3:30–4:30]

> *Click into the execution. Scroll to the logs section.*

**Narration:**
> "Every step produces a detailed **Execution Log** entry — a full audit trail of the run.
>
> For the **Manager Approval** step, we can see:
> - `status: completed`
> - `evaluatedRules: [{ rule: 'amount > 100 && priority == "High"', result: true }]`
> - `selectedNextStep: Finance Notification`
> - Timestamps for `startedAt` and `endedAt`
>
> The rule engine evaluated the first rule, it matched, and the engine moved on to Finance Notification.
>
> The **Finance Notification** step ran next and completed with no further steps — so the workflow ended cleanly."

> *Show the full log list with both entries.*

> "This log is stored permanently in the database — giving you a complete, queryable history of every execution, which path was taken, what the rule results were, and any errors that occurred."

---

## [OUTRO — 4:30–5:00]

> *Return to the workflow list / dashboard.*

**Narration:**
> "To summarise — in just a few minutes we:
> - Created a workflow with a structured input schema
> - Defined 4 ordered steps across different step types
> - Wrote 3 conditional JEXL rules for smart routing
> - Executed the workflow with live data
> - And traced every decision through detailed execution logs
>
> The engine handles all the heavy lifting — async processing, rule evaluation, error recovery, and retries — so your business logic stays clean and testable.
>
> Thanks for watching!"

---

## ⏱ Timing Summary

| Segment | Time |
|---|---|
| Intro | 0:00 – 0:30 |
| Create Workflow | 0:30 – 1:00 |
| Add Steps | 1:00 – 1:45 |
| Add Rules | 1:45 – 2:45 |
| Execute Workflow | 2:45 – 3:30 |
| View Logs | 3:30 – 4:30 |
| Outro | 4:30 – 5:00 |

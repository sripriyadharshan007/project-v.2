import { PrismaClient, StepType } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Token helpers ─────────────────────────────────────────────────────────────
// Using symbolic token names so the intent of every step / rule linkage is clear.

async function seedExpenseApproval() {
  console.log('\n📋 Seeding: Expense Approval Workflow...');

  // ── 1. Create workflow (no startStepId yet – set after steps are created) ──
  const workflow = await prisma.workflow.create({
    data: {
      name: 'Expense Approval',
      version: 1,
      isActive: true,
      inputSchema: {
        type: 'object',
        properties: {
          amount:   { type: 'number',  required: true },
          country:  { type: 'string',  required: true },
          priority: { type: 'string',  required: true },
        },
        required: ['amount', 'country', 'priority'],
      },
    },
  });

  // ── 2. Create steps (ordered) ─────────────────────────────────────────────
  const stepManagerApproval = await prisma.step.create({
    data: {
      workflowId: workflow.id,
      name: 'Manager Approval',
      stepType: StepType.APPROVAL,
      order: 1,
      metadata: {
        description: 'Manager reviews and approves the expense request.',
        approverRole: 'manager',
        timeoutHours: 24,
      },
    },
  });

  const stepFinanceNotification = await prisma.step.create({
    data: {
      workflowId: workflow.id,
      name: 'Finance Notification',
      stepType: StepType.NOTIFICATION,
      order: 2,
      metadata: {
        description: 'Notifies the Finance team of the approved high-priority expense.',
        channel: 'email',
        template: 'finance_expense_alert',
      },
    },
  });

  const stepCeoApproval = await prisma.step.create({
    data: {
      workflowId: workflow.id,
      name: 'CEO Approval',
      stepType: StepType.APPROVAL,
      order: 3,
      metadata: {
        description: 'CEO reviews expenses under or equal to $100.',
        approverRole: 'ceo',
        timeoutHours: 48,
      },
    },
  });

  const stepTaskRejection = await prisma.step.create({
    data: {
      workflowId: workflow.id,
      name: 'Task Rejection',
      stepType: StepType.TASK,
      order: 4,
      metadata: {
        description: 'Marks the expense as rejected and notifies the submitter.',
        action: 'send_rejection_email',
      },
    },
  });

  // ── 3. Link start step ────────────────────────────────────────────────────
  await prisma.workflow.update({
    where: { id: workflow.id },
    data:  { startStepId: stepManagerApproval.id },
  });

  // ── 4. Rules for Manager Approval ─────────────────────────────────────────
  //   priority 1: amount > 100 AND priority is "High"  → Finance Notification
  //   priority 2: amount <= 100                        → CEO Approval
  //   priority 3: DEFAULT (isDefault: true)            → Task Rejection
  await prisma.rule.createMany({
    data: [
      {
        stepId:     stepManagerApproval.id,
        condition:  'amount > 100 && priority == "High"',
        nextStepId: stepFinanceNotification.id,
        priority:   1,
        isDefault:  false,
      },
      {
        stepId:     stepManagerApproval.id,
        condition:  'amount <= 100',
        nextStepId: stepCeoApproval.id,
        priority:   2,
        isDefault:  false,
      },
      {
        stepId:     stepManagerApproval.id,
        condition:  'true',           // always-true catch-all; flagged as default
        nextStepId: stepTaskRejection.id,
        priority:   3,
        isDefault:  true,
      },
    ],
  });

  console.log(`   ✅ Workflow:  ${workflow.name}  (id: ${workflow.id})`);
  console.log(`   ✅ Steps:     Manager Approval → Finance Notification → CEO Approval → Task Rejection`);
  console.log(`   ✅ Rules:     3 rules on "Manager Approval" step`);

  return workflow;
}

// ─────────────────────────────────────────────────────────────────────────────

async function seedEmployeeOnboarding() {
  console.log('\n📋 Seeding: Employee Onboarding Workflow...');

  // ── 1. Create workflow ────────────────────────────────────────────────────
  const workflow = await prisma.workflow.create({
    data: {
      name: 'Employee Onboarding',
      version: 1,
      isActive: true,
      inputSchema: {
        type: 'object',
        properties: {
          employeeName: { type: 'string', required: true },
          department:   { type: 'string', required: true },
          role:         { type: 'string', required: true },
          startDate:    { type: 'string', format: 'date', required: true },
        },
        required: ['employeeName', 'department', 'role', 'startDate'],
      },
    },
  });

  // ── 2. Create steps ───────────────────────────────────────────────────────
  const stepHrApproval = await prisma.step.create({
    data: {
      workflowId: workflow.id,
      name:       'HR Approval',
      stepType:   StepType.APPROVAL,
      order:      1,
      metadata: {
        description:  'HR reviews and approves the new employee record.',
        approverRole: 'hr_manager',
        timeoutHours: 24,
      },
    },
  });

  const stepItAccountCreation = await prisma.step.create({
    data: {
      workflowId: workflow.id,
      name:       'IT Account Creation',
      stepType:   StepType.TASK,
      order:      2,
      metadata: {
        description: 'Provisions email, Slack, JIRA, and GitHub accounts.',
        systems: ['email', 'slack', 'jira', 'github'],
        automatedAction: 'provision_accounts',
      },
    },
  });

  const stepWelcomeNotification = await prisma.step.create({
    data: {
      workflowId: workflow.id,
      name:       'Welcome Notification',
      stepType:   StepType.NOTIFICATION,
      order:      3,
      metadata: {
        description: 'Sends a welcome email with first-day instructions to the new employee.',
        channel:     'email',
        template:    'welcome_employee',
      },
    },
  });

  // ── 3. Link start step ────────────────────────────────────────────────────
  await prisma.workflow.update({
    where: { id: workflow.id },
    data:  { startStepId: stepHrApproval.id },
  });

  // ── 4. Rules → sequential default transitions ─────────────────────────────
  //   HR Approval     → (DEFAULT) → IT Account Creation
  //   IT Account Cre. → (DEFAULT) → Welcome Notification
  //   Welcome Notif.  → (DEFAULT) → null  (workflow ends)
  await prisma.rule.createMany({
    data: [
      {
        stepId:     stepHrApproval.id,
        condition:  'true',
        nextStepId: stepItAccountCreation.id,
        priority:   1,
        isDefault:  true,
      },
      {
        stepId:     stepItAccountCreation.id,
        condition:  'true',
        nextStepId: stepWelcomeNotification.id,
        priority:   1,
        isDefault:  true,
      },
      {
        stepId:     stepWelcomeNotification.id,
        condition:  'true',
        nextStepId: null,    // end of workflow
        priority:   1,
        isDefault:  true,
      },
    ],
  });

  console.log(`   ✅ Workflow:  ${workflow.name}  (id: ${workflow.id})`);
  console.log(`   ✅ Steps:     HR Approval → IT Account Creation → Welcome Notification`);
  console.log(`   ✅ Rules:     Sequential DEFAULT transitions on each step`);

  return workflow;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting database seed...');

  // ── Wipe existing data (safe order to respect FK constraints) ─────────────
  await prisma.executionLog.deleteMany();
  await prisma.execution.deleteMany();
  await prisma.rule.deleteMany();
  await prisma.step.deleteMany();
  await prisma.workflow.deleteMany();
  console.log('🗑️  Cleared existing data.');

  // ── Seed workflows ────────────────────────────────────────────────────────
  await seedExpenseApproval();
  await seedEmployeeOnboarding();

  // ── Summary ───────────────────────────────────────────────────────────────
  const [workflows, steps, rules] = await Promise.all([
    prisma.workflow.count(),
    prisma.step.count(),
    prisma.rule.count(),
  ]);

  console.log('\n🎉 Seeding complete!');
  console.log(`   📋 Workflows : ${workflows}`);
  console.log(`   🔧 Steps     : ${steps}`);
  console.log(`   📏 Rules     : ${rules}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

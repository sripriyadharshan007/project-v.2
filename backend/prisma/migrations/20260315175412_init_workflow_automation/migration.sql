-- CreateEnum
CREATE TYPE "StepType" AS ENUM ('TASK', 'APPROVAL', 'NOTIFICATION');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateTable
CREATE TABLE "workflows" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "input_schema" JSONB,
    "start_step_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "steps" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "step_type" "StepType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rules" (
    "id" UUID NOT NULL,
    "step_id" UUID NOT NULL,
    "condition" TEXT NOT NULL,
    "next_step_id" UUID,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executions" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "workflow_version" INTEGER NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "data" JSONB NOT NULL DEFAULT '{}',
    "current_step_id" UUID,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "triggered_by" UUID,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_logs" (
    "id" UUID NOT NULL,
    "execution_id" UUID NOT NULL,
    "step_id" UUID NOT NULL,
    "step_name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "evaluated_rules" JSONB,
    "selected_next_step" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflows_name_idx" ON "workflows"("name");

-- CreateIndex
CREATE INDEX "workflows_is_active_idx" ON "workflows"("is_active");

-- CreateIndex
CREATE INDEX "workflows_start_step_id_idx" ON "workflows"("start_step_id");

-- CreateIndex
CREATE INDEX "steps_workflow_id_idx" ON "steps"("workflow_id");

-- CreateIndex
CREATE INDEX "steps_step_type_idx" ON "steps"("step_type");

-- CreateIndex
CREATE INDEX "steps_workflow_id_order_idx" ON "steps"("workflow_id", "order");

-- CreateIndex
CREATE INDEX "rules_step_id_idx" ON "rules"("step_id");

-- CreateIndex
CREATE INDEX "rules_next_step_id_idx" ON "rules"("next_step_id");

-- CreateIndex
CREATE INDEX "rules_step_id_priority_idx" ON "rules"("step_id", "priority");

-- CreateIndex
CREATE INDEX "executions_workflow_id_idx" ON "executions"("workflow_id");

-- CreateIndex
CREATE INDEX "executions_status_idx" ON "executions"("status");

-- CreateIndex
CREATE INDEX "executions_current_step_id_idx" ON "executions"("current_step_id");

-- CreateIndex
CREATE INDEX "executions_triggered_by_idx" ON "executions"("triggered_by");

-- CreateIndex
CREATE INDEX "executions_workflow_id_status_idx" ON "executions"("workflow_id", "status");

-- CreateIndex
CREATE INDEX "execution_logs_execution_id_idx" ON "execution_logs"("execution_id");

-- CreateIndex
CREATE INDEX "execution_logs_step_id_idx" ON "execution_logs"("step_id");

-- CreateIndex
CREATE INDEX "execution_logs_execution_id_step_id_idx" ON "execution_logs"("execution_id", "step_id");

-- CreateIndex
CREATE INDEX "execution_logs_status_idx" ON "execution_logs"("status");

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_start_step_id_fkey" FOREIGN KEY ("start_step_id") REFERENCES "steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steps" ADD CONSTRAINT "steps_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_next_step_id_fkey" FOREIGN KEY ("next_step_id") REFERENCES "steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_current_step_id_fkey" FOREIGN KEY ("current_step_id") REFERENCES "steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

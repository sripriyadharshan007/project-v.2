'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { CheckCircle2, Bell, Wrench, Star } from 'lucide-react';

type StepType = 'TASK' | 'APPROVAL' | 'NOTIFICATION';

interface StepNodeData {
  label: string;
  stepType: StepType;
  isStartStep?: boolean;
}

// ── Per step-type config ──────────────────────────────────────────────────────

const CONFIG: Record<StepType, {
  icon: React.ElementType;
  border: string;
  bg: string;
  badge: string;
  badgeBg: string;
  glow: string;
}> = {
  TASK: {
    icon:     Wrench,
    border:   'border-indigo-500/60',
    bg:       'bg-indigo-500/10',
    badge:    'text-indigo-400',
    badgeBg:  'bg-indigo-500/20',
    glow:     'shadow-indigo-500/20',
  },
  APPROVAL: {
    icon:     CheckCircle2,
    border:   'border-amber-500/60',
    bg:       'bg-amber-500/10',
    badge:    'text-amber-400',
    badgeBg:  'bg-amber-500/20',
    glow:     'shadow-amber-500/20',
  },
  NOTIFICATION: {
    icon:     Bell,
    border:   'border-emerald-500/60',
    bg:       'bg-emerald-500/10',
    badge:    'text-emerald-400',
    badgeBg:  'bg-emerald-500/20',
    glow:     'shadow-emerald-500/20',
  },
};

// ─────────────────────────────────────────────────────────────────────────────

function StepNode({ data, selected }: NodeProps) {
  const { label, stepType, isStartStep } = data as unknown as StepNodeData;
  const cfg = CONFIG[stepType] ?? CONFIG.TASK;
  const Icon = cfg.icon;

  return (
    <div
      className={[
        'relative min-w-[180px] rounded-xl border-2 px-4 py-3 shadow-lg transition-all duration-200',
        cfg.border,
        cfg.bg,
        cfg.glow,
        selected
          ? 'ring-2 ring-white/30 scale-105'
          : 'hover:scale-[1.02] hover:shadow-xl',
      ].join(' ')}
    >
      {/* Start step badge */}
      {isStartStep && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
          <Star className="w-2.5 h-2.5" />
          START
        </span>
      )}

      {/* Icon + name */}
      <div className="flex items-center gap-2.5">
        <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${cfg.badgeBg}`}>
          <Icon className={`w-4 h-4 ${cfg.badge}`} />
        </div>
        <span className="text-sm font-semibold text-slate-100 leading-tight">
          {label}
        </span>
      </div>

      {/* Type badge */}
      <div className="mt-2">
        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${cfg.badgeBg} ${cfg.badge}`}>
          {stepType.toLowerCase()}
        </span>
      </div>

      {/* React Flow handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-slate-600 !border-2 !border-slate-400"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-slate-600 !border-2 !border-slate-400"
      />
    </div>
  );
}

export default memo(StepNode);

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import api from '@/lib/api';
import StepNode from '@/components/workflow-graph/StepNode';
import { ArrowLeft, Loader2, AlertCircle, Plus, X } from 'lucide-react';
import { buildGraphLayout } from '@/lib/graph-layout';

// ── Types ────────────────────────────────────────────────────────────────────

interface Step {
  id: string;
  name: string;
  stepType: 'TASK' | 'APPROVAL' | 'NOTIFICATION';
  order: number;
  metadata?: Record<string, any>;
}

interface Rule {
  id: string;
  stepId: string;
  condition: string;
  nextStepId: string | null;
  priority: number;
  isDefault: boolean;
}

interface Workflow {
  id: string;
  name: string;
  version: number;
  startStepId: string | null;
}

const nodeTypes = { stepNode: StepNode };

// ─────────────────────────────────────────────────────────────────────────────

export default function WorkflowGraphPage() {
  const params     = useParams();
  const router     = useRouter();
  const workflowId = params.id as string;

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [steps,    setSteps]    = useState<Step[]>([]);
  const [rules,    setRules]    = useState<Rule[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // UI State
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [isStepModalOpen, setIsStepModalOpen] = useState(false);

  // New Step Form
  const [newStepName, setNewStepName] = useState('');
  const [newStepType, setNewStepType] = useState<'TASK'|'APPROVAL'|'NOTIFICATION'>('TASK');
  
  // New Rule Form
  const [ruleCondition, setRuleCondition] = useState('');
  const [rulePriority, setRulePriority] = useState(1);
  const [ruleNextStep, setRuleNextStep] = useState<string>('');
  const [ruleIsDefault, setRuleIsDefault] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchWorkflow = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [wfRes, stepsRes] = await Promise.all([
        api.get<Workflow>(`/workflow/${workflowId}`),
        api.get<Step[]>(`/steps/workflow/${workflowId}`),
      ]);

      const wf       = wfRes.data;
      const stepList = stepsRes.data;

      setWorkflow(wf);
      setSteps(stepList);

      const rulesPerStep = await Promise.all(
        stepList.map((s) =>
          api.get<Rule[]>(`/rules/step/${s.id}`).then((r) => r.data),
        ),
      );
      const allRules = rulesPerStep.flat();
      setRules(allRules);

      // Build React Flow graph
      const rawNodes: Node[] = stepList.map((step) => ({
        id:   step.id,
        type: 'stepNode',
        data: {
          label:       step.name,
          stepType:    step.stepType,
          isStartStep: step.id === wf.startStepId,
        },
        position: { x: 0, y: 0 },
      }));

      const rawEdges: Edge[] = allRules
        .filter((r) => r.nextStepId !== null)
        .map((rule) => ({
          id:     `edge-${rule.id}`,
          source: rule.stepId,
          target: rule.nextStepId!,
          label:  rule.isDefault
            ? 'DEFAULT'
            : rule.condition.length > 40
              ? rule.condition.slice(0, 38) + '…'
              : rule.condition,
          labelStyle:     { fill: '#94a3b8', fontSize: 10 },
          labelBgStyle:   { fill: '#0f172a', fillOpacity: 0.9 },
          labelBgPadding: [6, 4] as [number, number],
          labelBgBorderRadius: 4,
          style: {
            stroke:      rule.isDefault ? '#6366f1' : '#38bdf8',
            strokeWidth: 2,
          },
          animated: true,
          type:     'smoothstep',
        }));

      const laid = buildGraphLayout(rawNodes, rawEdges, wf.startStepId);
      setNodes(laid.nodes);
      setEdges(laid.edges);

    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to load workflow graph.');
    } finally {
      setLoading(false);
    }
  }, [workflowId, setNodes, setEdges]);

  useEffect(() => { fetchWorkflow(); }, [fetchWorkflow]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await api.post('/steps', {
        workflowId,
        name: newStepName,
        stepType: newStepType,
        order: steps.length + 1
      });
      setNewStepName('');
      setIsStepModalOpen(false);
      await fetchWorkflow();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add step');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStepId) return;
    try {
      setIsSubmitting(true);
      await api.post('/rules', {
        stepId: selectedStepId,
        condition: ruleIsDefault ? 'DEFAULT' : ruleCondition,
        priority: Number(rulePriority),
        nextStepId: ruleNextStep || null,
        isDefault: ruleIsDefault
      });
      setRuleCondition('');
      setRulePriority(rules.filter(r => r.stepId === selectedStepId).length + 1);
      setRuleIsDefault(false);
      setRuleNextStep('');
      await fetchWorkflow();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const selectedStep = useMemo(() => steps.find(s => s.id === selectedStepId), [steps, selectedStepId]);
  const stepRules = useMemo(() => rules.filter(r => r.stepId === selectedStepId), [rules, selectedStepId]);

  if (loading && !workflow) {
    return (
      <div className="flex items-center justify-center h-[70vh] gap-3 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span>Building workflow graph…</span>
      </div>
    );
  }

  if (error && !workflow) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <AlertCircle className="w-10 h-10 text-rose-400" />
        <p className="text-rose-400 font-medium">{error}</p>
        <button onClick={() => router.back()} className="text-sm text-slate-400 hover:text-white underline">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{workflow?.name}</h1>
            <p className="text-sm text-slate-400">
              v{workflow?.version} &nbsp;·&nbsp; {steps.length} steps &nbsp;·&nbsp; {rules.length} rules
            </p>
          </div>
        </div>
        <button 
          onClick={() => setIsStepModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Step
        </button>
      </div>

      {/* ── Main Layout ── */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        
        {/* Graph Canvas */}
        <div className="flex-1 rounded-xl border border-slate-800 overflow-hidden bg-slate-950 flex flex-col relative">
          <div className="absolute top-4 left-4 z-10 bg-slate-900/90 p-2 rounded-lg border border-slate-700 shadow-lg backdrop-blur flex items-center gap-4">
            <span className="text-xs text-slate-500 uppercase tracking-widest font-semibold ml-2">Legend</span>
            {[
              { label: 'Task',         color: '#6366f1' },
              { label: 'Approval',     color: '#f59e0b' },
              { label: 'Notification', color: '#10b981' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                <span className="text-xs text-slate-300">{label}</span>
              </div>
            ))}
          </div>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, node) => setSelectedStepId(node.id)}
            onPaneClick={() => setSelectedStepId(null)}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.2}
            maxZoom={2.5}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#1e293b" />
            <Controls className="!border-slate-700 !bg-slate-900 !shadow-xl" showInteractive={false} />
            <MiniMap
              nodeColor={(n) => {
                const t = (n.data as any)?.stepType;
                if (t === 'TASK') return '#6366f1';
                if (t === 'APPROVAL') return '#f59e0b';
                if (t === 'NOTIFICATION') return '#10b981';
                return '#64748b';
              }}
              maskColor="rgba(0,0,0,0.55)"
              className="!bg-slate-900 !border-slate-700 !rounded-lg"
            />
          </ReactFlow>
        </div>

        {/* Sidebar for Step Details & Adding Rules */}
        {selectedStep && (
          <div className="w-96 rounded-xl border border-slate-800 bg-slate-900 flex flex-col overflow-hidden animate-in slide-in-from-right shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <h2 className="font-bold text-white">Step Details</h2>
              <button onClick={() => setSelectedStepId(null)} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-6 overflow-y-auto flex-1">
              {/* Step Info */}
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Name</p>
                <p className="text-lg font-medium text-white">{selectedStep.name}</p>
                <p className="text-sm mt-1 inline-block px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                  {selectedStep.stepType}
                </p>
              </div>

              {/* Existing Rules */}
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">Routing Rules</p>
                {stepRules.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No rules defined.</p>
                ) : (
                  <div className="space-y-2">
                    {stepRules.map(r => (
                      <div key={r.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${r.isDefault ? 'bg-indigo-500/20 text-indigo-400' : 'bg-sky-500/20 text-sky-400'}`}>
                            {r.isDefault ? 'Default' : `Pri: ${r.priority}`}
                          </span>
                        </div>
                        <p className="text-sm font-mono text-slate-300 break-all mb-2">{r.isDefault ? 'DEFAULT' : r.condition}</p>
                        <p className="text-xs text-slate-400">
                          → {steps.find(s => s.id === r.nextStepId)?.name || 'End Workflow'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Rule Form */}
              <div className="pt-4 border-t border-slate-800">
                <h3 className="font-semibold text-white mb-4">Add New Rule</h3>
                <form onSubmit={handleAddRule} className="space-y-4">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900"
                      checked={ruleIsDefault} 
                      onChange={e => setRuleIsDefault(e.target.checked)} 
                    />
                    <span className="text-sm font-medium text-slate-300 group-hover:text-white">Make this the Default Rule</span>
                  </label>

                  {!ruleIsDefault && (
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Condition (JEXL)</label>
                      <input 
                        required 
                        type="text" 
                        value={ruleCondition} 
                        onChange={e => setRuleCondition(e.target.value)} 
                        placeholder='e.g., amount > 100 && priority == "High"'
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-slate-600 font-mono"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {!ruleIsDefault && (
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Priority</label>
                        <input 
                          required 
                          type="number" 
                          min="1"
                          value={rulePriority} 
                          onChange={e => setRulePriority(Number(e.target.value))} 
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    )}
                    <div className={ruleIsDefault ? "col-span-2" : ""}>
                      <label className="block text-xs text-slate-400 mb-1">Next Step</label>
                      <select 
                        required 
                        value={ruleNextStep} 
                        onChange={e => setRuleNextStep(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      >
                        <option value="">-- End Workflow --</option>
                        {steps.filter(s => s.id !== selectedStepId).map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Save Rule
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Add Step Modal ── */}
      {isStepModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Add New Step</h2>
              <button onClick={() => setIsStepModalOpen(false)} className="text-slate-400 hover:text-white transition-colors p-1 bg-slate-800 rounded-md">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddStep} className="p-5 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Step Name</label>
                <input 
                  autoFocus
                  required 
                  type="text" 
                  value={newStepName} 
                  onChange={e => setNewStepName(e.target.value)}
                  placeholder="e.g., Manager Approval"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder-slate-600 font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Step Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['APPROVAL', 'TASK', 'NOTIFICATION'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewStepType(type)}
                      className={`py-2 px-1 rounded-lg border text-xs font-bold tracking-wider transition-all
                        ${newStepType === type 
                          ? 'bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-500/30' 
                          : 'bg-slate-950 text-slate-400 border-slate-700 hover:border-slate-500'
                        }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex justify-center items-center gap-2 shadow-lg disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Step'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

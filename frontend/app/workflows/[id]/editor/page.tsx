'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, Loader2, AlertCircle, Save, Plus, GitGraph } from 'lucide-react';
import Link from 'next/link';

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  version: number;
  inputSchema: any;
}

export default function WorkflowEditorPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id as string;

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [inputSchemaStr, setInputSchemaStr] = useState('{}');

  const fetchWorkflow = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<Workflow>(`/workflow/${workflowId}`);
      setWorkflow(res.data);
      setName(res.data.name);
      setIsActive(res.data.isActive);
      setInputSchemaStr(JSON.stringify(res.data.inputSchema || {}, null, 2));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to load workflow.');
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      let parsedSchema = {};
      try {
        parsedSchema = JSON.parse(inputSchemaStr);
      } catch (e) {
        throw new Error('Input Schema is not valid JSON.');
      }

      await api.patch(`/workflow/${workflowId}`, {
        name,
        isActive,
        inputSchema: parsedSchema,
      });

      // Show success briefly
      alert('Workflow saved successfully!');
    } catch (err: any) {
      setError(err.message || err?.response?.data?.message || 'Failed to save workflow.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh] gap-3 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span>Loading editor…</span>
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
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Edit Workflow</h1>
            <p className="text-sm text-slate-400">
              v{workflow?.version} &nbsp;·&nbsp; ID: {workflow?.id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/workflows/${workflowId}/graph`}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium text-sm border border-slate-700 hover:border-slate-600"
          >
            <GitGraph className="w-4 h-4" />
            View Graph
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium text-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <p className="text-rose-400 text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Settings */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
            <h2 className="text-lg font-semibold text-white mb-4">General Settings</h2>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Workflow Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="e.g., Expense Approval"
              />
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${isActive ? 'bg-indigo-500' : 'bg-slate-700'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isActive ? 'translate-x-4' : ''}`}></div>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">Active Status</div>
                  <div className="text-xs text-slate-500">Enable or disable this workflow execution</div>
                </div>
              </label>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Input Schema (JSON)</h2>
            </div>
            <p className="text-xs text-slate-400 mb-2">Define the required input fields using a flat-property map (e.g. <code>{`{ "amount": {"type": "number", "required": true} }`}</code>)</p>
            <div className="space-y-2">
              <textarea
                value={inputSchemaStr}
                onChange={(e) => setInputSchemaStr(e.target.value)}
                className="w-full h-64 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                spellCheck="false"
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <p className="text-sm text-slate-400 leading-relaxed">
                Currently, steps and rules must be configured via the API or Graph view. 
                Full visual builder coming soon!
              </p>
              
              <Link
                href={`/workflows/${workflowId}/graph`}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors font-medium border border-indigo-500/20"
              >
                <GitGraph className="w-4 h-4" />
                Open Visual Graph
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

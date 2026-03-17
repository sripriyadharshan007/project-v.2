'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, Loader2, AlertCircle, Play, FileJson } from 'lucide-react';

interface Workflow {
  id: string;
  name: string;
  isActive: boolean;
  version: number;
  inputSchema: any;
}

export default function ExecuteWorkflowPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id as string;

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Input Data state
  const [inputDataStr, setInputDataStr] = useState('{\n  \n}');

  const fetchWorkflow = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<Workflow>(`/workflow/${workflowId}`);
      setWorkflow(res.data);

      // Pre-fill the JSON textarea based on the schema
      if (res.data.inputSchema && Object.keys(res.data.inputSchema).length > 0) {
        const template: any = {};
        for (const [key, details] of Object.entries(res.data.inputSchema as Record<string, any>)) {
          if (details.type === 'number') template[key] = 0;
          else if (details.type === 'boolean') template[key] = false;
          else template[key] = '';
        }
        setInputDataStr(JSON.stringify(template, null, 2));
      }

    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to load workflow details.');
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);

  const handleExecute = async () => {
    try {
      setExecuting(true);
      setError(null);
      setSuccessMsg(null);
      
      let parsedData = {};
      try {
        parsedData = JSON.parse(inputDataStr);
      } catch (e) {
        throw new Error('Input Data is not valid JSON. Please check your syntax.');
      }

      await api.post(`/executions/start`, {
        workflowId,
        context: parsedData,
      });

      setSuccessMsg('Workflow execution started successfully! You can view it in the Audit Logs.');
      
      // Optionally redirect after a few seconds
      setTimeout(() => {
        router.push('/audit');
      }, 2000);

    } catch (err: any) {
      setError(err.message || err?.response?.data?.message || 'Failed to execute workflow. Check the schema or try again.');
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh] gap-3 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span>Loading execution panel…</span>
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
    <div className="max-w-3xl mx-auto space-y-8">
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
            <h1 className="text-2xl font-bold text-white">Execute Workflow</h1>
            <p className="text-sm text-slate-400">
              {workflow?.name} &nbsp;·&nbsp; v{workflow?.version}
            </p>
          </div>
        </div>
      </div>

      {error && !successMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <p className="text-rose-400 text-sm whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex items-start gap-3">
          <Play className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-emerald-400 text-sm">{successMsg}</p>
        </div>
      )}

      {!workflow?.isActive && !successMsg && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-4">
          <p className="text-amber-400 text-sm font-medium">Warning: This workflow is marked as Draft/Inactive.</p>
          <p className="text-amber-500 text-xs mt-1">If the backend strictly enforces this, the execution may be rejected.</p>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileJson className="w-5 h-5 text-indigo-400" />
              Input Data Payload
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Provide the input context (JSON) expected by the workflow schema.
            </p>
          </div>
        </div>

        {workflow?.inputSchema && Object.keys(workflow.inputSchema).length > 0 && (
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Required Schema</p>
            <pre className="text-xs text-indigo-300 font-mono overflow-x-auto">
              {JSON.stringify(workflow.inputSchema, null, 2)}
            </pre>
          </div>
        )}

        <div className="space-y-2">
          <textarea
            value={inputDataStr}
            onChange={(e) => setInputDataStr(e.target.value)}
            disabled={executing || !!successMsg}
            className="w-full h-64 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50"
            spellCheck="false"
            placeholder="{&#10;  &#34;key&#34;: &#34;value&#34;&#10;}"
          />
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-800">
          <button
            onClick={handleExecute}
            disabled={executing || !!successMsg}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium shadow-lg shadow-emerald-500/20"
          >
            {executing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
            {executing ? 'Starting execution...' : 'Run Workflow'}
          </button>
        </div>
      </div>
    </div>
  );
}

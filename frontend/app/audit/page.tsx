'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Loader2, AlertCircle, ShieldCheck, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

interface ExecutionLog {
  id: string;
  executionId: string;
  stepId: string;
  stepName: string;
  stepType: string;
  status: string;
  errorMessage: string | null;
  evaluatedRules: any;
  selectedNextStep: string | null;
  startedAt: string;
  endedAt: string;
  execution: {
    workflow: {
      name: string;
    };
  };
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch all executions with logs, or a dedicated logs endpoint.
      // Let's use the executions endpoint, which might return logs, or we need a global logs endpoint.
      // Assuming backend has GET /executions or we need to add a GET /logs
      const res = await api.get('/executions');
      
      // Combine all logs from all executions
      let allLogs: ExecutionLog[] = [];
      res.data.forEach((exec: any) => {
        if (exec.logs) {
          const execLogs = exec.logs.map((log: any) => ({
            ...log,
            execution: {
              workflow: {
                name: exec.workflow?.name || 'Workflow'
              }
            }
          }));
          allLogs = [...allLogs, ...execLogs];
        }
      });
      
      // Sort by startedAt desc
      allLogs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      
      setLogs(allLogs);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-indigo-500" />
            Global Audit Logs
          </h1>
          <p className="text-slate-400 mt-1">System-wide trail of all workflow step executions and rule evaluations.</p>
        </div>
      </div>

      {error ? (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-6 flex flex-col items-center justify-center gap-4">
          <AlertCircle className="w-10 h-10 text-rose-400 shrink-0" />
          <p className="text-rose-400 font-medium text-center">{error}</p>
          <button 
            onClick={fetchLogs}
            className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg transition-colors text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400 border border-slate-800 rounded-xl bg-slate-900 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="font-medium">Loading audit logs...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 border border-slate-800 rounded-xl bg-slate-900 shadow-sm text-center px-4">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mb-2">
            <Clock className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-semibold text-slate-200">No logs found</h3>
          <p className="text-slate-400 max-w-sm">
            Execute a workflow to generate audit logs. They will appear here automatically.
          </p>
          <Link
            href="/workflows"
            className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all font-medium"
          >
            Go to Workflows
          </Link>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-slate-950/50 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-semibold tracking-wider">Timestamp</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Workflow / Execution</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Step Details</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Status</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Evaluation / Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 opacity-50" />
                        {format(new Date(log.startedAt), 'MMM d, HH:mm:ss')}
                      </div>
                      <div className="text-xs text-slate-600 mt-1 ml-6">
                        {Math.max(0, new Date(log.endedAt).getTime() - new Date(log.startedAt).getTime())}ms
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-200">
                        {log.execution?.workflow?.name || 'Unknown Workflow'}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-1">
                        Exec: {log.executionId.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-indigo-400">
                        {log.stepName}
                      </div>
                      {log.stepType && (
                        <div className="text-[10px] uppercase tracking-wider font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full inline-block mt-1">
                          {log.stepType}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        log.status === 'completed' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {log.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 break-words max-w-xs">
                      {log.status === 'failed' ? (
                        <div className="text-xs text-rose-400 bg-rose-950/30 p-2 rounded border border-rose-900/50">
                          {log.errorMessage || 'Unknown execution error'}
                        </div>
                      ) : (
                        <div className="space-y-1 text-xs">
                          {log.evaluatedRules && Array.isArray(log.evaluatedRules) && log.evaluatedRules.length > 0 ? (
                            <div className="bg-slate-950 p-2 rounded border border-slate-800 text-slate-300 font-mono text-[10px]">
                              {log.evaluatedRules.map((r: any, i: number) => (
                                <div key={i} className="flex gap-2">
                                  <span className={r.result ? "text-emerald-400" : "text-slate-500"}>
                                    [{r.result ? 'PASS' : 'FAIL'}]
                                  </span>
                                  <span>{r.rule}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">No rules evaluated</span>
                          )}
                          
                          {log.selectedNextStep && (
                            <div className="mt-2 text-slate-400">
                              → Next: <span className="text-indigo-400">{log.selectedNextStep}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

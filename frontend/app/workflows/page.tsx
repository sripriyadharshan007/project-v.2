'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Plus, Edit2, Play, Trash2, Calendar, CheckCircle2, XCircle, GitGraph } from 'lucide-react';
import { format } from 'date-fns';

interface Workflow {
  id: string;
  name: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResult {
  data: Workflow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function WorkflowsPage() {
  const router = useRouter();
  const [data, setData] = useState<PaginatedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchWorkflows = async (currentPage: number) => {
    try {
      setLoading(true);
      const response = await api.get<PaginatedResult>(`/workflow?page=${currentPage}&limit=10`);
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch workflows', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows(page);
  }, [page]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    try {
      await api.delete(`/workflow/${id}`);
      fetchWorkflows(page);
    } catch (error) {
      console.error('Failed to delete', error);
      alert('Error deleting workflow');
    }
  };

  const createWorkflow = async () => {
    try {
      const response = await api.post('/workflow', {
        name: `New Workflow ${new Date().toLocaleTimeString()}`,
        isActive: false
      });
      router.push(`/workflows/${response.data.id}/editor`);
    } catch (error) {
      console.error('Failed to create workflow', error);
      alert('Error creating workflow');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Workflows</h1>
          <p className="text-slate-400 mt-1">Manage and orchestrate your automated processes.</p>
        </div>
        <button
          onClick={createWorkflow}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg shadow-indigo-500/20"
        >
          <Plus className="w-5 h-5" />
          Create Workflow
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 animate-pulse">Loading workflows...</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/50 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Version</th>
                  <th className="px-6 py-4">Created</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {data?.data.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No workflows found. Create your first one to get started!
                    </td>
                  </tr>
                ) : (
                  data?.data.map((wf) => (
                    <tr key={wf.id} className="hover:bg-slate-800/50 transition-colors group">
                      <td className="px-6 py-4 font-medium text-slate-200">
                        {wf.name}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          wf.isActive 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                        }`}>
                          {wf.isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {wf.isActive ? 'Active' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono bg-slate-800 px-2 py-1 rounded text-xs text-slate-300">v{wf.version}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 flex items-center gap-2">
                        <Calendar className="w-4 h-4 opacity-50" />
                        {format(new Date(wf.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link 
                            href={`/workflows/${wf.id}/graph`}
                            className="p-2 text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"
                            title="View Graph"
                          >
                            <GitGraph className="w-4 h-4" />
                          </Link>
                          <Link 
                            href={`/workflows/${wf.id}/editor`}
                            className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                            title="Edit Workflow"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>
                          <Link 
                            href={`/workflows/${wf.id}/execute`}
                            className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                            title="Execute Workflow"
                          >
                            <Play className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(wf.id)}
                            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Delete Workflow"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {data && data.totalPages > 1 && (
            <div className="border-t border-slate-800 px-6 py-4 flex items-center justify-between text-sm">
              <span className="text-slate-400">
                Showing page <span className="font-medium text-white">{data.page}</span> of{' '}
                <span className="font-medium text-white">{data.totalPages}</span>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={data.page === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                  disabled={data.page === data.totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

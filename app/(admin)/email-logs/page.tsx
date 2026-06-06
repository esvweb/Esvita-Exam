'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/admin/Header';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { Mail, CheckCircle2, XCircle, Clock, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  type: string;
  status: string;
  error: string | null;
  retryCount: number;
  sentAt: string;
  audienceId: string | null;
  examId: string | null;
  sessionId: string | null;
}

const EMAIL_TYPES = [
  { value: '', label: 'All types' },
  { value: 'otp', label: 'OTP' },
  { value: 'exam_assignment', label: 'Exam Assignment' },
  { value: 'exam_result', label: 'Exam Result' },
  { value: 'supervisor_reminder', label: 'Supervisor Reminder' },
  { value: 'candidate_reminder', label: 'Candidate Reminder' },
  { value: 'invite', label: 'Invite' },
];

const STATUS_COLORS: Record<string, string> = {
  sent:    'bg-emerald-100 text-emerald-700',
  failed:  'bg-red-100 text-red-700',
  pending: 'bg-amber-100 text-amber-700',
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'sent') return <CheckCircle2 size={13} className="text-emerald-600" />;
  if (status === 'failed') return <XCircle size={13} className="text-red-500" />;
  return <Clock size={13} className="text-amber-500" />;
}

function typeLabel(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function EmailLogsPage() {
  const { error } = useToast();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);

  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (typeFilter) params.set('type', typeFilter);
    if (statusFilter) params.set('status', statusFilter);

    const res = await fetch(`/api/admin/email-logs?${params}`);
    if (res.ok) {
      const d = await res.json();
      setLogs(d.logs || []);
      setTotal(d.total || 0);
      setPages(d.pages || 1);
    } else {
      error('Failed to load email logs');
    }
    setLoading(false);
  }, [page, typeFilter, statusFilter, error]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Reset to page 1 on filter change
  useEffect(() => { setPage(1); }, [typeFilter, statusFilter]);

  return (
    <div>
      <Header
        title="Email Logs"
        subtitle="Record of all outbound emails sent by the platform"
      />
      <div className="p-6">

        {/* Filters */}
        <div className="flex gap-3 mb-5 flex-wrap items-center">
          <select className="input w-52" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            {EMAIL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <select className="input w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
          <button onClick={fetchLogs} className="btn-secondary flex items-center gap-1.5">
            <RefreshCw size={14} />
            Refresh
          </button>
          <span className="ml-auto text-sm text-slate-500">{total.toLocaleString()} emails total</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : logs.length === 0 ? (
          <div className="card p-12 text-center">
            <Mail size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">No emails match the current filters.</p>
          </div>
        ) : (
          <>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Recipient</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Subject</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-700 font-mono text-xs">{log.to}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-[220px] truncate" title={log.subject}>
                        {log.subject}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-medium">
                          {typeLabel(log.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[log.status] || 'bg-slate-100 text-slate-600'}`}>
                          <StatusIcon status={log.status} />
                          {log.status}
                          {log.retryCount > 0 && ` (${log.retryCount} retries)`}
                        </span>
                        {log.error && (
                          <p className="text-[10px] text-red-500 mt-0.5 truncate max-w-[180px]" title={log.error}>
                            {log.error}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {formatDateTime(log.sentAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary btn-sm disabled:opacity-40"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="text-sm text-slate-600">
                  Page {page} of {pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page === pages}
                  className="btn-secondary btn-sm disabled:opacity-40"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

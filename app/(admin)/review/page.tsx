'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/admin/Header';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import { MessageSquareText, Clock, CheckCircle2, ChevronRight, RefreshCw, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { formatDateTime, LANGUAGE_FLAGS } from '@/lib/utils';
import type { Language } from '@/types';

interface ReviewSession {
  id: string;
  examId: string;
  examTitle: string;
  candidateName: string;
  candidateEmail: string;
  nickname: string | null;
  selectedLanguage: string;
  completedAt: string | null;
  status: string;
  score: number | null;
  totalQuestions: number | null;
  shortAnswerTotal: number;
  shortAnswerReviewed: number;
}

export default function ReviewPage() {
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'pending_review' | 'reviewed' | 'all'>('pending_review');

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/review/sessions?status=${statusFilter}`);
    if (res.ok) setSessions(await res.json());
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const pendingCount = sessions.filter((s) => s.status === 'pending_review').length;
  const reviewedCount = sessions.filter((s) => s.status === 'reviewed').length;

  return (
    <div className="flex flex-col h-full">
      <Header title="Review Answers" subtitle="Score short-answer responses from candidates" />

      <div className="flex-1 overflow-auto p-6">
        {/* Stat chips */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setStatusFilter('pending_review')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              statusFilter === 'pending_review'
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Clock size={15} />
            Pending Review
            {pendingCount > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setStatusFilter('reviewed')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              statusFilter === 'reviewed'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <CheckCircle2 size={15} />
            Reviewed
            {reviewedCount > 0 && (
              <span className="ml-1 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {reviewedCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              statusFilter === 'all'
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All
          </button>
          <button
            onClick={fetchSessions}
            className="ml-auto flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 border border-slate-200 bg-white hover:bg-slate-50"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" className="text-blue-600" />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={MessageSquareText}
            title={statusFilter === 'pending_review' ? 'No sessions pending review' : 'No reviewed sessions yet'}
            description={statusFilter === 'pending_review'
              ? 'Short-answer responses will appear here once candidates complete exams.'
              : 'Reviewed sessions will appear here after scoring.'}
          />
        ) : (
          <div className="space-y-6">
            {(() => {
              // Group sessions by exam
              const groups = sessions.reduce<Record<string, { examId: string; examTitle: string; items: ReviewSession[] }>>((acc, s) => {
                if (!acc[s.examId]) acc[s.examId] = { examId: s.examId, examTitle: s.examTitle, items: [] };
                acc[s.examId].items.push(s);
                return acc;
              }, {});

              return Object.values(groups).map(({ examId, examTitle, items }) => {
                const pendingInGroup = items.filter((s) => s.status === 'pending_review').length;
                return (
                  <div key={examId}>
                    {/* Exam group header */}
                    <div className="flex items-center gap-3 mb-2">
                      <BookOpen size={15} className="text-slate-400 flex-shrink-0" />
                      <h3 className="text-sm font-semibold text-slate-700 truncate">{examTitle}</h3>
                      <span className="text-xs text-slate-400 flex-shrink-0">
                        {items.length} candidate{items.length !== 1 ? 's' : ''}
                      </span>
                      {pendingInGroup > 0 && (
                        <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
                          {pendingInGroup} pending
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 pl-2 border-l-2 border-slate-100">
                      {items.map((s) => {
                        const progress = s.shortAnswerTotal > 0
                          ? Math.round((s.shortAnswerReviewed / s.shortAnswerTotal) * 100)
                          : 0;
                        const isPending = s.status === 'pending_review';

                        return (
                          <Link
                            key={s.id}
                            href={`/review/${s.id}`}
                            className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                    isPending
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-emerald-100 text-emerald-700'
                                  }`}>
                                    {isPending ? <Clock size={9} /> : <CheckCircle2 size={9} />}
                                    {isPending ? 'Pending' : 'Reviewed'}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {LANGUAGE_FLAGS[s.selectedLanguage as Language] || '🌐'} {s.selectedLanguage}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-800">
                                  {s.nickname ? `${s.candidateName} (${s.nickname})` : s.candidateName}
                                </p>
                                <p className="text-xs text-slate-400">{s.candidateEmail}</p>
                              </div>

                              <div className="flex items-center gap-6 flex-shrink-0">
                                {/* SA progress */}
                                <div className="text-right">
                                  <p className="text-xs text-slate-400 mb-1">Short answers</p>
                                  <div className="flex items-center gap-2">
                                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all ${isPending ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                        style={{ width: `${progress}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-medium text-slate-600">
                                      {s.shortAnswerReviewed}/{s.shortAnswerTotal}
                                    </span>
                                  </div>
                                </div>

                                {/* Score */}
                                <div className="text-right w-16">
                                  <p className="text-xs text-slate-400">Score</p>
                                  <p className={`text-lg font-bold ${
                                    s.score === null ? 'text-slate-300' :
                                    s.score >= 70 ? 'text-emerald-600' :
                                    s.score >= 50 ? 'text-amber-600' : 'text-red-500'
                                  }`}>
                                    {s.score !== null ? `${s.score}%` : '—'}
                                  </p>
                                </div>

                                {/* Date */}
                                <div className="text-right w-32 hidden lg:block">
                                  <p className="text-xs text-slate-400">Completed</p>
                                  <p className="text-xs text-slate-600">
                                    {s.completedAt ? formatDateTime(s.completedAt) : '—'}
                                  </p>
                                </div>

                                <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

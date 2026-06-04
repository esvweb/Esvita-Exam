'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/admin/Header';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import {
  ArrowLeft, CheckCircle2, Clock, Send, User, FileText,
  MessageSquare, Star,
} from 'lucide-react';
import Link from 'next/link';
import { formatDateTime, LANGUAGE_FLAGS, LANGUAGE_LABELS } from '@/lib/utils';
import type { Language } from '@/types';

interface ShortAnswer {
  answerId: string;
  questionId: string;
  questionText: string;
  answerText: string;
  maxScore: number;
  manualScore: number | null;
  manualFeedback: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

interface ReviewSession {
  sessionId: string;
  examTitle: string;
  candidateName: string;
  candidateEmail: string;
  nickname: string | null;
  realName: string | null;
  selectedLanguage: string;
  completedAt: string | null;
  status: string;
  score: number | null;
  totalQuestions: number | null;
  shortAnswers: ShortAnswer[];
}

export default function ReviewSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { success, error } = useToast();

  const [session, setSession] = useState<ReviewSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local score/feedback state keyed by answerId
  const [scores, setScores] = useState<Record<string, { score: string; feedback: string }>>({});

  const fetchSession = useCallback(async () => {
    const res = await fetch(`/api/admin/review/sessions/${sessionId}`);
    if (res.ok) {
      const data: ReviewSession = await res.json();
      setSession(data);
      // Pre-populate existing scores
      const initial: Record<string, { score: string; feedback: string }> = {};
      data.shortAnswers.forEach((a) => {
        initial[a.answerId] = {
          score: a.manualScore !== null ? String(a.manualScore) : '',
          feedback: a.manualFeedback || '',
        };
      });
      setScores(initial);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  const handleSave = async () => {
    if (!session) return;

    // Validate all answered questions have a score
    const missing = session.shortAnswers.filter((a) => {
      const s = scores[a.answerId];
      return !s || s.score.trim() === '';
    });

    if (missing.length > 0) {
      error(`Please score all ${missing.length} unanswered question(s) before saving.`);
      return;
    }

    const payload = session.shortAnswers.map((a) => ({
      answerId: a.answerId,
      manualScore: parseInt(scores[a.answerId]?.score || '0', 10),
      manualFeedback: scores[a.answerId]?.feedback || '',
    }));

    setSaving(true);
    const res = await fetch(`/api/admin/review/sessions/${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scores: payload }),
    });
    const data = await res.json();
    if (res.ok) {
      success(`Scores saved. Final score: ${data.finalScore}%`);
      fetchSession();
    } else {
      error(data.error || 'Failed to save scores');
    }
    setSaving(false);
  };

  if (loading || !session) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Review Session" />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" className="text-blue-600" />
        </div>
      </div>
    );
  }

  const isPending = session.status === 'pending_review';
  const lang = session.selectedLanguage as Language;
  const allScored = session.shortAnswers.every((a) => {
    const s = scores[a.answerId];
    return s && s.score.trim() !== '';
  });

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Review Session"
        subtitle={session.examTitle}
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Back + status bar */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/review"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={15} />
            Back to Review Queue
          </Link>
          <span className="text-slate-300">·</span>
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
            isPending ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
          }`}>
            {isPending ? <Clock size={10} /> : <CheckCircle2 size={10} />}
            {isPending ? 'Pending Review' : 'Reviewed'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: candidate info + score summary */}
          <div className="lg:col-span-1 space-y-4">
            {/* Candidate card */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User size={18} className="text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{session.candidateName}</p>
                  {session.nickname && (
                    <p className="text-xs text-slate-400 truncate">aka {session.nickname}</p>
                  )}
                </div>
              </div>
              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <dt className="text-slate-400">Email</dt>
                  <dd className="text-slate-600 truncate ml-2 max-w-[60%] text-right">{session.candidateEmail}</dd>
                </div>
                {session.realName && (
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Legal name</dt>
                    <dd className="text-slate-600">{session.realName}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-slate-400">Language</dt>
                  <dd className="text-slate-600">
                    {LANGUAGE_FLAGS[lang] || '🌐'} {LANGUAGE_LABELS[lang] || lang}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Completed</dt>
                  <dd className="text-slate-600">
                    {session.completedAt ? formatDateTime(session.completedAt) : '—'}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Score summary card */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Score</p>
              <div className="text-center py-2">
                <p className={`text-5xl font-bold ${
                  session.score === null ? 'text-slate-300' :
                  session.score >= 70 ? 'text-emerald-600' :
                  session.score >= 50 ? 'text-amber-500' : 'text-red-500'
                }`}>
                  {session.score !== null ? `${session.score}%` : '—'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {isPending ? 'Partial — awaiting review' : 'Final score'}
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 text-center">
                {session.shortAnswers.filter((a) => scores[a.answerId]?.score.trim()).length} / {session.shortAnswers.length} short answers scored
              </div>
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving || !allScored}
              className="w-full btn-primary flex items-center justify-center gap-2 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Spinner size="sm" className="text-white" />
              ) : (
                <Send size={15} />
              )}
              {saving ? 'Saving…' : 'Save All Scores'}
            </button>
            {!allScored && (
              <p className="text-xs text-center text-slate-400">
                Score all questions to save
              </p>
            )}
          </div>

          {/* Right: questions */}
          <div className="lg:col-span-2 space-y-5">
            {session.shortAnswers.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                <FileText size={32} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No short-answer questions in this session.</p>
              </div>
            ) : (
              session.shortAnswers.map((a, idx) => {
                const localScore = scores[a.answerId] || { score: '', feedback: '' };
                const scoreNum = parseInt(localScore.score, 10);
                const isValidScore = !isNaN(scoreNum) && scoreNum >= 0 && scoreNum <= a.maxScore;
                const isScored = localScore.score.trim() !== '';

                return (
                  <div
                    key={a.answerId}
                    className={`bg-white border rounded-xl p-5 transition-colors ${
                      isScored ? 'border-emerald-200' : 'border-slate-200'
                    }`}
                  >
                    {/* Question header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Question</span>
                      </div>
                      <span className="text-xs text-slate-400">Max: {a.maxScore} pts</span>
                    </div>

                    <p className="text-sm font-medium text-slate-800 mb-4 leading-relaxed">
                      {a.questionText || <span className="text-slate-400 italic">No question text</span>}
                    </p>

                    {/* Candidate answer */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <MessageSquare size={10} />
                        Candidate's Answer
                      </p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {a.answerText || <span className="text-slate-400 italic">No answer provided</span>}
                      </p>
                    </div>

                    {/* Scoring row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block flex items-center gap-1">
                          <Star size={11} />
                          Score (0–{a.maxScore})
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={a.maxScore}
                          value={localScore.score}
                          onChange={(e) =>
                            setScores((prev) => ({
                              ...prev,
                              [a.answerId]: { ...prev[a.answerId], score: e.target.value },
                            }))
                          }
                          className={`form-input w-full text-center font-bold text-lg ${
                            isScored && !isValidScore ? 'border-red-300 focus:ring-red-300' : ''
                          }`}
                          placeholder="—"
                        />
                        {isScored && !isValidScore && (
                          <p className="text-xs text-red-500 mt-1">Must be 0–{a.maxScore}</p>
                        )}
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">
                          Feedback <span className="font-normal text-slate-400">(optional)</span>
                        </label>
                        <textarea
                          rows={2}
                          value={localScore.feedback}
                          onChange={(e) =>
                            setScores((prev) => ({
                              ...prev,
                              [a.answerId]: { ...prev[a.answerId], feedback: e.target.value },
                            }))
                          }
                          className="form-input w-full resize-none text-sm"
                          placeholder="Add optional feedback for this answer…"
                        />
                      </div>
                    </div>

                    {/* Previously reviewed indicator */}
                    {a.reviewedAt && (
                      <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                        <CheckCircle2 size={9} className="text-emerald-500" />
                        Last scored {formatDateTime(a.reviewedAt)}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

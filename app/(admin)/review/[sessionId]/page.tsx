'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/admin/Header';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import {
  ArrowLeft, CheckCircle2, Clock, Send, User, FileText,
  MessageSquare, Star, Sparkles, ThumbsUp, Edit3, BookOpen,
} from 'lucide-react';
import Link from 'next/link';
import { formatDateTime, LANGUAGE_FLAGS, LANGUAGE_LABELS } from '@/lib/utils';
import type { Language } from '@/types';

interface ShortAnswer {
  answerId: string;
  questionId: string;
  questionText: string;
  referenceAnswer: string;
  answerText: string;
  maxScore: number;
  manualScore: number | null;
  manualFeedback: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  aiSuggestedScore: number | null;
  aiSuggestionStatus: string | null;
}

interface ReviewSession {
  sessionId: string;
  examId: string;
  examTitle: string;
  candidateNickname: string;
  selectedLanguage: string;
  completedAt: string | null;
  status: string;
  score: number | null;
  totalQuestions: number | null;
  shortAnswers: ShortAnswer[];
}

interface AiState {
  loading: boolean;
  score: number | null;
  reasoning: string;
  status: 'idle' | 'suggested' | 'accepted' | 'revised';
}

export default function ReviewSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { success, error } = useToast();

  const [session, setSession] = useState<ReviewSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local score/feedback state keyed by answerId
  const [scores, setScores] = useState<Record<string, { score: string; feedback: string }>>({});
  // AI state per answerId
  const [aiStates, setAiStates] = useState<Record<string, AiState>>({});

  const fetchSession = useCallback(async () => {
    const res = await fetch(`/api/admin/review/sessions/${sessionId}`);
    if (res.ok) {
      const data: ReviewSession = await res.json();
      setSession(data);

      const initial: Record<string, { score: string; feedback: string }> = {};
      const initialAi: Record<string, AiState> = {};

      data.shortAnswers.forEach((a) => {
        initial[a.answerId] = {
          score: a.manualScore !== null ? String(a.manualScore) : '',
          feedback: a.manualFeedback || '',
        };
        // Seed AI state from persisted values
        initialAi[a.answerId] = {
          loading: false,
          score: a.aiSuggestedScore ?? null,
          reasoning: '',
          status:
            a.aiSuggestionStatus === 'accepted' ? 'accepted'
            : a.aiSuggestionStatus === 'revised' ? 'revised'
            : a.aiSuggestedScore !== null ? 'suggested'
            : 'idle',
        };
      });

      setScores(initial);
      setAiStates(initialAi);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  const handleGetAiScore = async (answerId: string) => {
    setAiStates((prev) => ({ ...prev, [answerId]: { ...prev[answerId], loading: true } }));
    const res = await fetch(`/api/admin/review/sessions/${sessionId}/ai-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answerId }),
    });
    const data = await res.json();
    if (res.ok) {
      setAiStates((prev) => ({
        ...prev,
        [answerId]: {
          loading: false,
          score: data.suggestedScore,
          reasoning: data.reasoning || '',
          status: 'suggested',
        },
      }));
    } else {
      error(data.error || 'AI scoring failed');
      setAiStates((prev) => ({ ...prev, [answerId]: { ...prev[answerId], loading: false } }));
    }
  };

  const handleAcceptAiScore = (answerId: string) => {
    const ai = aiStates[answerId];
    if (ai?.score === null || ai?.score === undefined) return;
    setScores((prev) => ({ ...prev, [answerId]: { ...prev[answerId], score: String(ai.score) } }));
    setAiStates((prev) => ({ ...prev, [answerId]: { ...prev[answerId], status: 'accepted' } }));
  };

  const handleReviseAiScore = (answerId: string) => {
    setAiStates((prev) => ({ ...prev, [answerId]: { ...prev[answerId], status: 'revised' } }));
  };

  const handleSave = async () => {
    if (!session) return;

    const missing = session.shortAnswers.filter((a) => {
      const s = scores[a.answerId];
      return !s || s.score.trim() === '';
    });

    if (missing.length > 0) {
      error(`Please score all ${missing.length} unanswered question(s) before saving.`);
      return;
    }

    const payload = session.shortAnswers.map((a) => {
      const ai = aiStates[a.answerId];
      const aiStatus: 'accepted' | 'revised' | undefined =
        ai?.status === 'accepted' ? 'accepted'
        : ai?.status === 'revised' ? 'revised'
        : undefined;

      return {
        answerId: a.answerId,
        manualScore: parseInt(scores[a.answerId]?.score || '0', 10),
        manualFeedback: scores[a.answerId]?.feedback || '',
        ...(aiStatus ? { aiSuggestionStatus: aiStatus } : {}),
      };
    });

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
      <Header title="Review Session" subtitle={session.examTitle} />

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
                  <p className="font-semibold text-slate-800 text-sm truncate">
                    {session.candidateNickname}
                  </p>
                </div>
              </div>
              <dl className="space-y-1.5 text-xs">
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
                  session.score === null ? 'text-slate-300'
                  : session.score >= 70 ? 'text-emerald-600'
                  : session.score >= 50 ? 'text-amber-500' : 'text-red-500'
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
              {saving ? <Spinner size="sm" className="text-white" /> : <Send size={15} />}
              {saving ? 'Saving…' : 'Save All Scores'}
            </button>
            {!allScored && (
              <p className="text-xs text-center text-slate-400">Score all questions to save</p>
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
                const ai = aiStates[a.answerId] || { loading: false, score: null, reasoning: '', status: 'idle' };

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
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Short Answer
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">Max: {a.maxScore} / 10 pts</span>
                    </div>

                    <p className="text-sm font-medium text-slate-800 mb-4 leading-relaxed">
                      {a.questionText || <span className="text-slate-400 italic">No question text</span>}
                    </p>

                    {/* Reference answer (visible to supervisor) */}
                    {a.referenceAnswer && (
                      <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-3">
                        <p className="text-[10px] font-semibold text-teal-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <BookOpen size={10} />
                          Reference Answer
                        </p>
                        <p className="text-sm text-teal-800 whitespace-pre-wrap leading-relaxed">
                          {a.referenceAnswer}
                        </p>
                      </div>
                    )}

                    {/* Candidate answer */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <MessageSquare size={10} />
                        Candidate&apos;s Answer
                      </p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {a.answerText || <span className="text-slate-400 italic">No answer provided</span>}
                      </p>
                    </div>

                    {/* AI Score suggestion */}
                    <div className="mb-4">
                      {ai.status === 'idle' && (
                        <button
                          onClick={() => handleGetAiScore(a.answerId)}
                          disabled={ai.loading || !a.answerText}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {ai.loading ? <Spinner size="sm" /> : <Sparkles size={12} />}
                          {ai.loading ? 'Getting AI score…' : 'Get AI Score'}
                        </button>
                      )}

                      {(ai.status === 'suggested' || ai.status === 'accepted' || ai.status === 'revised') && ai.score !== null && (
                        <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Sparkles size={13} className="text-indigo-500" />
                              <span className="text-xs font-semibold text-indigo-700">
                                AI suggests: {ai.score} / 10
                              </span>
                              {ai.status === 'accepted' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                                  <ThumbsUp size={9} /> Accepted
                                </span>
                              )}
                              {ai.status === 'revised' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                                  <Edit3 size={9} /> Revised manually
                                </span>
                              )}
                            </div>
                            {ai.status === 'suggested' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleAcceptAiScore(a.answerId)}
                                  className="text-[10px] font-semibold px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors flex items-center gap-1"
                                >
                                  <ThumbsUp size={9} /> Accept
                                </button>
                                <button
                                  onClick={() => handleReviseAiScore(a.answerId)}
                                  className="text-[10px] font-semibold px-2 py-1 bg-white border border-slate-300 text-slate-600 rounded hover:bg-slate-50 transition-colors flex items-center gap-1"
                                >
                                  <Edit3 size={9} /> Revise
                                </button>
                              </div>
                            )}
                            {(ai.status === 'accepted' || ai.status === 'revised') && (
                              <button
                                onClick={() => handleGetAiScore(a.answerId)}
                                className="text-[10px] text-indigo-500 hover:text-indigo-700 underline"
                              >
                                Re-score
                              </button>
                            )}
                          </div>
                          {ai.reasoning && (
                            <p className="text-xs text-indigo-700 leading-relaxed">{ai.reasoning}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Scoring row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
                          <Star size={11} />
                          Score (0–{a.maxScore})
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={a.maxScore}
                          value={localScore.score}
                          onChange={(e) => {
                            setScores((prev) => ({
                              ...prev,
                              [a.answerId]: { ...prev[a.answerId], score: e.target.value },
                            }));
                            // If user manually changes score after accepting AI, mark as revised
                            if (aiStates[a.answerId]?.status === 'accepted') {
                              setAiStates((prev) => ({
                                ...prev,
                                [a.answerId]: { ...prev[a.answerId], status: 'revised' },
                              }));
                            }
                          }}
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

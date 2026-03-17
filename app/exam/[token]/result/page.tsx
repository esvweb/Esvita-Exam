'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Clock, Mail, GraduationCap, HelpCircle, Award } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';

interface SessionResult {
  sessionId: string;
  candidateName: string;
  examTitle: string;
  totalQuestions: number;
  isPending: boolean;
  resultsAvailableAt: string | null;
  score: number | null;
  correctCount: number | null;
  wrongCount: number | null;
  skippedCount: number | null;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ExamResultPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId') || '';
  const [result, setResult] = useState<SessionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    fetch(`/api/exam/result?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setResult(data);
        setLoading(false);
      })
      .catch(() => { setError('Failed to load results'); setLoading(false); });
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="text-blue-600 mb-3" />
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center">
          <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <XCircle size={28} className="text-red-500" />
          </div>
          <h2 className="font-bold text-slate-800 text-lg mb-2">Not Available</h2>
          <p className="text-slate-500 text-sm">{error || 'Result not found.'}</p>
        </div>
      </div>
    );
  }

  const { candidateName, examTitle, totalQuestions, isPending, resultsAvailableAt,
          score, correctCount, wrongCount, skippedCount } = result;

  // ── Pending screen ─────────────────────────────────────────────────────────
  if (isPending) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Branding */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 rounded-xl mb-3 border border-white/20">
              <GraduationCap size={24} className="text-white" />
            </div>
            <h1 className="text-lg font-bold text-white">Esvita Exam System</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Top banner */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-8 text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">Exam Completed!</h2>
              <p className="text-blue-100 text-sm mt-1">Your responses have been recorded.</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Candidate / exam info */}
              <div className="text-center">
                <p className="font-semibold text-slate-800">{candidateName}</p>
                <p className="text-sm text-slate-400 mt-0.5">{examTitle}</p>
              </div>

              {/* Pending notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <Clock size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800 text-sm">Results Pending</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Your results are being processed and will be emailed to you
                    {resultsAvailableAt ? ` on ${formatDate(resultsAvailableAt)}` : ' soon'}.
                  </p>
                </div>
              </div>

              {/* Email notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5">
                <Mail size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-blue-800">Confirmation email sent</p>
                  <p className="text-[11px] text-blue-600 mt-0.5">
                    A confirmation has been sent to your email. You will receive your detailed results
                    with correct answers automatically.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-slate-500/50 text-xs mt-5">You may close this window.</p>
        </div>
      </div>
    );
  }

  // ── Results revealed screen ────────────────────────────────────────────────
  const pct = Math.round(score ?? 0);
  const isExcellent = pct >= 80;
  const isPassing = pct >= 60;
  const scoreBg = isExcellent
    ? 'from-emerald-500 to-emerald-600'
    : isPassing
    ? 'from-yellow-500 to-yellow-600'
    : 'from-red-500 to-red-600';
  const scoreLabel = isExcellent ? 'Excellent!' : isPassing ? 'Passed' : 'Needs Improvement';
  const scoreDesc = isExcellent
    ? 'Outstanding performance! You have demonstrated excellent knowledge.'
    : isPassing
    ? 'Good work! You have successfully passed this assessment.'
    : 'Keep studying! Review the areas you missed and try again.';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 rounded-xl mb-3 border border-white/20">
            <GraduationCap size={24} className="text-white" />
          </div>
          <h1 className="text-lg font-bold text-white">Esvita Exam System</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Score Banner */}
          <div className={`bg-gradient-to-r ${scoreBg} p-8 text-center`}>
            <Award size={36} className="text-white/80 mx-auto mb-3" />
            <div className="text-6xl font-black text-white mb-1">{pct}%</div>
            <div className="text-white/90 font-semibold text-lg">{scoreLabel}</div>
            <div className="text-white/70 text-sm mt-1">{scoreDesc}</div>
          </div>

          <div className="p-6 space-y-5">
            {/* Candidate Info */}
            <div className="text-center">
              <p className="font-semibold text-slate-800">{candidateName}</p>
              <p className="text-sm text-slate-400">{examTitle}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-emerald-50 rounded-xl">
                <CheckCircle2 size={18} className="text-emerald-600 mx-auto mb-1" />
                <p className="text-xl font-bold text-emerald-700">{correctCount ?? 0}</p>
                <p className="text-[10px] text-emerald-600 font-medium">Correct</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-xl">
                <XCircle size={18} className="text-red-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-red-600">{wrongCount ?? 0}</p>
                <p className="text-[10px] text-red-500 font-medium">Wrong</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-xl">
                <HelpCircle size={18} className="text-slate-400 mx-auto mb-1" />
                <p className="text-xl font-bold text-slate-600">{skippedCount ?? 0}</p>
                <p className="text-[10px] text-slate-400 font-medium">Skipped</p>
              </div>
            </div>

            {/* Email notification */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5">
              <Mail size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-blue-800">Detailed report emailed</p>
                <p className="text-[11px] text-blue-600 mt-0.5">
                  A detailed report with correct answers and explanations has been sent to your email.
                </p>
              </div>
            </div>

            <div className="text-center text-xs text-slate-400">
              {totalQuestions} total questions
            </div>
          </div>
        </div>

        <p className="text-center text-slate-500/50 text-xs mt-5">You may close this window.</p>
      </div>
    </div>
  );
}

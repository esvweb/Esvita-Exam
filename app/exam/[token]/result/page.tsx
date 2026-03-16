'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Award, Mail, HelpCircle } from 'lucide-react';
import { GraduationCap } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';

interface SessionResult {
  score: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  candidateName: string;
  examTitle: string;
}

export default function ExamResultPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId') || '';
  const [result, setResult] = useState<SessionResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch result from session
    fetch(`/api/exam/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
      .then((r) => r.json())
      .then((data) => {
        setResult(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="text-blue-600 mb-3" />
          <p className="text-slate-500">Loading your results...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center text-slate-500">Results not available.</div>
      </div>
    );
  }

  const { score, totalQuestions, correctCount, wrongCount, skippedCount, candidateName, examTitle } = result;
  const isPassing = score >= 60;
  const isExcellent = score >= 80;

  const scoreColor = isExcellent ? 'text-emerald-600' : isPassing ? 'text-yellow-600' : 'text-red-600';
  const scoreBg = isExcellent ? 'from-emerald-500 to-emerald-600' : isPassing ? 'from-yellow-500 to-yellow-600' : 'from-red-500 to-red-600';
  const scoreLabel = isExcellent ? 'Excellent!' : isPassing ? 'Passed' : 'Needs Improvement';
  const scoreDesc = isExcellent
    ? 'Outstanding performance! You have demonstrated excellent knowledge.'
    : isPassing
    ? 'Good work! You have successfully passed this assessment.'
    : 'Keep studying! Review the areas you missed and try again.';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
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
            <div className="text-6xl font-black text-white mb-1">{score}%</div>
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
                <p className="text-xl font-bold text-emerald-700">{correctCount}</p>
                <p className="text-[10px] text-emerald-600 font-medium">Correct</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-xl">
                <XCircle size={18} className="text-red-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-red-600">{wrongCount}</p>
                <p className="text-[10px] text-red-500 font-medium">Wrong</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-xl">
                <HelpCircle size={18} className="text-slate-400 mx-auto mb-1" />
                <p className="text-xl font-bold text-slate-600">{skippedCount}</p>
                <p className="text-[10px] text-slate-400 font-medium">Skipped</p>
              </div>
            </div>

            {/* Email notification */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5">
              <Mail size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-blue-800">Result emailed to you</p>
                <p className="text-[11px] text-blue-600 mt-0.5">
                  A detailed report with correct answers and explanations has been sent to your email.
                </p>
              </div>
            </div>

            {/* Total */}
            <div className="text-center text-xs text-slate-400">
              {totalQuestions} total questions answered
            </div>
          </div>
        </div>

        <p className="text-center text-slate-500/50 text-xs mt-5">
          You may close this window.
        </p>
      </div>
    </div>
  );
}

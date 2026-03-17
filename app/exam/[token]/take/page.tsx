'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { Clock, CheckCircle2, ArrowRight, ArrowLeft, AlertTriangle, Flag } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';
import { formatSeconds, LANGUAGE_FLAGS, LANGUAGE_LABELS } from '@/lib/utils';
import type { Language } from '@/types';

interface QuestionOption { key: string; value: string; }
interface Question {
  id: string;
  questionText: string;
  options: QuestionOption[];
  answered: boolean;
}

interface SessionData {
  sessionId: string;
  examTitle: string;
  questions: Question[];
  totalQuestions: number;
  answeredCount: number;
  timePerQuestion: number;
  selectedLanguage: string;
  startedAt: string;
}

export default function ExamTakePage() {
  const { token } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('sessionId') || '';
  const lang = (searchParams.get('lang') || 'EN') as Language;

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const autoSubmitRef = useRef(false);

  // Load session data
  useEffect(() => {
    fetch(`/api/exam/start?sessionId=${sessionId}&lang=${lang}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          router.push(`/exam/${token}`);
          return;
        }
        setSessionData(data);
        const totalTime = data.totalQuestions * data.timePerQuestion;
        // Calculate remaining time based on start time
        const elapsed = Math.floor((Date.now() - new Date(data.startedAt).getTime()) / 1000);
        setTimeLeft(Math.max(0, totalTime - elapsed));
        startTimeRef.current = new Date(data.startedAt).getTime();
        setLoading(false);
      });
  }, [sessionId, lang, token, router]);

  // Timer
  useEffect(() => {
    if (!sessionData) return;
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1 && !autoSubmitRef.current) {
          autoSubmitRef.current = true;
          clearInterval(intervalRef.current!);
          // Auto-submit
          submitExam(true);
          return 0;
        }
        return Math.max(0, prev - 1);
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [sessionData]);

  const submitExam = useCallback(async (autoSubmit = false) => {
    if (submitting) return;
    setSubmitting(true);
    const timeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);

    const res = await fetch('/api/exam/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, timeTaken }),
    });
    const data = await res.json();
    if (res.ok) {
      router.push(`/exam/${token}/result?sessionId=${sessionId}`);
    } else {
      setSubmitting(false);
      autoSubmitRef.current = false;
    }
  }, [sessionId, token, router, submitting]);

  const handleAnswer = async (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));

    // Send to server
    await fetch('/api/exam/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, questionId, selectedAnswer: answer }),
    });
  };

  const handleSkip = async () => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: null }));
    await fetch('/api/exam/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, questionId: currentQuestion.id, selectedAnswer: null }),
    });
    if (currentIdx < (sessionData?.totalQuestions || 1) - 1) {
      setCurrentIdx((i) => i + 1);
    }
  };

  if (loading || !sessionData) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center"><Spinner size="lg" className="text-blue-600 mb-3" /><p className="text-slate-500">Loading exam...</p></div>
      </div>
    );
  }

  const currentQuestion = sessionData.questions[currentIdx];
  const answeredCount = Object.keys(answers).length;
  const totalTime = sessionData.totalQuestions * sessionData.timePerQuestion;
  const progress = ((currentIdx + 1) / sessionData.totalQuestions) * 100;
  const timerPct = timeLeft / totalTime;
  const timerClass = timerPct < 0.1 ? 'timer-danger' : timerPct < 0.25 ? 'timer-warning' : 'text-slate-700';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">E</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 leading-tight line-clamp-1 hidden sm:block max-w-[200px] lg:max-w-xs">
              {sessionData.examTitle}
            </p>
            <p className="text-xs text-slate-400 hidden sm:block">
              {LANGUAGE_FLAGS[lang]} {LANGUAGE_LABELS[lang]}
            </p>
          </div>
        </div>

        {/* Timer */}
        <div className={`flex items-center gap-2 font-mono font-bold text-xl ${timerClass}`}>
          <Clock size={18} />
          {formatSeconds(timeLeft)}
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="font-semibold text-slate-700">{currentIdx + 1}</span>
          <span>/</span>
          <span>{sessionData.totalQuestions}</span>
          <span className="hidden sm:inline text-slate-400 text-xs">({answeredCount} answered)</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-slate-200">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 flex items-start justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl">
          {/* Question Number Dots */}
          <div className="flex flex-wrap gap-1.5 mb-6 justify-center">
            {sessionData.questions.map((q, i) => {
              const ans = answers[q.id];
              const isAnswered = ans !== undefined;
              const isCurrent = i === currentIdx;
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIdx(i)}
                  className={`w-7 h-7 rounded-full text-[11px] font-semibold transition-all ${
                    isCurrent ? 'bg-blue-600 text-white ring-2 ring-blue-300' :
                    isAnswered && ans !== null ? 'bg-emerald-500 text-white' :
                    isAnswered && ans === null ? 'bg-slate-300 text-slate-600' :
                    'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          {/* Question Card */}
          {currentQuestion && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge-blue text-xs">Question {currentIdx + 1}</span>
                  {answers[currentQuestion.id] !== undefined && (
                    <span className={`badge text-xs ${answers[currentQuestion.id] !== null ? 'badge-green' : 'badge-gray'}`}>
                      {answers[currentQuestion.id] !== null ? 'Answered' : 'Skipped'}
                    </span>
                  )}
                </div>
                <p className="text-slate-800 font-medium text-base leading-relaxed">
                  {currentQuestion.questionText || 'Question text not available in selected language.'}
                </p>
              </div>

              <div className="p-6 space-y-2.5">
                {currentQuestion.options.map((option) => {
                  const isSelected = answers[currentQuestion.id] === option.key;
                  return (
                    <button
                      key={option.key}
                      onClick={() => handleAnswer(currentQuestion.id, option.key)}
                      className={`w-full text-left flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-800'
                          : 'border-slate-200 text-slate-700 hover:border-blue-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm flex-shrink-0 transition-all ${
                        isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 text-slate-500'
                      }`}>
                        {isSelected ? <CheckCircle2 size={16} /> : option.key}
                      </div>
                      <span className="flex-1 text-sm leading-snug">{option.value}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-4 gap-3">
            <button
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              className="btn-secondary"
            >
              <ArrowLeft size={16} /> Previous
            </button>

            <button
              onClick={handleSkip}
              className="btn-ghost text-slate-500 text-sm"
            >
              Skip
            </button>

            {currentIdx < sessionData.totalQuestions - 1 ? (
              <button
                onClick={() => setCurrentIdx((i) => Math.min(sessionData.totalQuestions - 1, i + 1))}
                className="btn-primary"
              >
                Next <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={() => setConfirmSubmit(true)}
                className="btn-success"
              >
                <Flag size={16} /> Finish Exam
              </button>
            )}
          </div>

          {/* Submit Confirm */}
          {confirmSubmit && (
            <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <AlertTriangle size={20} className="text-amber-600" />
                  </div>
                  <h3 className="font-semibold text-slate-800">Submit Exam?</h3>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 mb-4 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Answered</span><span className="font-semibold text-emerald-600">{answeredCount}</span></div>
                  <div className="flex justify-between mt-1"><span className="text-slate-500">Unanswered</span><span className="font-semibold text-slate-400">{sessionData.totalQuestions - answeredCount}</span></div>
                  <div className="flex justify-between mt-1"><span className="text-slate-500">Total</span><span className="font-semibold">{sessionData.totalQuestions}</span></div>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Once submitted, you cannot return to change your answers.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmSubmit(false)} className="btn-secondary flex-1" disabled={submitting}>
                    Go Back
                  </button>
                  <button onClick={() => { setConfirmSubmit(false); submitExam(); }} className="btn-success flex-1" disabled={submitting}>
                    {submitting ? <Spinner size="sm" className="text-white" /> : null}
                    {submitting ? 'Submitting...' : 'Submit Exam'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

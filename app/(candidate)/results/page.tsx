'use client';

import { useState } from 'react';
import Spinner from '@/components/ui/Spinner';
import {
  Mail, KeyRound, ClipboardList, Clock, CheckCircle2, XCircle,
  LogOut, ChevronDown, ChevronUp, ArrowRight, PlayCircle, RotateCcw,
} from 'lucide-react';
import Link from 'next/link';

interface ActiveExam {
  token: string;
  examId: string;
  examTitle: string;
  totalQuestions: number;
  timePerQuestion: number;
  expiresAt: string;
  inProgressSessionId: string | null;
  startedAt: string | null;
}

interface SessionResult {
  sessionId: string;
  examTitle: string;
  score?: number;
  correctCount?: number;
  wrongCount?: number;
  skippedCount?: number;
  totalQuestions?: number;
  completedAt: string;
  pending: boolean;
  resultsAvailableAt: string | null;
}

type Step = 'email' | 'otp' | 'portal';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h remaining`;
  return `${hours}h remaining`;
}

function ScoreCircle({ score }: { score: number }) {
  const pct = Math.round(score);
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
  const label = pct >= 80 ? 'Excellent' : pct >= 60 ? 'Good' : 'Needs Work';
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 80 80" className="w-20 h-20">
        <circle cx="40" cy="40" r="34" fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="40" cy="40" r="34" fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 34}`}
          strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct / 100)}`}
          transform="rotate(-90 40 40)"
        />
        <text x="40" y="44" textAnchor="middle" fontSize="18" fontWeight="700" fill={color}>{pct}%</text>
      </svg>
      <span className="text-xs font-semibold mt-1" style={{ color }}>{label}</span>
    </div>
  );
}

export default function CandidatePortalPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [nickname, setNickname] = useState('');
  const [activeExams, setActiveExams] = useState<ActiveExam[]>([]);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErrorMsg(''); setSuccessMsg('');
    const res = await fetch('/api/candidate/request-otp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    const d = await res.json();
    if (res.ok) {
      setSuccessMsg('Verification code sent! Check your inbox.');
      setStep('otp');
    } else {
      setErrorMsg(d.error || 'Failed to send code');
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErrorMsg('');
    const res = await fetch('/api/candidate/verify-otp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), otp: otp.trim() }),
    });
    const d = await res.json();
    if (res.ok) {
      await loadPortal();
    } else {
      setErrorMsg(d.error || 'Invalid verification code');
      setLoading(false);
    }
  };

  const loadPortal = async () => {
    const [examsRes, resultsRes] = await Promise.all([
      fetch('/api/candidate/my-exams'),
      fetch('/api/candidate/my-results'),
    ]);

    if (examsRes.ok) {
      const d = await examsRes.json();
      setActiveExams(d.activeExams || []);
      setNickname(d.nickname || '');
    }

    if (resultsRes.ok) {
      const d = await resultsRes.json();
      setResults(d.sessions || []);
    }

    setStep('portal');
    setLoading(false);
  };

  const handleLogout = async () => {
    await fetch('/api/candidate/logout', { method: 'POST' });
    setStep('email');
    setEmail(''); setOtp(''); setResults([]); setActiveExams([]);
  };

  return (
    <div className="w-full max-w-lg">

      {/* Email step */}
      {step === 'email' && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ClipboardList size={26} className="text-blue-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Candidate Portal</h1>
            <p className="text-sm text-slate-500 mt-1">Enter your email to receive a verification code</p>
          </div>

          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email" required
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{errorMsg}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Spinner size="sm" className="text-white" /> : <Mail size={16} />}
              {loading ? 'Sending...' : 'Send Verification Code'}
            </button>
          </form>
        </div>
      )}

      {/* OTP step */}
      {step === 'otp' && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <KeyRound size={26} className="text-emerald-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Enter Verification Code</h1>
            <p className="text-sm text-slate-500 mt-1">
              We sent a 6-digit code to <strong>{email}</strong>
            </p>
          </div>

          {successMsg && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">{successMsg}</div>
          )}

          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Verification Code</label>
              <input
                type="text" required maxLength={6}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-center text-2xl font-mono tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{errorMsg}</div>
            )}

            <button type="submit" disabled={loading || otp.length < 6}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Spinner size="sm" className="text-white" /> : <CheckCircle2 size={16} />}
              {loading ? 'Signing in...' : 'Access Portal'}
            </button>

            <button type="button" onClick={() => { setStep('email'); setErrorMsg(''); setSuccessMsg(''); }}
              className="w-full text-sm text-slate-500 hover:text-slate-700 py-1 transition-colors"
            >
              ← Use a different email
            </button>
          </form>
        </div>
      )}

      {/* Portal — active exams + past results */}
      {step === 'portal' && (
        <div className="w-full space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-800">
                Hello, {nickname || 'there'} 👋
              </h1>
              <p className="text-xs text-slate-400">{email}</p>
            </div>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-500 transition-colors"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>

          {/* Active exams */}
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <PlayCircle size={15} className="text-blue-600" />
              Active Exams
            </h2>

            {activeExams.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-7 text-center">
                <CheckCircle2 size={30} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No active exams assigned to you right now.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeExams.map((exam) => (
                  <div key={exam.token} className="bg-white rounded-2xl border border-blue-200 shadow-sm p-5 flex items-start gap-4">
                    <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <ClipboardList size={20} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{exam.examTitle}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {exam.totalQuestions} questions · {Math.round(exam.timePerQuestion / 60)} min/question
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                          <Clock size={9} className="inline mr-0.5" />
                          {timeUntil(exam.expiresAt)}
                        </span>
                        {exam.inProgressSessionId && (
                          <span className="text-[11px] text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">
                            In progress
                          </span>
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/exam/${exam.token}`}
                      className="shrink-0 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                    >
                      {exam.inProgressSessionId ? (
                        <><RotateCcw size={13} /> Resume</>
                      ) : (
                        <><ArrowRight size={13} /> Start</>
                      )}
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Past results */}
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <ClipboardList size={15} className="text-slate-500" />
              Past Results
            </h2>

            {results.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-7 text-center">
                <ClipboardList size={30} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No completed exams yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((s) => (
                  <div key={s.sessionId} className="bg-white rounded-2xl shadow border border-slate-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === s.sessionId ? null : s.sessionId)}
                      className="w-full text-left p-5 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        {s.pending ? (
                          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Clock size={22} className="text-amber-600" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <CheckCircle2 size={22} className="text-emerald-600" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{s.examTitle}</p>
                          <p className="text-xs text-slate-400 mt-0.5">Completed {formatDate(s.completedAt)}</p>
                          {s.pending ? (
                            <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-full">
                              <Clock size={11} />
                              Results available {s.resultsAvailableAt ? formatDate(s.resultsAvailableAt) : 'soon'}
                            </div>
                          ) : (
                            <div className="mt-2 flex items-center gap-3">
                              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                                (s.score ?? 0) >= 80 ? 'bg-emerald-100 text-emerald-700' :
                                (s.score ?? 0) >= 60 ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {Math.round(s.score ?? 0)}%
                              </span>
                              <span className="text-xs text-slate-500">{s.correctCount}/{s.totalQuestions} correct</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-slate-400">
                          {expandedId === s.sessionId ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </button>

                    {expandedId === s.sessionId && (
                      <div className="border-t border-slate-100 p-5">
                        {s.pending ? (
                          <div className="text-center py-4">
                            <Clock size={32} className="mx-auto text-amber-400 mb-3" />
                            <p className="font-semibold text-slate-700">Results are being processed</p>
                            <p className="text-sm text-slate-500 mt-1">
                              Your detailed results will be available and emailed to you
                              {s.resultsAvailableAt ? ` on ${formatDate(s.resultsAvailableAt)}` : ' soon'}.
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row items-center gap-6">
                            <ScoreCircle score={s.score ?? 0} />
                            <div className="flex-1 space-y-2.5 w-full">
                              <div className="grid grid-cols-3 gap-3 text-center">
                                <div className="bg-emerald-50 rounded-xl p-3">
                                  <CheckCircle2 size={16} className="text-emerald-600 mx-auto mb-1" />
                                  <p className="text-xl font-bold text-emerald-700">{s.correctCount}</p>
                                  <p className="text-[10px] text-emerald-600">Correct</p>
                                </div>
                                <div className="bg-red-50 rounded-xl p-3">
                                  <XCircle size={16} className="text-red-500 mx-auto mb-1" />
                                  <p className="text-xl font-bold text-red-600">{s.wrongCount}</p>
                                  <p className="text-[10px] text-red-500">Wrong</p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3">
                                  <Clock size={16} className="text-slate-400 mx-auto mb-1" />
                                  <p className="text-xl font-bold text-slate-600">{s.skippedCount}</p>
                                  <p className="text-[10px] text-slate-500">Skipped</p>
                                </div>
                              </div>
                              <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
                                <p><span className="font-medium">Total questions:</span> {s.totalQuestions}</p>
                                <p className="mt-0.5"><span className="font-medium">Completed on:</span> {formatDate(s.completedAt)}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="text-center text-xs text-slate-400 pb-4">
            Detailed results are emailed automatically once the exam period closes.
          </p>
        </div>
      )}
    </div>
  );
}

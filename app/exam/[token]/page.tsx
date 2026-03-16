'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GraduationCap, Globe, Shield, ArrowRight, Clock, HelpCircle, AlertCircle } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS, formatDuration } from '@/lib/utils';
import type { Language } from '@/types';

interface ExamInfo {
  invitationId: string;
  examId: string;
  examTitle: string;
  availableLanguages: Language[];
  totalQuestions: number;
  timePerQuestion: number;
  candidateName: string | null;
  candidateEmail: string;
  type: string;
}

export default function ExamEntryPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [step, setStep] = useState<'loading' | 'otp' | 'language' | 'error'>('loading');
  const [examInfo, setExamInfo] = useState<ExamInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [invitationId, setInvitationId] = useState('');
  const [selectedLang, setSelectedLang] = useState<Language | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    fetch(`/api/exam/verify?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setErrorMsg(data.error);
          setStep('error');
        } else {
          setExamInfo(data);
          setInvitationId(data.invitationId);
          setStep('otp');
        }
      })
      .catch(() => {
        setErrorMsg('Failed to load exam. Please check your link.');
        setStep('error');
      });
  }, [token]);

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');
    setVerifyingOtp(true);

    const res = await fetch('/api/exam/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, otp }),
    });
    const data = await res.json();

    if (res.ok) {
      setStep('language');
    } else {
      setOtpError(data.error || 'Invalid OTP');
    }
    setVerifyingOtp(false);
  };

  const handleStartExam = async () => {
    if (!selectedLang || !examInfo) return;
    setStarting(true);

    const res = await fetch('/api/exam/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId, selectedLanguage: selectedLang }),
    });
    const data = await res.json();

    if (res.ok) {
      router.push(`/exam/${token}/take?sessionId=${data.sessionId}&lang=${selectedLang}`);
    } else {
      setErrorMsg(data.error || 'Failed to start exam');
      setStep('error');
    }
    setStarting(false);
  };

  const totalTime = examInfo ? examInfo.totalQuestions * examInfo.timePerQuestion : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-300/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl mb-3 border border-white/20">
            <GraduationCap size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Esvita Exam System</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Loading */}
          {step === 'loading' && (
            <div className="p-10 flex flex-col items-center gap-3">
              <Spinner size="lg" className="text-blue-600" />
              <p className="text-slate-500 text-sm">Loading exam...</p>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="p-8 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={28} className="text-red-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800 mb-2">Access Denied</h2>
              <p className="text-slate-500 text-sm">{errorMsg}</p>
              <p className="text-slate-400 text-xs mt-4">Please contact your administrator for assistance.</p>
            </div>
          )}

          {/* OTP Verification */}
          {step === 'otp' && examInfo && (
            <div className="p-7">
              <div className="flex items-center gap-2 mb-5">
                <Shield size={18} className="text-blue-600" />
                <h2 className="font-semibold text-slate-800">Enter Your OTP</h2>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 mb-5">
                <p className="font-semibold text-blue-800 text-sm">{examInfo.examTitle}</p>
                <div className="flex gap-4 mt-2 text-xs text-blue-600">
                  <span className="flex items-center gap-1"><HelpCircle size={11} />{examInfo.totalQuestions} questions</span>
                  <span className="flex items-center gap-1"><Clock size={11} />{formatDuration(totalTime)}</span>
                </div>
              </div>
              {examInfo.candidateName && (
                <p className="text-sm text-slate-600 mb-4">
                  Welcome, <strong>{examInfo.candidateName}</strong>!<br />
                  <span className="text-slate-400 text-xs">Check your email for the OTP code.</span>
                </p>
              )}
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                {otpError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
                    {otpError}
                  </div>
                )}
                <div className="form-group">
                  <label className="label">One-Time Password</label>
                  <input
                    type="text"
                    className="input text-center text-2xl font-mono tracking-[0.5em] otp-input"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    required
                    autoFocus
                  />
                </div>
                <button type="submit" className="btn-primary w-full" disabled={verifyingOtp || otp.length !== 6}>
                  {verifyingOtp ? <Spinner size="sm" className="text-white" /> : <Shield size={16} />}
                  {verifyingOtp ? 'Verifying...' : 'Verify & Continue'}
                </button>
              </form>
            </div>
          )}

          {/* Language Selection */}
          {step === 'language' && examInfo && (
            <div className="p-7">
              <div className="flex items-center gap-2 mb-2">
                <Globe size={18} className="text-blue-600" />
                <h2 className="font-semibold text-slate-800">Select Your Language</h2>
              </div>
              <p className="text-xs text-slate-400 mb-5">
                Choose the language you want to take this exam in.
              </p>
              <div className="space-y-2 mb-6">
                {examInfo.availableLanguages.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setSelectedLang(lang)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all ${
                      selectedLang === lang
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-700 hover:border-blue-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-2xl">{LANGUAGE_FLAGS[lang]}</span>
                    <span className="font-medium text-sm">{LANGUAGE_LABELS[lang]}</span>
                    {selectedLang === lang && (
                      <span className="ml-auto w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-white" />
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-xs text-amber-700">
                <strong>Before you start:</strong>
                <ul className="mt-1.5 space-y-1 list-disc list-inside">
                  <li>{examInfo.totalQuestions} questions total</li>
                  <li>{examInfo.timePerQuestion} seconds per question ({formatDuration(totalTime)} total)</li>
                  <li>Questions appear in randomized order</li>
                  <li>Results sent to your email automatically</li>
                  <li>You cannot restart once you begin</li>
                </ul>
              </div>

              <button
                onClick={handleStartExam}
                disabled={!selectedLang || starting}
                className="btn-primary w-full btn-lg"
              >
                {starting ? <Spinner size="sm" className="text-white" /> : <ArrowRight size={18} />}
                {starting ? 'Starting Exam...' : 'Start Exam Now'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

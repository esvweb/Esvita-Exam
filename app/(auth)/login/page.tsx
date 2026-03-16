'use client';

import { useState } from 'react';
import { GraduationCap, Mail, Shield, ArrowRight, RefreshCw } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';

type Step = 'email' | 'otp';

export default function LoginPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send OTP');
      } else {
        setStep('otp');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid or expired code');
      } else {
        window.location.href = '/dashboard';
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-300/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo Card */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl mb-4 border border-white/20">
            <GraduationCap size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Esvita Exam System</h1>
          <p className="text-blue-200 text-sm mt-1">Medical Advisor Assessment Platform</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Step indicator */}
          <div className="flex border-b border-slate-100">
            <div className={`flex-1 py-3 text-center text-xs font-semibold transition-colors ${step === 'email' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}>
              <span className="inline-flex items-center gap-1.5">
                <Mail size={13} /> Email
              </span>
            </div>
            <div className={`flex-1 py-3 text-center text-xs font-semibold transition-colors ${step === 'otp' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}>
              <span className="inline-flex items-center gap-1.5">
                <Shield size={13} /> Verification
              </span>
            </div>
          </div>

          <div className="p-8">
            {step === 'email' ? (
              <form onSubmit={handleSendOTP} className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Sign in to your account</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Enter your Esvita email to receive a one-time code
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                    {error}
                  </div>
                )}

                <div className="form-group">
                  <label className="label" htmlFor="email">Email Address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="email"
                      type="email"
                      className="input pl-9"
                      placeholder="you@esvitaclinic.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Only @esvitaclinic.com and @esvita.clinic emails are accepted
                  </p>
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full btn-lg"
                  disabled={loading || !email}
                >
                  {loading ? <Spinner size="sm" className="text-white" /> : <ArrowRight size={18} />}
                  {loading ? 'Sending Code...' : 'Send Verification Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP} className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Enter verification code</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    We sent a 6-digit code to <strong className="text-slate-700">{email}</strong>
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                    {error}
                  </div>
                )}

                <div className="form-group">
                  <label className="label" htmlFor="otp">One-Time Password</label>
                  <input
                    id="otp"
                    type="text"
                    className="input text-center text-2xl font-mono tracking-[0.5em] otp-input"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    required
                    autoFocus
                  />
                  <p className="text-xs text-slate-400 mt-1 text-center">Valid for 10 minutes</p>
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full btn-lg"
                  disabled={loading || otp.length !== 6}
                >
                  {loading ? <Spinner size="sm" className="text-white" /> : <Shield size={18} />}
                  {loading ? 'Verifying...' : 'Verify & Sign In'}
                </button>

                <button
                  type="button"
                  className="w-full text-center text-sm text-slate-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-1.5"
                  onClick={() => { setStep('email'); setOtp(''); setError(''); }}
                >
                  <RefreshCw size={13} /> Change email address
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-blue-300/60 text-xs mt-6">
          &copy; {new Date().getFullYear()} Esvita Clinic &bull; Secure Exam Platform
        </p>
      </div>
    </div>
  );
}

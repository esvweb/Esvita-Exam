'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/admin/Header';
import Spinner from '@/components/ui/Spinner';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS, formatDate, formatDateTime } from '@/lib/utils';
import type { Language } from '@/types';
import {
  ArrowLeft, Mail, Globe, Award, ClipboardList,
  TrendingUp, CheckCircle2, XCircle, Minus
} from 'lucide-react';
import Link from 'next/link';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart
} from 'recharts';

interface AudienceSession {
  id: string;
  examId: string;
  selectedLanguage: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  completedAt: string;
  exam: { titleEn: string | null; titleTr: string | null };
}

interface AudienceProfile {
  id: string;
  name: string;
  email: string;
  preferredLanguage: string;
  isActive: boolean;
  createdAt: string;
  examSessions: AudienceSession[];
}

export default function AudienceProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<AudienceProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/audiences/${id}`)
      .then((r) => r.json())
      .then(setProfile)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div>
        <Header title="Candidate Profile" />
        <div className="flex justify-center py-20"><Spinner className="text-blue-500" /></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div>
        <Header title="Not Found" />
        <div className="p-6 text-center text-slate-500">Candidate not found.</div>
      </div>
    );
  }

  const sessions = profile.examSessions;
  const avgScore = sessions.length > 0
    ? Math.round(sessions.reduce((a, s) => a + (s.score ?? 0), 0) / sessions.length)
    : 0;
  const bestScore = sessions.length > 0 ? Math.max(...sessions.map((s) => s.score ?? 0)) : 0;

  const chartData = [...sessions]
    .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())
    .map((s, i) => ({
      name: `#${i + 1}`,
      score: s.score ?? 0,
      exam: s.exam.titleEn || s.exam.titleTr || 'Exam',
      date: formatDate(s.completedAt),
    }));

  const initials = profile.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div>
      <Header title="Candidate Profile" subtitle={profile.name} />
      <div className="p-6 space-y-6">
        <Link href="/audiences" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors">
          <ArrowLeft size={15} /> Back to Candidates
        </Link>

        {/* Profile Header */}
        <div className="card p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 text-xl font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-800">{profile.name}</h2>
            <div className="flex flex-wrap gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-sm text-slate-500">
                <Mail size={13} /> {profile.email}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-slate-500">
                <Globe size={13} />
                {LANGUAGE_FLAGS[profile.preferredLanguage as Language]}{' '}
                {LANGUAGE_LABELS[profile.preferredLanguage as Language]}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-slate-400">
                Joined {formatDate(profile.createdAt)}
              </span>
            </div>
          </div>
          <div className="flex-shrink-0">
            {profile.isActive ? (
              <span className="badge-green text-sm px-3 py-1">Active</span>
            ) : (
              <span className="badge-red text-sm px-3 py-1">Inactive</span>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Exams Taken', value: sessions.length, icon: ClipboardList, color: 'blue' },
            { label: 'Average Score', value: sessions.length > 0 ? `${avgScore}%` : '—', icon: TrendingUp, color: 'violet' },
            { label: 'Best Score', value: sessions.length > 0 ? `${bestScore}%` : '—', icon: Award, color: 'amber' },
            { label: 'Status', value: profile.isActive ? 'Active' : 'Inactive', icon: CheckCircle2, color: 'emerald' },
          ].map((s) => (
            <div key={s.label} className="card p-4 text-center">
              <p className="text-2xl font-bold text-slate-800">{s.value}</p>
              <p className="text-xs text-slate-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Score Trend Chart */}
        {chartData.length > 0 && (
          <div className="card p-6">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-600" /> Score Trend Over Time
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload?.[0]) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
                          <p className="font-semibold text-slate-700">{d.exam}</p>
                          <p className="text-slate-400">{d.date}</p>
                          <p className="text-blue-600 font-bold text-base mt-1">{d.score}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={60} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: 'Pass 60%', fill: '#d97706', fontSize: 10 }} />
                <Area type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2.5} fill="url(#scoreGrad)" dot={{ r: 5, fill: '#3b82f6', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Exam History Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <ClipboardList size={16} className="text-slate-500" /> Exam History
            </h3>
          </div>
          {sessions.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">
              This candidate has not completed any exams yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Exam</th>
                    <th>Language</th>
                    <th>Score</th>
                    <th>Correct</th>
                    <th>Wrong</th>
                    <th>Skipped</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {[...sessions]
                    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
                    .map((s, i) => {
                      const scoreColor = (s.score ?? 0) >= 80 ? 'text-emerald-600' : (s.score ?? 0) >= 60 ? 'text-yellow-600' : 'text-red-600';
                      return (
                        <tr key={s.id}>
                          <td className="text-slate-400 text-xs">{sessions.length - i}</td>
                          <td className="font-medium text-slate-700">
                            {s.exam.titleEn || s.exam.titleTr || 'Exam'}
                          </td>
                          <td>
                            <span className="text-sm">
                              {LANGUAGE_FLAGS[s.selectedLanguage as Language]} {s.selectedLanguage}
                            </span>
                          </td>
                          <td>
                            <span className={`font-bold text-lg ${scoreColor}`}>{s.score ?? 0}%</span>
                          </td>
                          <td>
                            <span className="flex items-center gap-1 text-emerald-600 font-medium">
                              <CheckCircle2 size={13} /> {s.correctCount ?? 0}
                            </span>
                          </td>
                          <td>
                            <span className="flex items-center gap-1 text-red-500 font-medium">
                              <XCircle size={13} /> {s.wrongCount ?? 0}
                            </span>
                          </td>
                          <td>
                            <span className="flex items-center gap-1 text-slate-400">
                              <Minus size={13} /> {s.skippedCount ?? 0}
                            </span>
                          </td>
                          <td className="text-slate-400 text-xs">{formatDateTime(s.completedAt)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

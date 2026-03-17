'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/admin/Header';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS, formatDate, formatDateTime } from '@/lib/utils';
import type { Language } from '@/types';
import {
  ArrowLeft, Mail, Globe, Award, ClipboardList,
  TrendingUp, CheckCircle2, XCircle, Minus, Send,
} from 'lucide-react';
import Link from 'next/link';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
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
  nickname: string | null;
  realName: string | null;
  preferredLanguage: string;
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
  examSessions: AudienceSession[];
}

interface AvailableExam {
  id: string;
  titleEn: string | null;
  titleTr: string | null;
  isActive: boolean;
  _count: { questions: number };
}

export default function AudienceProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { success, error } = useToast();
  const [profile, setProfile] = useState<AudienceProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Assign exam modal
  const [showAssign, setShowAssign] = useState(false);
  const [exams, setExams] = useState<AvailableExam[]>([]);
  const [assigning, setAssigning] = useState(false);

  const fetchProfile = useCallback(async () => {
    const res = await fetch(`/api/admin/audiences/${id}`);
    if (res.ok) setProfile(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const openAssignModal = async () => {
    setShowAssign(true);
    if (exams.length === 0) {
      const res = await fetch('/api/admin/exams');
      if (res.ok) setExams(await res.json());
    }
  };

  const handleAssignExam = async (examId: string) => {
    setAssigning(true);
    const res = await fetch(`/api/admin/exams/${examId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignTo: 'users', audienceIds: [id] }),
    });
    const d = await res.json();
    if (res.ok) {
      success(d.sent > 0 ? 'Exam invitation sent!' : 'Already invited or skipped');
      setShowAssign(false);
      fetchProfile();
    } else {
      error(d.error || 'Failed to assign exam');
    }
    setAssigning(false);
  };

  if (loading) {
    return (
      <div>
        <Header title="Audience Profile" />
        <div className="flex justify-center py-20"><Spinner className="text-blue-500" /></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div>
        <Header title="Not Found" />
        <div className="p-6 text-center text-slate-500">Audience member not found.</div>
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

  const displayName = profile.realName || profile.name;
  const initials = displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const statusBadge = profile.isArchived
    ? <span className="badge-gray text-sm px-3 py-1">Archived</span>
    : profile.isActive
    ? <span className="badge-green text-sm px-3 py-1">Active</span>
    : <span className="badge-red text-sm px-3 py-1">Passive</span>;

  return (
    <div>
      <Header title="Audience Profile" subtitle={displayName} />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Link href="/audiences" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors">
            <ArrowLeft size={15} /> Back to Audience
          </Link>
          <button onClick={openAssignModal} className="btn-primary btn-sm">
            <Send size={14} /> Assign Exam
          </button>
        </div>

        {/* Profile Header */}
        <div className="card p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 text-xl font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-800">{displayName}</h2>
              {profile.nickname && (
                <span className="text-sm text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{profile.nickname}</span>
              )}
            </div>
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
          <div className="flex-shrink-0">{statusBadge}</div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Exams Taken', value: sessions.length },
            { label: 'Average Score', value: sessions.length > 0 ? `${avgScore}%` : '—' },
            { label: 'Best Score', value: sessions.length > 0 ? `${bestScore}%` : '—' },
            { label: 'Status', value: profile.isArchived ? 'Archived' : profile.isActive ? 'Active' : 'Passive' },
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
              This audience member has not completed any exams yet.
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

      {/* Assign Exam Modal */}
      <Modal isOpen={showAssign} onClose={() => setShowAssign(false)} title={`Assign Exam — ${displayName}`} size="lg">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Select an exam to send an invitation to this audience member.</p>
          {exams.length === 0 ? (
            <div className="py-6 text-center"><Spinner className="text-blue-500" /></div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {exams.filter(e => e.isActive).map((exam) => (
                <div key={exam.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors">
                  <div>
                    <p className="font-medium text-slate-800 text-sm">{exam.titleEn || exam.titleTr || 'Untitled'}</p>
                    <p className="text-xs text-slate-400">{exam._count.questions} questions</p>
                  </div>
                  <button
                    type="button"
                    disabled={assigning}
                    onClick={() => handleAssignExam(exam.id)}
                    className="btn-primary btn-sm flex-shrink-0"
                  >
                    {assigning ? <Spinner size="sm" className="text-white" /> : <Send size={13} />}
                    Assign
                  </button>
                </div>
              ))}
              {exams.filter(e => e.isActive).length === 0 && (
                <p className="text-center text-slate-400 py-4 text-sm">No active exams available.</p>
              )}
            </div>
          )}
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button type="button" className="btn-secondary" onClick={() => setShowAssign(false)}>Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

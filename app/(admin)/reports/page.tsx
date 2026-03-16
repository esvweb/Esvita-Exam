'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/admin/Header';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import {
  BarChart3, Download, RefreshCw, TrendingUp, Award,
  CheckCircle2, XCircle, HelpCircle, Users, Filter
} from 'lucide-react';
import Spinner from '@/components/ui/Spinner';
import PageTransition from '@/components/ui/PageTransition';
import { formatDateTime, LANGUAGE_FLAGS } from '@/lib/utils';
import type { Language } from '@/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

interface ReportRow {
  candidateName: string;
  candidateEmail: string;
  examTitle: string;
  language: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  totalQuestions: number;
  timeTaken: number | null;
  completedAt: string;
}

interface Exam { id: string; titleEn: string | null; titleTr: string | null; }

const SCORE_COLORS = ['#22c55e', '#eab308', '#ef4444'];

export default function ReportsPage() {
  const { error } = useToast();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [selectedExam, setSelectedExam] = useState('');
  const [activeChart, setActiveChart] = useState<'bar' | 'pie'>('bar');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [repRes, examsRes] = await Promise.all([
      fetch(`/api/admin/reports${selectedExam ? `?examId=${selectedExam}` : ''}`),
      fetch('/api/admin/exams'),
    ]);
    if (repRes.ok) {
      const d = await repRes.json();
      setRows(d.sessions || []);
    }
    if (examsRes.ok) setExams(await examsRes.json());
    setLoading(false);
  }, [selectedExam]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDownloadCSV = async () => {
    setDownloading(true);
    const url = `/api/admin/reports?format=csv${selectedExam ? `&examId=${selectedExam}` : ''}`;
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `esvita-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setDownloading(false);
  };

  // Stats
  const totalAttempts = rows.length;
  const avgScore = rows.length > 0 ? Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length) : 0;
  const passRate = rows.length > 0 ? Math.round((rows.filter((r) => r.score >= 60).length / rows.length) * 100) : 0;
  const highScorers = rows.filter((r) => r.score >= 80).length;

  // Chart data: score distribution
  const scoreBuckets = [
    { label: '0-40%', count: rows.filter((r) => r.score < 40).length, fill: '#ef4444' },
    { label: '40-60%', count: rows.filter((r) => r.score >= 40 && r.score < 60).length, fill: '#f97316' },
    { label: '60-80%', count: rows.filter((r) => r.score >= 60 && r.score < 80).length, fill: '#eab308' },
    { label: '80-100%', count: rows.filter((r) => r.score >= 80).length, fill: '#22c55e' },
  ];

  // Pie: pass/fail
  const pieData = [
    { name: 'Excellent (≥80%)', value: rows.filter((r) => r.score >= 80).length, color: '#22c55e' },
    { name: 'Pass (60-79%)', value: rows.filter((r) => r.score >= 60 && r.score < 80).length, color: '#eab308' },
    { name: 'Fail (<60%)', value: rows.filter((r) => r.score < 60).length, color: '#ef4444' },
  ].filter((d) => d.value > 0);

  return (
    <div>
      <Header title="Reports" subtitle="Exam performance analytics and data export" />
      <PageTransition>
      <div className="p-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-slate-400" />
            <select
              className="input w-64"
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
            >
              <option value="">All Exams</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>{e.titleEn || e.titleTr || 'Untitled'}</option>
              ))}
            </select>
          </div>
          <button onClick={fetchData} className="btn-secondary btn-sm"><RefreshCw size={14} /></button>
          <button onClick={handleDownloadCSV} disabled={downloading || rows.length === 0} className="btn-primary btn-sm ml-auto">
            {downloading ? <Spinner size="sm" className="text-white" /> : <Download size={14} />}
            {downloading ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Attempts', value: totalAttempts, icon: Users, color: 'blue' },
            { label: 'Average Score', value: `${avgScore}%`, icon: TrendingUp, color: 'violet' },
            { label: 'Pass Rate', value: `${passRate}%`, icon: CheckCircle2, color: 'emerald' },
            { label: 'High Scorers (≥80%)', value: highScorers, icon: Award, color: 'amber' },
          ].map((s) => (
            <div key={s.label} className="card p-5 flex items-center gap-4">
              <div className={`p-3 rounded-xl flex-shrink-0 ${
                s.color === 'blue' ? 'bg-blue-50' :
                s.color === 'violet' ? 'bg-violet-50' :
                s.color === 'emerald' ? 'bg-emerald-50' : 'bg-amber-50'
              }`}>
                <s.icon size={20} className={
                  s.color === 'blue' ? 'text-blue-600' :
                  s.color === 'violet' ? 'text-violet-600' :
                  s.color === 'emerald' ? 'text-emerald-600' : 'text-amber-600'
                } />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-800">{s.value}</p>
                <p className="text-xs text-slate-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
        {rows.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Score Distribution Bar */}
            <div className="card p-5">
              <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <BarChart3 size={16} className="text-blue-600" /> Score Distribution
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={scoreBuckets} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload?.[0]) {
                        return (
                          <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
                            <p className="font-semibold">{payload[0].payload.label}</p>
                            <p className="text-slate-600">{payload[0].value} candidates</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {scoreBuckets.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie Chart */}
            <div className="card p-5">
              <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Award size={16} className="text-emerald-600" /> Pass / Fail Breakdown
              </h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      innerRadius={40}
                      paddingAngle={3}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} candidates`, '']} />
                    <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No data</div>
              )}
            </div>
          </div>
        )}

        {/* Results Table */}
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="text-blue-500" /></div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No completed exams yet"
            description="Results will appear here once candidates complete exams."
          />
        ) : (
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold text-slate-700">{rows.length} Results</h3>
            </div>
            <div className="table-container border-0 rounded-none">
              <table className="table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Exam</th>
                    <th>Lang</th>
                    <th>Score</th>
                    <th>Correct</th>
                    <th>Wrong</th>
                    <th>Skipped</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const scoreColor = row.score >= 80 ? 'text-emerald-600' : row.score >= 60 ? 'text-yellow-600' : 'text-red-600';
                    const scoreBg = row.score >= 80 ? 'bg-emerald-100' : row.score >= 60 ? 'bg-yellow-100' : 'bg-red-100';
                    return (
                      <tr key={i}>
                        <td>
                          <div>
                            <p className="font-medium text-slate-800 text-sm">{row.candidateName}</p>
                            <p className="text-xs text-slate-400">{row.candidateEmail}</p>
                          </div>
                        </td>
                        <td className="text-slate-600 text-sm max-w-48">
                          <p className="truncate">{row.examTitle}</p>
                        </td>
                        <td>
                          <span className="text-sm">{LANGUAGE_FLAGS[row.language as Language] || ''} {row.language}</span>
                        </td>
                        <td>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg font-bold text-sm ${scoreBg} ${scoreColor}`}>
                            {row.score}%
                          </span>
                        </td>
                        <td>
                          <span className="flex items-center gap-1 text-emerald-600 font-medium text-sm">
                            <CheckCircle2 size={13} />{row.correctCount}
                          </span>
                        </td>
                        <td>
                          <span className="flex items-center gap-1 text-red-500 font-medium text-sm">
                            <XCircle size={13} />{row.wrongCount}
                          </span>
                        </td>
                        <td>
                          <span className="flex items-center gap-1 text-slate-400 text-sm">
                            <HelpCircle size={13} />{row.skippedCount}
                          </span>
                        </td>
                        <td className="text-xs text-slate-400">{row.completedAt}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      </PageTransition>
    </div>
  );
}

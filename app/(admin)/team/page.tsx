'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/admin/Header';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { UsersRound, TrendingUp, Award, ClipboardList, RefreshCw } from 'lucide-react';
import PageTransition from '@/components/ui/PageTransition';

interface MemberSession {
  examTitle: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  completedAt: string;
}

interface Member {
  id: string;
  name: string;
  nickname: string | null;
  realName: string | null;
  email: string;
  avgScore: number;
  sessions: MemberSession[];
}

interface TeamData {
  team: { id: string; name: string; color: string };
  members: Member[];
  teamAvgScore: number;
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score);
  const color = pct >= 80 ? 'text-emerald-700 bg-emerald-100' : pct >= 60 ? 'text-amber-700 bg-amber-100' : 'text-red-700 bg-red-100';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{pct}%</span>;
}

function PerformanceBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.round(score));
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function TeamDashboardPage() {
  const { error } = useToast();
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/team');
    if (res.ok) {
      setData(await res.json());
    } else {
      const d = await res.json();
      error(d.error || 'Failed to load team data');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div>
        <Header title="My Team" subtitle="Team performance overview" />
        <div className="flex justify-center py-20"><Spinner className="text-blue-500" /></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <Header title="My Team" subtitle="Team performance overview" />
        <EmptyState icon={UsersRound} title="No team data" description="Your team has no members or exam data yet." />
      </div>
    );
  }

  const { team, members, teamAvgScore } = data;
  const activeMembers = members.length;
  const totalAttempts = members.reduce((sum, m) => sum + m.sessions.length, 0);

  return (
    <div>
      <Header title="My Team" subtitle={`${team.name} — Performance Overview`} />
      <PageTransition>
        <div className="p-6 space-y-6">

          {/* Header row */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
              <h2 className="text-lg font-bold text-slate-800">{team.name}</h2>
            </div>
            <button onClick={fetchData} className="btn-secondary btn-sm">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-slate-800">{activeMembers}</p>
              <p className="text-xs text-slate-400">Team Members</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-slate-800">{totalAttempts}</p>
              <p className="text-xs text-slate-400">Total Attempts</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: team.color }}>{Math.round(teamAvgScore)}%</p>
              <p className="text-xs text-slate-400">Team Average</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-slate-800">
                {members.filter(m => m.avgScore >= 70).length}
              </p>
              <p className="text-xs text-slate-400">Passing Members</p>
              <p className="text-[10px] text-slate-300">(≥70%)</p>
            </div>
          </div>

          {/* Members */}
          <div>
            <h3 className="section-title mb-4">Member Performance</h3>
            {members.length === 0 ? (
              <EmptyState icon={UsersRound} title="No members yet" description="No active candidates are assigned to your team." />
            ) : (
              <div className="space-y-3">
                {members
                  .sort((a, b) => b.avgScore - a.avgScore)
                  .map((member, rank) => (
                    <div key={member.id} className="card overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                        className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
                      >
                        {/* Rank */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          rank === 0 ? 'bg-amber-100 text-amber-700' :
                          rank === 1 ? 'bg-slate-200 text-slate-600' :
                          rank === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : rank + 1}
                        </div>

                        {/* Name & info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-800 text-sm">
                              {member.realName || member.name}
                            </p>
                            {member.nickname && (
                              <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {member.nickname}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">{member.email}</p>
                          <PerformanceBar score={member.avgScore} />
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-center hidden sm:block">
                            <p className="text-xs font-semibold text-slate-700">{member.sessions.length}</p>
                            <p className="text-[10px] text-slate-400">exams</p>
                          </div>
                          <ScoreBadge score={member.avgScore} />
                        </div>
                      </button>

                      {/* Expanded sessions */}
                      {expandedMember === member.id && member.sessions.length > 0 && (
                        <div className="border-t border-slate-100 px-4 pb-3">
                          <p className="text-xs font-semibold text-slate-500 py-2 uppercase tracking-wide">Exam History</p>
                          <div className="space-y-2">
                            {member.sessions.map((s, i) => (
                              <div key={i} className="flex items-center gap-3 text-sm">
                                <ClipboardList size={13} className="text-slate-400 flex-shrink-0" />
                                <p className="flex-1 text-slate-700 truncate">{s.examTitle}</p>
                                <span className="text-xs text-slate-400">
                                  {s.correctCount}/{s.totalQuestions} correct
                                </span>
                                <ScoreBadge score={s.score} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {expandedMember === member.id && member.sessions.length === 0 && (
                        <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-400 italic">
                          No exams completed yet.
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Top exams summary */}
          {totalAttempts > 0 && (
            <div>
              <h3 className="section-title mb-4 flex items-center gap-2"><TrendingUp size={16} /> Exam Breakdown</h3>
              <div className="card overflow-hidden">
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Exam</th>
                        <th>Attempts</th>
                        <th>Avg Score</th>
                        <th>Top Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const examMap: Record<string, { title: string; scores: number[] }> = {};
                        members.forEach(m => m.sessions.forEach(s => {
                          if (!examMap[s.examTitle]) examMap[s.examTitle] = { title: s.examTitle, scores: [] };
                          examMap[s.examTitle].scores.push(s.score);
                        }));
                        return Object.values(examMap).map((e) => {
                          const avg = e.scores.reduce((a, b) => a + b, 0) / e.scores.length;
                          const top = Math.max(...e.scores);
                          return (
                            <tr key={e.title}>
                              <td className="font-medium">{e.title}</td>
                              <td>{e.scores.length}</td>
                              <td><ScoreBadge score={avg} /></td>
                              <td><ScoreBadge score={top} /></td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* No exams yet placeholder */}
          {totalAttempts === 0 && members.length > 0 && (
            <div className="card p-8 text-center">
              <Award size={36} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No exam results yet</p>
              <p className="text-slate-400 text-sm mt-1">Team members have not completed any exams.</p>
            </div>
          )}

        </div>
      </PageTransition>
    </div>
  );
}

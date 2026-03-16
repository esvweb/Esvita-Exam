import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import Header from '@/components/admin/Header';
import PageTransition from '@/components/ui/PageTransition';
import Link from 'next/link';
import {
  ClipboardList, Users, UserSquare2, CheckCircle2,
  TrendingUp, Plus, ArrowRight, Award
} from 'lucide-react';

async function getDashboardData() {
  const [totalExams, totalAudiences, totalAdmins, recentSessions, topExams] = await Promise.all([
    prisma.exam.count({ where: { isActive: true } }),
    prisma.audience.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.examSession.findMany({
      where: { status: 'completed' },
      include: {
        exam: { select: { titleEn: true, titleTr: true } },
        audience: { select: { name: true, email: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: 8,
    }),
    prisma.exam.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { sessions: true, questions: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
  ]);

  const completedSessions = await prisma.examSession.count({ where: { status: 'completed' } });
  const avgScore = await prisma.examSession.aggregate({
    where: { status: 'completed', score: { not: null } },
    _avg: { score: true },
  });

  return { totalExams, totalAudiences, totalAdmins, recentSessions, topExams, completedSessions, avgScore: avgScore._avg.score };
}

export default async function DashboardPage() {
  const session = await getServerSession();
  const data = await getDashboardData();

  const stats = [
    { label: 'Active Exams', value: data.totalExams, icon: ClipboardList, color: 'blue', bg: 'bg-blue-50', iconColor: 'text-blue-600' },
    { label: 'Candidates', value: data.totalAudiences, icon: UserSquare2, color: 'emerald', bg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
    { label: 'Completed Exams', value: data.completedSessions, icon: CheckCircle2, color: 'violet', bg: 'bg-violet-50', iconColor: 'text-violet-600' },
    { label: 'Avg. Score', value: data.avgScore ? `${Math.round(data.avgScore)}%` : 'N/A', icon: Award, color: 'amber', bg: 'bg-amber-50', iconColor: 'text-amber-600' },
  ];

  return (
    <div>
      <Header
        title="Dashboard"
        subtitle={`Welcome back, ${session?.name?.split(' ')[0] || 'Admin'}`}
        userName={session?.name}
        userEmail={session?.email}
      />
      <PageTransition>
      <div className="p-6 space-y-6">

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="card p-5 flex items-center gap-4">
              <div className={`${stat.bg} p-3 rounded-xl flex-shrink-0`}>
                <stat.icon size={22} className={stat.iconColor} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                <p className="text-xs text-slate-400 font-medium">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Exam Cards */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Active Exams</h2>
              <Link href="/exams/create" className="btn-primary btn-sm">
                <Plus size={14} /> New Exam
              </Link>
            </div>
            {data.topExams.length === 0 ? (
              <div className="card p-10 text-center">
                <ClipboardList size={32} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500 text-sm">No exams yet.</p>
                <Link href="/exams/create" className="btn-primary btn-sm mt-4 inline-flex">
                  Create your first exam
                </Link>
              </div>
            ) : (
              <div className="grid gap-3">
                {data.topExams.map((exam) => {
                  const completedCount = 0; // We'll count from sessions in real query
                  return (
                    <Link
                      key={exam.id}
                      href={`/exams/${exam.id}`}
                      className="card p-4 flex items-center gap-4 hover:border-blue-200 hover:shadow-md transition-all group"
                    >
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <ClipboardList size={18} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">
                          {exam.titleEn || exam.titleTr || 'Untitled Exam'}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-slate-400">{exam._count.questions} questions</span>
                          <span className="text-xs text-slate-300">•</span>
                          <span className="text-xs text-slate-400">{exam._count.sessions} attempts</span>
                          <span className="text-xs text-slate-300">•</span>
                          <span className="text-xs text-slate-400">{exam.timePerQuestion}s/question</span>
                        </div>
                      </div>
                      <ArrowRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}
            <Link href="/exams" className="text-sm text-blue-600 hover:underline mt-3 inline-flex items-center gap-1">
              View all exams <ArrowRight size={13} />
            </Link>
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="section-title mb-4">Recent Completions</h2>
            <div className="card divide-y divide-slate-100">
              {data.recentSessions.length === 0 ? (
                <div className="p-6 text-center">
                  <TrendingUp size={28} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs text-slate-400">No completed exams yet</p>
                </div>
              ) : (
                data.recentSessions.map((s) => {
                  const scoreColor = (s.score ?? 0) >= 80 ? 'text-emerald-600' : (s.score ?? 0) >= 60 ? 'text-yellow-600' : 'text-red-600';
                  const scoreBg = (s.score ?? 0) >= 80 ? 'bg-emerald-100' : (s.score ?? 0) >= 60 ? 'bg-yellow-100' : 'bg-red-100';
                  return (
                    <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Users size={13} className="text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">
                          {s.audience?.name || s.externalName || s.externalEmail || 'External'}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {s.exam?.titleEn || s.exam?.titleTr || 'Exam'}
                        </p>
                      </div>
                      <div className={`${scoreBg} ${scoreColor} text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0`}>
                        {s.score ?? 0}%
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <Link href="/reports" className="text-sm text-blue-600 hover:underline mt-3 inline-flex items-center gap-1">
              View reports <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
      </PageTransition>
    </div>
  );
}

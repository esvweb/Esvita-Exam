export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canViewLongitudinal, isTeamLeader, forbidden } from '@/lib/permissions';

// GET /api/admin/reports/longitudinal?audienceId=...&teamId=...
// Returns exam history for a specific candidate or team.
// Team leaders can only view their own team.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canViewLongitudinal(session)) return forbidden();

  const { searchParams } = new URL(req.url);
  const audienceId = searchParams.get('audienceId');
  const teamId = searchParams.get('teamId');

  // Team leader scope enforcement
  const effectiveTeamId = isTeamLeader(session) ? session.teamId : teamId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    isPreview: false,
    status: 'completed',
    score: { not: null },
  };

  if (audienceId) {
    where.audienceId = audienceId;
  } else if (effectiveTeamId) {
    where.audience = { teamId: effectiveTeamId, isArchived: false };
  }

  const sessions = await prisma.examSession.findMany({
    where,
    include: {
      exam: { select: { id: true, titleEn: true, titleTr: true, passMarkPercent: true } },
      audience: { select: { id: true, nickname: true, teamId: true } },
    },
    orderBy: { completedAt: 'asc' },
  });

  // Group by audience
  const byCandidate: Record<string, {
    audienceId: string;
    nickname: string;
    teamId: string | null;
    exams: Array<{
      examId: string;
      examTitle: string;
      score: number;
      passMarkPercent: number;
      passed: boolean;
      completedAt: Date | null;
    }>;
  }> = {};

  for (const s of sessions) {
    if (!s.audienceId || !s.audience) continue;
    if (!byCandidate[s.audienceId]) {
      byCandidate[s.audienceId] = {
        audienceId: s.audienceId,
        nickname: s.audience.nickname || 'Unknown',
        teamId: s.audience.teamId,
        exams: [],
      };
    }
    const pm = s.exam.passMarkPercent;
    byCandidate[s.audienceId].exams.push({
      examId: s.examId,
      examTitle: s.exam.titleEn || s.exam.titleTr || 'Exam',
      score: s.score ?? 0,
      passMarkPercent: pm,
      passed: (s.score ?? 0) >= pm,
      completedAt: s.completedAt,
    });
  }

  const candidates = Object.values(byCandidate).map((c) => ({
    ...c,
    avgScore: c.exams.length
      ? Math.round(c.exams.reduce((a, e) => a + e.score, 0) / c.exams.length)
      : 0,
    passRate: c.exams.length
      ? Math.round((c.exams.filter((e) => e.passed).length / c.exams.length) * 100)
      : 0,
  }));

  return apiSuccess({ candidates, total: candidates.length });
}

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canViewTeamComparison, isTeamLeader, forbidden } from '@/lib/permissions';

// GET /api/admin/reports/team-comparison?examId=...
// Returns per-team stats vs company average.
// Team leaders only see their own team; admins/moderators see all.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canViewTeamComparison(session)) return forbidden();

  const { searchParams } = new URL(req.url);
  const examId = searchParams.get('examId');

  // Scope to team leader's own team
  const teamScope = isTeamLeader(session) ? session.teamId : null;

  // Get all completed sessions with audience + team info
  const sessions = await prisma.examSession.findMany({
    where: {
      isPreview: false,
      status: 'completed',
      score: { not: null },
      ...(examId ? { examId } : {}),
      audience: {
        isArchived: false,
        ...(teamScope ? { teamId: teamScope } : {}),
      },
    },
    select: {
      score: true,
      examId: true,
      audience: {
        select: {
          teamId: true,
          team: { select: { id: true, name: true, color: true } },
          nickname: true,
        },
      },
    },
  });

  // Company-wide average (no team filter)
  const allSessions = examId
    ? await prisma.examSession.findMany({
        where: { isPreview: false, status: 'completed', score: { not: null }, examId },
        select: { score: true },
      })
    : sessions;

  const companyScores = allSessions.map((s) => s.score ?? 0);
  const companyAvg = companyScores.length
    ? Math.round(companyScores.reduce((a, b) => a + b, 0) / companyScores.length)
    : 0;

  // Group by team
  const teamMap: Record<string, { id: string; name: string; color: string; scores: number[] }> = {};

  for (const s of sessions) {
    if (!s.audience?.team) continue;
    const t = s.audience.team;
    if (!teamMap[t.id]) teamMap[t.id] = { id: t.id, name: t.name, color: t.color, scores: [] };
    teamMap[t.id].scores.push(s.score ?? 0);
  }

  const teams = Object.values(teamMap).map((t) => {
    const avg = Math.round(t.scores.reduce((a, b) => a + b, 0) / t.scores.length);
    return {
      teamId: t.id,
      teamName: t.name,
      teamColor: t.color,
      avgScore: avg,
      sessionCount: t.scores.length,
      vsCompanyAvg: avg - companyAvg,
      scores: t.scores,
    };
  });

  return apiSuccess({ companyAvg, companyCount: companyScores.length, teams });
}

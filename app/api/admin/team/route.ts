export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';

/**
 * GET /api/admin/team
 * Team leader dashboard data.
 * Returns the team assigned to the logged-in team_leader with all members
 * and their completed exam sessions.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);

  // Only team_leader, admin, super_admin can call this
  const allowedRoles = ['team_leader', 'super_admin', 'admin'];
  if (!allowedRoles.includes(session.role)) {
    return apiError('Access denied', 403);
  }

  // team_leader must have a teamId
  if (session.role === 'team_leader' && !session.teamId) {
    return apiError('No team assigned to your account. Contact your administrator.', 403);
  }

  // For admin/super_admin optionally pass ?teamId= to view a specific team
  const { searchParams } = new URL(req.url);
  const targetTeamId = session.role === 'team_leader'
    ? session.teamId!
    : (searchParams.get('teamId') || '');

  if (!targetTeamId) return apiError('teamId is required', 400);

  const team = await prisma.team.findUnique({
    where: { id: targetTeamId },
    include: {
      members: {
        where: { isActive: true, isArchived: false },
        include: {
          examSessions: {
            where: { status: 'completed' },
            include: {
              exam: {
                select: {
                  titleEn: true, titleTr: true, titleFra: true,
                  validityHours: true, validityStartedAt: true, resultsEmailSentAt: true,
                },
              },
            },
            orderBy: { completedAt: 'desc' },
          },
        },
        orderBy: { name: 'asc' },
      },
    },
  });

  if (!team) return apiError('Team not found', 404);

  // Compute per-member stats and overall team average
  const members = team.members.map((m) => {
    const sessions = m.examSessions;
    const scores = sessions.map((s) => s.score ?? 0);
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;

    // Check if results are available (validity expired or email sent)
    const sessionsWithVisibility = sessions.map((s) => {
      const validityEnd = s.exam.validityStartedAt
        ? new Date(s.exam.validityStartedAt.getTime() + s.exam.validityHours * 3_600_000)
        : null;
      const resultsAvailable = !!s.exam.resultsEmailSentAt || (validityEnd ? new Date() >= validityEnd : false);
      return { ...s, resultsAvailable };
    });

    return {
      id: m.id,
      name: m.name,
      nickname: m.nickname,
      realName: m.realName,
      email: m.email,
      preferredLanguage: m.preferredLanguage,
      avgScore,
      totalExams: sessions.length,
      sessions: sessionsWithVisibility,
    };
  });

  const allScores = members.flatMap((m) => m.sessions.map((s) => s.score ?? 0));
  const teamAvgScore = allScores.length > 0
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : null;

  return apiSuccess({
    team: { id: team.id, name: team.name, color: team.color },
    members,
    teamAvgScore,
    totalMembers: members.length,
    totalExamsTaken: allScores.length,
  });
}

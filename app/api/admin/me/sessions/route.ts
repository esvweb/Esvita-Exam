export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/utils';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * GET /api/admin/me/sessions
 * Returns the current admin user's own exam sessions (matched by email to Audience table).
 * Used by Advisor role to show their own scores on exam cards.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);

  // Find the audience record matching the user's email
  const audience = await prisma.audience.findUnique({
    where: { email: session.email },
    include: {
      examSessions: {
        where: { status: 'completed' },
        select: {
          examId: true,
          score: true,
          completedAt: true,
        },
        orderBy: { completedAt: 'desc' },
      },
    },
  });

  if (!audience) return apiSuccess([]);

  const sessions = audience.examSessions.map(s => ({
    examId: s.examId,
    score: s.score ?? 0,
    completedAt: s.completedAt,
  }));

  return apiSuccess(sessions);
}

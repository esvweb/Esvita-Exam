export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCandidateSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';

/**
 * GET /api/candidate/my-results
 * Returns all completed exam sessions for the authenticated candidate.
 * Each session includes a `pending` flag indicating whether results are
 * visible yet (validity period has not yet expired).
 */
export async function GET(req: NextRequest) {
  const candidate = await getCandidateSessionFromRequest(req);
  if (!candidate) return apiError('Unauthorized — please log in to view your results', 401);

  const sessions = await prisma.examSession.findMany({
    where: {
      audienceId: candidate.audienceId,
      status: 'completed',
    },
    include: {
      exam: {
        select: {
          titleEn: true, titleTr: true, titleFra: true, titleRu: true, titleIta: true,
          validityHours: true, validityStartedAt: true, resultsEmailSentAt: true,
        },
      },
      answers: {
        include: { question: true },
      },
    },
    orderBy: { completedAt: 'desc' },
  });

  const now = new Date();

  const result = sessions.map((s) => {
    const validityEnd = s.exam.validityStartedAt
      ? new Date(s.exam.validityStartedAt.getTime() + s.exam.validityHours * 3_600_000)
      : null;

    const resultsReleased = !!s.exam.resultsEmailSentAt || (validityEnd ? now >= validityEnd : false);

    const examTitle = s.selectedLanguage
      ? (() => {
          const suffix = s.selectedLanguage.charAt(0).toUpperCase() + s.selectedLanguage.slice(1).toLowerCase();
          return (s.exam as Record<string, unknown>)[`title${suffix}`] as string | null;
        })() || s.exam.titleEn
      : s.exam.titleEn;

    return {
      sessionId: s.id,
      examTitle,
      language: s.selectedLanguage,
      completedAt: s.completedAt,
      resultsAvailableAt: validityEnd?.toISOString() ?? null,
      pending: !resultsReleased,
      // Only include score data when results are released
      ...(resultsReleased ? {
        score: s.score,
        totalQuestions: s.totalQuestions,
        correctCount: s.correctCount,
        wrongCount: s.wrongCount,
        skippedCount: s.skippedCount,
        timeTaken: s.timeTaken,
      } : {}),
    };
  });

  return apiSuccess({
    candidate: { name: candidate.name, email: candidate.email },
    sessions: result,
  });
}

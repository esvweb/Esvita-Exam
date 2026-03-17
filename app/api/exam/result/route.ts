export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiSuccess, addHours } from '@/lib/utils';

/**
 * GET /api/exam/result?sessionId=xxx
 * Returns result data for the candidate result page.
 * Hides score data while validity period is still running.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) return apiError('Session ID is required');

  const session = await prisma.examSession.findUnique({
    where: { id: sessionId },
    include: {
      exam: true,
      audience: true,
    },
  });

  if (!session) return apiError('Session not found', 404);
  if (session.status !== 'completed') return apiError('Exam not completed yet', 400);

  const now = new Date();
  const validityStart = session.exam.validityStartedAt;
  const validityHours = session.exam.validityHours ?? 72;
  const resultsAvailableAt = validityStart ? addHours(validityStart, validityHours) : null;

  // Pending = validity not yet expired AND results email not yet sent
  const isPending = !session.exam.resultsEmailSentAt &&
    (resultsAvailableAt ? now < resultsAvailableAt : true);

  const lang = session.selectedLanguage || 'EN';
  const langSuffix = lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase();
  const examTitle =
    (session.exam as Record<string, unknown>)[`title${langSuffix}`] as string ||
    session.exam.titleEn ||
    'Exam';

  const candidateName =
    session.audience?.name || session.externalName || 'Candidate';

  return apiSuccess({
    sessionId,
    candidateName,
    examTitle,
    totalQuestions: session.totalQuestions,
    isPending,
    resultsAvailableAt: resultsAvailableAt?.toISOString() ?? null,
    // Score data hidden while pending
    score: isPending ? null : session.score,
    correctCount: isPending ? null : session.correctCount,
    wrongCount: isPending ? null : session.wrongCount,
    skippedCount: isPending ? null : session.skippedCount,
  });
}

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';

// POST /api/admin/sessions/recalculate-scores
// Recalculates final scores for all sessions that have reviewed SA answers.
// Super Admin only.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (session.role !== 'super_admin') return apiError('Forbidden', 403);

  // Load all non-preview sessions that have at least one SA answer
  const examSessions = await prisma.examSession.findMany({
    where: {
      isPreview: false,
      status: { in: ['pending_review', 'completed'] },
    },
    include: {
      exam: {
        include: { questions: { select: { id: true, type: true, maxScore: true } } },
      },
      answers: {
        include: { question: { select: { id: true, type: true, maxScore: true } } },
      },
    },
  });

  let updated = 0;
  let skipped = 0;

  for (const s of examSessions) {
    const mcQuestions = s.exam.questions.filter((q) => q.type === 'multiple_choice');
    const saQuestions = s.exam.questions.filter((q) => q.type === 'short_answer');

    // Pure MC sessions with no SA — skip (scores are set at submission time)
    if (saQuestions.length === 0) { skipped++; continue; }

    const mcCorrect = s.answers.filter(
      (a) => a.question.type === 'multiple_choice' && a.isCorrect
    ).length;
    const mcScore = mcQuestions.length > 0 ? (mcCorrect / mcQuestions.length) * 100 : 0;

    const saAnswers = s.answers.filter((a) => a.question.type === 'short_answer');
    const saAllReviewed = saAnswers.length > 0 && saAnswers.every((a) => a.reviewedAt !== null);

    let finalScore = Math.round(mcScore);

    if (saAllReviewed) {
      const totalMaxSA = saQuestions.reduce((sum, q) => sum + q.maxScore, 0);
      const totalEarnedSA = saAnswers.reduce((sum, a) => sum + (a.manualScore ?? 0), 0);
      const saScore = totalMaxSA > 0 ? (totalEarnedSA / totalMaxSA) * 100 : 0;
      const totalQuestions = mcQuestions.length + saQuestions.length;
      finalScore = Math.round(
        (mcScore * mcQuestions.length + saScore * saQuestions.length) / totalQuestions
      );
    }

    const newStatus = saAllReviewed ? 'completed' : 'pending_review';

    await prisma.examSession.update({
      where: { id: s.id },
      data: { score: finalScore, status: newStatus },
    });

    updated++;
  }

  return apiSuccess({ updated, skipped });
}

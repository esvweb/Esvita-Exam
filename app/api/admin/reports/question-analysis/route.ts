export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canViewPerQuestionAnalysis, forbidden } from '@/lib/permissions';

// GET /api/admin/reports/question-analysis?examId=...
// Returns per-question accuracy stats for a given exam.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canViewPerQuestionAnalysis(session)) return forbidden();

  const { searchParams } = new URL(req.url);
  const examId = searchParams.get('examId');
  if (!examId) return apiError('examId is required');

  const questions = await prisma.question.findMany({
    where: { examId },
    include: {
      answers: {
        where: { session: { isPreview: false, status: 'completed' } },
        select: { isCorrect: true, selectedAnswer: true, manualScore: true },
      },
    },
    orderBy: { orderIndex: 'asc' },
  });

  const analysis = questions.map((q, i) => {
    const answers = q.answers;
    const total = answers.length;

    if (q.type === 'multiple_choice') {
      const correct = answers.filter((a) => a.isCorrect === true).length;
      const wrong = answers.filter((a) => a.isCorrect === false && a.selectedAnswer !== null).length;
      const skipped = answers.filter((a) => a.selectedAnswer === null).length;
      return {
        index: i + 1,
        questionId: q.id,
        type: q.type,
        questionText: q.questionEn || q.questionTr || '',
        total,
        correct,
        wrong,
        skipped,
        correctRate: total ? Math.round((correct / total) * 100) : 0,
        wrongRate: total ? Math.round((wrong / total) * 100) : 0,
        skipRate: total ? Math.round((skipped / total) * 100) : 0,
      };
    } else {
      // Short answer
      const reviewed = answers.filter((a) => a.manualScore !== null);
      const avgScore = reviewed.length
        ? reviewed.reduce((sum, a) => sum + (a.manualScore ?? 0), 0) / reviewed.length
        : null;
      return {
        index: i + 1,
        questionId: q.id,
        type: q.type,
        questionText: q.questionEn || q.questionTr || '',
        maxScore: q.maxScore,
        total,
        reviewed: reviewed.length,
        avgScore: avgScore !== null ? Math.round(avgScore * 10) / 10 : null,
      };
    }
  });

  return apiSuccess({ examId, analysis });
}

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/utils';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * GET /api/admin/sessions/[id]
 * Returns per-question breakdown for a single exam session.
 * Any authenticated admin panel user can access this.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);

  const examSession = await prisma.examSession.findUnique({
    where: { id: params.id },
    include: {
      exam: { include: { questions: true } },
      answers: {
        include: {
          question: {
            select: {
              id: true,
              questionEn: true, questionTr: true, questionFra: true,
              questionRu: true, questionIta: true,
              correctAnswer: true,
            },
          },
        },
      },
    },
  });

  if (!examSession) return apiError('Session not found', 404);

  const lang = examSession.selectedLanguage || 'EN';
  const langSuffix = lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase();

  const questionMap = new Map(examSession.exam.questions.map(q => [q.id, q]));
  const questionOrder: string[] = JSON.parse(examSession.questionOrder || '[]');
  const answerMap = new Map(examSession.answers.map(a => [a.questionId, a]));

  const questions = questionOrder.map((qId, idx) => {
    const q = questionMap.get(qId);
    if (!q) return null;
    const answer = answerMap.get(qId);
    const qText =
      (q as Record<string, unknown>)[`question${langSuffix}`] as string ||
      q.questionEn ||
      `Question ${idx + 1}`;

    return {
      index: idx + 1,
      questionId: qId,
      questionText: qText,
      selectedAnswer: answer?.selectedAnswer ?? null,
      correctAnswer: q.correctAnswer,
      isCorrect: answer?.isCorrect ?? false,
      status: !answer ? 'skipped' : answer.isCorrect ? 'correct' : 'wrong',
    };
  }).filter(Boolean);

  return apiSuccess({ questions });
}

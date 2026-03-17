export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/utils';
import { getSessionFromRequest } from '@/lib/auth';
import { isManager } from '@/lib/permissions';

/**
 * GET /api/admin/exams/[id]/sessions
 * Returns all completed sessions for an exam with per-question answer breakdown.
 * Admin / moderator / super_admin only.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!isManager(session)) return apiError('Forbidden', 403);

  const { id: examId } = params;

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { questions: true },
  });
  if (!exam) return apiError('Exam not found', 404);

  const sessions = await prisma.examSession.findMany({
    where: { examId, status: 'completed' },
    include: {
      audience: { select: { id: true, name: true, email: true, nickname: true, realName: true } },
      answers: {
        include: {
          question: {
            select: {
              id: true,
              questionEn: true, questionTr: true, questionFra: true, questionRu: true, questionIta: true,
              correctAnswer: true,
              explanationEn: true,
            },
          },
        },
      },
    },
    orderBy: { completedAt: 'desc' },
  });

  const questionMap = new Map(exam.questions.map(q => [q.id, q]));

  const data = sessions.map(s => {
    const lang = s.selectedLanguage || 'EN';
    const langSuffix = lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase();

    const candidateName = s.audience?.realName || s.audience?.name || s.externalName || 'Unknown';
    const candidateEmail = s.audience?.email || s.externalEmail || '';
    const nickname = s.audience?.nickname || null;

    // Build per-question answer list
    const questionOrder: string[] = JSON.parse(s.questionOrder || '[]');
    const answerMap = new Map(s.answers.map(a => [a.questionId, a]));

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
        selectedAnswer: answer?.selectedAnswer ?? null,  // null = skipped
        correctAnswer: q.correctAnswer,
        isCorrect: answer?.isCorrect ?? false,
        status: !answer ? 'skipped' : answer.isCorrect ? 'correct' : 'wrong',
      };
    }).filter(Boolean);

    return {
      id: s.id,
      candidateName,
      candidateEmail,
      nickname,
      selectedLanguage: s.selectedLanguage,
      score: s.score,
      correctCount: s.correctCount,
      wrongCount: s.wrongCount,
      skippedCount: s.skippedCount,
      totalQuestions: s.totalQuestions,
      timeTaken: s.timeTaken,
      completedAt: s.completedAt,
      questions,
    };
  });

  return apiSuccess(data);
}

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canReview } from '@/lib/permissions';

// GET: Full session detail for review (includes short-answer questions + answers)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canReview(session)) return apiError('Insufficient permissions', 403);

  const examSession = await prisma.examSession.findUnique({
    where: { id: params.id },
    include: {
      exam: {
        select: {
          id: true,
          titleEn: true, titleTr: true, titleFra: true, titleRu: true, titleIta: true,
        },
      },
      audience: { select: { id: true, name: true, email: true, nickname: true, realName: true } },
      answers: {
        include: {
          question: true,
        },
        orderBy: { answeredAt: 'asc' },
      },
    },
  });

  if (!examSession) return apiError('Session not found', 404);

  const lang = examSession.selectedLanguage;
  const langSuffix = lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase();

  const shortAnswers = examSession.answers
    .filter((a) => a.question.type === 'short_answer')
    .map((a) => {
      const q = a.question;
      const questionText =
        (q as Record<string, unknown>)[`question${langSuffix}`] as string ||
        q.questionEn || '';

      return {
        answerId: a.id,
        questionId: q.id,
        questionText,
        answerText: a.selectedAnswer || '',
        maxScore: q.maxScore,
        manualScore: a.manualScore,
        manualFeedback: a.manualFeedback,
        reviewedAt: a.reviewedAt,
        reviewedBy: a.reviewedBy,
      };
    });

  return apiSuccess({
    sessionId: examSession.id,
    examTitle: (examSession.exam as Record<string, unknown>)[`title${langSuffix}`] as string
      || examSession.exam.titleEn || 'Exam',
    candidateName: examSession.audience?.name || examSession.externalName || 'Unknown',
    candidateEmail: examSession.audience?.email || examSession.externalEmail || '',
    nickname: examSession.audience?.nickname || null,
    realName: examSession.audience?.realName || null,
    selectedLanguage: examSession.selectedLanguage,
    completedAt: examSession.completedAt,
    status: examSession.status,
    score: examSession.score,
    totalQuestions: examSession.totalQuestions,
    shortAnswers,
  });
}

// POST: Submit scores for short-answer questions in a session
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canReview(session)) return apiError('Insufficient permissions', 403);

  const { scores } = await req.json() as {
    scores: Array<{ answerId: string; manualScore: number; manualFeedback?: string }>;
  };

  if (!Array.isArray(scores) || scores.length === 0) {
    return apiError('scores array is required');
  }

  const examSession = await prisma.examSession.findUnique({
    where: { id: params.id },
    include: {
      exam: { include: { questions: true } },
      answers: { include: { question: { select: { id: true, type: true, maxScore: true } } } },
    },
  });

  if (!examSession) return apiError('Session not found', 404);

  const now = new Date();

  // Update each scored answer
  await prisma.$transaction(
    scores.map(({ answerId, manualScore, manualFeedback }) =>
      prisma.examAnswer.update({
        where: { id: answerId },
        data: {
          manualScore: Math.max(0, Math.min(100, manualScore)),
          manualFeedback: manualFeedback || null,
          reviewedAt: now,
          reviewedBy: session.userId,
        },
      })
    )
  );

  // Re-fetch answers to recalculate final score
  const updatedAnswers = await prisma.examAnswer.findMany({
    where: { sessionId: params.id },
    include: { question: { select: { type: true, maxScore: true } } },
  });

  const mcQuestions = examSession.exam.questions.filter((q) => q.type !== 'short_answer');
  const saQuestions = examSession.exam.questions.filter((q) => q.type === 'short_answer');

  const mcCorrect = updatedAnswers.filter((a) => a.question.type !== 'short_answer' && a.isCorrect).length;
  const mcScore = mcQuestions.length > 0 ? (mcCorrect / mcQuestions.length) * 100 : 0;

  // SA score: weighted average of (manualScore / maxScore) * 100 across all SA questions
  const saAnswers = updatedAnswers.filter((a) => a.question.type === 'short_answer');
  const saAllReviewed = saAnswers.length === saQuestions.length &&
    saAnswers.every((a) => a.reviewedAt !== null);

  let finalScore = Math.round(mcScore);

  if (saAllReviewed && saQuestions.length > 0) {
    const totalMaxSA = saQuestions.reduce((sum, q) => sum + q.maxScore, 0);
    const totalEarnedSA = saAnswers.reduce((sum, a) => sum + (a.manualScore ?? 0), 0);
    const saScore = totalMaxSA > 0 ? (totalEarnedSA / totalMaxSA) * 100 : 0;

    const totalWeight = mcQuestions.length + saQuestions.length;
    finalScore = Math.round(
      (mcScore * mcQuestions.length + saScore * saQuestions.length) / totalWeight
    );
  }

  const newStatus = saAllReviewed ? 'reviewed' : 'pending_review';

  await prisma.examSession.update({
    where: { id: params.id },
    data: {
      score: finalScore,
      status: newStatus,
    },
  });

  return apiSuccess({ finalScore, status: newStatus, allReviewed: saAllReviewed });
}

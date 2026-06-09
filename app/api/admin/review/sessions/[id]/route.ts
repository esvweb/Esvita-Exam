export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canScoreAnswers, canOverrideScore, forbidden } from '@/lib/permissions';
import { getLocalized } from '@/lib/utils';

async function assertSupervisorAccess(userId: string, role: string, examId: string) {
  if (role === 'super_admin') return true;
  const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { supervisorId: true } });
  return exam?.supervisorId === userId;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canScoreAnswers(session)) return forbidden();

  const examSession = await prisma.examSession.findUnique({
    where: { id: params.id },
    include: {
      exam: {
        select: {
          id: true, supervisorId: true, passMarkPercent: true,
          titleEn: true, titleFra: true, titleRu: true, titleTr: true, titleIta: true,
        },
      },
      audience: { select: { id: true, nickname: true } },
      answers: { include: { question: true }, orderBy: { answeredAt: 'asc' } },
    },
  });

  if (!examSession) return apiError('Session not found', 404);

  const allowed = await assertSupervisorAccess(session.userId, session.role, examSession.examId);
  if (!allowed) return forbidden('You are not the assigned supervisor for this exam');

  const lang = examSession.selectedLanguage as 'EN' | 'FRA' | 'RU' | 'TR' | 'ITA';

  const shortAnswers = examSession.answers
    .filter((a) => a.question.type === 'short_answer')
    .map((a) => {
      const q = a.question;
      return {
        answerId: a.id,
        questionId: q.id,
        questionText: getLocalized(q, 'question', lang) || '',
        referenceAnswer: getLocalized(q, 'referenceAnswer', lang) || q.referenceAnswerEn || '',
        answerText: a.selectedAnswer || '',
        maxScore: q.maxScore,
        manualScore: a.manualScore,
        manualFeedback: a.manualFeedback,
        reviewedAt: a.reviewedAt,
        reviewedBy: a.reviewedBy,
        aiSuggestedScore: a.aiSuggestedScore,
        aiSuggestionStatus: a.aiSuggestionStatus,
      };
    });

  return apiSuccess({
    sessionId: examSession.id,
    examId: examSession.examId,
    examTitle: getLocalized(examSession.exam, 'title', lang) || examSession.exam.titleEn || 'Exam',
    candidateNickname: examSession.audience?.nickname || examSession.externalName || 'Unknown',
    selectedLanguage: lang,
    completedAt: examSession.completedAt,
    status: examSession.status,
    score: examSession.score,
    totalQuestions: examSession.totalQuestions,
    shortAnswers,
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canScoreAnswers(session)) return forbidden();

  const examSession = await prisma.examSession.findUnique({
    where: { id: params.id },
    include: {
      exam: { include: { questions: true } },
      answers: { include: { question: { select: { id: true, type: true, maxScore: true } } } },
    },
  });
  if (!examSession) return apiError('Session not found', 404);

  const allowed = await assertSupervisorAccess(session.userId, session.role, examSession.examId);
  if (!allowed) return forbidden('You are not the assigned supervisor for this exam');

  const { scores } = await req.json() as {
    scores: Array<{
      answerId: string;
      manualScore: number;
      manualFeedback?: string;
      aiSuggestionStatus?: 'accepted' | 'revised';
    }>;
  };

  if (!Array.isArray(scores) || scores.length === 0) return apiError('scores array is required');

  // Check if any answers were previously scored — only super_admin can override
  for (const { answerId } of scores) {
    const existing = await prisma.examAnswer.findUnique({ where: { id: answerId } });
    if (existing?.reviewedAt && !canOverrideScore(session)) {
      return forbidden('Only Super Admin can override an already-reviewed score');
    }
  }

  const now = new Date();

  await prisma.$transaction(
    scores.map(({ answerId, manualScore, manualFeedback, aiSuggestionStatus }) =>
      prisma.examAnswer.update({
        where: { id: answerId },
        data: {
          // Clamp to 0–10
          manualScore: Math.max(0, Math.min(10, Math.round(manualScore))),
          manualFeedback: manualFeedback || null,
          reviewedAt: now,
          reviewedBy: session.userId,
          aiSuggestionStatus: aiSuggestionStatus || null,
        },
      })
    )
  );

  // Recalculate final score
  const updatedAnswers = await prisma.examAnswer.findMany({
    where: { sessionId: params.id },
    include: { question: { select: { type: true, maxScore: true } } },
  });

  const mcQuestions = examSession.exam.questions.filter((q) => q.type === 'multiple_choice');
  const saQuestions = examSession.exam.questions.filter((q) => q.type === 'short_answer');

  const mcCorrect = updatedAnswers.filter(
    (a) => a.question.type === 'multiple_choice' && a.isCorrect
  ).length;
  const mcScore = mcQuestions.length > 0 ? (mcCorrect / mcQuestions.length) * 100 : 0;

  const saAnswers = updatedAnswers.filter((a) => a.question.type === 'short_answer');
  // All submitted SA answers reviewed; unanswered/skipped SA questions count as 0 — no record to review
  const saAllReviewed =
    saAnswers.length > 0 && saAnswers.every((a) => a.reviewedAt !== null);

  let finalScore = Math.round(mcScore);

  if (saAllReviewed && saQuestions.length > 0) {
    const totalMaxSA = saQuestions.reduce((sum, q) => sum + q.maxScore, 0);
    const totalEarnedSA = saAnswers.reduce((sum, a) => sum + (a.manualScore ?? 0), 0);
    // SA score as a percentage
    const saScore = totalMaxSA > 0 ? (totalEarnedSA / totalMaxSA) * 100 : 0;
    const totalQuestions = mcQuestions.length + saQuestions.length;
    finalScore = Math.round(
      (mcScore * mcQuestions.length + saScore * saQuestions.length) / totalQuestions
    );
  }

  const newStatus = saAllReviewed ? 'completed' : 'pending_review';

  await prisma.examSession.update({
    where: { id: params.id },
    data: { score: finalScore, status: newStatus },
  });

  return apiSuccess({ finalScore, status: newStatus, allReviewed: saAllReviewed });
}

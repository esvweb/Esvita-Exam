export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiSuccess, calculateScore, addHours, getLocalized } from '@/lib/utils';
import { sendCompletionConfirmation } from '@/lib/email';
import { notifySupervisorNewSession } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  const { sessionId, timeTaken } = await req.json();
  if (!sessionId) return apiError('Session ID is required');

  const examSession = await prisma.examSession.findUnique({
    where: { id: sessionId },
    include: {
      exam: { include: { questions: true } },
      answers: true,
      audience: true,
      invitation: true,
    },
  });

  if (!examSession) return apiError('Session not found', 404);

  // Race-condition guard: if already completed, return idempotently
  if (examSession.status !== 'in_progress') {
    return apiSuccess({
      message: 'Session already completed',
      sessionId,
      score: examSession.score,
      pendingReview: examSession.status === 'pending_review',
    });
  }

  // Skip preview sessions — don't write results to DB
  if (examSession.isPreview) {
    await prisma.examSession.update({
      where: { id: sessionId },
      data: { status: 'completed', completedAt: new Date() },
    });
    return apiSuccess({ sessionId, preview: true });
  }

  const totalQuestions = examSession.totalQuestions || examSession.exam.questions.length;
  const mcQuestions = examSession.exam.questions.filter((q) => q.type === 'multiple_choice');
  const saQuestions = examSession.exam.questions.filter((q) => q.type === 'short_answer');
  const hasPendingReview = saQuestions.length > 0;

  const correctCount = examSession.answers.filter((a) => a.isCorrect === true).length;
  const wrongCount = examSession.answers.filter(
    (a) => a.selectedAnswer !== null && a.isCorrect === false
  ).length;
  const skippedCount = totalQuestions - examSession.answers.filter((a) => a.selectedAnswer !== null).length;

  const mcTotal = mcQuestions.length || totalQuestions;
  const score = calculateScore(correctCount, mcTotal);
  const sessionStatus = hasPendingReview ? 'pending_review' : 'completed';
  const now = new Date();

  await prisma.examSession.update({
    where: { id: sessionId },
    data: {
      status: sessionStatus,
      completedAt: now,
      score,
      correctCount,
      wrongCount,
      skippedCount,
      timeTaken: timeTaken || null,
    },
  });

  if (examSession.invitationId) {
    await prisma.examInvitation.update({
      where: { id: examSession.invitationId },
      data: { isUsed: true },
    });
  }

  // Set validityStartedAt on exam if this is the first completion
  if (!examSession.exam.validityStartedAt) {
    await prisma.exam.update({
      where: { id: examSession.examId },
      data: { validityStartedAt: now },
    });
  }

  const lang = examSession.selectedLanguage as 'EN' | 'FRA' | 'RU' | 'TR' | 'ITA';
  const validityStart = examSession.exam.validityStartedAt ?? now;
  const resultsDate = examSession.exam.resultAnnouncementDate
    ?? addHours(validityStart, examSession.exam.validityHours);

  const candidateEmail = examSession.audience?.email || examSession.externalEmail || '';
  const candidateNickname =
    examSession.audience?.nickname || examSession.audience?.name || examSession.externalName || 'Candidate';
  const examTitle = getLocalized(examSession.exam, 'title', lang) || examSession.exam.titleEn || 'Exam';

  if (candidateEmail) {
    try {
      await sendCompletionConfirmation(candidateEmail, candidateNickname, examTitle, resultsDate, {
        audienceId: examSession.audienceId || undefined,
        examId: examSession.examId,
        sessionId,
      });
      await prisma.examSession.update({
        where: { id: sessionId },
        data: { completionEmailSent: true },
      });
    } catch (err) {
      console.error('Completion email failed:', err);
    }
  }

  // Notify assigned supervisor if there are short-answer questions to review
  if (hasPendingReview && examSession.exam.supervisorId) {
    await notifySupervisorNewSession(examSession.exam.supervisorId, examTitle, sessionId);
  }

  return apiSuccess({
    sessionId,
    score,
    totalQuestions,
    correctCount,
    wrongCount,
    skippedCount,
    candidateNickname,
    examTitle,
    resultsDate: resultsDate.toISOString(),
    pendingReview: hasPendingReview,
    shortAnswerCount: saQuestions.length,
  });
}

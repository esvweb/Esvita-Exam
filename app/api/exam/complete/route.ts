export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiSuccess, calculateScore, addHours } from '@/lib/utils';
import { sendCompletionConfirmation } from '@/lib/email';

export async function POST(req: NextRequest) {
  const { sessionId, timeTaken } = await req.json();
  if (!sessionId) return apiError('Session ID is required');

  const session = await prisma.examSession.findUnique({
    where: { id: sessionId },
    include: {
      exam: { include: { questions: true } },
      answers: true,
      audience: true,
      invitation: true,
    },
  });

  if (!session) return apiError('Session not found', 404);
  if (session.status === 'completed') {
    return apiSuccess({ message: 'Already completed', sessionId });
  }

  const totalQuestions = session.totalQuestions || session.answers.length;
  const correctCount = session.answers.filter((a) => a.isCorrect).length;
  const wrongCount = session.answers.filter((a) => a.selectedAnswer !== null && !a.isCorrect).length;
  const skippedCount = totalQuestions - session.answers.length;
  const score = calculateScore(correctCount, totalQuestions);

  const now = new Date();

  // Update session to completed
  await prisma.examSession.update({
    where: { id: sessionId },
    data: {
      status: 'completed',
      completedAt: now,
      score,
      correctCount,
      wrongCount,
      skippedCount,
      timeTaken: timeTaken || null,
      completionEmailSent: false, // will be set true after email send below
    },
  });

  // Mark invitation as used
  if (session.invitationId) {
    await prisma.examInvitation.update({
      where: { id: session.invitationId },
      data: { isUsed: true },
    });
  }

  // Set validityStartedAt on the exam if not already set (first completion)
  if (!session.exam.validityStartedAt) {
    await prisma.exam.update({
      where: { id: session.examId },
      data: { validityStartedAt: now },
    });
  }

  // Compute when results will be released
  const validityStart = session.exam.validityStartedAt ?? now;
  const resultsDate = addHours(validityStart, session.exam.validityHours);

  const candidateEmail = session.audience?.email || session.externalEmail || '';
  const candidateName = session.audience?.name || session.externalName || 'Candidate';
  const lang = session.selectedLanguage;
  const langSuffix = lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase();
  const examTitle = (session.exam as Record<string, unknown>)[`title${langSuffix}`] as string
    || session.exam.titleEn || 'Exam';

  // Send completion confirmation email (NOT result — result comes from cron after validity expires)
  if (candidateEmail) {
    try {
      await sendCompletionConfirmation(candidateEmail, candidateName, examTitle, resultsDate);
      await prisma.examSession.update({
        where: { id: sessionId },
        data: { completionEmailSent: true },
      });
    } catch (emailErr) {
      console.error('Failed to send completion confirmation email:', emailErr);
      if (process.env.NODE_ENV === 'development') {
        console.log(`\n📧 DEV COMPLETION for ${candidateEmail}: Score=${score}%, Results at ${resultsDate.toISOString()}\n`);
      }
    }
  }

  return apiSuccess({
    sessionId,
    score,
    totalQuestions,
    correctCount,
    wrongCount,
    skippedCount,
    candidateName,
    examTitle,
    resultsDate: resultsDate.toISOString(),
  });
}

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiSuccess, calculateScore } from '@/lib/utils';
import { sendExamResult } from '@/lib/email';
import type { ExamResultData } from '@/lib/email';

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

  // Update session
  await prisma.examSession.update({
    where: { id: sessionId },
    data: {
      status: 'completed',
      completedAt: new Date(),
      score,
      correctCount,
      wrongCount,
      skippedCount,
      timeTaken: timeTaken || null,
    },
  });

  // Mark invitation as used
  if (session.invitationId) {
    await prisma.examInvitation.update({
      where: { id: session.invitationId },
      data: { isUsed: true },
    });
  }

  // Build result data for email
  const lang = session.selectedLanguage;
  const langSuffix = lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase();

  const wrongAnswers = await prisma.examAnswer.findMany({
    where: { sessionId, isCorrect: false, selectedAnswer: { not: null } },
    include: { question: true },
  });

  const skippedAnswers: typeof wrongAnswers = [];
  // Include questions not answered at all
  const questionOrder: string[] = JSON.parse(session.questionOrder);
  const answeredIds = new Set(session.answers.map((a) => a.questionId));
  const skippedQuestions = session.exam.questions.filter((q) => !answeredIds.has(q.id));

  const wrongAnswerData = wrongAnswers.map((a) => {
    const q = a.question;
    const qText = (q as Record<string, unknown>)[`question${langSuffix}`] as string || q.questionEn || '';
    const expText = (q as Record<string, unknown>)[`explanation${langSuffix}`] as string || q.explanationEn || '';
    const optsRaw = (q as Record<string, unknown>)[`options${langSuffix}`] as string || q.optionsEn || '[]';
    let opts: { key: string; value: string }[] = [];
    try { opts = JSON.parse(optsRaw); } catch {}
    const correctOpt = opts.find((o) => o.key === q.correctAnswer);
    const selectedOpt = opts.find((o) => o.key === a.selectedAnswer);

    return {
      questionText: qText,
      selectedAnswer: selectedOpt ? `${selectedOpt.key}. ${selectedOpt.value}` : a.selectedAnswer || 'Not answered',
      correctAnswer: correctOpt ? `${correctOpt.key}. ${correctOpt.value}` : q.correctAnswer,
      explanation: expText,
    };
  });

  const candidateEmail = session.audience?.email || session.externalEmail || '';
  const candidateName = session.audience?.name || session.externalName || 'Candidate';
  const examTitle = (session.exam as Record<string, unknown>)[`title${langSuffix}`] as string
    || session.exam.titleEn || 'Exam';

  // Send result email
  if (candidateEmail) {
    try {
      const emailData: ExamResultData = {
        candidateName,
        candidateEmail,
        examTitle,
        score,
        totalQuestions,
        correctCount,
        wrongCount,
        skippedCount,
        language: lang,
        wrongAnswers: wrongAnswerData,
      };
      await sendExamResult(emailData);
    } catch (emailErr) {
      console.error('Failed to send result email:', emailErr);
      if (process.env.NODE_ENV === 'development') {
        console.log(`\n📊 DEV RESULT for ${candidateEmail}: Score=${score}%\n`);
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
  });
}

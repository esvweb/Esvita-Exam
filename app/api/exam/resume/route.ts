export const dynamic = 'force-dynamic';

// GET /api/exam/resume?sessionId=...
// Returns existing in-progress session state so a candidate can resume after a crash/disconnect

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiSuccess, getLocalized } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) return apiError('sessionId is required');

  const examSession = await prisma.examSession.findUnique({
    where: { id: sessionId },
    include: {
      exam: { include: { questions: { orderBy: { orderIndex: 'asc' } } } },
      answers: { select: { questionId: true, selectedAnswer: true, isCorrect: true } },
    },
  });

  if (!examSession) return apiError('Session not found', 404);
  if (examSession.status !== 'in_progress') {
    return apiError('Session is no longer in progress', 410);
  }

  const lang = examSession.selectedLanguage as 'EN' | 'FRA' | 'RU' | 'TR' | 'ITA';

  // Restore question order from stored JSON
  const questionOrder: string[] = JSON.parse(examSession.questionOrder || '[]');
  const orderedQuestions = questionOrder
    .map((qid) => examSession.exam.questions.find((q) => q.id === qid))
    .filter(Boolean);

  // Build answered map
  const answeredMap: Record<string, string | null> = {};
  for (const a of examSession.answers) {
    answeredMap[a.questionId] = a.selectedAnswer;
  }

  // Find the first unanswered question index (resume point)
  const firstUnansweredIndex = orderedQuestions.findIndex((q) => q && !(q.id in answeredMap));
  const resumeAtIndex = firstUnansweredIndex >= 0 ? firstUnansweredIndex : orderedQuestions.length - 1;

  const questions = orderedQuestions.map((q) => {
    if (!q) return null;
    return {
      id: q.id,
      type: q.type,
      questionText: getLocalized(q as Record<string, unknown>, 'question', lang) || '',
      options: q.type === 'multiple_choice'
        ? (() => { try { return JSON.parse(getLocalized(q as Record<string, unknown>, 'options', lang) || '[]'); } catch { return []; } })()
        : null,
      maxScore: q.maxScore,
    };
  });

  return apiSuccess({
    sessionId,
    examId: examSession.examId,
    selectedLanguage: lang,
    totalQuestions: orderedQuestions.length,
    resumeAtIndex,
    answeredMap,
    questions,
    examTitle: getLocalized(examSession.exam as unknown as Record<string, unknown>, 'title', lang) || examSession.exam.titleEn || 'Exam',
    timePerQuestion: examSession.exam.timePerQuestion,
    startedAt: examSession.startedAt,
  });
}

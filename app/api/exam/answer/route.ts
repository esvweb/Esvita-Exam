export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const { sessionId, questionId, selectedAnswer } = await req.json();

  if (!sessionId || !questionId) {
    return apiError('Session ID and question ID are required');
  }

  const examSession = await prisma.examSession.findUnique({ where: { id: sessionId } });
  if (!examSession) return apiError('Session not found', 404);
  if (examSession.status !== 'in_progress') return apiError('Exam session is no longer active', 410);

  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) return apiError('Question not found', 404);

  // Double-submit guard: if answer already exists and is identical, return idempotently
  const existing = await prisma.examAnswer.findUnique({
    where: { sessionId_questionId: { sessionId, questionId } },
  });
  if (existing && existing.selectedAnswer === (selectedAnswer ?? null)) {
    return apiSuccess({
      isCorrect: existing.isCorrect,
      correctAnswer: question.type === 'short_answer' ? null : question.correctAnswer,
      duplicate: true,
    });
  }

  const isShortAnswer = question.type === 'short_answer';
  const isCorrect = isShortAnswer
    ? null
    : selectedAnswer != null
      ? selectedAnswer.toUpperCase() === (question.correctAnswer ?? '').toUpperCase()
      : false;

  await prisma.examAnswer.upsert({
    where: { sessionId_questionId: { sessionId, questionId } },
    create: { sessionId, questionId, selectedAnswer: selectedAnswer ?? null, isCorrect },
    update: { selectedAnswer: selectedAnswer ?? null, isCorrect, answeredAt: new Date() },
  });

  return apiSuccess({ isCorrect, correctAnswer: isShortAnswer ? null : question.correctAnswer });
}

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const { sessionId, questionId, selectedAnswer } = await req.json();

  if (!sessionId || !questionId) {
    return apiError('Session ID and question ID are required');
  }

  const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
  if (!session) return apiError('Session not found', 404);
  if (session.status !== 'in_progress') return apiError('Exam session is no longer active', 410);

  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) return apiError('Question not found', 404);

  const isCorrect = selectedAnswer !== null
    ? selectedAnswer.toUpperCase() === question.correctAnswer.toUpperCase()
    : false;

  // Upsert answer (allow re-answering)
  await prisma.examAnswer.upsert({
    where: { sessionId_questionId: { sessionId, questionId } },
    create: { sessionId, questionId, selectedAnswer: selectedAnswer || null, isCorrect },
    update: { selectedAnswer: selectedAnswer || null, isCorrect, answeredAt: new Date() },
  });

  return apiSuccess({ isCorrect, correctAnswer: question.correctAnswer });
}

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);

  const questions = await prisma.question.findMany({
    where: { examId: params.id },
    orderBy: { orderIndex: 'asc' },
  });
  return apiSuccess(questions);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);

  const body = await req.json();

  const questionType = body.type === 'short_answer' ? 'short_answer' : 'multiple_choice';

  // Correct answer required only for multiple choice
  if (questionType === 'multiple_choice' && !body.correctAnswer) {
    return apiError('Correct answer is required');
  }

  // Get current question count for order index
  const count = await prisma.question.count({ where: { examId: params.id } });

  const question = await prisma.question.create({
    data: {
      examId: params.id,
      orderIndex: body.orderIndex ?? count,
      type: questionType,
      maxScore: questionType === 'short_answer' ? (body.maxScore ?? 100) : 100,
      questionEn: body.questionEn || null,
      questionFra: body.questionFra || null,
      questionRu: body.questionRu || null,
      questionTr: body.questionTr || null,
      questionIta: body.questionIta || null,
      optionsEn: questionType === 'multiple_choice' && body.optionsEn ? JSON.stringify(body.optionsEn) : null,
      optionsFra: questionType === 'multiple_choice' && body.optionsFra ? JSON.stringify(body.optionsFra) : null,
      optionsRu: questionType === 'multiple_choice' && body.optionsRu ? JSON.stringify(body.optionsRu) : null,
      optionsTr: questionType === 'multiple_choice' && body.optionsTr ? JSON.stringify(body.optionsTr) : null,
      optionsIta: questionType === 'multiple_choice' && body.optionsIta ? JSON.stringify(body.optionsIta) : null,
      correctAnswer: questionType === 'multiple_choice' ? body.correctAnswer.toUpperCase() : null,
      explanationEn: body.explanationEn || null,
      explanationFra: body.explanationFra || null,
      explanationRu: body.explanationRu || null,
      explanationTr: body.explanationTr || null,
      explanationIta: body.explanationIta || null,
    },
  });
  return apiSuccess(question, 201);
}

// Bulk import questions
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);

  const { questions } = await req.json();
  if (!Array.isArray(questions) || questions.length === 0) {
    return apiError('Questions array is required');
  }

  // Get current count
  const existingCount = await prisma.question.count({ where: { examId: params.id } });

  const created = await prisma.$transaction(
    questions.map((q, i) => {
      const qType = q.type === 'short_answer' ? 'short_answer' : 'multiple_choice';
      return prisma.question.create({
        data: {
          examId: params.id,
          orderIndex: existingCount + i,
          type: qType,
          maxScore: qType === 'short_answer' ? (q.maxScore ?? 100) : 100,
          questionEn: q.questionEn || null,
          questionFra: q.questionFra || null,
          questionRu: q.questionRu || null,
          questionTr: q.questionTr || null,
          questionIta: q.questionIta || null,
          optionsEn: qType === 'multiple_choice' && q.optionsEn ? JSON.stringify(q.optionsEn) : null,
          optionsFra: qType === 'multiple_choice' && q.optionsFra ? JSON.stringify(q.optionsFra) : null,
          optionsRu: qType === 'multiple_choice' && q.optionsRu ? JSON.stringify(q.optionsRu) : null,
          optionsTr: qType === 'multiple_choice' && q.optionsTr ? JSON.stringify(q.optionsTr) : null,
          optionsIta: qType === 'multiple_choice' && q.optionsIta ? JSON.stringify(q.optionsIta) : null,
          correctAnswer: qType === 'multiple_choice' ? (q.correctAnswer || 'A').toUpperCase() : null,
          explanationEn: q.explanationEn || null,
          explanationFra: q.explanationFra || null,
          explanationRu: q.explanationRu || null,
          explanationTr: q.explanationTr || null,
          explanationIta: q.explanationIta || null,
        },
      });
    })
  );
  return apiSuccess({ created: created.length });
}

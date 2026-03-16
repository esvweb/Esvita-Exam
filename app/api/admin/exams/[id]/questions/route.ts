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

  // Validate correct answer
  if (!body.correctAnswer) return apiError('Correct answer is required');

  // Get current question count for order index
  const count = await prisma.question.count({ where: { examId: params.id } });

  const question = await prisma.question.create({
    data: {
      examId: params.id,
      orderIndex: body.orderIndex ?? count,
      questionEn: body.questionEn || null,
      questionFra: body.questionFra || null,
      questionRu: body.questionRu || null,
      questionTr: body.questionTr || null,
      questionIta: body.questionIta || null,
      optionsEn: body.optionsEn ? JSON.stringify(body.optionsEn) : null,
      optionsFra: body.optionsFra ? JSON.stringify(body.optionsFra) : null,
      optionsRu: body.optionsRu ? JSON.stringify(body.optionsRu) : null,
      optionsTr: body.optionsTr ? JSON.stringify(body.optionsTr) : null,
      optionsIta: body.optionsIta ? JSON.stringify(body.optionsIta) : null,
      correctAnswer: body.correctAnswer.toUpperCase(),
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
    questions.map((q, i) =>
      prisma.question.create({
        data: {
          examId: params.id,
          orderIndex: existingCount + i,
          questionEn: q.questionEn || null,
          questionFra: q.questionFra || null,
          questionRu: q.questionRu || null,
          questionTr: q.questionTr || null,
          questionIta: q.questionIta || null,
          optionsEn: q.optionsEn ? JSON.stringify(q.optionsEn) : null,
          optionsFra: q.optionsFra ? JSON.stringify(q.optionsFra) : null,
          optionsRu: q.optionsRu ? JSON.stringify(q.optionsRu) : null,
          optionsTr: q.optionsTr ? JSON.stringify(q.optionsTr) : null,
          optionsIta: q.optionsIta ? JSON.stringify(q.optionsIta) : null,
          correctAnswer: (q.correctAnswer || 'A').toUpperCase(),
          explanationEn: q.explanationEn || null,
          explanationFra: q.explanationFra || null,
          explanationRu: q.explanationRu || null,
          explanationTr: q.explanationTr || null,
          explanationIta: q.explanationIta || null,
        },
      })
    )
  );
  return apiSuccess({ created: created.length });
}

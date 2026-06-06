import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canViewQuestionBank, canEditQuestionBank, forbidden } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canViewQuestionBank(session)) return forbidden();

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const tag = searchParams.get('tag');
  const type = searchParams.get('type');
  const q = searchParams.get('q');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (type) where.type = type;
  if (category) where.categories = { has: category };
  if (tag) where.tags = { has: tag };
  if (q) {
    where.OR = [
      { questionEn: { contains: q, mode: 'insensitive' } },
      { questionTr: { contains: q, mode: 'insensitive' } },
    ];
  }

  const items = await prisma.questionBank.findMany({
    where,
    include: { creator: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return apiSuccess(items);
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canEditQuestionBank(session)) return forbidden();

  const body = await req.json();
  const {
    type, questionEn, questionFra, questionRu, questionTr, questionIta,
    optionsEn, optionsFra, optionsRu, optionsTr, optionsIta,
    correctAnswer, maxScore,
    referenceAnswerEn, referenceAnswerFra, referenceAnswerRu, referenceAnswerTr, referenceAnswerIta,
    explanationEn, explanationFra, explanationRu, explanationTr, explanationIta,
    categories, tags,
  } = body;

  if (!questionEn) return apiError('English question text is required (base language)');

  const item = await prisma.questionBank.create({
    data: {
      type: type || 'multiple_choice',
      questionEn: questionEn || null, questionFra: questionFra || null,
      questionRu: questionRu || null, questionTr: questionTr || null, questionIta: questionIta || null,
      optionsEn: optionsEn || null, optionsFra: optionsFra || null,
      optionsRu: optionsRu || null, optionsTr: optionsTr || null, optionsIta: optionsIta || null,
      correctAnswer: correctAnswer || null,
      maxScore: maxScore ?? 10,
      referenceAnswerEn: referenceAnswerEn || null, referenceAnswerFra: referenceAnswerFra || null,
      referenceAnswerRu: referenceAnswerRu || null, referenceAnswerTr: referenceAnswerTr || null,
      referenceAnswerIta: referenceAnswerIta || null,
      explanationEn: explanationEn || null, explanationFra: explanationFra || null,
      explanationRu: explanationRu || null, explanationTr: explanationTr || null,
      explanationIta: explanationIta || null,
      categories: categories || [],
      tags: tags || [],
      createdBy: session.userId,
    },
  });

  await logAudit(session, 'create', 'question_bank', item.id);
  return apiSuccess(item, 201);
}

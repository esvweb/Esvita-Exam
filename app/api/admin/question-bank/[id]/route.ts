import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canEditQuestionBank, canDeleteFromQuestionBank, forbidden } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);

  const item = await prisma.questionBank.findUnique({
    where: { id: params.id },
    include: { creator: { select: { id: true, name: true } } },
  });
  if (!item) return apiError('Question not found', 404);
  return apiSuccess(item);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canEditQuestionBank(session)) return forbidden();

  const body = await req.json();

  const fields = [
    'type','questionEn','questionFra','questionRu','questionTr','questionIta',
    'optionsEn','optionsFra','optionsRu','optionsTr','optionsIta',
    'correctAnswer','maxScore',
    'referenceAnswerEn','referenceAnswerFra','referenceAnswerRu','referenceAnswerTr','referenceAnswerIta',
    'explanationEn','explanationFra','explanationRu','explanationTr','explanationIta',
    'categories','tags',
  ] as const;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  for (const f of fields) {
    if (body[f] !== undefined) data[f] = body[f] ?? null;
  }

  const updated = await prisma.questionBank.update({ where: { id: params.id }, data });
  await logAudit(session, 'update', 'question_bank', params.id);
  return apiSuccess(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canDeleteFromQuestionBank(session)) return forbidden();

  await prisma.questionBank.delete({ where: { id: params.id } });
  await logAudit(session, 'delete', 'question_bank', params.id);
  return apiSuccess({ deleted: true });
}

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canImportFromBank, forbidden } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';

// POST /api/admin/exams/[id]/import-from-bank
// Body: { questionBankIds: string[] }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canImportFromBank(session)) return forbidden();

  const exam = await prisma.exam.findUnique({ where: { id: params.id } });
  if (!exam) return apiError('Exam not found', 404);

  const { questionBankIds } = await req.json() as { questionBankIds: string[] };
  if (!questionBankIds?.length) return apiError('No question IDs provided');

  const bankItems = await prisma.questionBank.findMany({
    where: { id: { in: questionBankIds } },
  });

  // Get current max orderIndex
  const last = await prisma.question.findFirst({
    where: { examId: params.id },
    orderBy: { orderIndex: 'desc' },
  });
  let orderIndex = (last?.orderIndex ?? -1) + 1;

  const created = await prisma.$transaction(
    bankItems.map((item) =>
      prisma.question.create({
        data: {
          examId: params.id,
          orderIndex: orderIndex++,
          type: item.type,
          questionEn: item.questionEn, questionFra: item.questionFra,
          questionRu: item.questionRu, questionTr: item.questionTr, questionIta: item.questionIta,
          optionsEn: item.optionsEn, optionsFra: item.optionsFra,
          optionsRu: item.optionsRu, optionsTr: item.optionsTr, optionsIta: item.optionsIta,
          correctAnswer: item.correctAnswer,
          maxScore: item.maxScore,
          referenceAnswerEn: item.referenceAnswerEn, referenceAnswerFra: item.referenceAnswerFra,
          referenceAnswerRu: item.referenceAnswerRu, referenceAnswerTr: item.referenceAnswerTr,
          referenceAnswerIta: item.referenceAnswerIta,
          explanationEn: item.explanationEn, explanationFra: item.explanationFra,
          explanationRu: item.explanationRu, explanationTr: item.explanationTr,
          explanationIta: item.explanationIta,
          questionBankId: item.id,
        },
      })
    )
  );

  // Update usedInCount for each bank item (fire-and-forget)
  prisma.$transaction(
    bankItems.map((item) =>
      prisma.questionBank.update({
        where: { id: item.id },
        data: { usedInCount: { increment: 1 } },
      })
    )
  ).catch(() => {});

  await logAudit(session, 'import', 'exam', params.id, { count: created.length, source: 'question_bank' });
  return apiSuccess({ imported: created.length, questions: created });
}

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canDuplicateExam, forbidden } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';

// POST /api/admin/exams/[id]/duplicate
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canDuplicateExam(session)) return forbidden();

  const source = await prisma.exam.findUnique({
    where: { id: params.id },
    include: { questions: { orderBy: { orderIndex: 'asc' } } },
  });
  if (!source) return apiError('Exam not found', 404);

  const { questions, id: _id, createdAt: _ca, updatedAt: _ua,
    validityStartedAt: _vs, resultsEmailSentAt: _re,
    supervisorReminderSentAt: _sr, candidateReminderSentAt: _cr,
    ...examData } = source;

  const newExam = await prisma.exam.create({
    data: {
      ...examData,
      titleEn: source.titleEn ? `${source.titleEn} (Copy)` : null,
      titleTr: source.titleTr ? `${source.titleTr} (Kopya)` : null,
      titleFra: source.titleFra ? `${source.titleFra} (Copie)` : null,
      titleRu: source.titleRu ? `${source.titleRu} (Копия)` : null,
      titleIta: source.titleIta ? `${source.titleIta} (Copia)` : null,
      status: 'draft',
      isActive: false,
      validityStartedAt: null,
      resultsEmailSentAt: null,
      supervisorReminderSentAt: null,
      candidateReminderSentAt: null,
      createdBy: session.userId,
    },
  });

  // Copy all questions
  if (questions.length > 0) {
    await prisma.question.createMany({
      data: questions.map(({ id: _qid, examId: _eid, createdAt: _qca, updatedAt: _qua, ...q }) => ({
        ...q,
        examId: newExam.id,
      })),
    });
  }

  await logAudit(session, 'duplicate', 'exam', newExam.id, { sourceId: params.id });
  return apiSuccess(newExam, 201);
}

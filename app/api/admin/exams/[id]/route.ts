export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canWrite, canDelete, forbidden } from '@/lib/permissions';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    include: {
      questions: { orderBy: { orderIndex: 'asc' } },
      _count: { select: { sessions: true, questions: true } },
      creator: { select: { id: true, name: true, email: true } },
    },
  });
  if (!exam) return apiError('Exam not found', 404);
  return apiSuccess(exam);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canWrite(session)) return forbidden();

  const body = await req.json();
  const exam = await prisma.exam.update({
    where: { id: params.id },
    data: {
      titleEn: body.titleEn ?? undefined, titleFra: body.titleFra ?? undefined,
      titleRu: body.titleRu ?? undefined, titleTr: body.titleTr ?? undefined,
      titleIta: body.titleIta ?? undefined, descriptionEn: body.descriptionEn ?? undefined,
      descriptionFra: body.descriptionFra ?? undefined, descriptionRu: body.descriptionRu ?? undefined,
      descriptionTr: body.descriptionTr ?? undefined, descriptionIta: body.descriptionIta ?? undefined,
      timePerQuestion: body.timePerQuestion ?? undefined,
      isActive: body.isActive ?? undefined,
    },
  });
  return apiSuccess(exam);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canDelete(session)) return forbidden('Only Admins can delete exams');

  const exam = await prisma.exam.findUnique({ where: { id: params.id } });
  if (!exam) return apiError('Exam not found', 404);

  // Cascade: ExamAnswers → ExamSessions → ExamInvitations → Exam (Questions cascade from Exam)
  await prisma.$transaction([
    prisma.examAnswer.deleteMany({ where: { session: { examId: params.id } } }),
    prisma.examSession.deleteMany({ where: { examId: params.id } }),
    prisma.examInvitation.deleteMany({ where: { examId: params.id } }),
    prisma.exam.delete({ where: { id: params.id } }),
  ]);

  return apiSuccess({ deleted: true });
}

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import {
  canEditDraftExam, canEditLiveExam, canDeleteExam,
  canAssignSupervisor, canSetAnnouncementDate, canSetPassMark,
  canApplyCategories, canPublishExam, forbidden,
} from '@/lib/permissions';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    include: {
      questions: { orderBy: { orderIndex: 'asc' } },
      _count: { select: { sessions: true, questions: true } },
      creator: { select: { id: true, name: true, email: true } },
      supervisor: { select: { id: true, name: true, email: true } },
    },
  });
  if (!exam) return apiError('Exam not found', 404);
  return apiSuccess(exam);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);

  const exam = await prisma.exam.findUnique({ where: { id: params.id } });
  if (!exam) return apiError('Exam not found', 404);

  // Live exam edits require higher permission
  const isLive = exam.status === 'published';
  if (isLive && !canEditLiveExam(session)) return forbidden('Only Super Admin / Admin can edit a published exam');
  if (!isLive && !canEditDraftExam(session)) return forbidden();

  const body = await req.json();

  // Selectively allow fields based on permissions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};

  // Content fields — any editor
  const contentFields = [
    'titleEn','titleFra','titleRu','titleTr','titleIta',
    'descriptionEn','descriptionFra','descriptionRu','descriptionTr','descriptionIta',
    'timePerQuestion','validityHours',
  ] as const;
  for (const f of contentFields) {
    if (body[f] !== undefined) data[f] = body[f] ?? null;
  }

  // Categories/tags — moderator+
  if (body.categories !== undefined && canApplyCategories(session)) data.categories = body.categories;
  if (body.tags !== undefined && canApplyCategories(session)) data.tags = body.tags;

  // Supervisor, announcement date — admin+
  if (body.supervisorId !== undefined && canAssignSupervisor(session)) data.supervisorId = body.supervisorId || null;
  if (body.resultAnnouncementDate !== undefined && canSetAnnouncementDate(session)) {
    data.resultAnnouncementDate = body.resultAnnouncementDate ? new Date(body.resultAnnouncementDate) : null;
  }

  // Pass mark — admin+
  if (body.passMarkPercent !== undefined && canSetPassMark(session)) data.passMarkPercent = body.passMarkPercent;

  // Scheduled publish date — admin+
  if (body.scheduledPublishAt !== undefined && canPublishExam(session)) {
    data.scheduledPublishAt = body.scheduledPublishAt ? new Date(body.scheduledPublishAt) : null;
    if (data.scheduledPublishAt && exam.status === 'draft') data.status = 'scheduled';
    else if (!data.scheduledPublishAt && exam.status === 'scheduled') data.status = 'draft';
  }

  const updated = await prisma.exam.update({ where: { id: params.id }, data });
  await logAudit(session, 'update', 'exam', params.id);
  return apiSuccess(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canDeleteExam(session)) return forbidden('Only Admins can delete exams');

  const exam = await prisma.exam.findUnique({ where: { id: params.id } });
  if (!exam) return apiError('Exam not found', 404);

  await prisma.$transaction([
    prisma.examAnswer.deleteMany({ where: { session: { examId: params.id } } }),
    prisma.examSession.deleteMany({ where: { examId: params.id } }),
    prisma.examInvitation.deleteMany({ where: { examId: params.id } }),
    prisma.exam.delete({ where: { id: params.id } }),
  ]);

  await logAudit(session, 'delete', 'exam', params.id, { title: exam.titleEn || exam.titleTr });
  return apiSuccess({ deleted: true });
}

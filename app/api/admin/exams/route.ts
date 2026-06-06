import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canCreateExam, canViewAllReports, isTeamLeader, forbidden } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status'); // filter by status
  const all = searchParams.get('all') === 'true';

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (status) where.status = status;
  else if (!all) where.status = { not: 'draft' }; // default: hide drafts from listing

  // Team leaders can only see exams relevant to their team (no exam filter here — handled in sessions)
  if (isTeamLeader(session) && !canViewAllReports(session)) {
    // team leaders see all published/closed exams for now
    where.status = { in: ['published', 'closed'] };
  }

  const exams = await prisma.exam.findMany({
    where,
    include: {
      _count: { select: { questions: true, sessions: true } },
      creator: { select: { id: true, name: true, email: true } },
      supervisor: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return apiSuccess(exams);
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canCreateExam(session)) return forbidden();

  const body = await req.json();
  const {
    titleEn, titleFra, titleRu, titleTr, titleIta,
    descriptionEn, descriptionFra, descriptionRu, descriptionTr, descriptionIta,
    timePerQuestion, validityHours,
    passMarkPercent, categories, tags,
    supervisorId, resultAnnouncementDate, scheduledPublishAt,
    status,
  } = body;

  if (!titleEn && !titleTr && !titleFra && !titleRu && !titleIta) {
    return apiError('At least one language title is required');
  }

  // Determine initial status
  let examStatus = 'draft';
  if (status === 'published') examStatus = 'published';
  else if (scheduledPublishAt) examStatus = 'scheduled';

  const exam = await prisma.exam.create({
    data: {
      titleEn: titleEn || null, titleFra: titleFra || null,
      titleRu: titleRu || null, titleTr: titleTr || null, titleIta: titleIta || null,
      descriptionEn: descriptionEn || null, descriptionFra: descriptionFra || null,
      descriptionRu: descriptionRu || null, descriptionTr: descriptionTr || null,
      descriptionIta: descriptionIta || null,
      timePerQuestion: timePerQuestion || 60,
      validityHours: validityHours || 72,
      passMarkPercent: passMarkPercent ?? 60,
      categories: categories || [],
      tags: tags || [],
      supervisorId: supervisorId || null,
      resultAnnouncementDate: resultAnnouncementDate ? new Date(resultAnnouncementDate) : null,
      scheduledPublishAt: scheduledPublishAt ? new Date(scheduledPublishAt) : null,
      status: examStatus,
      isActive: examStatus === 'published',
      createdBy: session.userId,
    },
  });

  await logAudit(session, 'create', 'exam', exam.id, { title: titleEn || titleTr });
  return apiSuccess(exam, 201);
}

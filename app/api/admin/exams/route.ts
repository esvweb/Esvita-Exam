import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canWrite, forbidden } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const all = searchParams.get('all') === 'true';

  const exams = await prisma.exam.findMany({
    where: all ? undefined : { isActive: true },
    include: {
      _count: { select: { questions: true, sessions: true } },
      creator: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return apiSuccess(exams);
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canWrite(session)) return forbidden();

  const body = await req.json();
  const {
    titleEn, titleFra, titleRu, titleTr, titleIta,
    descriptionEn, descriptionFra, descriptionRu, descriptionTr, descriptionIta,
    timePerQuestion, validityHours,
  } = body;

  if (!titleEn && !titleTr && !titleFra && !titleRu && !titleIta) {
    return apiError('At least one language title is required');
  }

  const exam = await prisma.exam.create({
    data: {
      titleEn: titleEn || null, titleFra: titleFra || null,
      titleRu: titleRu || null, titleTr: titleTr || null, titleIta: titleIta || null,
      descriptionEn: descriptionEn || null, descriptionFra: descriptionFra || null,
      descriptionRu: descriptionRu || null, descriptionTr: descriptionTr || null,
      descriptionIta: descriptionIta || null,
      timePerQuestion: timePerQuestion || 60,
      validityHours: validityHours || 72,
      createdBy: session.userId,
    },
  });
  return apiSuccess(exam, 201);
}

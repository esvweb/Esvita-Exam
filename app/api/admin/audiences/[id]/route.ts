export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canWrite, canDelete, forbidden } from '@/lib/permissions';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);

  const audience = await prisma.audience.findUnique({
    where: { id: params.id },
    include: {
      team: { select: { id: true, name: true, color: true } },
      examSessions: {
        where: { status: 'completed' },
        include: {
          exam: { select: { titleEn: true, titleTr: true, titleFra: true, titleRu: true, titleIta: true } },
        },
        orderBy: { completedAt: 'desc' },
      },
    },
  });

  if (!audience) return apiError('Candidate not found', 404);
  return apiSuccess(audience);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canWrite(session)) return forbidden();

  const body = await req.json();
  const audience = await prisma.audience.update({
    where: { id: params.id },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.email && { email: body.email.toLowerCase() }),
      ...(body.preferredLanguage && { preferredLanguage: body.preferredLanguage }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.teamId !== undefined && { teamId: body.teamId || null }),
    },
    include: {
      team: { select: { id: true, name: true, color: true } },
    },
  });
  return apiSuccess(audience);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canDelete(session)) return forbidden('Only Admins can deactivate candidates');

  await prisma.audience.update({ where: { id: params.id }, data: { isActive: false } });
  return apiSuccess({ message: 'Candidate deactivated' });
}

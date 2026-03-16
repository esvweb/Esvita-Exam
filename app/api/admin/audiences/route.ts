import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canWrite, forbidden } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get('teamId');

  const audiences = await prisma.audience.findMany({
    where: teamId ? { teamId } : undefined,
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { examSessions: true } },
      team: { select: { id: true, name: true, color: true } },
    },
  });
  return apiSuccess(audiences);
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canWrite(session)) return forbidden();

  const { name, email, preferredLanguage, teamId, nickname, realName } = await req.json();
  if (!name || !email) return apiError('Name and email are required');

  const existing = await prisma.audience.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return apiError('A candidate with this email already exists');

  const audience = await prisma.audience.create({
    data: {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      preferredLanguage: preferredLanguage || 'EN',
      nickname: nickname?.trim() || null,
      realName: realName?.trim() || null,
      ...(teamId && { teamId }),
    },
    include: {
      _count: { select: { examSessions: true } },
      team: { select: { id: true, name: true, color: true } },
    },
  });
  return apiSuccess(audience, 201);
}

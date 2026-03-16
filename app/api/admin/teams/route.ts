import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canWrite, canDelete, forbidden } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);

  const teams = await prisma.team.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { members: true } } },
  });
  return apiSuccess(teams);
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canWrite(session)) return forbidden();

  const { name, color } = await req.json();
  if (!name?.trim()) return apiError('Team name is required');

  const existing = await prisma.team.findUnique({ where: { name: name.trim() } });
  if (existing) return apiError('A team with this name already exists');

  const team = await prisma.team.create({
    data: { name: name.trim(), color: color || '#3B82F6' },
    include: { _count: { select: { members: true } } },
  });
  return apiSuccess(team, 201);
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canWrite(session)) return forbidden();

  const { id, name, color, isActive } = await req.json();
  if (!id) return apiError('Team ID is required');

  const team = await prisma.team.update({
    where: { id },
    data: {
      ...(name && { name: name.trim() }),
      ...(color && { color }),
      ...(isActive !== undefined && { isActive }),
    },
    include: { _count: { select: { members: true } } },
  });
  return apiSuccess(team);
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canDelete(session)) return forbidden('Only Admins and Super Admins can delete teams');

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return apiError('Team ID is required');

  // Unassign all members before deleting
  await prisma.audience.updateMany({ where: { teamId: id }, data: { teamId: null } });
  await prisma.team.delete({ where: { id } });
  return apiSuccess({ deleted: true });
}

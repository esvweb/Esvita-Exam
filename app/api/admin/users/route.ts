import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canManageUsers, forbidden } from '@/lib/permissions';

const VALID_ROLES = ['super_admin', 'admin', 'moderator', 'team_leader', 'staff'];

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canManageUsers(session)) return forbidden('Only Super Admins can view user management');

  const users = await prisma.user.findMany({
    include: { team: { select: { id: true, name: true, color: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return apiSuccess(users);
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canManageUsers(session)) return forbidden('Only Super Admins can create users');

  const { email, name, role, teamId } = await req.json();
  if (!email || !name) return apiError('Email and name are required');

  const assignedRole = VALID_ROLES.includes(role) ? role : 'staff';

  if (assignedRole === 'team_leader' && !teamId) {
    return apiError('Team leaders must be assigned to a team');
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return apiError('A user with this email already exists');

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      name: name.trim(),
      role: assignedRole,
      teamId: teamId || null,
    },
    include: { team: { select: { id: true, name: true, color: true } } },
  });
  return apiSuccess(user, 201);
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canManageUsers(session)) return forbidden('Only Super Admins can edit users');

  const { id, name, role, isActive, teamId } = await req.json();
  if (!id) return apiError('User ID is required');

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(role !== undefined && { role }),
      ...(isActive !== undefined && { isActive }),
      ...(teamId !== undefined && { teamId: teamId || null }),
    },
    include: { team: { select: { id: true, name: true, color: true } } },
  });
  return apiSuccess(user);
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canManageUsers(session)) return forbidden('Only Super Admins can delete users');

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return apiError('User ID is required');
  if (id === session.userId) return apiError('Cannot delete your own account');

  await prisma.user.delete({ where: { id } });
  return apiSuccess({ deleted: true });
}

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canManageUsers, forbidden } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canManageUsers(session)) return forbidden('Only Super Admins can view user management');

  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  return apiSuccess(users);
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canManageUsers(session)) return forbidden('Only Super Admins can create users');

  const { email, name, role } = await req.json();
  if (!email || !name) return apiError('Email and name are required');

  const validRoles = ['super_admin', 'admin', 'moderator', 'staff'];
  const assignedRole = validRoles.includes(role) ? role : 'staff';

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return apiError('A user with this email already exists');

  const user = await prisma.user.create({
    data: { email: email.toLowerCase().trim(), name: name.trim(), role: assignedRole },
  });
  return apiSuccess(user, 201);
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canManageUsers(session)) return forbidden('Only Super Admins can edit users');

  const { id, name, role, isActive } = await req.json();
  if (!id) return apiError('User ID is required');

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(name && { name: name.trim() }),
      ...(role && { role }),
      ...(isActive !== undefined && { isActive }),
    },
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

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { forbidden } from '@/lib/permissions';

// Super admin only
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (session.role !== 'super_admin') return forbidden();

  const { searchParams } = new URL(req.url);
  const entity = searchParams.get('entity');
  const action = searchParams.get('action');
  const userId = searchParams.get('userId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (entity) where.entity = entity;
  if (action) where.action = action;
  if (userId) where.userId = userId;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return apiSuccess({ logs, total, page, limit, pages: Math.ceil(total / limit) });
}

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';

// GET: fetch current user's notifications
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get('unread') === 'true';

  const notifications = await prisma.notification.findMany({
    where: {
      userId: session.userId,
      ...(unreadOnly ? { isRead: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: session.userId, isRead: false },
  });

  return apiSuccess({ notifications, unreadCount });
}

// PATCH: mark one or all as read
// Body: { id?: string, all?: true }
export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);

  const body = await req.json();

  if (body.all) {
    await prisma.notification.updateMany({
      where: { userId: session.userId, isRead: false },
      data: { isRead: true },
    });
    return apiSuccess({ markedAll: true });
  }

  if (body.id) {
    await prisma.notification.update({
      where: { id: body.id, userId: session.userId },
      data: { isRead: true },
    });
    return apiSuccess({ marked: body.id });
  }

  return apiError('Provide either "id" or "all: true"');
}

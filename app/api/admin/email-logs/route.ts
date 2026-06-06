export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canViewEmailLogs, forbidden } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canViewEmailLogs(session)) return forbidden();

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const status = searchParams.get('status');
  const examId = searchParams.get('examId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (type) where.type = type;
  if (status) where.status = status;
  if (examId) where.examId = examId;

  const [logs, total] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.emailLog.count({ where }),
  ]);

  return apiSuccess({ logs, total, page, limit, pages: Math.ceil(total / limit) });
}

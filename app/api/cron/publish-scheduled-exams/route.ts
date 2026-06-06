// Triggered by Vercel Cron every 15 minutes
// Finds exams with scheduledPublishAt in the past and auto-publishes them

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  const toPublish = await prisma.exam.findMany({
    where: {
      status: 'scheduled',
      scheduledPublishAt: { lte: now },
    },
  });

  if (toPublish.length === 0) {
    return Response.json({ published: 0 });
  }

  await prisma.exam.updateMany({
    where: { id: { in: toPublish.map((e) => e.id) } },
    data: { status: 'published', isActive: true },
  });

  return Response.json({ published: toPublish.length, ids: toPublish.map((e) => e.id) });
}

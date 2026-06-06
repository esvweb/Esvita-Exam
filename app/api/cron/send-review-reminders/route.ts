// Triggered by Vercel Cron every hour
// Finds exams where resultAnnouncementDate is ~24h away and supervisor hasn't been reminded
// Also sends in-app notification

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { sendSupervisorReminder } from '@/lib/email';
import { notifySupervisorDeadline } from '@/lib/notifications';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  // Exams with resultAnnouncementDate between now+23h and now+25h, not yet reminded
  const exams = await prisma.exam.findMany({
    where: {
      status: 'published',
      resultAnnouncementDate: { gte: new Date(now.getTime() + 23 * 60 * 60 * 1000), lte: in25h },
      supervisorId: { not: null },
      supervisorReminderSentAt: null,
    },
    include: {
      supervisor: { select: { id: true, name: true, email: true } },
    },
  });

  let sent = 0;

  for (const exam of exams) {
    if (!exam.supervisor || !exam.resultAnnouncementDate) continue;

    // Count pending SA sessions
    const pendingCount = await prisma.examSession.count({
      where: { examId: exam.id, status: 'pending_review' },
    });

    if (pendingCount === 0) continue; // nothing to remind about

    const examTitle = exam.titleEn || exam.titleTr || 'Exam';
    const reviewLink = `${APP_URL}/admin/review?examId=${exam.id}`;

    await sendSupervisorReminder(
      exam.supervisor.email,
      exam.supervisor.name,
      examTitle,
      exam.resultAnnouncementDate,
      pendingCount,
      reviewLink,
      { examId: exam.id }
    );

    await notifySupervisorDeadline(exam.supervisor.id, examTitle, exam.id);

    await prisma.exam.update({
      where: { id: exam.id },
      data: { supervisorReminderSentAt: now },
    });

    sent++;
  }

  return Response.json({ sent });
}

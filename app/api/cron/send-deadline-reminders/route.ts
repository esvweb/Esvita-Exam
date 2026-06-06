// Triggered by Vercel Cron every hour
// Sends pre-deadline reminder to candidates who haven't started yet,
// when the exam validity window closes in ~24h

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { sendCandidateDeadlineReminder } from '@/lib/email';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // Find published exams where validity window closes in ~24h and reminder not yet sent
  const exams = await prisma.exam.findMany({
    where: {
      status: 'published',
      validityStartedAt: { not: null },
      candidateReminderSentAt: null,
    },
  });

  let sent = 0;

  for (const exam of exams) {
    if (!exam.validityStartedAt) continue;

    const deadline = new Date(
      exam.validityStartedAt.getTime() + exam.validityHours * 60 * 60 * 1000
    );
    const msUntilDeadline = deadline.getTime() - now.getTime();
    const hoursUntilDeadline = msUntilDeadline / (60 * 60 * 1000);

    // Only send when between 23h and 25h remaining
    if (hoursUntilDeadline < 23 || hoursUntilDeadline > 25) continue;

    // Find invitations for this exam where candidate hasn't started
    const invitations = await prisma.examInvitation.findMany({
      where: {
        examId: exam.id,
        isUsed: false,
        expiresAt: { gt: now },
      },
    });

    const examTitle = exam.titleEn || exam.titleTr || 'Exam';

    for (const inv of invitations) {
      // Find the audience record for this invitation by email
      const audience = await prisma.audience.findFirst({
        where: { email: inv.email, isArchived: false },
      });

      const nickname = audience?.nickname || audience?.name || inv.name || 'Candidate';
      const examLink = `${APP_URL}/exam/${inv.uniqueToken}`;

      await sendCandidateDeadlineReminder(
        inv.email,
        nickname,
        examTitle,
        examLink,
        deadline,
        { audienceId: audience?.id, examId: exam.id }
      );
      sent++;
    }

    await prisma.exam.update({
      where: { id: exam.id },
      data: { candidateReminderSentAt: now },
    });
  }

  return Response.json({ sent });
}

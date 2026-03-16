export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { sendExamResult } from '@/lib/email';
import type { ExamResultData } from '@/lib/email';

/**
 * GET /api/cron/send-exam-results
 * Called by Vercel Cron every 15 minutes.
 * Finds all exams whose validity period has expired and sends results
 * to all candidates who completed the exam.
 *
 * Secured with CRON_SECRET header.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const now = new Date();

  // Find exams where validity has expired AND results haven't been sent yet
  // validityStartedAt + validityHours * 3600 seconds < now
  const expiredExams = await prisma.exam.findMany({
    where: {
      validityStartedAt: { not: null },
      resultsEmailSentAt: null,
    },
    include: {
      sessions: {
        where: { status: 'completed' },
        include: {
          audience: true,
          answers: {
            where: { isCorrect: false, selectedAnswer: { not: null } },
            include: { question: true },
          },
        },
      },
    },
  });

  let processed = 0;
  let emailsSent = 0;

  for (const exam of expiredExams) {
    // Check if validity has actually expired
    if (!exam.validityStartedAt) continue;
    const validityEnd = new Date(
      exam.validityStartedAt.getTime() + exam.validityHours * 3_600_000
    );
    if (now < validityEnd) continue; // Not yet expired

    processed++;
    const examTitle = exam.titleEn || exam.titleTr || 'Exam';

    for (const session of exam.sessions) {
      const candidateEmail = session.audience?.email || session.externalEmail || '';
      const candidateName = session.audience?.name || session.externalName || 'Candidate';
      if (!candidateEmail) continue;

      const lang = session.selectedLanguage;
      const langSuffix = lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase();
      const localTitle = (exam as Record<string, unknown>)[`title${langSuffix}`] as string || examTitle;

      const wrongAnswerData = session.answers.map((a) => {
        const q = a.question;
        const qText = (q as Record<string, unknown>)[`question${langSuffix}`] as string || q.questionEn || '';
        const expText = (q as Record<string, unknown>)[`explanation${langSuffix}`] as string || q.explanationEn || '';
        const optsRaw = (q as Record<string, unknown>)[`options${langSuffix}`] as string || q.optionsEn || '[]';
        let opts: { key: string; value: string }[] = [];
        try { opts = JSON.parse(optsRaw); } catch {}
        const correctOpt = opts.find((o) => o.key === q.correctAnswer);
        const selectedOpt = opts.find((o) => o.key === a.selectedAnswer);
        return {
          questionText: qText,
          selectedAnswer: selectedOpt ? `${selectedOpt.key}. ${selectedOpt.value}` : a.selectedAnswer || '',
          correctAnswer: correctOpt ? `${correctOpt.key}. ${correctOpt.value}` : q.correctAnswer,
          explanation: expText,
        };
      });

      const emailData: ExamResultData = {
        candidateName,
        candidateEmail,
        examTitle: localTitle,
        score: session.score ?? 0,
        totalQuestions: session.totalQuestions ?? 0,
        correctCount: session.correctCount ?? 0,
        wrongCount: session.wrongCount ?? 0,
        skippedCount: session.skippedCount ?? 0,
        language: lang,
        wrongAnswers: wrongAnswerData,
      };

      try {
        await sendExamResult(emailData);
        emailsSent++;
      } catch (err) {
        console.error(`Cron: Failed to send results to ${candidateEmail}:`, err);
      }
    }

    // Mark this exam's results as sent
    await prisma.exam.update({
      where: { id: exam.id },
      data: { resultsEmailSentAt: now },
    });
  }

  return Response.json({
    ok: true,
    examsProcessed: processed,
    emailsSent,
    checkedAt: now.toISOString(),
  });
}

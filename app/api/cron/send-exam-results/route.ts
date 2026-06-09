export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { sendExamResult } from '@/lib/email';
import { getLocalized } from '@/lib/utils';

// Called by Vercel Cron every 15 minutes.
// Finds exams where either:
// 1. resultAnnouncementDate has passed (preferred — explicit date set)
// 2. validityStartedAt + validityHours has passed (fallback)
// Sends results to all completed sessions; marks exam as closed.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  const expiredExams = await prisma.exam.findMany({
    where: {
      status: 'published',
      validityStartedAt: { not: null },
      resultsEmailSentAt: null,
    },
    include: {
      questions: { select: { type: true } },
      sessions: {
        where: { status: 'completed', isPreview: false },
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
    if (!exam.validityStartedAt) continue;

    // Determine the release date: explicit announcement date OR validity expiry
    const releaseDate = exam.resultAnnouncementDate
      ?? new Date(exam.validityStartedAt.getTime() + exam.validityHours * 3_600_000);

    if (now < releaseDate) continue;

    processed++;

    for (const session of exam.sessions) {
      const candidateEmail = session.audience?.email || session.externalEmail || '';
      // Always display nickname to the candidate
      const candidateNickname =
        session.audience?.nickname || session.audience?.name || session.externalName || 'Candidate';
      if (!candidateEmail) continue;

      const lang = session.selectedLanguage as 'EN' | 'FRA' | 'RU' | 'TR' | 'ITA';

      const hasSAQuestions = exam.questions.some((q) => q.type === 'short_answer');

      const wrongAnswers = hasSAQuestions ? [] : session.answers
        .filter((a) => a.question.type === 'multiple_choice' && a.isCorrect === false)
        .map((a) => {
          const q = a.question;
          const optsRaw = getLocalized(q as Record<string, unknown>, 'options', lang) || q.optionsEn || '[]';
          let opts: { key: string; value: string }[] = [];
          try { opts = JSON.parse(optsRaw); } catch { /* ignored */ }
          const correctOpt = opts.find((o) => o.key === q.correctAnswer);
          const selectedOpt = opts.find((o) => o.key === a.selectedAnswer);
          return {
            questionText: getLocalized(q as Record<string, unknown>, 'question', lang) || '',
            selectedAnswer: selectedOpt ? `${selectedOpt.key}. ${selectedOpt.value}` : (a.selectedAnswer || ''),
            correctAnswer: correctOpt ? `${correctOpt.key}. ${correctOpt.value}` : (q.correctAnswer ?? ''),
            explanation: getLocalized(q as Record<string, unknown>, 'explanation', lang) || '',
          };
        });

      try {
        await sendExamResult({
          candidateNickname,
          candidateEmail,
          examTitle: getLocalized(exam as unknown as Record<string, unknown>, 'title', lang) || exam.titleEn || 'Exam',
          score: session.score ?? 0,
          totalQuestions: session.totalQuestions ?? 0,
          correctCount: session.correctCount ?? 0,
          wrongCount: session.wrongCount ?? 0,
          skippedCount: session.skippedCount ?? 0,
          passMarkPercent: exam.passMarkPercent,
          language: lang,
          hasSAQuestions,
          wrongAnswers,
          audienceId: session.audienceId || undefined,
          examId: exam.id,
          sessionId: session.id,
        });
        emailsSent++;
      } catch (err) {
        console.error(`Cron: Failed to send results to ${candidateEmail}:`, err);
      }
    }

    await prisma.exam.update({
      where: { id: exam.id },
      data: { resultsEmailSentAt: now, status: 'closed', isActive: false },
    });
  }

  return Response.json({ ok: true, examsProcessed: processed, emailsSent, checkedAt: now.toISOString() });
}

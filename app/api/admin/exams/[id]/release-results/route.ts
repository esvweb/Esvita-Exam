import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canReleaseResults, forbidden } from '@/lib/permissions';
import { sendExamResult } from '@/lib/email';
import { logAudit } from '@/lib/audit';
import { getLocalized } from '@/lib/utils';

// POST /api/admin/exams/[id]/release-results
// Manually trigger result emails before the scheduled date
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canReleaseResults(session)) return forbidden();

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    include: { questions: true },
  });
  if (!exam) return apiError('Exam not found', 404);
  if (exam.resultsEmailSentAt) return apiError('Results have already been released for this exam');

  // Only sessions that are completed (pending_review sessions must wait for supervisor)
  const sessions = await prisma.examSession.findMany({
    where: { examId: params.id, status: 'completed', isPreview: false },
    include: {
      audience: true,
      answers: { include: { question: true } },
    },
  });

  if (sessions.length === 0) {
    return apiError('No completed sessions found. Ensure all short-answer reviews are done first.');
  }

  let sent = 0;
  for (const s of sessions) {
    const recipientEmail = s.audience?.email || s.externalEmail;
    const recipientNickname = s.audience?.nickname || s.audience?.name || s.externalName || 'Candidate';
    if (!recipientEmail) continue;

    const lang = s.selectedLanguage as 'EN' | 'FRA' | 'RU' | 'TR' | 'ITA';

    const hasSAQuestions = exam.questions.some((q) => q.type === 'short_answer');

    const wrongAnswers = hasSAQuestions ? [] : s.answers
      .filter((a) => a.isCorrect === false && a.question.type === 'multiple_choice')
      .map((a) => ({
        questionText: getLocalized(a.question, 'question', lang) || '',
        selectedAnswer: a.selectedAnswer || '',
        correctAnswer: a.question.correctAnswer || '',
        explanation: getLocalized(a.question, 'explanation', lang) || '',
      }));

    await sendExamResult({
      candidateNickname: recipientNickname,
      candidateEmail: recipientEmail,
      examTitle: getLocalized(exam, 'title', lang) || exam.titleEn || 'Exam',
      score: s.score ?? 0,
      totalQuestions: s.totalQuestions ?? 0,
      correctCount: s.correctCount ?? 0,
      wrongCount: s.wrongCount ?? 0,
      skippedCount: s.skippedCount ?? 0,
      passMarkPercent: exam.passMarkPercent,
      language: lang,
      hasSAQuestions,
      wrongAnswers,
      audienceId: s.audienceId || undefined,
      examId: params.id,
      sessionId: s.id,
    });
    sent++;
  }

  // Mark exam as closed and record release time
  await prisma.exam.update({
    where: { id: params.id },
    data: {
      resultsEmailSentAt: new Date(),
      status: 'closed',
      isActive: false,
    },
  });

  await logAudit(session, 'release', 'exam', params.id, { sentCount: sent });
  return apiSuccess({ sent, total: sessions.length });
}

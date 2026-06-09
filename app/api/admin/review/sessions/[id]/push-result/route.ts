import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess, getLocalized } from '@/lib/utils';
import { canReleaseResults, forbidden } from '@/lib/permissions';
import { sendExamResult } from '@/lib/email';

// POST /api/admin/review/sessions/[id]/push-result
// Manually send result email for a single completed session without waiting for the release date.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canReleaseResults(session)) return forbidden();

  const examSession = await prisma.examSession.findUnique({
    where: { id: params.id },
    include: {
      exam: { include: { questions: true } },
      audience: true,
      answers: { include: { question: true } },
    },
  });
  if (!examSession) return apiError('Session not found', 404);
  if (examSession.status !== 'completed') {
    return apiError('Session must be fully reviewed before pushing results');
  }
  if (examSession.resultEmailSent) {
    return apiError('Results have already been pushed for this session');
  }

  const recipientEmail = examSession.audience?.email || examSession.externalEmail;
  if (!recipientEmail) return apiError('No email address for this candidate');

  const recipientNickname =
    examSession.audience?.nickname || examSession.audience?.name || examSession.externalName || 'Candidate';
  const lang = examSession.selectedLanguage as 'EN' | 'FRA' | 'RU' | 'TR' | 'ITA';

  const hasSAQuestions = examSession.exam.questions.some((q) => q.type === 'short_answer');

  const wrongAnswers = hasSAQuestions ? [] : examSession.answers
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
    examTitle: getLocalized(examSession.exam, 'title', lang) || examSession.exam.titleEn || 'Exam',
    score: examSession.score ?? 0,
    totalQuestions: examSession.totalQuestions ?? 0,
    correctCount: examSession.correctCount ?? 0,
    wrongCount: examSession.wrongCount ?? 0,
    skippedCount: examSession.skippedCount ?? 0,
    passMarkPercent: examSession.exam.passMarkPercent,
    language: lang,
    hasSAQuestions,
    wrongAnswers,
    audienceId: examSession.audienceId || undefined,
    examId: examSession.examId,
    sessionId: params.id,
  });

  await prisma.examSession.update({
    where: { id: params.id },
    data: { resultEmailSent: true },
  });

  return apiSuccess({ sent: true, email: recipientEmail });
}

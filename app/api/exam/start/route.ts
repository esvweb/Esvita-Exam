export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiSuccess, shuffleArray, isExpired } from '@/lib/utils';

// POST: Start exam session (after language selection & OTP verification)
export async function POST(req: NextRequest) {
  const { invitationId, selectedLanguage, audienceEmail } = await req.json();

  if (!invitationId || !selectedLanguage) {
    return apiError('Invitation ID and language are required');
  }

  // Validate invitation
  const invitation = await prisma.examInvitation.findUnique({
    where: { id: invitationId },
    include: {
      exam: {
        include: {
          questions: {
            select: { id: true, orderIndex: true },
            orderBy: { orderIndex: 'asc' },
          },
        },
      },
    },
  });

  if (!invitation) return apiError('Invalid invitation', 404);
  if (invitation.isUsed) return apiError('This exam has already been completed', 410);
  if (isExpired(invitation.expiresAt)) return apiError('Invitation has expired', 410);

  const exam = invitation.exam;

  if (exam.questions.length === 0) {
    return apiError('This exam has no questions yet');
  }

  // Shuffle questions for this candidate
  const questionIds = exam.questions.map((q) => q.id);
  const shuffledIds = shuffleArray(questionIds);

  // Find audience if exists
  let audienceId: string | null = null;
  if (audienceEmail || invitation.email) {
    const audience = await prisma.audience.findUnique({
      where: { email: (audienceEmail || invitation.email).toLowerCase() },
    });
    if (audience) audienceId = audience.id;
  }

  // Create exam session
  const session = await prisma.examSession.create({
    data: {
      examId: exam.id,
      audienceId,
      invitationId: invitation.id,
      externalEmail: audienceId ? null : invitation.email,
      externalName: audienceId ? null : invitation.name,
      selectedLanguage,
      questionOrder: JSON.stringify(shuffledIds),
      totalQuestions: shuffledIds.length,
      status: 'in_progress',
    },
  });

  return apiSuccess({
    sessionId: session.id,
    examTitle: exam.titleEn || exam.titleTr || 'Exam',
    totalQuestions: shuffledIds.length,
    timePerQuestion: exam.timePerQuestion,
    totalTime: shuffledIds.length * exam.timePerQuestion,
  });
}

// GET: Get questions for active session
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  const lang = searchParams.get('lang') || 'EN';

  if (!sessionId) return apiError('Session ID is required');

  const session = await prisma.examSession.findUnique({
    where: { id: sessionId },
    include: {
      exam: { include: { questions: true } },
      answers: true,
    },
  });

  if (!session) return apiError('Session not found', 404);
  if (session.status !== 'in_progress') return apiError('Exam session is not active', 410);

  const questionOrder: string[] = JSON.parse(session.questionOrder);
  const questionMap = new Map(session.exam.questions.map((q) => [q.id, q]));

  const langSuffix = lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase();
  const answeredIds = new Set(session.answers.map((a) => a.questionId));

  const questions = questionOrder.map((qId) => {
    const q = questionMap.get(qId);
    if (!q) return null;

    const questionText = (q as Record<string, unknown>)[`question${langSuffix}`] as string
      || (q as Record<string, unknown>)['questionEn'] as string
      || '';
    const optionsRaw = (q as Record<string, unknown>)[`options${langSuffix}`] as string
      || (q as Record<string, unknown>)['optionsEn'] as string
      || '[]';

    let options: { key: string; value: string }[] = [];
    try { options = JSON.parse(optionsRaw); } catch { options = []; }

    return {
      id: q.id,
      questionText,
      options,
      answered: answeredIds.has(q.id),
    };
  }).filter(Boolean);

  return apiSuccess({
    sessionId,
    questions,
    totalQuestions: questionOrder.length,
    answeredCount: session.answers.length,
    timePerQuestion: session.exam.timePerQuestion,
    selectedLanguage: session.selectedLanguage,
    startedAt: session.startedAt,
  });
}

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canReview } from '@/lib/permissions';

// GET: List exam sessions that have pending short-answer reviews
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canReview(session)) return apiError('Insufficient permissions', 403);

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status') || 'pending_review';

  const sessions = await prisma.examSession.findMany({
    where: {
      status: statusFilter === 'all' ? { in: ['pending_review', 'reviewed'] } : statusFilter,
    },
    include: {
      exam: {
        select: {
          id: true,
          titleEn: true,
          titleTr: true,
          titleFra: true,
          titleRu: true,
          titleIta: true,
        },
      },
      audience: { select: { id: true, name: true, email: true, nickname: true } },
      answers: {
        include: {
          question: { select: { id: true, type: true } },
        },
      },
    },
    orderBy: { completedAt: 'desc' },
  });

  const result = sessions.map((s) => {
    const shortAnswerAnswers = s.answers.filter((a) => a.question.type === 'short_answer');
    const reviewedCount = shortAnswerAnswers.filter((a) => a.reviewedAt !== null).length;

    return {
      id: s.id,
      examId: s.exam.id,
      examTitle: s.exam.titleEn || s.exam.titleTr || 'Exam',
      candidateName: s.audience?.name || s.externalName || 'Unknown',
      candidateEmail: s.audience?.email || s.externalEmail || '',
      nickname: s.audience?.nickname || null,
      selectedLanguage: s.selectedLanguage,
      completedAt: s.completedAt,
      status: s.status,
      score: s.score,
      totalQuestions: s.totalQuestions,
      shortAnswerTotal: shortAnswerAnswers.length,
      shortAnswerReviewed: reviewedCount,
    };
  });

  return apiSuccess(result);
}

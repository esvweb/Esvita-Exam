export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canScoreAnswers, forbidden } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canScoreAnswers(session)) return forbidden();

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status') || 'pending_review';
  const examIdFilter = searchParams.get('examId');

  // Build exam filter — admin can only see their supervised exams
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const examWhere: any = {};
  if (session.role === 'admin') {
    examWhere.supervisorId = session.userId;
  }
  if (examIdFilter) examWhere.id = examIdFilter;

  const dbStatus =
    statusFilter === 'all' ? { in: ['pending_review', 'completed'] } :
    statusFilter === 'reviewed' ? 'completed' :
    statusFilter; // 'pending_review'

  const sessions = await prisma.examSession.findMany({
    where: {
      isPreview: false,
      status: dbStatus,
      exam: examWhere,
    },
    include: {
      exam: {
        select: { id: true, titleEn: true, titleTr: true, titleFra: true, titleRu: true, titleIta: true },
      },
      audience: { select: { id: true, nickname: true } },
      answers: { include: { question: { select: { id: true, type: true } } } },
    },
    orderBy: { completedAt: 'desc' },
  });

  const result = sessions.map((s) => {
    const saAnswers = s.answers.filter((a) => a.question.type === 'short_answer');
    const reviewedCount = saAnswers.filter((a) => a.reviewedAt !== null).length;

    return {
      id: s.id,
      examId: s.exam.id,
      examTitle: s.exam.titleEn || s.exam.titleTr || 'Exam',
      candidateNickname: s.audience?.nickname || s.externalName || 'Unknown',
      selectedLanguage: s.selectedLanguage,
      completedAt: s.completedAt,
      status: s.status,
      score: s.score,
      totalQuestions: s.totalQuestions,
      shortAnswerTotal: saAnswers.length,
      shortAnswerReviewed: reviewedCount,
    };
  });

  return apiSuccess(result);
}

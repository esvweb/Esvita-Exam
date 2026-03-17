import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess, arrayToCSV, formatDateTime } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const examId = searchParams.get('examId');
  const format = searchParams.get('format'); // 'json' | 'csv'

  const where = {
    status: 'completed',
    ...(examId ? { examId } : {}),
  };

  const sessions = await prisma.examSession.findMany({
    where,
    include: {
      exam: {
        select: {
          titleEn: true, titleTr: true, titleFra: true, titleRu: true, titleIta: true,
        },
      },
      audience: { select: { name: true, email: true } },
    },
    orderBy: { completedAt: 'desc' },
  });

  const rows = sessions.map((s) => ({
    sessionId: s.id,
    examId: s.examId,
    candidateName: s.audience?.name || s.externalName || 'External',
    candidateEmail: s.audience?.email || s.externalEmail || '',
    examTitle: s.exam.titleEn || s.exam.titleTr || 'Exam',
    language: s.selectedLanguage,
    score: s.score ?? 0,
    correctCount: s.correctCount ?? 0,
    wrongCount: s.wrongCount ?? 0,
    skippedCount: s.skippedCount ?? 0,
    totalQuestions: s.totalQuestions ?? 0,
    timeTaken: s.timeTaken,
    completedAt: s.completedAt ? formatDateTime(s.completedAt) : '',
  }));

  if (format === 'csv') {
    const headers = [
      'Candidate Name', 'Email', 'Exam', 'Language', 'Score (%)',
      'Correct', 'Wrong', 'Skipped', 'Total Questions', 'Time Taken (s)', 'Completed At'
    ];
    const csvRows = rows.map((r) => [
      r.candidateName, r.candidateEmail, r.examTitle, r.language,
      r.score, r.correctCount, r.wrongCount, r.skippedCount,
      r.totalQuestions, r.timeTaken ?? '', r.completedAt
    ]);
    const csv = arrayToCSV(headers, csvRows);

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="esvita-exam-report-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return apiSuccess({ sessions: rows, total: rows.length });
}

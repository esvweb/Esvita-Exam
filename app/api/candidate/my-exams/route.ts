export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCandidateSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';

// GET /api/candidate/my-exams
// Returns active (published, not yet used) exam invitations for the authenticated candidate,
// plus any in-progress sessions they can resume.
export async function GET(req: NextRequest) {
  const candidate = await getCandidateSessionFromRequest(req);
  if (!candidate) return apiError('Unauthorized', 401);

  // Find their audience record to get email for invitation lookup
  const audience = await prisma.audience.findUnique({
    where: { id: candidate.audienceId },
    select: { id: true, email: true, nickname: true, preferredLanguage: true },
  });
  if (!audience) return apiError('Candidate not found', 404);

  // Find unused invitations for published/active exams
  const invitations = await prisma.examInvitation.findMany({
    where: {
      email: audience.email,
      isUsed: false,
      expiresAt: { gt: new Date() },
      exam: { status: 'published', isActive: true },
    },
    include: {
      exam: {
        select: {
          id: true,
          titleEn: true, titleTr: true, titleFra: true, titleRu: true, titleIta: true,
          descriptionEn: true, descriptionTr: true, descriptionFra: true, descriptionRu: true, descriptionIta: true,
          timePerQuestion: true, validityHours: true,
          questions: { select: { id: true } },
        },
      },
      sessions: {
        where: { audienceId: audience.id, status: 'in_progress', isPreview: false },
        select: { id: true, selectedLanguage: true, startedAt: true },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const lang = (audience.preferredLanguage || 'EN') as 'EN' | 'FRA' | 'RU' | 'TR' | 'ITA';
  const suffix = lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase();

  const activeExams = invitations.map((inv) => {
    const exam = inv.exam;
    const inProgressSession = inv.sessions[0] ?? null;
    const title =
      (exam as Record<string, unknown>)[`title${suffix}`] as string ||
      exam.titleEn ||
      'Exam';

    return {
      token: inv.uniqueToken,
      examId: exam.id,
      examTitle: title,
      totalQuestions: exam.questions.length,
      timePerQuestion: exam.timePerQuestion,
      expiresAt: inv.expiresAt.toISOString(),
      inProgressSessionId: inProgressSession?.id ?? null,
      startedAt: inProgressSession?.startedAt?.toISOString() ?? null,
    };
  });

  return apiSuccess({
    nickname: audience.nickname || candidate.name,
    activeExams,
  });
}

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest, generateOTP } from '@/lib/auth';
import { sendExamInvitation } from '@/lib/email';
import { apiError, apiSuccess, addHours } from '@/lib/utils';
import { canInvite, forbidden } from '@/lib/permissions';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * POST /api/admin/exams/[id]/assign
 * Bulk-assign an exam to: all active candidates, selected teams, or selected individuals.
 * Creates ExamInvitation records and sends emails. Sets validityStartedAt if unset.
 *
 * Body: {
 *   assignTo: 'all' | 'teams' | 'users',
 *   teamIds?: string[],
 *   audienceIds?: string[],
 * }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canInvite(session)) return forbidden('You do not have permission to assign exams');

  const exam = await prisma.exam.findUnique({ where: { id: params.id } });
  if (!exam) return apiError('Exam not found', 404);

  const { assignTo, teamIds, audienceIds } = await req.json();
  if (!assignTo) return apiError('assignTo is required (all | teams | users)');

  // Build candidate list
  let candidates: { id: string; name: string; email: string }[] = [];

  if (assignTo === 'all') {
    candidates = await prisma.audience.findMany({
      where: { isActive: true, isArchived: false },
      select: { id: true, name: true, email: true },
    });
  } else if (assignTo === 'teams') {
    if (!teamIds?.length) return apiError('teamIds are required for team assignment');
    candidates = await prisma.audience.findMany({
      where: { teamId: { in: teamIds }, isActive: true, isArchived: false },
      select: { id: true, name: true, email: true },
    });
  } else if (assignTo === 'users') {
    if (!audienceIds?.length) return apiError('audienceIds are required for user assignment');
    candidates = await prisma.audience.findMany({
      where: { id: { in: audienceIds }, isActive: true, isArchived: false },
      select: { id: true, name: true, email: true },
    });
  } else {
    return apiError('assignTo must be: all | teams | users');
  }

  if (candidates.length === 0) return apiError('No active candidates found for the selection');

  const expiresAt = addHours(new Date(), exam.validityHours);
  const examTitle = exam.titleEn || exam.titleTr || 'Exam';
  let sent = 0;
  let skipped = 0;

  // Set validityStartedAt if first assignment
  if (!exam.validityStartedAt) {
    await prisma.exam.update({
      where: { id: params.id },
      data: { validityStartedAt: new Date() },
    });
  }

  for (const candidate of candidates) {
    // Skip if active invitation already exists
    const existing = await prisma.examInvitation.findFirst({
      where: {
        examId: params.id,
        email: candidate.email,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    const otp = generateOTP();
    const invitation = await prisma.examInvitation.create({
      data: {
        examId: params.id,
        email: candidate.email,
        name: candidate.name,
        otpCode: otp,
        expiresAt,
        createdBy: session.userId,
      },
    });

    const examLink = `${APP_URL}/exam/${invitation.uniqueToken}`;

    try {
      await sendExamInvitation(candidate.email, candidate.name, examTitle, examLink, otp, expiresAt);
    } catch (err) {
      console.error(`Failed to send invite to ${candidate.email}:`, err);
    }

    sent++;
  }

  return apiSuccess({ sent, skipped, total: candidates.length });
}

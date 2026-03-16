export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canWrite, forbidden } from '@/lib/permissions';

/**
 * POST /api/admin/audiences/[id]/reset
 * Archives the current audience record (same nickname, different person) and
 * creates a new active record with the same nickname + new real name.
 * Old exam sessions are preserved under the archived record.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canWrite(session)) return forbidden();

  const { newRealName, newEmail } = await req.json();
  if (!newRealName) return apiError('New real name is required for reset');
  if (!newEmail)    return apiError('New email is required for reset');

  const old = await prisma.audience.findUnique({ where: { id: params.id } });
  if (!old) return apiError('Candidate not found', 404);
  if (old.isArchived) return apiError('This candidate is already archived');

  // Check new email doesn't clash with an active record
  const emailConflict = await prisma.audience.findUnique({
    where: { email: newEmail.toLowerCase().trim() },
  });
  if (emailConflict && emailConflict.id !== params.id) {
    return apiError('The new email is already in use by another candidate');
  }

  // Archive the old record
  await prisma.audience.update({
    where: { id: params.id },
    data: { isArchived: true, isActive: false },
  });

  // Create a new active record with the same nickname
  const newAudience = await prisma.audience.create({
    data: {
      name: old.nickname || old.name, // display name = nickname
      email: newEmail.toLowerCase().trim(),
      nickname: old.nickname,
      realName: newRealName.trim(),
      preferredLanguage: old.preferredLanguage,
      teamId: old.teamId,
      isActive: true,
      isArchived: false,
    },
    include: {
      _count: { select: { examSessions: true } },
      team: { select: { id: true, name: true, color: true } },
    },
  });

  return apiSuccess({ newAudienceId: newAudience.id, archived: params.id, newAudience }, 201);
}

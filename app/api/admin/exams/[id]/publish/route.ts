import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canPublishExam, forbidden } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';

// POST /api/admin/exams/[id]/publish
// Body: { action: "publish" | "unpublish" }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canPublishExam(session)) return forbidden();

  const { action } = await req.json();
  const exam = await prisma.exam.findUnique({ where: { id: params.id } });
  if (!exam) return apiError('Exam not found', 404);

  if (action === 'publish') {
    const updated = await prisma.exam.update({
      where: { id: params.id },
      data: { status: 'published', isActive: true, scheduledPublishAt: null },
    });
    await logAudit(session, 'publish', 'exam', params.id);
    return apiSuccess(updated);
  }

  if (action === 'unpublish') {
    // Cannot unpublish if sessions already exist
    const sessionCount = await prisma.examSession.count({
      where: { examId: params.id, isPreview: false },
    });
    if (sessionCount > 0) {
      return apiError('Cannot unpublish an exam that already has candidate sessions');
    }
    const updated = await prisma.exam.update({
      where: { id: params.id },
      data: { status: 'draft', isActive: false },
    });
    await logAudit(session, 'unpublish', 'exam', params.id);
    return apiSuccess(updated);
  }

  return apiError('Invalid action. Use "publish" or "unpublish"');
}

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiSuccess, getAvailableLanguages, isExpired } from '@/lib/utils';

// GET: Verify token and get exam info (for language selection page)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) return apiError('Token is required');

  // Check if this is an audience member (token is audienceId:examId format) or external invite
  const invitation = await prisma.examInvitation.findUnique({
    where: { uniqueToken: token },
    include: {
      exam: {
        include: { questions: { select: { id: true }, orderBy: { orderIndex: 'asc' } } },
      },
    },
  });

  if (!invitation) return apiError('Invalid or expired exam link', 404);
  if (invitation.isUsed) return apiError('This exam link has already been used', 410);
  if (isExpired(invitation.expiresAt)) return apiError('This invitation has expired. Please contact your administrator.', 410);

  const exam = invitation.exam;
  const availLangs = getAvailableLanguages(exam as Record<string, unknown>);

  return apiSuccess({
    invitationId: invitation.id,
    examId: exam.id,
    examTitle: exam.titleEn || exam.titleTr || exam.titleFra || 'Exam',
    availableLanguages: availLangs,
    totalQuestions: exam.questions.length,
    timePerQuestion: exam.timePerQuestion,
    candidateName: invitation.name,
    candidateEmail: invitation.email,
    type: 'invitation',
  });
}

// POST: Verify OTP for external invite
export async function POST(req: NextRequest) {
  const { token, otp } = await req.json();

  if (!token || !otp) return apiError('Token and OTP are required');

  const invitation = await prisma.examInvitation.findUnique({
    where: { uniqueToken: token },
  });

  if (!invitation) return apiError('Invalid exam link', 404);
  if (invitation.isUsed) return apiError('This exam link has already been used', 410);
  if (isExpired(invitation.expiresAt)) return apiError('This invitation has expired', 410);
  if (invitation.otpCode !== otp.trim()) return apiError('Invalid OTP code. Please check your email.', 401);

  return apiSuccess({ verified: true, invitationId: invitation.id });
}

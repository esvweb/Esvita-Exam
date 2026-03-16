export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { generateOTP } from '@/lib/auth';
import { sendExamInvitation } from '@/lib/email';
import { apiError, apiSuccess, addHours } from '@/lib/utils';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const INVITE_EXPIRY_HOURS = parseInt(process.env.INVITE_EXPIRY_HOURS || '72');

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);

  const { email, name } = await req.json();
  if (!email || !name) return apiError('Email and name are required');

  const exam = await prisma.exam.findUnique({ where: { id: params.id } });
  if (!exam) return apiError('Exam not found', 404);

  // Check for existing active invitation
  const existingInvite = await prisma.examInvitation.findFirst({
    where: {
      examId: params.id,
      email: email.toLowerCase(),
      isUsed: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (existingInvite) {
    return apiError('An active invitation already exists for this email. Wait for it to expire or use a new email.');
  }

  const expiresAt = addHours(new Date(), INVITE_EXPIRY_HOURS);
  const otp = generateOTP();

  const invitation = await prisma.examInvitation.create({
    data: {
      examId: params.id,
      email: email.toLowerCase().trim(),
      name: name.trim(),
      otpCode: otp,
      expiresAt,
      createdBy: session.userId,
    },
  });

  // Set validityStartedAt on exam if not already started
  if (!exam.validityStartedAt) {
    await prisma.exam.update({
      where: { id: params.id },
      data: { validityStartedAt: new Date() },
    });
  }

  const examLink = `${APP_URL}/exam/${invitation.uniqueToken}`;
  const examTitle = exam.titleEn || exam.titleTr || 'Exam';

  // Send invitation email
  try {
    await sendExamInvitation(email.toLowerCase(), name, examTitle, examLink, otp, expiresAt);
  } catch (emailError) {
    console.error('Failed to send invitation email:', emailError);
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n📧 DEV INVITE for ${email}:\n  Link: ${examLink}\n  OTP: ${otp}\n`);
    }
  }

  return apiSuccess({
    invitationId: invitation.id,
    examLink,
    expiresAt: expiresAt.toISOString(),
    email: email.toLowerCase(),
  }, 201);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);

  const invitations = await prisma.examInvitation.findMany({
    where: { examId: params.id },
    orderBy: { createdAt: 'desc' },
  });
  return apiSuccess(invitations);
}

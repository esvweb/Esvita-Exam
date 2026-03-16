export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { createCandidateSession, setCandidateSessionCookie } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';

/**
 * POST /api/candidate/verify-otp
 * Verifies the OTP and sets a 24-hour candidate session cookie.
 */
export async function POST(req: NextRequest) {
  const { email, otp } = await req.json();
  if (!email || !otp) return apiError('Email and OTP are required');

  const otpRecord = await prisma.candidateOtpSession.findFirst({
    where: {
      email: email.toLowerCase().trim(),
      otpCode: otp.trim(),
      isUsed: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRecord) return apiError('Invalid or expired code. Please request a new one.', 401);

  // Mark OTP as used
  await prisma.candidateOtpSession.update({
    where: { id: otpRecord.id },
    data: { isUsed: true },
  });

  // Find the audience record
  const candidate = await prisma.audience.findFirst({
    where: { email: email.toLowerCase().trim(), isArchived: false },
  });

  if (!candidate) return apiError('Candidate account not found.', 404);

  // Create candidate JWT and set cookie
  const token = await createCandidateSession({
    type: 'candidate',
    audienceId: candidate.id,
    email: candidate.email,
    name: candidate.name,
  });

  setCandidateSessionCookie(token);

  return apiSuccess({ verified: true, name: candidate.name });
}

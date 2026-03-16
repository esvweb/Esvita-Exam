export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { generateOTP } from '@/lib/auth';
import { sendCandidateOTP } from '@/lib/email';
import { apiError, apiSuccess } from '@/lib/utils';

/**
 * POST /api/candidate/request-otp
 * Sends a one-time code to the candidate's email so they can view their results.
 */
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return apiError('Email is required');

  const candidate = await prisma.audience.findFirst({
    where: {
      email: email.toLowerCase().trim(),
      isArchived: false,
    },
  });

  if (!candidate) {
    // Return generic message to avoid email enumeration
    return apiSuccess({ message: 'If this email is registered, a code has been sent.' });
  }

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Invalidate any previous unused OTPs for this email
  await prisma.candidateOtpSession.updateMany({
    where: { email: email.toLowerCase(), isUsed: false },
    data: { isUsed: true },
  });

  await prisma.candidateOtpSession.create({
    data: {
      email: email.toLowerCase().trim(),
      otpCode: otp,
      expiresAt,
    },
  });

  try {
    await sendCandidateOTP(email.toLowerCase(), candidate.name, otp);
  } catch (err) {
    console.error('Failed to send candidate OTP:', err);
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n🔑 DEV CANDIDATE OTP for ${email}: ${otp}\n`);
    }
  }

  return apiSuccess({ message: 'If this email is registered, a code has been sent.' });
}

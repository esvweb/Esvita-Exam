import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession, setSessionCookie } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return apiError('Email and OTP are required');
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find valid OTP session
    const otpSession = await prisma.otpSession.findFirst({
      where: {
        email: normalizedEmail,
        otpCode: otp.trim(),
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpSession) {
      return apiError('Invalid or expired verification code. Please request a new one.', 401);
    }

    // Mark OTP as used
    await prisma.otpSession.update({
      where: { id: otpSession.id },
      data: { isUsed: true },
    });

    // Fetch user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.isActive) {
      return apiError('Account not found or deactivated', 403);
    }

    // Create JWT session
    const token = await createSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    setSessionCookie(token);

    return apiSuccess({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error('verify-otp error:', error);
    return apiError('Internal server error', 500);
  }
}

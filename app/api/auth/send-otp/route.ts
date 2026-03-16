import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { generateOTP, isAllowedDomain } from '@/lib/auth';
import { sendAdminOTP } from '@/lib/email';
import { apiError, apiSuccess } from '@/lib/utils';
import { addHours } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return apiError('Email is required');
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Domain check
    if (!isAllowedDomain(normalizedEmail)) {
      return apiError(
        'Access denied. Only @esvitaclinic.com and @esvita.clinic email addresses are allowed.',
        403
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return apiError('No admin account found for this email address. Contact your system administrator.', 404);
    }

    if (!user.isActive) {
      return apiError('Your account has been deactivated. Contact your system administrator.', 403);
    }

    // Invalidate previous unused OTPs for this email
    await prisma.otpSession.updateMany({
      where: { email: normalizedEmail, isUsed: false },
      data: { isUsed: true },
    });

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = addHours(new Date(), 10 / 60); // 10 minutes

    await prisma.otpSession.create({
      data: {
        email: normalizedEmail,
        otpCode: otp,
        expiresAt,
      },
    });

    // Send email (silently fail in dev if not configured)
    try {
      await sendAdminOTP(normalizedEmail, user.name, otp);
    } catch (emailError) {
      console.error('Email send failed:', emailError);
      // In development, log OTP to console
      if (process.env.NODE_ENV === 'development') {
        console.log(`\n🔑 DEV OTP for ${normalizedEmail}: ${otp}\n`);
      }
    }

    return apiSuccess({ message: 'OTP sent successfully', email: normalizedEmail });
  } catch (error) {
    console.error('send-otp error:', error);
    return apiError('Internal server error', 500);
  }
}

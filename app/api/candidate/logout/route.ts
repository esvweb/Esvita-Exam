import { NextRequest } from 'next/server';
import { clearCandidateSessionCookie } from '@/lib/auth';
import { apiSuccess } from '@/lib/utils';

export async function POST(_req: NextRequest) {
  clearCandidateSessionCookie();
  return apiSuccess({ loggedOut: true });
}

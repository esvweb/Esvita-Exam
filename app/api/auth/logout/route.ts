import { clearSessionCookie } from '@/lib/auth';
import { apiSuccess } from '@/lib/utils';

export async function POST() {
  clearSessionCookie();
  return apiSuccess({ message: 'Logged out successfully' });
}

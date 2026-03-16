import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production-please'
);

const COOKIE_NAME = 'esvita_session';

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
  teamId?: string; // for team_leader role
}

// Candidate (exam taker) session — separate from admin session
export interface CandidateSessionPayload {
  type: 'candidate';
  audienceId: string;
  email: string;
  name: string;
}

const CANDIDATE_COOKIE = 'esvita_candidate';

export async function createSession(payload: SessionPayload): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);
  return token;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getServerSession(): Promise<SessionPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE_NAME);
}

// ── Candidate session (exam takers seeing their results) ─────────────────────

export async function createCandidateSession(payload: CandidateSessionPayload): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(SECRET);
  return token;
}

export async function getCandidateSessionFromRequest(
  req: NextRequest
): Promise<CandidateSessionPayload | null> {
  const token = req.cookies.get(CANDIDATE_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.type !== 'candidate') return null;
    return payload as unknown as CandidateSessionPayload;
  } catch {
    return null;
  }
}

export function setCandidateSessionCookie(token: string) {
  cookies().set(CANDIDATE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });
}

export function clearCandidateSessionCookie() {
  cookies().delete(CANDIDATE_COOKIE);
}

// OTP generation
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Domain validation
export function isAllowedDomain(email: string): boolean {
  const allowedDomains = (process.env.ALLOWED_DOMAINS || 'esvitaclinic.com,esvita.clinic')
    .split(',')
    .map((d) => d.trim().toLowerCase());
  const domain = email.split('@')[1]?.toLowerCase();
  return allowedDomains.includes(domain);
}

// Invite token for external users
export async function createInviteToken(inviteId: string, email: string): Promise<string> {
  const token = await new SignJWT({ inviteId, email, type: 'exam_invite' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('72h')
    .sign(SECRET);
  return token;
}

export async function verifyInviteToken(token: string): Promise<{ inviteId: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.type !== 'exam_invite') return null;
    return { inviteId: payload.inviteId as string, email: payload.email as string };
  } catch {
    return null;
  }
}

import type { SessionPayload } from './auth';

// Role hierarchy:
// super_admin > admin > moderator > team_leader > staff

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  moderator: 'Moderator',
  team_leader: 'Team Leader',
  staff: 'Staff',
};

export const ROLE_COLORS: Record<string, string> = {
  super_admin: 'badge-blue',
  admin: 'badge-purple',
  moderator: 'badge-green',
  team_leader: 'badge-amber',
  staff: 'badge-gray',
};

/** Can create / edit records */
export function canWrite(session: SessionPayload): boolean {
  return ['super_admin', 'admin', 'moderator'].includes(session.role);
}

/** Can delete records */
export function canDelete(session: SessionPayload): boolean {
  return ['super_admin', 'admin'].includes(session.role);
}

/** Can manage user accounts */
export function canManageUsers(session: SessionPayload): boolean {
  return session.role === 'super_admin';
}

/** Can invite / send exams to candidates */
export function canInvite(session: SessionPayload): boolean {
  return ['super_admin', 'admin', 'moderator'].includes(session.role);
}

/** Read-only role (no write access at all) */
export function isReadOnly(session: SessionPayload): boolean {
  return session.role === 'staff';
}

/** Team leader — can only view their own team results */
export function isTeamLeader(session: SessionPayload): boolean {
  return session.role === 'team_leader';
}

/** Can access admin management areas (not team_leader or staff) */
export function isManager(session: SessionPayload): boolean {
  return ['super_admin', 'admin', 'moderator'].includes(session.role);
}

/** Returns a 403 JSON response */
export function forbidden(message = 'Insufficient permissions') {
  return Response.json({ error: message }, { status: 403 });
}

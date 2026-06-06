import type { SessionPayload } from './auth';

// Role hierarchy: super_admin > admin > moderator > team_leader > staff
// training_supervisor role has been removed.

export const ROLES = ['super_admin', 'admin', 'moderator', 'team_leader', 'staff'] as const;
export type Role = (typeof ROLES)[number];

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

// ── USER MANAGEMENT ───────────────────────────────────────────────────────────

/** Create / edit / delete admin users */
export function canManageUsers(s: SessionPayload) {
  return s.role === 'super_admin';
}

/** Assign roles to users */
export function canAssignRoles(s: SessionPayload) {
  return s.role === 'super_admin' || s.role === 'admin';
}

/** View all users list */
export function canViewUsers(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator'].includes(s.role);
}

/** Super-admin-only: view email delivery logs */
export function canViewEmailLogs(s: SessionPayload) {
  return s.role === 'super_admin' || s.role === 'admin';
}

// ── CANDIDATE MANAGEMENT ──────────────────────────────────────────────────────

/** Create / edit candidates */
export function canManageCandidates(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator'].includes(s.role);
}

/** Bulk CSV import */
export function canBulkImportCandidates(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator'].includes(s.role);
}

/** Archive / reset candidate */
export function canArchiveCandidate(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator'].includes(s.role);
}

// ── TEAM MANAGEMENT ───────────────────────────────────────────────────────────

/** Create / edit / delete teams */
export function canManageTeams(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator'].includes(s.role);
}

/** Assign candidates to teams (team_leader = own team only, enforced in handler) */
export function canAssignToTeams(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator', 'team_leader'].includes(s.role);
}

// ── EXAM MANAGEMENT ───────────────────────────────────────────────────────────

/** Create new exam */
export function canCreateExam(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator'].includes(s.role);
}

/** Edit a draft exam */
export function canEditDraftExam(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator'].includes(s.role);
}

/** Edit a published / live exam */
export function canEditLiveExam(s: SessionPayload) {
  return s.role === 'super_admin' || s.role === 'admin';
}

/** Delete exam */
export function canDeleteExam(s: SessionPayload) {
  return s.role === 'super_admin' || s.role === 'admin';
}

/** Duplicate exam */
export function canDuplicateExam(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator'].includes(s.role);
}

/** Publish / unpublish exam */
export function canPublishExam(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator'].includes(s.role);
}

/** Assign supervisor to exam */
export function canAssignSupervisor(s: SessionPayload) {
  return s.role === 'super_admin' || s.role === 'admin';
}

/** Set result announcement date */
export function canSetAnnouncementDate(s: SessionPayload) {
  return s.role === 'super_admin' || s.role === 'admin';
}

/** Set per-exam pass mark */
export function canSetPassMark(s: SessionPayload) {
  return s.role === 'super_admin' || s.role === 'admin';
}

/** Apply categories and tags */
export function canApplyCategories(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator'].includes(s.role);
}

/** Preview exam as candidate (no DB save) */
export function canPreviewExam(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator'].includes(s.role);
}

/** Bulk assign / individual invite */
export function canInvite(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator'].includes(s.role);
}

/** Resend OTP / invite */
export function canResendInvite(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator'].includes(s.role);
}

/** Manually release results early */
export function canReleaseResults(s: SessionPayload) {
  return s.role === 'super_admin' || s.role === 'admin';
}

// ── QUESTION BANK ─────────────────────────────────────────────────────────────

export function canViewQuestionBank(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator'].includes(s.role);
}

export function canEditQuestionBank(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator'].includes(s.role);
}

export function canDeleteFromQuestionBank(s: SessionPayload) {
  return s.role === 'super_admin' || s.role === 'admin';
}

export function canImportFromBank(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator'].includes(s.role);
}

// ── RESULTS & REVIEW ─────────────────────────────────────────────────────────

/**
 * Score SA questions:
 * - super_admin: any exam
 * - admin: only exams where they are the assigned supervisor
 * Enforced in the handler by checking exam.supervisorId === userId for admin role.
 */
export function canScoreAnswers(s: SessionPayload) {
  return s.role === 'super_admin' || s.role === 'admin';
}

/** Override an existing SA score — super_admin only */
export function canOverrideScore(s: SessionPayload) {
  return s.role === 'super_admin';
}

/** Accept or revise AI score suggestion (same gate as scoring) */
export function canReviewAiScore(s: SessionPayload) {
  return s.role === 'super_admin' || s.role === 'admin';
}

// ── REPORTS & ANALYTICS ───────────────────────────────────────────────────────

export function canViewAllReports(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator'].includes(s.role);
}

export function canViewPerQuestionAnalysis(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator'].includes(s.role);
}

export function canViewLongitudinal(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator', 'team_leader'].includes(s.role);
}

export function canViewTeamComparison(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator', 'team_leader'].includes(s.role);
}

export function canViewTeamAnalytics(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator', 'team_leader'].includes(s.role);
}

/** Export PDF/CSV — team_leader limited to own team data */
export function canExportReports(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator', 'team_leader'].includes(s.role);
}

// ── CONVENIENCE HELPERS ───────────────────────────────────────────────────────

/** Any write-capable role */
export function canWrite(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator'].includes(s.role);
}

/** Any delete-capable role */
export function canDelete(s: SessionPayload) {
  return s.role === 'super_admin' || s.role === 'admin';
}

/** Manager-level (not team_leader or staff) */
export function isManager(s: SessionPayload) {
  return ['super_admin', 'admin', 'moderator'].includes(s.role);
}

export function isTeamLeader(s: SessionPayload) {
  return s.role === 'team_leader';
}

export function isStaff(s: SessionPayload) {
  return s.role === 'staff';
}

/** Returns a 403 JSON response */
export function forbidden(message = 'Insufficient permissions') {
  return Response.json({ error: message }, { status: 403 });
}

import { prisma } from './db';
import type { SessionPayload } from './auth';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'publish'
  | 'unpublish'
  | 'assign'
  | 'release'
  | 'duplicate'
  | 'archive'
  | 'reset'
  | 'import'
  | 'invite';

export type AuditEntity =
  | 'exam'
  | 'question'
  | 'question_bank'
  | 'audience'
  | 'user'
  | 'team'
  | 'exam_session'
  | 'exam_answer';

export async function logAudit(
  session: SessionPayload,
  action: AuditAction,
  entity: AuditEntity,
  entityId?: string,
  changes?: Record<string, unknown>
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        userEmail: session.email,
        userRole: session.role,
        action,
        entity,
        entityId,
        changes: changes ? JSON.stringify(changes) : undefined,
      },
    });
  } catch {
    // Audit logging must never break the main operation
  }
}

import { prisma } from './db';

export type NotificationType =
  | 'review_needed'
  | 'deadline_reminder'
  | 'results_released'
  | 'exam_assigned';

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
) {
  try {
    await prisma.notification.create({
      data: { userId, type, title, message, link },
    });
  } catch {
    // Notification creation must never break the main operation
  }
}

export async function notifySupervisorNewSession(
  supervisorId: string,
  examTitle: string,
  sessionId: string
) {
  await createNotification(
    supervisorId,
    'review_needed',
    'New answer to review',
    `A candidate has completed "${examTitle}" and has short-answer questions awaiting your review.`,
    `/admin/review/${sessionId}`
  );
}

export async function notifySupervisorDeadline(
  supervisorId: string,
  examTitle: string,
  examId: string
) {
  await createNotification(
    supervisorId,
    'deadline_reminder',
    'Review deadline tomorrow',
    `The result announcement date for "${examTitle}" is in 24 hours. Please complete your review.`,
    `/admin/review?examId=${examId}`
  );
}

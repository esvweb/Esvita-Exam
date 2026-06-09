import nodemailer from 'nodemailer';
import { prisma } from './db';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

const FROM = process.env.SMTP_FROM || 'Esvita Academy <no-reply@esvitaclinic.com>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// ── Logged send helper ────────────────────────────────────────────────────────

interface LogMeta {
  type: string;
  audienceId?: string;
  examId?: string;
  sessionId?: string;
}

async function send(
  to: string,
  subject: string,
  html: string,
  meta: LogMeta
): Promise<void> {
  let status = 'sent';
  let error: string | undefined;

  try {
    await getTransporter().sendMail({ from: FROM, to, subject, html });
  } catch (err) {
    status = 'failed';
    error = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    try {
      await prisma.emailLog.create({
        data: {
          to,
          subject,
          type: meta.type,
          status,
          error,
          audienceId: meta.audienceId,
          examId: meta.examId,
          sessionId: meta.sessionId,
        },
      });
    } catch {
      // log failure must not mask the original error
    }
  }
}

// ─── Send OTP for Admin Login ─────────────────────────────────────────────────

export async function sendAdminOTP(email: string, name: string, otp: string) {
  const html = `
    <!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      body{font-family:'Inter',Arial,sans-serif;background:#f8fafc;margin:0;padding:20px}
      .c{max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.07)}
      .h{background:linear-gradient(135deg,#0052CC,#0066FF);padding:32px;text-align:center}
      .h h1{color:#fff;margin:0;font-size:22px;font-weight:700}
      .h p{color:rgba(255,255,255,.85);margin:8px 0 0;font-size:14px}
      .b{padding:32px}
      .otp{background:#f0f7ff;border:2px dashed #0052CC;border-radius:10px;text-align:center;padding:24px;margin:24px 0}
      .code{font-size:42px;font-weight:800;color:#0052CC;letter-spacing:10px;font-family:monospace}
      .note{font-size:12px;color:#94a3b8;margin-top:8px}
      .f{background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8}
    </style></head><body>
    <div class="c">
      <div class="h"><h1>Esvita Academy</h1><p>Admin Login Verification</p></div>
      <div class="b">
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your one-time login code is:</p>
        <div class="otp"><div class="code">${otp}</div><div class="note">Valid for 10 minutes</div></div>
        <p style="color:#64748b;font-size:14px">If you did not request this code, please ignore this email.</p>
      </div>
      <div class="f">&copy; ${new Date().getFullYear()} Esvita Clinic &bull; Secure Exam Management System</div>
    </div></body></html>`;

  await send(email, `[Esvita Academy] Your Login Code: ${otp}`, html, { type: 'otp' });
}

// ─── Send Exam Invitation ─────────────────────────────────────────────────────

export async function sendExamInvitation(
  email: string,
  name: string,
  examTitle: string,
  examLink: string,
  otp: string,
  expiresAt: Date,
  meta?: { audienceId?: string; examId?: string }
) {
  const expiry = expiresAt.toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });

  const html = `
    <!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      body{font-family:'Inter',Arial,sans-serif;background:#f8fafc;margin:0;padding:20px}
      .c{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.07)}
      .h{background:linear-gradient(135deg,#0052CC,#0066FF);padding:32px;text-align:center}
      .h h1{color:#fff;margin:0;font-size:22px;font-weight:700}
      .b{padding:32px}
      .exam{background:#f0f7ff;border-left:4px solid #0052CC;border-radius:6px;padding:16px 20px;margin:20px 0}
      .etitle{font-weight:700;color:#0052CC;font-size:16px}
      .otp{background:#fef9c3;border:2px dashed #ca8a04;border-radius:10px;text-align:center;padding:20px;margin:20px 0}
      .code{font-size:36px;font-weight:800;color:#92400e;letter-spacing:8px;font-family:monospace}
      .btn{display:inline-block;background:#0052CC;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:20px 0}
      .warn{background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:12px 16px;font-size:13px;color:#9a3412;margin-top:20px}
      .f{background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8}
    </style></head><body>
    <div class="c">
      <div class="h"><h1>Esvita Academy</h1></div>
      <div class="b">
        <p>Dear <strong>${name}</strong>,</p>
        <p>You have been invited to participate in the following assessment:</p>
        <div class="exam"><div class="etitle">${examTitle}</div></div>
        <div style="text-align:center"><a href="${examLink}" class="btn" style="color:#ffffff;text-decoration:none">Start My Exam</a></div>
        <div class="otp">
          <p style="margin:0 0 8px;font-size:14px;color:#78716c">Your verification code:</p>
          <div class="code">${otp}</div>
          <p style="margin:8px 0 0;font-size:12px;color:#a16207">Enter this code when prompted</p>
        </div>
        <div class="warn"><strong>Important:</strong> This invitation expires on <strong>${expiry} UTC</strong>.</div>
      </div>
      <div class="f">&copy; ${new Date().getFullYear()} Esvita Clinic &bull; Secure Exam Management System</div>
    </div></body></html>`;

  await send(email, `[Esvita Academy] Invitation: ${examTitle}`, html, {
    type: 'invitation',
    audienceId: meta?.audienceId,
    examId: meta?.examId,
  });
}

// ─── Exam Assignment Notification (no OTP — for existing candidates) ──────────

export async function sendExamAssignment(
  email: string,
  nickname: string,
  examTitle: string,
  examLink: string,
  expiresAt: Date,
  meta?: { audienceId?: string; examId?: string }
) {
  const expiry = expiresAt.toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });

  const html = `
    <!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      body{font-family:'Inter',Arial,sans-serif;background:#f8fafc;margin:0;padding:20px}
      .c{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.07)}
      .h{background:linear-gradient(135deg,#0052CC,#0066FF);padding:32px;text-align:center}
      .h h1{color:#fff;margin:0;font-size:22px;font-weight:700}
      .b{padding:32px}
      .exam{background:#f0f7ff;border-left:4px solid #0052CC;border-radius:6px;padding:16px 20px;margin:20px 0}
      .etitle{font-weight:700;color:#0052CC;font-size:16px}
      .btn{display:inline-block;background:#0052CC;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:20px 0}
      .deadline{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:20px 0;text-align:center}
      .f{background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8}
    </style></head><body>
    <div class="c">
      <div class="h"><h1>Esvita Academy</h1><p style="color:rgba(255,255,255,.85);margin:8px 0 0">New Exam Assigned</p></div>
      <div class="b">
        <p>Dear <strong>${nickname}</strong>,</p>
        <p>A new exam has been assigned to you:</p>
        <div class="exam"><div class="etitle">${examTitle}</div></div>
        <div style="text-align:center"><a href="${examLink}" class="btn" style="color:#ffffff;text-decoration:none">Take My Exam</a></div>
        <div class="deadline">
          <div style="font-size:12px;color:#64748b;margin-bottom:6px">Complete by</div>
          <div style="font-size:16px;font-weight:700;color:#1e40af">${expiry} UTC</div>
        </div>
        <p style="font-size:13px;color:#94a3b8">Log in to your portal to see all your assigned exams.</p>
      </div>
      <div class="f">&copy; ${new Date().getFullYear()} Esvita Clinic &bull; Secure Exam Management System</div>
    </div></body></html>`;

  await send(email, `[Esvita Academy] New Exam Assigned: ${examTitle}`, html, {
    type: 'assignment',
    audienceId: meta?.audienceId,
    examId: meta?.examId,
  });
}

// ─── Supervisor Deadline Reminder ─────────────────────────────────────────────

export async function sendSupervisorReminder(
  email: string,
  supervisorName: string,
  examTitle: string,
  announcementDate: Date,
  pendingCount: number,
  reviewLink: string,
  meta?: { examId?: string }
) {
  const dateStr = announcementDate.toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });

  const html = `
    <!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      body{font-family:'Inter',Arial,sans-serif;background:#f8fafc;margin:0;padding:20px}
      .c{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.07)}
      .h{background:linear-gradient(135deg,#dc2626,#ef4444);padding:32px;text-align:center}
      .h h1{color:#fff;margin:0;font-size:22px;font-weight:700}
      .b{padding:32px}
      .alert{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:20px 0;text-align:center}
      .btn{display:inline-block;background:#dc2626;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:20px 0}
      .f{background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8}
    </style></head><body>
    <div class="c">
      <div class="h"><h1>Review Deadline Tomorrow</h1></div>
      <div class="b">
        <p>Dear <strong>${supervisorName}</strong>,</p>
        <p>You have <strong>${pendingCount} pending short-answer response(s)</strong> to review for:</p>
        <p style="font-weight:700;color:#0052CC;font-size:16px">${examTitle}</p>
        <div class="alert">
          <div style="font-size:12px;color:#991b1b;margin-bottom:6px">Result announcement deadline</div>
          <div style="font-size:16px;font-weight:700;color:#dc2626">${dateStr} UTC</div>
        </div>
        <p>Please complete your review before the deadline so results can be released on time.</p>
        <div style="text-align:center"><a href="${reviewLink}" class="btn" style="color:#ffffff;text-decoration:none">Go to Review</a></div>
      </div>
      <div class="f">&copy; ${new Date().getFullYear()} Esvita Clinic &bull; Secure Exam Management System</div>
    </div></body></html>`;

  await send(email, `[Esvita Academy] Review Deadline Tomorrow: ${examTitle}`, html, {
    type: 'supervisor_reminder',
    examId: meta?.examId,
  });
}

// ─── Pre-Deadline Candidate Reminder (not yet started) ───────────────────────

export async function sendCandidateDeadlineReminder(
  email: string,
  nickname: string,
  examTitle: string,
  examLink: string,
  deadline: Date,
  meta?: { audienceId?: string; examId?: string }
) {
  const deadlineStr = deadline.toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });

  const html = `
    <!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      body{font-family:'Inter',Arial,sans-serif;background:#f8fafc;margin:0;padding:20px}
      .c{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.07)}
      .h{background:linear-gradient(135deg,#ca8a04,#eab308);padding:32px;text-align:center}
      .h h1{color:#fff;margin:0;font-size:22px;font-weight:700}
      .b{padding:32px}
      .alert{background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:20px 0;text-align:center}
      .btn{display:inline-block;background:#ca8a04;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:20px 0}
      .f{background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8}
    </style></head><body>
    <div class="c">
      <div class="h"><h1>Exam Deadline Reminder</h1></div>
      <div class="b">
        <p>Dear <strong>${nickname}</strong>,</p>
        <p>You have not yet started your assigned exam:</p>
        <p style="font-weight:700;color:#0052CC;font-size:16px">${examTitle}</p>
        <div class="alert">
          <div style="font-size:12px;color:#92400e;margin-bottom:6px">Deadline — 24 hours remaining</div>
          <div style="font-size:16px;font-weight:700;color:#ca8a04">${deadlineStr} UTC</div>
        </div>
        <p>Please start and complete your exam before the deadline.</p>
        <div style="text-align:center"><a href="${examLink}" class="btn" style="color:#ffffff;text-decoration:none">Start Exam Now</a></div>
      </div>
      <div class="f">&copy; ${new Date().getFullYear()} Esvita Clinic &bull; Secure Exam Management System</div>
    </div></body></html>`;

  await send(email, `[Esvita Academy] Reminder: ${examTitle} closes in 24 hours`, html, {
    type: 'reminder',
    audienceId: meta?.audienceId,
    examId: meta?.examId,
  });
}

// ─── Exam Completion Confirmation ─────────────────────────────────────────────

export async function sendCompletionConfirmation(
  email: string,
  nickname: string,
  examTitle: string,
  resultsDate: Date,
  meta?: { audienceId?: string; examId?: string; sessionId?: string }
) {
  const resultsDateStr = resultsDate.toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });

  const html = `
    <!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      body{font-family:'Inter',Arial,sans-serif;background:#f8fafc;margin:0;padding:20px}
      .c{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.07)}
      .h{background:linear-gradient(135deg,#059669,#10b981);padding:32px;text-align:center}
      .h h1{color:#fff;margin:0;font-size:22px;font-weight:700}
      .b{padding:32px}
      .exam{background:#f0fdf4;border-left:4px solid #059669;border-radius:6px;padding:16px 20px;margin:20px 0}
      .etitle{font-weight:700;color:#059669;font-size:16px}
      .date{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:20px 0;text-align:center}
      .portal{background:#f8fafc;border-radius:8px;padding:16px;margin:20px 0;text-align:center}
      .f{background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8}
    </style></head><body>
    <div class="c">
      <div class="h"><h1>Esvita Academy</h1><p style="color:rgba(255,255,255,.9);margin:8px 0 0">Exam Completed Successfully</p></div>
      <div class="b">
        <div style="font-size:64px;text-align:center;margin:16px 0">✅</div>
        <p>Dear <strong>${nickname}</strong>,</p>
        <p>You have successfully completed:</p>
        <div class="exam"><div class="etitle">${examTitle}</div></div>
        <p style="color:#64748b">Your answers have been recorded. Results will be shared with all participants simultaneously once the exam session closes.</p>
        <div class="date">
          <div style="font-size:12px;color:#64748b;margin-bottom:6px">Results will be available on</div>
          <div style="font-size:16px;font-weight:700;color:#1e40af">${resultsDateStr} UTC</div>
        </div>
        <div class="portal">
          <p style="margin:0 0 8px;font-size:13px;color:#64748b">Check your results after release at:</p>
          <a href="${APP_URL}/results" style="color:#0052CC;font-weight:600;font-size:14px">${APP_URL}/results</a>
        </div>
      </div>
      <div class="f">&copy; ${new Date().getFullYear()} Esvita Clinic &bull; Secure Exam Management System</div>
    </div></body></html>`;

  await send(email, `[Esvita Academy] Completed: ${examTitle} — Results pending`, html, {
    type: 'completion',
    audienceId: meta?.audienceId,
    examId: meta?.examId,
    sessionId: meta?.sessionId,
  });
}

// ─── Exam Result Email ────────────────────────────────────────────────────────

export interface ExamResultData {
  candidateNickname: string;
  candidateEmail: string;
  examTitle: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  passMarkPercent: number;
  language: string;
  wrongAnswers: Array<{
    questionText: string;
    selectedAnswer: string;
    correctAnswer: string;
    explanation: string;
  }>;
  audienceId?: string;
  examId?: string;
  sessionId?: string;
}

export async function sendExamResult(data: ExamResultData) {
  const passed = data.score >= data.passMarkPercent;
  const scoreColor = data.score >= 80 ? '#16a34a' : data.score >= 60 ? '#ca8a04' : '#dc2626';
  const scoreLabel = data.score >= 80 ? 'Excellent' : data.score >= 60 ? 'Satisfactory' : 'Needs Improvement';

  const wrongAnswersHtml = data.wrongAnswers.length === 0
    ? '<p style="color:#16a34a;font-weight:600">Perfect score! All answers were correct.</p>'
    : data.wrongAnswers.map((wa, i) => `
        <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:6px;padding:16px;margin-bottom:12px">
          <p style="margin:0 0 8px;font-weight:600;color:#1e293b;font-size:14px">Q${i + 1}: ${wa.questionText}</p>
          <p style="margin:0 0 4px;font-size:13px;color:#dc2626">Your answer: <strong>${wa.selectedAnswer || 'Not answered'}</strong></p>
          <p style="margin:0 0 8px;font-size:13px;color:#16a34a">Correct answer: <strong>${wa.correctAnswer}</strong></p>
          ${wa.explanation ? `<p style="margin:0;font-size:13px;color:#64748b;border-top:1px solid #fecaca;padding-top:8px"><strong>Explanation:</strong> ${wa.explanation}</p>` : ''}
        </div>`).join('');

  const html = `
    <!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      body{font-family:'Inter',Arial,sans-serif;background:#f8fafc;margin:0;padding:20px}
      .c{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.07)}
      .h{background:linear-gradient(135deg,#0052CC,#0066FF);padding:32px;text-align:center}
      .h h1{color:#fff;margin:0;font-size:22px;font-weight:700}
      .b{padding:32px}
      .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}
      .stat{background:#f8fafc;border-radius:8px;padding:16px;text-align:center}
      .snum{font-size:28px;font-weight:800}
      .slbl{font-size:12px;color:#94a3b8;margin-top:4px}
      .stitle{font-size:16px;font-weight:700;color:#1e293b;margin:24px 0 12px;border-bottom:2px solid #e2e8f0;padding-bottom:8px}
      .f{background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8}
    </style></head><body>
    <div class="c">
      <div class="h"><h1>Esvita Academy</h1><p style="color:rgba(255,255,255,.85);margin:8px 0 0">Exam Results</p></div>
      <div class="b">
        <p>Dear <strong>${data.candidateNickname}</strong>,</p>
        <p>You have completed: <strong>${data.examTitle}</strong></p>
        <div style="text-align:center;margin:24px 0">
          <div style="font-size:64px;font-weight:900;color:${scoreColor}">${data.score}%</div>
          <div style="font-size:16px;font-weight:600;color:${scoreColor}">${scoreLabel}</div>
          <div style="margin-top:8px;font-size:14px;color:${passed ? '#16a34a' : '#dc2626'};font-weight:600">${passed ? '✓ Passed' : '✗ Did not pass'} (pass mark: ${data.passMarkPercent}%)</div>
        </div>
        <div class="stats">
          <div class="stat"><div class="snum" style="color:#16a34a">${data.correctCount}</div><div class="slbl">Correct</div></div>
          <div class="stat"><div class="snum" style="color:#dc2626">${data.wrongCount}</div><div class="slbl">Wrong</div></div>
          <div class="stat"><div class="snum" style="color:#94a3b8">${data.skippedCount}</div><div class="slbl">Skipped</div></div>
        </div>
        ${data.wrongAnswers.length > 0 ? `<div class="stitle">Questions to Revisit</div>${wrongAnswersHtml}` : `
        <div style="background:#f0fdf4;border-radius:8px;padding:20px;text-align:center;margin:20px 0">
          <p style="color:#16a34a;font-size:18px;font-weight:700;margin:0">All answers correct!</p>
        </div>`}
      </div>
      <div class="f">&copy; ${new Date().getFullYear()} Esvita Clinic &bull; Secure Exam Management System<br>This is an automated message. Please do not reply.</div>
    </div></body></html>`;

  await send(
    data.candidateEmail,
    `[Esvita Academy] Your Results: ${data.examTitle} — ${data.score}%`,
    html,
    { type: 'result', audienceId: data.audienceId, examId: data.examId, sessionId: data.sessionId }
  );
}

// ─── Candidate Portal OTP ─────────────────────────────────────────────────────

export async function sendCandidateOTP(email: string, name: string, otp: string) {
  const html = `
    <!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      body{font-family:'Inter',Arial,sans-serif;background:#f8fafc;margin:0;padding:20px}
      .c{max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.07)}
      .h{background:linear-gradient(135deg,#7c3aed,#8b5cf6);padding:32px;text-align:center}
      .h h1{color:#fff;margin:0;font-size:22px;font-weight:700}
      .b{padding:32px}
      .otp{background:#faf5ff;border:2px dashed #7c3aed;border-radius:10px;text-align:center;padding:24px;margin:24px 0}
      .code{font-size:42px;font-weight:800;color:#7c3aed;letter-spacing:10px;font-family:monospace}
      .f{background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8}
    </style></head><body>
    <div class="c">
      <div class="h"><h1>Esvita Academy</h1><p style="color:rgba(255,255,255,.9);margin:8px 0 0">Result Portal Access</p></div>
      <div class="b">
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your one-time code to access the exam results portal:</p>
        <div class="otp"><div class="code">${otp}</div><div style="font-size:12px;color:#94a3b8;margin-top:8px">Valid for 10 minutes</div></div>
        <p style="color:#64748b;font-size:14px">If you did not request this code, please ignore this email.</p>
      </div>
      <div class="f">&copy; ${new Date().getFullYear()} Esvita Clinic &bull; Secure Exam Management System</div>
    </div></body></html>`;

  await send(email, `[Esvita Academy] Your results portal code: ${otp}`, html, { type: 'otp' });
}

import nodemailer from 'nodemailer';

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

const FROM = process.env.SMTP_FROM || 'Esvita Exam System <no-reply@esvitaclinic.com>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// ─── Send OTP for Admin Login ────────────────────────────────────────────────
export async function sendAdminOTP(email: string, name: string, otp: string) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Inter', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07); }
        .header { background: linear-gradient(135deg, #0052CC 0%, #0066FF 100%); padding: 32px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 22px; font-weight: 700; }
        .header p { color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px; }
        .body { padding: 32px; }
        .otp-box { background: #f0f7ff; border: 2px dashed #0052CC; border-radius: 10px; text-align: center; padding: 24px; margin: 24px 0; }
        .otp-code { font-size: 42px; font-weight: 800; color: #0052CC; letter-spacing: 10px; font-family: monospace; }
        .note { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 8px; }
        .footer { background: #f8fafc; padding: 16px 32px; text-align: center; font-size: 12px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Esvita Exam System</h1>
          <p>Admin Login Verification</p>
        </div>
        <div class="body">
          <p>Hello <strong>${name}</strong>,</p>
          <p>Your one-time login code is:</p>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
            <div class="note">Valid for 10 minutes</div>
          </div>
          <p style="color:#64748b; font-size:14px;">If you did not request this code, please ignore this email.</p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Esvita Clinic &bull; Secure Exam Management System
        </div>
      </div>
    </body>
    </html>
  `;

  await getTransporter().sendMail({
    from: FROM,
    to: email,
    subject: `[Esvita Exam] Your Login Code: ${otp}`,
    html,
  });
}

// ─── Send Exam Invitation to External User ───────────────────────────────────
export async function sendExamInvitation(
  email: string,
  name: string,
  examTitle: string,
  examLink: string,
  otp: string,
  expiresAt: Date
) {
  const expiry = expiresAt.toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Inter', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07); }
        .header { background: linear-gradient(135deg, #0052CC 0%, #0066FF 100%); padding: 32px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 22px; font-weight: 700; }
        .body { padding: 32px; }
        .exam-box { background: #f0f7ff; border-left: 4px solid #0052CC; border-radius: 6px; padding: 16px 20px; margin: 20px 0; }
        .exam-title { font-weight: 700; color: #0052CC; font-size: 16px; }
        .otp-box { background: #fef9c3; border: 2px dashed #ca8a04; border-radius: 10px; text-align: center; padding: 20px; margin: 20px 0; }
        .otp-code { font-size: 36px; font-weight: 800; color: #92400e; letter-spacing: 8px; font-family: monospace; }
        .btn { display: inline-block; background: #0052CC; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin: 20px 0; }
        .warning { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #9a3412; margin-top: 20px; }
        .footer { background: #f8fafc; padding: 16px 32px; text-align: center; font-size: 12px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Esvita Exam System</h1>
          <p>You have been invited to take an exam</p>
        </div>
        <div class="body">
          <p>Dear <strong>${name}</strong>,</p>
          <p>You have been invited to participate in the following assessment:</p>
          <div class="exam-box">
            <div class="exam-title">${examTitle}</div>
          </div>
          <p>Click the button below to access your exam:</p>
          <div style="text-align:center;">
            <a href="${examLink}" class="btn">Start My Exam</a>
          </div>
          <p style="color:#64748b; font-size:14px; text-align:center;">Or paste this link in your browser:<br>
            <a href="${examLink}" style="color:#0052CC; word-break:break-all;">${examLink}</a>
          </p>
          <div class="otp-box">
            <p style="margin:0 0 8px; font-size:14px; color:#78716c;">Your verification code:</p>
            <div class="otp-code">${otp}</div>
            <p style="margin:8px 0 0; font-size:12px; color:#a16207;">Enter this code when prompted</p>
          </div>
          <div class="warning">
            <strong>Important:</strong> This invitation and OTP code will expire on <strong>${expiry} UTC</strong> (72 hours from now).
            After expiration, you will not be able to access the exam.
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Esvita Clinic &bull; Secure Exam Management System
        </div>
      </div>
    </body>
    </html>
  `;

  await getTransporter().sendMail({
    from: FROM,
    to: email,
    subject: `[Esvita Exam] Invitation: ${examTitle}`,
    html,
  });
}

// ─── Send Exam Result to Candidate ───────────────────────────────────────────
export interface ExamResultData {
  candidateName: string;
  candidateEmail: string;
  examTitle: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  language: string;
  wrongAnswers: Array<{
    questionText: string;
    selectedAnswer: string;
    correctAnswer: string;
    explanation: string;
  }>;
}

export async function sendExamResult(data: ExamResultData) {
  const scoreColor = data.score >= 80 ? '#16a34a' : data.score >= 60 ? '#ca8a04' : '#dc2626';
  const scoreLabel = data.score >= 80 ? 'Excellent' : data.score >= 60 ? 'Satisfactory' : 'Needs Improvement';

  const wrongAnswersHtml = data.wrongAnswers.length === 0
    ? '<p style="color:#16a34a; font-weight:600;">Perfect score! All answers were correct.</p>'
    : data.wrongAnswers.map((wa, i) => `
        <div style="background:#fef2f2; border-left:4px solid #ef4444; border-radius:6px; padding:16px; margin-bottom:12px;">
          <p style="margin:0 0 8px; font-weight:600; color:#1e293b; font-size:14px;">Q${i + 1}: ${wa.questionText}</p>
          <p style="margin:0 0 4px; font-size:13px; color:#dc2626;">Your answer: <strong>${wa.selectedAnswer || 'Not answered'}</strong></p>
          <p style="margin:0 0 8px; font-size:13px; color:#16a34a;">Correct answer: <strong>${wa.correctAnswer}</strong></p>
          ${wa.explanation ? `<p style="margin:0; font-size:13px; color:#64748b; border-top:1px solid #fecaca; padding-top:8px;"><strong>Explanation:</strong> ${wa.explanation}</p>` : ''}
        </div>
      `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Inter', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07); }
        .header { background: linear-gradient(135deg, #0052CC 0%, #0066FF 100%); padding: 32px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 22px; font-weight: 700; }
        .body { padding: 32px; }
        .score-circle { width: 120px; height: 120px; border-radius: 50%; background: ${scoreColor}; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 24px 0; }
        .stat-box { background: #f8fafc; border-radius: 8px; padding: 16px; text-align: center; }
        .stat-number { font-size: 28px; font-weight: 800; }
        .stat-label { font-size: 12px; color: #94a3b8; margin-top: 4px; }
        .section-title { font-size: 16px; font-weight: 700; color: #1e293b; margin: 24px 0 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
        .footer { background: #f8fafc; padding: 16px 32px; text-align: center; font-size: 12px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Esvita Exam System</h1>
          <p style="color:rgba(255,255,255,0.85); margin:8px 0 0;">Exam Results</p>
        </div>
        <div class="body">
          <p>Dear <strong>${data.candidateName}</strong>,</p>
          <p>You have completed: <strong>${data.examTitle}</strong></p>

          <div style="text-align:center; margin:24px 0;">
            <div style="font-size:64px; font-weight:900; color:${scoreColor};">${data.score}%</div>
            <div style="font-size:16px; font-weight:600; color:${scoreColor};">${scoreLabel}</div>
          </div>

          <div class="stats-grid">
            <div class="stat-box">
              <div class="stat-number" style="color:#16a34a;">${data.correctCount}</div>
              <div class="stat-label">Correct</div>
            </div>
            <div class="stat-box">
              <div class="stat-number" style="color:#dc2626;">${data.wrongCount}</div>
              <div class="stat-label">Wrong</div>
            </div>
            <div class="stat-box">
              <div class="stat-number" style="color:#94a3b8;">${data.skippedCount}</div>
              <div class="stat-label">Skipped</div>
            </div>
          </div>

          ${data.wrongAnswers.length > 0 ? `
          <div class="section-title">Review: Questions to Revisit</div>
          ${wrongAnswersHtml}
          ` : `
          <div style="background:#f0fdf4; border-radius:8px; padding:20px; text-align:center; margin:20px 0;">
            <p style="color:#16a34a; font-size:18px; font-weight:700; margin:0;">All answers correct!</p>
          </div>
          `}
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Esvita Clinic &bull; Secure Exam Management System<br>
          This is an automated message. Please do not reply.
        </div>
      </div>
    </body>
    </html>
  `;

  await getTransporter().sendMail({
    from: FROM,
    to: data.candidateEmail,
    subject: `[Esvita Exam] Your Results: ${data.examTitle} - ${data.score}%`,
    html,
  });
}

// ─── Exam Completion Confirmation (results pending) ───────────────────────────
export async function sendCompletionConfirmation(
  email: string,
  name: string,
  examTitle: string,
  resultsDate: Date
) {
  const resultsDateStr = resultsDate.toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Inter', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07); }
        .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 32px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 22px; font-weight: 700; }
        .body { padding: 32px; }
        .check-icon { font-size: 64px; text-align: center; margin: 16px 0; }
        .exam-box { background: #f0fdf4; border-left: 4px solid #059669; border-radius: 6px; padding: 16px 20px; margin: 20px 0; }
        .exam-title { font-weight: 700; color: #059669; font-size: 16px; }
        .date-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px 20px; margin: 20px 0; text-align: center; }
        .date-label { font-size: 12px; color: #64748b; margin-bottom: 6px; }
        .date-value { font-size: 16px; font-weight: 700; color: #1e40af; }
        .portal-box { background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; }
        .footer { background: #f8fafc; padding: 16px 32px; text-align: center; font-size: 12px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Esvita Exam System</h1>
          <p style="color:rgba(255,255,255,0.9); margin:8px 0 0;">Exam Completed Successfully</p>
        </div>
        <div class="body">
          <div class="check-icon">✅</div>
          <p>Dear <strong>${name}</strong>,</p>
          <p>You have successfully completed the following exam:</p>
          <div class="exam-box">
            <div class="exam-title">${examTitle}</div>
          </div>
          <p style="color:#64748b;">Your answers have been recorded. Results will be shared with all participants simultaneously once the exam session closes.</p>
          <div class="date-box">
            <div class="date-label">Results will be available on</div>
            <div class="date-value">${resultsDateStr} UTC</div>
          </div>
          <div class="portal-box">
            <p style="margin:0 0 8px; font-size:13px; color:#64748b;">You can check your results after the release date at:</p>
            <a href="${APP_URL}/results" style="color:#0052CC; font-weight:600; font-size:14px;">${APP_URL}/results</a>
          </div>
          <p style="font-size:13px; color:#94a3b8;">If you have any questions, please contact your administrator.</p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Esvita Clinic &bull; Secure Exam Management System<br>
          This is an automated message. Please do not reply.
        </div>
      </div>
    </body>
    </html>
  `;

  await getTransporter().sendMail({
    from: FROM,
    to: email,
    subject: `[Esvita Exam] Completed: ${examTitle} — Results pending`,
    html,
  });
}

// ─── Candidate Portal OTP ─────────────────────────────────────────────────────
export async function sendCandidateOTP(email: string, name: string, otp: string) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Inter', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07); }
        .header { background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%); padding: 32px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 22px; font-weight: 700; }
        .body { padding: 32px; }
        .otp-box { background: #faf5ff; border: 2px dashed #7c3aed; border-radius: 10px; text-align: center; padding: 24px; margin: 24px 0; }
        .otp-code { font-size: 42px; font-weight: 800; color: #7c3aed; letter-spacing: 10px; font-family: monospace; }
        .footer { background: #f8fafc; padding: 16px 32px; text-align: center; font-size: 12px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Esvita Exam System</h1>
          <p style="color:rgba(255,255,255,0.9); margin:8px 0 0;">Result Portal Access</p>
        </div>
        <div class="body">
          <p>Hello <strong>${name}</strong>,</p>
          <p>Your one-time code to access the exam results portal:</p>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
            <div style="font-size:12px; color:#94a3b8; margin-top:8px;">Valid for 10 minutes</div>
          </div>
          <p style="color:#64748b; font-size:14px;">If you did not request this code, please ignore this email.</p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Esvita Clinic &bull; Secure Exam Management System
        </div>
      </div>
    </body>
    </html>
  `;

  await getTransporter().sendMail({
    from: FROM,
    to: email,
    subject: `[Esvita Exam] Your results portal code: ${otp}`,
    html,
  });
}

// ─── Core Domain Types ────────────────────────────────────────────────────────

export type Language = 'EN' | 'FRA' | 'RU' | 'TR' | 'ITA';
export type UserRole = 'admin' | 'super_admin';
export type ExamStatus = 'in_progress' | 'completed' | 'abandoned';

export interface QuestionOption {
  key: string;
  value: string;
}

// ─── Database Model Types ─────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Audience {
  id: string;
  name: string;
  email: string;
  preferredLanguage: Language;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AudienceWithStats extends Audience {
  totalExams: number;
  averageScore: number;
  lastExamDate: string | null;
  examHistory: ExamSessionSummary[];
}

export interface Exam {
  id: string;
  titleEn: string | null;
  titleFra: string | null;
  titleRu: string | null;
  titleTr: string | null;
  titleIta: string | null;
  descriptionEn: string | null;
  descriptionFra: string | null;
  descriptionRu: string | null;
  descriptionTr: string | null;
  descriptionIta: string | null;
  timePerQuestion: number;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  _count?: { questions: number; sessions: number };
  creator?: Pick<User, 'id' | 'name' | 'email'>;
}

export interface Question {
  id: string;
  examId: string;
  orderIndex: number;
  questionEn: string | null;
  questionFra: string | null;
  questionRu: string | null;
  questionTr: string | null;
  questionIta: string | null;
  optionsEn: string | null;  // JSON string
  optionsFra: string | null;
  optionsRu: string | null;
  optionsTr: string | null;
  optionsIta: string | null;
  correctAnswer: string;
  explanationEn: string | null;
  explanationFra: string | null;
  explanationRu: string | null;
  explanationTr: string | null;
  explanationIta: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExamInvitation {
  id: string;
  examId: string;
  email: string;
  name: string | null;
  uniqueToken: string;
  otpCode: string | null;
  expiresAt: string;
  isUsed: boolean;
  createdBy: string;
  createdAt: string;
  exam?: Pick<Exam, 'id' | 'titleEn'>;
}

export interface ExamSession {
  id: string;
  examId: string;
  audienceId: string | null;
  invitationId: string | null;
  externalEmail: string | null;
  externalName: string | null;
  selectedLanguage: string;
  questionOrder: string; // JSON
  startedAt: string;
  completedAt: string | null;
  score: number | null;
  totalQuestions: number | null;
  correctCount: number | null;
  wrongCount: number | null;
  skippedCount: number | null;
  timeTaken: number | null;
  status: ExamStatus;
  exam?: Pick<Exam, 'id' | 'titleEn' | 'titleTr' | 'titleFra' | 'titleRu' | 'titleIta'>;
  audience?: Pick<Audience, 'id' | 'name' | 'email'>;
}

export interface ExamSessionSummary {
  id: string;
  examTitle: string;
  score: number;
  completedAt: string;
  language: string;
  correctCount: number;
  wrongCount: number;
  totalQuestions: number;
}

export interface ExamAnswer {
  id: string;
  sessionId: string;
  questionId: string;
  selectedAnswer: string | null;
  isCorrect: boolean | null;
  answeredAt: string;
  question?: Question;
}

// ─── API Request/Response Types ───────────────────────────────────────────────

export interface SendOTPRequest {
  email: string;
}

export interface VerifyOTPRequest {
  email: string;
  otp: string;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  role?: UserRole;
}

export interface CreateAudienceRequest {
  name: string;
  email: string;
  preferredLanguage?: Language;
}

export interface CreateExamRequest {
  titleEn?: string;
  titleFra?: string;
  titleRu?: string;
  titleTr?: string;
  titleIta?: string;
  descriptionEn?: string;
  descriptionFra?: string;
  descriptionRu?: string;
  descriptionTr?: string;
  descriptionIta?: string;
  timePerQuestion?: number;
}

export interface CreateQuestionRequest {
  questionEn?: string;
  questionFra?: string;
  questionRu?: string;
  questionTr?: string;
  questionIta?: string;
  optionsEn?: QuestionOption[];
  optionsFra?: QuestionOption[];
  optionsRu?: QuestionOption[];
  optionsTr?: QuestionOption[];
  optionsIta?: QuestionOption[];
  correctAnswer: string;
  explanationEn?: string;
  explanationFra?: string;
  explanationRu?: string;
  explanationTr?: string;
  explanationIta?: string;
  orderIndex?: number;
}

export interface SendInvitationRequest {
  email: string;
  name: string;
}

// ─── Exam-taking Types ────────────────────────────────────────────────────────

export interface ExamStartResponse {
  sessionId: string;
  examTitle: string;
  totalQuestions: number;
  timePerQuestion: number;
  totalTime: number;
}

export interface QuestionForCandidate {
  id: string;
  questionText: string;
  options: QuestionOption[];
  orderIndex: number;
}

export interface SubmitAnswerRequest {
  sessionId: string;
  questionId: string;
  selectedAnswer: string | null;
}

// ─── Report Types ─────────────────────────────────────────────────────────────

export interface ReportRow {
  candidateName: string;
  candidateEmail: string;
  examTitle: string;
  language: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  totalQuestions: number;
  timeTaken: number | null;
  completedAt: string;
}

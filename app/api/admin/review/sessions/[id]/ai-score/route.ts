import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canReviewAiScore, forbidden } from '@/lib/permissions';
import { suggestScore } from '@/lib/gemini';
import { getLocalized } from '@/lib/utils';

// POST /api/admin/review/sessions/[id]/ai-score
// Body: { answerId: string }
// Returns AI-suggested score (0–10) for a single short-answer question
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canReviewAiScore(session)) return forbidden();

  const { answerId } = await req.json() as { answerId: string };
  if (!answerId) return apiError('answerId is required');

  const answer = await prisma.examAnswer.findUnique({
    where: { id: answerId, sessionId: params.id },
    include: { question: true, session: true },
  });

  if (!answer) return apiError('Answer not found', 404);
  if (answer.question.type !== 'short_answer') return apiError('Only short-answer questions can be AI scored');

  const lang = answer.session.selectedLanguage as 'EN' | 'FRA' | 'RU' | 'TR' | 'ITA';

  const questionText = getLocalized(answer.question, 'question', lang) || answer.question.questionEn || '';
  const referenceAnswer =
    getLocalized(answer.question, 'referenceAnswer', lang) || answer.question.referenceAnswerEn || '';
  const candidateAnswer = answer.selectedAnswer || '';

  if (!referenceAnswer) {
    return apiError('No reference answer available for this question. Please add one before using AI scoring.');
  }
  if (!candidateAnswer) {
    return apiError('Candidate did not provide an answer');
  }

  const { score, reasoning } = await suggestScore(questionText, referenceAnswer, candidateAnswer);

  // Persist the AI suggestion
  await prisma.examAnswer.update({
    where: { id: answerId },
    data: { aiSuggestedScore: score, aiSuggestionStatus: 'pending' },
  });

  return apiSuccess({ answerId, suggestedScore: score, reasoning });
}

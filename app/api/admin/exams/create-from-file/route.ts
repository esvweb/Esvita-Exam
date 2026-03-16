export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canWrite, forbidden } from '@/lib/permissions';
import { parseExamFile } from '@/lib/pdf';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canWrite(session)) return forbidden();

  const body = await req.json();
  const {
    text,
    timePerQuestion,
    titleEn, titleTr, titleFra, titleRu, titleIta,
    descriptionEn, descriptionTr, descriptionFra, descriptionRu, descriptionIta,
  } = body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return apiError('No file content provided');
  }

  if (!titleEn && !titleTr && !titleFra && !titleRu && !titleIta) {
    return apiError('At least one language title is required');
  }

  // Parse the file to extract questions
  let parsed;
  try {
    parsed = parseExamFile(text);
  } catch (err) {
    return apiError(`Failed to parse file: ${err instanceof Error ? err.message : 'unknown error'}`);
  }

  if (parsed.questions.length === 0) {
    return apiError(
      'No valid questions found in the file. Please check the format: each question must have Q:, at least two options (A:, B:), and ANSWER:'
    );
  }

  try {
    const exam = await prisma.exam.create({
      data: {
        titleEn:  titleEn  || null,
        titleFra: titleFra || null,
        titleRu:  titleRu  || null,
        titleTr:  titleTr  || null,
        titleIta: titleIta || null,
        descriptionEn:  descriptionEn  || null,
        descriptionFra: descriptionFra || null,
        descriptionRu:  descriptionRu  || null,
        descriptionTr:  descriptionTr  || null,
        descriptionIta: descriptionIta || null,
        timePerQuestion: Number(timePerQuestion) || 60,
        createdBy: session.userId,
        questions: {
          create: parsed.questions.map((q, i) => ({
            orderIndex: i,
            questionEn:    q.questionText || null,
            optionsEn:     q.options?.length ? JSON.stringify(q.options) : null,
            correctAnswer: (q.correctAnswer || 'A').toUpperCase(),
            explanationEn: q.explanation   || null,
          })),
        },
      },
    });

    return apiSuccess(
      { id: exam.id, questionsImported: parsed.questions.length },
      201
    );
  } catch (err) {
    console.error('Create-from-file error:', err);
    return apiError(`Failed to create exam: ${err instanceof Error ? err.message : 'unknown error'}`);
  }
}

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { extractTextFromPDF, parseQuestionsFromText, parseQuestionsFromJSON } from '@/lib/pdf';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);

  const exam = await prisma.exam.findUnique({ where: { id: params.id } });
  if (!exam) return apiError('Exam not found', 404);

  const contentType = req.headers.get('content-type') || '';

  try {
    let parsedQuestions: Array<{
      questionEn?: string; questionTr?: string;
      optionsEn?: { key: string; value: string }[];
      optionsTr?: { key: string; value: string }[];
      correctAnswer: string;
      explanationEn?: string; explanationTr?: string;
    }> = [];

    if (contentType.includes('application/json')) {
      // JSON bulk import
      const body = await req.json();
      if (body.type === 'json' && body.data) {
        parsedQuestions = parseQuestionsFromJSON(body.data) as typeof parsedQuestions;
      } else if (body.type === 'text' && body.data) {
        // Plain text format
        const rawParsed = parseQuestionsFromText(body.data);
        parsedQuestions = rawParsed.map((q) => ({
          questionEn: q.questionText,
          optionsEn: q.options,
          correctAnswer: q.correctAnswer,
          explanationEn: q.explanation,
        }));
      }
    } else if (contentType.includes('multipart/form-data')) {
      // PDF upload
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) return apiError('No file uploaded');

      const buffer = Buffer.from(await file.arrayBuffer());

      if (file.name.endsWith('.pdf')) {
        const text = await extractTextFromPDF(buffer);
        const rawParsed = parseQuestionsFromText(text);
        parsedQuestions = rawParsed.map((q) => ({
          questionEn: q.questionText,
          optionsEn: q.options,
          correctAnswer: q.correctAnswer,
          explanationEn: q.explanation,
        }));
      } else if (file.name.endsWith('.json')) {
        const text = new TextDecoder().decode(buffer);
        parsedQuestions = parseQuestionsFromJSON(text) as typeof parsedQuestions;
      } else if (file.name.endsWith('.txt')) {
        const text = new TextDecoder().decode(buffer);
        const rawParsed = parseQuestionsFromText(text);
        parsedQuestions = rawParsed.map((q) => ({
          questionEn: q.questionText,
          optionsEn: q.options,
          correctAnswer: q.correctAnswer,
          explanationEn: q.explanation,
        }));
      } else {
        return apiError('Unsupported file type. Use PDF, JSON, or TXT.');
      }
    }

    if (parsedQuestions.length === 0) {
      return apiError('No valid questions found in the provided data');
    }

    // Get current count for ordering
    const existingCount = await prisma.question.count({ where: { examId: params.id } });

    const created = await prisma.$transaction(
      parsedQuestions.map((q, i) =>
        prisma.question.create({
          data: {
            examId: params.id,
            orderIndex: existingCount + i,
            questionEn: q.questionEn || null,
            questionTr: q.questionTr || null,
            optionsEn: q.optionsEn ? JSON.stringify(q.optionsEn) : null,
            optionsTr: q.optionsTr ? JSON.stringify(q.optionsTr) : null,
            correctAnswer: (q.correctAnswer || 'A').toUpperCase(),
            explanationEn: q.explanationEn || null,
            explanationTr: q.explanationTr || null,
          },
        })
      )
    );

    return apiSuccess({
      imported: created.length,
      message: `Successfully imported ${created.length} questions`,
    });
  } catch (err) {
    console.error('Import error:', err);
    return apiError(`Import failed: ${err instanceof Error ? err.message : 'unknown error'}`);
  }
}

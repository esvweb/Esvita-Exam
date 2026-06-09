import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canEditDraftExam, canEditLiveExam, forbidden } from '@/lib/permissions';
import { batchTranslate, batchTranslateExamMeta, type SupportedLanguage } from '@/lib/gemini';

const LANG_SUFFIX: Record<SupportedLanguage, string> = { FRA: 'Fra', RU: 'Ru', TR: 'Tr', ITA: 'Ita' };
const VALID_LANGS: SupportedLanguage[] = ['FRA', 'RU', 'TR', 'ITA'];

// POST /api/admin/exams/[id]/translate
// Body: { languages: ["FRA", "RU", "TR", "ITA"] }
// Translates the exam title/description and every question into the selected languages.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    include: { questions: { orderBy: { orderIndex: 'asc' } } },
  });
  if (!exam) return apiError('Exam not found', 404);

  const isLive = exam.status === 'published';
  if (isLive && !canEditLiveExam(session)) return forbidden('Only Super Admin / Admin can edit a published exam');
  if (!isLive && !canEditDraftExam(session)) return forbidden();

  if (!exam.titleEn) return apiError('English title is required as the translation source');

  const { languages } = await req.json() as { languages: SupportedLanguage[] };
  if (!languages?.length) return apiError('No languages specified');

  const toTranslate = languages.filter((l) => VALID_LANGS.includes(l));
  if (!toTranslate.length) return apiError('No valid languages specified');

  try {
    // Translate exam title + description
    const examTranslations = await batchTranslateExamMeta(
      { title: exam.titleEn, description: exam.descriptionEn || undefined },
      toTranslate
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const examUpdate: any = {};
    for (const [lang, t] of Object.entries(examTranslations)) {
      const suffix = LANG_SUFFIX[lang as SupportedLanguage];
      if (t.title) examUpdate[`title${suffix}`] = t.title;
      if (t.description) examUpdate[`description${suffix}`] = t.description;
    }

    // Translate each question, sequentially to stay within API rate limits
    const questionUpdates: { id: string; data: Record<string, string> }[] = [];
    for (const q of exam.questions) {
      if (!q.questionEn) continue;
      const options = q.optionsEn ? JSON.parse(q.optionsEn) as string[] : undefined;
      const results = await batchTranslate(
        {
          question: q.questionEn,
          options,
          referenceAnswer: q.referenceAnswerEn || undefined,
          explanation: q.explanationEn || undefined,
        },
        toTranslate
      );

      const data: Record<string, string> = {};
      for (const [lang, t] of Object.entries(results)) {
        const suffix = LANG_SUFFIX[lang as SupportedLanguage];
        if (t.question) data[`question${suffix}`] = t.question;
        if (t.options) data[`options${suffix}`] = JSON.stringify(t.options);
        if (t.referenceAnswer) data[`referenceAnswer${suffix}`] = t.referenceAnswer;
        if (t.explanation) data[`explanation${suffix}`] = t.explanation;
      }
      questionUpdates.push({ id: q.id, data });
    }

    await prisma.$transaction([
      prisma.exam.update({ where: { id: exam.id }, data: examUpdate }),
      ...questionUpdates.map((u) => prisma.question.update({ where: { id: u.id }, data: u.data })),
    ]);

    return apiSuccess({ translatedLanguages: toTranslate, questionsTranslated: questionUpdates.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Translation failed';
    return apiError(message.includes('OPENAI_API_KEY') ? 'AI translation is not configured (missing OPENAI_API_KEY)' : message, 502);
  }
}

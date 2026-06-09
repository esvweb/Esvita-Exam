import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/utils';
import { canEditQuestionBank, forbidden } from '@/lib/permissions';
import { batchTranslate, type SupportedLanguage } from '@/lib/gemini';

// POST /api/admin/question-bank/[id]/translate
// Body: { languages: ["FRA", "RU", "TR", "ITA"] }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return apiError('Unauthorized', 401);
  if (!canEditQuestionBank(session)) return forbidden();

  const item = await prisma.questionBank.findUnique({ where: { id: params.id } });
  if (!item) return apiError('Question not found', 404);

  if (!item.questionEn) return apiError('English question text is required as the translation source');

  const { languages } = await req.json() as { languages: SupportedLanguage[] };
  if (!languages?.length) return apiError('No languages specified');

  const validLangs: SupportedLanguage[] = ['FRA', 'RU', 'TR', 'ITA'];
  const toTranslate = languages.filter((l) => validLangs.includes(l));
  if (!toTranslate.length) return apiError('No valid languages specified');

  // Options are stored as [{key, value}] — extract just text values for AI
  const rawOptions: { key: string; value: string }[] | undefined = item.optionsEn
    ? JSON.parse(item.optionsEn)
    : undefined;
  const optionStrings = rawOptions?.map((o) => o.value);

  let results;
  try {
    results = await batchTranslate(
      {
        question: item.questionEn,
        options: optionStrings,
        referenceAnswer: item.referenceAnswerEn || undefined,
        explanation: item.explanationEn || undefined,
      },
      toTranslate
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Translation failed';
    return apiError(message.includes('OPENAI_API_KEY') ? 'AI translation is not configured (missing OPENAI_API_KEY)' : message, 502);
  }

  // Build update payload from translations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: any = {};
  for (const [lang, t] of Object.entries(results)) {
    const suffix = lang === 'FRA' ? 'Fra' : lang === 'RU' ? 'Ru' : lang === 'TR' ? 'Tr' : 'Ita';
    if (t.question) update[`question${suffix}`] = t.question;
    if (t.options && rawOptions) {
      // Rebuild [{key, value}] using original keys + translated values
      update[`options${suffix}`] = JSON.stringify(
        t.options.map((val, i) => ({ key: rawOptions[i]?.key ?? String.fromCharCode(65 + i), value: val }))
      );
    }
    if (t.referenceAnswer) update[`referenceAnswer${suffix}`] = t.referenceAnswer;
    if (t.explanation) update[`explanation${suffix}`] = t.explanation;
  }

  const updated = await prisma.questionBank.update({ where: { id: params.id }, data: update });
  return apiSuccess({ updated, translations: results });
}

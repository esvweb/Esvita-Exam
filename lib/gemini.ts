import { GoogleGenerativeAI } from '@google/generative-ai';

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  return new GoogleGenerativeAI(key);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const isRateLimit = e instanceof Error && (e.message.includes('429') || e.message.includes('quota'));
      if (attempt === maxAttempts - 1 || !isRateLimit) throw e;
      await sleep((attempt + 1) * 60_000); // 60s, 120s
    }
  }
  throw new Error('Max retries exceeded');
}

// ── AI Score Suggestion ───────────────────────────────────────────────────────

export interface ScoreSuggestionResult {
  score: number;  // 0–10
  reasoning: string;
}

export async function suggestScore(
  question: string,
  referenceAnswer: string,
  candidateAnswer: string
): Promise<ScoreSuggestionResult> {
  const model = getClient().getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `You are an expert exam evaluator. Score the candidate's answer on a scale of 0 to 10.

QUESTION:
${question}

REFERENCE ANSWER (ideal answer):
${referenceAnswer}

CANDIDATE'S ANSWER:
${candidateAnswer}

Evaluate how well the candidate's answer matches the reference answer in terms of accuracy, completeness, and understanding.

Respond ONLY with valid JSON in this exact format:
{"score": <integer 0-10>, "reasoning": "<one or two sentences explaining the score>"}

Do not include anything outside the JSON object.`;

  const result = await withRetry(() => model.generateContent(prompt));
  const text = result.response.text().trim();

  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  const parsed = JSON.parse(cleaned) as { score: number; reasoning: string };
  const score = Math.max(0, Math.min(10, Math.round(Number(parsed.score))));
  return { score, reasoning: String(parsed.reasoning) };
}

// ── AI Translation ────────────────────────────────────────────────────────────

export type SupportedLanguage = 'FRA' | 'RU' | 'TR' | 'ITA';

export interface TranslationInput {
  question: string;
  options?: string[];  // for multiple_choice
  referenceAnswer?: string;
  explanation?: string;
}

export interface TranslationOutput {
  question: string;
  options?: string[];
  referenceAnswer?: string;
  explanation?: string;
}

const LANG_NAMES: Record<SupportedLanguage, string> = {
  FRA: 'French',
  RU: 'Russian',
  TR: 'Turkish',
  ITA: 'Italian',
};

export async function translateQuestion(
  input: TranslationInput,
  targetLanguage: SupportedLanguage
): Promise<TranslationOutput> {
  const model = getClient().getGenerativeModel({ model: 'gemini-2.0-flash' });
  const langName = LANG_NAMES[targetLanguage];

  const optionsSection = input.options?.length
    ? `OPTIONS (translate each, preserving A/B/C/D letter prefixes if present):
${input.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`
    : '';

  const refSection = input.referenceAnswer
    ? `REFERENCE ANSWER:\n${input.referenceAnswer}`
    : '';

  const expSection = input.explanation
    ? `EXPLANATION:\n${input.explanation}`
    : '';

  const prompt = `Translate the following exam question content from English to ${langName}.
Preserve medical/technical terminology accurately. Keep the tone professional.

QUESTION:
${input.question}
${optionsSection}
${refSection}
${expSection}

Respond ONLY with valid JSON in this exact format (include only fields that were provided):
{
  "question": "<translated question>",
  ${input.options?.length ? '"options": ["<opt1>", "<opt2>", ...],' : ''}
  ${input.referenceAnswer ? '"referenceAnswer": "<translated reference answer>",' : ''}
  ${input.explanation ? '"explanation": "<translated explanation>",' : ''}
  "_dummy": null
}

Do not include anything outside the JSON object.`;

  const result = await withRetry(() => model.generateContent(prompt));
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  const parsed = JSON.parse(cleaned) as TranslationOutput & { _dummy?: null };
  delete (parsed as { _dummy?: null })._dummy;
  return parsed;
}

// ── Batch translate one question into multiple languages ──────────────────────

export async function batchTranslate(
  input: TranslationInput,
  languages: SupportedLanguage[]
): Promise<Partial<Record<SupportedLanguage, TranslationOutput>>> {
  const results: Partial<Record<SupportedLanguage, TranslationOutput>> = {};

  await Promise.all(
    languages.map(async (lang) => {
      results[lang] = await translateQuestion(input, lang);
    })
  );

  return results;
}

// ── Exam metadata translation (title + description) ──────────────────────────

export interface ExamMetaInput {
  title: string;
  description?: string;
}

export interface ExamMetaOutput {
  title: string;
  description?: string;
}

export async function translateExamMeta(
  input: ExamMetaInput,
  targetLanguage: SupportedLanguage
): Promise<ExamMetaOutput> {
  const model = getClient().getGenerativeModel({ model: 'gemini-2.0-flash' });
  const langName = LANG_NAMES[targetLanguage];

  const descSection = input.description ? `DESCRIPTION:\n${input.description}` : '';

  const prompt = `Translate the following exam title and description from English to ${langName}.
Preserve medical/technical terminology accurately. Keep the tone professional.

TITLE:
${input.title}
${descSection}

Respond ONLY with valid JSON in this exact format (include only fields that were provided):
{
  "title": "<translated title>",
  ${input.description ? '"description": "<translated description>",' : ''}
  "_dummy": null
}

Do not include anything outside the JSON object.`;

  const result = await withRetry(() => model.generateContent(prompt));
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  const parsed = JSON.parse(cleaned) as ExamMetaOutput & { _dummy?: null };
  delete (parsed as { _dummy?: null })._dummy;
  return parsed;
}

export async function batchTranslateExamMeta(
  input: ExamMetaInput,
  languages: SupportedLanguage[]
): Promise<Partial<Record<SupportedLanguage, ExamMetaOutput>>> {
  const results: Partial<Record<SupportedLanguage, ExamMetaOutput>> = {};

  await Promise.all(
    languages.map(async (lang) => {
      results[lang] = await translateExamMeta(input, lang);
    })
  );

  return results;
}

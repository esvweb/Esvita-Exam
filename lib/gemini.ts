import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// ── Clients ───────────────────────────────────────────────────────────────────

function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  return new GoogleGenerativeAI(key);
}

function getOpenAIClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set');
  return new OpenAI({ apiKey: key });
}

// ── AI Score Suggestion (Gemini) ──────────────────────────────────────────────

export interface ScoreSuggestionResult {
  score: number;  // 0–10
  reasoning: string;
}

export async function suggestScore(
  question: string,
  referenceAnswer: string,
  candidateAnswer: string
): Promise<ScoreSuggestionResult> {
  const model = getGeminiClient().getGenerativeModel({ model: 'gemini-2.0-flash' });

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

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  const parsed = JSON.parse(cleaned) as { score: number; reasoning: string };
  const score = Math.max(0, Math.min(10, Math.round(Number(parsed.score))));
  return { score, reasoning: String(parsed.reasoning) };
}

// ── AI Translation (OpenAI gpt-4o-mini) ──────────────────────────────────────

export type SupportedLanguage = 'FRA' | 'RU' | 'TR' | 'ITA';

export interface TranslationInput {
  question: string;
  options?: string[];
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
  const openai = getOpenAIClient();
  const langName = LANG_NAMES[targetLanguage];

  const optionsSection = input.options?.length
    ? `OPTIONS (translate each, preserving order):\n${input.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`
    : '';

  const refSection = input.referenceAnswer ? `REFERENCE ANSWER:\n${input.referenceAnswer}` : '';
  const expSection = input.explanation ? `EXPLANATION:\n${input.explanation}` : '';

  const prompt = `Translate the following exam question content from English to ${langName}.
Preserve medical/technical terminology accurately. Keep the tone professional.

QUESTION:
${input.question}
${optionsSection}
${refSection}
${expSection}

Respond with a JSON object containing only the fields that were provided:
- "question": translated question text
${input.options?.length ? '- "options": array of translated option strings (same count and order)\n' : ''}${input.referenceAnswer ? '- "referenceAnswer": translated reference answer\n' : ''}${input.explanation ? '- "explanation": translated explanation\n' : ''}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const parsed = JSON.parse(response.choices[0].message.content || '{}') as TranslationOutput;
  return parsed;
}

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

// ── Exam metadata translation ─────────────────────────────────────────────────

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
  const openai = getOpenAIClient();
  const langName = LANG_NAMES[targetLanguage];

  const prompt = `Translate the following exam title${input.description ? ' and description' : ''} from English to ${langName}.
Preserve medical/technical terminology accurately. Keep the tone professional.

TITLE:
${input.title}
${input.description ? `\nDESCRIPTION:\n${input.description}` : ''}

Respond with a JSON object with:
- "title": translated title
${input.description ? '- "description": translated description' : ''}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content || '{}') as ExamMetaOutput;
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

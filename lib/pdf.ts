// PDF parsing utility for bulk question import

export interface ParsedQuestion {
  questionText: string;
  options: { key: string; value: string }[];
  correctAnswer: string;
  explanation?: string;
}

/**
 * Parse a structured text/PDF content into questions.
 *
 * Expected format per question:
 * Q: Question text here?
 * A: Option A text
 * B: Option B text
 * C: Option C text
 * D: Option D text
 * ANSWER: B
 * EXPLANATION: Explanation text here (optional)
 *
 * Questions separated by blank lines or "---"
 */
export function parseQuestionsFromText(text: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];

  // Split by question delimiter
  const blocks = text
    .split(/\n(?=Q\d*[:.]|\*\*Q)/i)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  for (const block of blocks) {
    try {
      const lines = block
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      let questionText = '';
      const options: { key: string; value: string }[] = [];
      let correctAnswer = '';
      let explanation = '';
      let inExplanation = false;

      for (const line of lines) {
        // Question line
        if (/^Q\d*[:.]/i.test(line)) {
          questionText = line.replace(/^Q\d*[:.\s]*/i, '').trim();
          inExplanation = false;
        }
        // Option lines
        else if (/^[ABCD][:.]/i.test(line) && !inExplanation) {
          const key = line[0].toUpperCase();
          const value = line.slice(2).trim();
          options.push({ key, value });
        }
        // Answer line
        else if (/^ANSWER[:.\s]/i.test(line)) {
          correctAnswer = line.replace(/^ANSWER[:.\s]*/i, '').trim().toUpperCase();
          inExplanation = false;
        }
        // Explanation line
        else if (/^EXPLANATION[:.\s]/i.test(line)) {
          explanation = line.replace(/^EXPLANATION[:.\s]*/i, '').trim();
          inExplanation = true;
        }
        // Continuation of explanation
        else if (inExplanation) {
          explanation += ' ' + line;
        }
        // Continuation of question
        else if (questionText && options.length === 0) {
          questionText += ' ' + line;
        }
      }

      if (questionText && options.length >= 2 && correctAnswer) {
        questions.push({
          questionText: questionText.trim(),
          options,
          correctAnswer,
          explanation: explanation.trim() || undefined,
        });
      }
    } catch {
      // Skip malformed blocks
    }
  }

  return questions;
}

/**
 * Parse bulk import JSON format.
 *
 * Expected JSON: Array of objects:
 * [{
 *   "question": { "en": "...", "tr": "...", "fra": "...", "ru": "...", "ita": "..." },
 *   "options": {
 *     "en": [{ "key": "A", "value": "..." }, ...],
 *     "tr": [{ "key": "A", "value": "..." }, ...]
 *   },
 *   "correctAnswer": "B",
 *   "explanation": { "en": "...", "tr": "..." }
 * }]
 */
export function parseQuestionsFromJSON(jsonStr: string): Array<Record<string, unknown>> {
  try {
    const data = JSON.parse(jsonStr);
    if (!Array.isArray(data)) throw new Error('Expected array');
    return data;
  } catch (e) {
    throw new Error(`Invalid JSON format: ${e instanceof Error ? e.message : 'unknown error'}`);
  }
}

/**
 * Preprocess markdown / freeform text to the canonical
 * Q:/A:/B:/C:/D:/ANSWER:/EXPLANATION: format so the
 * existing parseQuestionsFromText() parser can handle it.
 *
 * Supported input styles:
 *   ## Question text        →  Q: Question text
 *   - A) option / A: opt    →  A: option
 *   **Answer:** B           →  ANSWER: B
 *   **Explanation:** …      →  EXPLANATION: …
 *   --- separator           →  blank line
 */
export function preprocessMarkdown(text: string): string {
  return text
    .split('\n')
    .map((raw) => {
      const line = raw.trim();

      // Markdown heading → Q:
      if (/^#{1,3}\s+/.test(line)) {
        return 'Q: ' + line.replace(/^#{1,3}\s+/, '').replace(/\*\*/g, '').trim();
      }

      // Bullet option "- A: ..." or "- A) ..." or "A) ..."
      const optMatch = line.match(/^[-*]?\s*([ABCD])[):]\s*(.*)/i);
      if (optMatch) {
        return `${optMatch[1].toUpperCase()}: ${optMatch[2].replace(/\*\*/g, '').trim()}`;
      }

      // **Answer:** B  or  ANSWER: B
      if (/^\*{0,2}answers?\*{0,2}\s*[:]\s*/i.test(line)) {
        const val = line.replace(/^\*{0,2}answers?\*{0,2}\s*[:]\s*/i, '').replace(/\*\*/g, '').trim();
        return 'ANSWER: ' + val;
      }

      // **Explanation:** …  or  EXPLANATION: …
      if (/^\*{0,2}explanations?\*{0,2}\s*[:]\s*/i.test(line)) {
        const val = line.replace(/^\*{0,2}explanations?\*{0,2}\s*[:]\s*/i, '').replace(/\*\*/g, '').trim();
        return 'EXPLANATION: ' + val;
      }

      // --- separator → blank line
      if (/^---+$/.test(line)) return '';

      // Pass through (strip stray markdown bold/italic)
      return line.replace(/\*\*/g, '').replace(/^[*_]+|[*_]+$/g, '');
    })
    .join('\n');
}

/**
 * Parse exam metadata + questions from a full exam file.
 *
 * Expected file structure:
 *
 * # EXAM
 * TITLE_EN: Exam Title in English
 * TITLE_TR: Sınav Başlığı
 * TITLE_FRA: Titre de l'examen
 * TITLE_RU: Название экзамена
 * TITLE_ITA: Titolo dell'esame
 * DESC_EN: Optional description in English
 * DESC_TR: İsteğe bağlı açıklama
 * DESC_FRA: Description facultative
 * DESC_RU: Необязательное описание
 * DESC_ITA: Descrizione facoltativa
 *
 * # QUESTIONS
 *
 * Q: Question text?
 * A: Option A
 * B: Option B
 * ...
 * ANSWER: A
 * EXPLANATION: Optional explanation
 */
export interface ExamFileMetadata {
  titleEn: string; titleTr: string; titleFra: string; titleRu: string; titleIta: string;
  descriptionEn: string; descriptionTr: string; descriptionFra: string;
  descriptionRu: string; descriptionIta: string;
  questions: ParsedQuestion[];
}

export function parseExamFile(text: string): ExamFileMetadata {
  const get = (key: string): string => {
    const m = text.match(new RegExp(`^${key}\\s*:\\s*(.+)`, 'im'));
    return m ? m[1].trim() : '';
  };

  // Extract questions section (after # QUESTIONS header if present)
  const questionsSection = text.match(/^#\s*QUESTIONS?[\s\S]*/im)?.[0] || text;

  // Auto-detect markdown format and preprocess if needed
  const isMarkdown =
    /^#{1,3}\s+/m.test(questionsSection) ||
    /\*\*answer\*\*/i.test(questionsSection) ||
    /^[-*]\s*[ABCD][):]/m.test(questionsSection);
  const processedText = isMarkdown ? preprocessMarkdown(questionsSection) : questionsSection;
  const questions = parseQuestionsFromText(processedText);

  return {
    titleEn:  get('TITLE_EN'),
    titleTr:  get('TITLE_TR'),
    titleFra: get('TITLE_FRA'),
    titleRu:  get('TITLE_RU'),
    titleIta: get('TITLE_ITA'),
    descriptionEn:  get('DESC_EN'),
    descriptionTr:  get('DESC_TR'),
    descriptionFra: get('DESC_FRA'),
    descriptionRu:  get('DESC_RU'),
    descriptionIta: get('DESC_ITA'),
    questions,
  };
}

/**
 * Attempt to extract text from a Buffer (simulated PDF parsing).
 * In production, use the `pdf-parse` library:
 *   import pdfParse from 'pdf-parse';
 *   const data = await pdfParse(buffer);
 *   return data.text;
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import to avoid SSR issues
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'unknown'}`);
  }
}

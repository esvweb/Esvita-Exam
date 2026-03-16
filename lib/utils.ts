// ─── Array Shuffle (Fisher-Yates) ────────────────────────────────────────────
export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Language Helpers ─────────────────────────────────────────────────────────
export const LANGUAGES = ['EN', 'FRA', 'RU', 'TR', 'ITA'] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  EN: 'English',
  FRA: 'Français',
  RU: 'Русский',
  TR: 'Türkçe',
  ITA: 'Italiano',
};

export const LANGUAGE_FLAGS: Record<Language, string> = {
  EN: '🇬🇧',
  FRA: '🇫🇷',
  RU: '🇷🇺',
  TR: '🇹🇷',
  ITA: '🇮🇹',
};

// Get localized field from exam/question using language code
export function getLocalized(obj: Record<string, unknown>, field: string, lang: string): string {
  const suffix = lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase();
  const key = `${field}${suffix}`;
  return (obj[key] as string) || (obj[`${field}En`] as string) || '';
}

// Check which languages have content in an exam
export function getAvailableLanguages(exam: Record<string, unknown>): Language[] {
  return LANGUAGES.filter((lang) => {
    const suffix = lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase();
    const title = exam[`title${suffix}`] as string | null;
    return title && title.trim().length > 0;
  });
}

// ─── Score Calculation ────────────────────────────────────────────────────────
export function calculateScore(correctCount: number, totalQuestions: number): number {
  if (totalQuestions === 0) return 0;
  return Math.round((correctCount / totalQuestions) * 100);
}

// ─── Time Formatting ──────────────────────────────────────────────────────────
export function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────
export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function isExpired(date: Date): boolean {
  return new Date() > date;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── API Response Helpers ─────────────────────────────────────────────────────
export function apiError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function apiSuccess<T>(data: T, status = 200) {
  return Response.json(data, { status });
}

// ─── CSV/Excel Export ─────────────────────────────────────────────────────────
export function arrayToCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (val: string | number | null | undefined) => {
    const str = String(val ?? '');
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))];
  return lines.join('\n');
}

// ─── Misc ─────────────────────────────────────────────────────────────────────
export function truncate(str: string, maxLen = 50): string {
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}

export function classNames(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

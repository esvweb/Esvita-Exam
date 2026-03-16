'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Spinner from '@/components/ui/Spinner';
import { ArrowLeft, Eye, CheckCircle2, XCircle, Globe } from 'lucide-react';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS, getAvailableLanguages } from '@/lib/utils';
import type { Language } from '@/types';

const LANG_KEYS: Record<Language, { q: string; opts: string; exp: string }> = {
  EN:  { q: 'questionEn',  opts: 'optionsEn',  exp: 'explanationEn'  },
  FRA: { q: 'questionFra', opts: 'optionsFra', exp: 'explanationFra' },
  RU:  { q: 'questionRu',  opts: 'optionsRu',  exp: 'explanationRu'  },
  TR:  { q: 'questionTr',  opts: 'optionsTr',  exp: 'explanationTr'  },
  ITA: { q: 'questionIta', opts: 'optionsIta', exp: 'explanationIta' },
};

interface Question {
  id: string; orderIndex: number; correctAnswer: string;
  questionEn: string | null; questionFra: string | null; questionRu: string | null;
  questionTr: string | null; questionIta: string | null;
  optionsEn: string | null; optionsFra: string | null; optionsRu: string | null;
  optionsTr: string | null; optionsIta: string | null;
  explanationEn: string | null; explanationFra: string | null; explanationRu: string | null;
  explanationTr: string | null; explanationIta: string | null;
}

interface Exam {
  id: string; timePerQuestion: number;
  titleEn: string | null; titleFra: string | null; titleRu: string | null;
  titleTr: string | null; titleIta: string | null;
  descriptionEn: string | null;
  questions: Question[];
  _count: { questions: number };
}

export default function ExamPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<Language>('EN');

  const fetchExam = useCallback(async () => {
    const res = await fetch(`/api/admin/exams/${id}`);
    if (res.ok) {
      const data = await res.json();
      setExam(data);
      // Default to first available language
      const avail = getAvailableLanguages(data as unknown as Record<string, unknown>);
      if (avail.length > 0) setLang(avail[0]);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchExam(); }, [fetchExam]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner className="text-blue-500" />
    </div>
  );

  if (!exam) return (
    <div className="min-h-screen flex items-center justify-center text-slate-500">
      Exam not found.
    </div>
  );

  const availLangs = getAvailableLanguages(exam as unknown as Record<string, unknown>);
  const title = (exam as unknown as Record<string, unknown>)[`title${lang.charAt(0)}${lang.slice(1).toLowerCase()}`] as string
    || exam.titleEn || exam.titleTr || 'Untitled Exam';

  const getQ = (q: Question) => {
    const keys = LANG_KEYS[lang];
    const text = (q as unknown as Record<string, string | null>)[keys.q]
      || q.questionEn || q.questionTr || 'No question text for this language';
    const optsRaw = (q as unknown as Record<string, string | null>)[keys.opts] || q.optionsEn;
    const opts: { key: string; value: string }[] = optsRaw ? JSON.parse(optsRaw) : [];
    const exp = (q as unknown as Record<string, string | null>)[keys.exp] || q.explanationEn || null;
    return { text, opts, exp };
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Admin preview banner */}
      <div className="bg-amber-400 text-amber-900 px-4 py-2.5 flex items-center justify-between text-sm font-medium">
        <div className="flex items-center gap-2">
          <Eye size={16} />
          <span>Admin Preview Mode — candidates will not see this bar</span>
        </div>
        <Link href={`/exams/${id}`} className="flex items-center gap-1.5 text-amber-800 hover:text-amber-900 font-semibold">
          <ArrowLeft size={14} /> Back to Exam
        </Link>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Exam header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-xl font-bold text-slate-800">{title}</h1>
              {exam.descriptionEn && (
                <p className="text-slate-500 text-sm mt-1">{exam.descriptionEn}</p>
              )}
            </div>
            {/* Language switcher */}
            {availLangs.length > 1 && (
              <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 flex-shrink-0">
                <Globe size={13} className="text-slate-400 ml-1" />
                {availLangs.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                      lang === l ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {LANGUAGE_FLAGS[l]} {l}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400 pt-3 border-t border-slate-100">
            <span>{exam._count.questions} questions</span>
            <span>·</span>
            <span>{exam.timePerQuestion}s per question</span>
            <span>·</span>
            <span>~{Math.ceil((exam._count.questions * exam.timePerQuestion) / 60)} min total</span>
            <span>·</span>
            <span className="text-amber-600 font-medium">{LANGUAGE_LABELS[lang]}</span>
          </div>
        </div>

        {/* Questions */}
        {exam.questions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
            No questions added yet.
          </div>
        ) : (
          <div className="space-y-4">
            {exam.questions.map((q, i) => {
              const { text, opts, exp } = getQ(q);
              return (
                <div key={q.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  {/* Question number + text */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-slate-800 font-medium text-sm leading-relaxed">{text}</p>
                  </div>

                  {/* Options */}
                  {opts.length > 0 ? (
                    <div className="space-y-2 ml-10">
                      {opts.map((opt) => {
                        const isCorrect = opt.key === q.correctAnswer;
                        return (
                          <div
                            key={opt.key}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition-all ${
                              isCorrect
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                : 'border-slate-200 bg-slate-50 text-slate-600'
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                              isCorrect ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-slate-500'
                            }`}>
                              {opt.key}
                            </div>
                            <span className="flex-1">{opt.value}</span>
                            {isCorrect && <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="ml-10 flex items-center gap-2 text-slate-400 text-sm">
                      <XCircle size={14} />
                      <span>No options for {LANGUAGE_LABELS[lang]}</span>
                    </div>
                  )}

                  {/* Explanation */}
                  {exp && (
                    <div className="ml-10 mt-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-700 leading-relaxed">
                      <span className="font-semibold">Explanation: </span>{exp}
                    </div>
                  )}

                  {/* Correct answer badge (admin info) */}
                  <div className="ml-10 mt-2 flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Correct answer:</span>
                    <span className="badge-green text-xs">{q.correctAnswer}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

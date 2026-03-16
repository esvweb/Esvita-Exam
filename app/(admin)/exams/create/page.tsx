'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/admin/Header';
import { useToast } from '@/components/ui/Toast';
import { ArrowLeft, Save, Clock, Globe } from 'lucide-react';
import Link from 'next/link';
import Spinner from '@/components/ui/Spinner';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS } from '@/lib/utils';
import type { Language } from '@/types';

const LANGS: Language[] = ['EN', 'FRA', 'RU', 'TR', 'ITA'];

export default function CreateExamPage() {
  const router = useRouter();
  const { success, error } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    titleEn: '', titleFra: '', titleRu: '', titleTr: '', titleIta: '',
    descriptionEn: '', descriptionFra: '', descriptionRu: '', descriptionTr: '', descriptionIta: '',
    timePerQuestion: 60,
    validityHours: 72,
  });

  const titleKey = (lang: Language) => `title${lang.charAt(0)}${lang.slice(1).toLowerCase()}` as keyof typeof form;
  const descKey  = (lang: Language) => `description${lang.charAt(0)}${lang.slice(1).toLowerCase()}` as keyof typeof form;

  // Correct casing for keys
  const langKeyMap: Record<Language, { title: keyof typeof form; desc: keyof typeof form }> = {
    EN:  { title: 'titleEn',  desc: 'descriptionEn'  },
    FRA: { title: 'titleFra', desc: 'descriptionFra' },
    RU:  { title: 'titleRu',  desc: 'descriptionRu'  },
    TR:  { title: 'titleTr',  desc: 'descriptionTr'  },
    ITA: { title: 'titleIta', desc: 'descriptionIta' },
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasTitle = LANGS.some((l) => (form[langKeyMap[l].title] as string).trim().length > 0);
    if (!hasTitle) {
      error('Please fill in at least one language title');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/admin/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const exam = await res.json();
      success('Exam created successfully');
      router.push(`/exams/${exam.id}`);
    } else {
      const d = await res.json();
      error(d.error || 'Failed to create exam');
      setSaving(false);
    }
  };

  return (
    <div>
      <Header title="Create New Exam" subtitle="Configure exam details and content" />
      <div className="p-6 max-w-4xl">
        <Link href="/exams" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors mb-5">
          <ArrowLeft size={15} /> Back to Exams
        </Link>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Time Setting */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2 mb-4">
              <Clock size={16} className="text-blue-600" /> Exam Settings
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="label">Time Per Question (seconds)</label>
                <input
                  type="number"
                  className="input"
                  min={10}
                  max={600}
                  value={form.timePerQuestion}
                  onChange={(e) => setForm((f) => ({ ...f, timePerQuestion: parseInt(e.target.value) || 60 }))}
                />
                <p className="text-xs text-slate-400 mt-1">
                  Default: 60s. Total time is calculated automatically based on question count.
                </p>
              </div>
              <div className="form-group">
                <label className="label">Total Time (estimated)</label>
                <div className="input bg-slate-50 text-slate-500 cursor-default">
                  Calculated after adding questions
                </div>
                <p className="text-xs text-slate-400 mt-1">= Questions × Time per question</p>
              </div>
              <div className="form-group">
                <label className="label">Validity Period (hours)</label>
                <input
                  type="number"
                  className="input"
                  min={1}
                  max={720}
                  value={form.validityHours}
                  onChange={(e) => setForm((f) => ({ ...f, validityHours: parseInt(e.target.value) || 72 }))}
                />
                <p className="text-xs text-slate-400 mt-1">
                  Results are emailed automatically after this period (from first invite/completion). Default: 72h.
                </p>
              </div>
              <div className="form-group">
                <label className="label">Results Delivery</label>
                <div className="input bg-slate-50 text-slate-500 cursor-default">
                  Auto — sent via scheduled job
                </div>
                <p className="text-xs text-slate-400 mt-1">Candidates get a confirmation email immediately, results later.</p>
              </div>
            </div>
          </div>

          {/* Multilingual Content */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2 mb-1">
              <Globe size={16} className="text-blue-600" /> Multilingual Content
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Fill in at least one language. Only languages with a title will be shown to candidates.
            </p>

            <div className="space-y-5">
              {LANGS.map((lang) => {
                const keys = langKeyMap[lang];
                return (
                  <div key={lang} className="border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">{LANGUAGE_FLAGS[lang]}</span>
                      <span className="font-semibold text-slate-700 text-sm">{LANGUAGE_LABELS[lang]}</span>
                      {(form[keys.title] as string).trim().length > 0 && (
                        <span className="badge-green ml-auto">Filled</span>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="form-group">
                        <label className="label text-xs">Exam Title</label>
                        <input
                          className="input"
                          placeholder={`Exam title in ${LANGUAGE_LABELS[lang]}`}
                          value={form[keys.title] as string}
                          onChange={(e) => setForm((f) => ({ ...f, [keys.title]: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="label text-xs">Description (optional)</label>
                        <textarea
                          className="input resize-none"
                          rows={2}
                          placeholder={`Exam description in ${LANGUAGE_LABELS[lang]}`}
                          value={form[keys.desc] as string}
                          onChange={(e) => setForm((f) => ({ ...f, [keys.desc]: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Link href="/exams" className="btn-secondary">Cancel</Link>
            <button type="submit" className="btn-primary btn-lg" disabled={saving}>
              {saving ? <Spinner size="sm" className="text-white" /> : <Save size={18} />}
              {saving ? 'Creating Exam...' : 'Create Exam & Add Questions'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

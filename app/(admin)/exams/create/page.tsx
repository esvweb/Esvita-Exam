'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/admin/Header';
import { useToast } from '@/components/ui/Toast';
import { ArrowLeft, Save, Clock, Globe, Settings, Tag, User } from 'lucide-react';
import Link from 'next/link';
import Spinner from '@/components/ui/Spinner';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS } from '@/lib/utils';
import type { Language } from '@/types';

const LANGS: Language[] = ['EN', 'FRA', 'RU', 'TR', 'ITA'];

const LANG_KEYS: Record<Language, { title: string; desc: string }> = {
  EN:  { title: 'titleEn',  desc: 'descriptionEn'  },
  FRA: { title: 'titleFra', desc: 'descriptionFra' },
  RU:  { title: 'titleRu',  desc: 'descriptionRu'  },
  TR:  { title: 'titleTr',  desc: 'descriptionTr'  },
  ITA: { title: 'titleIta', desc: 'descriptionIta' },
};

interface AdminUser { id: string; name: string; email: string; role: string; }

export default function CreateExamPage() {
  const router = useRouter();
  const { success, error } = useToast();
  const [saving, setSaving] = useState(false);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');

  const [form, setForm] = useState({
    titleEn: '', titleFra: '', titleRu: '', titleTr: '', titleIta: '',
    descriptionEn: '', descriptionFra: '', descriptionRu: '', descriptionTr: '', descriptionIta: '',
    timePerQuestion: 60,
    validityHours: 72,
    passMarkPercent: 60,
    status: 'draft' as 'draft' | 'scheduled' | 'published',
    scheduledPublishAt: '',
    resultAnnouncementDate: '',
    supervisorId: '',
    categories: [] as string[],
    tags: [] as string[],
  });

  useEffect(() => {
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((d) => {
        const eligible = (Array.isArray(d) ? d : []).filter((u: AdminUser) =>
          u.role === 'super_admin' || u.role === 'admin'
        );
        setAdmins(eligible);
      })
      .catch(() => {});
  }, []);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) setForm((f) => ({ ...f, tags: [...f.tags, t] }));
    setTagInput('');
  };

  const addCategory = () => {
    const c = categoryInput.trim();
    if (c && !form.categories.includes(c)) setForm((f) => ({ ...f, categories: [...f.categories, c] }));
    setCategoryInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasTitle = LANGS.some((l) => (form[LANG_KEYS[l].title as keyof typeof form] as string).trim().length > 0);
    if (!hasTitle) { error('Please fill in at least one language title'); return; }
    if (form.status === 'scheduled' && !form.scheduledPublishAt) {
      error('Please set a scheduled publish date'); return;
    }
    setSaving(true);

    const payload = {
      ...form,
      scheduledPublishAt: form.scheduledPublishAt || null,
      resultAnnouncementDate: form.resultAnnouncementDate || null,
      supervisorId: form.supervisorId || null,
    };

    const res = await fetch('/api/admin/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const d = await res.json();
      success('Exam created successfully');
      router.push(`/exams/${d.id}`);
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

          {/* Exam Settings */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2 mb-4">
              <Clock size={16} className="text-blue-600" /> Exam Settings
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="label">Time Per Question (seconds)</label>
                <input type="number" className="input" min={10} max={600}
                  value={form.timePerQuestion}
                  onChange={(e) => setForm((f) => ({ ...f, timePerQuestion: parseInt(e.target.value) || 60 }))} />
              </div>
              <div className="form-group">
                <label className="label">Validity Period (hours)</label>
                <input type="number" className="input" min={1} max={720}
                  value={form.validityHours}
                  onChange={(e) => setForm((f) => ({ ...f, validityHours: parseInt(e.target.value) || 72 }))} />
                <p className="text-xs text-slate-400 mt-1">Fallback window if no announcement date is set.</p>
              </div>
              <div className="form-group">
                <label className="label">Pass Mark (%)</label>
                <input type="number" className="input" min={0} max={100}
                  value={form.passMarkPercent}
                  onChange={(e) => setForm((f) => ({ ...f, passMarkPercent: parseInt(e.target.value) || 60 }))} />
              </div>
              <div className="form-group">
                <label className="label">Initial Status</label>
                <select className="input" value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as typeof form.status }))}>
                  <option value="draft">Draft (not assignable yet)</option>
                  <option value="scheduled">Scheduled (auto-publish at date)</option>
                  <option value="published">Published (live immediately)</option>
                </select>
              </div>
              {form.status === 'scheduled' && (
                <div className="form-group col-span-2">
                  <label className="label">Scheduled Publish Date & Time</label>
                  <input type="datetime-local" className="input"
                    value={form.scheduledPublishAt}
                    onChange={(e) => setForm((f) => ({ ...f, scheduledPublishAt: e.target.value }))} />
                </div>
              )}
            </div>
          </div>

          {/* Supervisor & Announcement */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2 mb-4">
              <User size={16} className="text-blue-600" /> Supervisor & Result Announcement
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="label">Assigned Supervisor</label>
                <select className="input" value={form.supervisorId}
                  onChange={(e) => setForm((f) => ({ ...f, supervisorId: e.target.value }))}>
                  <option value="">No supervisor (MC-only exam)</option>
                  {admins.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">Required if exam contains short-answer questions.</p>
              </div>
              <div className="form-group">
                <label className="label">Result Announcement Date & Time</label>
                <input type="datetime-local" className="input"
                  value={form.resultAnnouncementDate}
                  onChange={(e) => setForm((f) => ({ ...f, resultAnnouncementDate: e.target.value }))} />
                <p className="text-xs text-slate-400 mt-1">
                  Supervisor&apos;s review deadline. Results release on this date. A reminder is sent 24h before.
                </p>
              </div>
            </div>
          </div>

          {/* Categories & Tags */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2 mb-4">
              <Tag size={16} className="text-blue-600" /> Categories &amp; Tags
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="label">Categories</label>
                <div className="flex gap-2">
                  <input className="input flex-1" placeholder="e.g. Product Knowledge"
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }} />
                  <button type="button" className="btn-secondary" onClick={addCategory}>Add</button>
                </div>
                {form.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.categories.map((c) => (
                      <span key={c} className="badge-blue flex items-center gap-1">
                        {c}
                        <button type="button" className="ml-0.5 hover:text-red-600"
                          onClick={() => setForm((f) => ({ ...f, categories: f.categories.filter((x) => x !== c) }))}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="label">Tags</label>
                <div className="flex gap-2">
                  <input className="input flex-1" placeholder="e.g. mandatory, q1-2026"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
                  <button type="button" className="btn-secondary" onClick={addTag}>Add</button>
                </div>
                {form.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.tags.map((t) => (
                      <span key={t} className="badge-gray flex items-center gap-1">
                        #{t}
                        <button type="button" className="ml-0.5 hover:text-red-600"
                          onClick={() => setForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== t) }))}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Multilingual Content */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2 mb-1">
              <Globe size={16} className="text-blue-600" /> Multilingual Content
            </h3>
            <p className="text-xs text-slate-400 mb-5">Fill in at least one language. Only languages with a title are shown to candidates.</p>
            <div className="space-y-5">
              {LANGS.map((lang) => {
                const keys = LANG_KEYS[lang];
                const titleVal = form[keys.title as keyof typeof form] as string;
                return (
                  <div key={lang} className="border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">{LANGUAGE_FLAGS[lang]}</span>
                      <span className="font-semibold text-slate-700 text-sm">{LANGUAGE_LABELS[lang]}</span>
                      {titleVal.trim().length > 0 && <span className="badge-green ml-auto">Filled</span>}
                    </div>
                    <div className="space-y-3">
                      <div className="form-group">
                        <label className="label text-xs">Exam Title</label>
                        <input className="input" placeholder={`Exam title in ${LANGUAGE_LABELS[lang]}`}
                          value={titleVal}
                          onChange={(e) => setForm((f) => ({ ...f, [keys.title]: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label className="label text-xs">Description (optional)</label>
                        <textarea className="input resize-none" rows={2}
                          placeholder={`Exam description in ${LANGUAGE_LABELS[lang]}`}
                          value={form[keys.desc as keyof typeof form] as string}
                          onChange={(e) => setForm((f) => ({ ...f, [keys.desc]: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Link href="/exams" className="btn-secondary">Cancel</Link>
            <button type="submit" className="btn-primary btn-lg" disabled={saving}>
              {saving ? <Spinner size="sm" className="text-white" /> : <Save size={18} />}
              {saving ? 'Creating...' : 'Create Exam & Add Questions'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

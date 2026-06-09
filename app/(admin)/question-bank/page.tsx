'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/admin/Header';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Search, Plus, Trash2, Languages, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

const OPTION_KEYS = ['A', 'B', 'C', 'D'];

interface NewQuestionForm {
  type: 'multiple_choice' | 'short_answer';
  questionEn: string;
  questionFra: string;
  questionRu: string;
  questionTr: string;
  questionIta: string;
  options: { key: string; value: string }[];
  correctAnswer: string;
  referenceAnswerEn: string;
  maxScore: number;
  categories: string;
  tags: string;
}

function emptyForm(): NewQuestionForm {
  return {
    type: 'multiple_choice',
    questionEn: '',
    questionFra: '',
    questionRu: '',
    questionTr: '',
    questionIta: '',
    options: OPTION_KEYS.map((k) => ({ key: k, value: '' })),
    correctAnswer: 'A',
    referenceAnswerEn: '',
    maxScore: 10,
    categories: '',
    tags: '',
  };
}

interface BankQuestion {
  id: string;
  type: string;
  questionEn: string | null;
  questionTr: string | null;
  questionFra: string | null;
  questionRu: string | null;
  questionIta: string | null;
  correctAnswer: string | null;
  maxScore: number;
  referenceAnswerEn: string | null;
  categories: string[];
  tags: string[];
  usedInCount: number;
  createdAt: string;
  creator: { name: string } | null;
}

type SupportedLang = 'FRA' | 'RU' | 'TR' | 'ITA';
const TRANSLATE_LANGS: { value: SupportedLang; label: string }[] = [
  { value: 'FRA', label: 'French' },
  { value: 'RU', label: 'Russian' },
  { value: 'TR', label: 'Turkish' },
  { value: 'ITA', label: 'Italian' },
];

export default function QuestionBankPage() {
  const { success, error } = useToast();
  const [items, setItems] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [translating, setTranslating] = useState<string | null>(null);
  const [translateLangs, setTranslateLangs] = useState<Set<SupportedLang>>(new Set());
  const [showTranslateModal, setShowTranslateModal] = useState<string | null>(null);

  const [userRole, setUserRole] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<NewQuestionForm>(emptyForm());
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setUserRole(d?.role || ''));
  }, []);

  const handleAddQuestion = async () => {
    if (!addForm.questionEn.trim()) { error('English question text is required'); return; }
    if (addForm.type === 'multiple_choice') {
      const filledOpts = addForm.options.filter((o) => o.value.trim());
      if (filledOpts.length < 2) { error('Add at least 2 answer options'); return; }
    }

    const isMC = addForm.type === 'multiple_choice';
    const optionsJson = isMC
      ? JSON.stringify(addForm.options.filter((o) => o.value.trim()))
      : null;

    const payload = {
      type: addForm.type,
      questionEn: addForm.questionEn.trim(),
      questionFra: addForm.questionFra.trim() || null,
      questionRu: addForm.questionRu.trim() || null,
      questionTr: addForm.questionTr.trim() || null,
      questionIta: addForm.questionIta.trim() || null,
      optionsEn: optionsJson,
      correctAnswer: isMC ? addForm.correctAnswer : null,
      referenceAnswerEn: !isMC ? addForm.referenceAnswerEn.trim() || null : null,
      maxScore: !isMC ? addForm.maxScore : 0,
      categories: addForm.categories.split(',').map((c) => c.trim()).filter(Boolean),
      tags: addForm.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
    };

    setAddSaving(true);
    const res = await fetch('/api/admin/question-bank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      success('Question added to bank');
      setShowAddModal(false);
      setAddForm(emptyForm());
      fetchItems();
    } else {
      const d = await res.json();
      error(d.error || 'Failed to add question');
    }
    setAddSaving(false);
  };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (typeFilter) params.set('type', typeFilter);
    const res = await fetch(`/api/admin/question-bank?${params}`);
    if (res.ok) {
      const d = await res.json();
      setItems(Array.isArray(d) ? d : []);
    }
    setLoading(false);
  }, [search, typeFilter]);

  // Unique categories across all loaded items for the filter row
  const allCategories = Array.from(new Set(items.flatMap((i) => i.categories))).sort();
  const displayItems = categoryFilter
    ? items.filter((i) => i.categories.includes(categoryFilter))
    : items;

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleDelete = async () => {
    if (!deleteId) return;
    const res = await fetch(`/api/admin/question-bank/${deleteId}`, { method: 'DELETE' });
    if (res.ok) { success('Question deleted from bank'); fetchItems(); }
    else { error('Failed to delete'); }
    setDeleteId(null);
  };

  const handleTranslate = async (id: string) => {
    if (translateLangs.size === 0) { error('Select at least one language'); return; }
    setTranslating(id);
    const res = await fetch(`/api/admin/question-bank/${id}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ languages: Array.from(translateLangs) }),
    });
    if (res.ok) {
      success('Translation complete');
      setShowTranslateModal(null);
      setTranslateLangs(new Set());
      fetchItems();
    } else {
      const d = await res.json();
      error(d.error || 'Translation failed');
    }
    setTranslating(null);
  };

  const canDelete = userRole === 'super_admin' || userRole === 'admin';

  return (
    <div>
      <Header
        title="Question Bank"
        subtitle="Shared library of reusable questions. Questions are copied into exams — edits here don't affect existing exams."
      />
      <div className="p-6">

        {/* Filters */}
        <div className="flex gap-3 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9 w-full"
              placeholder="Search questions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="input w-44" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            <option value="multiple_choice">Multiple Choice</option>
            <option value="short_answer">Short Answer</option>
          </select>
          <button
            className="btn-primary flex items-center gap-1.5"
            onClick={() => { setAddForm(emptyForm()); setShowAddModal(true); }}
          >
            <Plus size={15} /> Add Question
          </button>
        </div>

        {/* Category filter chips */}
        {allCategories.length > 0 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setCategoryFilter('')}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                !categoryFilter
                  ? 'bg-slate-700 border-slate-700 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              All categories
            </button>
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  categoryFilter === cat
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : items.length === 0 ? (
          <div className="card p-12 text-center">
            <BookOpen size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">No questions in the bank yet.</p>
            <p className="text-slate-400 text-sm mt-1">
              When adding questions to an exam, check &ldquo;Save a copy to Question Bank&rdquo; to build your library.
            </p>
          </div>
        ) : displayItems.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-slate-500 text-sm">No questions match the selected category.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              {displayItems.length} question{displayItems.length !== 1 ? 's' : ''}
              {categoryFilter ? ` in "${categoryFilter}"` : ' in bank'}
            </p>
            {displayItems.map((item) => (
              <div key={item.id} className="card overflow-hidden">
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  <span className={`badge mt-0.5 shrink-0 ${item.type === 'multiple_choice' ? 'badge-blue' : 'badge-teal'}`}>
                    {item.type === 'multiple_choice' ? 'MC' : 'SA'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 line-clamp-2">
                      {item.questionEn || item.questionTr || '(no English text)'}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {item.categories.map((c) => (
                        <span key={c} className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{c}</span>
                      ))}
                      {item.tags.map((t) => (
                        <span key={t} className="text-xs text-slate-500">#{t}</span>
                      ))}
                      <span className="text-xs text-slate-400 ml-auto">
                        Used in {item.usedInCount} exam{item.usedInCount !== 1 ? 's' : ''}
                        {item.creator ? ` · by ${item.creator.name}` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setTranslateLangs(new Set()); setShowTranslateModal(item.id); }}
                      className="btn-secondary btn-sm"
                      title="AI Translate"
                    >
                      <Languages size={14} /> Translate
                    </button>
                    {canDelete && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteId(item.id); }}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                    {expandedId === item.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </div>
                </div>

                {expandedId === item.id && (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3 bg-slate-50 space-y-3">
                    {['En', 'Fra', 'Ru', 'Tr', 'Ita'].map((suffix) => {
                      const q = item[`question${suffix}` as keyof BankQuestion] as string | null;
                      const ref = item[`referenceAnswer${suffix}` as keyof BankQuestion] as string | null;
                      if (!q) return null;
                      return (
                        <div key={suffix}>
                          <p className="text-xs font-semibold text-slate-500 mb-0.5">{suffix.toUpperCase()}</p>
                          <p className="text-sm text-slate-700">{q}</p>
                          {ref && <p className="text-xs text-teal-700 mt-1"><span className="font-medium">Ref:</span> {ref}</p>}
                        </div>
                      );
                    })}
                    {item.type === 'multiple_choice' && item.correctAnswer && (
                      <p className="text-xs text-emerald-700 font-medium">Correct: {item.correctAnswer}</p>
                    )}
                    {item.type === 'short_answer' && (
                      <p className="text-xs text-teal-600">Max score: {item.maxScore}/10</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Question Modal */}
      {showAddModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowAddModal(false)}
          title="Add Question to Bank"
          size="lg"
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">

            {/* Type */}
            <div className="form-group">
              <label className="label">Question Type</label>
              <div className="flex gap-3">
                {(['multiple_choice', 'short_answer'] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="qtype"
                      checked={addForm.type === t}
                      onChange={() => setAddForm((f) => ({ ...f, type: t }))}
                      className="accent-blue-600"
                    />
                    <span className="text-sm">{t === 'multiple_choice' ? 'Multiple Choice' : 'Short Answer'}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Question text — EN (required) */}
            <div className="form-group">
              <label className="label">Question (English) <span className="text-red-500">*</span></label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Enter the question in English"
                value={addForm.questionEn}
                onChange={(e) => setAddForm((f) => ({ ...f, questionEn: e.target.value }))}
              />
            </div>

            {/* MC options */}
            {addForm.type === 'multiple_choice' && (
              <div className="form-group">
                <label className="label">Answer Options</label>
                <div className="space-y-2">
                  {addForm.options.map((opt, i) => (
                    <div key={opt.key} className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-xs font-bold text-slate-600 flex items-center justify-center flex-shrink-0">
                        {opt.key}
                      </span>
                      <input
                        className="input flex-1"
                        placeholder={`Option ${opt.key}`}
                        value={opt.value}
                        onChange={(e) => {
                          const next = [...addForm.options];
                          next[i] = { ...next[i], value: e.target.value };
                          setAddForm((f) => ({ ...f, options: next }));
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 form-group">
                  <label className="label text-xs">Correct Answer</label>
                  <div className="flex gap-2">
                    {addForm.options.filter((o) => o.value.trim()).map((opt) => (
                      <label key={opt.key} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="correct"
                          checked={addForm.correctAnswer === opt.key}
                          onChange={() => setAddForm((f) => ({ ...f, correctAnswer: opt.key }))}
                          className="accent-emerald-600"
                        />
                        <span className="text-sm font-medium">{opt.key}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SA reference answer + max score */}
            {addForm.type === 'short_answer' && (
              <div className="space-y-3">
                <div className="form-group">
                  <label className="label">Reference Answer (English)</label>
                  <textarea
                    className="input resize-none border-teal-300 focus:ring-teal-400"
                    rows={3}
                    placeholder="Ideal answer for AI scoring reference"
                    value={addForm.referenceAnswerEn}
                    onChange={(e) => setAddForm((f) => ({ ...f, referenceAnswerEn: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="label">Max Score (0–10)</label>
                  <input
                    type="number"
                    className="input w-24"
                    min={1}
                    max={10}
                    value={addForm.maxScore}
                    onChange={(e) => setAddForm((f) => ({ ...f, maxScore: parseInt(e.target.value) || 10 }))}
                  />
                </div>
              </div>
            )}

            {/* Optional other languages */}
            <details className="border border-slate-200 rounded-lg">
              <summary className="px-3 py-2 text-xs font-semibold text-slate-500 cursor-pointer select-none">
                Other languages (optional)
              </summary>
              <div className="p-3 space-y-3">
                {(['Fra', 'Ru', 'Tr', 'Ita'] as const).map((suffix) => {
                  const labelMap = { Fra: 'French', Ru: 'Russian', Tr: 'Turkish', Ita: 'Italian' };
                  const key = `question${suffix}` as keyof NewQuestionForm;
                  return (
                    <div key={suffix} className="form-group">
                      <label className="label text-xs">{labelMap[suffix]}</label>
                      <textarea
                        className="input resize-none"
                        rows={2}
                        placeholder={`Question in ${labelMap[suffix]}`}
                        value={addForm[key] as string}
                        onChange={(e) => setAddForm((f) => ({ ...f, [key]: e.target.value }))}
                      />
                    </div>
                  );
                })}
              </div>
            </details>

            {/* Categories & Tags */}
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label text-xs">Categories <span className="font-normal text-slate-400">(comma separated)</span></label>
                <input
                  className="input"
                  placeholder="e.g. Product, Compliance"
                  value={addForm.categories}
                  onChange={(e) => setAddForm((f) => ({ ...f, categories: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="label text-xs">Tags <span className="font-normal text-slate-400">(comma separated)</span></label>
                <input
                  className="input"
                  placeholder="e.g. mandatory, q1"
                  value={addForm.tags}
                  onChange={(e) => setAddForm((f) => ({ ...f, tags: e.target.value }))}
                />
              </div>
            </div>

          </div>

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
            <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
            <button
              className="btn-primary"
              onClick={handleAddQuestion}
              disabled={addSaving}
            >
              {addSaving ? <Spinner size="sm" className="text-white" /> : <Plus size={15} />}
              {addSaving ? 'Saving...' : 'Add to Bank'}
            </button>
          </div>
        </Modal>
      )}

      {/* Translate Modal */}
      {showTranslateModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowTranslateModal(null)}
          title="AI Translation"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Select languages to translate into. The AI will use the English version as source.
            </p>
            <div className="space-y-2">
              {TRANSLATE_LANGS.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-blue-600"
                    checked={translateLangs.has(value)}
                    onChange={(e) => {
                      const next = new Set(translateLangs);
                      if (e.target.checked) next.add(value); else next.delete(value);
                      setTranslateLangs(next);
                    }}
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-amber-600">Existing translations for selected languages will be overwritten.</p>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowTranslateModal(null)}>Cancel</button>
              <button
                className="btn-primary"
                onClick={() => handleTranslate(showTranslateModal)}
                disabled={!!translating}
              >
                {translating ? <Spinner size="sm" className="text-white" /> : <Languages size={15} />}
                {translating ? 'Translating...' : 'Translate'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete from Question Bank"
        message="This removes the question from the bank only. Exams that already imported this question are not affected."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
        variant="danger"
      />
    </div>
  );
}

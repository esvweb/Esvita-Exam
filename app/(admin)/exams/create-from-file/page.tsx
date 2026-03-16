'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/admin/Header';
import { useToast } from '@/components/ui/Toast';
import {
  ArrowLeft, Upload, FileText, Clock, Globe,
  CheckCircle2, AlertCircle, Download, Clipboard, X,
} from 'lucide-react';
import Link from 'next/link';
import Spinner from '@/components/ui/Spinner';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS } from '@/lib/utils';
import type { Language } from '@/types';
import PageTransition from '@/components/ui/PageTransition';

const LANGS: Language[] = ['EN', 'TR', 'FRA', 'RU', 'ITA'];

const LANG_KEY_MAP: Record<Language, { title: string; desc: string }> = {
  EN:  { title: 'titleEn',  desc: 'descriptionEn'  },
  TR:  { title: 'titleTr',  desc: 'descriptionTr'  },
  FRA: { title: 'titleFra', desc: 'descriptionFra' },
  RU:  { title: 'titleRu',  desc: 'descriptionRu'  },
  ITA: { title: 'titleIta', desc: 'descriptionIta' },
};

type FormState = {
  titleEn: string; titleTr: string; titleFra: string; titleRu: string; titleIta: string;
  descriptionEn: string; descriptionTr: string; descriptionFra: string;
  descriptionRu: string; descriptionIta: string;
};

// Client-side metadata extraction (lightweight, no server round-trip needed)
function extractMetadata(text: string): FormState & { questionCount: number } {
  const get = (key: string) => {
    const m = text.match(new RegExp(`^${key}\\s*:\\s*(.+)`, 'im'));
    return m ? m[1].trim() : '';
  };
  // Count question blocks (lines starting with Q: / Q1: etc.)
  const questionCount = (text.match(/^Q\d*\s*[:.\s]/gim) || []).length;

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
    questionCount,
  };
}

const SAMPLE_TEMPLATE = `# EXAM
TITLE_EN: Pharmacology Module 1
TITLE_TR: Farmakoloji Modül 1
TITLE_FRA: Module de Pharmacologie 1
TITLE_RU: Модуль фармакологии 1
TITLE_ITA: Modulo di Farmacologia 1
DESC_EN: A comprehensive pharmacology module covering drug mechanisms and clinical applications.
DESC_TR: İlaç mekanizmalarını ve klinik uygulamaları kapsayan kapsamlı bir farmakoloji modülü.
DESC_FRA: Un module de pharmacologie complet couvrant les mécanismes des médicaments.
DESC_RU: Комплексный модуль фармакологии, охватывающий механизмы действия препаратов.
DESC_ITA: Un modulo di farmacologia completo che copre i meccanismi dei farmaci.

# QUESTIONS

Q: What is the primary mechanism of action of aspirin?
A: Inhibition of COX-1 and COX-2 enzymes
B: Activation of prostaglandin synthesis
C: Blocking of histamine H1 receptors
D: Stimulation of mu-opioid receptors
ANSWER: A
EXPLANATION: Aspirin irreversibly acetylates and inhibits both COX-1 and COX-2 enzymes, reducing prostaglandin and thromboxane synthesis.

Q: Which drug class is the first-line treatment for type 2 diabetes mellitus?
A: Sulfonylureas
B: Insulin
C: Metformin (Biguanides)
D: DPP-4 inhibitors
ANSWER: C
EXPLANATION: Metformin is the preferred initial pharmacologic agent for type 2 diabetes due to its efficacy, safety profile, and low cost.

Q: What is the antidote for acetaminophen (paracetamol) overdose?
A: Naloxone
B: Flumazenil
C: N-acetylcysteine
D: Atropine
ANSWER: C
EXPLANATION: N-acetylcysteine replenishes hepatic glutathione stores, preventing accumulation of the toxic NAPQI metabolite.
`;

export default function CreateFromFilePage() {
  const router = useRouter();
  const { success, error } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Input state
  const [inputTab, setInputTab] = useState<'file' | 'paste'>('file');
  const [pasteContent, setPasteContent] = useState('');
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');

  // Parsed state
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);

  // Form state
  const [timePerQuestion, setTimePerQuestion] = useState(60);
  const [form, setForm] = useState<FormState>({
    titleEn: '', titleTr: '', titleFra: '', titleRu: '', titleIta: '',
    descriptionEn: '', descriptionTr: '', descriptionFra: '', descriptionRu: '', descriptionIta: '',
  });

  const [saving, setSaving] = useState(false);

  // ─── Parse helpers ──────────────────────────────────────────────────────────

  const applyParsed = useCallback((text: string) => {
    const meta = extractMetadata(text);
    setRawText(text);
    setQuestionCount(meta.questionCount);
    setForm({
      titleEn:  meta.titleEn,  titleTr:  meta.titleTr,
      titleFra: meta.titleFra, titleRu:  meta.titleRu, titleIta: meta.titleIta,
      descriptionEn:  meta.descriptionEn,  descriptionTr:  meta.descriptionTr,
      descriptionFra: meta.descriptionFra, descriptionRu:  meta.descriptionRu,
      descriptionIta: meta.descriptionIta,
    });
    setParsed(true);
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.md') && !file.name.endsWith('.txt')) {
      error('Only .md and .txt files are supported');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => applyParsed(e.target?.result as string);
    reader.readAsText(file);
  }, [error, applyParsed]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleParseFromPaste = () => {
    if (!pasteContent.trim()) { error('Please paste some content first'); return; }
    setFileName('pasted content');
    applyParsed(pasteContent);
  };

  const clearFile = () => {
    setParsed(false);
    setRawText('');
    setFileName('');
    setQuestionCount(0);
    setForm({ titleEn: '', titleTr: '', titleFra: '', titleRu: '', titleIta: '',
      descriptionEn: '', descriptionTr: '', descriptionFra: '', descriptionRu: '', descriptionIta: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Sample download ─────────────────────────────────────────────────────────

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_TEMPLATE], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'esvita-exam-template.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    const hasTitle = LANGS.some(
      (l) => (form[LANG_KEY_MAP[l].title as keyof FormState] as string).trim().length > 0
    );
    if (!hasTitle) { error('Please fill in at least one language title'); return; }
    if (!rawText)  { error('No file content found. Please upload or paste content.'); return; }
    if (questionCount === 0) { error('No questions detected in the file. Please check the format.'); return; }

    setSaving(true);
    const res = await fetch('/api/admin/exams/create-from-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: rawText, timePerQuestion, ...form }),
    });

    if (res.ok) {
      const data = await res.json();
      success(`Exam created with ${data.questionsImported} questions!`);
      router.push(`/exams/${data.id}`);
    } else {
      const d = await res.json();
      error(d.error || 'Failed to create exam');
      setSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      <Header title="Create Exam from File" subtitle="Upload a formatted .md or .txt file to instantly create an exam" />
      <PageTransition>
        <div className="p-6 max-w-4xl">
          <Link
            href="/exams"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors mb-6"
          >
            <ArrowLeft size={15} /> Back to Exams
          </Link>

          <div className="space-y-6">
            {/* ── Step 1: File Input ────────────────────────────────────── */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  <FileText size={16} className="text-blue-600" />
                  Step 1: Upload or Paste Your File
                </h3>
                <button onClick={downloadSample} className="btn-secondary btn-sm text-xs">
                  <Download size={12} /> Download Template
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-4 w-fit">
                {(['file', 'paste'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setInputTab(tab)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                      inputTab === tab ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab === 'file' ? <Upload size={11} /> : <Clipboard size={11} />}
                    {tab === 'file' ? 'File Upload' : 'Paste Text'}
                  </button>
                ))}
              </div>

              {inputTab === 'file' ? (
                parsed && fileName ? (
                  /* File loaded banner */
                  <div className="flex items-center gap-3 border border-emerald-200 bg-emerald-50 rounded-xl px-4 py-3">
                    <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-emerald-800 text-sm truncate">{fileName}</p>
                      <p className="text-xs text-emerald-600">{questionCount} questions detected</p>
                    </div>
                    <button
                      onClick={clearFile}
                      className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
                      title="Clear file"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  /* Drop zone */
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all select-none ${
                      dragging
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-slate-300 hover:border-blue-300 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".md,.txt"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                    />
                    <Upload size={32} className="text-slate-400 mx-auto mb-3" />
                    <p className="font-medium text-slate-600 text-sm">Drop your .md or .txt file here</p>
                    <p className="text-xs text-slate-400 mt-1">or click to browse files</p>
                  </div>
                )
              ) : (
                /* Paste area */
                <div>
                  <textarea
                    className="input w-full font-mono text-xs resize-none"
                    rows={12}
                    placeholder={`Paste your exam file content here...\n\nExample:\n# EXAM\nTITLE_EN: My Exam Title\nTITLE_TR: Sınav Başlığı\nDESC_EN: Optional description\n\n# QUESTIONS\n\nQ: Question text?\nA: Option A\nB: Option B\nC: Option C\nD: Option D\nANSWER: A`}
                    value={pasteContent}
                    onChange={(e) => { setPasteContent(e.target.value); if (parsed) clearFile(); }}
                  />
                  <button onClick={handleParseFromPaste} className="btn-primary btn-sm mt-3">
                    Parse Content
                  </button>
                </div>
              )}

              {/* Format guide */}
              <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-600 mb-2">Expected File Format</p>
                <pre className="text-[10px] leading-5 text-slate-500 whitespace-pre-wrap font-mono">{`# EXAM
TITLE_EN: Exam Title in English
TITLE_TR: Sınav Başlığı
TITLE_FRA: Titre de l'examen
TITLE_RU: Название экзамена
TITLE_ITA: Titolo dell'esame
DESC_EN: Optional description
DESC_TR: İsteğe bağlı açıklama

# QUESTIONS

Q: Question text?
A: Option A
B: Option B
C: Option C
D: Option D
ANSWER: B
EXPLANATION: Optional explanation (supports multiple lines)`}</pre>
                <p className="text-[10px] text-slate-400 mt-2">
                  Tip: The <strong># EXAM</strong> header and <strong># QUESTIONS</strong> separator are optional — a file with only Q:/A:/B:/ANSWER: blocks will also work.
                </p>
              </div>
            </div>

            {/* ── Step 2 & 3: Configure + Review (shown after parsing) ───── */}
            {parsed && (
              <>
                {/* Parse result banner */}
                <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
                  questionCount > 0
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-amber-50 border-amber-200'
                }`}>
                  {questionCount > 0
                    ? <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                    : <AlertCircle   size={18} className="text-amber-500 flex-shrink-0" />
                  }
                  <div>
                    {questionCount > 0 ? (
                      <>
                        <p className="text-sm font-semibold text-emerald-800">File parsed successfully!</p>
                        <p className="text-xs text-emerald-600">
                          {questionCount} questions found · Review titles below, set time per question, then create.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-amber-800">No questions detected</p>
                        <p className="text-xs text-amber-600">
                          Check the format — each question needs Q:, at least A: and B: options, and ANSWER:
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Step 2: Time Setting */}
                <div className="card p-5">
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2 mb-4">
                    <Clock size={16} className="text-blue-600" /> Step 2: Exam Settings
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="label">Time Per Question (seconds)</label>
                      <input
                        type="number"
                        className="input"
                        min={10}
                        max={600}
                        value={timePerQuestion}
                        onChange={(e) => setTimePerQuestion(parseInt(e.target.value) || 60)}
                      />
                      <p className="text-xs text-slate-400 mt-1">Default: 60s · Range: 10–600s</p>
                    </div>
                    <div className="form-group">
                      <label className="label">Estimated Total Time</label>
                      <div className="input bg-slate-50 text-slate-600 cursor-default">
                        {questionCount > 0
                          ? `~${Math.ceil((questionCount * timePerQuestion) / 60)} min`
                          : '—'}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {questionCount} question{questionCount !== 1 ? 's' : ''} × {timePerQuestion}s
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 3: Multilingual Titles */}
                <div className="card p-5">
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2 mb-1">
                    <Globe size={16} className="text-blue-600" /> Step 3: Review Language Content
                  </h3>
                  <p className="text-xs text-slate-400 mb-5">
                    Pre-filled from your file — edit freely. At least one language title is required.
                  </p>

                  <div className="space-y-4">
                    {LANGS.map((lang) => {
                      const keys = LANG_KEY_MAP[lang];
                      const titleVal = form[keys.title as keyof FormState] as string;
                      const descVal  = form[keys.desc  as keyof FormState] as string;
                      const filled   = titleVal.trim().length > 0;
                      return (
                        <div
                          key={lang}
                          className={`border rounded-xl p-4 transition-colors ${
                            filled ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-lg">{LANGUAGE_FLAGS[lang]}</span>
                            <span className="font-semibold text-slate-700 text-sm">{LANGUAGE_LABELS[lang]}</span>
                            {filled && <span className="badge-green ml-auto text-xs">Filled</span>}
                          </div>
                          <div className="space-y-3">
                            <div className="form-group">
                              <label className="label text-xs">Exam Title</label>
                              <input
                                className="input"
                                placeholder={`Exam title in ${LANGUAGE_LABELS[lang]}`}
                                value={titleVal}
                                onChange={(e) =>
                                  setForm((f) => ({ ...f, [keys.title]: e.target.value }))
                                }
                              />
                            </div>
                            <div className="form-group">
                              <label className="label text-xs">Description (optional)</label>
                              <textarea
                                className="input resize-none"
                                rows={2}
                                placeholder={`Description in ${LANGUAGE_LABELS[lang]}`}
                                value={descVal}
                                onChange={(e) =>
                                  setForm((f) => ({ ...f, [keys.desc]: e.target.value }))
                                }
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pb-6">
                  <Link href="/exams" className="btn-secondary">Cancel</Link>
                  <button
                    onClick={handleSubmit}
                    disabled={saving || questionCount === 0}
                    className="btn-primary btn-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <><Spinner size="sm" className="text-white" /> Creating Exam…</>
                    ) : (
                      <><CheckCircle2 size={18} /> Create Exam with {questionCount} Question{questionCount !== 1 ? 's' : ''}</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </PageTransition>
    </div>
  );
}

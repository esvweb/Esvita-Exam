'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/admin/Header';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import {
  ArrowLeft, Plus, Trash2, Upload, Send, Copy,
  HelpCircle, CheckCircle2, Mail, Eye, Download,
} from 'lucide-react';
import Link from 'next/link';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS, getAvailableLanguages, formatDateTime } from '@/lib/utils';
import type { Language } from '@/types';

const LANGS: Language[] = ['EN', 'FRA', 'RU', 'TR', 'ITA'];
const OPTION_KEYS = ['A', 'B', 'C', 'D'];

interface Exam {
  id: string;
  titleEn: string | null; titleFra: string | null; titleRu: string | null;
  titleTr: string | null; titleIta: string | null;
  descriptionEn: string | null;
  timePerQuestion: number; isActive: boolean; createdAt: string;
  _count: { questions: number; sessions: number };
  creator: { name: string; email: string };
  questions: Question[];
}

interface Question {
  id: string; orderIndex: number;
  questionEn: string | null; questionFra: string | null; questionRu: string | null;
  questionTr: string | null; questionIta: string | null;
  optionsEn: string | null; optionsFra: string | null; optionsRu: string | null;
  optionsTr: string | null; optionsIta: string | null;
  correctAnswer: string;
  explanationEn: string | null; explanationFra: string | null; explanationRu: string | null;
  explanationTr: string | null; explanationIta: string | null;
}

interface Invitation {
  id: string; email: string; name: string | null; uniqueToken: string;
  expiresAt: string; isUsed: boolean; createdAt: string;
}

const emptyQuestionForm = () => ({
  questionEn: '', questionFra: '', questionRu: '', questionTr: '', questionIta: '',
  optionsEn: OPTION_KEYS.map((k) => ({ key: k, value: '' })),
  optionsFra: OPTION_KEYS.map((k) => ({ key: k, value: '' })),
  optionsRu: OPTION_KEYS.map((k) => ({ key: k, value: '' })),
  optionsTr: OPTION_KEYS.map((k) => ({ key: k, value: '' })),
  optionsIta: OPTION_KEYS.map((k) => ({ key: k, value: '' })),
  correctAnswer: 'A',
  explanationEn: '', explanationFra: '', explanationRu: '', explanationTr: '', explanationIta: '',
});

const SAMPLE_MD = `# Esvita Exam - Sample Import File
# Format: Q: / A: / B: / C: / D: / ANSWER: / EXPLANATION:
# Supported files: .txt and .md
# Separate each question block with a blank line.

Q: What is the primary mechanism of ACE inhibitors?
A: Block L-type calcium channels
B: Inhibit angiotensin-converting enzyme
C: Block beta-1 adrenergic receptors
D: Stimulate aldosterone release
ANSWER: B
EXPLANATION: ACE inhibitors block the angiotensin-converting enzyme, preventing conversion of angiotensin I to angiotensin II, thereby lowering blood pressure.

Q: Which drug is first-line treatment for Type 2 Diabetes Mellitus?
A: Insulin glargine
B: Sulfonylurea
C: Metformin
D: GLP-1 receptor agonist
ANSWER: C
EXPLANATION: Metformin is the first-line pharmacological agent for T2DM unless contraindicated (e.g., severe renal impairment).

Q: Which of the following is a selective COX-2 inhibitor?
A: Ibuprofen
B: Aspirin
C: Naproxen
D: Celecoxib
ANSWER: D
EXPLANATION: Celecoxib selectively inhibits COX-2, reducing GI adverse effects compared to non-selective NSAIDs.
`;

export default function ExamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { success, error, info } = useToast();

  const [exam, setExam] = useState<Exam | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'questions' | 'invitations' | 'settings'>('questions');
  const [userRole, setUserRole] = useState('');

  // Question Modal
  const [showQModal, setShowQModal] = useState(false);
  const [qForm, setQForm] = useState(emptyQuestionForm());
  const [savingQ, setSavingQ] = useState(false);
  const [activeLangTab, setActiveLangTab] = useState<Language>('EN');

  // Import Modal
  const [showImport, setShowImport] = useState(false);
  const [importMode, setImportMode] = useState<'markdown' | 'text' | 'json' | 'pdf'>('markdown');
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Invitation Modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '' });
  const [sendingInvite, setSendingInvite] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState('');

  // Delete Confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchExam = useCallback(async () => {
    const res = await fetch(`/api/admin/exams/${id}`);
    if (res.ok) setExam(await res.json());
    setLoading(false);
  }, [id]);

  const fetchInvitations = useCallback(async () => {
    const res = await fetch(`/api/admin/exams/${id}/invite`);
    if (res.ok) setInvitations(await res.json());
  }, [id]);

  useEffect(() => {
    fetchExam();
    fetchInvitations();
    fetch('/api/auth/me').then(r => r.json()).then(d => setUserRole(d?.role || ''));
  }, [fetchExam, fetchInvitations]);

  const canDelete = ['super_admin', 'admin'].includes(userRole);
  const canWrite  = ['super_admin', 'admin', 'moderator'].includes(userRole);

  // ─── Delete Exam ──────────────────────────────────────────────────────────────
  const handleDeleteExam = async () => {
    setDeleting(true);
    const res = await fetch(`/api/admin/exams/${id}`, { method: 'DELETE' });
    if (res.ok) {
      success('Exam deleted successfully');
      router.push('/exams');
    } else {
      const d = await res.json();
      error(d.error || 'Failed to delete exam');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // ─── Add Question ─────────────────────────────────────────────────────────────
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingQ(true);
    const payload = {
      ...qForm,
      optionsEn: qForm.optionsEn.filter((o) => o.value.trim()),
      optionsFra: qForm.optionsFra.filter((o) => o.value.trim()),
      optionsRu: qForm.optionsRu.filter((o) => o.value.trim()),
      optionsTr: qForm.optionsTr.filter((o) => o.value.trim()),
      optionsIta: qForm.optionsIta.filter((o) => o.value.trim()),
    };
    const res = await fetch(`/api/admin/exams/${id}/questions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      success('Question added successfully');
      setShowQModal(false); setQForm(emptyQuestionForm()); fetchExam();
    } else {
      const d = await res.json(); error(d.error || 'Failed to add question');
    }
    setSavingQ(false);
  };

  // ─── Import Questions ─────────────────────────────────────────────────────────
  const handleImport = async () => {
    setImporting(true);
    try {
      if (importMode === 'pdf') {
        const file = fileRef.current?.files?.[0];
        if (!file) { error('Please select a file'); setImporting(false); return; }
        const formData = new FormData();
        formData.append('file', file);
        formData.append('replace', String(replaceMode));
        const res = await fetch(`/api/admin/exams/${id}/import`, { method: 'POST', body: formData });
        const d = await res.json();
        if (res.ok) { success(d.message); setShowImport(false); fetchExam(); }
        else error(d.error || 'Import failed');
      } else {
        const res = await fetch(`/api/admin/exams/${id}/import`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: importMode, data: importText, replace: replaceMode }),
        });
        const d = await res.json();
        if (res.ok) { success(d.message); setShowImport(false); setImportText(''); fetchExam(); }
        else error(d.error || 'Import failed');
      }
    } catch { error('Import failed'); }
    setImporting(false);
  };

  // ─── Download Sample ──────────────────────────────────────────────────────────
  const downloadSample = () => {
    const blob = new Blob([SAMPLE_MD], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'esvita-sample-questions.md';
    a.click();
  };

  // ─── Send Invitation ──────────────────────────────────────────────────────────
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingInvite(true);
    const res = await fetch(`/api/admin/exams/${id}/invite`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inviteForm),
    });
    const d = await res.json();
    if (res.ok) {
      success(`Invitation sent to ${inviteForm.email}`);
      setLastInviteLink(d.examLink);
      setInviteForm({ email: '', name: '' });
      fetchInvitations();
    } else { error(d.error || 'Failed to send invitation'); }
    setSendingInvite(false);
  };

  if (loading) return <div><Header title="Loading..." /><div className="flex justify-center py-20"><Spinner className="text-blue-500" /></div></div>;
  if (!exam) return <div><Header title="Not Found" /><div className="p-6 text-slate-500">Exam not found.</div></div>;

  const title = exam.titleEn || exam.titleTr || 'Untitled Exam';
  const availLangs = getAvailableLanguages(exam as unknown as Record<string, unknown>);
  const totalTime = exam._count.questions * exam.timePerQuestion;

  const qLangKey = (lang: Language, prefix: 'question' | 'explanation') => {
    const map: Record<Language, string> = {
      EN: `${prefix}En`, FRA: `${prefix}Fra`, RU: `${prefix}Ru`, TR: `${prefix}Tr`, ITA: `${prefix}Ita`
    };
    return map[lang] as keyof typeof qForm;
  };

  const optKey = (lang: Language): keyof typeof qForm => {
    const map: Record<Language, keyof typeof qForm> = {
      EN: 'optionsEn', FRA: 'optionsFra', RU: 'optionsRu', TR: 'optionsTr', ITA: 'optionsIta'
    };
    return map[lang];
  };

  return (
    <div>
      <Header title={title} subtitle={`${exam._count.questions} questions · ${exam._count.sessions} attempts`} />
      <div className="p-6 space-y-5">

        {/* Top bar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Link href="/exams" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors">
            <ArrowLeft size={15} /> Back to Exams
          </Link>
          <div className="flex gap-2 flex-wrap">
            {canWrite && (
              <Link href={`/exams/${id}/preview`} className="btn-secondary btn-sm">
                <Eye size={14} /> Preview
              </Link>
            )}
            {canWrite && (
              <>
                <button onClick={() => setShowInvite(true)} className="btn-secondary btn-sm">
                  <Send size={14} /> Invite
                </button>
                <button onClick={() => setShowImport(true)} className="btn-secondary btn-sm">
                  <Upload size={14} /> Import
                </button>
                <button onClick={() => { setQForm(emptyQuestionForm()); setShowQModal(true); }} className="btn-primary btn-sm">
                  <Plus size={14} /> Add Question
                </button>
              </>
            )}
            {canDelete && (
              <button onClick={() => setShowDeleteConfirm(true)} className="btn-danger btn-sm">
                <Trash2 size={14} /> Delete Exam
              </button>
            )}
          </div>
        </div>

        {/* Exam Info Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-slate-800">{exam._count.questions}</p>
            <p className="text-xs text-slate-400">Questions</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-slate-800">{Math.ceil(totalTime / 60)}m</p>
            <p className="text-xs text-slate-400">Total Time</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-slate-800">{exam._count.sessions}</p>
            <p className="text-xs text-slate-400">Attempts</p>
          </div>
          <div className="card p-4 text-center">
            <div className="flex flex-wrap justify-center gap-1">
              {availLangs.length > 0 ? availLangs.map((l) => (
                <span key={l} className="text-lg" title={LANGUAGE_LABELS[l]}>{LANGUAGE_FLAGS[l]}</span>
              )) : <span className="text-slate-400 text-sm">—</span>}
            </div>
            <p className="text-xs text-slate-400 mt-1">Languages</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 flex gap-6">
          {(['questions', 'invitations', 'settings'] as const).map((tab) => (
            <button
              key={tab} onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium capitalize transition-colors border-b-2 ${
                activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}
              {tab === 'questions' && <span className="ml-1.5 badge-blue">{exam._count.questions}</span>}
              {tab === 'invitations' && <span className="ml-1.5 badge-gray">{invitations.length}</span>}
            </button>
          ))}
        </div>

        {/* Questions Tab */}
        {activeTab === 'questions' && (
          <div>
            {exam.questions.length === 0 ? (
              <EmptyState
                icon={HelpCircle}
                title="No questions yet"
                description="Add questions manually or import from a TXT / MD file."
                action={canWrite ? (
                  <div className="flex gap-2">
                    <button onClick={() => setShowImport(true)} className="btn-secondary btn-sm"><Upload size={14} /> Import</button>
                    <button onClick={() => setShowQModal(true)} className="btn-primary btn-sm"><Plus size={14} /> Add Question</button>
                  </div>
                ) : undefined}
              />
            ) : (
              <div className="space-y-3">
                {exam.questions.map((q, i) => {
                  const qText = q.questionEn || q.questionTr || q.questionFra || q.questionRu || q.questionIta || 'No question text';
                  const opts = q.optionsEn ? JSON.parse(q.optionsEn) : [];
                  return (
                    <div key={q.id} className="card p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800">{qText}</p>
                          {opts.length > 0 && (
                            <div className="grid grid-cols-2 gap-1.5 mt-2">
                              {opts.map((opt: { key: string; value: string }) => (
                                <div key={opt.key}
                                  className={`text-xs px-2 py-1 rounded-md ${opt.key === q.correctAnswer ? 'bg-emerald-100 text-emerald-700 font-semibold' : 'bg-slate-100 text-slate-600'}`}
                                >
                                  {opt.key}. {opt.value}
                                </div>
                              ))}
                            </div>
                          )}
                          {q.explanationEn && (
                            <p className="text-xs text-slate-400 mt-2 italic">{q.explanationEn}</p>
                          )}
                        </div>
                        <span className="badge-green text-xs flex-shrink-0">✓ {q.correctAnswer}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Invitations Tab */}
        {activeTab === 'invitations' && (
          <div>
            {lastInviteLink && (
              <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 size={18} className="text-blue-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-800">Invitation sent successfully!</p>
                  <p className="text-xs text-blue-600 truncate">{lastInviteLink}</p>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(lastInviteLink); info('Link copied!'); }} className="btn-secondary btn-sm flex-shrink-0">
                  <Copy size={13} /> Copy
                </button>
              </div>
            )}
            {invitations.length === 0 ? (
              <EmptyState icon={Mail} title="No invitations sent" description="Invite external users to take this exam."
                action={canWrite ? <button onClick={() => setShowInvite(true)} className="btn-primary btn-sm"><Send size={14} /> Send Invitation</button> : undefined}
              />
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Expires</th><th>Sent</th><th></th></tr></thead>
                  <tbody>
                    {invitations.map((inv) => {
                      const isExpired = new Date() > new Date(inv.expiresAt);
                      return (
                        <tr key={inv.id}>
                          <td className="font-medium">{inv.name || '—'}</td>
                          <td className="text-slate-500 text-sm">{inv.email}</td>
                          <td>
                            {inv.isUsed ? <span className="badge-blue">Used</span>
                              : isExpired ? <span className="badge-red">Expired</span>
                              : <span className="badge-green">Active</span>}
                          </td>
                          <td className="text-xs text-slate-400">{formatDateTime(inv.expiresAt)}</td>
                          <td className="text-xs text-slate-400">{formatDateTime(inv.createdAt)}</td>
                          <td>
                            {!inv.isUsed && !isExpired && (
                              <button onClick={() => { const link = `${window.location.origin}/exam/${inv.uniqueToken}`; navigator.clipboard.writeText(link); info('Link copied!'); }} className="btn-ghost btn-sm">
                                <Copy size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-slate-700">Exam Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Time Per Question</label>
                <p className="text-slate-700 font-medium">{exam.timePerQuestion}s</p>
              </div>
              <div>
                <label className="label">Status</label>
                <p>{exam.isActive ? <span className="badge-green">Active</span> : <span className="badge-red">Inactive</span>}</p>
              </div>
              <div>
                <label className="label">Created By</label>
                <p className="text-slate-700 text-sm">{exam.creator?.name} ({exam.creator?.email})</p>
              </div>
            </div>
            <div>
              <label className="label">Available Languages</label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {availLangs.map((l) => (
                  <span key={l} className="badge-blue">{LANGUAGE_FLAGS[l]} {l}</span>
                ))}
                {availLangs.length === 0 && <span className="text-slate-400 text-sm">No languages configured</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Add Question Modal ─────────────────────────────────────────────────── */}
      <Modal isOpen={showQModal} onClose={() => setShowQModal(false)} title="Add Question" size="2xl">
        <form onSubmit={handleSaveQuestion} className="space-y-4">
          <div className="flex gap-1 border-b border-slate-200">
            {LANGS.map((l) => (
              <button key={l} type="button" onClick={() => setActiveLangTab(l)}
                className={`px-3 py-2 text-xs font-medium rounded-t-lg transition-colors ${
                  activeLangTab === l ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {LANGUAGE_FLAGS[l]} {l}
              </button>
            ))}
          </div>
          {LANGS.map((lang) => (
            <div key={lang} className={activeLangTab === lang ? '' : 'hidden'}>
              <div className="form-group mb-3">
                <label className="label">Question Text ({LANGUAGE_LABELS[lang]})</label>
                <textarea className="input resize-none" rows={3}
                  placeholder={`Question in ${LANGUAGE_LABELS[lang]}...`}
                  value={qForm[qLangKey(lang, 'question')] as string}
                  onChange={(e) => setQForm((f) => ({ ...f, [qLangKey(lang, 'question')]: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {OPTION_KEYS.map((key, ki) => {
                  const opts = qForm[optKey(lang)] as { key: string; value: string }[];
                  return (
                    <div key={key} className="form-group">
                      <label className="label text-xs">Option {key}</label>
                      <input
                        className={`input text-sm ${qForm.correctAnswer === key ? 'border-emerald-400 bg-emerald-50' : ''}`}
                        placeholder={`Option ${key}`} value={opts[ki]?.value || ''}
                        onChange={(e) => {
                          const newOpts = [...opts]; newOpts[ki] = { key, value: e.target.value };
                          setQForm((f) => ({ ...f, [optKey(lang)]: newOpts }));
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="form-group">
                <label className="label">Explanation ({LANGUAGE_LABELS[lang]}) — optional</label>
                <textarea className="input resize-none" rows={2}
                  placeholder="Explanation for the correct answer..."
                  value={qForm[qLangKey(lang, 'explanation')] as string}
                  onChange={(e) => setQForm((f) => ({ ...f, [qLangKey(lang, 'explanation')]: e.target.value }))}
                />
              </div>
            </div>
          ))}
          <div className="form-group border-t border-slate-100 pt-4">
            <label className="label">Correct Answer</label>
            <div className="flex gap-2">
              {OPTION_KEYS.map((k) => (
                <button key={k} type="button" onClick={() => setQForm((f) => ({ ...f, correctAnswer: k }))}
                  className={`w-10 h-10 rounded-lg font-bold text-sm transition-all ${
                    qForm.correctAnswer === k ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >{k}</button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setShowQModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={savingQ}>
              {savingQ ? <Spinner size="sm" className="text-white" /> : <Plus size={15} />}
              {savingQ ? 'Saving...' : 'Add Question'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Import Modal ───────────────────────────────────────────────────────── */}
      <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="Import Questions" size="xl">
        <div className="space-y-4">
          {/* Mode tabs */}
          <div className="flex gap-2 flex-wrap">
            {([
              { key: 'markdown', label: '📝 Markdown / TXT' },
              { key: 'text',     label: '⌨️ Paste Text' },
              { key: 'json',     label: '{ } JSON' },
              { key: 'pdf',      label: '📄 File Upload' },
            ] as const).map((m) => (
              <button key={m.key} type="button" onClick={() => setImportMode(m.key)}
                className={`btn btn-sm ${importMode === m.key ? 'btn-primary' : 'btn-secondary'}`}
              >{m.label}</button>
            ))}
          </div>

          {/* Replace toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div onClick={() => setReplaceMode(r => !r)}
              className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ${replaceMode ? 'bg-red-500' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${replaceMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-slate-700">
              Replace all existing questions
              {replaceMode && <span className="ml-1.5 text-red-500 text-xs font-semibold">⚠️ destructive — cannot be undone</span>}
            </span>
          </label>

          {/* Markdown / TXT */}
          {importMode === 'markdown' && (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-700 mb-2">📋 Required format (.md or .txt):</p>
                <pre className="font-mono text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap">{`Q: Question text here?
A: First option
B: Second option
C: Third option
D: Fourth option
ANSWER: B
EXPLANATION: Optional explanation (blank line between questions)`}</pre>
                <p className="text-slate-400 mt-2">Also supports ## headings and <code>- A)</code> bullet style options.</p>
              </div>
              <div className="flex justify-end">
                <button onClick={downloadSample} className="btn-secondary btn-sm">
                  <Download size={13} /> Download Sample File
                </button>
              </div>
              <div className="form-group">
                <label className="label">Paste your questions</label>
                <textarea className="input font-mono text-xs resize-none" rows={12}
                  placeholder={'Q: What is the mechanism of ACE inhibitors?\nA: Block calcium channels\nB: Inhibit ACE enzyme\nC: Block beta receptors\nD: Stimulate aldosterone\nANSWER: B\nEXPLANATION: ACE inhibitors work by...\n\nQ: Next question...'}
                  value={importText} onChange={(e) => setImportText(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Plain text */}
          {importMode === 'text' && (
            <div className="form-group">
              <label className="label">Paste formatted text</label>
              <p className="text-xs text-slate-400 mb-2">Same Q:/A:/B:/C:/D:/ANSWER:/EXPLANATION: format, one question per blank-line-separated block.</p>
              <textarea className="input font-mono text-xs resize-none" rows={10}
                placeholder={'Q: What is the mechanism of ACE inhibitors?\nA: Block calcium channels\nB: Inhibit ACE enzyme\nANSWER: B'}
                value={importText} onChange={(e) => setImportText(e.target.value)}
              />
            </div>
          )}

          {/* JSON */}
          {importMode === 'json' && (
            <div className="form-group">
              <label className="label">Paste JSON array</label>
              <textarea className="input font-mono text-xs resize-none" rows={10}
                placeholder='[{"questionEn":"...","optionsEn":[{"key":"A","value":"..."}],"correctAnswer":"B"}]'
                value={importText} onChange={(e) => setImportText(e.target.value)}
              />
            </div>
          )}

          {/* File upload */}
          {importMode === 'pdf' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button onClick={downloadSample} className="btn-secondary btn-sm">
                  <Download size={13} /> Download Sample .md File
                </button>
              </div>
              <div className="form-group">
                <label className="label">Upload File</label>
                <input ref={fileRef} type="file" className="input" accept=".pdf,.txt,.md,.json" />
                <p className="text-xs text-slate-400 mt-1">
                  Accepted: PDF · TXT · MD (Q:/A:/B:/C:/D:/ANSWER: format) · JSON (array)
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button className="btn-secondary" onClick={() => setShowImport(false)}>Cancel</button>
            <button className={replaceMode ? 'btn-danger' : 'btn-primary'} onClick={handleImport} disabled={importing}>
              {importing ? <Spinner size="sm" className="text-white" /> : <Upload size={15} />}
              {importing ? 'Importing...' : replaceMode ? 'Replace & Import' : 'Import Questions'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Invite Modal ───────────────────────────────────────────────────────── */}
      <Modal isOpen={showInvite} onClose={() => setShowInvite(false)} title="Send External Invitation" size="md">
        <form onSubmit={handleSendInvite} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            The invitee will receive an email with a unique exam link and OTP code valid for <strong>72 hours</strong>.
          </div>
          <div className="form-group">
            <label className="label">Full Name</label>
            <input className="input" placeholder="Dr. External User" value={inviteForm.name}
              onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="label">Email Address</label>
            <input className="input" type="email" placeholder="external@hospital.com"
              value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} required />
            <p className="text-xs text-slate-400 mt-1">Can be any email address (not restricted to Esvita domains)</p>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setShowInvite(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={sendingInvite}>
              {sendingInvite ? <Spinner size="sm" className="text-white" /> : <Send size={15} />}
              {sendingInvite ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirm ─────────────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteExam}
        title="Delete Exam"
        message={`Permanently delete "${title}"? This will also remove all ${exam._count.questions} questions and ${exam._count.sessions} session records. This cannot be undone.`}
        confirmLabel="Yes, Delete Permanently"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

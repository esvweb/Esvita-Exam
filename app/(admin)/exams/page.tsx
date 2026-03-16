'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/admin/Header';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import {
  ClipboardList, Plus, RefreshCw, Clock, Users,
  ArrowRight, CheckCircle2, HelpCircle
} from 'lucide-react';
import Link from 'next/link';
import Spinner from '@/components/ui/Spinner';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS, getAvailableLanguages, formatDate } from '@/lib/utils';
import type { Language } from '@/types';
import PageTransition from '@/components/ui/PageTransition';

interface Exam {
  id: string;
  titleEn: string | null; titleFra: string | null; titleRu: string | null;
  titleTr: string | null; titleIta: string | null;
  timePerQuestion: number; isActive: boolean; createdAt: string;
  _count: { questions: number; sessions: number };
  creator: { name: string; email: string };
}

export default function ExamsPage() {
  const { error } = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/exams');
    if (res.ok) setExams(await res.json());
    else error('Failed to load exams');
    setLoading(false);
  }, []);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  return (
    <div>
      <Header title="Exams" subtitle="Create and manage assessment modules" />
      <PageTransition>
      <div className="p-6">
        <div className="page-header">
          <div>
            <h2 className="section-title">Exam Management</h2>
            <p className="text-sm text-slate-400 mt-0.5">{exams.length} active exams</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchExams} className="btn-secondary btn-sm"><RefreshCw size={14} /></button>
            <Link href="/exams/create" className="btn-primary btn-sm">
              <Plus size={14} /> Create New Exam
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner className="text-blue-500" /></div>
        ) : exams.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No exams created yet"
            description="Create your first multilingual exam module."
            action={<Link href="/exams/create" className="btn-primary btn-sm"><Plus size={14} /> Create Exam</Link>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {exams.map((exam) => {
              const title = exam.titleEn || exam.titleTr || exam.titleFra || 'Untitled Exam';
              const totalTime = exam._count.questions * exam.timePerQuestion;
              const availLangs = getAvailableLanguages(exam as unknown as Record<string, unknown>);

              return (
                <Link
                  key={exam.id}
                  href={`/exams/${exam.id}`}
                  className="card p-5 flex flex-col gap-4 hover:border-blue-300 hover:shadow-md transition-all group cursor-pointer"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <ClipboardList size={18} className="text-blue-600" />
                    </div>
                    <span className="badge-green text-xs">{exam.isActive ? 'Active' : 'Inactive'}</span>
                  </div>

                  {/* Title */}
                  <div>
                    <h3 className="font-semibold text-slate-800 text-sm leading-snug line-clamp-2">{title}</h3>
                    <p className="text-xs text-slate-400 mt-1">by {exam.creator?.name || 'Unknown'}</p>
                  </div>

                  {/* Languages */}
                  <div className="flex flex-wrap gap-1">
                    {availLangs.map((lang) => (
                      <span key={lang} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {LANGUAGE_FLAGS[lang]} {lang}
                      </span>
                    ))}
                    {availLangs.length === 0 && (
                      <span className="text-xs text-slate-400 italic">No languages set</span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-slate-500 border-t border-slate-100 pt-3">
                    <span className="flex items-center gap-1">
                      <HelpCircle size={12} /> {exam._count.questions} questions
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {exam._count.sessions} attempts
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {Math.ceil(totalTime / 60)}m
                    </span>
                    <span className="ml-auto group-hover:text-blue-500 transition-colors">
                      <ArrowRight size={14} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      </PageTransition>
    </div>
  );
}

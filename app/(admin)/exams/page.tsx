'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/admin/Header';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import {
  ClipboardList, Plus, RefreshCw, Clock, Users,
  ArrowRight, CheckCircle2, HelpCircle, FileUp, Award,
} from 'lucide-react';
import Link from 'next/link';
import Spinner from '@/components/ui/Spinner';
import { LANGUAGE_FLAGS, getAvailableLanguages, formatDate } from '@/lib/utils';
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

interface MySession {
  examId: string;
  score: number;
  completedAt: string;
}

export default function ExamsPage() {
  const { error } = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');
  const [mySessions, setMySessions] = useState<MySession[]>([]);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    const [examsRes, meRes] = await Promise.all([
      fetch('/api/admin/exams'),
      fetch('/api/auth/me'),
    ]);
    if (examsRes.ok) setExams(await examsRes.json());
    else error('Failed to load exams');
    if (meRes.ok) {
      const me = await meRes.json();
      setUserRole(me?.role || '');
      // If advisor, load their own sessions
      if (me?.role === 'advisor') {
        const sessRes = await fetch('/api/admin/me/sessions');
        if (sessRes.ok) setMySessions(await sessRes.json());
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  const isAdvisor = userRole === 'advisor';
  const sessionMap = new Map(mySessions.map(s => [s.examId, s]));

  return (
    <div>
      <Header title="Exams" subtitle={isAdvisor ? 'Your exam results' : 'Create and manage assessment modules'} />
      <PageTransition>
      <div className="p-6">
        <div className="page-header">
          <div>
            <h2 className="section-title">
              {isAdvisor ? 'Exam Results' : 'Exam Management'}
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">{exams.length} exams</p>
          </div>
          {!isAdvisor && (
            <div className="flex gap-2">
              <button onClick={fetchExams} className="btn-secondary btn-sm"><RefreshCw size={14} /></button>
              <Link href="/exams/create-from-file" className="btn-secondary btn-sm">
                <FileUp size={14} /> Create from File
              </Link>
              <Link href="/exams/create" className="btn-primary btn-sm">
                <Plus size={14} /> Create New Exam
              </Link>
            </div>
          )}
          {isAdvisor && (
            <button onClick={fetchExams} className="btn-secondary btn-sm"><RefreshCw size={14} /></button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner className="text-blue-500" /></div>
        ) : exams.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No exams created yet"
            description="Create your first multilingual exam module."
            action={!isAdvisor ? <Link href="/exams/create" className="btn-primary btn-sm"><Plus size={14} /> Create Exam</Link> : undefined}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {exams.map((exam) => {
              const title = exam.titleEn || exam.titleTr || exam.titleFra || 'Untitled Exam';
              const totalTime = exam._count.questions * exam.timePerQuestion;
              const availLangs = getAvailableLanguages(exam as unknown as Record<string, unknown>);
              const mySession = sessionMap.get(exam.id);

              // Advisor card — not clickable, shows score badge
              if (isAdvisor) {
                return (
                  <div
                    key={exam.id}
                    className="card p-5 flex flex-col gap-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <ClipboardList size={18} className="text-blue-600" />
                      </div>
                      {mySession ? (
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          mySession.score >= 80 ? 'bg-emerald-100 text-emerald-700' :
                          mySession.score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {Math.round(mySession.score)}%
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                          {exam.isActive ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 text-sm leading-snug line-clamp-2">{title}</h3>
                      {mySession ? (
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                          <Award size={11} /> Completed {formatDate(mySession.completedAt)}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-1">Not completed</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {availLangs.map((lang) => (
                        <span key={lang} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {LANGUAGE_FLAGS[lang as Language]} {lang}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 border-t border-slate-100 pt-3">
                      <span className="flex items-center gap-1">
                        <HelpCircle size={12} /> {exam._count.questions} questions
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {Math.ceil(totalTime / 60)}m
                      </span>
                    </div>
                  </div>
                );
              }

              // Normal admin/staff card — clickable
              return (
                <Link
                  key={exam.id}
                  href={`/exams/${exam.id}`}
                  className="card p-5 flex flex-col gap-4 hover:border-blue-300 hover:shadow-md transition-all group cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <ClipboardList size={18} className="text-blue-600" />
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${exam.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {exam.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 text-sm leading-snug line-clamp-2">{title}</h3>
                    <p className="text-xs text-slate-400 mt-1">by {exam.creator?.name || 'Unknown'}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {availLangs.map((lang) => (
                      <span key={lang} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {LANGUAGE_FLAGS[lang as Language]} {lang}
                      </span>
                    ))}
                    {availLangs.length === 0 && (
                      <span className="text-xs text-slate-400 italic">No languages set</span>
                    )}
                  </div>
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

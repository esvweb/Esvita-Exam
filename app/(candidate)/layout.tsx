import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Results — Esvita Exam',
  description: 'View your exam results',
};

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      {/* Minimal header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-white fill-current">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p className="font-bold text-slate-800 text-sm leading-none">Esvita Exam</p>
          <p className="text-xs text-slate-400 mt-0.5">Candidate Portal</p>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-start justify-center p-6 pt-10">
        {children}
      </main>

      <footer className="text-center py-4 text-xs text-slate-400">
        © {new Date().getFullYear()} Esvita Clinic — Exam Management System
      </footer>
    </div>
  );
}

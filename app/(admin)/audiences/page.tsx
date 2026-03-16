'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/admin/Header';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { UserSquare2, Plus, RefreshCw, Mail, ArrowRight, Users2 } from 'lucide-react';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS, formatDate } from '@/lib/utils';
import type { Language } from '@/types';
import Spinner from '@/components/ui/Spinner';
import Link from 'next/link';
import PageTransition from '@/components/ui/PageTransition';

interface Team { id: string; name: string; color: string; }
interface Audience {
  id: string; name: string; email: string; preferredLanguage: string;
  isActive: boolean; createdAt: string;
  _count: { examSessions: number };
  team: Team | null;
}

export default function AudiencesPage() {
  const { success, error } = useToast();
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [userRole, setUserRole] = useState('');
  const [form, setForm] = useState({ name: '', email: '', preferredLanguage: 'EN', teamId: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [audRes, teamRes] = await Promise.all([
      fetch('/api/admin/audiences'),
      fetch('/api/admin/teams'),
    ]);
    if (audRes.ok) setAudiences(await audRes.json());
    if (teamRes.ok) setTeams(await teamRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    fetch('/api/auth/me').then(r => r.json()).then(d => setUserRole(d?.role || ''));
  }, [fetchData]);

  const filtered = audiences.filter((a) => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase());
    const matchTeam = !filterTeam || a.team?.id === filterTeam;
    return matchSearch && matchTeam;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/admin/audiences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, teamId: form.teamId || undefined }),
    });
    if (res.ok) {
      success('Candidate added successfully');
      setShowModal(false);
      setForm({ name: '', email: '', preferredLanguage: 'EN', teamId: '' });
      fetchData();
    } else {
      const d = await res.json();
      error(d.error || 'Failed to add candidate');
    }
    setSaving(false);
  };

  const canWrite = ['super_admin', 'admin', 'moderator'].includes(userRole);

  return (
    <div>
      <Header title="Candidates" subtitle="Manage Medical Advisor database" />
      <PageTransition>
      <div className="p-6">
        <div className="page-header">
          <div>
            <h2 className="section-title">Audience Management</h2>
            <p className="text-sm text-slate-400 mt-0.5">{audiences.length} candidates registered</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchData} className="btn-secondary btn-sm"><RefreshCw size={14} /></button>
            {canWrite && (
              <button onClick={() => setShowModal(true)} className="btn-primary btn-sm">
                <Plus size={14} /> Add Candidate
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          <input className="input max-w-xs" placeholder="Search by name or email..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input max-w-[200px]" value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}>
            <option value="">All Teams</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner className="text-blue-500" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={UserSquare2} title="No candidates found"
            description="Add Medical Advisors to the audience database."
            action={canWrite ? <button onClick={() => setShowModal(true)} className="btn-primary btn-sm"><Plus size={14} /> Add Candidate</button> : undefined} />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Candidate</th><th>Email</th><th>Team</th>
                  <th>Language</th><th>Exams</th><th>Status</th><th>Added</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold flex-shrink-0">
                          {a.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-800">{a.name}</span>
                      </div>
                    </td>
                    <td><div className="flex items-center gap-1.5 text-slate-500"><Mail size={13} /> {a.email}</div></td>
                    <td>
                      {a.team ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full"
                          style={{ backgroundColor: a.team.color + '20', color: a.team.color }}>
                          <Users2 size={11} /> {a.team.name}
                        </span>
                      ) : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td>
                      <span className="flex items-center gap-1.5 text-slate-600 text-sm">
                        <span>{LANGUAGE_FLAGS[a.preferredLanguage as Language]}</span>
                        {LANGUAGE_LABELS[a.preferredLanguage as Language] || a.preferredLanguage}
                      </span>
                    </td>
                    <td><span className={`font-semibold ${a._count.examSessions > 0 ? 'text-blue-600' : 'text-slate-400'}`}>{a._count.examSessions}</span></td>
                    <td>{a.isActive ? <span className="badge-green">Active</span> : <span className="badge-red">Inactive</span>}</td>
                    <td className="text-slate-400 text-xs">{formatDate(a.createdAt)}</td>
                    <td><Link href={`/audiences/${a.id}`} className="btn-ghost btn-sm">Profile <ArrowRight size={13} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Candidate" size="md">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="form-group">
              <label className="label">Full Name</label>
              <input className="input" placeholder="Dr. Jane Doe" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="label">Email Address</label>
              <input className="input" type="email" placeholder="jane.doe@example.com"
                value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Preferred Language</label>
                <select className="input" value={form.preferredLanguage}
                  onChange={(e) => setForm((f) => ({ ...f, preferredLanguage: e.target.value }))}>
                  {(['EN', 'FRA', 'RU', 'TR', 'ITA'] as Language[]).map((lang) => (
                    <option key={lang} value={lang}>{LANGUAGE_FLAGS[lang]} {LANGUAGE_LABELS[lang]}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Team (optional)</label>
                <select className="input" value={form.teamId}
                  onChange={(e) => setForm((f) => ({ ...f, teamId: e.target.value }))}>
                  <option value="">No Team</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <Spinner size="sm" className="text-white" /> : <Plus size={15} />}
                {saving ? 'Adding...' : 'Add Candidate'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
      </PageTransition>
    </div>
  );
}

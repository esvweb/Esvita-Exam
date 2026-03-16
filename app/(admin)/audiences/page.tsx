'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/admin/Header';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import {
  UserSquare2, Plus, RefreshCw, Mail, ArrowRight,
  Users2, RotateCcw, Trash2, Archive,
} from 'lucide-react';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS, formatDate } from '@/lib/utils';
import type { Language } from '@/types';
import Spinner from '@/components/ui/Spinner';
import Link from 'next/link';
import PageTransition from '@/components/ui/PageTransition';

interface Team { id: string; name: string; color: string; }
interface Audience {
  id: string; name: string; email: string; preferredLanguage: string;
  isActive: boolean; isArchived: boolean;
  nickname: string | null; realName: string | null;
  createdAt: string;
  _count: { examSessions: number };
  team: Team | null;
}

type StatusFilter = 'active' | 'passive' | 'archived' | 'all';

export default function AudiencesPage() {
  const { success, error } = useToast();
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('active');
  const [userRole, setUserRole] = useState('');
  const [form, setForm] = useState({
    name: '', email: '', preferredLanguage: 'EN', teamId: '',
    nickname: '', realName: '',
  });

  // Reset modal state
  const [resetTarget, setResetTarget] = useState<Audience | null>(null);
  const [resetForm, setResetForm] = useState({ newRealName: '', newEmail: '' });
  const [resetting, setResetting] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Audience | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toggle loading (audienceId → boolean)
  const [toggling, setToggling] = useState<string | null>(null);

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
    const matchSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase()) ||
      (a.nickname || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.realName || '').toLowerCase().includes(search.toLowerCase());
    const matchTeam = !filterTeam || a.team?.id === filterTeam;
    const matchStatus =
      filterStatus === 'all' ? true :
      filterStatus === 'active'   ? ( a.isActive && !a.isArchived) :
      filterStatus === 'passive'  ? (!a.isActive && !a.isArchived) :
      filterStatus === 'archived' ? a.isArchived : true;
    return matchSearch && matchTeam && matchStatus;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/admin/audiences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        teamId: form.teamId || undefined,
        nickname: form.nickname || undefined,
        realName: form.realName || undefined,
      }),
    });
    if (res.ok) {
      success('Candidate added successfully');
      setShowModal(false);
      setForm({ name: '', email: '', preferredLanguage: 'EN', teamId: '', nickname: '', realName: '' });
      fetchData();
    } else {
      const d = await res.json();
      error(d.error || 'Failed to add candidate');
    }
    setSaving(false);
  };

  const handleToggleActive = async (a: Audience) => {
    setToggling(a.id);
    const res = await fetch(`/api/admin/audiences/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !a.isActive }),
    });
    if (res.ok) {
      success(a.isActive ? 'Candidate set to passive' : 'Candidate set to active');
      fetchData();
    } else {
      const d = await res.json();
      error(d.error || 'Failed to update status');
    }
    setToggling(null);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetting(true);
    const res = await fetch(`/api/admin/audiences/${resetTarget.id}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resetForm),
    });
    if (res.ok) {
      success('Candidate reset — old record archived, new record created');
      setResetTarget(null);
      setResetForm({ newRealName: '', newEmail: '' });
      fetchData();
    } else {
      const d = await res.json();
      error(d.error || 'Failed to reset candidate');
    }
    setResetting(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/audiences/${deleteTarget.id}`, { method: 'DELETE' });
    if (res.ok) {
      success('Candidate deleted');
      setDeleteTarget(null);
      fetchData();
    } else {
      const d = await res.json();
      error(d.error || 'Failed to delete');
    }
    setDeleting(false);
  };

  const canWrite = ['super_admin', 'admin', 'moderator'].includes(userRole);
  const canDelete = ['super_admin', 'admin'].includes(userRole);

  const statusBadge = (a: Audience) => {
    if (a.isArchived) return <span className="badge-gray">Archived</span>;
    if (!a.isActive)  return <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>Passive</span>;
    return <span className="badge-green">Active</span>;
  };

  const statusCounts = {
    active:   audiences.filter(a => a.isActive && !a.isArchived).length,
    passive:  audiences.filter(a => !a.isActive && !a.isArchived).length,
    archived: audiences.filter(a => a.isArchived).length,
  };

  return (
    <div>
      <Header title="Candidates" subtitle="Manage Medical Advisor database" />
      <PageTransition>
        <div className="p-6">
          <div className="page-header">
            <div>
              <h2 className="section-title">Audience Management</h2>
              <p className="text-sm text-slate-400 mt-0.5">
                {statusCounts.active} active · {statusCounts.passive} passive · {statusCounts.archived} archived
              </p>
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

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <input className="input max-w-xs" placeholder="Search name, email, nickname..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="input max-w-[180px]" value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}>
              <option value="">All Teams</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {(['active', 'passive', 'archived', 'all'] as StatusFilter[]).map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium capitalize transition-all ${
                    filterStatus === s ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {s} {s !== 'all' && `(${statusCounts[s as keyof typeof statusCounts]})`}
                </button>
              ))}
            </div>
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
                    <th>Candidate</th><th>Nickname / Real Name</th><th>Email</th>
                    <th>Team</th><th>Lang</th><th>Exams</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id} className={a.isArchived ? 'opacity-60' : ''}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            a.isArchived ? 'bg-slate-100 text-slate-500' :
                            a.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {a.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-800">{a.name}</span>
                        </div>
                      </td>
                      <td>
                        <div className="text-xs">
                          {a.nickname && <p className="font-medium text-slate-700">{a.nickname}</p>}
                          {a.realName && <p className="text-slate-400">{a.realName}</p>}
                          {!a.nickname && !a.realName && <span className="text-slate-400">—</span>}
                        </div>
                      </td>
                      <td><div className="flex items-center gap-1.5 text-slate-500 text-xs"><Mail size={12} /> {a.email}</div></td>
                      <td>
                        {a.team ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: a.team.color + '20', color: a.team.color }}>
                            <Users2 size={10} /> {a.team.name}
                          </span>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td>
                        <span className="text-slate-600 text-sm">
                          {LANGUAGE_FLAGS[a.preferredLanguage as Language]}
                        </span>
                      </td>
                      <td><span className={`font-semibold text-sm ${a._count.examSessions > 0 ? 'text-blue-600' : 'text-slate-400'}`}>{a._count.examSessions}</span></td>
                      <td>{statusBadge(a)}</td>
                      <td>
                        <div className="flex gap-1 items-center">
                          {/* Active/Passive toggle */}
                          {canWrite && !a.isArchived && (
                            <button
                              onClick={() => handleToggleActive(a)}
                              disabled={toggling === a.id}
                              title={a.isActive ? 'Set to passive' : 'Set to active'}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
                                a.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                              }`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${
                                a.isActive ? 'translate-x-4' : 'translate-x-1'
                              }`} />
                            </button>
                          )}

                          {/* Profile link */}
                          <Link href={`/audiences/${a.id}`} className="btn-ghost btn-sm p-1.5" title="View profile">
                            <ArrowRight size={13} />
                          </Link>

                          {/* Reset button */}
                          {canWrite && !a.isArchived && (
                            <button
                              onClick={() => { setResetTarget(a); setResetForm({ newRealName: '', newEmail: '' }); }}
                              className="btn-ghost btn-sm p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50"
                              title="Reset (archive & reassign nickname)"
                            >
                              <RotateCcw size={13} />
                            </button>
                          )}

                          {/* Delete button */}
                          {canDelete && (
                            <button
                              onClick={() => setDeleteTarget(a)}
                              className="btn-ghost btn-sm p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50"
                              title={a.isArchived ? 'Permanently delete' : 'Delete candidate'}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add Candidate Modal */}
          <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Candidate" size="md">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="label">Nickname <span className="text-slate-400 font-normal">(company)</span></label>
                  <input className="input" placeholder="e.g. doc01" value={form.nickname}
                    onChange={(e) => setForm(f => ({ ...f, nickname: e.target.value, name: e.target.value || f.name }))} />
                  <p className="text-xs text-slate-400 mt-1">Short company identifier</p>
                </div>
                <div className="form-group">
                  <label className="label">Real Name <span className="text-red-500">*</span></label>
                  <input className="input" placeholder="Dr. Jane Doe" value={form.realName}
                    onChange={(e) => setForm(f => ({ ...f, realName: e.target.value, name: e.target.value || f.name }))}
                    required />
                </div>
              </div>
              <div className="form-group">
                <label className="label">Display Name <span className="text-slate-400 font-normal">(auto-filled)</span></label>
                <input className="input" placeholder="Name shown in system" value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="label">Email Address</label>
                <input className="input" type="email" placeholder="jane.doe@example.com"
                  value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="label">Preferred Language</label>
                  <select className="input" value={form.preferredLanguage}
                    onChange={(e) => setForm(f => ({ ...f, preferredLanguage: e.target.value }))}>
                    {(['EN', 'FRA', 'RU', 'TR', 'ITA'] as Language[]).map((lang) => (
                      <option key={lang} value={lang}>{LANGUAGE_FLAGS[lang]} {LANGUAGE_LABELS[lang]}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Team (optional)</label>
                  <select className="input" value={form.teamId}
                    onChange={(e) => setForm(f => ({ ...f, teamId: e.target.value }))}>
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

          {/* Reset Modal */}
          <Modal isOpen={!!resetTarget} onClose={() => setResetTarget(null)} title="Reset Candidate" size="sm">
            <div className="mb-4">
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                <Archive size={14} className="text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  The current record for <strong>{resetTarget?.name}</strong> (nickname: <strong>{resetTarget?.nickname || '—'}</strong>) will be archived. A new record with the same nickname will be created.
                </p>
              </div>
              <form onSubmit={handleReset} className="space-y-4">
                <div className="form-group">
                  <label className="label">New Person's Real Name <span className="text-red-500">*</span></label>
                  <input className="input" placeholder="Real name of the new employee"
                    value={resetForm.newRealName}
                    onChange={(e) => setResetForm(f => ({ ...f, newRealName: e.target.value }))}
                    required />
                </div>
                <div className="form-group">
                  <label className="label">New Email Address <span className="text-red-500">*</span></label>
                  <input className="input" type="email" placeholder="newperson@example.com"
                    value={resetForm.newEmail}
                    onChange={(e) => setResetForm(f => ({ ...f, newEmail: e.target.value }))}
                    required />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" className="btn-secondary" onClick={() => setResetTarget(null)}>Cancel</button>
                  <button type="submit" className="btn-primary bg-amber-600 hover:bg-amber-700" disabled={resetting}>
                    {resetting ? <Spinner size="sm" className="text-white" /> : <RotateCcw size={15} />}
                    {resetting ? 'Resetting...' : 'Archive & Create New'}
                  </button>
                </div>
              </form>
            </div>
          </Modal>

          {/* Delete Confirm */}
          <ConfirmDialog
            isOpen={!!deleteTarget}
            title="Delete Candidate"
            message={`Permanently delete "${deleteTarget?.name}"? Their exam history will be anonymized but preserved. This cannot be undone.`}
            confirmLabel="Delete Permanently"
            onConfirm={handleDelete}
            onClose={() => setDeleteTarget(null)}
            loading={deleting}
            variant="danger"
          />
        </div>
      </PageTransition>
    </div>
  );
}

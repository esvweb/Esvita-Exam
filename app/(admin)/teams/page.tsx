'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/admin/Header';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';
import { Users2, Plus, RefreshCw, Trash2, Pencil, Circle } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import PageTransition from '@/components/ui/PageTransition';

interface Team {
  id: string; name: string; color: string; isActive: boolean;
  createdAt: string; _count: { members: number };
}

const PRESET_COLORS = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#06B6D4', '#84CC16',
];

export default function TeamsPage() {
  const { success, error } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', color: '#3B82F6' });
  const [userRole, setUserRole] = useState('');

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/teams');
    if (res.ok) setTeams(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTeams();
    fetch('/api/auth/me').then(r => r.json()).then(d => setUserRole(d?.role || ''));
  }, [fetchTeams]);

  const openCreate = () => {
    setEditTeam(null);
    setForm({ name: '', color: '#3B82F6' });
    setShowModal(true);
  };

  const openEdit = (team: Team) => {
    setEditTeam(team);
    setForm({ name: team.name, color: team.color });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const method = editTeam ? 'PATCH' : 'POST';
    const body = editTeam ? { id: editTeam.id, ...form } : form;
    const res = await fetch('/api/admin/teams', {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (res.ok) {
      success(editTeam ? 'Team updated' : 'Team created');
      setShowModal(false);
      fetchTeams();
    } else {
      const d = await res.json();
      error(d.error || 'Failed to save team');
    }
    setSaving(false);
  };

  const handleDelete = async (team: Team) => {
    if (!confirm(`Delete team "${team.name}"? Members will be unassigned.`)) return;
    const res = await fetch(`/api/admin/teams?id=${team.id}`, { method: 'DELETE' });
    if (res.ok) { success('Team deleted'); fetchTeams(); }
    else { const d = await res.json(); error(d.error || 'Failed to delete'); }
  };

  const canDelete = ['super_admin', 'admin'].includes(userRole);
  const canWrite = ['super_admin', 'admin', 'moderator'].includes(userRole);

  return (
    <div>
      <Header title="Teams" subtitle="Organise advisors into groups" />
      <PageTransition>
      <div className="p-6">
        <div className="page-header">
          <div>
            <h2 className="section-title">Team Management</h2>
            <p className="text-sm text-slate-400 mt-0.5">{teams.length} teams</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchTeams} className="btn-secondary btn-sm"><RefreshCw size={14} /></button>
            {canWrite && (
              <button onClick={openCreate} className="btn-primary btn-sm">
                <Plus size={14} /> New Team
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner className="text-blue-500" /></div>
        ) : teams.length === 0 ? (
          <EmptyState
            icon={Users2}
            title="No teams yet"
            description="Create teams to organise your Medical Advisors."
            action={canWrite ? <button onClick={openCreate} className="btn-primary btn-sm"><Plus size={14} /> New Team</button> : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team) => (
              <div key={team.id} className="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: team.color + '20' }}
                    >
                      <Circle size={20} style={{ color: team.color }} fill={team.color} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{team.name}</h3>
                      <p className="text-xs text-slate-400">Created {formatDate(team.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {canWrite && (
                      <button
                        onClick={() => openEdit(team)}
                        className="btn-ghost btn-sm p-1.5"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(team)}
                        className="btn-ghost btn-sm p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <Users2 size={14} className="text-slate-400" />
                  <span className="text-sm text-slate-600">
                    <strong className="text-slate-800">{team._count.members}</strong> member{team._count.members !== 1 ? 's' : ''}
                  </span>
                  {!team.isActive && <span className="badge-gray ml-auto">Inactive</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editTeam ? 'Edit Team' : 'Create Team'} size="sm">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="form-group">
              <label className="label">Team Name</label>
              <input className="input" placeholder="e.g. Cardiology Team"
                value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="label">Colour</label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c} type="button"
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${form.color === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <Spinner size="sm" className="text-white" /> : <Plus size={15} />}
                {saving ? 'Saving...' : editTeam ? 'Save Changes' : 'Create Team'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
      </PageTransition>
    </div>
  );
}

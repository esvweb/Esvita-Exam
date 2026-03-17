'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/admin/Header';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { Users, Plus, Shield, UserCheck, RefreshCw, Trash2, Mail, Pencil, UsersRound, Sparkles, Eye } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/permissions';
import Spinner from '@/components/ui/Spinner';
import PageTransition from '@/components/ui/PageTransition';

interface User {
  id: string; email: string; name: string; role: string; isActive: boolean; createdAt: string;
  teamId: string | null;
  team: { id: string; name: string; color: string } | null;
}

interface Team { id: string; name: string; color: string; }

const ROLES = [
  { value: 'super_admin', label: 'Super Admin', desc: 'Full system access including user management' },
  { value: 'admin',       label: 'Admin',       desc: 'Full access except user management' },
  { value: 'moderator',   label: 'Moderator',   desc: 'Can manage exams, teams and audience — no delete access' },
  { value: 'team_leader', label: 'Team Leader', desc: 'Can view their team\'s exam results only (must be assigned a team)' },
  { value: 'staff',       label: 'Staff',       desc: 'Read-only access to all sections (administrative office staff)' },
  { value: 'advisor',     label: 'Advisor',     desc: 'Sees only their own exam scores on the Exams page (medical sales team)' },
];

// Admin/management roles vs system user roles
const MANAGER_ROLES = ['super_admin', 'admin', 'moderator', 'team_leader'];
const SYSTEM_USER_ROLES = ['staff', 'advisor'];

function UserTable({
  users, currentUserId, roleIconMap, onEdit, onDelete,
}: {
  users: User[];
  currentUserId: string;
  roleIconMap: Record<string, React.ReactNode>;
  onEdit: (u: User) => void;
  onDelete: (u: User) => void;
}) {
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr><th>Name</th><th>Email</th><th>Role</th><th>Team</th><th>Status</th><th>Joined</th><th></th></tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                    {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{user.name}</p>
                    {user.id === currentUserId && <p className="text-[10px] text-blue-500">You</p>}
                  </div>
                </div>
              </td>
              <td><div className="flex items-center gap-1.5 text-slate-500"><Mail size={13} />{user.email}</div></td>
              <td>
                <span className={`badge ${ROLE_COLORS[user.role] || 'badge-gray'}`}>
                  {roleIconMap[user.role]}
                  {ROLE_LABELS[user.role] || user.role}
                </span>
              </td>
              <td>
                {user.team ? (
                  <span className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: user.team.color }} />
                    {user.team.name}
                  </span>
                ) : (
                  <span className="text-slate-400 text-xs">—</span>
                )}
              </td>
              <td>{user.isActive ? <span className="badge-green">Active</span> : <span className="badge-red">Inactive</span>}</td>
              <td className="text-slate-400 text-xs">{formatDateTime(user.createdAt)}</td>
              <td>
                <div className="flex gap-1">
                  <button onClick={() => onEdit(user)} className="btn-ghost btn-sm p-1.5" title="Edit">
                    <Pencil size={13} />
                  </button>
                  {user.id !== currentUserId && (
                    <button onClick={() => onDelete(user)}
                      className="btn-ghost btn-sm p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50" title="Delete">
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
  );
}

export default function UsersPage() {
  const { success, error } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'staff', teamId: '' });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/users');
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }, []);

  const fetchTeams = useCallback(async () => {
    const res = await fetch('/api/admin/teams');
    if (res.ok) setTeams(await res.json());
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchTeams();
    fetch('/api/auth/me').then(r => r.json()).then(d => setCurrentUserId(d?.userId || ''));
  }, [fetchUsers, fetchTeams]);

  const openCreate = () => {
    setEditUser(null);
    setForm({ name: '', email: '', role: 'staff', teamId: '' });
    setShowModal(true);
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setForm({ name: user.name, email: user.email, role: user.role, teamId: user.teamId || '' });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (editUser) {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editUser.id,
          name: form.name,
          role: form.role,
          teamId: form.teamId || null,
        }),
      });
      if (res.ok) { success('User updated'); setShowModal(false); fetchUsers(); }
      else { const d = await res.json(); error(d.error || 'Failed to update'); }
    } else {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, teamId: form.teamId || null }),
      });
      if (res.ok) {
        success('User created successfully');
        setShowModal(false);
        setForm({ name: '', email: '', role: 'staff', teamId: '' });
        fetchUsers();
      } else {
        const d = await res.json();
        error(d.error || 'Failed to create user');
      }
    }
    setSaving(false);
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Delete "${user.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/users?id=${user.id}`, { method: 'DELETE' });
    if (res.ok) { success('User deleted'); fetchUsers(); }
    else { const d = await res.json(); error(d.error || 'Failed to delete'); }
  };

  const roleIconMap: Record<string, React.ReactNode> = {
    super_admin: <Shield size={10} className="mr-1" />,
    admin: <UserCheck size={10} className="mr-1" />,
    team_leader: <UsersRound size={10} className="mr-1" />,
    advisor: <Sparkles size={10} className="mr-1" />,
    staff: <Eye size={10} className="mr-1" />,
  };

  const managerUsers = users.filter(u => MANAGER_ROLES.includes(u.role));
  const systemUsers = users.filter(u => SYSTEM_USER_ROLES.includes(u.role));

  const selectedRoleDesc = ROLES.find(r => r.value === form.role)?.desc || '';

  return (
    <div>
      <Header title="User Management" subtitle="Manage system users and roles" />
      <PageTransition>
        <div className="p-6">
          <div className="page-header">
            <div>
              <h2 className="section-title">Users</h2>
              <p className="text-sm text-slate-400 mt-0.5">{users.length} users registered</p>
            </div>
            <div className="flex gap-2">
              <button onClick={fetchUsers} className="btn-secondary btn-sm"><RefreshCw size={14} /></button>
              <button onClick={openCreate} className="btn-primary btn-sm">
                <Plus size={14} /> Add User
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Spinner className="text-blue-500" /></div>
          ) : users.length === 0 ? (
            <EmptyState icon={Users} title="No users yet"
              description="Add users to the system."
              action={<button onClick={openCreate} className="btn-primary btn-sm"><Plus size={14} /> Add User</button>} />
          ) : (
            <div className="space-y-8">

              {/* Block 1: System Managers */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={15} className="text-blue-600" />
                  <h3 className="font-semibold text-slate-700 text-sm">System Managers</h3>
                  <span className="badge-blue">{managerUsers.length}</span>
                  <p className="text-xs text-slate-400 ml-1">Super Admin · Admin · Moderator · Team Leader</p>
                </div>
                {managerUsers.length === 0 ? (
                  <p className="text-sm text-slate-400 italic px-1">No manager-level users yet.</p>
                ) : (
                  <UserTable users={managerUsers} currentUserId={currentUserId}
                    roleIconMap={roleIconMap} onEdit={openEdit} onDelete={handleDelete} />
                )}
              </div>

              {/* Block 2: System Users */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Eye size={15} className="text-slate-500" />
                  <h3 className="font-semibold text-slate-700 text-sm">System Users</h3>
                  <span className="badge-gray">{systemUsers.length}</span>
                  <p className="text-xs text-slate-400 ml-1">Staff (admin kadro) · Advisor (medikal satış)</p>
                </div>
                {systemUsers.length === 0 ? (
                  <p className="text-sm text-slate-400 italic px-1">No system users yet.</p>
                ) : (
                  <UserTable users={systemUsers} currentUserId={currentUserId}
                    roleIconMap={roleIconMap} onEdit={openEdit} onDelete={handleDelete} />
                )}
              </div>
            </div>
          )}

          <Modal isOpen={showModal} onClose={() => setShowModal(false)}
            title={editUser ? 'Edit User' : 'Add User'} size="md">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="form-group">
                <label className="label">Full Name</label>
                <input className="input" placeholder="Dr. John Smith" value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              {!editUser && (
                <div className="form-group">
                  <label className="label">Email Address</label>
                  <input className="input" type="email" placeholder="john@esvitaclinic.com"
                    value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
                  <p className="text-xs text-slate-400 mt-1">Must be @esvitaclinic.com or @esvita.clinic</p>
                </div>
              )}
              <div className="form-group">
                <label className="label">Role</label>
                <select className="input" value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value, teamId: '' }))}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                {selectedRoleDesc && (
                  <p className="text-xs text-slate-400 mt-1">{selectedRoleDesc}</p>
                )}
              </div>

              {/* Team assignment — required for team_leader, optional for others */}
              {(form.role === 'team_leader' || form.teamId) && (
                <div className="form-group">
                  <label className="label">
                    Assigned Team {form.role === 'team_leader' && <span className="text-red-500">*</span>}
                  </label>
                  <select className="input" value={form.teamId}
                    onChange={(e) => setForm((f) => ({ ...f, teamId: e.target.value }))}
                    required={form.role === 'team_leader'}>
                    <option value="">— Select team —</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">
                    {form.role === 'team_leader'
                      ? 'Team leaders can only see results for members of this team.'
                      : 'Optional — associates this user with a team for reporting.'}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <Spinner size="sm" className="text-white" /> : <Plus size={15} />}
                  {saving ? 'Saving...' : editUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </Modal>
        </div>
      </PageTransition>
    </div>
  );
}

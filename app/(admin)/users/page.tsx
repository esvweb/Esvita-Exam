'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/admin/Header';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { Users, Plus, Shield, UserCheck, RefreshCw, Trash2, Mail, Pencil } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/permissions';
import Spinner from '@/components/ui/Spinner';
import PageTransition from '@/components/ui/PageTransition';

interface User {
  id: string; email: string; name: string; role: string; isActive: boolean; createdAt: string;
}

const ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'staff', label: 'Staff' },
];

export default function UsersPage() {
  const { success, error } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'staff' });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/users');
    if (res.ok) setUsers(await res.json());
    else { /* 403 = not super admin */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
    fetch('/api/auth/me').then(r => r.json()).then(d => setCurrentUserId(d?.userId || ''));
  }, [fetchUsers]);

  const openCreate = () => {
    setEditUser(null);
    setForm({ name: '', email: '', role: 'staff' });
    setShowModal(true);
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setForm({ name: user.name, email: user.email, role: user.role });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (editUser) {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editUser.id, name: form.name, role: form.role }),
      });
      if (res.ok) { success('User updated'); setShowModal(false); fetchUsers(); }
      else { const d = await res.json(); error(d.error || 'Failed to update'); }
    } else {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        success('User created successfully');
        setShowModal(false);
        setForm({ name: '', email: '', role: 'staff' });
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
  };

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
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr>
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
                    <td>{user.isActive ? <span className="badge-green">Active</span> : <span className="badge-red">Inactive</span>}</td>
                    <td className="text-slate-400 text-xs">{formatDateTime(user.createdAt)}</td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(user)} className="btn-ghost btn-sm p-1.5" title="Edit">
                          <Pencil size={13} />
                        </button>
                        {user.id !== currentUserId && (
                          <button onClick={() => handleDelete(user)}
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
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                {form.role === 'super_admin' && 'Full system access including user management'}
                {form.role === 'admin' && 'Full access except user management'}
                {form.role === 'moderator' && 'Can manage exams, teams and candidates — no delete access'}
                {form.role === 'staff' && 'Read-only access to all sections'}
              </p>
            </div>
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

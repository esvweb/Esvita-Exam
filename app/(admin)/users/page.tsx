'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/admin/Header';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import {
  Users, Plus, Shield, UserCheck, RefreshCw, Trash2, Mail,
  Pencil, UsersRound, Sparkles, Eye, UserSquare2, ArrowRight,
  Users2, RotateCcw, Archive, Search,
} from 'lucide-react';
import { formatDateTime, LANGUAGE_FLAGS, LANGUAGE_LABELS } from '@/lib/utils';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/permissions';
import type { Language } from '@/types';
import Spinner from '@/components/ui/Spinner';
import PageTransition from '@/components/ui/PageTransition';
import Link from 'next/link';

/* ─────────── Types ─────────── */
interface User {
  id: string; email: string; name: string; role: string; isActive: boolean; createdAt: string;
  teamId: string | null;
  team: { id: string; name: string; color: string } | null;
}
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

/* ─────────── Role config ─────────── */
const USER_ROLES = [
  { value: 'super_admin', label: 'Super Admin', desc: 'Full system access including user management' },
  { value: 'admin',       label: 'Admin',       desc: 'Full access except user management' },
  { value: 'moderator',   label: 'Moderator',   desc: 'Can manage exams, teams and audience — no delete access' },
  { value: 'team_leader', label: 'Team Leader', desc: "Can view their team's exam results only (must be assigned a team)" },
  { value: 'staff',       label: 'Staff',       desc: 'Read-only access to all sections (administrative office staff)' },
  { value: 'advisor',     label: 'Advisor',     desc: 'Sees only their own exam scores on the Exams page (medical sales team)' },
  { value: 'candidate',   label: 'Exam Candidate', desc: 'Exam candidate who can be invited to exams' },
];
const MANAGER_ROLES     = ['super_admin', 'admin', 'moderator'];
const BLOCK1_ROLES      = ['super_admin', 'admin', 'moderator', 'team_leader'];
const SYSTEM_USER_ROLES = ['staff', 'advisor'];

// Roles that get the extended form (nickname, realName, language, team)
const isSimpleRole = (role: string) => ['super_admin', 'admin', 'moderator'].includes(role);

/* ─────────── Audience status badge ─────────── */
function audStatusBadge(a: Audience) {
  if (a.isArchived) return <span className="badge-gray text-xs">Archived</span>;
  if (a.isActive)   return <span className="badge-green text-xs">Active</span>;
  return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Passive</span>;
}

/* ─────────── Main Page ─────────── */
export default function UsersPage() {
  const { success, error } = useToast();

  /* ── User state ── */
  const [users, setUsers]                         = useState<User[]>([]);
  const [teams, setTeams]                         = useState<Team[]>([]);
  const [currentUserId, setCurrentUserId]         = useState('');
  const [currentUserRole, setCurrentUserRole]     = useState('');
  const [loading, setLoading]                     = useState(true);
  const [showUserModal, setShowUserModal]         = useState(false);
  const [editUser, setEditUser]                   = useState<User | null>(null);
  const [savingUser, setSavingUser]               = useState(false);
  const [userForm, setUserForm]                   = useState({
    name: '', email: '', role: 'staff', teamId: '',
    nickname: '', realName: '', preferredLanguage: 'EN',
  });
  const [deleteUserTarget, setDeleteUserTarget]   = useState<User | null>(null);
  const [deletingUser, setDeletingUser]           = useState(false);

  // User toggle & reset
  const [togglingUser, setTogglingUser]           = useState<string | null>(null);
  const [resetUserTarget, setResetUserTarget]     = useState<User | null>(null);
  const [resetUserForm, setResetUserForm]         = useState({ newName: '', newEmail: '' });
  const [resettingUser, setResettingUser]         = useState(false);

  /* ── Audience state ── */
  const [audiences, setAudiences]                 = useState<Audience[]>([]);
  const [audienceLoading, setAudienceLoading]     = useState(true);
  const [sysSearch, setSysSearch]                 = useState('');
  const [filterTeam, setFilterTeam]               = useState('');
  const [filterStatus, setFilterStatus]           = useState<StatusFilter>('active');
  const [toggling, setToggling]                   = useState<string | null>(null);
  const [resetTarget, setResetTarget]             = useState<Audience | null>(null);
  const [resetForm, setResetForm]                 = useState({ newRealName: '', newEmail: '' });
  const [resetting, setResetting]                 = useState(false);
  const [deleteAudTarget, setDeleteAudTarget]     = useState<Audience | null>(null);
  const [deletingAud, setDeletingAud]             = useState(false);

  /* ── Fetchers ── */
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

  const fetchAudiences = useCallback(async () => {
    setAudienceLoading(true);
    const res = await fetch('/api/admin/audiences');
    if (res.ok) setAudiences(await res.json());
    setAudienceLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchTeams();
    fetchAudiences();
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      setCurrentUserId(d?.userId || '');
      setCurrentUserRole(d?.role || '');
    });
  }, [fetchUsers, fetchTeams, fetchAudiences]);

  /* ── User handlers ── */
  const openCreateUser = () => {
    setEditUser(null);
    setUserForm({ name: '', email: '', role: 'staff', teamId: '', nickname: '', realName: '', preferredLanguage: 'EN' });
    setShowUserModal(true);
  };
  const openEditUser = (user: User) => {
    setEditUser(user);
    setUserForm({ name: user.name, email: user.email, role: user.role, teamId: user.teamId || '', nickname: '', realName: user.name, preferredLanguage: 'EN' });
    setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUser(true);

    if (userForm.role === 'candidate') {
      // Create Audience record
      const displayName = userForm.realName || userForm.nickname || userForm.name;
      const res = await fetch('/api/admin/audiences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: displayName,
          realName: userForm.realName || undefined,
          nickname: userForm.nickname || undefined,
          email: userForm.email,
          preferredLanguage: userForm.preferredLanguage,
          teamId: userForm.teamId || undefined,
        }),
      });
      if (res.ok) {
        success('Candidate added');
        setShowUserModal(false);
        setUserForm({ name: '', email: '', role: 'staff', teamId: '', nickname: '', realName: '', preferredLanguage: 'EN' });
        fetchAudiences();
      } else {
        const d = await res.json();
        error(d.error || 'Failed to add candidate');
      }
    } else if (editUser) {
      // Update existing system user
      const name = isSimpleRole(userForm.role) ? userForm.name : (userForm.realName || userForm.name);
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editUser.id, name, role: userForm.role, teamId: userForm.teamId || null }),
      });
      if (res.ok) { success('User updated'); setShowUserModal(false); fetchUsers(); }
      else { const d = await res.json(); error(d.error || 'Failed to update'); }
    } else {
      // Create new system user
      const name = isSimpleRole(userForm.role) ? userForm.name : (userForm.realName || userForm.name);
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email: userForm.email, role: userForm.role, teamId: userForm.teamId || null }),
      });
      if (res.ok) {
        success('User created');
        setShowUserModal(false);
        setUserForm({ name: '', email: '', role: 'staff', teamId: '', nickname: '', realName: '', preferredLanguage: 'EN' });
        fetchUsers();
      } else {
        const d = await res.json();
        error(d.error || 'Failed to create user');
      }
    }
    setSavingUser(false);
  };

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    setDeletingUser(true);
    const res = await fetch(`/api/admin/users?id=${deleteUserTarget.id}`, { method: 'DELETE' });
    if (res.ok) { success('User deleted'); setDeleteUserTarget(null); fetchUsers(); }
    else { const d = await res.json(); error(d.error || 'Failed to delete'); }
    setDeletingUser(false);
  };

  const handleToggleUser = async (user: User) => {
    setTogglingUser(user.id);
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, isActive: !user.isActive }),
    });
    if (res.ok) { success(user.isActive ? 'Set to inactive' : 'Set to active'); fetchUsers(); }
    else { const d = await res.json(); error(d.error || 'Failed to update'); }
    setTogglingUser(null);
  };

  const handleResetUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUserTarget) return;
    setResettingUser(true);
    // Deactivate old user
    const patchRes = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: resetUserTarget.id, isActive: false }),
    });
    if (!patchRes.ok) {
      const d = await patchRes.json();
      error(d.error || 'Failed to deactivate user');
      setResettingUser(false);
      return;
    }
    // Create new user with same role/team
    const createRes = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: resetUserForm.newName,
        email: resetUserForm.newEmail,
        role: resetUserTarget.role,
        teamId: resetUserTarget.teamId,
      }),
    });
    if (createRes.ok) {
      success('User reset — old account deactivated, new account created');
      setResetUserTarget(null);
      setResetUserForm({ newName: '', newEmail: '' });
      fetchUsers();
    } else {
      const d = await createRes.json();
      error(d.error || 'Failed to create new user');
      // Re-activate old user on failure
      await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: resetUserTarget.id, isActive: true }),
      });
    }
    setResettingUser(false);
  };

  /* ── Audience handlers ── */
  const handleToggleActive = async (a: Audience) => {
    setToggling(a.id);
    const res = await fetch(`/api/admin/audiences/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !a.isActive }),
    });
    if (res.ok) { success(a.isActive ? 'Set to passive' : 'Set to active'); fetchAudiences(); }
    else { const d = await res.json(); error(d.error || 'Failed to update status'); }
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
      fetchAudiences();
    } else {
      const d = await res.json();
      error(d.error || 'Failed to reset candidate');
    }
    setResetting(false);
  };

  const handleDeleteAudience = async () => {
    if (!deleteAudTarget) return;
    setDeletingAud(true);
    const res = await fetch(`/api/admin/audiences/${deleteAudTarget.id}`, { method: 'DELETE' });
    if (res.ok) { success('Candidate deleted'); setDeleteAudTarget(null); fetchAudiences(); }
    else { const d = await res.json(); error(d.error || 'Failed to delete'); }
    setDeletingAud(false);
  };

  /* ── Derived ── */
  const managerUsers  = users.filter(u => BLOCK1_ROLES.includes(u.role));
  const systemUsers   = users.filter(u => SYSTEM_USER_ROLES.includes(u.role));

  const canWrite  = ['super_admin', 'admin', 'moderator'].includes(currentUserRole);
  const canDelete = ['super_admin', 'admin'].includes(currentUserRole);

  const isCandidate  = userForm.role === 'candidate';
  const isSimpleForm = isSimpleRole(userForm.role);
  const selectedRoleDesc = USER_ROLES.find(r => r.value === userForm.role)?.desc || '';

  const statusCounts = {
    active:   audiences.filter(a =>  a.isActive && !a.isArchived).length,
    passive:  audiences.filter(a => !a.isActive && !a.isArchived).length,
    archived: audiences.filter(a =>  a.isArchived).length,
  };

  const filteredAudiences = audiences.filter((a) => {
    const q = sysSearch.toLowerCase();
    const matchSearch = !sysSearch ||
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.nickname || '').toLowerCase().includes(q) ||
      (a.realName  || '').toLowerCase().includes(q);
    const matchTeam   = !filterTeam || a.team?.id === filterTeam;
    const matchStatus =
      filterStatus === 'all'      ? true :
      filterStatus === 'active'   ? ( a.isActive && !a.isArchived) :
      filterStatus === 'passive'  ? (!a.isActive && !a.isArchived) :
      filterStatus === 'archived' ? a.isArchived : true;
    return matchSearch && matchTeam && matchStatus;
  });

  const filteredSystemUsers = systemUsers.filter(u => {
    const q = sysSearch.toLowerCase();
    return !sysSearch || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });
  const showStaffAdvisor = filterStatus === 'active' || filterStatus === 'all' || !filterStatus;

  const roleIconMap: Record<string, React.ReactNode> = {
    super_admin: <Shield size={10} className="mr-1" />,
    admin:       <UserCheck size={10} className="mr-1" />,
    team_leader: <UsersRound size={10} className="mr-1" />,
    advisor:     <Sparkles size={10} className="mr-1" />,
    staff:       <Eye size={10} className="mr-1" />,
  };

  /* ─────────── JSX ─────────── */
  return (
    <div>
      <Header title="User Management" subtitle="Manage system users, roles and exam audience" />
      <PageTransition>
        <div className="p-6 space-y-8">

          {/* ── Top header ── */}
          <div className="page-header">
            <div>
              <h2 className="section-title">Users</h2>
              <p className="text-sm text-slate-400 mt-0.5">{users.length + audiences.length} total</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { fetchUsers(); fetchAudiences(); }} className="btn-secondary btn-sm">
                <RefreshCw size={14} />
              </button>
              <button onClick={openCreateUser} className="btn-primary btn-sm">
                <Plus size={14} /> Add User
              </button>
            </div>
          </div>

          {/* ── Block 1: System Managers ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield size={15} className="text-blue-600" />
              <h3 className="font-semibold text-slate-700 text-sm">System Managers</h3>
              <span className="badge-blue">{managerUsers.length}</span>
              <p className="text-xs text-slate-400 ml-1">Super Admin · Admin · Moderator · Team Leader</p>
            </div>
            {loading ? (
              <div className="flex justify-center py-8"><Spinner className="text-blue-500" /></div>
            ) : managerUsers.length === 0 ? (
              <p className="text-sm text-slate-400 italic px-1">No manager-level users yet.</p>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr><th>Name</th><th>Email</th><th>Role</th><th>Team</th><th>Status</th><th>Joined</th><th></th></tr>
                  </thead>
                  <tbody>
                    {managerUsers.map(user => (
                      <tr key={user.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                              {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
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
                            {roleIconMap[user.role]}{ROLE_LABELS[user.role] || user.role}
                          </span>
                        </td>
                        <td>
                          {user.team ? (
                            <span className="flex items-center gap-1.5 text-xs text-slate-600">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: user.team.color }} />
                              {user.team.name}
                            </span>
                          ) : <span className="text-slate-400 text-xs">—</span>}
                        </td>
                        <td>{user.isActive ? <span className="badge-green">Active</span> : <span className="badge-red">Inactive</span>}</td>
                        <td className="text-slate-400 text-xs">{formatDateTime(user.createdAt)}</td>
                        <td>
                          <div className="flex gap-1">
                            <button onClick={() => openEditUser(user)} className="btn-ghost btn-sm p-1.5" title="Edit"><Pencil size={13} /></button>
                            {user.id !== currentUserId && (
                              <button onClick={() => setDeleteUserTarget(user)} className="btn-ghost btn-sm p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50" title="Delete"><Trash2 size={13} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Block 2: System Users (staff + advisor + audience/candidates) ── */}
          <div>
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Eye size={15} className="text-slate-500" />
              <h3 className="font-semibold text-slate-700 text-sm">System Users</h3>
              <span className="badge-gray">{systemUsers.length + audiences.length}</span>
              <p className="text-xs text-slate-400 ml-1">Staff · Advisor · Exam Candidates</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input pl-8 w-60 text-sm" placeholder="Search name, email, nickname..."
                  value={sysSearch} onChange={(e) => setSysSearch(e.target.value)} />
              </div>
              <select className="input max-w-[160px] text-sm" value={filterTeam}
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
                    {s}{s !== 'all' && ` (${statusCounts[s as keyof typeof statusCounts]})`}
                  </button>
                ))}
              </div>
            </div>

            {loading || audienceLoading ? (
              <div className="flex justify-center py-10"><Spinner className="text-blue-500" /></div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr><th>Name</th><th>Email</th><th>Type</th><th>Team</th><th>Status</th><th>Created</th><th></th></tr>
                  </thead>
                  <tbody>

                    {/* ── Staff / Advisor system users ── */}
                    {showStaffAdvisor && filteredSystemUsers.map(user => (
                      <tr key={user.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                              {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">{user.name}</p>
                              {user.id === currentUserId && <p className="text-[10px] text-blue-500">You</p>}
                            </div>
                          </div>
                        </td>
                        <td><div className="flex items-center gap-1.5 text-slate-500 text-xs"><Mail size={12} />{user.email}</div></td>
                        <td>
                          <span className={`badge ${ROLE_COLORS[user.role] || 'badge-gray'}`}>
                            {roleIconMap[user.role]}{ROLE_LABELS[user.role] || user.role}
                          </span>
                        </td>
                        <td>
                          {user.team ? (
                            <span className="flex items-center gap-1.5 text-xs text-slate-600">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: user.team.color }} />
                              {user.team.name}
                            </span>
                          ) : <span className="text-slate-400 text-xs">—</span>}
                        </td>
                        <td>{user.isActive ? <span className="badge-green">Active</span> : <span className="badge-red">Inactive</span>}</td>
                        <td className="text-slate-400 text-xs">{formatDateTime(user.createdAt)}</td>
                        <td>
                          <div className="flex gap-1 items-center">
                            {/* Toggle active/passive */}
                            <button
                              onClick={() => handleToggleUser(user)}
                              disabled={togglingUser === user.id || user.id === currentUserId}
                              title={user.isActive ? 'Set to inactive' : 'Set to active'}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
                                user.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                              } ${user.id === currentUserId ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${
                                user.isActive ? 'translate-x-4' : 'translate-x-1'
                              }`} />
                            </button>
                            {/* Edit */}
                            <button onClick={() => openEditUser(user)} className="btn-ghost btn-sm p-1.5" title="Edit">
                              <Pencil size={13} />
                            </button>
                            {/* Reset */}
                            {canWrite && user.id !== currentUserId && (
                              <button
                                onClick={() => { setResetUserTarget(user); setResetUserForm({ newName: '', newEmail: '' }); }}
                                className="btn-ghost btn-sm p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50"
                                title="Reset (deactivate & create new)"
                              >
                                <RotateCcw size={13} />
                              </button>
                            )}
                            {/* Delete */}
                            {canDelete && user.id !== currentUserId && (
                              <button onClick={() => setDeleteUserTarget(user)}
                                className="btn-ghost btn-sm p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50" title="Delete">
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}

                    {/* ── Audience / Exam Candidates ── */}
                    {filteredAudiences.map(a => (
                      <tr key={a.id} className={a.isArchived ? 'opacity-60' : ''}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              a.isArchived ? 'bg-slate-100 text-slate-500' :
                              a.isActive   ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {a.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-slate-800 text-sm">{a.name}</p>
                              {a.nickname && <p className="text-[10px] text-slate-400">{a.nickname}</p>}
                            </div>
                          </div>
                        </td>
                        <td><div className="flex items-center gap-1.5 text-slate-500 text-xs"><Mail size={12} /> {a.email}</div></td>
                        <td>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            <UserSquare2 size={9} /> Candidate
                          </span>
                        </td>
                        <td>
                          {a.team ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: a.team.color + '20', color: a.team.color }}>
                              <Users2 size={10} /> {a.team.name}
                            </span>
                          ) : <span className="text-slate-400 text-xs">—</span>}
                        </td>
                        <td>{audStatusBadge(a)}</td>
                        <td className="text-slate-400 text-xs">{formatDateTime(a.createdAt)}</td>
                        <td>
                          <div className="flex gap-1 items-center">
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
                            <Link href={`/audiences/${a.id}`} className="btn-ghost btn-sm p-1.5" title="View profile">
                              <ArrowRight size={13} />
                            </Link>
                            {canWrite && !a.isArchived && (
                              <button
                                onClick={() => { setResetTarget(a); setResetForm({ newRealName: '', newEmail: '' }); }}
                                className="btn-ghost btn-sm p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50"
                                title="Reset"
                              >
                                <RotateCcw size={13} />
                              </button>
                            )}
                            {canDelete && (
                              <button onClick={() => setDeleteAudTarget(a)}
                                className="btn-ghost btn-sm p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50" title="Delete">
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}

                    {showStaffAdvisor && filteredSystemUsers.length === 0 && filteredAudiences.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center text-slate-400 text-sm py-8">No users found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ════════ MODALS ════════ */}

          {/* Add / Edit User Modal */}
          <Modal
            isOpen={showUserModal}
            onClose={() => setShowUserModal(false)}
            title={editUser ? 'Edit User' : isCandidate ? 'Add Exam Candidate' : 'Add User'}
            size="md"
          >
            <form onSubmit={handleSaveUser} className="space-y-4">

              {/* Role / Type selector */}
              <div className="form-group">
                <label className="label">Type / Role</label>
                <select className="input" value={userForm.role}
                  onChange={(e) => setUserForm(f => ({ ...f, role: e.target.value, teamId: '' }))}>
                  {USER_ROLES
                    .filter(r => editUser ? r.value !== 'candidate' : true)
                    .map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                {selectedRoleDesc && <p className="text-xs text-slate-400 mt-1">{selectedRoleDesc}</p>}
              </div>

              {isSimpleForm ? (
                /* ── Simple form for Super Admin / Admin / Moderator ── */
                <>
                  <div className="form-group">
                    <label className="label">Full Name</label>
                    <input className="input" placeholder="Dr. John Smith" value={userForm.name}
                      onChange={(e) => setUserForm(f => ({ ...f, name: e.target.value }))} required />
                  </div>
                  {!editUser && (
                    <div className="form-group">
                      <label className="label">Email Address</label>
                      <input className="input" type="email" placeholder="john@esvitaclinic.com"
                        value={userForm.email} onChange={(e) => setUserForm(f => ({ ...f, email: e.target.value }))} required />
                      <p className="text-xs text-slate-400 mt-1">Must be @esvitaclinic.com or @esvita.clinic</p>
                    </div>
                  )}
                </>
              ) : (
                /* ── Extended form for Team Leader / Staff / Advisor / Candidate ── */
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-group">
                      <label className="label">Nickname <span className="text-slate-400 font-normal">(company)</span></label>
                      <input className="input" placeholder="e.g. doc01" value={userForm.nickname}
                        onChange={(e) => setUserForm(f => ({ ...f, nickname: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="label">Real Name <span className="text-red-500">*</span></label>
                      <input className="input" placeholder="Dr. Jane Doe" value={userForm.realName}
                        onChange={(e) => setUserForm(f => ({ ...f, realName: e.target.value }))} required />
                    </div>
                  </div>
                  {!editUser && (
                    <div className="form-group">
                      <label className="label">Email Address</label>
                      <input className="input" type="email" placeholder="jane.doe@example.com"
                        value={userForm.email} onChange={(e) => setUserForm(f => ({ ...f, email: e.target.value }))} required />
                      {!isCandidate && (
                        <p className="text-xs text-slate-400 mt-1">Must be @esvitaclinic.com or @esvita.clinic</p>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {isCandidate && (
                      <div className="form-group">
                        <label className="label">Preferred Language</label>
                        <select className="input" value={userForm.preferredLanguage}
                          onChange={(e) => setUserForm(f => ({ ...f, preferredLanguage: e.target.value }))}>
                          {(['EN', 'FRA', 'RU', 'TR', 'ITA'] as Language[]).map(lang => (
                            <option key={lang} value={lang}>{LANGUAGE_FLAGS[lang]} {LANGUAGE_LABELS[lang]}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className={`form-group ${isCandidate ? '' : 'col-span-2'}`}>
                      <label className="label">
                        Team {userForm.role === 'team_leader' ? <span className="text-red-500">*</span> : <span className="text-slate-400 font-normal">(optional)</span>}
                      </label>
                      <select className="input" value={userForm.teamId}
                        onChange={(e) => setUserForm(f => ({ ...f, teamId: e.target.value }))}
                        required={userForm.role === 'team_leader'}>
                        <option value="">No Team</option>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowUserModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={savingUser}>
                  {savingUser ? <Spinner size="sm" className="text-white" /> : <Plus size={15} />}
                  {savingUser ? 'Saving...' : editUser ? 'Save Changes' : isCandidate ? 'Add Candidate' : 'Create User'}
                </button>
              </div>
            </form>
          </Modal>

          {/* Delete User Confirm */}
          <ConfirmDialog
            isOpen={!!deleteUserTarget}
            title="Delete User"
            message={`Delete "${deleteUserTarget?.name}"? This cannot be undone.`}
            confirmLabel="Delete"
            onConfirm={handleDeleteUser}
            onClose={() => setDeleteUserTarget(null)}
            loading={deletingUser}
            variant="danger"
          />

          {/* Reset System User Modal */}
          <Modal isOpen={!!resetUserTarget} onClose={() => setResetUserTarget(null)} title="Reset System User" size="sm">
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              <Archive size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                <strong>{resetUserTarget?.name}</strong> will be deactivated. A new {ROLE_LABELS[resetUserTarget?.role || ''] || ''} account will be created with the information below.
              </p>
            </div>
            <form onSubmit={handleResetUser} className="space-y-4">
              <div className="form-group">
                <label className="label">New Person's Full Name <span className="text-red-500">*</span></label>
                <input className="input" placeholder="Full name of the new person"
                  value={resetUserForm.newName}
                  onChange={(e) => setResetUserForm(f => ({ ...f, newName: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="label">New Email Address <span className="text-red-500">*</span></label>
                <input className="input" type="email" placeholder="newperson@esvitaclinic.com"
                  value={resetUserForm.newEmail}
                  onChange={(e) => setResetUserForm(f => ({ ...f, newEmail: e.target.value }))} required />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setResetUserTarget(null)}>Cancel</button>
                <button type="submit" className="btn-primary bg-amber-600 hover:bg-amber-700" disabled={resettingUser}>
                  {resettingUser ? <Spinner size="sm" className="text-white" /> : <RotateCcw size={15} />}
                  {resettingUser ? 'Resetting...' : 'Deactivate & Create New'}
                </button>
              </div>
            </form>
          </Modal>

          {/* Reset Candidate Modal */}
          <Modal isOpen={!!resetTarget} onClose={() => setResetTarget(null)} title="Reset Candidate" size="sm">
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              <Archive size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                The current record for <strong>{resetTarget?.name}</strong> (nickname: <strong>{resetTarget?.nickname || '—'}</strong>) will be archived. A new record with the same nickname will be created.
              </p>
            </div>
            <form onSubmit={handleReset} className="space-y-4">
              <div className="form-group">
                <label className="label">New Person's Real Name <span className="text-red-500">*</span></label>
                <input className="input" placeholder="Real name of the new employee"
                  value={resetForm.newRealName}
                  onChange={(e) => setResetForm(f => ({ ...f, newRealName: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="label">New Email Address <span className="text-red-500">*</span></label>
                <input className="input" type="email" placeholder="newperson@example.com"
                  value={resetForm.newEmail}
                  onChange={(e) => setResetForm(f => ({ ...f, newEmail: e.target.value }))} required />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setResetTarget(null)}>Cancel</button>
                <button type="submit" className="btn-primary bg-amber-600 hover:bg-amber-700" disabled={resetting}>
                  {resetting ? <Spinner size="sm" className="text-white" /> : <RotateCcw size={15} />}
                  {resetting ? 'Resetting...' : 'Archive & Create New'}
                </button>
              </div>
            </form>
          </Modal>

          {/* Delete Candidate Confirm */}
          <ConfirmDialog
            isOpen={!!deleteAudTarget}
            title="Delete Candidate"
            message={`Permanently delete "${deleteAudTarget?.name}"? Their exam history will be anonymized but preserved. This cannot be undone.`}
            confirmLabel="Delete Permanently"
            onConfirm={handleDeleteAudience}
            onClose={() => setDeleteAudTarget(null)}
            loading={deletingAud}
            variant="danger"
          />
        </div>
      </PageTransition>
    </div>
  );
}

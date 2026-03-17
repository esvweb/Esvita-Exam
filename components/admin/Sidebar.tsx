'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, UserSquare2, ClipboardList,
  BarChart3, LogOut, GraduationCap, Users2, Shield,
  UserCheck, Briefcase, Eye, UsersRound, Sparkles,
} from 'lucide-react';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/permissions';

interface Props {
  role: string;
  userName: string;
  userEmail: string;
  teamId?: string;
}

const ROLE_ICONS: Record<string, React.ElementType> = {
  super_admin: Shield,
  admin: UserCheck,
  moderator: Briefcase,
  team_leader: UsersRound,
  staff: Eye,
  advisor: Sparkles,
};

// Nav items visible to team_leader only
const TEAM_LEADER_NAV = [
  { href: '/team', icon: UsersRound, label: 'My Team' },
];

// Advisor: limited view — only dashboard, exams, reports
const ADVISOR_NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/exams',     icon: ClipboardList,   label: 'Exams' },
  { href: '/reports',   icon: BarChart3,        label: 'Reports' },
];

// Full nav items for admins / mods / staff
const ADMIN_NAV = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',       roles: null },
  { href: '/exams',      icon: ClipboardList,   label: 'Exams',           roles: null },
  { href: '/teams',      icon: Users2,          label: 'Teams',           roles: null },
  { href: '/reports',    icon: BarChart3,       label: 'Reports',         roles: null },
  { href: '/users',      icon: Users,           label: 'User Management', roles: ['super_admin'] },
];

export default function Sidebar({ role, userName, userEmail }: Props) {
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const isTeamLeader = role === 'team_leader';
  const isAdvisor = role === 'advisor';

  const navItems = isTeamLeader
    ? TEAM_LEADER_NAV
    : isAdvisor
    ? ADVISOR_NAV
    : ADMIN_NAV.filter(item => !item.roles || item.roles.includes(role));

  const RoleIcon = ROLE_ICONS[role] || UserCheck;
  const initials = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const roleBadgeClass =
    role === 'super_admin' ? 'bg-blue-100 text-blue-700' :
    role === 'admin'       ? 'bg-purple-100 text-purple-700' :
    role === 'moderator'   ? 'bg-emerald-100 text-emerald-700' :
    role === 'team_leader' ? 'bg-amber-100 text-amber-700' :
    role === 'advisor'     ? 'bg-yellow-100 text-yellow-700' :
    'bg-slate-100 text-slate-600';

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 flex flex-col z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <GraduationCap size={20} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm leading-tight">Esvita</p>
            <p className="text-xs text-slate-400 leading-tight">Exam System</p>
          </div>
        </div>
      </div>

      {/* User info */}
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">{userName}</p>
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 ${roleBadgeClass}`}>
              <RoleIcon size={9} />
              {ROLE_LABELS[role] || role}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-3 mb-2">
          Navigation
        </p>
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <Link href={item.href} className={`sidebar-link ${isActive ? 'active' : ''}`}>
                  <item.icon size={17} />
                  <span>{item.label}</span>
                  {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-slate-100">
        <p className="text-[10px] text-slate-400 px-3 mb-2 truncate">{userEmail}</p>
        <button onClick={handleLogout} className="sidebar-link w-full text-red-500 hover:bg-red-50 hover:text-red-600">
          <LogOut size={17} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

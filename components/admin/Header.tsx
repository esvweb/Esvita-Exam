'use client';

import NotificationBell from './NotificationBell';

interface HeaderProps {
  title: string;
  subtitle?: string;
  userName?: string;
  userEmail?: string;
}

export default function Header({ title, subtitle, userName, userEmail }: HeaderProps) {
  const initials = userName
    ? userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'AD';

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
      <div>
        <h1 className="text-base font-semibold text-slate-800">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <NotificationBell />
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
            {initials}
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-semibold text-slate-700 leading-tight">{userName || 'Admin'}</p>
            <p className="text-[10px] text-slate-400 leading-tight">{userEmail || ''}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

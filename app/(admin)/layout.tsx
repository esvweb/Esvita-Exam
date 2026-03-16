import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import Sidebar from '@/components/admin/Sidebar';
import { ToastProvider } from '@/components/ui/Toast';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  return (
    <ToastProvider>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar
          role={session.role}
          userName={session.name}
          userEmail={session.email}
          teamId={session.teamId}
        />
        <div className="flex-1 ml-64 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

import { TopNav } from '@/components/layout/TopNav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TODO: replace with real session data from Better-Auth + tRPC
  const mockUser = {
    name: 'Dr. Ana Silva',
    role: 'profissional' as const,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav userName={mockUser.name} userRole={mockUser.role} />
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}

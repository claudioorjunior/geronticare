import { TopNav } from '@/components/layout/TopNav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}

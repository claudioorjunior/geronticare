import { TopNav } from '@/components/layout/TopNav';

export default function PacientesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />
      <main className="mx-auto max-w-7xl px-8 py-8">
        {children}
      </main>
    </div>
  );
}

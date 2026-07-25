import { TopNav } from '@/components/layout/TopNav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      <TopNav />
      <main className="mx-auto max-w-[1200px] px-8 py-10">
        {children}
      </main>
    </div>
  );
}

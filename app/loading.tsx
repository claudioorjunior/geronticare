export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-m3-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-3 border-m3-primary/20 border-t-m3-primary rounded-full animate-spin" />
        <p className="text-body-md text-m3-secondary">Carregando...</p>
      </div>
    </div>
  );
}

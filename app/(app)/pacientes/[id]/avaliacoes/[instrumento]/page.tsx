import { notFound } from 'next/navigation';
import { InstrumentoWorkspace } from '@/components/instrumentos/InstrumentoWorkspace';
import { isInstrumentoSlug } from '@/lib/instrumentos/instrumentos';

export default async function InstrumentoPage({
  params,
}: {
  params: Promise<{ id: string; instrumento: string }>;
}) {
  const { id, instrumento } = await params;

  if (!isInstrumentoSlug(instrumento)) {
    notFound();
  }

  return <InstrumentoWorkspace pacienteId={id} instrumento={instrumento} />;
}

import { AvaliacoesCatalogo } from '@/components/instrumentos/AvaliacoesCatalogo';

export default async function AvaliacoesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AvaliacoesCatalogo pacienteId={id} />;
}

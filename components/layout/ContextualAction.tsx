'use client';

import Link from 'next/link';
import { Plus, ClipboardPlus } from 'lucide-react';
import type { UserRole } from '@/lib/auth/use-user-role';

/**
 * Ação principal do shell por papel:
 * - admin → `Nova admissão` abre o mesmo PatientForm da página /pacientes
 * - profissional → `Registrar evolução` (rota do prontuário)
 * - leitura → sem ação principal
 */
export function ContextualAction({
  role,
  onNovaAdmissaoAction,
}: {
  role: UserRole | null;
  onNovaAdmissaoAction?: () => void;
}) {
  if (role === 'usuario' || role === null) return null;

  const isAdmin = role === 'admin';
  if (isAdmin && onNovaAdmissaoAction) {
    return (
      <button
        type="button"
        onClick={onNovaAdmissaoAction}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-institution-active px-3.5 text-sm font-medium text-institution-active-fg transition-colors hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> Nova admissão
      </button>
    );
  }

  return (
    <Link
      href="/pacientes"
      className="inline-flex h-9 items-center gap-2 rounded-lg bg-institution-active px-3.5 text-sm font-medium text-institution-active-fg transition-colors hover:opacity-90"
    >
      {isAdmin ? <Plus className="h-4 w-4" /> : <ClipboardPlus className="h-4 w-4" />}
      {isAdmin ? 'Nova admissão' : 'Registrar evolução'}
    </Link>
  );
}

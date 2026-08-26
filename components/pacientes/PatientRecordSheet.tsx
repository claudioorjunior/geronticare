'use client';

import type { ReactNode } from 'react';

/**
 * Folha do prontuário (handoff §3/§5): a superfície branca contínua onde vive
 * o conteúdo clínico da seção ativa. Recebe a rail encaixada à esquerda.
 *
 * A folha NÃO é um `Card` por item (handoff §7): é uma superfície única e
 * ampla, preparada para texto clínico, tabelas e formulários. O título da
 * seção é repetido no topo da folha (spec: “A folha repete o nome da seção”).
 */
export function PatientRecordSheet({
  rail,
  children,
}: {
  rail: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      {/* Em telas estreitas, mantém todas as seções acessíveis em uma faixa
          horizontal; no desktop, preserva o rail de fichário vertical. */}
      <div className="mb-3 md:hidden">{rail}</div>

      <div className="flex gap-0">
        <div className="hidden w-44 shrink-0 md:block">{rail}</div>

        {/* Folha branca de conteúdo clínico */}
        <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white shadow-sm md:rounded-tl-none">
          <div className="px-4 py-5 sm:px-6 sm:py-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

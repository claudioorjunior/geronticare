'use client';

import { Paperclip, Download, FileText } from 'lucide-react';
import { baixarAnexo } from './anexos-download';

export type AnexoChip = {
  chave: string;
  nome: string;
  tipo?: string;
};

function iconePorTipo(tipo?: string) {
  if (tipo?.startsWith('image/')) return <FileText className="h-3 w-3" />;
  return <Paperclip className="h-3 w-3" />;
}

/**
 * Chips clicáveis de anexo (cartão do registro e aba Documentos).
 * O clique dispara o download autorizado por sessão.
 */
export function AnexosChips({ anexos }: { anexos: AnexoChip[] }) {
  if (!anexos || anexos.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {anexos.map((anexo) => (
        <button
          key={anexo.chave}
          type="button"
          onClick={() => {
            void baixarAnexo(anexo.chave).catch((error: unknown) => {
              alert(error instanceof Error ? error.message : 'Falha ao baixar anexo');
            });
          }}
          className="inline-flex max-w-[240px] items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100"
          title={`Baixar ${anexo.nome}`}
        >
          {iconePorTipo(anexo.tipo)}
          <span className="truncate">{anexo.nome}</span>
          <Download className="h-3 w-3 shrink-0 text-slate-400" />
        </button>
      ))}
    </div>
  );
}

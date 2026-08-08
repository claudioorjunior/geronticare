'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { FileText, Paperclip, Download, AlertCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { baixarAnexo } from '@/components/registros/anexos-download';
import { AnexosUploadDireto } from '@/components/registros/AnexosUploadDireto';

function formatarBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatarData(data: Date | string): string {
  return new Date(data).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function DocumentosPage() {
  const params = useParams<{ id: string }>();
  const pacienteId = params.id;
  const [filtroTipo, setFiltroTipo] = useState<string | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);

  const anexosQuery = trpc.anexos.listarPorPaciente.useQuery(
    { pacienteId },
    { enabled: Boolean(pacienteId) },
  );
  const storageQuery = trpc.anexos.status.useQuery();

  const tipos = useMemo(() => {
    const set = new Set<string>();
    for (const a of anexosQuery.data ?? []) {
      const cat = a.tipo.startsWith('image/') ? 'Imagem' : a.tipo.startsWith('application/pdf') ? 'PDF' : 'Documento';
      set.add(cat);
    }
    return Array.from(set);
  }, [anexosQuery.data]);

  const filtrados = useMemo(() => {
    const lista = anexosQuery.data ?? [];
    if (!filtroTipo) return lista;
    return lista.filter((a) => {
      const cat = a.tipo.startsWith('image/') ? 'Imagem' : a.tipo.startsWith('application/pdf') ? 'PDF' : 'Documento';
      return cat === filtroTipo;
    });
  }, [anexosQuery.data, filtroTipo]);

  async function baixar(chave: string) {
    setBaixando(chave);
    try {
      await baixarAnexo(chave);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Falha ao baixar anexo');
    } finally {
      setBaixando(null);
    }
  }

  if (!storageQuery.data?.configurado) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Anexos indisponíveis — configure o storage no <code className="rounded bg-amber-100 px-1">.env</code> para habilitar uploads.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-slate-500">Documentos do paciente</h2>
        <div className="flex flex-wrap items-center gap-3">
          {storageQuery.data?.configurado && storageQuery.data.podeCriar && (
            <AnexosUploadDireto pacienteId={pacienteId} />
          )}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFiltroTipo(null)}
              className={`rounded px-3 py-1.5 text-xs transition-colors ${!filtroTipo ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600 hover:border-slate-300'}`}
            >
              Todos ({anexosQuery.data?.length ?? 0})
            </button>
            {tipos.map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => setFiltroTipo(filtroTipo === tipo ? null : tipo)}
                className={`rounded px-3 py-1.5 text-xs transition-colors ${filtroTipo === tipo ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600 hover:border-slate-300'}`}
              >
                {tipo}
              </button>
            ))}
          </div>
        </div>
      </div>

      {anexosQuery.isPending && (
        <p className="py-12 text-center text-sm text-slate-400">Carregando documentos...</p>
      )}

      {anexosQuery.data && filtrados.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-400">Nenhum documento anexado.</p>
      )}

      <ul className="space-y-2">
        {filtrados.map((anexo) => (
          <li
            key={anexo.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex min-w-0 items-center gap-3">
              {anexo.tipo.startsWith('image/') ? (
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
              ) : (
                <Paperclip className="h-4 w-4 shrink-0 text-slate-400" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{anexo.nome}</p>
                <p className="text-xs text-slate-400">
                  {formatarData(anexo.createdAt)} · {formatarBytes(anexo.tamanhoBytes)}
                  {anexo.criadoPorNome ? ` · ${anexo.criadoPorNome}` : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void baixar(anexo.chave)}
              disabled={baixando === anexo.chave}
              className="inline-flex shrink-0 items-center gap-1.5 rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {baixando === anexo.chave ? 'Baixando...' : 'Baixar'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

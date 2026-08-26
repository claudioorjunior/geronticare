'use client';

import { useRef, useState } from 'react';
import { UploadCloud, Loader2, FileText, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';

const TAMANHO_MAXIMO = 50 * 1024 * 1024; // 50 MB

const MIME_PERMITIDOS = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]);

type Item = {
  id: string;
  nome: string;
  status: 'enviando' | 'erro';
  erro?: string;
};

/**
 * Upload direto de documento avulso na aba Documentos: envia o arquivo ao
 * storage (upload-url + upload-local/S3) e persiste os metadados via
 * `anexos.criar` — sem vínculo com registro.
 */
export function AnexosUploadDireto({
  pacienteId,
  onConcluido,
}: {
  pacienteId: string;
  onConcluido?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const utils = trpc.useUtils();
  const criarAnexo = trpc.anexos.criar.useMutation({
    onSuccess: () => {
      utils.anexos.listarPorPaciente.invalidate({ pacienteId });
      onConcluido?.();
    },
  });

  async function enviar(arquivo: File) {
    const id = crypto.randomUUID();
    if (!MIME_PERMITIDOS.has(arquivo.type)) {
      setItens((prev) => [...prev, { id, nome: arquivo.name, status: 'erro', erro: 'Tipo não permitido' }]);
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      setItens((prev) => [...prev, { id, nome: arquivo.name, status: 'erro', erro: 'Arquivo excede 50 MB' }]);
      return;
    }

    setItens((prev) => [...prev, { id, nome: arquivo.name, status: 'enviando' }]);

    try {
      // 1. URL de upload (valida tenant/paciente e devolve a chave)
      const resp = await fetch('/api/anexos/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pacienteId,
          nomeArquivo: arquivo.name,
          tipoMime: arquivo.type,
          tamanhoBytes: arquivo.size,
        }),
      });
      if (!resp.ok) {
        const corpo = await resp.json().catch(() => null);
        throw new Error(corpo?.error ?? 'Falha ao preparar upload');
      }
      const dados = (await resp.json()) as
        | { chave: string; driver: 'local' }
        | { chave: string; driver: 's3'; uploadUrl: string };

      // 2. Envia o conteúdo ao storage
      if (dados.driver === 'local') {
        const form = new FormData();
        form.append('chave', dados.chave);
        form.append('tipoMime', arquivo.type);
        form.append('tamanhoBytes', String(arquivo.size));
        form.append('file', arquivo);
        const localRes = await fetch('/api/anexos/upload-local', { method: 'POST', body: form });
        if (!localRes.ok) {
          const corpo = await localRes.json().catch(() => null);
          throw new Error(corpo?.error ?? 'Falha no upload local');
        }
      } else {
        const putRes = await fetch(dados.uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': arquivo.type },
          body: arquivo,
        });
        if (!putRes.ok) throw new Error('Falha no upload direto ao storage');
      }

      // 3. Persiste os metadados (avulso, sem registro)
      await criarAnexo.mutateAsync({
        pacienteId,
        chave: dados.chave,
        nome: arquivo.name,
        tipo: arquivo.type,
        tamanhoBytes: arquivo.size,
      });

      setItens((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      setItens((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: 'erro', erro: error instanceof Error ? error.message : 'Erro no upload' } : item,
        ),
      );
    }
  }

  function onFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) void enviar(file);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={Array.from(MIME_PERMITIDOS).join(',')}
        className="hidden"
        onChange={(event) => onFiles(event.target.files)}
      />
      <Button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={criarAnexo.isPending}
        className="gap-2"
      >
        <UploadCloud className="h-4 w-4" />
        Novo documento
      </Button>

      {itens.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {itens.map((item, i) => (
            <li
              key={item.id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                item.status === 'erro'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              {item.status === 'enviando' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
              )}
              <FileText className="h-3.5 w-3.5 opacity-60" />
              <span className="truncate">{item.nome}</span>
              {item.status === 'enviando' ? (
                <span className="ml-auto shrink-0 text-slate-400">Enviando...</span>
              ) : (
                <span className="ml-auto shrink-0 text-red-600">{item.erro}</span>
              )}
              <button
                type="button"
                aria-label={`Remover ${item.nome}`}
                onClick={() => setItens((prev) => prev.filter((_, j) => j !== i))}
                className="shrink-0 text-slate-400 hover:text-slate-700"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

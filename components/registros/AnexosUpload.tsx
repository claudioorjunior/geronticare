'use client';

import { useEffect, useRef, useState } from 'react';
import { Paperclip, Loader2, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type AnexoSelecionado = {
  id: string;
  chave: string;
  nome: string;
  tipo: string;
  tamanhoBytes: number;
  status: 'enviando' | 'pronto' | 'erro';
  erro?: string;
};

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

type Props = {
  pacienteId: string;
  onAnexosChange: (anexos: AnexoSelecionado[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
  disabled?: boolean;
};

/**
 * Uploader de anexos clínicos (opcional no lançamento de evolução).
 * Cada arquivo: POST /api/anexos/upload-url → chave; S3 faz PUT direto na
 * presigned URL; local faz POST /api/anexos/upload-local com o conteúdo.
 * Os metadados só são persistidos no submit do registro (mesma transação).
 */
export function AnexosUpload({ pacienteId, onAnexosChange, onUploadingChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [anexos, setAnexos] = useState<AnexoSelecionado[]>([]);

  useEffect(() => {
    onAnexosChange(anexos.filter((a) => a.status === 'pronto'));
    onUploadingChange?.(anexos.some((a) => a.status === 'enviando'));
  }, [anexos, onAnexosChange, onUploadingChange]);

  const atualizar = (proximo: AnexoSelecionado[]) => {
    setAnexos(proximo);
  };

  async function enviarArquivo(arquivo: File) {
    // validação cliente (mesma allowlist do servidor)
    if (!MIME_PERMITIDOS.has(arquivo.type)) {
      setAnexos((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          chave: '',
          nome: arquivo.name,
          tipo: arquivo.type,
          tamanhoBytes: arquivo.size,
          status: 'erro',
          erro: 'Tipo de arquivo não permitido',
        },
      ]);
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      setAnexos((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          chave: '',
          nome: arquivo.name,
          tipo: arquivo.type,
          tamanhoBytes: arquivo.size,
          status: 'erro',
          erro: 'Arquivo excede 50 MB',
        },
      ]);
      return;
    }

    const entrada: AnexoSelecionado = {
      id: crypto.randomUUID(),
      chave: '',
      nome: arquivo.name,
      tipo: arquivo.type,
      tamanhoBytes: arquivo.size,
      status: 'enviando',
    };
    setAnexos((prev) => [...prev, entrada]);

    try {
      const resposta = await fetch('/api/anexos/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pacienteId,
          nomeArquivo: arquivo.name,
          tipoMime: arquivo.type,
          tamanhoBytes: arquivo.size,
        }),
      });
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        throw new Error(corpo?.error ?? 'Falha ao preparar upload');
      }
      const dados = (await resposta.json()) as
        | { chave: string; driver: 'local' }
        | { chave: string; driver: 's3'; uploadUrl: string };

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
        // S3: PUT direto com a presigned URL
        const putRes = await fetch(dados.uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': arquivo.type },
          body: arquivo,
        });
        if (!putRes.ok) throw new Error('Falha no upload direto ao storage');
      }

      setAnexos((prev) =>
        prev.map((a) =>
          a.id === entrada.id && a.status === 'enviando'
            ? { ...a, chave: dados.chave, status: 'pronto' as const }
            : a,
        ),
      );
    } catch (error) {
      setAnexos((prev) =>
        prev.map((a) =>
          a.id === entrada.id && a.status === 'enviando'
            ? { ...a, status: 'erro', erro: error instanceof Error ? error.message : 'Erro no upload' }
            : a,
        ),
      );
    }
  }

  function onFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      void enviarArquivo(file);
    }
  }

  function remover(index: number) {
    const proximo = anexos.filter((_, i) => i !== index);
    atualizar(proximo);
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
      <div className="flex flex-wrap gap-2">
        {anexos.map((anexo, index) => (
          <div
            key={anexo.id}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
              anexo.status === 'erro'
                ? 'border-red-200 bg-red-50 text-red-700'
                : anexo.status === 'enviando'
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            {anexo.status === 'enviando' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FileText className="h-3 w-3" />
            )}
            <span className="max-w-[200px] truncate">{anexo.nome}</span>
            {anexo.status === 'erro' && anexo.erro ? (
              <span className="text-red-600">({anexo.erro})</span>
            ) : (
              <span className="opacity-60">{Math.round(anexo.tamanhoBytes / 1024)} KB</span>
            )}
            <button
              type="button"
              aria-label={`Remover ${anexo.nome}`}
              onClick={() => remover(index)}
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {anexos.length < 50 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <Paperclip className="h-3.5 w-3.5" />
            Anexar arquivo
          </Button>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { User, Camera, Save, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { authClient } from '@/lib/auth/client';
import { trpc } from '@/lib/trpc/client';

const TIPOS_MIME_IMAGEM = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024;

export default function PerfilPage() {
  const utils = trpc.useUtils();
  const { data: perfil, isLoading } = trpc.usuarios.meuPerfil.useQuery();

  const [nome, setNome] = useState<string>();
  const [image, setImage] = useState<string>();
  const [imagePreview, setImagePreview] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [trocandoSenha, setTrocandoSenha] = useState(false);

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const selecionarFoto = (file: File | undefined) => {
    if (!file) return;
    if (!TIPOS_MIME_IMAGEM.includes(file.type)) {
      setMsg({ tipo: 'erro', texto: 'Use uma imagem JPEG, PNG ou WebP.' });
      return;
    }
    if (file.size > TAMANHO_MAXIMO_BYTES) {
      setMsg({ tipo: 'erro', texto: 'A imagem deve ter no máximo 10 MB.' });
      return;
    }

    setAvatarFile(file);
    setImagePreview(URL.createObjectURL(file));
    setMsg(null);
  };

  const enviarFoto = async (file: File) => {
    const response = await fetch('/api/usuarios/avatar-upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nomeArquivo: file.name,
        tipoMime: file.type,
        tamanhoBytes: file.size,
      }),
    });
    const data = (await response.json()) as {
      uploadUrl?: string;
      urlPublica?: string;
      error?: string;
    };

    if (!response.ok || !data.uploadUrl || !data.urlPublica) {
      throw new Error(data.error ?? 'Falha ao preparar o upload da foto');
    }

    const uploadResponse = await fetch(data.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error('Falha ao enviar a foto');
    }

    return data.urlPublica;
  };

  const salvarPerfil = async () => {
    const nomeAtual = nome ?? perfil?.nome ?? '';
    const imageAtual = image ?? perfil?.image ?? '';

    if (!nomeAtual.trim()) {
      setMsg({ tipo: 'erro', texto: 'Nome é obrigatório' });
      return;
    }
    setSalvando(true);
    setMsg(null);

    try {
      let imageUrl = imageAtual.trim() || undefined;
      if (avatarFile) {
        imageUrl = await enviarFoto(avatarFile);
      }

      const { error: updateError } = await authClient.updateUser({
        name: nomeAtual.trim(),
        image: imageUrl,
      });

      if (updateError) {
        setMsg({ tipo: 'erro', texto: updateError.message ?? 'Falha ao atualizar perfil' });
        return;
      }

      setNome(nomeAtual);
      setImage(imageUrl ?? '');
      setImagePreview(imageUrl ?? '');
      setAvatarFile(null);
      utils.usuarios.meuPerfil.invalidate();
      setMsg({ tipo: 'ok', texto: 'Perfil atualizado com sucesso.' });
    } catch (error) {
      setMsg({
        tipo: 'erro',
        texto: error instanceof Error ? error.message : 'Erro inesperado ao salvar perfil',
      });
    } finally {
      setSalvando(false);
    }
  };

  const trocarSenha = async () => {
    if (!senhaAtual || !novaSenha) {
      setMsg({ tipo: 'erro', texto: 'Senha atual e nova senha são obrigatórias' });
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setMsg({ tipo: 'erro', texto: 'Nova senha e confirmação não coincidem' });
      return;
    }
    if (novaSenha.length < 8) {
      setMsg({ tipo: 'erro', texto: 'Nova senha precisa ter pelo menos 8 caracteres' });
      return;
    }

    setTrocandoSenha(true);
    setMsg(null);

    try {
      const { error } = await authClient.changePassword({
        currentPassword: senhaAtual,
        newPassword: novaSenha,
        revokeOtherSessions: false,
      });

      if (error) {
        setMsg({ tipo: 'erro', texto: error.message ?? 'Falha ao trocar senha' });
        return;
      }

      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
      setMsg({ tipo: 'ok', texto: 'Senha atualizada com sucesso.' });
    } catch (error) {
      setMsg({
        tipo: 'erro',
        texto: error instanceof Error ? error.message : 'Erro inesperado ao trocar senha',
      });
    } finally {
      setTrocandoSenha(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
      </div>
    );
  }

  const nomeAtual = nome ?? perfil?.nome ?? '';
  const imageAtual = image ?? perfil?.image ?? '';
  const avatarSrc = imagePreview || imageAtual;

  return (
    <div className="max-w-container-max mx-auto w-full px-margin-mobile md:px-margin-desktop py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50">
          <User className="h-5 w-5 text-teal-600" />
        </div>
        <div>
          <h1 className="page-title">Meu Perfil</h1>
          <p className="page-lede">
            Configure suas informações e credenciais
          </p>
        </div>
      </div>

      {msg && (
        <div
          role={msg.tipo === 'ok' ? 'status' : 'alert'}
          aria-live={msg.tipo === 'ok' ? 'polite' : 'assertive'}
          className={`mb-5 flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${
            msg.tipo === 'ok'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {msg.tipo === 'ok' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{msg.texto}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Identidade</h2>
            <div className="mb-5 flex items-center gap-5">
              <div className="relative">
                {avatarSrc ? (
                  // O avatar pode vir de storages configuráveis em instalações self-hosted.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarSrc}
                    alt="Avatar"
                    className="h-16 w-16 rounded-full object-cover ring-2 ring-slate-200"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-white text-xl font-bold">
                    {perfil?.nome
                      ? perfil.nome
                          .split(' ')
                          .map((n: string) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()
                      : '—'}
                  </div>
                )}
                <label className="absolute bottom-0 right-0 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-2 ring-white hover:bg-slate-200">
                  <Camera className="h-3 w-3" />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      selecionarFoto(e.currentTarget.files?.[0]);
                      e.currentTarget.value = '';
                    }}
                    className="sr-only"
                    aria-label="Trocar foto do perfil"
                  />
                </label>
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-500">
                  Clique no ícone da câmera para escolher uma imagem. Máximo: 10 MB.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
              <Field
                id="perfil-nome"
                htmlFor="perfil-nome"
                label="Nome completo"
                value={nomeAtual}
                onChange={(e) => setNome(e.target.value)}
              />
              <Field
                id="perfil-email"
                htmlFor="perfil-email"
                label="E-mail"
                type="email"
                value={perfil?.email ?? ''}
                disabled
                hint="E-mail não pode ser alterado aqui"
              />
            </div>

            <div className="mt-6 flex items-center gap-3">
              <Button
                onClick={salvarPerfil}
                disabled={salvando || !nomeAtual.trim()}
                className="gap-2 bg-teal-600 text-white hover:bg-teal-700"
              >
                {salvando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Salvar perfil
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Trocar senha</h2>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
              <Field
                id="senha-atual"
                htmlFor="senha-atual"
                label="Senha atual"
                type="password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
              />
              <div />
              <Field
                id="nova-senha"
                htmlFor="nova-senha"
                label="Nova senha"
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                hint="Mínimo 8 caracteres"
              />
              <Field
                id="confirmar-senha"
                htmlFor="confirmar-senha"
                label="Confirmar nova senha"
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
              />
            </div>
            <div className="mt-6">
              <Button
                onClick={trocarSenha}
                disabled={trocandoSenha || !senhaAtual || !novaSenha}
                variant="outline"
              >
                {trocandoSenha ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Alterando...
                  </>
                ) : (
                  'Alterar senha'
                )}
              </Button>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Informações da conta</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs font-medium text-slate-500">Papel</span>
                <p className="mt-0.5 text-slate-700 capitalize">{perfil?.role ?? '—'}</p>
              </div>
              {perfil?.especialidade && (
                <div>
                  <span className="text-xs font-medium text-slate-500">Especialidade</span>
                  <p className="mt-0.5 text-slate-700">
                    {perfil.especialidade.replace(/_/g, ' ')}
                  </p>
                </div>
              )}
              {perfil?.registroProfissional && (
                <div>
                  <span className="text-xs font-medium text-slate-500">Registro</span>
                  <p className="mt-0.5 text-slate-700">{perfil.registroProfissional}</p>
                </div>
              )}
              <div>
                <span className="text-xs font-medium text-slate-500">ID do usuário</span>
                <p className="mt-0.5 font-mono text-xs text-slate-400 break-all">
                  {perfil?.id ?? '—'}
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

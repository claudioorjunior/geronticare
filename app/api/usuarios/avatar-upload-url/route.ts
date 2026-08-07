import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { resolverUsuarioAutorizacao } from '@/lib/auth/resolver-usuario';
import { getDb } from '@/lib/db';
import {
  gerarChaveAvatar,
  gerarUrlPublica,
  gerarUrlUpload,
} from '@/lib/storage/s3';
import { lerJsonBodyLimitado, RequestBodyTooLargeError } from '@/lib/http/body';
import { z } from 'zod';

const TIPOS_MIME_IMAGEM = ['image/jpeg', 'image/png', 'image/webp'] as const;
const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024;

const bodySchema = z.object({
  nomeArquivo: z.string().min(1).max(255),
  tipoMime: z.enum(TIPOS_MIME_IMAGEM),
  tamanhoBytes: z.number().int().positive().max(TAMANHO_MAXIMO_BYTES),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth();
    const db = await getDb();
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await lerJsonBodyLimitado(request));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Imagem inválida' }, { status: 400 });
    }

    const usuario = await resolverUsuarioAutorizacao(db, session.user.id);

    if (!usuario?.instituicaoId) {
      return NextResponse.json({ error: 'Usuário sem instituição' }, { status: 403 });
    }

    // SEGURANÇA: usuário desativado não gera URL de upload (revogação imediata).
    if (!usuario.ativo) {
      return NextResponse.json({ error: 'Usuário inativo' }, { status: 403 });
    }

    const { nomeArquivo, tipoMime, tamanhoBytes } = parsed.data;
    const chave = gerarChaveAvatar(usuario.instituicaoId, session.user.id, nomeArquivo);
    const { url: uploadUrl } = await gerarUrlUpload(chave, tipoMime, tamanhoBytes);

    return NextResponse.json({
      uploadUrl,
      urlPublica: gerarUrlPublica(chave),
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        { error: 'Corpo da requisição excede o limite permitido' },
        { status: 413 },
      );
    }
    console.error('Erro ao gerar URL do avatar:', error);
    return NextResponse.json({ error: 'Erro interno ao preparar o upload' }, { status: 500 });
  }
}

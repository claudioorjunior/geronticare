import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { gerarChaveAvatar, gerarUrlPublica, gerarUrlUpload } from '@/lib/storage/s3';
import { z } from 'zod';

const TIPOS_MIME_IMAGEM = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
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

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Imagem inválida' }, { status: 400 });
    }

    const usuario = await db.query.usuarios.findFirst({
      where: eq(usuarios.id, session.user.id),
      columns: { instituicaoId: true },
    });

    if (!usuario?.instituicaoId) {
      return NextResponse.json({ error: 'Usuário sem instituição' }, { status: 403 });
    }

    const { nomeArquivo, tipoMime } = parsed.data;
    const chave = gerarChaveAvatar(usuario.instituicaoId, session.user.id, nomeArquivo);
    const { url: uploadUrl } = await gerarUrlUpload(chave, tipoMime);

    return NextResponse.json({
      uploadUrl,
      urlPublica: gerarUrlPublica(chave),
    });
  } catch (error) {
    console.error('Erro ao gerar URL do avatar:', error);
    return NextResponse.json({ error: 'Erro interno ao preparar o upload' }, { status: 500 });
  }
}
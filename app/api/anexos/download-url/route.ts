import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { getAuth } from '@/lib/auth';
import { resolverUsuarioAutorizacao } from '@/lib/auth/resolver-usuario';
import { getDb } from '@/lib/db';
import { pacientes } from '@/lib/db/schema';
import {
  extrairContextoChaveAnexo,
  gerarUrlDownload,
} from '@/lib/storage/s3';
import { lerJsonBodyLimitado, RequestBodyTooLargeError } from '@/lib/http/body';

const MAX_BODY_BYTES = 8 * 1024;

const bodySchema = z.object({
  chave: z.string().min(1).max(1024),
});

/**
 * Emite uma URL curta para leitura de um anexo clínico privado.
 * A chave nunca é convertida em URL pública: o acesso passa por sessão,
 * tenant, paciente e permissão clínica antes de assinar o GetObject.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth();
    const db = await getDb();
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await lerJsonBodyLimitado(request, MAX_BODY_BYTES));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Chave de anexo inválida' }, { status: 400 });
    }

    const contexto = extrairContextoChaveAnexo(parsed.data.chave);
    if (!contexto) {
      return NextResponse.json({ error: 'Chave de anexo inválida' }, { status: 400 });
    }

    const usuario = await resolverUsuarioAutorizacao(db, session.user.id);
    if (!usuario?.instituicaoId || !usuario.ativo) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // A instituição e a permissão são verificadas antes de consultar o paciente.
    if (
      usuario.instituicaoId !== contexto.instituicaoId ||
      !usuario.permissoes.includes('clinico:ler')
    ) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const paciente = await db.query.pacientes.findFirst({
      where: and(
        eq(pacientes.id, contexto.pacienteId),
        eq(pacientes.instituicaoId, usuario.instituicaoId),
      ),
      columns: { id: true },
    });

    if (!paciente) {
      return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 });
    }

    const downloadUrl = await gerarUrlDownload(parsed.data.chave);
    return NextResponse.json({ downloadUrl, expiresIn: 300 });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        { error: 'Corpo da requisição excede o limite permitido' },
        { status: 413 },
      );
    }
    console.error('Erro ao gerar URL de download do anexo:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

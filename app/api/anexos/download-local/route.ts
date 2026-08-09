import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { getAuth } from '@/lib/auth';
import { resolverUsuarioAutorizacao } from '@/lib/auth/resolver-usuario';
import { getDb } from '@/lib/db';
import { pacientes, anexos } from '@/lib/db/schema';
import { extrairContextoChaveAnexo } from '@/lib/storage/s3';
import { storageConfigurado, driverAtivo } from '@/lib/storage';
import { lerAnexoLocal } from '@/lib/storage/local';

/**
 * Download do arquivo para o driver local (filesystem).
 * Mesma autorização do download-url (sessão + tenant + paciente + clinico:ler).
 */
export async function GET(request: NextRequest) {
  try {
    if (!storageConfigurado() || driverAtivo() !== 'local') {
      return NextResponse.json(
        { error: 'Storage de anexos não configurado' },
        { status: 503 },
      );
    }

    const chave = new URL(request.url).searchParams.get('chave');
    const parsed = z.object({ chave: z.string().min(1).max(1024) }).safeParse({ chave });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Chave de anexo inválida' }, { status: 400 });
    }

    const contexto = extrairContextoChaveAnexo(parsed.data.chave);
    if (!contexto) {
      return NextResponse.json({ error: 'Chave de anexo inválida' }, { status: 400 });
    }

    const auth = await getAuth();
    const db = await getDb();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const usuario = await resolverUsuarioAutorizacao(db, session.user.id);
    if (!usuario?.instituicaoId || !usuario.ativo) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }
    if (
      usuario.instituicaoId !== contexto.instituicaoId ||
      !usuario.permissoes.includes('anexo:ver')
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

    // SEGURANÇA: o metadado precisa existir — um anexo "deletado" (objeto ainda
    // no storage) não pode mais ser baixado por quem conhece a chave.
    const metadado = await db.query.anexos.findFirst({
      where: and(
        eq(anexos.chave, parsed.data.chave),
        eq(anexos.instituicaoId, usuario.instituicaoId),
      ),
      columns: { id: true },
    });
    if (!metadado) {
      return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 });
    }

    const conteudo = await lerAnexoLocal(parsed.data.chave).catch(() => null);
    if (!conteudo) {
      return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 });
    }

    const nome = parsed.data.chave.split('/').pop() ?? 'anexo';
    return new NextResponse(new Uint8Array(conteudo), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nome)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Erro ao ler anexo local:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

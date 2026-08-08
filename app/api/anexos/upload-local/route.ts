import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { getAuth } from '@/lib/auth';
import { resolverUsuarioAutorizacao } from '@/lib/auth/resolver-usuario';
import { getDb } from '@/lib/db';
import { pacientes } from '@/lib/db/schema';
import { extrairContextoChaveAnexo } from '@/lib/storage/s3';
import { storageConfigurado, driverAtivo } from '@/lib/storage';
import { gravarAnexoLocal, TAMANHO_MAXIMO_UPLOAD_BYTES } from '@/lib/storage/local';

/**
 * Upload do arquivo para o driver local (filesystem).
 * O fluxo: POST /api/anexos/upload-url (gera chave + valida) → upload do
 * conteúdo aqui com a MESMA chave → submit do registro com a chave.
 *
 * A chave vem do corpo (JSON) e o arquivo como multipart `file`.
 */
export async function POST(request: NextRequest) {
  try {
    if (!storageConfigurado() || driverAtivo() !== 'local') {
      return NextResponse.json(
        { error: 'Storage de anexos não configurado' },
        { status: 503 },
      );
    }

    const auth = await getAuth();
    const db = await getDb();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const formData = await request.formData();
    const chave = formData.get('chave');
    const tipoMime = formData.get('tipoMime');
    const tamanhoBytes = formData.get('tamanhoBytes');
    const arquivo = formData.get('file');

    const parsed = z
      .object({
        chave: z.string().min(1).max(1024),
        tipoMime: z.string().min(1),
        tamanhoBytes: z.coerce.number().int().positive().max(TAMANHO_MAXIMO_UPLOAD_BYTES),
      })
      .safeParse({ chave, tipoMime, tamanhoBytes });

    if (!parsed.success || !(arquivo instanceof File)) {
      return NextResponse.json({ error: 'Dados de upload inválidos' }, { status: 400 });
    }

    if (arquivo.size !== parsed.data.tamanhoBytes) {
      return NextResponse.json(
        { error: 'Tamanho do arquivo não confere com o informado' },
        { status: 400 },
      );
    }

    const contexto = extrairContextoChaveAnexo(parsed.data.chave);
    if (!contexto) {
      return NextResponse.json({ error: 'Chave de anexo inválida' }, { status: 400 });
    }

    const usuario = await resolverUsuarioAutorizacao(db, session.user.id);
    if (!usuario?.instituicaoId || !usuario.ativo) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }
    // SEGURANÇA: anexar exige `anexo:criar`; tenant garantido pelo contexto da chave.
    if (
      usuario.instituicaoId !== contexto.instituicaoId ||
      !usuario.permissoes.includes('anexo:criar')
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
      return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 });
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    await gravarAnexoLocal(parsed.data.chave, buffer, parsed.data.tipoMime, arquivo.size);

    return NextResponse.json({ chave: parsed.data.chave, ok: true });
  } catch (error) {
    console.error('Erro ao gravar anexo local:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

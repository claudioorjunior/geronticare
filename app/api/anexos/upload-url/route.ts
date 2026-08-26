import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { resolverUsuarioAutorizacao } from '@/lib/auth/resolver-usuario';
import { getDb } from '@/lib/db';
import { pacientes } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  gerarUrlUpload,
  gerarChaveAnexo,
  TAMANHO_MAXIMO_UPLOAD_BYTES,
} from '@/lib/storage/s3';
import { storageConfigurado, driverAtivo } from '@/lib/storage';
import { lerJsonBodyLimitado, RequestBodyTooLargeError } from '@/lib/http/body';
import { z } from 'zod';

const MAX_BODY_BYTES = 16 * 1024;

const bodySchema = z.object({
  pacienteId: z.string().uuid(),
  nomeArquivo: z.string().min(1).max(255),
  tipoMime: z.string().min(1),
  tamanhoBytes: z.number().int().positive().max(TAMANHO_MAXIMO_UPLOAD_BYTES),
});

export async function POST(request: NextRequest) {
  try {
    if (!storageConfigurado()) {
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

    const body = await lerJsonBodyLimitado(request, MAX_BODY_BYTES);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { pacienteId, nomeArquivo, tipoMime, tamanhoBytes } = parsed.data;

    const usuario = await resolverUsuarioAutorizacao(db, session.user.id);

    if (!usuario?.instituicaoId) {
      return NextResponse.json({ error: 'Usuário sem instituição' }, { status: 403 });
    }

    // SEGURANÇA: anexar exige a permissão `anexo:criar` (base do papel
    // usuario/profissional/admin, ou cargo que conceda). O tenant é garantido
    // pelo check do paciente abaixo.
    if (!usuario.ativo) {
      return NextResponse.json({ error: 'Usuário inativo' }, { status: 403 });
    }
    if (!usuario.permissoes.includes('anexo:criar')) {
      return NextResponse.json(
        { error: 'Permissão para anexar documentos necessária' },
        { status: 403 },
      );
    }

    const paciente = await db.query.pacientes.findFirst({
      where: and(
        eq(pacientes.id, pacienteId),
        eq(pacientes.instituicaoId, usuario.instituicaoId),
      ),
    });

    if (!paciente) {
      return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 });
    }

    const chave = gerarChaveAnexo(usuario.instituicaoId, pacienteId, nomeArquivo);

    // Driver local: o cliente envia o arquivo depois para /api/anexos/upload-local
    // (mesma chave). Driver S3: presigned URL para PUT direto.
    if (driverAtivo() === 'local') {
      return NextResponse.json({
        chave,
        driver: 'local',
      });
    }

    const { url } = await gerarUrlUpload(chave, tipoMime, tamanhoBytes);

    return NextResponse.json({
      uploadUrl: url,
      chave,
      driver: 's3',
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        { error: 'Corpo da requisição excede o limite permitido' },
        { status: 413 },
      );
    }
    console.error('Erro ao gerar URL de upload:', error);
    // SEGURANÇA: nunca devolver a mensagem interna do driver (pode conter
    // bucket, região, endpoint ou chave parcial) — resposta genérica.
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

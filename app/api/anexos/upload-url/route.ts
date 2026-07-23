import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { gerarUrlUpload, gerarUrlPublica, gerarChaveAnexo } from '@/lib/storage/s3';
import { db } from '@/lib/db';
import { pacientes, usuarios } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const bodySchema = z.object({
  pacienteId: z.string().uuid(),
  nomeArquivo: z.string().min(1).max(255),
  tipoMime: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { pacienteId, nomeArquivo, tipoMime } = parsed.data;

    const usuario = await db.query.usuarios.findFirst({
      where: eq(usuarios.id, session.user.id),
      columns: { instituicaoId: true },
    });

    if (!usuario?.instituicaoId) {
      return NextResponse.json({ error: 'Usuário sem instituição' }, { status: 403 });
    }

    const paciente = await db.query.pacientes.findFirst({
      where: and(
        eq(pacientes.id, pacienteId),
        eq(pacientes.instituicaoId, usuario.instituicaoId)
      ),
    });

    if (!paciente) {
      return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 });
    }

    const chave = gerarChaveAnexo(usuario.instituicaoId, pacienteId, nomeArquivo);
    const { url } = await gerarUrlUpload(chave, tipoMime);

    return NextResponse.json({
      uploadUrl: url,
      chave,
      urlPublica: gerarUrlPublica(chave),
    });
  } catch (error) {
    console.error('Erro ao gerar URL de upload:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

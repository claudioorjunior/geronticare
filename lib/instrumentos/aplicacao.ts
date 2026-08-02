import { z } from 'zod';
import {
  INSTRUMENTO_SLUGS,
  evaluateInstrument,
  getInstrumentDefinition,
} from './instrumentos';

export const aplicacaoInstrumentoInputSchema = z.strictObject({
  pacienteId: z.string().uuid(),
  instrumento: z.enum(INSTRUMENTO_SLUGS),
  profissionalId: z.string().uuid(),
  dataAplicacao: z.coerce.date(),
  respostas: z.unknown(),
});

export function parseAplicacaoInstrumentoInput(
  input: unknown,
  agora = new Date(),
) {
  const parsed = aplicacaoInstrumentoInputSchema.parse(input);

  if (parsed.dataAplicacao.getTime() > agora.getTime()) {
    throw new Error('A data da aplicação não pode estar no futuro.');
  }

  const definition = getInstrumentDefinition(parsed.instrumento);
  const respostasValidadas = definition.schema.parse(parsed.respostas);
  const resultado = evaluateInstrument(
    parsed.instrumento,
    respostasValidadas,
  );

  return {
    ...parsed,
    respostas: respostasValidadas,
    resultado,
    versaoInstrumento: definition.versao,
  };
}

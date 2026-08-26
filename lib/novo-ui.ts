/**
 * O novo shell é o padrão. Defina `NEXT_PUBLIC_NOVO_UI=false` apenas para
 * restaurar temporariamente a navegação legada durante um rollback.
 */
export function novoUiAtivo(value: string | undefined): boolean {
  return value !== 'false';
}

export const NOVO_UI_ATIVO = novoUiAtivo(process.env.NEXT_PUBLIC_NOVO_UI);

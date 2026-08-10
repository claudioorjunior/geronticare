/**
 * Flag local de ativação do novo shell (vertical slice).
 * `NEXT_PUBLIC_NOVO_UI=true` renderiza o AppShell no lugar do TopNav.
 * O TopNav permanece como fallback — a migração global só ocorre após
 * aprovação visual (handoff §8-E, §14).
 */
export const NOVO_UI_ATIVO = process.env.NEXT_PUBLIC_NOVO_UI === 'true';

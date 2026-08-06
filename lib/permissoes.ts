/**
 * Catálogo de permissões (fonte canônica) — formato `modulo:acao`.
 *
 * Escalável para ERP multi-módulo: cada módulo futuro (financeiro, juridico,
 * logistica) adiciona um bloco em `MODULOS` com suas ações e o catálogo
 * `PERMISSOES` acompanha. As gates das procedures usam
 * `exigirPermissao('modulo:acao')` (ver `lib/trpc/server.ts`).
 *
 * Regras:
 * - O gestor cria CARGOS, nunca permissões (catálogo fechado no código;
 *   permissão nova = release, nunca string solta no banco).
 * - Permissão efetiva = base do papel ∪ permissões do cargo (cargo nunca remove).
 * - Validação em criar/atualizar cargo rejeita strings fora do catálogo (z.enum).
 */
export const MODULOS = [
  {
    id: 'clinico',
    label: 'Clínico',
    descricao: 'Dados clínicos do residente (AGA, escalas, sinais vitais, registros).',
    acoes: [
      {
        id: 'ler',
        label: 'Ler dados clínicos',
        descricao: 'Visualizar pacientes, AGA, registros e sinais vitais.',
      },
      {
        id: 'editar',
        label: 'Editar dados clínicos',
        descricao: 'Criar e editar registros clínicos (AGA, escalas, sinais vitais).',
      },
    ],
  },
  {
    id: 'admin',
    label: 'Administrativo',
    descricao: 'Gestão da instituição (usuários, cargos, configurações).',
    acoes: [
      {
        id: 'administrar',
        label: 'Administrar',
        descricao: 'Gerir usuários, cargos e configurações da instituição.',
      },
    ],
  },
] as const;

/** Flat list de permissões `modulo:acao` — fonte da validação `z.enum`. */
export const PERMISSOES = [
  'clinico:ler',
  'clinico:editar',
  'admin:administrar',
] as const;

export type Permissao = (typeof PERMISSOES)[number];

export type Modulo = (typeof MODULOS)[number]['id'];

/** Lookup de label/descrição por permissão (badges + checkboxes da UI). */
export const PERMISSAO_INFO: Record<Permissao, { label: string; descricao: string }> = {
  'clinico:ler': {
    label: 'Ler dados clínicos',
    descricao: 'Visualizar pacientes, AGA, registros e sinais vitais.',
  },
  'clinico:editar': {
    label: 'Editar dados clínicos',
    descricao: 'Criar e editar registros clínicos (AGA, escalas, sinais vitais).',
  },
  'admin:administrar': {
    label: 'Administrar',
    descricao: 'Gerir usuários, cargos e configurações da instituição.',
  },
};

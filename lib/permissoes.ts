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
const MODULO_INFO = {
  clinico: {
    label: 'Clínico',
    descricao: 'Dados clínicos do residente (AGA, escalas, sinais vitais, registros).',
  },
  anexo: {
    label: 'Documentos',
    descricao: 'Anexos de arquivos do residente (exames, fotos, documentos administrativos).',
  },
  admin: {
    label: 'Administrativo',
    descricao: 'Gestão da instituição (usuários, cargos, configurações).',
  },
} as const;

/** Fonte única das permissões disponíveis hoje; novos módulos entram aqui. */
const CATALOGO_PERMISSOES = [
  {
    id: 'clinico:ler',
    modulo: 'clinico',
    acao: 'ler',
    atribuivel: true,
    label: 'Ler dados clínicos',
    descricao: 'Visualizar pacientes, AGA, registros e sinais vitais.',
  },
  {
    id: 'clinico:editar',
    modulo: 'clinico',
    acao: 'editar',
    atribuivel: true,
    label: 'Editar dados clínicos',
    descricao: 'Criar e editar registros clínicos (AGA, escalas, sinais vitais).',
  },
  {
    id: 'anexo:ver',
    modulo: 'anexo',
    acao: 'ver',
    atribuivel: true,
    label: 'Ver documentos',
    descricao: 'Listar e baixar anexos do residente.',
  },
  {
    id: 'anexo:criar',
    modulo: 'anexo',
    acao: 'criar',
    atribuivel: true,
    label: 'Anexar documentos',
    descricao: 'Enviar novos anexos (exames, fotos, documentos administrativos).',
  },
  {
    id: 'anexo:deletar',
    modulo: 'anexo',
    acao: 'deletar',
    atribuivel: true,
    label: 'Remover documentos',
    descricao: 'Remover anexos do residente.',
  },
  {
    id: 'admin:administrar',
    modulo: 'admin',
    acao: 'administrar',
    atribuivel: false,
    label: 'Administrar',
    descricao: 'Gerir usuários, cargos e configurações da instituição.',
  },
] as const;

export type Permissao = (typeof CATALOGO_PERMISSOES)[number]['id'];
export type PermissaoAtribuivel = Extract<
  (typeof CATALOGO_PERMISSOES)[number],
  { atribuivel: true }
>['id'];
export type Modulo = keyof typeof MODULO_INFO;

/** Flat list `modulo:acao` usada pela validação `z.enum`. */
export const PERMISSOES = CATALOGO_PERMISSOES.map(({ id }) => id) as [
  Permissao,
  ...Permissao[],
];

/** Permissões que o administrador pode selecionar em cargos customizados. */
export const PERMISSOES_ATRIBUIVEIS = CATALOGO_PERMISSOES
  .filter(({ atribuivel }) => atribuivel)
  .map(({ id }) => id) as [PermissaoAtribuivel, ...PermissaoAtribuivel[]];

/** Lookup de label/descrição por permissão (badges + checkboxes da UI). */
export const PERMISSAO_INFO = Object.fromEntries(
  CATALOGO_PERMISSOES.map(({ id, label, descricao }) => [id, { label, descricao }]),
) as Record<Permissao, { label: string; descricao: string }>;

/** Estrutura agrupada consumida pela UI, derivada do mesmo catálogo. */
export const MODULOS = Object.entries(MODULO_INFO)
  .map(([id, info]) => ({
    id: id as Modulo,
    ...info,
    acoes: CATALOGO_PERMISSOES
      .filter(({ modulo, atribuivel }) => modulo === id && atribuivel)
      .map(({ acao: actionId, label, descricao }) => ({
        id: actionId,
        label,
        descricao,
      })),
  }))
  .filter(({ acoes }) => acoes.length > 0);

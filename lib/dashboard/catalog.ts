export type DashboardRole = 'admin' | 'profissional' | 'usuario';

export const WIDGET_TYPES = [
  'kpi.pacientesAtivos',
  'kpi.admissoesSemana',
  'kpi.admissoesMes',
  'kpi.agasPendentes',
  'kpi.agasConcluidasMes',
  'kpi.coberturaAga',
  'kpi.equipeAtiva',
  'kpi.sinaisVitaisMes',
  'kpi.registrosHoje',
  'kpi.evolucoesMes',
  'kpi.intercorrenciasMes',
  'kpi.alertasVitais',
  'list.filaAga',
  'list.pacientesRecentes',
  'list.registrosHoje',
  'list.alertasVitais',
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];
export type WidgetSize = 'sm' | 'md' | 'lg';
export type WidgetKind = 'kpi' | 'list';

export type DashboardWidget = {
  id: string;
  type: WidgetType;
  size: WidgetSize;
};

export type WidgetDefinition = {
  type: WidgetType;
  title: string;
  description: string;
  kind: WidgetKind;
  defaultSize: WidgetSize;
  roles: readonly DashboardRole[];
};

const ALL_ROLES = ['admin', 'profissional', 'usuario'] as const;
const CLINICAL_ROLES = ['admin', 'profissional'] as const;
const ADMIN_ONLY = ['admin'] as const;

export const WIDGET_CATALOG: readonly WidgetDefinition[] = [
  {
    type: 'kpi.pacientesAtivos',
    title: 'Pacientes ativos',
    description: 'Residentes ativos desta instituição.',
    kind: 'kpi',
    defaultSize: 'sm',
    roles: ALL_ROLES,
  },
  {
    type: 'kpi.admissoesSemana',
    title: 'Admissões na semana',
    description: 'Admissões com data de admissão nos últimos 7 dias.',
    kind: 'kpi',
    defaultSize: 'sm',
    roles: ALL_ROLES,
  },
  {
    type: 'kpi.admissoesMes',
    title: 'Admissões no mês',
    description: 'Admissões com data de admissão no mês corrente (Brasília).',
    kind: 'kpi',
    defaultSize: 'sm',
    roles: ALL_ROLES,
  },
  {
    type: 'kpi.agasPendentes',
    title: 'AGAs pendentes',
    description: 'Pacientes ativos sem nenhuma AGA concluída.',
    kind: 'kpi',
    defaultSize: 'sm',
    roles: CLINICAL_ROLES,
  },
  {
    type: 'kpi.agasConcluidasMes',
    title: 'AGAs concluídas no mês',
    description: 'Consolidações concluídas no mês corrente (Brasília).',
    kind: 'kpi',
    defaultSize: 'sm',
    roles: CLINICAL_ROLES,
  },
  {
    type: 'kpi.coberturaAga',
    title: 'Cobertura AGA',
    description: 'Pacientes ativos com pelo menos uma AGA concluída.',
    kind: 'kpi',
    defaultSize: 'sm',
    roles: CLINICAL_ROLES,
  },
  {
    type: 'kpi.equipeAtiva',
    title: 'Equipe ativa',
    description: 'Usuários ativos agrupados por papel.',
    kind: 'kpi',
    defaultSize: 'sm',
    roles: ADMIN_ONLY,
  },
  {
    type: 'kpi.sinaisVitaisMes',
    title: 'Sinais vitais no mês',
    description: 'Aferições registradas no mês corrente (Brasília).',
    kind: 'kpi',
    defaultSize: 'sm',
    roles: CLINICAL_ROLES,
  },
  {
    type: 'kpi.registrosHoje',
    title: 'Registros de hoje',
    description: 'Evoluções, prescrições, exames e intercorrências de hoje.',
    kind: 'kpi',
    defaultSize: 'sm',
    roles: CLINICAL_ROLES,
  },
  {
    type: 'kpi.evolucoesMes',
    title: 'Evoluções no mês',
    description: 'Registros do tipo evolução no mês corrente.',
    kind: 'kpi',
    defaultSize: 'sm',
    roles: CLINICAL_ROLES,
  },
  {
    type: 'kpi.intercorrenciasMes',
    title: 'Intercorrências no mês',
    description: 'Registros do tipo intercorrência no mês corrente.',
    kind: 'kpi',
    defaultSize: 'sm',
    roles: CLINICAL_ROLES,
  },
  {
    type: 'kpi.alertasVitais',
    title: 'Alertas vitais',
    description: 'Últimos sinais fora do corte de triagem.',
    kind: 'kpi',
    defaultSize: 'sm',
    roles: CLINICAL_ROLES,
  },
  {
    type: 'list.filaAga',
    title: 'Fila de AGA',
    description: 'Pacientes ativos ainda sem AGA concluída, por admissão.',
    kind: 'list',
    defaultSize: 'md',
    roles: CLINICAL_ROLES,
  },
  {
    type: 'list.pacientesRecentes',
    title: 'Pacientes recentes',
    description: 'Últimos cadastros ativos da instituição.',
    kind: 'list',
    defaultSize: 'md',
    roles: ALL_ROLES,
  },
  {
    type: 'list.registrosHoje',
    title: 'Atividade de hoje',
    description: 'Últimos registros clínicos de hoje.',
    kind: 'list',
    defaultSize: 'md',
    roles: CLINICAL_ROLES,
  },
  {
    type: 'list.alertasVitais',
    title: 'Alertas vitais',
    description: 'Pacientes cujo último sinal cruzou o corte de triagem.',
    kind: 'list',
    defaultSize: 'md',
    roles: CLINICAL_ROLES,
  },
] as const;

export const WIDGET_BY_TYPE: Record<WidgetType, WidgetDefinition> = Object.fromEntries(
  WIDGET_CATALOG.map((item) => [item.type, item]),
) as Record<WidgetType, WidgetDefinition>;

export const DEFAULT_LAYOUT_ADMIN: readonly Omit<DashboardWidget, 'id'>[] = [
  { type: 'kpi.pacientesAtivos', size: 'sm' },
  { type: 'kpi.admissoesSemana', size: 'sm' },
  { type: 'kpi.agasPendentes', size: 'sm' },
  { type: 'kpi.equipeAtiva', size: 'sm' },
  { type: 'kpi.coberturaAga', size: 'sm' },
  { type: 'kpi.sinaisVitaisMes', size: 'sm' },
  { type: 'kpi.registrosHoje', size: 'sm' },
  { type: 'list.filaAga', size: 'md' },
  { type: 'list.pacientesRecentes', size: 'md' },
];

export const DEFAULT_LAYOUT_PROFISSIONAL: readonly Omit<DashboardWidget, 'id'>[] = [
  { type: 'kpi.registrosHoje', size: 'sm' },
  { type: 'kpi.pacientesAtivos', size: 'sm' },
  { type: 'kpi.agasPendentes', size: 'sm' },
  { type: 'kpi.alertasVitais', size: 'sm' },
  { type: 'list.alertasVitais', size: 'md' },
  { type: 'list.registrosHoje', size: 'md' },
  { type: 'list.filaAga', size: 'lg' },
];

export const DEFAULT_LAYOUT_USUARIO: readonly Omit<DashboardWidget, 'id'>[] = [
  { type: 'kpi.pacientesAtivos', size: 'sm' },
  { type: 'kpi.admissoesSemana', size: 'sm' },
  { type: 'list.pacientesRecentes', size: 'lg' },
];

export function defaultLayoutFor(role: DashboardRole): readonly Omit<DashboardWidget, 'id'>[] {
  if (role === 'admin') return DEFAULT_LAYOUT_ADMIN;
  if (role === 'profissional') return DEFAULT_LAYOUT_PROFISSIONAL;
  return DEFAULT_LAYOUT_USUARIO;
}

export function widgetVisivelPara(type: WidgetType, role: DashboardRole): boolean {
  return WIDGET_BY_TYPE[type].roles.includes(role);
}

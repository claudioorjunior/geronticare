import {
  PanelsTopLeft,
  ContactRound,
  ClipboardCheck,
  FileHeart,
  Activity,
  CalendarClock,
  ListChecks,
  PillBottle,
  Boxes,
  UsersRound,
  MessagesSquare,
  UserRoundCog,
  ChartNoAxesCombined,
  WalletCards,
  Settings2,
  ShieldCheck,
  Cable,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UserRole } from '@/lib/auth/use-user-role';

/**
 * Navegação global do shell — fonte única de itens, grupos e papéis.
 * A filtragem final respeita o papel efetivo + permissões reais
 * (`filtrarPorPermissao`), nunca só o papel nominal (handoff §5).
 */

export type ShellRole = UserRole;

export interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: ShellRole[];
  /** Módulo/permissão exigida (catálogo `lib/permissoes.ts`). */
  permission?: 'clinico:ler' | 'clinico:editar' | 'admin:administrar';
  badge?: number;
  status?: 'soon' | 'attention';
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

/** Rota real existente no app. */
export const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    label: 'Visão geral',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: PanelsTopLeft, roles: ['admin', 'profissional', 'usuario'], permission: 'clinico:ler' },
    ],
  },
  {
    label: 'Cuidado',
    items: [
      { label: 'Pacientes', href: '/pacientes', icon: ContactRound, roles: ['admin', 'profissional', 'usuario'], permission: 'clinico:ler' },
      { label: 'Avaliações', href: '/pacientes', icon: ClipboardCheck, roles: ['admin', 'profissional', 'usuario'], permission: 'clinico:ler', status: 'soon' },
      { label: 'Registros clínicos', href: '/pacientes', icon: FileHeart, roles: ['admin', 'profissional', 'usuario'], permission: 'clinico:ler', status: 'soon' },
      { label: 'Sinais vitais', href: '/pacientes', icon: Activity, roles: ['admin', 'profissional', 'usuario'], permission: 'clinico:ler', status: 'soon' },
    ],
  },
  {
    label: 'Operação',
    items: [
      { label: 'Agenda', href: '/pacientes', icon: CalendarClock, roles: ['admin', 'profissional'], permission: 'clinico:ler', status: 'soon' },
      { label: 'Tarefas', href: '/pacientes', icon: ListChecks, roles: ['admin', 'profissional'], permission: 'clinico:ler', status: 'soon' },
      { label: 'Medicamentos', href: '/pacientes', icon: PillBottle, roles: ['admin', 'profissional'], permission: 'clinico:editar', status: 'soon' },
      { label: 'Estoque', href: '/pacientes', icon: Boxes, roles: ['admin'], permission: 'admin:administrar', status: 'soon' },
    ],
  },
  {
    label: 'Relações',
    items: [
      { label: 'Famílias', href: '/pacientes', icon: UsersRound, roles: ['admin', 'profissional'], permission: 'clinico:ler', status: 'soon' },
      { label: 'Comunicação', href: '/pacientes', icon: MessagesSquare, roles: ['admin', 'profissional'], permission: 'clinico:ler', status: 'soon' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { label: 'Equipe', href: '/profissionais', icon: UserRoundCog, roles: ['admin'], permission: 'admin:administrar' },
      { label: 'Relatórios', href: '/dashboard', icon: ChartNoAxesCombined, roles: ['admin'], permission: 'admin:administrar', status: 'soon' },
      { label: 'Financeiro', href: '/dashboard', icon: WalletCards, roles: ['admin'], permission: 'admin:administrar', status: 'soon' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { label: 'Configurações', href: '/configuracoes', icon: Settings2, roles: ['admin'], permission: 'admin:administrar' },
      { label: 'Auditoria', href: '/configuracoes', icon: ShieldCheck, roles: ['admin'], permission: 'admin:administrar', status: 'soon' },
      { label: 'Integrações', href: '/configuracoes', icon: Cable, roles: ['admin'], permission: 'admin:administrar', status: 'soon' },
    ],
  },
];

/**
 * Filtra grupos/itens por papel efetivo e permissão.
 * Itens sem permissão ficam OCULTOS — nunca desabilitados (handoff §3).
 */
export function filtrarPorPermissao(
  groups: NavigationGroup[],
  role: ShellRole | null,
  permissions: string[],
): NavigationGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (role && !item.roles.includes(role)) return false;
        if (item.permission && !permissions.includes(item.permission)) return false;
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);
}

export function isNavigationItemActive(item: NavigationItem, pathname: string): boolean {
  if (item.status === 'soon') return false;

  return isItemActive(item.href, pathname);
}

export function isItemActive(href: string, pathname: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  if (href === '/pacientes') return pathname.startsWith('/pacientes');
  if (href === '/profissionais') return pathname.startsWith('/profissionais');
  if (href === '/configuracoes') return pathname.startsWith('/configuracoes');
  return pathname === href;
}

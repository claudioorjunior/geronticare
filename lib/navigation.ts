import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FileText,
  HeartPulse,
  CalendarDays,
  ListTodo,
  Pill,
  Package,
  UsersRound,
  MessageSquareText,
  UserCog,
  BarChart3,
  Wallet,
  Settings,
  ShieldCheck,
  Plug,
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
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'profissional', 'usuario'], permission: 'clinico:ler' },
    ],
  },
  {
    label: 'Cuidado',
    items: [
      { label: 'Pacientes', href: '/pacientes', icon: Users, roles: ['admin', 'profissional', 'usuario'], permission: 'clinico:ler' },
      { label: 'Avaliações', href: '/pacientes', icon: ClipboardList, roles: ['admin', 'profissional', 'usuario'], permission: 'clinico:ler', status: 'soon' },
      { label: 'Registros clínicos', href: '/pacientes', icon: FileText, roles: ['admin', 'profissional', 'usuario'], permission: 'clinico:ler', status: 'soon' },
      { label: 'Sinais vitais', href: '/pacientes', icon: HeartPulse, roles: ['admin', 'profissional', 'usuario'], permission: 'clinico:ler', status: 'soon' },
    ],
  },
  {
    label: 'Operação',
    items: [
      { label: 'Agenda', href: '/pacientes', icon: CalendarDays, roles: ['admin', 'profissional'], permission: 'clinico:ler', status: 'soon' },
      { label: 'Tarefas', href: '/pacientes', icon: ListTodo, roles: ['admin', 'profissional'], permission: 'clinico:ler', status: 'soon' },
      { label: 'Medicamentos', href: '/pacientes', icon: Pill, roles: ['admin', 'profissional'], permission: 'clinico:editar', status: 'soon' },
      { label: 'Estoque', href: '/pacientes', icon: Package, roles: ['admin'], permission: 'admin:administrar', status: 'soon' },
    ],
  },
  {
    label: 'Relações',
    items: [
      { label: 'Famílias', href: '/pacientes', icon: UsersRound, roles: ['admin', 'profissional'], permission: 'clinico:ler', status: 'soon' },
      { label: 'Comunicação', href: '/pacientes', icon: MessageSquareText, roles: ['admin', 'profissional'], permission: 'clinico:ler', status: 'soon' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { label: 'Equipe', href: '/profissionais', icon: UserCog, roles: ['admin'], permission: 'admin:administrar' },
      { label: 'Relatórios', href: '/dashboard', icon: BarChart3, roles: ['admin'], permission: 'admin:administrar', status: 'soon' },
      { label: 'Financeiro', href: '/dashboard', icon: Wallet, roles: ['admin'], permission: 'admin:administrar', status: 'soon' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { label: 'Configurações', href: '/configuracoes', icon: Settings, roles: ['admin'], permission: 'admin:administrar' },
      { label: 'Auditoria', href: '/configuracoes', icon: ShieldCheck, roles: ['admin'], permission: 'admin:administrar', status: 'soon' },
      { label: 'Integrações', href: '/configuracoes', icon: Plug, roles: ['admin'], permission: 'admin:administrar', status: 'soon' },
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

export function isItemActive(href: string, pathname: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  if (href === '/pacientes') return pathname.startsWith('/pacientes');
  if (href === '/profissionais') return pathname.startsWith('/profissionais');
  if (href === '/configuracoes') return pathname.startsWith('/configuracoes');
  return pathname === href;
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useUserRole } from '@/lib/auth/use-user-role';
import { NAVIGATION_GROUPS, filtrarPorPermissao, isItemActive } from '@/lib/navigation';
import { PERMISSOES_BASE } from '@/lib/trpc/autorizacao';
import { InstitutionThemePicker } from './InstitutionThemePicker';

/**
 * Sidebar global (handoff §5): marca, seletor institucional, grupos de
 * navegação e ação contextual. Expandida ≈256px; recolhida ≈72px (rail de
 * ícones). O header e a sidebar compartilham a mesma cor-base
 * (`--institution-shell-bg`).
 */
export function GlobalSidebar() {
  const pathname = usePathname();
  const { role } = useUserRole();
  const [collapsed, setCollapsed] = useState(false);

  // Papel efetivo + permissões reais — itens sem permissão ficam ocultos.
  const groups = filtrarPorPermissao(NAVIGATION_GROUPS, role, role ? PERMISSOES_BASE[role] : []);

  const toggle = () => setCollapsed((v) => !v);

  return (
    <aside
      aria-label="Navegação principal"
      className={`institution-shell fixed inset-y-0 left-0 z-40 flex flex-col transition-[width] duration-300 ease-out ${collapsed ? 'w-[72px]' : 'w-64'}`}
    >
      {/* Marca + instituição */}
      <div className={`flex items-center gap-3 px-4 pt-5 pb-4 ${collapsed ? 'justify-center px-2' : ''}`}>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-institution-fg">GerontiCare</p>
            <p className="truncate text-xs text-institution-muted">Cuidado que continua</p>
          </div>
        )}
        {collapsed && (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-institution-active/20 text-sm font-bold text-institution-active">
            G
          </span>
        )}
      </div>

      {/* Seletor de instituição/unidade */}
      {!collapsed && (
        <div className="mx-3 mb-2 rounded-lg bg-institution-hover px-3 py-2">
          <p className="truncate text-xs font-medium text-institution-fg">Residencial Aurora</p>
          <p className="truncate text-[11px] text-institution-muted">Unidade Centro</p>
        </div>
      )}

      {/* Colapso */}
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? 'Expandir navegação' : 'Recolher navegação'}
        className="mx-3 mb-2 flex h-8 items-center justify-center gap-2 rounded-lg text-xs text-institution-muted hover:bg-institution-hover hover:text-institution-fg"
      >
        {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Recolher</>}
      </button>

      {/* Grupos */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-institution-muted">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isItemActive(item.href, pathname);
                const Icon = item.icon;
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      data-tip={collapsed ? item.label : undefined}
                      className={`group flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors ${
                        collapsed ? 'tooltip tooltip-right justify-center px-0' : ''
                      } ${
                        active
                          ? 'bg-institution-active text-institution-active-fg font-medium'
                          : 'text-institution-fg hover:bg-institution-hover'
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                      {!collapsed && item.status === 'soon' && (
                        <span className="shrink-0 rounded-full bg-institution-hover px-1.5 py-0.5 text-[10px] font-medium text-institution-muted">
                          em breve
                        </span>
                      )}
                      {!collapsed && item.badge && (
                        <span className="shrink-0 rounded-full bg-institution-alert px-1.5 text-[10px] font-semibold text-institution-fg">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Tema + rodapé */}
      <div className="border-t border-institution-border p-3">
        <InstitutionThemePicker collapsed={collapsed} />
        {!collapsed && (
          <p className="mt-3 px-1 text-[11px] text-institution-muted">v0.6.0 · ILPI</p>
        )}
      </div>
    </aside>
  );
}

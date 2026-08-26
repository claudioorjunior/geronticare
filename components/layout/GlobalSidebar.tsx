'use client';

import Image from 'next/image';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from '@base-ui/react/menu';
import { Check, Activity, ChevronsLeft, ChevronsRight, ChevronDown, CircleHelp, Command, X } from 'lucide-react';
import { useUserRole } from '@/lib/auth/use-user-role';
import { NAVIGATION_GROUPS, filtrarPorPermissao, isNavigationItemActive } from '@/lib/navigation';
import { PERMISSOES_BASE } from '@/lib/trpc/autorizacao';

const INSTITUTION = {
  initials: 'RA',
  name: 'Residencial Aurora',
  // Logo da instituição: conectar ao campo de branding quando o upload existir.
  logoUrl: null as string | null,
  units: [
    { id: 'centro', initials: 'UC', name: 'Unidade Centro' },
  ],
} as const;

/** Marca da instituição no seletor. O monograma mantém o layout estável até o branding existir. */
function InstitutionMark() {
  const frameClassName = 'relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden';

  if (INSTITUTION.logoUrl) {
    return (
      <span className={frameClassName}>
        <Image
          src={INSTITUTION.logoUrl}
          alt=""
          fill
          sizes="32px"
          className="object-contain p-0.5"
        />
      </span>
    );
  }

  return (
    <span className={`${frameClassName} text-[10px] font-bold tracking-[0.04em] text-institution-active`}>
      {INSTITUTION.initials}
    </span>
  );
}

/**
 * Sidebar global (handoff §5): marca, seletor institucional, grupos de
 * navegação e ação contextual. Expandida ≈256px; recolhida ≈72px (rail de
 * ícones). O header e a sidebar compartilham a mesma cor-base
 * (`--institution-shell-bg`).
 *
 * O estado de colapso é controlado pelo `AppShell` (ancestral comum), para que
 * header e main reservem a largura correta.
 */
export function GlobalSidebar({
  collapsed,
  mobileOpen,
  onMobileClose,
  onToggle,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const { role } = useUserRole();
  const [unitMenuOpen, setUnitMenuOpen] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState(INSTITUTION.units[0].id);
  const selectedUnit = INSTITUTION.units.find((unit) => unit.id === selectedUnitId) ?? INSTITUTION.units[0];

  // Papel efetivo + permissões reais — itens sem permissão ficam ocultos.
  const groups = filtrarPorPermissao(NAVIGATION_GROUPS, role, role ? PERMISSOES_BASE[role] : []);

  return (
    <aside
      aria-label="Navegação principal"
      className={`institution-shell institution-sidebar-shell fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-[transform,width] duration-300 ease-out md:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      } ${collapsed ? 'md:w-[72px]' : 'md:w-64'}`}
    >
      {/* Marca fixa da plataforma. A identidade da ILPI pertence ao seletor abaixo. */}
      <div className={`relative flex h-[72px] items-center border-b border-institution-border ${collapsed ? 'justify-center px-2' : 'px-4'}`}>
        <Image
          src={collapsed ? '/geronticare-symbol.png' : '/geronticare-logo.png'}
          alt="GerontiCare"
          width={collapsed ? 91 : 363}
          height={79}
          priority
          sizes={collapsed ? '40px' : '224px'}
          className={collapsed
            ? 'h-10 w-auto max-w-[40px] object-contain brightness-0 invert'
            : 'h-auto w-full max-h-10 object-contain brightness-0 invert'}
        />
        <button
          type="button"
          aria-label="Fechar navegação"
          onClick={onMobileClose}
          className="absolute right-3 flex h-9 w-9 items-center justify-center rounded-md text-institution-muted hover:bg-institution-hover hover:text-institution-fg md:hidden"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Workspace switcher: mesmo com uma unidade, a interação já escala para a lista real. */}
      {!collapsed && (
        <div className="mx-3 mt-3 mb-2">
          <Menu.Root
            modal={false}
            open={unitMenuOpen}
            onOpenChange={(open) => setUnitMenuOpen(open)}
          >
            <Menu.Trigger
              aria-label="Selecionar instituição e unidade"
              className="sidebar-lift group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-institution-active/50"
            >
              <InstitutionMark />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-semibold tracking-[-0.01em] text-institution-fg">
                  {INSTITUTION.name}
                </span>
                <span className="flex min-w-0 items-center gap-1.5 truncate pt-0.5 text-[10px] text-institution-muted">
                  <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-institution-active/75" />
                  <span className="truncate">{selectedUnit.name}</span>
                </span>
              </span>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center text-institution-muted transition-colors group-hover:text-institution-active" aria-hidden="true">
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${unitMenuOpen ? 'rotate-180' : ''}`} />
              </span>
            </Menu.Trigger>

            <Menu.Portal>
              <Menu.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
                <Menu.Popup
                  aria-label={`Unidades de ${INSTITUTION.name}`}
                  className="institution-menu-popup w-[var(--anchor-width)] origin-[var(--transform-origin)] rounded-lg border p-1 outline-none transition-[opacity,transform] duration-150 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0"
                >
                  <Menu.Group>
                    <div className="flex items-center gap-2.5 px-2.5 py-2.5">
                      <InstitutionMark />
                      <div className="min-w-0">
                        <Menu.GroupLabel className="truncate text-[11px] font-semibold tracking-[-0.01em] text-institution-fg">
                          {INSTITUTION.name}
                        </Menu.GroupLabel>
                        <p className="mt-0.5 text-[10px] text-institution-muted">
                          {INSTITUTION.units.length} {INSTITUTION.units.length === 1 ? 'unidade disponível' : 'unidades disponíveis'}
                        </p>
                      </div>
                    </div>
                  </Menu.Group>

                  <Menu.Separator className="mx-1 mb-1 h-px bg-institution-border/80" />

                  <Menu.Group>
                    <Menu.GroupLabel className="px-2.5 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-institution-muted">
                      Unidades
                    </Menu.GroupLabel>
                    <Menu.RadioGroup
                      aria-label="Selecionar unidade"
                      value={selectedUnitId}
                      onValueChange={(value) => setSelectedUnitId(value)}
                    >
                      {INSTITUTION.units.map((unit) => (
                        <Menu.RadioItem
                          key={unit.id}
                          closeOnClick
                          value={unit.id}
                          className="group flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-left outline-none transition-[background-color] duration-150 data-[highlighted]:bg-institution-hover data-[checked]:bg-institution-active-surface focus-visible:ring-2 focus-visible:ring-institution-active/50"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-institution-active/10 text-[10px] font-bold tracking-[0.04em] text-institution-active">
                            {unit.initials}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11px] font-semibold text-institution-fg">{unit.name}</span>
                            <span className="flex items-center gap-1.5 pt-0.5 text-[10px] text-institution-muted">
                              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-institution-active/75" />
                              Unidade atual
                            </span>
                          </span>
                          <Menu.RadioItemIndicator
                            keepMounted
                            className="flex h-4 w-4 shrink-0 items-center justify-center text-institution-active opacity-0 transition-opacity duration-150 data-[checked]:opacity-100"
                          >
                            <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                          </Menu.RadioItemIndicator>
                        </Menu.RadioItem>
                      ))}
                    </Menu.RadioGroup>
                  </Menu.Group>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      )}

      <div className={`mb-2 hidden md:flex ${collapsed ? 'justify-center' : 'justify-end px-3'}`}>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir navegação' : 'Recolher navegação'}
          className="flex h-7 items-center justify-center gap-2 rounded-md px-2 text-[11px] text-institution-muted transition-colors hover:bg-institution-hover hover:text-institution-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-institution-active/50"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-3.5 w-3.5" /> Recolher</>}
        </button>
      </div>

      {/* Grupos */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4" aria-label="Módulos">
        {groups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <div className="mb-1 flex items-center gap-2 px-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-institution-muted">{group.label}</p>
                <span className="h-px flex-1 bg-institution-border/70" />
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isNavigationItemActive(item, pathname);
                const Icon = item.icon;
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      onClick={onMobileClose}
                      aria-current={active ? 'page' : undefined}
                      data-tip={collapsed ? item.label : undefined}
                      className={`group relative flex items-center gap-3 rounded-md px-2 py-2 text-[13px] transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-institution-active/70 ${
                        collapsed ? 'tooltip tooltip-right justify-center px-0' : ''
                      } ${
                        active
                          ? 'sidebar-lift font-semibold text-institution-fg after:absolute after:inset-y-1.5 after:left-0 after:w-0.5 after:rounded-r-full after:bg-institution-active after:content-[\"\"]'
                          : 'text-institution-fg hover:bg-institution-hover'
                      }`}
                    >
                      <Icon
                        aria-hidden="true"
                        strokeWidth={1.8}
                        className={`h-[18px] w-[18px] shrink-0 transition-colors duration-150 ${active ? 'text-institution-active' : 'text-institution-muted group-hover:text-institution-fg'}`}
                      />
                      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                      {!collapsed && item.status === 'soon' && (
                        <span className="soon-badge soon-badge--warning" aria-label="Em breve">
                          em breve
                        </span>
                      )}
                      {!collapsed && item.badge && (
                        <span className="shrink-0 rounded bg-institution-alert px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
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

      {/* Rodapé */}
      <div className="border-t border-institution-border p-3">
        {!collapsed && (
          <div className="mb-2 flex items-center gap-2 px-2 text-[11px] text-institution-muted">
            <Activity className="h-3.5 w-3.5 text-institution-active" />
            <span>Ambiente operacional</span>
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-institution-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" aria-hidden="true" />
              Online
            </span>
          </div>
        )}
        {!collapsed && (
          <button type="button" aria-label="Abrir central de ajuda" className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] text-institution-muted transition-colors hover:bg-institution-hover hover:text-institution-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-institution-active/50">
            <CircleHelp className="h-3.5 w-3.5" /> Central de ajuda
            <Command className="ml-auto h-3.5 w-3.5" />
          </button>
        )}
        {!collapsed && (
          <p className="mt-3 px-1 text-[10px] text-institution-muted">v0.6.0 · ILPI</p>
        )}
      </div>
    </aside>
  );
}

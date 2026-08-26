import { describe, expect, it } from 'vitest';
import {
  NAVIGATION_GROUPS,
  filtrarPorPermissao,
  isNavigationItemActive,
  type NavigationGroup,
} from './navigation';

function findItem(label: string) {
  const item = NAVIGATION_GROUPS.flatMap((group) => group.items).find(
    (candidate) => candidate.label === label,
  );

  if (!item) throw new Error(`Navigation item not found: ${label}`);
  return item;
}

describe('isNavigationItemActive', () => {
  it('does not mark a soon item active when its placeholder route is current', () => {
    expect(isNavigationItemActive(findItem('Avaliações'), '/pacientes')).toBe(false);
    expect(isNavigationItemActive(findItem('Relatórios'), '/dashboard')).toBe(false);
    expect(isNavigationItemActive(findItem('Auditoria'), '/configuracoes')).toBe(false);
  });

  it('marks a ready item active on its real route', () => {
    expect(isNavigationItemActive(findItem('Pacientes'), '/pacientes')).toBe(true);
    expect(isNavigationItemActive(findItem('Dashboard'), '/dashboard')).toBe(true);
  });
});

describe('filtrarPorPermissao', () => {
  it('exibe item liberado pela permissão efetiva de um cargo', () => {
    const groups: NavigationGroup[] = [{
      label: 'Clínico',
      items: [{
        label: 'Edição clínica',
        href: '/pacientes',
        icon: findItem('Pacientes').icon,
        roles: ['usuario'],
        permission: 'clinico:editar',
      }],
    }];

    expect(filtrarPorPermissao(groups, 'usuario', ['clinico:ler'])).toEqual([]);
    expect(
      filtrarPorPermissao(groups, 'usuario', ['clinico:ler', 'clinico:editar']),
    ).toHaveLength(1);
  });
});

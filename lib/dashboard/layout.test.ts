import { describe, expect, it } from 'vitest';
import {
  adicionarWidget,
  moverWidget,
  sanitizeLayout,
  widgetsDisponiveis,
} from './layout';
import { DEFAULT_LAYOUT_ADMIN, WIDGET_TYPES } from './catalog';

describe('sanitizeLayout', () => {
  it('cai no default do papel quando o JSON é lixo ou vazio', () => {
    const layout = sanitizeLayout(null, 'admin');
    expect(layout.map((item) => item.type)).toEqual(
      DEFAULT_LAYOUT_ADMIN.map((item) => item.type),
    );
    expect(new Set(layout.map((item) => item.id)).size).toBe(layout.length);
  });

  it('descarta tipo desconhecido caindo no default do papel', () => {
    // zod rejeita o array inteiro (tipo fora do enum) -> layout default seguro
    const layout = sanitizeLayout(
      [{ id: 'a', type: 'kpi.ocupacao', size: 'md' }],
      'admin',
    );
    expect(layout.map((item) => item.type)).toEqual(
      DEFAULT_LAYOUT_ADMIN.map((item) => item.type),
    );
  });

  it('remove duplicata de tipo mantendo a primeira ocorrência', () => {
    const layout = sanitizeLayout(
      [
        { id: 'a', type: 'kpi.pacientesAtivos', size: 'sm' },
        { id: 'b', type: 'kpi.pacientesAtivos', size: 'lg' },
        { id: 'c', type: 'list.filaAga', size: 'md' },
      ],
      'admin',
    );
    expect(layout.map((item) => item.type)).toEqual([
      'kpi.pacientesAtivos',
      'list.filaAga',
    ]);
  });
});

describe('edição do painel', () => {
  it('não adiciona o mesmo tipo duas vezes', () => {
    const base = sanitizeLayout(
      [{ id: 'a', type: 'kpi.pacientesAtivos', size: 'sm' }],
      'admin',
    );
    expect(adicionarWidget(base, 'kpi.pacientesAtivos')).toBe(base);
  });

  it('move um widget sem perder os demais', () => {
    const base = sanitizeLayout(
      [
        { id: 'a', type: 'kpi.pacientesAtivos', size: 'sm' },
        { id: 'b', type: 'kpi.admissoesSemana', size: 'sm' },
        { id: 'c', type: 'kpi.agasPendentes', size: 'sm' },
      ],
      'admin',
    );
    expect(moverWidget(base, 'a', 1).map((item) => item.id)).toEqual(['b', 'a', 'c']);
  });

  it('lista só o que ainda cabe no catálogo do papel', () => {
    const layout = sanitizeLayout(
      [{ id: 'a', type: 'kpi.pacientesAtivos', size: 'sm' }],
      'usuario',
    );
    const disponiveis = widgetsDisponiveis(layout, 'usuario');
    expect(disponiveis).not.toContain('kpi.pacientesAtivos');
    expect(disponiveis).not.toContain('kpi.equipeAtiva');
    expect(disponiveis).toContain('kpi.admissoesSemana');
    expect(WIDGET_TYPES.includes(disponiveis[0])).toBe(true);
  });
});

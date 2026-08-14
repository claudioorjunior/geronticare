import { z } from 'zod';
import {
  type DashboardWidget,
  type DashboardRole,
  type WidgetSize,
  type WidgetType,
  WIDGET_TYPES,
  WIDGET_BY_TYPE,
  defaultLayoutFor,
  widgetVisivelPara,
} from './catalog';

export const MAX_DASHBOARD_WIDGETS = 16;

const widgetSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(WIDGET_TYPES),
  size: z.enum(['sm', 'md', 'lg']),
});

export const dashboardLayoutSchema = z.array(widgetSchema).max(MAX_DASHBOARD_WIDGETS);

export function newWidgetId(): string {
  return crypto.randomUUID();
}

export function materializeLayout(
  items: readonly Omit<DashboardWidget, 'id'>[],
): DashboardWidget[] {
  return items.map((item) => ({ ...item, id: newWidgetId() }));
}

export function sanitizeLayout(input: unknown, role: DashboardRole = 'admin'): DashboardWidget[] {
  const parsed = dashboardLayoutSchema.safeParse(input);
  const source = parsed.success ? parsed.data : [];
  const seen = new Set<WidgetType>();
  const clean: DashboardWidget[] = [];

  for (const item of source) {
    if (seen.has(item.type)) continue;
    if (!widgetVisivelPara(item.type, role) && role !== 'admin') continue;
    seen.add(item.type);
    clean.push({
      id: item.id,
      type: item.type,
      size: item.size,
    });
    if (clean.length >= MAX_DASHBOARD_WIDGETS) break;
  }

  if (clean.length === 0) {
    return materializeLayout(defaultLayoutFor(role));
  }

  return clean;
}

export function widgetsDisponiveis(layout: DashboardWidget[], role: DashboardRole): WidgetType[] {
  const used = new Set(layout.map((item) => item.type));
  return WIDGET_TYPES.filter((type) => !used.has(type) && widgetVisivelPara(type, role));
}

export function adicionarWidget(
  layout: DashboardWidget[],
  type: WidgetType,
): DashboardWidget[] {
  if (layout.some((item) => item.type === type)) return layout;
  if (layout.length >= MAX_DASHBOARD_WIDGETS) return layout;
  const def = WIDGET_BY_TYPE[type];
  return [...layout, { id: newWidgetId(), type, size: def.defaultSize }];
}

export function removerWidget(layout: DashboardWidget[], id: string): DashboardWidget[] {
  return layout.filter((item) => item.id !== id);
}

export function moverWidget(
  layout: DashboardWidget[],
  id: string,
  direction: -1 | 1,
): DashboardWidget[] {
  const index = layout.findIndex((item) => item.id === id);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= layout.length) return layout;
  const copy = layout.slice();
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item);
  return copy;
}

export function reordenarWidget(
  layout: DashboardWidget[],
  fromId: string,
  toId: string,
): DashboardWidget[] {
  if (fromId === toId) return layout;
  const from = layout.findIndex((item) => item.id === fromId);
  const to = layout.findIndex((item) => item.id === toId);
  if (from < 0 || to < 0) return layout;
  const copy = layout.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function redimensionarWidget(
  layout: DashboardWidget[],
  id: string,
  size: WidgetSize,
): DashboardWidget[] {
  return layout.map((item) => (item.id === id ? { ...item, size } : item));
}

export function colSpanClass(size: WidgetSize): string {
  if (size === 'lg') return 'md:col-span-2 xl:col-span-3';
  if (size === 'md') return 'md:col-span-2';
  return '';
}

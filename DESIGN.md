# GerontiCare — Design System

## Theme

Light mode. Clean, clinical, airy. Dark mode deferred to post-v1.

## Color Strategy: Restrained

Tinted neutrals (cool gray toward slate) + one accent (teal-600) ≤ 10% of surface. Semantic colors only for clinical status badges.

## Palette

### Neutrals (cool gray, tinted toward slate-blue)
- Background: `oklch(0.98 0.004 240)` — `#f8fafc` (slate-50)
- Surface: `oklch(1 0 0)` — `#ffffff` (white, used for cards/inputs)
- Border: `oklch(0.92 0.004 240)` — `#e2e8f0` (slate-200)
- Border strong: `oklch(0.88 0.006 240)` — `#cbd5e1` (slate-300)
- Text primary: `oklch(0.21 0.01 240)` — `#1e293b` (slate-800)
- Text secondary: `oklch(0.45 0.01 240)` — `#64748b` (slate-500)
- Text muted: `oklch(0.55 0.008 240)` — `#94a3b8` (slate-400)

### Accent (teal)
- Primary: `oklch(0.55 0.12 180)` — `#0d9488` (teal-600)
- Primary hover: `oklch(0.48 0.12 180)` — `#0f766e` (teal-700)
- Primary light: `oklch(0.95 0.03 180)` — `#f0fdfa` (teal-50)
- Primary text: `oklch(0.40 0.10 180)` — `#0f766e` (teal-700)

### Semantic (clinical status only)
- Danger/Critical: `#dc2626` (red-600) — used for critical vitals, intercorrências
- Warning/Attention: `#d97706` (amber-600) — used for pending items, abnormal values
- Success/Normal: `#059669` (emerald-600) — used for normal vitals, completed tasks
- Info: `#2563eb` (blue-600) — used for informational badges

## Typography

- **Font:** Geist (already in project via `next/font`)
- **Headings:** `font-semibold` (600), tracking-tight
- **Body:** `font-normal` (400), `text-sm` (14px) minimum
- **Data/numbers:** `font-medium` (500), `tabular-nums` for tables
- **Labels/captions:** `text-xs` (12px), `text-slate-500`
- Hierarchy scale: h1 `text-2xl`, h2 `text-xl`, h3 `text-lg`, h4 `text-base`

## Elevation

- Cards: `shadow-sm` (subtle), `border` always present
- Dropdowns/popovers: `shadow-lg`
- Modals: `shadow-xl`
- No shadow without a border

## Corner Radius

- Inputs, buttons: `rounded-md` (6px)
- Cards, panels: `rounded-lg` (8px)
- Badges, pills: `rounded-full`
- One system, consistent everywhere

## Spacing

- Page padding: `px-6 py-6` (24px)
- Card padding: `p-5` (20px) or `p-6` (24px)
- Stack gaps: `gap-4` (16px) default, `gap-6` (24px) for sections
- Form field gaps: `gap-2` (8px) within field, `gap-4` (16px) between fields

## Icons

- Library: `lucide-react` (already installed, Claudio preference)
- Size: 16px inline, 20px standalone, 14px in badges
- Stroke width: 2 (default)
- Color: inherits text color, or explicit semantic

## Component Patterns

- **KPI cards:** number large (`text-3xl font-semibold tabular-nums`), label small (`text-sm text-slate-500`), optional delta indicator. No decorative icons inside KPI cards.
- **Tables:** `divide-y divide-slate-200`, header `text-xs uppercase tracking-wide text-slate-500`, body `text-sm`, row hover `hover:bg-slate-50`
- **Tabs:** underline style (active = teal border-bottom 2px), not pill style
- **Forms:** label above input, helper text below, error text below in red-600
- **Badges:** `rounded-full px-2 py-0.5 text-xs font-medium` with semantic bg/text pair
- **Buttons:** primary `bg-teal-600 text-white hover:bg-teal-700`, secondary `border border-slate-300 bg-white hover:bg-slate-50`

## Motion

Minimal. `transition-colors duration-150` on interactive elements. No page transitions, no scroll animations, no stagger reveals. The UI is a tool, not a showcase.

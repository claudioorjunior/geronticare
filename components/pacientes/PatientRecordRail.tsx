'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useUserRole } from '@/lib/auth/use-user-role';
import {
  RECORD_SECTIONS,
  filtrarSecoesPorPapel,
  segmentoAtivo,
  hrefSecao,
} from '@/lib/patient-record';

/**
 * Rail de fichário do prontuário (handoff §3, spec §prontuário).
 *
 * Não é uma tab bar horizontal genérica. Cada marcador é uma "aba de fichário"
 * vertical à esquerda da folha; o ativo se encaixa NA folha — a borda direita
 * some e o marcador ganha o mesmo fundo branco da folha, criando continuidade
 * física. O estado ativo é comunicado por posição + fundo + peso + `aria-current`,
 * nunca só por cor (handoff §4, critérios de acessibilidade §10).
 *
 * Seções `soon` não têm rota real: viram marcadores inertes (`<span>`), com o
 * mesmo slot de ícone/label, sinalizadas por “em breve”.
 */
export function PatientRecordRail() {
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const { role } = useUserRole();
  const patientId = params.id;

  const sections = filtrarSecoesPorPapel(RECORD_SECTIONS, role);
  const ativo = segmentoAtivo(pathname);

  return (
    <nav
      aria-label="Seções do prontuário"
      className="flex shrink-0 gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0 md:pt-1"
    >
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = ativo === section.path;

        // Encaixe na folha: borda esquerda de destaque + fundo branco contínuo,
        // "puxando" o marcador +1px para dentro da folha (−mr) no estado ativo.
        const base =
          'group relative flex shrink-0 items-center gap-2 rounded-t-lg border px-3 py-2.5 text-sm transition-colors md:gap-2.5 md:rounded-l-lg md:rounded-tr-none md:border-y md:border-l md:border-r-0 md:pl-3 md:pr-4';

        if (section.status === 'soon') {
          return (
            <span
              key={section.label}
              aria-disabled="true"
              className={`${base} cursor-default border-transparent text-slate-400`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{section.label}</span>
              <span className="soon-badge soon-badge--warning">
                em breve
              </span>
            </span>
          );
        }

        return (
          <Link
            key={section.label}
            href={hrefSecao(patientId, section.path)}
            aria-current={isActive ? 'page' : undefined}
            className={`${base} ${
              isActive
                ? 'border-slate-200 bg-white font-semibold text-slate-900 shadow-[inset_0_-3px_0_0_var(--color-teal-700,#0f766e)] md:-mr-px md:shadow-[inset_3px_0_0_0_var(--color-teal-700,#0f766e)]'
                : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon
              className={`h-4 w-4 shrink-0 ${isActive ? 'text-teal-700' : 'text-slate-400 group-hover:text-slate-600'}`}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">{section.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

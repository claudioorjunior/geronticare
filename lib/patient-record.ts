import {
  User,
  ClipboardList,
  Layers,
  FileText,
  HeartPulse,
  Paperclip,
  ClipboardCheck,
  Pill,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UserRole } from '@/lib/auth/use-user-role';

/**
 * Seções do prontuário — a "rail de fichário" (handoff §3, spec §prontuário).
 * Fonte única das seções internas da pessoa residente. Diferente da navegação
 * global (`lib/navigation.ts`): aqui são seções DENTRO de um paciente.
 *
 * `path` é o segmento após `/pacientes/[id]`; `''` é a folha de Dados.
 * Seções sem rota real ficam `status: 'soon'` — aparecem como marcadores
 * inertes (não são links), preservando a linguagem sem prometer rota falsa.
 */
export interface RecordSection {
  label: string;
  /** Segmento de rota após `/pacientes/[id]`. Vazio = Dados (folha base). */
  path: string;
  icon: LucideIcon;
  roles: UserRole[];
  status?: 'soon';
}

const ALL_ROLES: UserRole[] = ['admin', 'profissional', 'usuario'];

export const RECORD_SECTIONS: RecordSection[] = [
  { label: 'Dados', path: '', icon: User, roles: ALL_ROLES },
  { label: 'Avaliações', path: 'avaliacoes', icon: ClipboardList, roles: ALL_ROLES },
  { label: 'AGA', path: 'aga', icon: Layers, roles: ALL_ROLES },
  { label: 'Registros', path: 'registros', icon: FileText, roles: ALL_ROLES },
  { label: 'Sinais vitais', path: 'sinais', icon: HeartPulse, roles: ALL_ROLES },
  { label: 'Anexos', path: 'anexos', icon: Paperclip, roles: ALL_ROLES, status: 'soon' },
  { label: 'Plano de cuidado', path: 'plano', icon: ClipboardCheck, roles: ['admin', 'profissional'], status: 'soon' },
  { label: 'Medicamentos', path: 'medicamentos', icon: Pill, roles: ['admin', 'profissional'], status: 'soon' },
  { label: 'Família', path: 'familia', icon: UsersRound, roles: ['admin', 'profissional'], status: 'soon' },
];

/** Seções visíveis para o papel (itens sem papel ficam ocultos). */
export function filtrarSecoesPorPapel(
  sections: RecordSection[],
  role: UserRole | null,
): RecordSection[] {
  if (role === null) return [];
  return sections.filter((s) => s.roles.includes(role));
}

/**
 * Segmento ativo dentro de `/pacientes/[id]/<segmento>`.
 * Índice 0=`pacientes`, 1=`[id]`, 2=`<segmento>`; vazio = Dados.
 */
export function segmentoAtivo(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  return segments[2] ?? '';
}

/** Href real da seção para um paciente. */
export function hrefSecao(patientId: string, path: string): string {
  return path ? `/pacientes/${patientId}/${path}` : `/pacientes/${patientId}`;
}

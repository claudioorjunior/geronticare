'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import {
  BadgeCheck, TriangleAlert, Droplets, Pencil,
  Stethoscope, Pill, FlaskConical,
  History, Activity, ClipboardList, Paperclip,
  User, CalendarDays
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDevRole } from '@/lib/dev/use-dev-role';
import { AgaTab } from './aga-component';

// ── Types ──

interface TimelineEvent {
  id: string;
  type: 'medicina' | 'enfermagem' | 'nutricao' | 'fisioterapia' | 'fonoaudiologia' | 'psicologia' | 'laboratorio';
  title: string;
  date: string;
  time?: string;
  description: string;
  author: string;
}

interface ExamResult {
  label: string;
  value: string;
}

interface LabEvent extends TimelineEvent {
  type: 'laboratorio';
  results: ExamResult[];
}

type TabKey = 'timeline' | 'sinais' | 'aga' | 'anexos';

// ── Mock Data ──

const mockTimeline: (TimelineEvent | LabEvent)[] = [
  {
    id: '1',
    type: 'medicina',
    title: 'Consulta Geriátrica de Rotina',
    date: 'Hoje',
    time: '10:30',
    description:
      'Paciente apresenta quadro estável. Relata leve melhora na mobilidade após início da fisioterapia. Pressão arterial dentro da normalidade para a idade.',
    author: 'Dra. Camila Rocha',
  },
  {
    id: '2',
    type: 'enfermagem',
    title: 'Ajuste de Medicação',
    date: 'Ontem',
    time: '15:45',
    description:
      'Ajustada dosagem de Losartana para 50mg/dia. Manter demais medicações conforme prescrição anterior.',
    author: 'Dr. Paulo Mendes',
  },
  {
    id: '3',
    type: 'laboratorio',
    title: 'Resultados de Exames Laboratoriais',
    date: '12/10/2023',
    time: '08:00',
    description: '',
    author: 'Lab. Central',
    results: [
      { label: 'Hemoglobina Glicada', value: '5.8%' },
      { label: 'Colesterol Total', value: '185 mg/dL' },
      { label: 'Creatinina', value: '1.1 mg/dL' },
    ],
  } as LabEvent,
];

function isLabEvent(e: TimelineEvent | LabEvent): e is LabEvent {
  return e.type === 'laboratorio' && 'results' in e;
}

// ── Helpers ──

const typeMeta: Record<string, { icon: React.ReactNode; colorClass: string; bgClass: string }> = {
  medicina: { icon: <Stethoscope className="h-4 w-4" />, colorClass: 'text-m3-on-primary', bgClass: 'bg-m3-primary' },
  enfermagem: { icon: <Pill className="h-4 w-4" />, colorClass: 'text-m3-on-secondary', bgClass: 'bg-m3-secondary' },
  laboratorio: { icon: <FlaskConical className="h-4 w-4" />, colorClass: 'text-m3-on-tertiary', bgClass: 'bg-m3-tertiary' },
  fisioterapia: { icon: <Activity className="h-4 w-4" />, colorClass: 'text-m3-on-primary-container', bgClass: 'bg-m3-primary-container' },
  nutricao: { icon: <ClipboardList className="h-4 w-4" />, colorClass: 'text-white', bgClass: 'bg-amber-600' },
  fonoaudiologia: { icon: <User className="h-4 w-4" />, colorClass: 'text-white', bgClass: 'bg-indigo-500' },
  psicologia: { icon: <User className="h-4 w-4" />, colorClass: 'text-white', bgClass: 'bg-purple-500' },
};

// ── Patient Header Card ──

function PatientHeaderCard() {
  return (
    <section className="bg-m3-surface rounded-m3-xl border border-m3-outline-variant p-gutter flex flex-col md:flex-row gap-gutter items-start md:items-center">
      {/* Avatar */}
      <div className="shrink-0">
        <div className="w-24 h-24 rounded-full bg-m3-surface-variant flex items-center justify-center text-m3-primary font-bold text-2xl border-2 border-m3-surface-container-highest">
          AS
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 flex flex-col gap-2">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-headline-lg text-m3-on-surface">Sr. Antônio Silva</h1>
          <span className="text-body-lg text-m3-secondary">82 anos</span>
          <span className="text-body-md text-m3-secondary">(15/03/1942)</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-m3-surface-container-high text-m3-on-surface-variant text-label-sm border border-m3-outline-variant">
            <BadgeCheck className="h-3.5 w-3.5" /> ID: 98765-4
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-m3-error-container text-m3-on-error-container text-label-sm border border-m3-error/20">
            <TriangleAlert className="h-3.5 w-3.5" /> Alergia: Penicilina
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-m3-surface-container-high text-m3-on-surface-variant text-label-sm border border-m3-outline-variant">
            <Droplets className="h-3.5 w-3.5" /> O Positivo
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 shrink-0">
        <Button className="gap-2 text-label-md bg-m3-primary text-m3-on-primary hover:bg-m3-primary-container hover:text-m3-on-primary-container shadow-sm">
          <Pencil className="h-4 w-4" /> Editar Perfil
        </Button>
      </div>
    </section>
  );
}

// ── Tab Navigation ──

const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'timeline', label: 'Timeline Clínica', icon: <History className="h-5 w-5" /> },
  { key: 'sinais', label: 'Sinais Vitais', icon: <Activity className="h-5 w-5" /> },
  { key: 'aga', label: 'Avaliações (AGA)', icon: <ClipboardList className="h-5 w-5" /> },
  { key: 'anexos', label: 'Anexos', icon: <Paperclip className="h-5 w-5" /> },
];

// ── Tab Content: Timeline ──

function TimelineTab() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-title-lg text-m3-on-surface">Evolução Clínica Recente</h2>

      <div className="relative pl-6 border-l-2 border-m3-surface-variant ml-4">
        {mockTimeline.map((event, idx) => {
          const meta = typeMeta[event.type];
          const isLast = idx === mockTimeline.length - 1;

          return (
            <div key={event.id} className={`relative ${isLast ? '' : 'mb-8'}`}>
              {/* Timeline dot */}
              <div
                className={`absolute -left-[31px] ${meta.bgClass} ${meta.colorClass} rounded-full p-1 border-4 border-m3-background w-8 h-8 flex items-center justify-center`}
              >
                {meta.icon}
              </div>

              {/* Card */}
              <div className="bg-m3-surface border border-m3-outline-variant rounded-m3-xl p-gutter shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-headline-md text-m3-on-surface">{event.title}</h3>
                  <span className="text-label-sm text-m3-secondary shrink-0 ml-4">
                    {event.date}{event.time ? `, ${event.time}` : ''}
                  </span>
                </div>

                {event.description && (
                  <p className="text-body-md text-m3-on-surface-variant mb-4">{event.description}</p>
                )}

                {/* Lab results */}
                {isLabEvent(event) && event.results.length > 0 && (
                  <div className="bg-m3-surface-container-low border border-m3-outline-variant rounded-m3-lg p-4 mb-4">
                    <div className="grid grid-cols-2 gap-y-2 text-body-md">
                      {event.results.map((r) => (
                        <div key={r.label} className="flex justify-between border-b border-m3-surface-variant/50 pb-1">
                          <span className="text-m3-on-surface-variant">{r.label}</span>
                          <span className="font-medium text-m3-on-surface tabular-nums">{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 text-label-sm text-m3-secondary">
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {event.author}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab Content Placeholders ──

function SinaisVitaisTab() {
  return (
    <div className="bg-m3-surface border border-m3-outline-variant rounded-m3-xl p-gutter">
      <h2 className="text-title-lg text-m3-on-surface mb-4">Sinais Vitais</h2>
      <p className="text-body-md text-m3-secondary">Registros de sinais vitais serão exibidos aqui.</p>
    </div>
  );
}

function AnexosTab() {
  return (
    <div className="bg-m3-surface border border-m3-outline-variant rounded-m3-xl p-gutter">
      <h2 className="text-title-lg text-m3-on-surface mb-4">Anexos</h2>
      <p className="text-body-md text-m3-secondary">Documentos e arquivos anexados ao prontuário.</p>
    </div>
  );
}

// ── Page ──

export default function ProntuarioPage() {
  const params = useParams<{ id: string }>();
  const { role } = useDevRole();
  const [activeTab, setActiveTab] = useState<TabKey>('timeline');

  return (
    <div className="flex flex-col gap-section-gap">
      {/* Patient Header */}
      <PatientHeaderCard />

      {/* Tab Bar */}
      <div className="flex border-b border-m3-outline-variant bg-m3-surface-container-lowest rounded-m3-xl overflow-hidden">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-label-md transition-colors ${
                isActive
                  ? 'text-m3-on-surface border-b-2 border-m3-primary font-semibold -mb-px'
                  : 'text-m3-secondary hover:text-m3-on-surface border-b-2 border-transparent'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'timeline' && <TimelineTab />}
        {activeTab === 'sinais' && <SinaisVitaisTab />}
        {activeTab === 'aga' && <AgaTab />}
        {activeTab === 'anexos' && <AnexosTab />}
      </div>
    </div>
  );
}

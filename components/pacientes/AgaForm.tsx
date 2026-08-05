'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, Apple, Brain, ClipboardCheck, Heart, Scale, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  GDS15_ITEMS,
  KATZ_ITEMS,
  LAWTON_ITEMS,
  MAN_ANTHROPOMETRY,
  MAN_BASE_ITEMS,
  MEEM_ITEMS,
  calcularAgaScores,
  createEmptyAgaDraft,
  draftToAgaAnswers,
  type AgaDraft,
  type ManSource,
} from '@/lib/validations/aga-form';
import { classificarGrauDependenciaRdc502, interpretarEscala } from '@/lib/validations/escalas';
import type { Rdc502Autocuidado, Rdc502Cognicao } from '@/lib/validations/escalas';

type AgaFormProps = {
  pacienteId: string;
  onCancelAction: () => void;
  createAction: (input: {
    pacienteId: string;
    dataAvaliacao?: Date;
    respostas: NonNullable<ReturnType<typeof draftToAgaAnswers>>;
    observacoes?: string;
  }) => void;
  isPending: boolean;
  errorMessage?: string;
};

const sectionClass = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm';
const optionClass = (selected: boolean) =>
  `flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
    selected
      ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-500'
      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
  }`;

function OptionButton({
  name,
  value,
  selected,
  label,
  onSelect,
}: {
  name: string;
  value: string;
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <label className={optionClass(selected)}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={onSelect}
        className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600"
      />
      <span className="text-sm leading-relaxed text-slate-700">{label}</span>
    </label>
  );
}

function SectionHeader({
  title,
  description,
  score,
  max,
  icon: Icon,
}: {
  title: string;
  description: string;
  score?: number;
  max?: number;
  icon: typeof Brain;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
        </div>
      </div>
      {score !== undefined && max !== undefined && (
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-700">
          {score}/{max}
        </span>
      )}
    </div>
  );
}

function KatzSection({ draft, setDraft }: { draft: AgaDraft; setDraft: (value: AgaDraft) => void }) {
  const score = KATZ_ITEMS.reduce((total, item) => {
    const selected = item.options.find((option) => option.value === draft.katz[item.key]);
    return total + (selected?.score ?? 0);
  }, 0);

  return (
    <section className={sectionClass}>
      <SectionHeader title="Katz" description="Atividades básicas de vida diária. O escore é o número de dependências: 0 independente, 6 dependente em todas." score={score} max={6} icon={Scale} />
      <div className="space-y-5">
        {KATZ_ITEMS.map((item) => (
          <fieldset key={item.key}>
            <legend className="text-sm font-medium text-slate-800">{item.label}</legend>
            <p className="mt-1 text-xs text-slate-500">{item.instruction}</p>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              {item.options.map((option) => (
                <OptionButton
                  key={option.value}
                  name={`katz-${item.key}`}
                  value={option.value}
                  selected={draft.katz[item.key] === option.value}
                  label={option.label}
                  onSelect={() => setDraft({ ...draft, katz: { ...draft.katz, [item.key]: option.value } })}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </section>
  );
}

function LawtonSection({ draft, setDraft }: { draft: AgaDraft; setDraft: (value: AgaDraft) => void }) {
  const score = LAWTON_ITEMS.reduce((total, item) => {
    const selected = item.options.find((option) => option.value === draft.lawton[item.key]);
    return total + (selected?.score ?? 0);
  }, 0);

  return (
    <section className={sectionClass}>
      <SectionHeader title="Lawton-Brody" description="Atividades instrumentais de vida diária. Selecione a descrição que representa o maior nível funcional observado." score={score} max={8} icon={ClipboardCheck} />
      <div className="space-y-5">
        {LAWTON_ITEMS.map((item) => (
          <fieldset key={item.key}>
            <legend className="text-sm font-medium text-slate-800">{item.label}</legend>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {item.options.map((option) => (
                <OptionButton
                  key={option.value}
                  name={`lawton-${item.key}`}
                  value={option.value}
                  selected={draft.lawton[item.key] === option.value}
                  label={option.label}
                  onSelect={() => setDraft({ ...draft, lawton: { ...draft.lawton, [item.key]: option.value } })}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </section>
  );
}

function MeemSection({ draft, setDraft }: { draft: AgaDraft; setDraft: (value: AgaDraft) => void }) {
  const score = MEEM_ITEMS.reduce((total, item) => total + (draft.meem[item.key] ?? 0), 0);
  return (
    <section className={sectionClass}>
      <SectionHeader title="MEEM" description="Mini-Exame do Estado Mental. Registre o desempenho de cada domínio conforme o protocolo de aplicação." score={score} max={30} icon={Brain} />
      <label className="mb-4 block text-sm font-medium text-slate-700">
        Anos completos de escolaridade
        <Input
          type="number"
          min={0}
          max={99}
          value={draft.meem.escolaridadeAnos}
          onChange={(event) => setDraft({ ...draft, meem: { ...draft.meem, escolaridadeAnos: event.target.value } })}
          className="mt-1 max-w-40"
        />
      </label>
      <div className="space-y-3">
        {MEEM_ITEMS.map((item) => (
          <fieldset key={item.key} className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-sm font-medium text-slate-800">{item.label}</legend>
            <p className="mt-1 text-xs text-slate-500">{item.instruction}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {item.options.map((option) => (
                <OptionButton
                  key={option.value}
                  name={`meem-${item.key}`}
                  value={String(option.value)}
                  selected={draft.meem[item.key] === option.value}
                  label={option.label}
                  onSelect={() => setDraft({ ...draft, meem: { ...draft.meem, [item.key]: option.value } })}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </section>
  );
}

function GdsSection({ draft, setDraft }: { draft: AgaDraft; setDraft: (value: AgaDraft) => void }) {
  const score = GDS15_ITEMS.reduce((total, item) => total + (draft.gds15[item.key] === item.scoreFor ? 1 : 0), 0);
  return (
    <section className={sectionClass}>
      <SectionHeader title="GDS-15" description="Responda com base em como a pessoa idosa tem se sentido. Um ponto é atribuído às respostas indicadas no instrumento." score={score} max={15} icon={Heart} />
      <div className="space-y-2">
        {GDS15_ITEMS.map((item, index) => (
          <fieldset key={item.key} className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-[1fr_auto] md:items-center">
            <legend className="sr-only">Pergunta {index + 1}</legend>
            <p className="text-sm text-slate-700">{index + 1}. {item.question}</p>
            <div className="flex gap-2">
              {(['sim', 'nao'] as const).map((value) => (
                <OptionButton
                  key={value}
                  name={`gds15-${item.key}`}
                  value={value}
                  selected={draft.gds15[item.key] === value}
                  label={value === 'sim' ? 'Sim' : 'Não'}
                  onSelect={() => setDraft({ ...draft, gds15: { ...draft.gds15, [item.key]: value } })}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </section>
  );
}

function ManSection({ draft, setDraft }: { draft: AgaDraft; setDraft: (value: AgaDraft) => void }) {
  const score = MAN_BASE_ITEMS.reduce((total, item) => total + Number(draft.man[item.key] ?? 0), 0) + Number(draft.man[draft.man.fonteAntropometrica] ?? 0);
  const anthropometry = MAN_ANTHROPOMETRY[draft.man.fonteAntropometrica];
  const setMan = (key: string, value: number | ManSource) => setDraft({ ...draft, man: { ...draft.man, [key]: value } });

  return (
    <section className={sectionClass}>
      <SectionHeader title="MAN" description="Mini Avaliação Nutricional, versão reduzida. Pontuação máxima de 14 pontos." score={score} max={14} icon={Apple} />
      <div className="space-y-4">
        {MAN_BASE_ITEMS.map((item) => (
          <fieldset key={item.key}>
            <legend className="text-sm font-medium text-slate-800">{item.label}</legend>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              {item.options.map((option) => (
                <OptionButton
                  key={option.value}
                  name={`man-${item.key}`}
                  value={String(option.value)}
                  selected={draft.man[item.key] === option.value}
                  label={`${option.label} (${option.value} ponto${option.value === 1 ? '' : 's'})`}
                  onSelect={() => setMan(item.key, option.value)}
                />
              ))}
            </div>
          </fieldset>
        ))}
        <fieldset>
          <legend className="text-sm font-medium text-slate-800">Medida antropométrica</legend>
          <div className="mt-2 flex gap-2">
            {(['imc', 'panturrilha'] as const).map((value) => (
              <OptionButton
                key={value}
                name="man-fonte"
                value={value}
                selected={draft.man.fonteAntropometrica === value}
                label={value === 'imc' ? 'Usar IMC' : 'Usar circunferência da panturrilha'}
                onSelect={() => setMan('fonteAntropometrica', value)}
              />
            ))}
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {anthropometry.options.map((option) => (
              <OptionButton
                key={option.value}
                name={`man-${draft.man.fonteAntropometrica}`}
                value={String(option.value)}
                selected={draft.man[draft.man.fonteAntropometrica] === option.value}
                label={`${option.label} (${option.value} ponto${option.value === 1 ? '' : 's'})`}
                onSelect={() => setMan(draft.man.fonteAntropometrica, option.value)}
              />
            ))}
          </div>
        </fieldset>
      </div>
    </section>
  );
}

function RdcSection({ draft, setDraft }: { draft: AgaDraft; setDraft: (value: AgaDraft) => void }) {
  const autocuidado = draft.rdc502.autocuidado as Rdc502Autocuidado | undefined;
  const cognicao = draft.rdc502.cognicao as Rdc502Cognicao | undefined;
  const classification = classificarGrauDependenciaRdc502(autocuidado, cognicao);
  const choices = {
    autocuidado: [
      ['nenhuma', 'Independente nas atividades de autocuidado'],
      ['ate_tres', 'Dependente em até três atividades de autocuidado'],
      ['todas', 'Dependente em todas as atividades de autocuidado'],
    ],
    cognicao: [
      ['sem_comprometimento', 'Sem comprometimento cognitivo'],
      ['alteracao_controlada', 'Alteração cognitiva controlada'],
      ['comprometimento', 'Comprometimento cognitivo'],
    ],
  } as const;

  return (
    <section className={sectionClass}>
      <SectionHeader title="Classificação RDC Anvisa 502/2021" description="Aplicável à classificação de dependência em ILPI. Não substitui a interpretação individual das escalas Katz e Lawton." icon={ClipboardCheck} />
      <div className="grid gap-5 md:grid-cols-2">
        {(['autocuidado', 'cognicao'] as const).map((key) => (
          <fieldset key={key}>
            <legend className="text-sm font-medium text-slate-800">{key === 'autocuidado' ? 'Autocuidado' : 'Cognição'}</legend>
            <div className="mt-2 space-y-2">
              {choices[key].map(([value, label]) => (
                <OptionButton
                  key={value}
                  name={`rdc502-${key}`}
                  value={value}
                  selected={draft.rdc502[key] === value}
                  label={label}
                  onSelect={() => setDraft({ ...draft, rdc502: { ...draft.rdc502, [key]: value } })}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <div className={`mt-4 rounded-lg border p-4 ${classification ? 'border-teal-200 bg-teal-50 text-teal-900' : 'border-slate-200 bg-slate-50 text-slate-600'}`} aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-wide">Classificação atual</p>
        <p className="mt-1 text-lg font-semibold">{classification?.label ?? 'Selecione autocuidado e cognição'}</p>
        <p className="mt-1 text-xs">{classification?.fundamento ?? 'A classificação será calculada quando os dois campos forem preenchidos.'}</p>
      </div>
    </section>
  );
}

function TugSection({ draft, setDraft }: { draft: AgaDraft; setDraft: (value: AgaDraft) => void }) {
  const value = draft.tug.segundos === '' ? undefined : Number(draft.tug.segundos);
  const interpretation = interpretarEscala('tug', value);
  return (
    <section className={sectionClass}>
      <SectionHeader title="TUG" description="Timed Up and Go. Cronometre o tempo para levantar, caminhar três metros, retornar e sentar-se." score={value} max={300} icon={Timer} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-slate-700">
          Tempo em segundos
          <Input type="number" min={0} max={300} value={draft.tug.segundos} onChange={(event) => setDraft({ ...draft, tug: { segundos: event.target.value } })} className="mt-1 w-32" />
        </label>
        {interpretation && <span className="mb-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">{interpretation}</span>}
      </div>
    </section>
  );
}

export function AgaForm({
  pacienteId,
  onCancelAction,
  createAction,
  isPending,
  errorMessage,
}: AgaFormProps) {
  const [draft, setDraft] = useState<AgaDraft>(() => createEmptyAgaDraft());
  const [dataAvaliacao, setDataAvaliacao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  const answers = useMemo(() => draftToAgaAnswers(draft), [draft]);
  const scores = answers ? calcularAgaScores(answers) : null;

  const handleSubmit = () => {
    if (!answers) {
      setValidationMessage('Preencha uma opção em todas as perguntas antes de salvar a AGA.');
      return;
    }
    setValidationMessage('');
    createAction({
      pacienteId,
      dataAvaliacao: dataAvaliacao ? new Date(`${dataAvaliacao}T12:00:00`) : undefined,
      respostas: answers,
      observacoes: observacoes.trim() || undefined,
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
        <p className="font-semibold">Preenchimento da AGA</p>
        <p className="mt-1 text-xs leading-relaxed">Selecione a alternativa que melhor representa o desempenho observado. Os escores são calculados automaticamente e as respostas ficam registradas junto à avaliação.</p>
      </div>
      <RdcSection draft={draft} setDraft={setDraft} />
      <KatzSection draft={draft} setDraft={setDraft} />
      <LawtonSection draft={draft} setDraft={setDraft} />
      <MeemSection draft={draft} setDraft={setDraft} />
      <GdsSection draft={draft} setDraft={setDraft} />
      <ManSection draft={draft} setDraft={setDraft} />
      <TugSection draft={draft} setDraft={setDraft} />
      <section className={sectionClass}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Data da avaliação
            <Input type="date" value={dataAvaliacao} onChange={(event) => setDataAvaliacao(event.target.value)} className="mt-1" />
          </label>
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            {scores ? <><span className="font-semibold text-slate-800">Resumo calculado:</span> Katz {scores.katzScore}/6, Lawton {scores.lawtonScore}/8, MEEM {scores.meemScore}/30, GDS-15 {scores.gds15Score}/15, MAN {scores.manScore}/14, TUG {scores.tugSegundos}s.</> : 'O resumo aparecerá após todas as escalas serem preenchidas.'}
          </div>
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Observações clínicas
          <textarea value={observacoes} onChange={(event) => setObservacoes(event.target.value)} rows={4} className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" placeholder="Contexto clínico, evolução e condições observadas." />
        </label>
      </section>
      {(validationMessage || errorMessage) && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage || validationMessage}</span>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancelAction} disabled={isPending}>Cancelar</Button>
        <Button type="button" onClick={handleSubmit} disabled={isPending} className="bg-teal-600 text-white hover:bg-teal-700">{isPending ? 'Salvando...' : 'Salvar avaliação'}</Button>
      </div>
    </div>
  );
}



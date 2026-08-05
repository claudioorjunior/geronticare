'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useUserRole } from '@/lib/auth/use-user-role';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Activity, Heart, Calendar, Thermometer, User, Loader2, AlertCircle, CheckCircle2, ClipboardList, ChevronRight, FileText, BarChart3 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import {
  atualizarPacienteSchema,
  traduzirErroTRPC,
  toDateInput,
  mascaraCPF,
} from '@/lib/validations/pacientes';
import type { RouterOutputs } from '@/lib/trpc/types';
import { podeAcessarClinico, podeLerClinico } from '@/lib/trpc/autorizacao';
import { formatarData } from '@/lib/utils';
import { getInstrumentDefinition } from '@/lib/instrumentos/instrumentos';
import {
  montarRelatorioAga,
  type AgaDetail,
} from '@/lib/relatorios/aga-relatorio';

type PacienteDetails = RouterOutputs['pacientes']['buscar'];

function Kpi({ icon: Icon, label, value, unit }: { icon: typeof Activity; label: string; value: string; unit: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
        {value} <span className="text-base font-normal text-slate-400">{unit}</span>
      </div>
    </div>
  );
}

export default function PatientDadosPage() {
  const params = useParams<{ id: string }>();
  const { role } = useUserRole();
  const canViewClinical = podeLerClinico(role);
  const canEditClinical = podeAcessarClinico(role);
  const pacienteQ = trpc.pacientes.buscar.useQuery(
    { id: params.id },
    { enabled: Boolean(params.id) },
  );

  // Último sinal vital registrado para o paciente
  const { data: ultimoSV } = trpc.sinaisVitais.ultimo.useQuery(
    { pacienteId: params.id },
    { enabled: !!params.id && canViewClinical },
  );

  const [agora] = useState(() => Date.now());

  // Última AGA concluída do modelo novo (consolidação de aplicações).
  const agasQuery = trpc.agas.listar.useQuery(
    { pacienteId: params.id },
    { enabled: Boolean(params.id) && canViewClinical },
  );
  const ultimaConcluidaId = (agasQuery.data ?? []).find(
    (aga) => aga.status === 'concluida',
  )?.id;
  const agaDetalheQuery = trpc.agas.buscar.useQuery(
    { pacienteId: params.id, agaId: ultimaConcluidaId! },
    { enabled: Boolean(params.id && ultimaConcluidaId) && canViewClinical },
  );

  if (pacienteQ.isError) {
    return (
      <div className="py-12 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-amber-500 mb-3" />
        <p className="text-sm font-medium text-slate-700">Não foi possível carregar o paciente</p>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          {pacienteQ.error?.message ?? 'Verifique autenticação e conexão.'}
        </p>
      </div>
    );
  }

  if (pacienteQ.isPending || !pacienteQ.data) {
    return (
      <div className="py-12 text-center" aria-live="polite">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-teal-600 mb-3" />
        <p className="text-sm text-slate-500">Carregando paciente...</p>
      </div>
    );
  }

  const paciente = pacienteQ.data;

  const adm = new Date(paciente.dataAdmissao);
  const diasInternado = Number.isNaN(adm.getTime()) ? null : Math.max(0, Math.floor((agora - adm.getTime()) / 86400000));

  // Build KPIs from real vital signs data; fallback to '—' when null
  const kpis = [
    {
      icon: Heart,
      label: 'FC',
      value: ultimoSV?.frequenciaCardiaca?.toString() ?? '—',
      unit: 'bpm',
    },
    {
      icon: Activity,
      label: 'PA',
      value:
        ultimoSV?.pressaoArterialSistolica != null &&
        ultimoSV?.pressaoArterialDiastolica != null
          ? `${ultimoSV.pressaoArterialSistolica}/${ultimoSV.pressaoArterialDiastolica}`
          : '—',
      unit: 'mmHg',
    },
    {
      icon: Activity,
      label: 'SpO2',
      value: ultimoSV?.saturacaoO2?.toString() ?? '—',
      unit: '%',
    },
    {
      icon: Thermometer,
      label: 'Temp',
      value: ultimoSV?.temperatura != null ? (ultimoSV.temperatura / 10).toFixed(1) : '—',
      unit: '°C',
    },
    {
      icon: Calendar,
      label: 'Internado',
      value: diasInternado?.toString() ?? '—',
      unit: 'dias',
    },
  ];

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <Kpi key={kpi.label} icon={kpi.icon} label={kpi.label} value={kpi.value} unit={kpi.unit} />
        ))}
      </div>

      {/* ── Resumo Clínico AGA ── */}
      <AGASummaryCard
        pacienteId={params.id}
        aga={agaDetalheQuery.data}
        isLoading={
          agasQuery.isPending ||
          (ultimaConcluidaId ? agaDetalheQuery.isPending : false)
        }
        isError={agasQuery.isError || agaDetalheQuery.isError}
        canViewClinical={canViewClinical}
        canEditClinical={canEditClinical}
      />

      {/* ── Quick-links para seções clínicas ── */}
      <div className="mb-6 flex flex-wrap gap-3">
        {[
          { href: `/pacientes/${params.id}/aga`, icon: ClipboardList, label: 'AGA' },
          { href: `/pacientes/${params.id}/avaliacoes`, icon: FileText, label: 'Avaliações' },
          { href: `/pacientes/${params.id}/registros`, icon: BarChart3, label: 'Registros' },
          { href: `/pacientes/${params.id}/sinais`, icon: Activity, label: 'Sinais Vitais' },
        ].map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-teal-700"
          >
            <link.icon className="h-4 w-4 text-slate-400" />
            {link.label}
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          </Link>
        ))}
      </div>

      {/* Keyed pelo id para recriar estado do form na navegação entre pacientes */}
      <EditForm key={paciente.id} paciente={paciente} canEditClinical={canEditClinical} />
    </>
  );
}

// ── EditForm ──
// Componente-filho com estado local de edição. Keyed pelo id do paciente no pai,
// então recria estado do zero quando navega para outro paciente — sem useEffect.

function EditForm({ paciente, canEditClinical: canEditClinicalProp }: { paciente: PacienteDetails; canEditClinical: boolean }) {
  const { role } = useUserRole();
  const utils = trpc.useUtils();
  const params = useParams<{ id: string }>();
  const canEditClinical = canEditClinicalProp;
  const canEditStatus = role === 'admin';

  const [form, setForm] = useState(() => ({
    cpf: paciente.cpf ?? '',
    telefone: paciente.telefone ?? '',
    email: paciente.email ?? '',
    dataAdmissao: toDateInput(paciente.dataAdmissao),
    contatoEmergencia: {
      nome: paciente.contatoEmergencia?.nome ?? '',
      parentesco: paciente.contatoEmergencia?.parentesco ?? '',
      telefone: paciente.contatoEmergencia?.telefone ?? '',
    },
    ativo: paciente.ativo,
  }));
  const [dirty, setDirty] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const atualizar = trpc.pacientes.atualizar.useMutation({
    onSuccess: () => {
      utils.pacientes.buscar.invalidate({ id: params.id });
      utils.pacientes.listar.invalidate();
      setMensagem({ tipo: 'ok', texto: 'Dados salvos com sucesso.' });
      window.setTimeout(() => setMensagem(null), 2500);
    },
    onError: (err) => {
      const code = (err.data?.code ?? err.shape?.data?.code) as string | undefined;
      setMensagem({ tipo: 'erro', texto: traduzirErroTRPC(code, err.message) });
    },
  });

  const setCampo = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setMensagem(null);
  };

  const setEmerg = (key: keyof typeof form.contatoEmergencia, value: string) => {
    setForm((prev) => ({ ...prev, contatoEmergencia: { ...prev.contatoEmergencia, [key]: value } }));
    setDirty(true);
    setMensagem(null);
  };

  const toggleAtivo = () => canEditStatus && setCampo('ativo', !form.ativo);

  const handleSave = async () => {
    if (!canEditClinical) return;

    const contato =
      form.contatoEmergencia.nome.trim() ||
      form.contatoEmergencia.parentesco.trim() ||
      form.contatoEmergencia.telefone.trim()
        ? {
            nome: form.contatoEmergencia.nome.trim(),
            parentesco: form.contatoEmergencia.parentesco.trim(),
            telefone: form.contatoEmergencia.telefone.trim(),
          }
        : undefined;

    const payload = {
      id: params.id,
      cpf: form.cpf.trim() || undefined,
      telefone: form.telefone.trim() || undefined,
      email: form.email.trim() || undefined,
      dataAdmissao: form.dataAdmissao || undefined,
      contatoEmergencia: contato,
      ativo: form.ativo,
    };

    const resultado = atualizarPacienteSchema.safeParse(payload);
    if (!resultado.success) {
      const primeiro = resultado.error.issues[0];
      setMensagem({ tipo: 'erro', texto: primeiro?.message ?? 'Revise os campos' });
      return;
    }

    atualizar.mutate(resultado.data);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <section className="space-y-5 lg:col-span-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-m3-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Identificação</h3>
            <span className="text-xs text-slate-400">{paciente.sexo === 'masculino' ? 'M' : paciente.sexo === 'feminino' ? 'F' : '—'}</span>
          </div>
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
            <Field id="pt-nome" htmlFor="pt-nome" label="Nome completo" value={paciente.nome} disabled />
            <Field id="pt-cpf" htmlFor="pt-cpf" label="CPF" value={mascaraCPF(form.cpf) || '—'} disabled hint="CPF não é editável após admissão" />
            <Field id="pt-nascimento" htmlFor="pt-nascimento" label="Data de nascimento" type="date" value={toDateInput(paciente.dataNascimento)} disabled />
            <Field id="pt-telefone" htmlFor="pt-telefone" label="Telefone" type="tel" inputMode="tel" value={form.telefone} disabled={!canEditClinical} hint={canEditClinical ? undefined : 'Apenas profissionais podem alterar'} onChange={(e) => setCampo('telefone', e.target.value)} />
            <Field id="pt-email" htmlFor="pt-email" label="E-mail" type="email" inputMode="email" value={form.email} disabled={!canEditClinical} hint={canEditClinical ? undefined : 'Apenas profissionais podem alterar'} onChange={(e) => setCampo('email', e.target.value)} />
            <Field
              id="pt-admissao" htmlFor="pt-admissao" label="Data de admissão" type="date"
              value={form.dataAdmissao} disabled={!canEditClinical}
              hint={canEditClinical ? undefined : 'Apenas profissionais podem alterar'}
              onChange={(e) => setCampo('dataAdmissao', e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-m3-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Status do paciente</span>
            <div className="flex items-center gap-3">
              <Button
                variant={form.ativo ? 'default' : 'secondary'}
                size="sm"
                onClick={toggleAtivo}
                disabled={!canEditStatus}
                className={form.ativo ? 'bg-teal-600 text-white hover:bg-teal-700' : ''}
              >
                {form.ativo ? 'Ativo' : 'Inativo'}
              </Button>
              {!canEditStatus && <span className="text-xs text-slate-400">Somente administrador</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={atualizar.isPending || !canEditClinical || !dirty}
            className="gap-2 bg-teal-600 text-white hover:bg-teal-700"
          >
            {atualizar.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
            ) : (
              'Salvar alterações'
            )}
          </Button>
          {mensagem?.tipo === 'ok' && (
            <span role="status" aria-live="polite" className="flex items-center gap-1 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> {mensagem.texto}
            </span>
          )}
          {mensagem?.tipo === 'erro' && (
            <span role="alert" aria-live="assertive" className="flex items-center gap-1 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" /> {mensagem.texto}
            </span>
          )}
          <span className="ml-auto text-xs text-slate-400">ID: {params.id?.slice(0, 8) ?? '—'}</span>
        </div>

        {!canEditClinical && (
          <p className="text-xs text-slate-400">Usuários (não profissionais) podem visualizar, mas não editar dados clínicos.</p>
        )}
      </section>

      <aside className="space-y-5">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100">
              <User className="h-3.5 w-3.5 text-teal-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Contato de emergência</h3>
          </div>
          <div className="space-y-3">
            <Field id="pt-emerg-nome" htmlFor="pt-emerg-nome" label="Nome" value={form.contatoEmergencia.nome} disabled={!canEditClinical} onChange={(e) => setEmerg('nome', e.target.value)} />
            <Field id="pt-emerg-parentesco" htmlFor="pt-emerg-parentesco" label="Parentesco" value={form.contatoEmergencia.parentesco} disabled={!canEditClinical} onChange={(e) => setEmerg('parentesco', e.target.value)} />
            <Field id="pt-emerg-tel" htmlFor="pt-emerg-tel" label="Telefone" type="tel" inputMode="tel" value={form.contatoEmergencia.telefone} disabled={!canEditClinical} onChange={(e) => setEmerg('telefone', e.target.value)} />
          </div>
        </div>
      </aside>
    </div>
  );
}

// ── AGA scale helpers ──

const toneForScale = (key: string, score: number | null | undefined): 'ok' | 'warn' | 'risk' => {
  if (score == null) return 'ok';
  switch (key) {
    case 'katz': return score === 0 ? 'ok' : score === 6 ? 'risk' : 'warn';
    case 'lawton': return score === 8 ? 'ok' : score === 0 ? 'risk' : 'warn';
    case 'meem': return score >= 24 ? 'ok' : score >= 18 ? 'warn' : 'risk';
    case 'gds15': return score >= 10 ? 'risk' : score >= 6 ? 'warn' : 'ok';
    case 'man': return score < 8 ? 'risk' : score < 12 ? 'warn' : 'ok';
    case 'tug': return score >= 20 ? 'risk' : score >= 10 ? 'warn' : 'ok';
    default: return 'ok';
  }
};

const toneBgClass: Record<string, string> = {
  ok: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  warn: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  risk: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  muted: 'bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200',
};

const toneForRdc = (label: string | null | undefined): 'ok' | 'warn' | 'risk' | 'muted' => {
  if (!label) return 'muted';
  if (label.includes('I') && !label.includes('II') && !label.includes('III')) return 'ok';
  if (label.includes('III')) return 'risk';
  if (label.includes('II')) return 'warn';
  return 'muted';
};

// ── AGASummaryCard ──
// Resumo clínico da última AGA concluída (modelo novo), exibido no primeiro
// acesso ao paciente. Estados: loading, erro, ausência (com CTA) e dados
// preenchidos. Fonte: agas.buscar (snapshot de aplicações).

function AGASummaryCard({
  pacienteId,
  aga,
  isLoading,
  isError,
  canViewClinical,
  canEditClinical,
}: {
  pacienteId: string;
  aga: AgaDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  canViewClinical: boolean;
  canEditClinical: boolean;
}) {
  if (!canViewClinical) {
    return (
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-900">Resumo Clínico da AGA</h3>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Informações clínicas disponíveis apenas para profissionais.
        </p>
      </div>
    );
  }

  const canEdit = canEditClinical;

  if (isLoading) {
    return (
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Carregando AGA...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Erro ao carregar AGA</span>
        </div>
        <p className="mt-1 text-xs text-red-500">Não foi possível carregar o resumo clínico.</p>
      </div>
    );
  }

  if (!aga) {
    return (
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-900">Resumo Clínico — AGA</h3>
          </div>
          {canEdit && (
            <Link
              href={`/pacientes/${pacienteId}/aga`}
              className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors"
            >
              Iniciar AGA
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Nenhuma Avaliação Geriátrica Ampla concluída para este paciente.
        </p>
        {!canEdit && (
          <p className="mt-1 text-xs text-slate-400">
            Apenas profissionais podem realizar AGAs.
          </p>
        )}
      </div>
    );
  }

  const report = montarRelatorioAga(aga);
  const rdcTone = toneForRdc(aga.classificacao);

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-teal-600" />
          <h3 className="text-sm font-semibold text-slate-900">Resumo Clínico — AGA</h3>
          {aga.classificacao && (
            <span
              className={`rounded-full px-2 py-1 text-[11px] font-semibold ${toneBgClass[rdcTone]}`}
            >
              {aga.classificacao}
            </span>
          )}
        </div>
        <time className="text-xs text-slate-400">
          {formatarData(report.dataAvaliacao)}
        </time>
      </div>

      {report.profissional && (
        <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
          <User className="h-3.5 w-3.5" />
          <span>{report.profissional}</span>
          {report.especialidade && <span className="text-slate-400">· {report.especialidade}</span>}
          <Link
            href={`/pacientes/${pacienteId}/aga`}
            className="ml-auto inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 font-medium transition-colors"
          >
            Ver avaliação completa
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {report.escalas.map((escala) => {
          const def = getInstrumentDefinition(escala.key);
          const unit = escala.unit === 'segundos' ? 's' : undefined;
          const tone = toneForScale(escala.key, escala.score);
          return (
            <div key={escala.key} className={`rounded-lg border p-3 text-center ${toneBgClass[tone]}`}>
              <div className="text-[11px] font-medium tracking-wider uppercase">{def.nomeCurto}</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {escala.score ?? '—'}
                {unit ? (
                  <span className="text-xs font-normal opacity-60">{unit}</span>
                ) : (
                  <span className="text-xs font-normal opacity-60">/{escala.max}</span>
                )}
              </div>
              {escala.interpretation && (
                <div className="mt-1 text-[10px] leading-tight opacity-80">{escala.interpretation}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

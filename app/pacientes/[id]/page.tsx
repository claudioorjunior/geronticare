'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useDevRole } from '@/lib/dev/use-dev-role';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Activity, Heart, Calendar, User, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import {
  atualizarPacienteSchema,
  traduzirErroTRPC,
  toDateInput,
  mascaraCPF,
} from '@/lib/validations/pacientes';
import type { Paciente } from '@/lib/db/schema';

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
  const pacienteQ = trpc.pacientes.buscar.useQuery(
    { id: params.id },
    { enabled: Boolean(params.id) },
  );

  // Último sinal vital registrado para o paciente
  const { data: ultimoSV } = trpc.sinaisVitais.ultimo.useQuery(
    { pacienteId: params.id },
    { enabled: !!params.id },
  );

  const [agora] = useState(() => Date.now());

  if (pacienteQ.isError) {
    const mensagem = pacienteQ.error?.data?.code === 'NOT_FOUND'
      ? 'Paciente não encontrado'
      : pacienteQ.error?.message ?? 'Verifique autenticação e conexão.';
    return (
      <div className="py-12 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-amber-500 mb-3" />
        <p className="text-sm font-medium text-slate-700">Não foi possível carregar o paciente</p>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          {mensagem}
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
  if (!paciente) {
    return (
      <div className="py-12 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-amber-500 mb-3" />
        <p className="text-sm font-medium text-slate-700">Paciente não encontrado</p>
      </div>
    );
  }
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
      icon: Calendar,
      label: 'Internado',
      value: diasInternado?.toString() ?? '—',
      unit: 'dias',
    },
    {
      icon: Clock,
      label: 'Atualizado',
      value: paciente.updatedAt
        ? new Date(paciente.updatedAt).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '—',
      unit: '',
    },
  ];

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <Kpi key={kpi.label} icon={kpi.icon} label={kpi.label} value={kpi.value} unit={kpi.unit} />
        ))}
      </div>

      {/* Keyed pelo id para recriar estado do form na navegação entre pacientes */}
      <EditForm key={paciente.id} paciente={paciente} />
    </>
  );
}

// ── EditForm ──
// Componente-filho com estado local de edição. Keyed pelo id do paciente no pai,
// então recria estado do zero quando navega para outro paciente — sem useEffect.

function EditForm({ paciente }: { paciente: Paciente }) {
  const { role } = useDevRole();
  const utils = trpc.useUtils();
  const params = useParams<{ id: string }>();
  const canEditClinical = role === 'admin' || role === 'profissional';
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
            <Field id="pt-telefone" htmlFor="pt-telefone" label="Telefone" type="tel" inputMode="tel" value={form.telefone} onChange={(e) => setCampo('telefone', e.target.value)} />
            <Field id="pt-email" htmlFor="pt-email" label="E-mail" type="email" inputMode="email" value={form.email} onChange={(e) => setCampo('email', e.target.value)} />
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
            <Field id="pt-emerg-nome" htmlFor="pt-emerg-nome" label="Nome" value={form.contatoEmergencia.nome} onChange={(e) => setEmerg('nome', e.target.value)} />
            <Field id="pt-emerg-parentesco" htmlFor="pt-emerg-parentesco" label="Parentesco" value={form.contatoEmergencia.parentesco} onChange={(e) => setEmerg('parentesco', e.target.value)} />
            <Field id="pt-emerg-tel" htmlFor="pt-emerg-tel" label="Telefone" type="tel" inputMode="tel" value={form.contatoEmergencia.telefone} onChange={(e) => setEmerg('telefone', e.target.value)} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Alergias</h3>
          <p className="text-xs text-slate-400">Nenhuma alergia registrada.</p>
        </div>
      </aside>
    </div>
  );
}

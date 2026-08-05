'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, X, UserPlus, MapPin, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, SelectField } from '@/components/ui/field';
import { trpc } from '@/lib/trpc/client';
import { useUserRole } from '@/lib/auth/use-user-role';
import {
  criarPacienteSchema,
  sexoOptions,
  estadoCivilOptions,
  traduzirErroTRPC,
  mascaraCPF,
  mascaraCEP,
  type CriarPacienteInput,
} from '@/lib/validations/pacientes';

// ── PatientForm ──
// Modal de criação de paciente. Conecta-se a trpc.pacientes.criar.
// Validação no cliente (zod) com erro por campo + aria-live.
// Em modo protótipo (DB offline) a mutation falha com UNAUTHORIZED/FORBIDDEN e
// mostramos mensagem clara em vez de quebrar.

type Section = 'identificacao' | 'contato' | 'emergencia' | 'endereco';

const sectionMeta: Record<
  Section,
  { titulo: string; descricao: string }
> = {
  identificacao: {
    titulo: 'Identificação',
    descricao: 'Dados essenciais do paciente',
  },
  contato: {
    titulo: 'Contato',
    descricao: 'Telefone e e-mail',
  },
  emergencia: {
    titulo: 'Contato de emergência',
    descricao: 'Em quem avisar',
  },
  endereco: {
    titulo: 'Endereço',
    descricao: 'Residência do paciente',
  },
};

const emptyForm: CriarPacienteInput = {
  nome: '',
  dataNascimento: '',
  cpf: '',
  rg: '',
  sexo: 'masculino' as const,
  estadoCivil: undefined,
  telefone: '',
  email: '',
  dataAdmissao: '',
};

const sexoLabels: Record<(typeof sexoOptions)[number], string> = {
  masculino: 'Masculino',
  feminino: 'Feminino',
  outro: 'Outro',
};

const estadoCivilLabels: Record<(typeof estadoCivilOptions)[number], string> = {
  solteiro: 'Solteiro(a)',
  casado: 'Casado(a)',
  viuvo: 'Viúvo(a)',
  divorciado: 'Divorciado(a)',
  uniao_estavel: 'União estável',
};

export function PatientForm({
  open,
  onCloseAction,
}: {
  open: boolean;
  onCloseAction: () => void;
}) {
  const router = useRouter();
  const { role } = useUserRole();
  const utils = trpc.useUtils();

  const [form, setForm] = React.useState<CriarPacienteInput>({
    ...emptyForm,
    contatoEmergencia: undefined,
    endereco: undefined,
  });
  const [errors, setErrors] = React.useState<
    Partial<Record<keyof CriarPacienteInput | string, string>>
  >({});
  const [submitMsg, setSubmitMsg] = React.useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(
    null,
  );

  const criar = trpc.pacientes.criar.useMutation({
    onSuccess: (paciente) => {
      utils.pacientes.listar.invalidate();
      setSubmitMsg(null);
      onCloseAction();
      reset();
      // Navega para o prontuário do paciente recém-criado
      if (paciente?.id) router.push(`/pacientes/${paciente.id}`);
    },
    onError: (err) => {
      // err.shape?.data.code vem do tRPC; fallback para err.data.code
      const code = (err.data?.code ?? err.shape?.data?.code) as string | undefined;
      setSubmitMsg({ tipo: 'erro', texto: traduzirErroTRPC(code, err.message) });
      // Foca o topo do modal para o erro ser anunciado
      dialogRef.current?.focus();
    },
  });

  const dialogRef = React.useRef<HTMLDivElement>(null);

  // Permissão: só admin e profissional criam (espelha canCreate da lista)
  const podeCriar = role === 'admin' || role === 'profissional';

  // ── Abertura/fechamento: scroll-lock + ESC + foco ──
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseAction();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onCloseAction]);

  function reset() {
    setForm({ ...emptyForm });
    setErrors({});
    setSubmitMsg(null);
  }

  // ── Handlers de campo ──
  const set = <K extends keyof CriarPacienteInput>(
    key: K,
    value: CriarPacienteInput[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Limpa erro do campo ao editar (inline-validation: erro some ao corrigir)
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const setAninhado = (
    grupo: 'contatoEmergencia' | 'endereco',
    key: string,
    value: string,
  ) => {
    setForm((prev) => {
      const atual = prev[grupo] ?? ({} as NonNullable<CriarPacienteInput[typeof grupo]>);
      return { ...prev, [grupo]: { ...atual, [key]: value } };
    });
    setErrors((prev) => {
      const fullKey = `${grupo}.${key}`;
      if (!prev[fullKey]) return prev;
      const next = { ...prev };
      delete next[fullKey];
      return next;
    });
  };

  function validar(): boolean {
    const result = criarPacienteSchema.safeParse(form);
    if (result.success) {
      setErrors({});
      return true;
    }
    const flat: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.');
      if (!flat[path]) flat[path] = issue.message;
    }
    setErrors(flat);
    // Foca o primeiro input com aria-invalid (focus-management WCAG)
    requestAnimationFrame(() => {
      const el = dialogRef.current?.querySelector<HTMLInputElement>(
        '[aria-invalid="true"]',
      );
      el?.focus();
    });
    return false;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeCriar) {
      setSubmitMsg({
        tipo: 'erro',
        texto: 'Apenas profissionais e admin podem cadastrar pacientes',
      });
      return;
    }
    setSubmitMsg(null);
    if (!validar()) return;

    // Normaliza antes de enviar: limpa strings e descarta campos vazios opcionais
    const payload = {
      nome: form.nome.trim(),
      dataNascimento: new Date(form.dataNascimento).toISOString(),
      cpf: form.cpf?.trim() ? form.cpf.trim() : undefined,
      rg: form.rg?.trim() || undefined,
      sexo: form.sexo,
      estadoCivil: form.estadoCivil,
      telefone: form.telefone?.trim() || undefined,
      email: form.email?.trim() || undefined,
      dataAdmissao: new Date(form.dataAdmissao).toISOString(),
      contatoEmergencia: form.contatoEmergencia?.nome
        ? {
            nome: form.contatoEmergencia.nome.trim(),
            parentesco: form.contatoEmergencia.parentesco?.trim() ?? '',
            telefone: form.contatoEmergencia.telefone?.trim() ?? '',
          }
        : undefined,
      endereco: form.endereco?.logradouro
        ? {
            logradouro: form.endereco.logradouro.trim(),
            numero: form.endereco.numero?.trim() ?? '',
            complemento: form.endereco.complemento?.trim() || undefined,
            bairro: form.endereco.bairro?.trim() ?? '',
            cidade: form.endereco.cidade?.trim() ?? '',
            estado: form.endereco.estado?.toUpperCase() ?? '',
            cep: form.endereco.cep?.replace(/\D/g, '') ?? '',
          }
        : undefined,
    };

    criar.mutate(payload);
  };

  if (!open) return null;

  const isLoading = criar.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="patient-form-title"
      onClick={onCloseAction}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl outline-none
          motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-200"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div>
            <h2 id="patient-form-title" className="text-lg font-semibold text-slate-900">
              Novo Paciente
            </h2>
            <p className="text-xs text-slate-500">Admissão de residente/paciente</p>
          </div>
          <button
            type="button"
            onClick={onCloseAction}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors focus-visible:ring-2 focus-visible:ring-teal-600/30"
            aria-label="Fechar formulário"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="px-6 py-5 space-y-7">
          {/* Mensagem de erro/sucesso global — aria-live para SR */}
          {submitMsg && (
            <div
              role="alert"
              aria-live="assertive"
              className={
                'flex items-start gap-2 rounded-lg px-4 py-3 text-sm ' +
                (submitMsg.tipo === 'erro'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200')
              }
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{submitMsg.texto}</span>
            </div>
          )}

          {/* ── Identificação (sempre visível) ── */}
          <SectionBlock {...sectionMeta.identificacao}>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field
                  id="pf-nome"
                  htmlFor="pf-nome"
                  label="Nome completo"
                  required
                  autoComplete="name"
                  value={form.nome}
                  error={errors.nome}
                  onChange={(e) => set('nome', e.target.value)}
                />
              </div>
              <Field
                id="pf-nascimento"
                htmlFor="pf-nascimento"
                label="Data de nascimento"
                type="date"
                required
                hint="Idade é calculada automaticamente"
                value={form.dataNascimento}
                error={errors.dataNascimento}
                onChange={(e) => set('dataNascimento', e.target.value)}
              />
              <SelectField
                id="pf-sexo"
                htmlFor="pf-sexo"
                label="Sexo"
                required
                value={form.sexo}
                error={errors.sexo}
                onChange={(e) =>
                  set('sexo', e.target.value as CriarPacienteInput['sexo'])
                }
              >
                {sexoOptions.map((s) => (
                  <option key={s} value={s}>
                    {sexoLabels[s]}
                  </option>
                ))}
              </SelectField>
              <Field
                id="pf-cpf"
                htmlFor="pf-cpf"
                label="CPF"
                inputMode="numeric"
                autoComplete="off"
                placeholder="000.000.000-00"
                value={form.cpf ?? ''}
                error={errors.cpf}
                onChange={(e) => set('cpf', mascaraCPF(e.target.value))}
              />
              <Field
                id="pf-rg"
                htmlFor="pf-rg"
                label="RG"
                autoComplete="off"
                value={form.rg ?? ''}
                onChange={(e) => set('rg', e.target.value)}
              />
              <SelectField
                id="pf-estadocivil"
                htmlFor="pf-estadocivil"
                label="Estado civil"
                value={form.estadoCivil ?? ''}
                onChange={(e) =>
                  set(
                    'estadoCivil',
                    (e.target.value || undefined) as CriarPacienteInput['estadoCivil'],
                  )
                }
              >
                <option value="">Não informar</option>
                {estadoCivilOptions.map((s) => (
                  <option key={s} value={s}>
                    {estadoCivilLabels[s]}
                  </option>
                ))}
              </SelectField>
              <Field
                id="pf-admissao"
                htmlFor="pf-admissao"
                label="Data de admissão"
                type="date"
                required
                value={form.dataAdmissao}
                error={errors.dataAdmissao}
                onChange={(e) => set('dataAdmissao', e.target.value)}
              />
            </div>
          </SectionBlock>

          {/* ── Contato (colapsável) ── */}
          <CollapsibleSection
            id="contato"
            icon={<UserPlus className="h-4 w-4" />}
            {...sectionMeta.contato}
          >
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
              <Field
                id="pf-telefone"
                htmlFor="pf-telefone"
                label="Telefone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.telefone ?? ''}
                onChange={(e) => set('telefone', e.target.value)}
              />
              <Field
                id="pf-email"
                htmlFor="pf-email"
                label="E-mail"
                type="email"
                inputMode="email"
                autoComplete="email"
                error={errors.email}
                value={form.email ?? ''}
                onChange={(e) => set('email', e.target.value)}
              />
            </div>
          </CollapsibleSection>

          {/* ── Emergência (colapsável) ── */}
          <CollapsibleSection
            id="emergencia"
            icon={<AlertTriangle className="h-4 w-4" />}
            {...sectionMeta.emergencia}
          >
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <Field
                  id="pf-emerg-nome"
                  htmlFor="pf-emerg-nome"
                  label="Nome do contato"
                  value={form.contatoEmergencia?.nome ?? ''}
                  error={errors['contatoEmergencia.nome']}
                  onChange={(e) => setAninhado('contatoEmergencia', 'nome', e.target.value)}
                />
              </div>
              <Field
                id="pf-emerg-parentesco"
                htmlFor="pf-emerg-parentesco"
                label="Parentesco"
                placeholder="Filho, filha, cônjuge..."
                value={form.contatoEmergencia?.parentesco ?? ''}
                error={errors['contatoEmergencia.parentesco']}
                onChange={(e) =>
                  setAninhado('contatoEmergencia', 'parentesco', e.target.value)
                }
              />
              <Field
                id="pf-emerg-tel"
                htmlFor="pf-emerg-tel"
                label="Telefone"
                type="tel"
                inputMode="tel"
                value={form.contatoEmergencia?.telefone ?? ''}
                error={errors['contatoEmergencia.telefone']}
                onChange={(e) =>
                  setAninhado('contatoEmergencia', 'telefone', e.target.value)
                }
              />
            </div>
          </CollapsibleSection>

          {/* ── Endereço (colapsável) ── */}
          <CollapsibleSection
            id="endereco"
            icon={<MapPin className="h-4 w-4" />}
            {...sectionMeta.endereco}
          >
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-6">
              <div className="md:col-span-4">
                <Field
                  id="pf-end-log"
                  htmlFor="pf-end-log"
                  label="Logradouro"
                  autoComplete="street-address"
                  value={form.endereco?.logradouro ?? ''}
                  error={errors['endereco.logradouro']}
                  onChange={(e) => setAninhado('endereco', 'logradouro', e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Field
                  id="pf-end-num"
                  htmlFor="pf-end-num"
                  label="Número"
                  autoComplete="address-line2"
                  value={form.endereco?.numero ?? ''}
                  error={errors['endereco.numero']}
                  onChange={(e) => setAninhado('endereco', 'numero', e.target.value)}
                />
              </div>
              <div className="md:col-span-3">
                <Field
                  id="pf-end-comp"
                  htmlFor="pf-end-comp"
                  label="Complemento"
                  value={form.endereco?.complemento ?? ''}
                  onChange={(e) => setAninhado('endereco', 'complemento', e.target.value)}
                />
              </div>
              <div className="md:col-span-3">
                <Field
                  id="pf-end-bairro"
                  htmlFor="pf-end-bairro"
                  label="Bairro"
                  value={form.endereco?.bairro ?? ''}
                  error={errors['endereco.bairro']}
                  onChange={(e) => setAninhado('endereco', 'bairro', e.target.value)}
                />
              </div>
              <div className="md:col-span-3">
                <Field
                  id="pf-end-cidade"
                  htmlFor="pf-end-cidade"
                  label="Cidade"
                  autoComplete="address-level2"
                  value={form.endereco?.cidade ?? ''}
                  error={errors['endereco.cidade']}
                  onChange={(e) => setAninhado('endereco', 'cidade', e.target.value)}
                />
              </div>
              <div className="md:col-span-1">
                <Field
                  id="pf-end-uf"
                  htmlFor="pf-end-uf"
                  label="UF"
                  placeholder="SP"
                  maxLength={2}
                  autoComplete="address-level1"
                  value={form.endereco?.estado ?? ''}
                  error={errors['endereco.estado']}
                  onChange={(e) =>
                    setAninhado('endereco', 'estado', e.target.value.toUpperCase())
                  }
                />
              </div>
              <div className="md:col-span-2">
                <Field
                  id="pf-end-cep"
                  htmlFor="pf-end-cep"
                  label="CEP"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="00000-000"
                  value={form.endereco?.cep ?? ''}
                  error={errors['endereco.cep']}
                  onChange={(e) => setAninhado('endereco', 'cep', mascaraCEP(e.target.value))}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Nota: protótipo sem DB */}
          <p className="text-[11px] text-slate-400">
            Os campos obrigatórios estão marcados com <span className="text-red-500">*</span>. Se o
            banco não estiver conectado (protótipo), o salvamento avisará que o DB está offline.
          </p>

          {/* Footer */}
          <div className="sticky bottom-0 -mx-6 -mb-5 flex items-center justify-end gap-3 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={onCloseAction}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={isLoading || !podeCriar}
              className="gap-2 bg-teal-600 text-white hover:bg-teal-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Cadastrar paciente
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Subcomponentes ──

function SectionBlock({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
      <p className="mb-4 text-xs text-slate-500">{descricao}</p>
      {children}
    </section>
  );
}

function CollapsibleSection({
  id,
  titulo,
  descricao,
  icon,
  children,
}: {
  id: string;
  titulo: string;
  descricao: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = React.useState(false);
  const panelId = `pf-section-${id}`;
  const btnId = `pf-sectionbtn-${id}`;

  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-900">
        <button
          id={btnId}
          type="button"
          aria-expanded={aberto}
          aria-controls={panelId}
          onClick={() => setAberto((v) => !v)}
          className="flex items-center gap-2 rounded-md px-1 -mx-1 outline-none focus-visible:ring-2 focus-visible:ring-teal-600/30"
        >
          <span className="text-teal-600">{icon}</span>
          {titulo}
          <ChevronIcon className={cnArrow(aberto)} />
        </button>
      </h3>
      <p className="mb-4 text-xs text-slate-500">{descricao}</p>
      {aberto && (
        <div id={panelId} className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
          {children}
        </div>
      )}
      {!aberto && <span id={panelId} hidden>{null}</span>}
    </section>
  );
}

function ChevronIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width={16}
      height={16}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function cnArrow(aberto: boolean): string {
  return (
    'ml-1 transition-transform duration-200 ' +
    (aberto ? 'rotate-180 text-slate-500' : 'text-slate-400')
  );
}

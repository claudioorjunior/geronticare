'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useDevRole } from '@/lib/dev/use-dev-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Activity, Heart, Calendar, User } from 'lucide-react';

// ── Mock data ──

const initialData = {
  nome: 'Maria das Gracas Silva',
  cpf: '123.456.789-00',
  dataNascimento: '1946-03-12',
  telefone: '(21) 99999-1234',
  email: 'maria.silva@email.com',
  contatoEmergenciaNome: 'Carlos Silva',
  contatoEmergenciaParentesco: 'Filho',
  contatoEmergenciaTelefone: '(21) 98888-4321',
  dataAdmissao: '2024-11-05',
  ativo: true,
};

type PatientData = typeof initialData;

function FieldGroup({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

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
  const { role } = useDevRole();

  const [data, setData] = useState<PatientData>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const canEditClinical = role === 'admin' || role === 'profissional';
  const canEditStatus = role === 'admin';

  const handleChange = (field: keyof PatientData, value: string | boolean) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    await new Promise((resolve) => setTimeout(resolve, 600));
    setIsSaving(false);
    setSaveMessage('Dados salvos com sucesso (mock).');
    setTimeout(() => setSaveMessage(''), 2500);
  };

  // KPIs: valores mockados do último sinal vital (fixos para protótipo)
  const kpis = [
    { icon: Heart, label: 'FC', value: '76', unit: 'bpm' },
    { icon: Activity, label: 'PA', value: '135/82', unit: 'mmHg' },
    { icon: Activity, label: 'SpO2', value: '97', unit: '%' },
    { icon: Calendar, label: 'Internado', value: '262', unit: 'dias' },
  ];

  return (
    <>
      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <Kpi key={kpi.label} icon={kpi.icon} label={kpi.label} value={kpi.value} unit={kpi.unit} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Coluna principal: dados cadastrais */}
        <section className="space-y-5 lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-m3-2">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Identificacao</h3>
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
              <FieldGroup label="Nome completo">
                <Input value={data.nome} onChange={(e) => handleChange('nome', e.target.value)} />
              </FieldGroup>

              <FieldGroup label="CPF">
                <Input value={data.cpf} disabled className="bg-slate-50 text-slate-500" />
              </FieldGroup>

              <FieldGroup label="Data de nascimento">
                <Input value={data.dataNascimento} disabled className="bg-slate-50 text-slate-500" />
              </FieldGroup>

              <FieldGroup label="Telefone">
                <Input value={data.telefone} onChange={(e) => handleChange('telefone', e.target.value)} />
              </FieldGroup>

              <FieldGroup label="E-mail">
                <Input value={data.email} onChange={(e) => handleChange('email', e.target.value)} />
              </FieldGroup>

              <FieldGroup
                label="Data de admissao"
                hint={canEditClinical ? undefined : 'Apenas profissionais podem alterar'}
              >
                <Input
                  value={data.dataAdmissao}
                  onChange={(e) => handleChange('dataAdmissao', e.target.value)}
                  disabled={!canEditClinical}
                  className={!canEditClinical ? 'bg-slate-50 text-slate-500' : ''}
                />
              </FieldGroup>
            </div>
          </div>

          {/* Status */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-m3-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Status do paciente</span>
              <div className="flex items-center gap-3">
                <Button
                  variant={data.ativo ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => canEditStatus && handleChange('ativo', !data.ativo)}
                  disabled={!canEditStatus}
                  className={!canEditStatus ? 'opacity-60' : ''}
                >
                  {data.ativo ? 'Ativo' : 'Inativo'}
                </Button>
                {!canEditStatus && <span className="text-xs text-slate-400">Somente administrador</span>}
              </div>
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar alteracoes'}
            </Button>
            {saveMessage && <span className="text-sm text-emerald-600">{saveMessage}</span>}
            <span className="ml-auto text-xs text-slate-400">ID: {params.id}</span>
          </div>
        </section>

        {/* Sidebar: contato emergencia + alergias */}
        <aside className="space-y-5">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100">
                <User className="h-3.5 w-3.5 text-teal-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Contato de emergencia</h3>
            </div>
            <div className="space-y-3">
              <FieldGroup label="Nome">
                <Input
                  value={data.contatoEmergenciaNome}
                  onChange={(e) => handleChange('contatoEmergenciaNome', e.target.value)}
                />
              </FieldGroup>
              <FieldGroup label="Parentesco">
                <Input
                  value={data.contatoEmergenciaParentesco}
                  onChange={(e) => handleChange('contatoEmergenciaParentesco', e.target.value)}
                />
              </FieldGroup>
              <FieldGroup label="Telefone">
                <Input
                  value={data.contatoEmergenciaTelefone}
                  onChange={(e) => handleChange('contatoEmergenciaTelefone', e.target.value)}
                />
              </FieldGroup>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Alergias</h3>
            <p className="text-xs text-slate-400">Nenhuma alergia registrada no mock.</p>
          </div>
        </aside>
      </div>
    </>
  );
}

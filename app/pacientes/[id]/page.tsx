'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useDevRole } from '@/lib/dev/use-dev-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Mock data - will come from tRPC later
const initialData = {
  nome: 'Maria das Graças Silva',
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

export default function PatientDadosPage() {
  const params = useParams<{ id: string }>();
  const { role } = useDevRole();

  const [data, setData] = useState<PatientData>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const canEditClinical = role === 'admin' || role === 'profissional';
  const canEditStatus = role === 'admin';

  const handleChange = (field: keyof PatientData, value: string | boolean) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 600));

    setIsSaving(false);
    setSaveMessage('Dados salvos com sucesso! (mock)');

    setTimeout(() => setSaveMessage(''), 2500);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dados Cadastrais</CardTitle>
          <p className="text-sm text-slate-500">
            Papel atual: <span className="font-medium capitalize">{role}</span> — 
            {role === 'usuario' && ' você pode editar apenas dados pessoais básicos.'}
            {(role === 'profissional' || role === 'admin') && ' acesso completo aos dados cadastrais.'}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nome - editável por todos */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Nome completo</label>
              <Input 
                value={data.nome} 
                onChange={(e) => handleChange('nome', e.target.value)}
                disabled={role === 'usuario' ? false : false} // todos podem editar nome
              />
            </div>

            {/* CPF - readonly para todos no momento */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">CPF</label>
              <Input value={data.cpf} disabled className="bg-slate-50" />
            </div>

            {/* Data de nascimento */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Data de nascimento</label>
              <Input value={data.dataNascimento} disabled className="bg-slate-50" />
            </div>

            {/* Telefone - editável */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Telefone</label>
              <Input 
                value={data.telefone} 
                onChange={(e) => handleChange('telefone', e.target.value)}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">E-mail</label>
              <Input 
                value={data.email} 
                onChange={(e) => handleChange('email', e.target.value)}
              />
            </div>

            {/* Data de admissão - só profissional/admin */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Data de admissão</label>
              <Input 
                value={data.dataAdmissao} 
                onChange={(e) => handleChange('dataAdmissao', e.target.value)}
                disabled={!canEditClinical}
                className={!canEditClinical ? 'bg-slate-50' : ''}
              />
              {!canEditClinical && (
                <p className="text-[10px] text-slate-400 mt-0.5">Apenas profissionais podem alterar</p>
              )}
            </div>
          </div>

          {/* Contato de emergência */}
          <div className="border-t pt-6">
            <h3 className="text-sm font-medium mb-3">Contato de emergência</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Nome</label>
                <Input 
                  value={data.contatoEmergenciaNome} 
                  onChange={(e) => handleChange('contatoEmergenciaNome', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Parentesco</label>
                <Input 
                  value={data.contatoEmergenciaParentesco} 
                  onChange={(e) => handleChange('contatoEmergenciaParentesco', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Telefone</label>
                <Input 
                  value={data.contatoEmergenciaTelefone} 
                  onChange={(e) => handleChange('contatoEmergenciaTelefone', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Status - só admin */}
          <div className="border-t pt-6">
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-500">Status do paciente</label>
              <Button
                variant={data.ativo ? 'default' : 'secondary'}
                size="sm"
                onClick={() => canEditStatus && handleChange('ativo', !data.ativo)}
                disabled={!canEditStatus}
                className={!canEditStatus ? 'opacity-60' : ''}
              >
                {data.ativo ? 'Ativo' : 'Inativo'}
              </Button>
              {!canEditStatus && (
                <span className="text-[10px] text-slate-400">Somente administrador pode alterar</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar alterações'}
        </Button>

        {saveMessage && (
          <span className="text-sm text-emerald-600">{saveMessage}</span>
        )}

        <span className="text-xs text-slate-400 ml-auto">
          ID do paciente: {params.id}
        </span>
      </div>

      <p className="text-[10px] text-slate-400">
        Este é um formulário simulado. Os dados não são persistidos. O papel atual controla quais campos podem ser editados.
      </p>
    </div>
  );
}

'use client';

import { useParams } from 'next/navigation';

// Tab "Dados" - dados cadastrais do paciente
// Restrito por papel: "usuário" pode editar apenas campos pessoais

export default function PatientDadosPage() {
  const params = useParams<{ id: string }>();

  // TODO: carregar dados reais via tRPC pacientes.buscar
  const mockData = {
    nome: 'Maria das Graças Silva',
    cpf: '123.456.789-00',
    dataNascimento: '1946-03-12',
    telefone: '(21) 99999-1234',
    dataAdmissao: '2024-11-05',
    ativo: true,
  };

  return (
    <div className="max-w-3xl">
      <div className="rounded-lg border bg-white p-6 space-y-6">
        <div>
          <h2 className="font-semibold mb-4">Dados Cadastrais</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div>
              <div className="text-slate-500 text-xs">Nome completo</div>
              <div className="font-medium mt-0.5">{mockData.nome}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">CPF</div>
              <div className="font-medium mt-0.5">{mockData.cpf}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">Data de nascimento</div>
              <div className="font-medium mt-0.5">{mockData.dataNascimento}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">Telefone</div>
              <div className="font-medium mt-0.5">{mockData.telefone}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">Data de admissão</div>
              <div className="font-medium mt-0.5">{mockData.dataAdmissao}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">Status</div>
              <div className={`inline-block mt-0.5 px-2 py-0.5 rounded text-xs ${mockData.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200'}`}>
                {mockData.ativo ? 'Ativo' : 'Inativo'}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t">
          <button 
            className="text-sm px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700"
            onClick={() => alert('Editar paciente — implementar formulário na próxima fase')}
          >
            Editar dados cadastrais
          </button>
          <span className="ml-3 text-xs text-slate-400">
            (Profissional e Admin podem editar mais campos)
          </span>
        </div>
      </div>

      <div className="text-xs text-slate-400 mt-6">
        Esta é a aba padrão ao abrir o perfil. Use as tabs acima para acessar AGA, Registros, Sinais e Anexos.
      </div>
    </div>
  );
}

// Seed de pacientes mock no Neon.
// Uso: DATABASE_URL="postgresql://..." npx tsx scripts/seed-pacientes-neon.ts
import { getDb } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';
import { instituicoes, pacientes } from '@/lib/db/schema';

type PacienteSeed = {
  nome: string;
  dataNascimento: Date;
  cpf: string;
  rg: string;
  sexo: 'masculino' | 'feminino' | 'outro';
  estadoCivil: 'solteiro' | 'casado' | 'viuvo' | 'divorciado' | 'uniao_estavel';
  telefone: string;
  email: string;
  endereco?: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
  };
  contatoEmergencia?: { nome: string; parentesco: string; telefone: string };
  dataAdmissao: Date;
  ativo: boolean;
};

const PACIENTES: PacienteSeed[] = [
  {
    nome: 'Maria Aparecida da Silva',
    dataNascimento: new Date('1940-03-15T00:00:00Z'),
    cpf: '123.456.789-00',
    rg: '12.345.678-9',
    sexo: 'feminino',
    estadoCivil: 'viuvo',
    telefone: '(11) 91234-5678',
    email: 'maria.silva@email.com.br',
    endereco: {
      logradouro: 'Rua das Acácias',
      numero: '120',
      complemento: 'Apto 3',
      bairro: 'Centro',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01000-000',
    },
    contatoEmergencia: { nome: 'Paulo da Silva', parentesco: 'Filho', telefone: '(11) 99888-7766' },
    dataAdmissao: new Date('2024-06-01T00:00:00Z'),
    ativo: true,
  },
  {
    nome: 'João Batista de Oliveira',
    dataNascimento: new Date('1935-08-22T00:00:00Z'),
    cpf: '987.654.321-00',
    rg: '98.765.432-1',
    sexo: 'masculino',
    estadoCivil: 'casado',
    telefone: '(11) 98765-4321',
    email: 'joao.oliveira@email.com.br',
    endereco: {
      logradouro: 'Av. Brasil',
      numero: '2400',
      bairro: 'Jardins',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01430-000',
    },
    contatoEmergencia: { nome: 'Helena Oliveira', parentesco: 'Esposa', telefone: '(11) 97777-1234' },
    dataAdmissao: new Date('2024-03-10T00:00:00Z'),
    ativo: true,
  },
  {
    nome: 'Antônia Ferreira Costa',
    dataNascimento: new Date('1938-11-30T00:00:00Z'),
    cpf: '456.789.123-00',
    rg: '45.678.912-3',
    sexo: 'feminino',
    estadoCivil: 'solteiro',
    telefone: '(11) 94567-8912',
    email: 'antonia.costa@email.com.br',
    endereco: {
      logradouro: 'Rua dos Ipês',
      numero: '85',
      bairro: 'Vila Mariana',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '04110-000',
    },
    contatoEmergencia: { nome: 'Ricardo Costa', parentesco: 'Sobrinho', telefone: '(11) 96666-5544' },
    dataAdmissao: new Date('2024-09-20T00:00:00Z'),
    ativo: true,
  },
  {
    nome: 'Carlos Alberto Pereira',
    dataNascimento: new Date('1932-05-10T00:00:00Z'),
    cpf: '789.123.456-00',
    rg: '78.912.345-6',
    sexo: 'masculino',
    estadoCivil: 'divorciado',
    telefone: '(11) 97891-2345',
    email: 'carlos.pereira@email.com.br',
    endereco: {
      logradouro: 'Rua Harmonia',
      numero: '310',
      bairro: 'Pinheiros',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '05435-000',
    },
    contatoEmergencia: { nome: 'Camila Pereira', parentesco: 'Filha', telefone: '(11) 95555-8899' },
    dataAdmissao: new Date('2023-12-05T00:00:00Z'),
    ativo: true,
  },
  {
    nome: 'Dona Sebastiana Lima Santos',
    dataNascimento: new Date('1945-07-18T00:00:00Z'),
    cpf: '321.654.987-00',
    rg: '32.165.498-7',
    sexo: 'feminino',
    estadoCivil: 'uniao_estavel',
    telefone: '(11) 93216-5498',
    email: 'sebastiana.santos@email.com.br',
    dataAdmissao: new Date('2025-01-08T00:00:00Z'),
    ativo: false,
  },
  {
    nome: 'Francisca das Chagas Nunes',
    dataNascimento: new Date('1936-01-09T00:00:00Z'),
    cpf: '654.987.321-00',
    rg: '65.498.732-1',
    sexo: 'feminino',
    estadoCivil: 'viuvo',
    telefone: '(11) 96459-8712',
    email: 'francisca.nunes@email.com.br',
    endereco: {
      logradouro: 'Rua Tijuca',
      numero: '77',
      bairro: 'Mooca',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '03120-000',
    },
    contatoEmergencia: { nome: 'Maria Nunes', parentesco: 'Filha', telefone: '(11) 94444-3322' },
    dataAdmissao: new Date('2025-02-14T00:00:00Z'),
    ativo: true,
  },
  {
    nome: 'José Renato Martins',
    dataNascimento: new Date('1941-04-23T00:00:00Z'),
    cpf: '147.258.369-00',
    rg: '14.725.836-9',
    sexo: 'masculino',
    estadoCivil: 'casado',
    telefone: '(11) 91472-5836',
    email: 'jose.martins@email.com.br',
    endereco: {
      logradouro: 'Rua Augusta',
      numero: '1520',
      bairro: 'Consolação',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01305-100',
    },
    contatoEmergencia: { nome: 'Ana Martins', parentesco: 'Esposa', telefone: '(11) 93333-2211' },
    dataAdmissao: new Date('2024-11-02T00:00:00Z'),
    ativo: true,
  },
  {
    nome: 'Alice Gonçalves Barbosa',
    dataNascimento: new Date('1939-10-11T00:00:00Z'),
    cpf: '258.147.369-00',
    rg: '25.814.736-9',
    sexo: 'feminino',
    estadoCivil: 'divorciado',
    telefone: '(11) 92581-4736',
    email: 'alice.barbosa@email.com.br',
    endereco: {
      logradouro: 'Rua Vergueiro',
      numero: '650',
      complemento: 'Bloco B',
      bairro: 'Liberdade',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01504-001',
    },
    contatoEmergencia: { nome: 'Marcos Barbosa', parentesco: 'Filho', telefone: '(11) 92222-1100' },
    dataAdmissao: new Date('2025-03-22T00:00:00Z'),
    ativo: true,
  },
  {
    nome: 'Manoel Francisco de Souza',
    dataNascimento: new Date('1933-12-02T00:00:00Z'),
    cpf: '369.258.147-00',
    rg: '36.925.814-7',
    sexo: 'masculino',
    estadoCivil: 'viuvo',
    telefone: '(11) 93692-5814',
    email: 'manoel.souza@email.com.br',
    dataAdmissao: new Date('2024-01-18T00:00:00Z'),
    ativo: true,
  },
  {
    nome: 'Terezinha Alves Pinto',
    dataNascimento: new Date('1946-06-30T00:00:00Z'),
    cpf: '951.753.852-00',
    rg: '95.175.385-2',
    sexo: 'feminino',
    estadoCivil: 'solteiro',
    telefone: '(11) 99517-5385',
    email: 'terezinha.pinto@email.com.br',
    endereco: {
      logradouro: 'Rua do Lavradio',
      numero: '95',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01319-000',
    },
    contatoEmergencia: { nome: 'Célia Alves', parentesco: 'Irmã', telefone: '(11) 98888-7766' },
    dataAdmissao: new Date('2025-04-05T00:00:00Z'),
    ativo: true,
  },
];

async function main() {
  const db = await getDb();

  // Instituição do Neon (criada pelo seed-neon.ts) — associa os pacientes a ela.
  const inst = await db.query.instituicoes.findFirst({
    where: eq(instituicoes.nome, 'ILPI Mock'),
  });
  if (!inst) {
    console.error('Instituição "ILPI Mock" não encontrada. Rode scripts/seed-neon.ts antes.');
    process.exit(1);
  }

  let criados = 0;
  let pulados = 0;

  for (const p of PACIENTES) {
    const existente = await db.query.pacientes.findFirst({
      where: sql`${pacientes.email} = ${p.email} AND ${pacientes.instituicaoId} = ${inst.id}`,
    });
    if (existente) {
      pulados += 1;
      console.log(`já existe: ${p.nome}`);
      continue;
    }

    await db.insert(pacientes).values({
      instituicaoId: inst.id,
      nome: p.nome,
      dataNascimento: p.dataNascimento,
      cpf: p.cpf,
      rg: p.rg,
      sexo: p.sexo,
      estadoCivil: p.estadoCivil,
      telefone: p.telefone,
      email: p.email,
      endereco: p.endereco ?? null,
      contatoEmergencia: p.contatoEmergencia ?? null,
      dataAdmissao: p.dataAdmissao,
      ativo: p.ativo,
    });

    criados += 1;
    console.log(`criado: ${p.nome}`);
  }

  const total = await db.select({ count: sql`count(*)` }).from(pacientes).where(eq(pacientes.instituicaoId, inst.id));
  console.log(`\nSeed OK. criados=${criados}, já existentes=${pulados}, total na instituição=${total[0].count}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Falha no seed:', (err as Error).message);
  process.exit(1);
});

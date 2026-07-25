'use client';

import { useMemo, useState } from 'react';
import {
  Bath, Shirt, Sparkles, MoveHorizontal, DropletOff, Utensils,
  Phone, ShoppingCart, CookingPot, Brush, WashingMachine, Bus, Pill, Wallet,
  ClipboardCheck, Brain, HeartPulse, Salad, Timer,
  Calculator, TrendingDown, Save, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type ScaleKey = 'katz' | 'lawton' | 'meem' | 'gds15' | 'mna' | 'tug';

type RadioOption = { value: number; label: string; desc: string };

type RadioItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  options: RadioOption[];
};

type ScaleDef = {
  key: ScaleKey;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  cardTitle: string;
  max: number;
  unit: string;
  items?: RadioItem[];
  interpret: (score: number) => { label: string; desc: string; tone: 'ok' | 'warn' | 'risk' };
};

const katzItems: RadioItem[] = [
  {
    id: 'banho', label: 'Banho', icon: <Bath className="h-4 w-4" />,
    options: [
      { value: 0, label: 'Independente', desc: 'Toma banho sozinho ou precisa de ajuda apenas para uma parte (ex: costas).' },
      { value: 1, label: 'Dependente', desc: 'Precisa de ajuda para mais de uma parte do corpo ou não toma banho sozinho.' },
    ],
  },
  {
    id: 'vestir', label: 'Vestir-se', icon: <Shirt className="h-4 w-4" />,
    options: [
      { value: 0, label: 'Independente', desc: 'Pega as roupas, veste-se e usa fechos (pode precisar de ajuda para amarrar sapatos).' },
      { value: 1, label: 'Dependente', desc: 'Precisa de ajuda para se vestir ou é vestido por outros.' },
    ],
  },
  {
    id: 'higiene', label: 'Higiene pessoal', icon: <Sparkles className="h-4 w-4" />,
    options: [
      { value: 0, label: 'Independente', desc: 'Seca o rosto e as mãos, escova os dentes, faz a barba, arruma o cabelo sozinho.' },
      { value: 1, label: 'Dependente', desc: 'Precisa de ajuda para a higiene pessoal; ou mantém-se apenas parcialmente.' },
    ],
  },
  {
    id: 'transferencia', label: 'Transferência', icon: <MoveHorizontal className="h-4 w-4" />,
    options: [
      { value: 0, label: 'Independente', desc: 'Levanta-se e deita-se da cama/cadeira sozinho.' },
      { value: 1, label: 'Dependente', desc: 'Precisa de ajuda física ou equipamento para transferência.' },
    ],
  },
  {
    id: 'continencia', label: 'Continência', icon: <DropletOff className="h-4 w-4" />,
    options: [
      { value: 0, label: 'Independente', desc: 'Controle total de urina e fezes (inclui uso de fraldas/cateter autossuficiente).' },
      { value: 1, label: 'Dependente', desc: 'Incontinência parcial ou total; ou necessita de ajuda para usar coletor/fralda.' },
    ],
  },
  {
    id: 'alimentacao', label: 'Alimentação', icon: <Utensils className="h-4 w-4" />,
    options: [
      { value: 0, label: 'Independente', desc: 'Leva a comida à boca sozinho (pode ser alimentado por outro após já pronto).' },
      { value: 1, label: 'Dependente', desc: 'Precisa de ajuda física para se alimentar, ou é parcial/totalmente alimentado.' },
    ],
  },
];

const lawtonItems: RadioItem[] = [
  {
    id: 'telefone', label: 'Usar telefone', icon: <Phone className="h-4 w-4" />,
    options: [
      { value: 1, label: 'Independente', desc: 'Inicia contatos, discar e atender sozinho.' },
      { value: 0, label: 'Dependente', desc: 'Não usa o telefone de forma ativa.' },
    ],
  },
  {
    id: 'compras', label: 'Fazer compras', icon: <ShoppingCart className="h-4 w-4" />,
    options: [
      { value: 1, label: 'Independente', desc: 'Cuida das compras necessárias sozinho.' },
      { value: 0, label: 'Dependente', desc: 'Precisa ser acompanhado em todas as compras.' },
    ],
  },
  {
    id: 'comida', label: 'Preparar refeição', icon: <CookingPot className="h-4 w-4" />,
    options: [
      { value: 1, label: 'Independente', desc: 'Prepara refeições adequadas sozinho.' },
      { value: 0, label: 'Dependente', desc: 'Refeições devem ser preparadas e servidas por outra pessoa.' },
    ],
  },
  {
    id: 'limpeza', label: 'Arrumar a casa', icon: <Brush className="h-4 w-4" />,
    options: [
      { value: 1, label: 'Independente', desc: 'Executa tarefas leves de limpeza sozinho.' },
      { value: 0, label: 'Dependente', desc: 'Não participa de tarefas domésticas.' },
    ],
  },
  {
    id: 'lavanderia', label: 'Lavar roupa', icon: <WashingMachine className="h-4 w-4" />,
    options: [
      { value: 1, label: 'Independente', desc: 'Lava as próprias roupas completamente.' },
      { value: 0, label: 'Dependente', desc: 'Roupas precisam ser lavadas por outrem.' },
    ],
  },
  {
    id: 'transporte', label: 'Usar transporte', icon: <Bus className="h-4 w-4" />,
    options: [
      { value: 1, label: 'Independente', desc: 'Viaja sozinho em transportes públicos ou dirige.' },
      { value: 0, label: 'Dependente', desc: 'Precisa ser acompanhado e/ou motorista.' },
    ],
  },
  {
    id: 'medicacao', label: 'Tomar medicação', icon: <Pill className="h-4 w-4" />,
    options: [
      { value: 1, label: 'Independente', desc: 'Toma a medicação na dose e horário corretos sozinho.' },
      { value: 0, label: 'Dependente', desc: 'Necessita de ajuda para preparar/tomar a medicação.' },
    ],
  },
  {
    id: 'financas', label: 'Cuidar das finanças', icon: <Wallet className="h-4 w-4" />,
    options: [
      { value: 1, label: 'Independente', desc: 'Gerencia assuntos financeiros sozinho (banco, contas).' },
      { value: 0, label: 'Dependente', desc: 'Incapaz de lidar com finanças.' },
    ],
  },
];

const meemItems: RadioItem[] = [
  {
    id: 'orientacao', label: '1. Orientação (10 pts)', icon: <ClipboardCheck className="h-4 w-4" />,
    options: [
      { value: 10, label: '10 acertos', desc: 'Acertou ano, mês, dia, dia da semana, estação + local (andar, piso, cidade, estado, hospital/quarto).' },
      { value: 9, label: '9 acertos', desc: 'Errou 1 item temporal ou espacial.' },
      { value: 7, label: '7 acertos', desc: 'Erros parciais comuns em orientação.' },
      { value: 5, label: '5 acertos', desc: 'Apenas metade dos itens acertados.' },
      { value: 0, label: '0 acertos', desc: 'Não orientado em nenhum item.' },
    ],
  },
  {
    id: 'memoria', label: '2. Memória (3 pts)', icon: <Brain className="h-4 w-4" />,
    options: [
      { value: 3, label: '3 pts', desc: 'Repetiu 3 palavras imediatamente após serem ditas.' },
      { value: 2, label: '2 pts', desc: 'Repetiu 2 palavras.' },
      { value: 1, label: '1 pt', desc: 'Repetiu 1 palavra.' },
      { value: 0, label: '0 pts', desc: 'Não repetiu nenhuma palavra.' },
    ],
  },
  {
    id: 'atencao', label: '3. Atenção e cálculo (5 pts)', icon: <Brain className="h-4 w-4" />,
    options: [
      { value: 5, label: '5 pts', desc: 'Subtraindo 7 em série completa ou soletrando MUNDO de trás para frente corretamente.' },
      { value: 3, label: '3 pts', desc: 'Acertos parciais.' },
      { value: 1, label: '1 pt', desc: 'Apenas 1 subtração ou letra correta.' },
      { value: 0, label: '0 pts', desc: 'Não conseguiu realizar a tarefa.' },
    ],
  },
  {
    id: 'evocacao', label: '4. Evocação (3 pts)', icon: <Brain className="h-4 w-4" />,
    options: [
      { value: 3, label: '3 pts', desc: 'Recall das 3 palavras ouvidas anteriormente.' },
      { value: 2, label: '2 pts', desc: 'Lembrou 2 palavras.' },
      { value: 1, label: '1 pt', desc: 'Lembrou 1 palavra.' },
      { value: 0, label: '0 pts', desc: 'Não lembrou nenhuma palavra.' },
    ],
  },
  {
    id: 'linguagem', label: '5. Linguagem (9 pts)', icon: <Brain className="h-4 w-4" />,
    options: [
      { value: 9, label: '9 pts', desc: 'Nomear 2 objetos + repetir frase + comando de 3 etapas + leitura + escrita — tudo correto.' },
      { value: 6, label: '6 pts', desc: 'Acertos parciais na maioria das etapas.' },
      { value: 3, label: '3 pts', desc: 'Apenas tarefas simples executadas.' },
      { value: 0, label: '0 pts', desc: 'Não executou tarefas linguísticas.' },
    ],
  },
  {
    id: 'desenho', label: '6. Desenho/Cópia (1 pt)', icon: <Brain className="h-4 w-4" />,
    options: [
      { value: 1, label: '1 pt', desc: 'Copia corretamente figuras sobrepostas (pentágonos).' },
      { value: 0, label: '0 pt', desc: 'Não consegue copiar o desenho.' },
    ],
  },
];

// GDS-15 — Escala de Depressão Geriátrica (Yesavage)
// 4 itens invertidos (Não = 1 ponto): Q1, Q5, Q7, Q11
// 11 itens diretos (Sim = 1 ponto): Q2, Q3, Q4, Q6, Q8, Q9, Q10, Q12, Q13, Q14, Q15
const gdsQuestions: { pergunta: string; invertido: boolean }[] = [
  { pergunta: 'Você está basicamente satisfeito com sua vida?', invertido: true },
  { pergunta: 'Você deixou muitos de seus interesses e atividades?', invertido: false },
  { pergunta: 'Sente que sua vida está vazia?', invertido: false },
  { pergunta: 'Costuma ficar aborrecido/entediado com frequência?', invertido: false },
  { pergunta: 'Está de bom humor na maior parte do tempo?', invertido: true },
  { pergunta: 'Tem receio que algo ruim vai acontecer com você?', invertido: false },
  { pergunta: 'Sente-se feliz a maior parte do tempo?', invertido: true },
  { pergunta: 'Sente-se frequentemente impotente/inútil?', invertido: false },
  { pergunta: 'Prefere ficar em casa a sair para coisas novas?', invertido: false },
  { pergunta: 'Sente que tem mais problemas de memória que outros?', invertido: false },
  { pergunta: 'Acha que é maravilhoso estar vivo?', invertido: true },
  { pergunta: 'Sente que vale a pena viver, atualmente?', invertido: false },
  { pergunta: 'Sente que sua situação é sem esperança?', invertido: false },
  { pergunta: 'Acha que as pessoas são melhores que você?', invertido: false },
  { pergunta: 'Tem diminuído o bem-estar e capacidade de realizar coisas?', invertido: false },
];

const gdsItems: RadioItem[] = gdsQuestions.map((q, i) => {
  const n = i + 1;
  const simVale = q.invertido ? 0 : 1;
  const naoVale = q.invertido ? 1 : 0;
  return {
    id: `g${n}`,
    label: `${n}. ${q.pergunta}`,
    icon: <HeartPulse className="h-4 w-4" />,
    options: [
      { value: simVale, label: 'Sim', desc: simVale === 1 ? 'Indica presença do sintoma depressivo.' : 'Resposta não-depressiva.' },
      { value: naoVale, label: 'Não', desc: naoVale === 1 ? 'Indica presença do sintoma depressivo.' : 'Resposta não-depressiva.' },
    ],
  };
});

const mnaScreenItems: RadioItem[] = [
  {
    id: 'mna-a', label: 'A. Diminuiu a quantidade de comida?', icon: <Salad className="h-4 w-4" />,
    options: [
      { value: 0, label: 'Diminuiu severamente', desc: '0 pontos.' },
      { value: 1, label: 'Diminuiu moderadamente', desc: '1 ponto.' },
      { value: 2, label: 'Não diminuiu', desc: '2 pontos.' },
    ],
  },
  {
    id: 'mna-b', label: 'B. Perda de comida por insuficiência?', icon: <Salad className="h-4 w-4" />,
    options: [
      { value: 0, label: 'Sim, 3+ vezes/dia', desc: '0 pontos.' },
      { value: 1, label: '1–2 vezes/dia', desc: '1 ponto.' },
      { value: 2, label: 'Não', desc: '2 pontos.' },
    ],
  },
  {
    id: 'mna-c', label: 'C. Perda de peso nos últimos 3 meses?', icon: <Salad className="h-4 w-4" />,
    options: [
      { value: 0, label: 'Perda > 3 kg', desc: '0 pontos.' },
      { value: 1, label: 'Não sabe', desc: '1 ponto.' },
      { value: 2, label: 'Perda 1–3 kg', desc: '2 pontos.' },
      { value: 3, label: 'Sem perda', desc: '3 pontos.' },
    ],
  },
  {
    id: 'mna-d', label: 'D. Mobilidade?', icon: <Salad className="h-4 w-4" />,
    options: [
      { value: 0, label: 'Acamado/cadeira', desc: '0 pontos.' },
      { value: 1, label: 'De ambulatório', desc: '1 ponto.' },
      { value: 2, label: 'Sai sozinho', desc: '2 pontos.' },
    ],
  },
  {
    id: 'mna-e', label: 'E. Stress psicológico/adoecimento agudo?', icon: <Salad className="h-4 w-4" />,
    options: [
      { value: 0, label: 'Sim', desc: '0 pontos.' },
      { value: 2, label: 'Não', desc: '2 pontos.' },
    ],
  },
  {
    id: 'mna-f', label: 'F. IMC (kg/m²)?', icon: <Salad className="h-4 w-4" />,
    options: [
      { value: 0, label: '< 19', desc: '0 pontos.' },
      { value: 1, label: '19 a < 21', desc: '1 ponto.' },
      { value: 2, label: '21 a < 23', desc: '2 pontos.' },
      { value: 3, label: '≥ 23', desc: '3 pontos.' },
    ],
  },
];

const scales: ScaleDef[] = [
  {
    key: 'katz',
    title: 'Índice de Katz (AVDs)',
    subtitle: 'Atividades Básicas de Vida Diária. Selecione uma opção por linha. Escore 0–6.',
    icon: <ClipboardCheck className="h-5 w-5" />,
    cardTitle: 'Katz',
    max: 6, unit: '/6',
    items: katzItems,
    interpret: (s) => {
      if (s === 6) return { label: 'Independência total', desc: 'Independente em todas as AVDs básicas.', tone: 'ok' };
      if (s >= 4) return { label: 'Dependência leve', desc: `Comprometimento em ${6 - s} função(ões). Supervisão parcial recomendada.`, tone: 'warn' };
      if (s >= 2) return { label: 'Dependência moderada', desc: `Comprometimento em ${6 - s} funções. Necessita assistência diária.`, tone: 'warn' };
      return { label: 'Dependência importante', desc: 'Dependente para a maioria das AVDs. Assistência integral.', tone: 'risk' };
    },
  },
  {
    key: 'lawton',
    title: 'Escala de Lawton (AIVDs)',
    subtitle: 'Atividades Instrumentais de Vida Diária. Escore 0–8 (feminino) ou 0–5 (quando adaptada).',
    icon: <ClipboardCheck className="h-5 w-5" />,
    cardTitle: 'Lawton',
    max: 8, unit: '/8',
    items: lawtonItems,
    interpret: (s) => {
      if (s >= 8) return { label: 'Independência total', desc: 'Independente em todas as AIVDs.', tone: 'ok' };
      if (s >= 6) return { label: 'Dependência leve', desc: `Comprometimento em ${8 - s} atividade(s) instrumental(is).`, tone: 'warn' };
      if (s >= 4) return { label: 'Dependência moderada', desc: 'Necessita ajuda parcial em atividades instrumentais.', tone: 'warn' };
      return { label: 'Dependência importante', desc: 'Dificuldade significativa em AIVDs. Assistência ampla.', tone: 'risk' };
    },
  },
  {
    key: 'meem',
    title: 'Mini-Exame do Estado Mental (MEEM)',
    subtitle: 'Avaliação cognitiva. Preencha cada domínio conforme a performance do paciente. Escore 0–30.',
    icon: <Brain className="h-5 w-5" />,
    cardTitle: 'MEEM',
    max: 30, unit: '/30',
    items: meemItems,
    interpret: (s) => {
      if (s >= 28) return { label: 'Cognição normal', desc: 'Sem comprometimento cognitivo compatível com o escore.', tone: 'ok' };
      if (s >= 24) return { label: 'Cognição limítrofe', desc: 'Avaliar escolaridade e contexto; monitorar.', tone: 'warn' };
      if (s >= 18) return { label: 'Comprometimento leve', desc: 'Suspeita de declínio cognitivo leve.', tone: 'warn' };
      if (s >= 10) return { label: 'Comprometimento moderado', desc: 'Investigação clínica recomendada.', tone: 'risk' };
      return { label: 'Comprometimento grave', desc: 'Escore compatível com demência grave.', tone: 'risk' };
    },
  },
  {
    key: 'gds15',
    title: 'GDS-15 (Escala de Depressão Geriátrica)',
    subtitle: '15 perguntas sim/não sobre humor. As respostas indicadoras de humor depressivo somam 1 ponto.',
    icon: <HeartPulse className="h-5 w-5" />,
    cardTitle: 'GDS-15',
    max: 15, unit: '/15',
    items: gdsItems,
    interpret: (s) => {
      if (s < 5) return { label: 'Sem sintomas depressivos', desc: 'Escore compatível com humor preservado.', tone: 'ok' };
      if (s === 5) return { label: 'Sintomas leves', desc: 'Atenção a indicadores isolados de humor depressivo.', tone: 'warn' };
      if (s <= 9) return { label: 'Sintomas moderados', desc: 'Avaliação clínica e seguimento recomendados.', tone: 'warn' };
      return { label: 'Sintomas graves', desc: 'Escore sugestivo de depressão; avaliar intervenção imediata.', tone: 'risk' };
    },
  },
  {
    key: 'mna',
    title: 'MAN / MNA (Mini Avaliação Nutricional)',
    subtitle: 'Triagem (6 itens) + avaliação (omitida nesta versão simplificada). Escore total 0–14.',
    icon: <Salad className="h-5 w-5" />,
    cardTitle: 'MNA',
    max: 14, unit: '/14',
    items: mnaScreenItems,
    interpret: (s) => {
      if (s >= 12) return { label: 'Estado nutricional normal', desc: 'Sem necessidade de intervenção nutricional adicional.', tone: 'ok' };
      if (s >= 8) return { label: 'Risco de desnutrição', desc: 'Recomenda-se realização da avaliação completa (parte B do MNA).', tone: 'warn' };
      return { label: 'Desnutrição', desc: 'Intervenção nutricional e avaliação clínica imediata.', tone: 'risk' };
    },
  },
  {
    key: 'tug',
    title: 'TUG (Timed Up and Go)',
    subtitle: 'Tempo em segundos. O paciente levanta de uma cadeira, caminha 3 metros, gira, volta e senta. Valor 0–300.',
    icon: <Timer className="h-5 w-5" />,
    cardTitle: 'TUG',
    max: 300, unit: ' segundos',
    interpret: (s) => {
      if (s < 10) return { label: 'Mobilidade normal', desc: 'Sem risco aumentado de queda. Independente em transferências.', tone: 'ok' };
      if (s < 20) return { label: 'Risco de queda', desc: 'Independência preservada mas atenção a fatores ambientais.', tone: 'warn' };
      return { label: 'Alto risco de queda', desc: 'Dependência em transferências. Avaliar intervenção e adaptação ambiental.', tone: 'risk' };
    },
  },
];

function sumObj(obj: Record<string, number | undefined>): number {
  return Object.values(obj).reduce<number>((acc, v) => acc + (typeof v === 'number' && !Number.isNaN(v) ? v : 0), 0);
}

function RadioCard({
  item, value, onChange,
}: { item: RadioItem; value: number | undefined; onChange: (v: number) => void }) {
  return (
    <div className="p-4 rounded-m3-xl border border-m3-outline-variant hover:shadow-sm transition-shadow bg-m3-surface-container-lowest">
      <h4 className="text-label-md text-m3-on-surface mb-3 flex items-center gap-2">
        {item.icon}
        {item.label}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {item.options.map((opt) => {
          const checked = value === opt.value;
          return (
            <label
              key={opt.value}
              className={`flex items-start gap-2 p-3 border rounded-m3-lg cursor-pointer transition-colors focus-within:ring-2 ring-m3-primary ${
                checked
                  ? 'bg-m3-surface-container-low border-m3-primary/40'
                  : 'border-m3-outline-variant hover:bg-m3-surface-variant'
              }`}
            >
              <input
                type="radio"
                name={item.id}
                value={opt.value}
                checked={checked}
                onChange={() => onChange(opt.value)}
                className="mt-0.5 accent-m3-primary"
              />
              <span className="flex-1">
                <span className="block text-label-md text-m3-on-surface">
                  {opt.label} ({opt.value})
                </span>
                <span className="block text-label-sm text-m3-secondary mt-1">{opt.desc}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function StatusChip({ tone, label }: { tone: 'ok' | 'warn' | 'risk'; label: string }) {
  const styles = {
    ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warn: 'bg-amber-50 text-amber-700 border-amber-200',
    risk: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-label-sm ${styles[tone]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${tone === 'ok' ? 'bg-emerald-500' : tone === 'warn' ? 'bg-amber-500' : 'bg-rose-500'}`} />
      {label}
    </span>
  );
}

export function AgaTab() {
  const [activeScale, setActiveScale] = useState<ScaleKey>('katz');
  const [katz, setKatz] = useState<Record<string, number | undefined>>({});
  const [lawton, setLawton] = useState<Record<string, number | undefined>>({});
  const [meem, setMeem] = useState<Record<string, number | undefined>>({});
  const [gds15, setGds15] = useState<Record<string, number | undefined>>({});
  const [mna, setMna] = useState<Record<string, number | undefined>>({});
  const [tug, setTug] = useState<Record<string, number | undefined>>({});
  const [observacoes, setObservacoes] = useState('');

  const states: Record<ScaleKey, [Record<string, number | undefined>, React.Dispatch<React.SetStateAction<Record<string, number | undefined>>>]> = {
    katz: [katz, setKatz],
    lawton: [lawton, setLawton],
    meem: [meem, setMeem],
    gds15: [gds15, setGds15],
    mna: [mna, setMna],
    tug: [tug, setTug],
  };

  const scores = useMemo<Record<ScaleKey, number>>(() => ({
    katz: sumObj(katz),
    lawton: sumObj(lawton),
    meem: sumObj(meem),
    gds15: sumObj(gds15),
    mna: sumObj(mna),
    tug: tug['tug-segundos'] ?? 0,
  }), [katz, lawton, meem, gds15, mna, tug]);

  const current = scales.find((s) => s.key === activeScale)!;
  const currentInterp = current.interpret(scores[current.key]);
  const currentItems = current.items ?? [];
  const [currentValues, setCurrentValues] = states[activeScale];

  const activeIdx = scales.findIndex((s) => s.key === activeScale);
  const goPrev = () => setActiveScale(scales[Math.max(0, activeIdx - 1)].key);
  const goNext = () => setActiveScale(scales[Math.min(scales.length - 1, activeIdx + 1)].key);

  const totalAnswered = activeScale === 'tug'
    ? (currentValues['tug-segundos'] !== undefined ? 1 : 0)
    : currentItems.length
      ? currentItems.filter((it) => currentValues[it.id] !== undefined).length
      : 0;

  return (
    <div className="flex flex-col gap-gutter">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-headline-lg text-m3-on-surface">Avaliação Geriátrica Ampla (AGA)</h2>
          <p className="text-body-md text-m3-secondary mt-1">
            Instrumento padronizado para avaliação funcional. Preenchimento rápido.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 text-label-md border-m3-outline-variant text-m3-on-surface hover:bg-m3-surface-variant">
            Cancelar
          </Button>
          <Button className="gap-2 text-label-md bg-m3-primary text-m3-on-primary hover:bg-m3-primary-container hover:text-m3-on-primary-container shadow-sm">
            <Save className="h-4 w-4" /> Salvar Avaliação
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
        <div className="lg:col-span-8 bg-m3-surface rounded-m3-xl border border-m3-outline-variant shadow-sm flex flex-col overflow-hidden">
          <div className="flex border-b border-m3-outline-variant px-2 pt-2 bg-m3-surface-container-lowest sticky top-0 z-10 overflow-x-auto">
            {scales.map((s) => {
              const isActive = activeScale === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setActiveScale(s.key)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors text-label-md whitespace-nowrap ${
                    isActive
                      ? 'border-m3-primary text-m3-on-surface font-semibold'
                      : 'border-transparent text-m3-secondary hover:text-m3-on-surface font-medium'
                  }`}
                >
                  {s.icon}
                  {s.cardTitle}
                </button>
              );
            })}
          </div>

          <div className="p-gutter space-y-gutter">
            <div className="border-l-4 border-m3-primary pl-4 py-1">
              <h3 className="text-title-lg text-m3-on-surface">{current.title}</h3>
              <p className="text-body-md text-m3-secondary">{current.subtitle}</p>
            </div>

            <div className="space-y-4">
              {activeScale === 'tug' ? (
                <div className="p-6 rounded-m3-xl border border-m3-outline-variant bg-m3-surface-container-lowest">
                  <label className="block text-label-md text-m3-on-surface mb-3 flex items-center gap-2">
                    <Timer className="h-4 w-4 text-m3-primary" />
                    Tempo total (segundos)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={300}
                    value={currentValues['tug-segundos'] ?? ''}
                    onChange={(e) => {
                      const v = e.target.value === '' ? undefined : Math.max(0, Math.min(300, Number(e.target.value)));
                      setCurrentValues((prev) => ({ ...prev, 'tug-segundos': v }));
                    }}
                    placeholder="Ex: 14 (segundos)"
                    className="w-full max-w-xs px-4 py-3 bg-m3-background border border-m3-outline-variant rounded-m3-lg focus:ring-2 focus:ring-m3-primary focus:border-transparent text-body-md text-m3-on-surface placeholder-m3-secondary outline-none tabular-nums"
                  />
                  <p className="text-label-sm text-m3-secondary mt-2">
                    Insira o tempo total do teste em segundos (0–300). Pacientes que não conseguem completar o teste devem ser registrados com valor máximo (300).
                  </p>
                </div>
              ) : currentItems.length > 0 ? (
                currentItems.map((item) => (
                  <RadioCard
                    key={item.id}
                    item={item}
                    value={currentValues[item.id]}
                    onChange={(v) => setCurrentValues((prev) => ({ ...prev, [item.id]: v }))}
                  />
                ))
              ) : (
                <p className="text-body-md text-m3-secondary">Selecione uma das escalas acima para iniciar.</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-m3-outline-variant">
              <Button
                variant="outline"
                onClick={goPrev}
                disabled={activeIdx === 0}
                className="gap-2 text-label-md"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <span className="text-label-sm text-m3-secondary">
                {totalAnswered}/{currentItems.length} respondidos
              </span>
              <Button
                onClick={goNext}
                disabled={activeIdx === scales.length - 1}
                className="gap-2 text-label-md bg-m3-primary text-m3-on-primary hover:bg-m3-primary-container hover:text-m3-on-primary-container"
              >
                Próxima <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-gutter">
          <div className="bg-m3-surface rounded-m3-xl border border-m3-outline-variant shadow-sm p-gutter relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-m3-primary/5 rounded-bl-full -z-0" />
            <h3 className="text-title-lg text-m3-on-surface flex items-center gap-2 mb-4 relative z-10">
              <Calculator className="h-5 w-5 text-m3-primary" />
              Resultado Parcial
            </h3>

            <div className="flex items-end gap-3 mb-6 relative z-10">
              <div className="text-display leading-none text-m3-primary tabular-nums">
                {scores[current.key]}
              </div>
              <div className="text-body-md text-m3-secondary pb-1">
                {current.unit} ({current.cardTitle})
              </div>
            </div>

            <div className="space-y-4 relative z-10">
              <div className="p-3 rounded-m3-lg bg-m3-surface-container-low border border-m3-outline-variant">
                <div className="flex items-center gap-2 mb-1">
                  <StatusChip tone={currentInterp.tone} label={currentInterp.label} />
                </div>
                <p className="text-label-sm text-m3-secondary">{currentInterp.desc}</p>
              </div>

              <div className="h-px bg-m3-outline-variant w-full" />

              <div>
                <h4 className="text-label-md text-m3-on-surface mb-2">Resumo das escalas</h4>
                <div className="space-y-1.5">
                  {scales.map((s) => {
                    const sc = scores[s.key];
                    const isCurrent = s.key === activeScale;
                    return (
                      <button
                        key={s.key}
                        onClick={() => setActiveScale(s.key)}
                        className={`flex items-center justify-between w-full px-2 py-1.5 rounded-m3-lg text-label-md transition-colors ${
                          isCurrent
                            ? 'bg-m3-surface-container-low text-m3-on-surface'
                            : 'text-m3-secondary hover:bg-m3-surface-container-low'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-m3-primary">{s.icon}</span>
                          {s.cardTitle}
                        </span>
                        <span className="tabular-nums font-semibold">
                          {sc}{s.unit}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="h-px bg-m3-outline-variant w-full" />

              <div>
                <h4 className="text-label-md text-m3-on-surface mb-2 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-m3-error" /> Evolução clínica
                </h4>
                <p className="text-label-sm text-m3-secondary">
                  Histórico comparativo disponível após salvar a primeira avaliação.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-m3-surface rounded-m3-xl border border-m3-outline-variant shadow-sm p-gutter">
            <h3 className="text-title-lg text-m3-on-surface mb-3">Observações rápidas</h3>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="w-full h-32 p-3 rounded-m3-lg border border-m3-outline-variant bg-m3-background focus:ring-2 focus:ring-m3-primary focus:border-transparent text-body-md text-m3-on-surface resize-none"
              placeholder="Adicione notas contextuais relevantes sobre a performance do paciente..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

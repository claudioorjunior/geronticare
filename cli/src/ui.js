// ponytail: adapter fino sobre @clack/prompts; trocar por outra lib só se o
// contrato de interação mudar (setas/Enter, Space apenas multi-seleção).

export class ErroCancelado extends Error {
  constructor() {
    super('Instalação cancelada pelo usuário.');
    this.name = 'ErroCancelado';
  }
}

export function criarUI({
  promptsFactory = async () => import('@clack/prompts'),
  log = console.log,
} = {}) {
  async function prompts() {
    try {
      return await promptsFactory();
    } catch (error) {
      throw new Error(
        'Não foi possível carregar a interface interativa (@clack/prompts). '
        + 'Verifique a instalação do pacote geronticare.',
        { cause: error },
      );
    }
  }

  return {
    log,
    async introducao(texto) {
      const p = await prompts();
      if (typeof p.intro === 'function') p.intro(texto);
    },
    async conclusao(texto) {
      const p = await prompts();
      if (typeof p.outro === 'function') p.outro(texto);
    },
    async selecionar({ mensagem, opcoes, inicial }) {
      const p = await prompts();
      return aoCancelar(p, await p.select({
        message: mensagem,
        options: opcoes,
        initialValue: inicial,
      }));
    },
    async confirmar({ mensagem, inicial = true }) {
      const p = await prompts();
      return aoCancelar(p, await p.confirm({ message: mensagem, initialValue: inicial }));
    },
    async texto({ mensagem, placeholder, inicial, validacao, mascarado = false }) {
      const p = await prompts();
      const metodo = mascarado ? p.password : p.text;
      const resposta = aoCancelar(p, await metodo({
        message: mensagem,
        placeholder,
        initialValue: inicial,
        validate: validacao,
      }));
      if (validacao) {
        const problema = validacao(resposta);
        if (typeof problema === 'string') {
          throw new Error(problema);
        }
      }
      return resposta;
    },
    async senha({ mensagem, placeholder, validacao }) {
      return this.texto({ mensagem, placeholder, validacao, mascarado: true });
    },
  };
}

function aoCancelar(promptsModulo, valor) {
  if (typeof promptsModulo.isCancel === 'function') {
    if (promptsModulo.isCancel(valor)) throw new ErroCancelado();
    return valor;
  }
  if (typeof valor === 'symbol' && valor.description === 'cancel') {
    throw new ErroCancelado();
  }
  return valor;
}

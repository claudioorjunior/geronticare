#!/usr/bin/env node

import { executarFluxo } from '../src/fluxo.js';
import { ErroCancelado } from '../src/ui.js';

const args = process.argv.slice(2);
const comandoInformado = args[0] ?? 'install';

function uso() {
  console.log(`Uso: geronticare [install|start|doctor|stop|logs|upgrade|rollback] [opções]

  install              Instala ou retoma e inicia o servidor.
  start [--background] Inicia a instalação pronta.
  doctor               Diagnóstico somente leitura.
  stop                 Para o servidor em background.
  logs [-n N] [-f]     Exibe logs do servidor.
  upgrade [--to X.Y.Z] Atualiza para versão alvo (default: latest).
  rollback [--to X.Y.Z] Volta para versão retida.

Requer Node 22 e terminal interativo para install.`);
}

if (comandoInformado === '--help' || comandoInformado === '-h' || comandoInformado === 'help') {
  uso();
  process.exit(0);
}

const COMANDOS = new Set(['install', 'start', 'doctor', 'stop', 'logs', 'upgrade', 'rollback']);
if (!COMANDOS.has(comandoInformado)) {
  console.error(`Comando desconhecido: ${comandoInformado}`);
  uso();
  process.exitCode = 2;
} else {
  const fundo = args.includes('--background');
  const versaoIdx = args.indexOf('--to');
  const versaoAlvo = versaoIdx >= 0 ? args[versaoIdx + 1] : null;
  const nIdx = args.indexOf('-n');
  const linhasLog = nIdx >= 0 ? Number.parseInt(args[nIdx + 1], 10) : 100;
  const seguirLog = args.includes('-f') || args.includes('--follow');
  try {
    await executarFluxo({ comando: comandoInformado, fundo, versaoAlvo, linhasLog, seguirLog });
  } catch (error) {
    if (error instanceof ErroCancelado) {
      console.error('Instalação cancelada.');
      process.exitCode = 130;
    } else {
      console.error(error instanceof Error ? error.message : 'Falha ao executar o GerontiCare.');
      process.exitCode = 1;
    }
  }
}

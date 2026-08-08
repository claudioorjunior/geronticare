#!/usr/bin/env node

import { executarFluxo } from '../src/fluxo.js';
import { ErroCancelado } from '../src/ui.js';

const [,, comandoInformado = 'install'] = process.argv;

function uso() {
  console.log(`Uso: geronticare [install|start|doctor]

  install   Instala ou retoma uma instalação incompleta e inicia o servidor.
  start     Inicia uma instalação pronta, sem reconfigurar banco.
  doctor    Diagnóstico somente leitura da instalação.

Requer Node 22 e terminal interativo para install.`);
}

if (comandoInformado === '--help' || comandoInformado === '-h' || comandoInformado === 'help') {
  uso();
  process.exit(0);
}

const COMANDOS = new Set(['install', 'start', 'doctor']);
if (!COMANDOS.has(comandoInformado)) {
  console.error(`Comando desconhecido: ${comandoInformado}`);
  uso();
  process.exitCode = 2;
} else {
  try {
    await executarFluxo({ comando: comandoInformado });
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

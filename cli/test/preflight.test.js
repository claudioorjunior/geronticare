import assert from 'node:assert/strict';
import test from 'node:test';

import { validarPreflight } from '../src/preflight.js';

test('aceita Node 22 em terminal interativo', () => {
  assert.doesNotThrow(() => validarPreflight({ nodeVersion: 'v22.20.0', isTTY: true }));
});

test('rejeita versão diferente de Node 22', () => {
  assert.throws(
    () => validarPreflight({ nodeVersion: 'v23.0.0', isTTY: true }),
    /Node 22/,
  );
});

test('rejeita instalação sem terminal interativo', () => {
  assert.throws(
    () => validarPreflight({ nodeVersion: 'v22.20.0', isTTY: false }),
    /terminal interativo/,
  );
});

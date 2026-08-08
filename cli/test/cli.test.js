import assert from 'node:assert/strict';
import test from 'node:test';

import { resolverHome } from '../src/cli.js';

test('resolve o diretório persistente por sistema ou override', () => {
  assert.equal(
    resolverHome({ env: { GERONTICARE_HOME: '/tmp/custom' }, platform: 'linux', home: '/home/u' }),
    '/tmp/custom',
  );
  assert.equal(
    resolverHome({ env: {}, platform: 'darwin', home: '/Users/u' }),
    '/Users/u/Library/Application Support/GerontiCare',
  );
  assert.equal(
    resolverHome({ env: { XDG_DATA_HOME: '/data' }, platform: 'linux', home: '/home/u' }),
    '/data/geronticare',
  );
  assert.equal(
    resolverHome({ env: { LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' }, platform: 'win32', home: '' }),
    'C:\\Users\\u\\AppData\\Local\\GerontiCare',
  );
});

test('usa a home do sistema quando nenhum override é informado', () => {
  assert.doesNotThrow(() => resolverHome({ env: {}, platform: 'darwin' }));
});

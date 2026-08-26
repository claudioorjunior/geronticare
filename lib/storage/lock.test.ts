import { describe, expect, it, vi } from 'vitest';

vi.mock('drizzle-orm', () => ({
  sql: (_strings: TemplateStringsArray, ...values: unknown[]) => ({ values }),
}));

describe('bloquearChavesAnexo', () => {
  it('deduplica e ordena chaves antes de adquirir os locks', async () => {
    const execute = vi.fn();
    const { bloquearChavesAnexo } = await import('./lock');

    await bloquearChavesAnexo({ execute }, ['z', 'a', 'z', 'm']);

    expect(execute.mock.calls.map(([query]) => query.values)).toEqual([
      ['a'],
      ['m'],
      ['z'],
    ]);
  });
});

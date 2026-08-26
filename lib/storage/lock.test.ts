import { describe, expect, it, vi } from 'vitest';

vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    text: strings.join('?'),
    values,
  }),
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
    expect(execute.mock.calls[0][0].text).toContain(
      'pg_advisory_xact_lock(hashtextextended(?, 0))',
    );
  });
});

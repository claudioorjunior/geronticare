import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrapConcluidoAposConflito } from '@/app/setup/setup-form';

describe('bootstrapConcluidoAposConflito', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('accepts a lost POST only after GET confirms a complete installation', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ necessario: false })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        necessario: false,
        inconsistente: true,
      })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(bootstrapConcluidoAposConflito()).resolves.toBe(true);
    await expect(bootstrapConcluidoAposConflito()).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledWith('/api/setup', { cache: 'no-store' });
  });
});

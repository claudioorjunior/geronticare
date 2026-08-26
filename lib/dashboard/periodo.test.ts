import { describe, expect, it } from 'vitest';
import {
  TZ_INSTITUICAO,
  civilDateInTimeZone,
  rollingWindowStart,
  startOfZonedDay,
  startOfZonedMonth,
} from './periodo';

describe('periodo institucional (America/Sao_Paulo)', () => {
  it('corta o dia civil em São Paulo, não no UTC do host', () => {
    const now = new Date('2026-08-13T02:30:00.000Z');
    const start = startOfZonedDay(now, TZ_INSTITUICAO);
    expect(civilDateInTimeZone(start, TZ_INSTITUICAO)).toEqual({
      year: 2026,
      month: 8,
      day: 12,
    });
    expect(start.toISOString()).toBe('2026-08-12T03:00:00.000Z');
  });

  it('corta o mês civil em São Paulo no dia 1 às 00:00 locais', () => {
    const now = new Date('2026-08-13T15:00:00.000Z');
    const start = startOfZonedMonth(now, TZ_INSTITUICAO);
    expect(civilDateInTimeZone(start, TZ_INSTITUICAO)).toEqual({
      year: 2026,
      month: 8,
      day: 1,
    });
    expect(start.toISOString()).toBe('2026-08-01T03:00:00.000Z');
  });

  it('janela rolante de 7 dias é relógio, não semana calendário', () => {
    const now = new Date('2026-08-13T15:00:00.000Z');
    expect(rollingWindowStart(now, 7).toISOString()).toBe('2026-08-06T15:00:00.000Z');
  });
});

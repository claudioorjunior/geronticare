export const TZ_INSTITUICAO = 'America/Sao_Paulo';

export function civilDateInTimeZone(
  now: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: num('year'), month: num('month'), day: num('day') };
}

function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    num('year'),
    num('month') - 1,
    num('day'),
    num('hour'),
    num('minute'),
    num('second'),
  );
  return asUtc - date.getTime();
}

export function startOfZonedDay(now: Date, timeZone = TZ_INSTITUICAO): Date {
  const { year, month, day } = civilDateInTimeZone(now, timeZone);
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0);
  return new Date(utcGuess - tzOffsetMs(new Date(utcGuess), timeZone));
}

export function startOfZonedMonth(now: Date, timeZone = TZ_INSTITUICAO): Date {
  const { year, month } = civilDateInTimeZone(now, timeZone);
  const utcGuess = Date.UTC(year, month - 1, 1, 0, 0, 0);
  return new Date(utcGuess - tzOffsetMs(new Date(utcGuess), timeZone));
}

export function rollingWindowStart(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

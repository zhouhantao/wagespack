import { Decimal } from 'decimal.js';
import { Temporal } from '@js-temporal/polyfill';

export interface Schedule {
  zone: string;
  rate: string;
  basis: 'month' | 'day' | 'hour';
  days: number[];
  start: string;
  end: string;
  breakStart: string;
  breakEnd: string;
  exceptions: Record<string, 'paid' | 'unpaid'>;
}
type DateKey = Temporal.PlainDate;
type Interval = readonly [number, number];

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const midnight = Temporal.PlainTime.from('00:00');
const duration = ([start, end]: Interval) => end - start;
const sum = (periods: Interval[]) => periods.reduce((total, period) => total + duration(period), 0);

export function typicalShiftHours(config: Schedule) {
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const span = (start: string, end: string) => (minutes(end) - minutes(start) + 1440) % 1440;
  return Math.max(0, span(config.start, config.end) - (config.breakStart ? span(config.breakStart, config.breakEnd) : 0)) / 60;
}

export function validateSchedule(config: Schedule) {
  if (!/^\d{1,12}(?:\.\d{1,4})?$/.test(config.rate)) throw new Error('Invalid salary');
  if (!['month', 'day', 'hour'].includes(config.basis)) throw new Error('Invalid pay period');
  if (!config.days.every(day => Number.isInteger(day) && day >= 1 && day <= 7)) throw new Error('Invalid weekdays');
  if (!timePattern.test(config.start) || !timePattern.test(config.end) || config.start === config.end) {
    throw new Error('Invalid shift');
  }
  if (config.breakStart || config.breakEnd) {
    if (!timePattern.test(config.breakStart) || !timePattern.test(config.breakEnd)) throw new Error('Invalid break');
    const offset = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      const [baseH, baseM] = config.start.split(':').map(Number);
      return (h * 60 + m - baseH * 60 - baseM + 1440) % 1440;
    };
    if (offset(config.breakStart) >= offset(config.breakEnd) || offset(config.breakEnd) > offset(config.end)) {
      throw new Error('Break must lie inside shift');
    }
  }
  Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(config.zone);
}

function shift(config: Schedule, date: DateKey) {
  if (!config.days.includes(date.dayOfWeek)) return null;
  const boundary = (time: string) => {
    const day = time < config.start ? date.add({ days: 1 }) : date;
    return day.toZonedDateTime({ timeZone: config.zone, plainTime: time }).epochMilliseconds;
  };
  const start = boundary(config.start);
  const end = Math.max(start, boundary(config.end));
  let periods: Interval[] = [[start, end]];
  if (config.breakStart) {
    const breakStart = Math.max(start, Math.min(end, boundary(config.breakStart)));
    const breakEnd = Math.max(breakStart, Math.min(end, boundary(config.breakEnd)));
    periods = [[start, breakStart], [breakEnd, end]];
  }
  return { start, end, periods };
}

export function projectWorkFinish(config: Schedule, now: number, remainingHours: number) {
  if (!Number.isFinite(remainingHours) || !config.days.length) return null;
  if (remainingHours <= 0) return now;
  let remaining = Math.ceil(remainingHours * 3600000);
  const today = Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(config.zone).toPlainDate();
  for (let offset = -1; offset <= 3660; offset++) {
    const day = today.add({ days: offset });
    const leave = config.exceptions[day.toString()];
    if (leave && !(leave === 'paid' && config.basis === 'month')) continue;
    for (const [start, end] of shift(config, day)?.periods ?? []) {
      const begins = Math.max(now, start);
      if (end <= begins) continue;
      if (remaining <= end - begins) return begins + remaining;
      remaining -= end - begins;
    }
  }
  return null;
}

const monthlyTime = new WeakMap<Schedule, { key: string; total: number }>();
function monthDuration(config: Schedule, date: DateKey) {
  const first = date.with({ day: 1 });
  const key = JSON.stringify([first.toString(), config.days, config.start, config.end, config.breakStart, config.breakEnd, config.zone]);
  const cached = monthlyTime.get(config);
  if (cached?.key === key) return cached.total;
  let total = 0;
  for (let day = 1; day <= first.daysInMonth; day++) {
    total += sum(shift(config, first.with({ day }))?.periods ?? []);
  }
  monthlyTime.set(config, { key, total });
  return total;
}

export function estimate(config: Schedule, now: number, day?: string) {
  validateSchedule(config);
  const local = Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(config.zone).toPlainDate();
  const yesterday = local.subtract({ days: 1 });
  const previous = shift(config, yesterday);
  const date = day ? Temporal.PlainDate.from(day) : previous && previous.end > now ? yesterday : local;
  const planned = shift(config, date);
  const exception = planned ? config.exceptions[date.toString()] : undefined;
  const eligible = !exception || (exception === 'paid' && config.basis === 'month');
  const periods = eligible ? planned?.periods ?? [] : [];
  const elapsed = periods.reduce((total, [start, end]) => total + Math.max(0, Math.min(now, end) - start), 0);
  const base = config.basis === 'month' ? monthDuration(config, date)
    : config.basis === 'day' ? sum(planned?.periods ?? []) : 3600000;
  const perMs = base > 0 ? new Decimal(config.rate).div(base) : new Decimal(0);
  const active = periods.some(([start, end]) => now >= start && now < end);
  const state: 'paid' | 'unpaid' | 'off' | 'waiting' | 'finished' | 'working' | 'break' = exception ?? (!planned ? 'off' : now < planned.start ? 'waiting'
    : now >= planned.end ? 'finished' : active ? 'working' : 'break');
  let next = state === 'waiting' ? planned?.start : undefined;
  for (let offset = 1; !day && next === undefined && offset <= 370 && config.days.length; offset++) {
    const candidate = date.add({ days: offset });
    const start = shift(config, candidate)?.start;
    if (start && start > now && !config.exceptions[candidate.toString()]) next = start;
  }
  return {
    date: date.toString(), state, amount: perMs.mul(elapsed), perSecond: active ? perMs.mul(1000) : new Decimal(0),
    basisHours: base / 3600000, nominalPerSecond: perMs.mul(1000),
    progress: sum(periods) ? elapsed / sum(periods) : 0, next, start: planned?.start, end: eligible ? planned?.end : undefined
  };
}

export function averageMonth(config: Schedule, now: number) {
  if (config.basis !== 'month') return null;
  const local = Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(config.zone).toPlainDate();
  const month = local.with({ day: 1 });
  const stamp = (day: DateKey) => day.toZonedDateTime({ timeZone: config.zone, plainTime: midnight }).epochMilliseconds;
  return new Decimal(config.rate).mul(now - stamp(local)).div(stamp(month.add({ months: 1 })) - stamp(month));
}

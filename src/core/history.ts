import { Temporal } from '@js-temporal/polyfill';
import { Decimal } from 'decimal.js';
import { estimate, type Schedule } from './earnings';

export type Version = { from: number; schedule: Schedule };

export function currentSchedule(versions: Version[], now: number): Schedule {
  return versions.findLast(version => version.from <= now)?.schedule ?? versions[0].schedule;
}

export function queueSchedule(versions: Version[], schedule: Schedule, now: number): Version[] {
  const active = versions.filter(version => version.from <= now);
  const previous = currentSchedule(versions, now);
  const current = estimate(previous, now);
  const next = estimate(schedule, now);
  const boundary = current.start !== undefined && current.start <= now && current.end !== undefined && now < current.end
    ? current.end : now;
  const start = estimate(schedule, boundary).next;
  return [...active, { from: start ?? Math.max(boundary, next.start ?? now), schedule }];
}

export function periodTotal(versions: Version[], from: string, through: string, now: number) {
  let day = Temporal.PlainDate.from(from);
  const end = Temporal.PlainDate.from(through);
  let total = new Decimal(0);
  for (; Temporal.PlainDate.compare(day, end) <= 0; day = day.add({ days: 1 })) {
    for (let i = versions.length - 1; i >= 0; i--) {
      const version = versions[i];
      if (version.from > now) continue;
      const result = estimate(version.schedule, now, day.toString());
      if (result.start !== undefined && result.start >= version.from && result.start < (versions[i + 1]?.from ?? Infinity)) {
        total = total.plus(result.amount);
        break;
      }
    }
  }
  return total;
}

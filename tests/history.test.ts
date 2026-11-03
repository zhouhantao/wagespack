import { expect, test } from 'vitest';
import { estimate, type Schedule } from '../src/core/earnings';
import { currentSchedule, queueSchedule, periodTotal } from '../src/core/history';

const before: Schedule = {
  zone: 'Asia/Shanghai', rate: '100', basis: 'day', days: [1, 2, 3, 4, 5],
  start: '09:00', end: '18:00', breakStart: '', breakEnd: '', exceptions: {}
};
const t = (text: string) => Date.parse(text + '+08:00');

test('applies a changed salary next shift and keeps the previous shift estimate', () => {
  const now = t('2026-11-03T12:00:00');
  const versions = queueSchedule([{ from: 0, schedule: before }], { ...before, rate: '200' }, now);
  expect(estimate(currentSchedule(versions, now), now).amount.toFixed(2)).toBe('33.33');
  const next = t('2026-11-04T18:00:00');
  expect(estimate(currentSchedule(versions, next), next).amount.toFixed(2)).toBe('200.00');
  expect(periodTotal(versions, '2026-11-03', '2026-11-04', next).toFixed(2)).toBe('300.00');
});

import { describe, expect, it } from 'vitest';
import { estimate, projectWorkFinish, type Schedule } from '../src/core/earnings';

const schedule: Schedule = {
  zone: 'Asia/Shanghai', rate: '80', basis: 'hour', days: [1, 2, 3, 4, 5],
  start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00', exceptions: {}
};
const at = (time: string, config = schedule) => estimate(config, new Date(time).getTime());

describe('work estimates', () => {
  it('projects a goal across lunch, the weekend and unpaid leave', () => {
    const config: Schedule = { ...schedule, exceptions: { '2026-11-09': 'unpaid' } };
    const now = Date.parse('2026-11-06T11:30:00+08:00');
    expect(projectWorkFinish(config, now, 6)).toBe(Date.parse('2026-11-10T09:30:00+08:00'));
  });
  it('exposes the actual monthly denominator and unrounded rate for a 6,000 monthly salary', () => {
    const config: Schedule = { ...schedule, basis: 'month', rate: '6000' };
    const result = at('2026-11-03T11:00:00+08:00', config);
    expect(result.basisHours).toBe(168);
    expect(result.nominalPerSecond.toFixed(5)).toBe('0.00992');
    expect(result.amount.toFixed(2)).toBe('71.43');
    const lunch = at('2026-11-03T12:30:00+08:00', config);
    expect(lunch.perSecond.toFixed(5)).toBe('0.00000');
    expect(lunch.nominalPerSecond.toFixed(5)).toBe('0.00992');
  });
  it('uses elapsed time directly, excluding lunch', () => {
    expect(at('2026-11-03T12:30:00+08:00').amount.toFixed(2)).toBe('240.00');
    expect(at('2026-11-03T14:30:00+08:00').amount.toFixed(2)).toBe('360.00');
    expect(at('2026-11-03T12:30:00+08:00').state).toBe('break');
  });
  it('attributes an overnight shift to its start date across a month boundary', () => {
    const night = { ...schedule, days: [6], start: '22:00', end: '06:00', breakStart: '', breakEnd: '' };
    const result = at('2026-11-01T02:00:00+08:00', night);
    expect(result.date).toBe('2026-10-31');
    expect(result.amount.toFixed(2)).toBe('320.00');
  });
  it('uses real elapsed seconds during a spring forward', () => {
    const dst = { ...schedule, zone: 'America/New_York', days: [7], start: '00:00', end: '08:00', breakStart: '', breakEnd: '' };
    expect(at('2026-03-08T08:00:00-04:00', dst).amount.toFixed(2)).toBe('560.00');
  });
  it('keeps the monthly denominator on unpaid leave', () => {
    const config: Schedule = { ...schedule, basis: 'month', rate: '2100', exceptions: { '2026-11-02': 'unpaid' } };
    expect(at('2026-11-02T18:00:00+08:00', config).amount.toFixed(2)).toBe('0.00');
    expect(at('2026-11-03T18:00:00+08:00', config).amount.toFixed(2)).toBe('100.00');
  });
  it('only imputes paid leave earnings for monthly salary', () => {
    const config: Schedule = { ...schedule, exceptions: { '2026-11-03': 'paid' } };
    expect(at('2026-11-03T18:00:00+08:00', config).amount.toFixed(2)).toBe('0.00');
    const paid = at('2026-11-03T18:00:00+08:00', { ...config, basis: 'month', rate: '2100' });
    expect(paid.amount.toFixed(2)).toBe('100.00');
    expect(paid.state).toBe('paid');
  });
  it('handles no schedule and zero salary and rejects negative rates', () => {
    expect(at('2026-11-03T18:00:00+08:00', { ...schedule, days: [] }).state).toBe('off');
    expect(at('2026-11-03T14:00:00+08:00', { ...schedule, rate: '0' }).amount.toString()).toBe('0');
    expect(() => at('2026-11-03T14:00:00+08:00', { ...schedule, rate: '-1' })).toThrow();
  });
});

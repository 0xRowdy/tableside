// Spec 1 Exact money and limits, Game rules, user story 9
import type { TestCase } from '@tableside/harness';

import { checkLimitInput } from '../src';

const check = (min: string, max: string) => {
  const result = checkLimitInput(min, max);
  return { min: result.min, max: result.max, minAboveMax: result.minAboveMax, limit: result.limit };
};

export const limitCases: TestCase[] = [
  {
    name: 'limits: whole positive amounts within the ceiling become the canonical limit, even with leading zeros, a plus sign, spaces or a zero fraction',
    run(t) {
      t.equal(check('10', '1000'), { min: null, max: null, minAboveMax: false, limit: { min: '10', max: '1000' } });
      t.equal(check('1', '1'), { min: null, max: null, minAboveMax: false, limit: { min: '1', max: '1' } });
      t.equal(check('1', '1000000'), { min: null, max: null, minAboveMax: false, limit: { min: '1', max: '1000000' } });
      t.equal(check(' 010 ', '+25.00'), { min: null, max: null, minAboveMax: false, limit: { min: '10', max: '25' } });
    },
  },
  {
    name: 'limits: a minimum above the maximum is reported, not swapped',
    run(t) {
      t.equal(check('1500', '1000'), { min: null, max: null, minAboveMax: true, limit: null });
    },
  },
  {
    name: 'limits: non-positive, non-whole, missing, unreadable and over-ceiling amounts are each named, and order is judged only between two good amounts',
    run(t) {
      t.equal(check('0', '-5'), { min: 'not-positive', max: 'not-positive', minAboveMax: false, limit: null });
      t.equal(check('-0.5', '10.5'), { min: 'not-positive', max: 'not-whole', minAboveMax: false, limit: null });
      t.equal(check('', '1e3'), { min: 'missing', max: 'not-a-number', minAboveMax: false, limit: null });
      t.equal(check('10', '1000001'), { min: null, max: 'over-ceiling', minAboveMax: false, limit: null });
      t.equal(check('1'.repeat(200), '12abc'), { min: 'not-a-number', max: 'not-a-number', minAboveMax: false, limit: null });
      t.equal(check('2000000', '1000'), { min: 'over-ceiling', max: null, minAboveMax: false, limit: null });
    },
  },
];

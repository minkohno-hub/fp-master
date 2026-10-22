import { describe, expect, it } from 'vitest';
import { Frac } from '../../src/domain/decimal';

describe('Frac（厳密な有理数演算）', () => {
  it('0.1 + 0.2 が厳密に 0.3 になる', () => {
    expect(Frac.of('0.1').add(Frac.of('0.2')).cmp(Frac.of('0.3'))).toBe(0);
  });
  it('四捨五入（half-up）', () => {
    expect(Frac.of('1.245').round(2).toDecimalString()).toBe('1.25');
    expect(Frac.of('1.244').round(2).toDecimalString()).toBe('1.24');
    expect(Frac.of('-1.245').round(2).toDecimalString()).toBe('-1.25');
  });
  it('切捨て・切上げ・千円未満切捨て', () => {
    expect(Frac.of('1.999').round(0, 'floor').toNumber()).toBe(1);
    expect(Frac.of('1.001').round(0, 'ceil').toNumber()).toBe(2);
    expect(Frac.of(1234567).round(-3, 'floor').toNumber()).toBe(1234000);
  });
  it('分数の表示', () => {
    expect(Frac.of(1, 3).toDecimalString(5)).toBe('0.33333');
    expect(Frac.of(2, 3).round(3).toDecimalString()).toBe('0.667');
  });
  it('累乗', () => {
    expect(Frac.of('1.02').pow(10).round(3).toDecimalString()).toBe('1.219');
  });
});

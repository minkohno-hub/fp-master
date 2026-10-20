import { describe, expect, it } from 'vitest';
import { compoundAmount, createSimpleInterestPractice, decimalToScaled, divideRounded, formatScaled, ratioPercent, simpleInterest } from './calculations';
describe('exact arithmetic',()=>{
 it('calculates interest without binary floating-point error',()=>{
  expect(simpleInterest(1000000n,200n,3n)).toBe(60000n);
  expect(compoundAmount(1000000n,200n,3)).toBe(1061208n);
  expect(ratioPercent(80n,200n)).toBe('40');
 });
 it('distinguishes floor, ceil and half-up, including negative values',()=>{
  expect(divideRounded(15n,10n,'half-up')).toBe(2n);expect(divideRounded(-15n,10n,'half-up')).toBe(-2n);
  expect(divideRounded(-11n,10n,'floor')).toBe(-2n);expect(divideRounded(-11n,10n,'ceil')).toBe(-1n);
  expect(decimalToScaled('0.105',2,'half-up')).toBe(11n);expect(decimalToScaled('0.105',2,'floor')).toBe(10n);
  expect(formatScaled(-5n,2)).toBe('-0.05');
 });
 it('accepts full-width decimal digits, rejects units and exponents and invalid parameters',()=>{
  expect(decimalToScaled('１２０．５',1,'half-up')).toBe(1205n);
  expect(()=>decimalToScaled('120円',0,'floor')).toThrow();expect(()=>decimalToScaled('1e3',0,'floor')).toThrow();
  expect(()=>divideRounded(1n,0n,'floor')).toThrow();expect(()=>compoundAmount(1n,1n,101)).toThrow();
 });
 it('recomputes parameterized problem answers deterministically',()=>{
  const a=createSimpleInterestPractice(2000000n,150n,2);expect(a.answerYen).toBe(60000n);expect(a.steps[2]).toContain('60000円');
  expect(createSimpleInterestPractice(3000000n,150n,2).answerYen).toBe(90000n);
 });
});

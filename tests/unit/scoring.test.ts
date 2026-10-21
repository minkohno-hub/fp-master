import { describe, expect, it } from 'vitest';
import { numericEquals, scoreQuestion } from '../../src/domain/scoring';
import type { Part } from '../../src/domain/types';

const tf: Part = { kind: 'truefalse', id: 'p1', answer: false };
const choice: Part = { kind: 'choice', id: 'p1', choices: [{ id: '1', text: 'a' }, { id: '2', text: 'b' }, { id: '3', text: 'c' }], answer: '2' };

describe('正答判定', () => {
  it('正誤式', () => {
    expect(scoreQuestion({ parts: [tf] }, { p1: { kind: 'truefalse', value: false } }).correct).toBe(true);
    expect(scoreQuestion({ parts: [tf] }, { p1: { kind: 'truefalse', value: true } }).correct).toBe(false);
  });
  it('択一式', () => {
    expect(scoreQuestion({ parts: [choice] }, { p1: { kind: 'choice', value: '2' } }).correct).toBe(true);
    expect(scoreQuestion({ parts: [choice] }, { p1: { kind: 'choice', value: '1' } }).correct).toBe(false);
  });
  it('未回答は不正解・未完了', () => {
    const r = scoreQuestion({ parts: [choice] }, {});
    expect(r.correct).toBe(false);
    expect(r.complete).toBe(false);
  });
  it('種類の異なる解答は未回答扱い', () => {
    const r = scoreQuestion({ parts: [choice] }, { p1: { kind: 'truefalse', value: true } });
    expect(r.parts[0]!.answered).toBe(false);
  });
});

describe('複数解答欄の採点', () => {
  const parts: Part[] = [
    { ...choice, id: 'a' },
    { kind: 'numeric', id: 'b', answer: 1250000, unit: '円' },
    { kind: 'truefalse', id: 'c', answer: true },
  ];
  it('全欄正解で正解', () => {
    const r = scoreQuestion({ parts }, { a: { kind: 'choice', value: '2' }, b: { kind: 'numeric', value: 1250000 }, c: { kind: 'truefalse', value: true } });
    expect(r.correct).toBe(true);
    expect(r.parts.every((p) => p.correct)).toBe(true);
  });
  it('1欄でも誤りなら不正解（欄ごとの正誤は保持）', () => {
    const r = scoreQuestion({ parts }, { a: { kind: 'choice', value: '2' }, b: { kind: 'numeric', value: 1250001 }, c: { kind: 'truefalse', value: true } });
    expect(r.correct).toBe(false);
    expect(r.parts.map((p) => p.correct)).toEqual([true, false, true]);
  });
});

describe('数値入力の比較（浮動小数点誤差）', () => {
  it('0.1+0.2 と 0.3 を等しいとみなす', () => {
    expect(numericEquals(0.1 + 0.2, 0.3)).toBe(true);
  });
  it('小数第2位までの利回り', () => {
    expect(numericEquals(1.15, 1.15)).toBe(true);
    expect(numericEquals(1.16, 1.15)).toBe(false);
  });
  it('NaN は不正解', () => {
    expect(numericEquals(Number.NaN, 1)).toBe(false);
  });
});

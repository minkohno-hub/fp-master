/** Decimal arithmetic uses integers. Never use binary floating-point tolerance for financial answers. */
export type Rounding = 'floor' | 'ceil' | 'half-up';
export function divideRounded(numerator: bigint, denominator: bigint, rounding: Rounding): bigint {
  if (denominator <= 0n) throw new RangeError('分母は正の整数で指定してください');
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n) return quotient;
  if (rounding === 'floor') return numerator < 0n ? quotient - 1n : quotient;
  if (rounding === 'ceil') return numerator > 0n ? quotient + 1n : quotient;
  return (remainder < 0n ? -remainder : remainder) * 2n >= denominator ? quotient + (numerator < 0n ? -1n : 1n) : quotient;
}
export function decimalToScaled(value: string, decimalPlaces: number, rounding: Rounding): bigint {
  if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 8) throw new RangeError('精度は0〜8桁です');
  const normalized = value.trim().replace(/[０-９．－＋]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  // Units, thousands separators and exponent notation must never be silently ignored.
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized) || normalized.length > 100) throw new TypeError('数値のみを入力してください');
  const negative = normalized.startsWith('-');
  const [whole, fraction = ''] = normalized.replace(/^[+-]/, '').split('.');
  const integer = BigInt(whole + fraction) * (negative ? -1n : 1n);
  return divideRounded(integer * 10n ** BigInt(decimalPlaces), 10n ** BigInt(fraction.length), rounding);
}
export function formatScaled(value: bigint, decimalPlaces: number): string {
  if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 8) throw new RangeError('精度は0〜8桁です');
  const sign = value < 0n ? '-' : '';
  const digits = (value < 0n ? -value : value).toString().padStart(decimalPlaces + 1, '0');
  return sign + (decimalPlaces === 0 ? digits : `${digits.slice(0, -decimalPlaces)}.${digits.slice(-decimalPlaces)}`);
}
export function simpleInterest(principalYen: bigint, annualBasisPoints: bigint, years: bigint, rounding: Rounding = 'floor'): bigint {
  if (principalYen < 0n || annualBasisPoints < 0n || years < 0n) throw new RangeError('元本・利率・期間は0以上です');
  return divideRounded(principalYen * annualBasisPoints * years, 10000n, rounding);
}
export function compoundAmount(principalYen: bigint, annualBasisPoints: bigint, years: number, rounding: Rounding = 'floor'): bigint {
  if (principalYen < 0n || annualBasisPoints < 0n || !Number.isInteger(years) || years < 0 || years > 100) throw new RangeError('元本・利率・期間を確認してください');
  // Round once at maturity, not at every year. The caller must state this convention in the prompt.
  return divideRounded(principalYen * (10000n + annualBasisPoints) ** BigInt(years), 10000n ** BigInt(years), rounding);
}
export function ratioPercent(numerator: bigint, denominator: bigint, decimalPlaces = 0, rounding: Rounding = 'half-up'): string {
  if (numerator < 0n || denominator <= 0n) throw new RangeError('分子は0以上、分母は正数です');
  return formatScaled(divideRounded(numerator * 100n * 10n ** BigInt(decimalPlaces), denominator, rounding), decimalPlaces);
}
export interface ArithmeticPractice {
  principalYen: bigint;
  rateBasisPoints: bigint;
  years: number;
  answerYen: bigint;
  formula: string;
  steps: string[];
}
/** Parameter changes remain deterministic and recompute the answer. Not an official FP question. */
export function createSimpleInterestPractice(principalYen: bigint, rateBasisPoints: bigint, years: number): ArithmeticPractice {
  if (!Number.isSafeInteger(years) || years < 0 || years > 100) throw new RangeError('期間は0〜100年です');
  const answerYen = simpleInterest(principalYen, rateBasisPoints, BigInt(years));
  const rate = formatScaled(rateBasisPoints, 2);
  return { principalYen, rateBasisPoints, years, answerYen, formula: '利息 = 元本 × 年利率 × 年数', steps: [`年利${rate}%を小数の利率に直す`, `${principalYen} × ${rateBasisPoints} ÷ 10000 × ${years}`, `利息は${answerYen}円（税金を考慮せず、1円未満切り捨て）`] };
}

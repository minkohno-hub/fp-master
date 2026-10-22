import type { CalcGenerator } from './types';
import { bondYieldGenerator, coefficientGenerator, interestGenerator, stockIndicatorGenerator } from './finance';
import { giftTaxGenerator, incomeTaxGenerator, medicalDeductionGenerator, retirementIncomeGenerator } from './tax';
import { buildingCoverageGenerator, capitalGainGenerator, floorAreaRatioGenerator } from './realestate';
import { basicDeductionGenerator, legalShareGenerator } from './inheritance';
import { basicPensionGenerator, deferralGenerator } from './pension';

export * from './types';

/** 計算トレーニングの生成器（分野順） */
export const CALC_GENERATORS: CalcGenerator[] = [
  coefficientGenerator,
  deferralGenerator,
  basicPensionGenerator,
  interestGenerator,
  bondYieldGenerator,
  stockIndicatorGenerator,
  incomeTaxGenerator,
  retirementIncomeGenerator,
  medicalDeductionGenerator,
  buildingCoverageGenerator,
  floorAreaRatioGenerator,
  capitalGainGenerator,
  legalShareGenerator,
  basicDeductionGenerator,
  giftTaxGenerator,
];

export function getGenerator(id: string): CalcGenerator | undefined {
  return CALC_GENERATORS.find((g) => g.id === id);
}

/** 問題IDから再生成（`${generatorId}:${difficulty}:${seed}`） */
export function regenerate(problemId: string) {
  const [gid, d, s] = problemId.split(':');
  const g = getGenerator(gid ?? '');
  if (!g) return undefined;
  return g.generate(Number(s), Number(d) as 1 | 2 | 3);
}

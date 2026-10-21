import { Frac } from '../decimal';
import { createRng, pick, randInt } from '../random';
import type { CalcGenerator, CalcProblem } from './types';

const fmt = (n: number) => n.toLocaleString('ja-JP');

export const deferralGenerator: CalcGenerator = {
  id: 'pension-deferral',
  title: '年金の繰上げ・繰下げ',
  field: 'A',
  grades: [2, 3],
  sources: [
    { title: '日本年金機構 年金の繰下げ受給', url: 'https://www.nenkin.go.jp/service/jukyu/roureinenkin/kuriage-kurisage/20140421-02.html' },
    { title: '日本年金機構 年金の繰上げ受給', url: 'https://www.nenkin.go.jp/service/jukyu/roureinenkin/kuriage-kurisage/20140421-01.html' },
  ],
  basis: '繰上げ減額率 0.4％×月数（昭和37年4月2日以後生まれ）、繰下げ増額率 0.7％×月数（最大120月）',
  generate(seed, difficulty): CalcProblem {
    const rng = createRng(seed);
    const defer = difficulty === 1 ? true : rng() < 0.5;
    const base = randInt(rng, 60, 200) * 10_000;
    const months = defer ? pick(rng, difficulty === 1 ? [12, 24, 36, 60] : [12, 18, 24, 30, 36, 48, 60, 84, 120]) : pick(rng, [6, 12, 24, 36, 48, 60]);
    const rate = defer ? Frac.of('0.007').mul(months) : Frac.of('0.004').mul(months);
    const amount = Frac.of(base).mul(defer ? Frac.of(1).add(rate) : Frac.of(1).sub(rate));
    const ans = amount.round(0).toNumber();
    const startAge = defer ? 65 + months / 12 : 65 - months / 12;
    return {
      id: `pension-deferral:${difficulty}:${seed}`,
      generatorId: 'pension-deferral',
      pattern: defer ? '繰下げ受給' : '繰上げ受給',
      prompt: `65歳から受け取る場合の老齢基礎年金額が年${fmt(base)}円である人（1962年4月2日以後生まれ）が、${Number.isInteger(startAge) ? `${startAge}歳` : `65歳${defer ? 'から' : 'より'}${months}カ月${defer ? '遅らせて' : '早めて'}`}から${defer ? '繰下げ' : '繰上げ'}受給した場合の年金額はいくらか。円未満は四捨五入し、年金額の改定は考慮しない。`,
      given: [
        { label: '65歳時の年金額', value: `${fmt(base)}円` },
        { label: defer ? '繰下げ月数' : '繰上げ月数', value: `${months}カ月` },
        { label: defer ? '増額率' : '減額率', value: defer ? '1カ月あたり0.7％' : '1カ月あたり0.4％' },
      ],
      answer: ans,
      unit: '円',
      roundingNote: '円未満四捨五入',
      steps: [
        { text: `${defer ? '増額' : '減額'}率`, tex: `${defer ? '0.7' : '0.4'}\\% \\times ${months} = ${rate.mul(100).toDecimalString(1)}\\%` },
        { text: '年金額', tex: `${fmt(base)} \\times (1 ${defer ? '+' : '-'} ${rate.mul(100).toDecimalString(1)}\\%) = ${fmt(ans)}` },
      ],
      formulas: [
        { name: '繰下げ増額率', tex: '0.7\\% \\times \\text{繰下げ月数}\\;(\\text{最大}120\\text{月}=84\\%)', explain: '66歳以降（65歳到達から1年経過後）に申出可能。' },
        { name: '繰上げ減額率', tex: '0.4\\% \\times \\text{繰上げ月数}\\;(\\text{最大}60\\text{月}=24\\%)', explain: '昭和37年4月2日以後生まれの場合。' },
      ],
      relatedTerms: ['kurisage-jukyu', 'kuriage-jukyu'],
    };
  },
};

export const basicPensionGenerator: CalcGenerator = {
  id: 'basic-pension-amount',
  title: '老齢基礎年金の年金額',
  field: 'A',
  grades: [2, 3],
  sources: [{ title: '日本年金機構 老齢基礎年金の受給要件・支給開始時期・計算方法', url: 'https://www.nenkin.go.jp/service/jukyu/roureinenkin/jukyu-yoken/20150401-02.html' }],
  basis: '満額×（保険料納付済月数＋免除月数×反映割合）÷480。満額は問題文で与える（年度により改定）',
  generate(seed, difficulty): CalcProblem {
    const rng = createRng(seed);
    // 満額は年度ごとに改定されるため、問題文で与える設定値とする
    const full = pick(rng, [816_000, 831_700, 847_300]);
    const paid = randInt(rng, 240, difficulty === 1 ? 480 : 440);
    const exemptFull = difficulty === 3 ? randInt(rng, 0, Math.min(60, 480 - paid)) : 0;
    const exemptHalf = difficulty >= 2 ? randInt(rng, 0, Math.min(48, 480 - paid - exemptFull)) : 0;
    // 平成21年4月以後の期間：全額免除 1/2、半額免除 3/4
    const months = Frac.of(paid).add(Frac.of(exemptFull).mul(Frac.of(1, 2))).add(Frac.of(exemptHalf).mul(Frac.of(3, 4)));
    const amount = Frac.of(full).mul(months).div(480);
    const ans = amount.round(0).toNumber();
    return {
      id: `basic-pension-amount:${difficulty}:${seed}`,
      generatorId: 'basic-pension-amount',
      pattern: exemptFull || exemptHalf ? '免除期間がある老齢基礎年金' : '老齢基礎年金額',
      prompt: `老齢基礎年金の満額を${fmt(full)}円（問題上の設定値）とする。保険料納付済期間${paid}月${exemptFull ? `、全額免除期間${exemptFull}月` : ''}${exemptHalf ? `、半額免除期間${exemptHalf}月` : ''}（免除期間はいずれも2009年4月以後）の人が65歳から受け取る老齢基礎年金の額はいくらか。円未満は四捨五入する。`,
      given: [
        { label: '満額（設定値）', value: `${fmt(full)}円` },
        { label: '保険料納付済期間', value: `${paid}月` },
        ...(exemptFull ? [{ label: '全額免除期間（2009年4月以後）', value: `${exemptFull}月` }] : []),
        ...(exemptHalf ? [{ label: '半額免除期間（2009年4月以後）', value: `${exemptHalf}月` }] : []),
      ],
      answer: ans,
      unit: '円',
      roundingNote: '円未満四捨五入',
      steps: [
        ...(exemptFull || exemptHalf ? [{ text: '2009年4月以後の免除期間は、全額免除は2分の1、半額免除は4分の3が年金額に反映される。' }] : []),
        { text: '年金額', tex: `${fmt(full)} \\times \\frac{${paid}${exemptFull ? ` + ${exemptFull} \\times \\frac{1}{2}` : ''}${exemptHalf ? ` + ${exemptHalf} \\times \\frac{3}{4}` : ''}}{480} = ${fmt(ans)}` },
      ],
      formulas: [{ name: '老齢基礎年金額', tex: '\\text{満額} \\times \\frac{\\text{納付済月数} + \\text{免除月数} \\times \\text{反映割合}}{480}', explain: '2009年4月以後の反映割合：全額免除1/2、4分の3免除5/8、半額免除3/4、4分の1免除7/8。' }],
      relatedTerms: ['rorei-kiso-nenkin'],
    };
  },
};

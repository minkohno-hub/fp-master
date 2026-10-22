import { Frac } from '../decimal';
import { createRng, pick, randInt } from '../random';
import type { CalcGenerator, CalcProblem, Difficulty } from './types';

const fmt = (n: number) => n.toLocaleString('ja-JP');
const pid = (g: string, d: Difficulty, s: number) => `${g}:${d}:${s}`;

/** 単利・複利 */
export const interestGenerator: CalcGenerator = {
  id: 'interest',
  title: '単利・複利',
  field: 'C',
  grades: [2, 3],
  sources: [{ title: '金融庁 基礎から学べる金融ガイド（複利）', url: 'https://www.fsa.go.jp/teach/kou3.pdf' }],
  basis: '算数的な定義のみ（法令に依存しない）',
  generate(seed, difficulty): CalcProblem {
    const rng = createRng(seed);
    const principal = randInt(rng, 10, 500, 10) * 10000;
    const ratePct = pick(rng, ['0.5', '1', '1.5', '2', '2.5', '3', '4', '5']);
    const years = randInt(rng, 2, difficulty === 1 ? 5 : 10);
    const r = Frac.of(ratePct).div(100);
    if (difficulty === 1) {
      const ans = Frac.of(principal).mul(Frac.of(1).add(r.mul(years)));
      return {
        id: pid('interest', difficulty, seed),
        generatorId: 'interest',
        pattern: '単利の元利合計',
        prompt: `${fmt(principal)}円を年利${ratePct}％の単利で${years}年間運用した場合の元利合計額はいくらか。税金等は考慮しない。`,
        given: [
          { label: '元本', value: `${fmt(principal)}円` },
          { label: '年利率（単利）', value: `${ratePct}％` },
          { label: '期間', value: `${years}年` },
        ],
        answer: ans.round(0, 'floor').toNumber(),
        unit: '円',
        roundingNote: '円未満切捨て',
        steps: [
          { text: '単利では毎年の利息は元本に対してのみ付く。', tex: `\\text{利息} = ${fmt(principal)} \\times ${ratePct}\\% \\times ${years}` },
          { text: `元利合計 = 元本 + 利息 = ${fmt(ans.round(0, 'floor').toNumber())}円` },
        ],
        formulas: [{ name: '単利の元利合計', tex: '\\text{元利合計} = \\text{元本} \\times (1 + \\text{年利率} \\times \\text{年数})', explain: '利息が元本にのみ付く。' }],
        relatedTerms: ['tanri', 'fukuri'],
      };
    }
    const semi = difficulty === 3;
    const periods = semi ? years * 2 : years;
    const rp = semi ? r.div(2) : r;
    const amount = Frac.of(principal).mul(Frac.of(1).add(rp).pow(periods));
    const ans = amount.round(0, 'floor').toNumber();
    return {
      id: pid('interest', difficulty, seed),
      generatorId: 'interest',
      pattern: semi ? '半年複利の元利合計' : '1年複利の元利合計',
      prompt: `${fmt(principal)}円を年利${ratePct}％・${semi ? '半年' : '1年'}複利で${years}年間運用した場合の元利合計額はいくらか。税金等は考慮せず、円未満は切り捨てる。`,
      given: [
        { label: '元本', value: `${fmt(principal)}円` },
        { label: '年利率', value: `${ratePct}％（${semi ? '半年' : '1年'}複利）` },
        { label: '期間', value: `${years}年` },
      ],
      answer: ans,
      unit: '円',
      roundingNote: '円未満切捨て',
      steps: semi
        ? [
            { text: '半年複利では、年利率を2で割った利率で、年数×2回複利計算する。', tex: `${fmt(principal)} \\times \\left(1 + \\frac{${ratePct}\\%}{2}\\right)^{${periods}}` },
            { text: `= ${amount.toDecimalString(4)}… → 円未満切捨てで ${fmt(ans)}円` },
          ]
        : [
            { text: '1年複利では、毎年の利息が元本に組み入れられる。', tex: `${fmt(principal)} \\times (1 + ${ratePct}\\%)^{${years}}` },
            { text: `= ${amount.toDecimalString(4)}… → 円未満切捨てで ${fmt(ans)}円` },
          ],
      formulas: [
        { name: '1年複利', tex: '\\text{元本} \\times (1 + r)^{n}', explain: 'r：年利率、n：年数' },
        { name: '半年複利', tex: '\\text{元本} \\times \\left(1 + \\frac{r}{2}\\right)^{2n}', explain: '半年ごとに利息を元本に組み入れる。' },
      ],
      relatedTerms: ['fukuri', 'tanri'],
    };
  },
};

type CoefKind = 'shuka' | 'genka' | 'nenkin-shuka' | 'gensai' | 'shihon' | 'nenkin-genka';
const COEF_NAMES: Record<CoefKind, string> = {
  shuka: '終価係数',
  genka: '現価係数',
  'nenkin-shuka': '年金終価係数',
  gensai: '減債基金係数',
  shihon: '資本回収係数',
  'nenkin-genka': '年金現価係数',
};

/** 6つの係数の値（小数点以下第3位に四捨五入：試験の係数表と同じ表示） */
export function coefficient(kind: CoefKind, ratePct: string, n: number): Frac {
  const r = Frac.of(ratePct).div(100);
  const g = Frac.of(1).add(r).pow(n); // (1+r)^n
  let v: Frac;
  switch (kind) {
    case 'shuka':
      v = g;
      break;
    case 'genka':
      v = Frac.of(1).div(g);
      break;
    case 'nenkin-shuka':
      v = g.sub(1).div(r);
      break;
    case 'gensai':
      v = r.div(g.sub(1));
      break;
    case 'shihon':
      v = r.mul(g).div(g.sub(1));
      break;
    case 'nenkin-genka':
      v = g.sub(1).div(r.mul(g));
      break;
  }
  return v.round(3);
}

export const coefficientGenerator: CalcGenerator = {
  id: 'coefficients',
  title: '6つの係数',
  field: 'A',
  grades: [2, 3],
  sources: [{ title: '日本FP協会 3級・2級 試験範囲（ライフプランニングと資金計画）', url: 'https://www.jafp.or.jp/exam/outline/' }],
  basis: '数学的定義のみ（係数は小数点以下第3位に四捨五入した表の値を使う）',
  generate(seed, difficulty): CalcProblem {
    const rng = createRng(seed);
    const ratePct = pick(rng, ['1', '2', '3', '4', '5']);
    const n = pick(rng, difficulty === 1 ? [5, 10] : [5, 10, 15, 20, 25]);
    const pool: CoefKind[] = difficulty === 1 ? ['shuka', 'nenkin-shuka', 'shihon'] : ['shuka', 'genka', 'nenkin-shuka', 'gensai', 'shihon', 'nenkin-genka'];
    const kind = pick(rng, pool);
    const man = randInt(rng, 1, 30) * (kind === 'nenkin-shuka' || kind === 'nenkin-genka' ? 10 : 100);
    const amount = man * 10000;
    const scen: Record<CoefKind, string> = {
      shuka: `現在保有する${fmt(amount)}円を年利${ratePct}％で複利運用した場合の${n}年後の元利合計額`,
      genka: `${n}年後に${fmt(amount)}円を準備するために、年利${ratePct}％で複利運用する場合に現在必要な元本`,
      'nenkin-shuka': `毎年${fmt(amount)}円を年利${ratePct}％で複利運用しながら${n}年間積み立てた場合の${n}年後の元利合計額`,
      gensai: `年利${ratePct}％で複利運用しながら${n}年後に${fmt(amount)}円を準備するために必要な毎年の積立額`,
      shihon: `現在保有する${fmt(amount)}円を年利${ratePct}％で複利運用しながら${n}年間で均等に取り崩す場合の毎年の受取額`,
      'nenkin-genka': `年利${ratePct}％で複利運用しながら、今後${n}年間にわたって毎年${fmt(amount)}円を受け取るために現在必要な元本`,
    };
    const coefs = (Object.keys(COEF_NAMES) as CoefKind[]).map((k) => ({ k, v: coefficient(k, ratePct, n) }));
    const c = coefs.find((x) => x.k === kind)!.v;
    const ans = Frac.of(amount).mul(c).round(0).toNumber();
    const reason: Record<CoefKind, string> = {
      shuka: '「今ある額」から「将来の額」を求めるので終価係数。',
      genka: '「将来の目標額」から「今必要な額」を求めるので現価係数。',
      'nenkin-shuka': '「毎年の積立額」から「将来の合計額」を求めるので年金終価係数。',
      gensai: '「将来の目標額」から「毎年の積立額」を求めるので減債基金係数。',
      shihon: '「今ある額」から「毎年の受取額（取崩額・返済額）」を求めるので資本回収係数。',
      'nenkin-genka': '「毎年の受取額」から「今必要な額」を求めるので年金現価係数。',
    };
    return {
      id: pid('coefficients', difficulty, seed),
      generatorId: 'coefficients',
      pattern: COEF_NAMES[kind],
      prompt: `${scen[kind]}はいくらか。下の係数表から適切な係数を選んで計算すること。`,
      given: coefs.map((x) => ({ label: `${COEF_NAMES[x.k]}（${ratePct}％・${n}年）`, value: x.v.toDecimalString(3) })),
      answer: ans,
      unit: '円',
      steps: [
        { text: reason[kind] },
        { text: '金額に係数を掛ける。', tex: `${fmt(amount)} \\times ${c.toDecimalString(3)} = ${fmt(ans)}` },
      ],
      formulas: [
        { name: '終価係数', tex: '(1+r)^{n}', explain: '現在の額 → 将来の額' },
        { name: '現価係数', tex: '\\frac{1}{(1+r)^{n}}', explain: '将来の額 → 現在の額' },
        { name: '年金終価係数', tex: '\\frac{(1+r)^{n}-1}{r}', explain: '毎年の積立額 → 将来の額' },
        { name: '減債基金係数', tex: '\\frac{r}{(1+r)^{n}-1}', explain: '将来の額 → 毎年の積立額' },
        { name: '資本回収係数', tex: '\\frac{r(1+r)^{n}}{(1+r)^{n}-1}', explain: '現在の額 → 毎年の受取額' },
        { name: '年金現価係数', tex: '\\frac{(1+r)^{n}-1}{r(1+r)^{n}}', explain: '毎年の受取額 → 現在の額' },
      ],
      relatedTerms: ['shuka-keisu', 'genka-keisu', 'nenkin-shuka-keisu', 'gensai-kikin-keisu', 'shihon-kaishu-keisu', 'nenkin-genka-keisu'],
    };
  },
};

type BondKind = 'final' | 'subscriber' | 'holding' | 'current';
const BOND_NAMES: Record<BondKind, string> = {
  final: '最終利回り',
  subscriber: '応募者利回り',
  holding: '所有期間利回り',
  current: '直接利回り',
};

export const bondYieldGenerator: CalcGenerator = {
  id: 'bond-yield',
  title: '債券の利回り',
  field: 'C',
  grades: [2, 3],
  sources: [{ title: '日本証券業協会 債券の利回り（投資の時間）', url: 'https://www.jsda.or.jp/jikan/' }],
  basis: '単利・年率の定義（税金・手数料は考慮しない）',
  generate(seed, difficulty): CalcProblem {
    const rng = createRng(seed);
    const kinds: BondKind[] = difficulty === 1 ? ['final', 'current'] : ['final', 'subscriber', 'holding', 'current'];
    const kind = pick(rng, kinds);
    const coupon = Frac.of(pick(rng, ['0.5', '0.8', '1', '1.2', '1.5', '2', '2.5', '3']));
    const years = randInt(rng, 2, 10);
    // 95.00〜105.00円。利回りが負にならないよう上限を「100＋表面利率×年数×0.8」に抑える
    const maxCents = Math.min(10500, Math.floor(10000 + coupon.toNumber() * years * 80));
    const price = Frac.of(randInt(rng, 9500, maxCents - (maxCents % 10), 10)).div(100);
    let sell = Frac.of(randInt(rng, 9500, 10500, 10)).div(100);
    // 所有期間利回りが負にならないようにする（入力のしやすさのため）
    if (coupon.add(sell.sub(price).div(years)).cmp(0) <= 0) sell = price;
    let numer: Frac;
    let tex: string;
    let given: { label: string; value: string }[];
    let scenario: string;
    const p = price.toDecimalString(2);
    const c = coupon.toDecimalString(2);
    switch (kind) {
      case 'final':
        numer = coupon.add(Frac.of(100).sub(price).div(years));
        tex = `\\frac{${c} + \\frac{100 - ${p}}{${years}}}{${p}} \\times 100`;
        given = [
          { label: '表面利率', value: `${c}％` },
          { label: '購入価格', value: `額面100円あたり${p}円` },
          { label: '残存期間', value: `${years}年` },
        ];
        scenario = `表面利率${c}％、残存期間${years}年の固定利付債券を額面100円あたり${p}円で購入し、償還まで保有した場合の最終利回り（年率・単利）`;
        break;
      case 'subscriber':
        numer = coupon.add(Frac.of(100).sub(price).div(years));
        tex = `\\frac{${c} + \\frac{100 - ${p}}{${years}}}{${p}} \\times 100`;
        given = [
          { label: '表面利率', value: `${c}％` },
          { label: '発行価格', value: `額面100円あたり${p}円` },
          { label: '償還期間', value: `${years}年` },
        ];
        scenario = `表面利率${c}％、償還期間${years}年の固定利付債券を発行価格（額面100円あたり${p}円）で購入し、償還まで保有した場合の応募者利回り（年率・単利）`;
        break;
      case 'holding':
        numer = coupon.add(sell.sub(price).div(years));
        tex = `\\frac{${c} + \\frac{${sell.toDecimalString(2)} - ${p}}{${years}}}{${p}} \\times 100`;
        given = [
          { label: '表面利率', value: `${c}％` },
          { label: '購入価格', value: `額面100円あたり${p}円` },
          { label: '売却価格', value: `額面100円あたり${sell.toDecimalString(2)}円` },
          { label: '所有期間', value: `${years}年` },
        ];
        scenario = `表面利率${c}％の固定利付債券を額面100円あたり${p}円で購入し、${years}年後に${sell.toDecimalString(2)}円で売却した場合の所有期間利回り（年率・単利）`;
        break;
      case 'current':
        numer = coupon;
        tex = `\\frac{${c}}{${p}} \\times 100`;
        given = [
          { label: '表面利率', value: `${c}％` },
          { label: '購入価格', value: `額面100円あたり${p}円` },
        ];
        scenario = `表面利率${c}％の固定利付債券を額面100円あたり${p}円で購入した場合の直接利回り`;
        break;
    }
    const exact = numer.div(price).mul(100);
    const ans = exact.round(2).toNumber();
    return {
      id: pid('bond-yield', difficulty, seed),
      generatorId: 'bond-yield',
      pattern: BOND_NAMES[kind],
      prompt: `${scenario}は何％か。税金・手数料等は考慮せず、％表示の小数点以下第3位を四捨五入すること。`,
      given,
      answer: ans,
      unit: '％',
      roundingNote: '小数点以下第3位を四捨五入',
      steps: [
        { text: kind === 'current' ? '直接利回りは、購入価格に対する1年あたりの利息の割合（差益は含めない）。' : '1年あたりの収益（利息＋差損益÷年数）を購入価格で割る。' },
        { text: '式に当てはめる。', tex: `${tex} = ${exact.toDecimalString(5)}\\ldots` },
        { text: `小数点以下第3位を四捨五入して ${ans}％` },
      ],
      formulas: [
        { name: BOND_NAMES[kind], tex: kind === 'current' ? '\\frac{\\text{表面利率}}{\\text{購入価格}} \\times 100' : `\\frac{\\text{表面利率} + \\frac{\\text{${kind === 'holding' ? '売却価格' : '額面(100)'}} - \\text{${kind === 'subscriber' ? '発行価格' : '購入価格'}}}{\\text{${kind === 'final' ? '残存期間' : kind === 'holding' ? '所有期間' : '償還期間'}}}}{\\text{${kind === 'subscriber' ? '発行価格' : '購入価格'}}} \\times 100`, explain: '単利・年率で計算する。' },
      ],
      relatedTerms: ['saishu-rimawari', 'oubosha-rimawari', 'shoyu-kikan-rimawari', 'chokusetsu-rimawari'],
    };
  },
};

type StockKind = 'per' | 'pbr' | 'roe' | 'dividend-yield' | 'payout';
export const stockIndicatorGenerator: CalcGenerator = {
  id: 'stock-indicators',
  title: '株式投資指標',
  field: 'C',
  grades: [2, 3],
  sources: [{ title: '日本取引所グループ 用語集', url: 'https://www.jpx.co.jp/glossary/' }],
  basis: '指標の定義のみ（法令に依存しない）',
  generate(seed, difficulty): CalcProblem {
    const rng = createRng(seed);
    const kinds: StockKind[] = difficulty === 1 ? ['per', 'pbr', 'dividend-yield'] : ['per', 'pbr', 'roe', 'dividend-yield', 'payout'];
    const kind = pick(rng, kinds);
    const price = randInt(rng, 50, 800) * 10; // 株価
    const shares = randInt(rng, 1, 50) * 1_000_000; // 発行済株式数
    const netIncome = randInt(rng, 10, 300) * 100_000_000; // 当期純利益
    const equity = netIncome * randInt(rng, 5, 25); // 自己資本
    const dps = randInt(rng, 5, 80); // 1株配当
    const eps = Frac.of(netIncome).div(shares);
    const bps = Frac.of(equity).div(shares);
    const okU = (n: number) => `${fmt(n / 100_000_000)}億円`;
    const map: Record<StockKind, { name: string; v: Frac; unit: string; tex: string; formula: string; given: { label: string; value: string }[] }> = {
      per: {
        name: 'PER（株価収益率）',
        v: Frac.of(price).div(eps),
        unit: '倍',
        tex: `\\frac{${price}}{${fmt(netIncome)} \\div ${fmt(shares)}}`,
        formula: '\\text{PER} = \\frac{\\text{株価}}{\\text{1株当たり純利益(EPS)}}',
        given: [
          { label: '株価', value: `${fmt(price)}円` },
          { label: '当期純利益', value: okU(netIncome) },
          { label: '発行済株式数', value: `${fmt(shares)}株` },
        ],
      },
      pbr: {
        name: 'PBR（株価純資産倍率）',
        v: Frac.of(price).div(bps),
        unit: '倍',
        tex: `\\frac{${price}}{${fmt(equity)} \\div ${fmt(shares)}}`,
        formula: '\\text{PBR} = \\frac{\\text{株価}}{\\text{1株当たり純資産(BPS)}}',
        given: [
          { label: '株価', value: `${fmt(price)}円` },
          { label: '純資産（自己資本）', value: okU(equity) },
          { label: '発行済株式数', value: `${fmt(shares)}株` },
        ],
      },
      roe: {
        name: 'ROE（自己資本利益率）',
        v: Frac.of(netIncome).div(equity).mul(100),
        unit: '％',
        tex: `\\frac{${fmt(netIncome)}}{${fmt(equity)}} \\times 100`,
        formula: '\\text{ROE} = \\frac{\\text{当期純利益}}{\\text{自己資本}} \\times 100',
        given: [
          { label: '当期純利益', value: okU(netIncome) },
          { label: '自己資本', value: okU(equity) },
        ],
      },
      'dividend-yield': {
        name: '配当利回り',
        v: Frac.of(dps).div(price).mul(100),
        unit: '％',
        tex: `\\frac{${dps}}{${price}} \\times 100`,
        formula: '\\text{配当利回り} = \\frac{\\text{1株当たり年間配当金}}{\\text{株価}} \\times 100',
        given: [
          { label: '株価', value: `${fmt(price)}円` },
          { label: '1株当たり年間配当金', value: `${dps}円` },
        ],
      },
      payout: {
        name: '配当性向',
        v: Frac.of(dps).mul(shares).div(netIncome).mul(100),
        unit: '％',
        tex: `\\frac{${dps} \\times ${fmt(shares)}}{${fmt(netIncome)}} \\times 100`,
        formula: '\\text{配当性向} = \\frac{\\text{配当金総額}}{\\text{当期純利益}} \\times 100',
        given: [
          { label: '1株当たり年間配当金', value: `${dps}円` },
          { label: '発行済株式数', value: `${fmt(shares)}株` },
          { label: '当期純利益', value: okU(netIncome) },
        ],
      },
    };
    const m = map[kind];
    const ans = m.v.round(2).toNumber();
    return {
      id: pid('stock-indicators', difficulty, seed),
      generatorId: 'stock-indicators',
      pattern: m.name,
      prompt: `次の資料から${m.name}を求めよ。小数点以下第3位を四捨五入すること。`,
      given: m.given,
      answer: ans,
      unit: m.unit,
      roundingNote: '小数点以下第3位を四捨五入',
      steps: [
        { text: '定義式に当てはめる。', tex: `${m.tex} = ${m.v.toDecimalString(5)}\\ldots` },
        { text: `小数点以下第3位を四捨五入して ${ans}${m.unit}` },
      ],
      formulas: [{ name: m.name, tex: m.formula, explain: '' }],
      relatedTerms: [{ per: 'per', pbr: 'pbr', roe: 'roe', 'dividend-yield': 'haito-rimawari', payout: 'haito-seiko' }[kind]],
    };
  },
};

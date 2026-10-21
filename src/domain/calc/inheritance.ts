import { Frac } from '../decimal';
import { createRng, pick, randInt } from '../random';
import type { CalcGenerator, CalcProblem } from './types';

const fmt = (n: number) => n.toLocaleString('ja-JP');

export interface HeirShare {
  name: string;
  share: Frac;
}

/**
 * 法定相続分（民法900条・901条）。
 * children: 各子について生存しているか、死亡している場合の代襲相続人（孫）の数
 */
export function legalShares(opts: {
  spouse: boolean;
  children: { alive: boolean; grandchildren: number }[];
  parents: number;
  siblings: number;
}): HeirShare[] {
  const out: HeirShare[] = [];
  const childLines = opts.children.filter((c) => c.alive || c.grandchildren > 0);
  if (childLines.length > 0) {
    const rest = opts.spouse ? Frac.of(1, 2) : Frac.of(1);
    if (opts.spouse) out.push({ name: '配偶者', share: Frac.of(1, 2) });
    const per = rest.div(childLines.length);
    childLines.forEach((c, i) => {
      if (c.alive) out.push({ name: `子${i + 1}`, share: per });
      else for (let g = 0; g < c.grandchildren; g++) out.push({ name: `子${i + 1}の子（孫${g + 1}）`, share: per.div(c.grandchildren) });
    });
    return out;
  }
  if (opts.parents > 0) {
    const rest = opts.spouse ? Frac.of(1, 3) : Frac.of(1);
    if (opts.spouse) out.push({ name: '配偶者', share: Frac.of(2, 3) });
    for (let i = 0; i < opts.parents; i++) out.push({ name: `親${i + 1}`, share: rest.div(opts.parents) });
    return out;
  }
  if (opts.siblings > 0) {
    const rest = opts.spouse ? Frac.of(1, 4) : Frac.of(1);
    if (opts.spouse) out.push({ name: '配偶者', share: Frac.of(3, 4) });
    for (let i = 0; i < opts.siblings; i++) out.push({ name: `兄弟姉妹${i + 1}`, share: rest.div(opts.siblings) });
    return out;
  }
  if (opts.spouse) out.push({ name: '配偶者', share: Frac.of(1) });
  return out;
}

const fracTex = (f: Frac) => (f.d === 1n ? `${f.n}` : `\\frac{${f.n}}{${f.d}}`);
const fracText = (f: Frac) => (f.d === 1n ? `${f.n}` : `${f.d}分の${f.n}`);

export const legalShareGenerator: CalcGenerator = {
  id: 'legal-share',
  title: '法定相続分',
  field: 'F',
  grades: [2, 3],
  sources: [{ title: 'e-Gov法令検索 民法 第900条・第901条', url: 'https://laws.e-gov.go.jp/law/129AC0000000089' }],
  basis: '民法900条（法定相続分）・901条（代襲相続人の相続分）。全血・半血の区別は扱わない',
  generate(seed, difficulty): CalcProblem {
    const rng = createRng(seed);
    const pattern = difficulty === 1 ? 'children' : pick(rng, ['children', 'parents', 'siblings', difficulty === 3 ? 'proxy' : 'children'] as const);
    const spouse = pattern === 'children' && difficulty === 1 ? true : rng() < 0.8;
    let opts = { spouse, children: [] as { alive: boolean; grandchildren: number }[], parents: 0, siblings: 0 };
    let family = '';
    if (pattern === 'children') {
      const n = randInt(rng, 1, 4);
      opts.children = Array.from({ length: n }, () => ({ alive: true, grandchildren: 0 }));
      family = `${spouse ? '配偶者と' : ''}子${n}人`;
    } else if (pattern === 'proxy') {
      const n = randInt(rng, 2, 3);
      const g = randInt(rng, 2, 3);
      opts.children = Array.from({ length: n }, (_, i) => ({ alive: i !== 0, grandchildren: i === 0 ? g : 0 }));
      family = `${spouse ? '配偶者、' : ''}子${n}人（うち子1は被相続人より先に死亡しており、子1の子（孫）が${g}人いる）`;
    } else if (pattern === 'parents') {
      opts.parents = randInt(rng, 1, 2);
      family = `${spouse ? '配偶者と' : ''}${opts.parents === 2 ? '父母' : '母'}（子はいない）`;
    } else {
      opts.siblings = randInt(rng, 1, 3);
      family = `${spouse ? '配偶者と' : ''}兄弟姉妹${opts.siblings}人（いずれも父母を同じくする。子・直系尊属はいない）`;
    }
    opts = { ...opts };
    const shares = legalShares(opts);
    const target = pick(rng, shares.filter((s, i) => i === shares.findIndex((x) => x.share.cmp(s.share) === 0)));
    // 遺産額は全員の取得額が整数になるよう分母の最小公倍数の倍数にする
    const lcm = shares.reduce((a, s) => lcmBig(a, s.share.d), 1n);
    const unit = Number(lcm) * 1_000_000;
    const estate = randInt(rng, Math.ceil(30_000_000 / unit), Math.max(Math.ceil(30_000_000 / unit), Math.floor(300_000_000 / unit))) * unit;
    const amount = Frac.of(estate).mul(target.share).toNumber();
    return {
      id: `legal-share:${difficulty}:${seed}`,
      generatorId: 'legal-share',
      pattern: { children: '配偶者と子', parents: '配偶者と直系尊属', siblings: '配偶者と兄弟姉妹', proxy: '代襲相続' }[pattern],
      prompt: `被相続人の相続人は${family}である。遺産${fmt(estate)}円を法定相続分どおりに分割した場合、${target.name}の取得額はいくらか。相続の放棄はない。`,
      given: [
        { label: '相続人', value: family },
        { label: '遺産額', value: `${fmt(estate)}円` },
      ],
      answer: amount,
      unit: '円',
      steps: [
        { text: `各人の法定相続分：${shares.map((s) => `${s.name} ${fracText(s.share)}`).join('、')}` },
        { text: `${target.name}の取得額`, tex: `${fmt(estate)} \\times ${fracTex(target.share)} = ${fmt(amount)}` },
      ],
      formulas: [
        { name: '配偶者と子', tex: '\\text{配偶者}\\ \\tfrac{1}{2},\\ \\text{子全体}\\ \\tfrac{1}{2}', explain: '子が複数なら均等に分ける。' },
        { name: '配偶者と直系尊属', tex: '\\text{配偶者}\\ \\tfrac{2}{3},\\ \\text{直系尊属全体}\\ \\tfrac{1}{3}', explain: '' },
        { name: '配偶者と兄弟姉妹', tex: '\\text{配偶者}\\ \\tfrac{3}{4},\\ \\text{兄弟姉妹全体}\\ \\tfrac{1}{4}', explain: '' },
      ],
      relatedTerms: ['hotei-sozokubun', 'daishu-sozoku'],
    };
  },
};

function lcmBig(a: bigint, b: bigint): bigint {
  let x = a;
  let y = b;
  while (y) [x, y] = [y, x % y];
  return (a / x) * b;
}

/** 相続税の遺産に係る基礎控除額（相続税法15条） */
export function inheritanceBasicDeduction(legalHeirs: number): number {
  return 30_000_000 + 6_000_000 * legalHeirs;
}

export const basicDeductionGenerator: CalcGenerator = {
  id: 'inheritance-basic-deduction',
  title: '相続税の基礎控除額',
  field: 'F',
  grades: [2, 3],
  sources: [{ title: '国税庁 タックスアンサー No.4152 相続税の計算', url: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/sozoku/4152.htm' }],
  basis: '遺産に係る基礎控除額＝3,000万円＋600万円×法定相続人の数（平成27年1月1日以後の相続）',
  generate(seed, difficulty): CalcProblem {
    const rng = createRng(seed);
    const spouse = rng() < 0.8;
    const kids = randInt(rng, 1, 3);
    const renounce = difficulty >= 2 && rng() < 0.5;
    const adopted = difficulty === 3 ? randInt(rng, 1, 3) : 0;
    const realKids = kids;
    // 実子がいる場合、法定相続人の数に含める養子は1人まで
    const countedAdopted = Math.min(adopted, realKids > 0 ? 1 : 2);
    const heirs = (spouse ? 1 : 0) + realKids + countedAdopted;
    const ans = inheritanceBasicDeduction(heirs);
    const desc = [
      spouse ? '配偶者' : '',
      `実子${realKids}人${renounce ? '（うち1人は相続を放棄）' : ''}`,
      adopted ? `普通養子${adopted}人` : '',
    ].filter(Boolean).join('、');
    return {
      id: `inheritance-basic-deduction:${difficulty}:${seed}`,
      generatorId: 'inheritance-basic-deduction',
      pattern: adopted ? '養子がいる場合の法定相続人の数' : renounce ? '相続放棄者がいる場合' : '基礎控除額',
      prompt: `被相続人の親族は${desc}である。相続税の計算における遺産に係る基礎控除額はいくらか。`,
      given: [{ label: '親族', value: desc }],
      answer: ans,
      unit: '円',
      steps: [
        ...(renounce ? [{ text: '相続を放棄した人も、基礎控除額の計算上は「法定相続人の数」に含める。' }] : []),
        ...(adopted ? [{ text: `実子がいるので、法定相続人の数に含める養子は1人まで（養子${adopted}人 → ${countedAdopted}人）。` }] : []),
        { text: `法定相続人の数 = ${heirs}人` },
        { text: '基礎控除額', tex: `3{,}000\\text{万円} + 600\\text{万円} \\times ${heirs} = ${fmt(ans)}` },
      ],
      formulas: [{ name: '遺産に係る基礎控除額', tex: '3{,}000\\text{万円} + 600\\text{万円} \\times \\text{法定相続人の数}', explain: '養子は実子がいる場合1人、いない場合2人まで算入。相続放棄者も算入する。' }],
      relatedTerms: ['sozokuzei-kiso-kojo', 'hotei-sozokunin'],
    };
  },
};

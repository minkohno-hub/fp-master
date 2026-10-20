import type { Question, Subject } from '../domain/learning';
const samples: { subject: Subject; prompt: string; choices: string[]; answer: number; explanation: string; kind?: 'calculation' }[] = [
 {subject:'life',prompt:'毎月2万円を、利息を考慮せず5年間積み立てた場合、積立総額はいくらですか。',choices:['100万円','120万円','144万円'],answer:1,explanation:'2万円 × 12か月 × 5年 = 120万円です。期間の単位をそろえて計算しましょう。',kind:'calculation'},
 {subject:'risk',prompt:'保険の基本的な仕組みとして、適切なものはどれですか。',choices:['少数の人で必ず利益を分配する','多数の人が保険料を出し合い、偶然の事故に備える','すべての損失が無条件で補償される'],answer:1,explanation:'保険は多数の人が保険料を拠出し、偶然の事故による経済的損失に備える仕組みです。補償範囲や免責は契約により異なります。'},
 {subject:'finance',prompt:'元本100万円を年利2%の単利で3年間運用した場合、税金を考慮しない利息の合計はいくらですか。',choices:['2万円','6万円','6万1,208円'],answer:1,explanation:'単利の利息は元本 × 利率 × 期間。100万円 × 0.02 × 3年 = 6万円です。複利との違いを確認しましょう。',kind:'calculation'},
 {subject:'tax',prompt:'所得税の超過累進税率の説明として、適切なものはどれですか。',choices:['所得が増えると全額に最高税率が適用される','所得の各段階に応じて、その部分に対応する税率を適用する','所得に関係なく一定額を納める'],answer:1,explanation:'超過累進税率では、課税所得を段階に分け、それぞれの部分に対応する税率を適用します。'},
 {subject:'estate',prompt:'敷地面積200㎡、建築面積80㎡の建物の建ぺい率はいくらですか。',choices:['25%','40%','250%'],answer:1,explanation:'建ぺい率 = 建築面積 ÷ 敷地面積 × 100。80 ÷ 200 × 100 = 40%です。延べ面積を用いる容積率と区別しましょう。',kind:'calculation'},
 {subject:'inheritance',prompt:'配偶者と子2人が法定相続人である場合、子1人の法定相続分はどれですか。',choices:['2分の1','3分の1','4分の1'],answer:2,explanation:'配偶者の法定相続分は2分の1、子全体で2分の1です。子2人で均等に分けるため、1人あたり4分の1となります。'},
];
// Foundation samples, not a complete or official exam question bank.
export const questions: Question[] = (['3','2'] as const).flatMap(grade => samples.map((q,i) => ({...q,id:`sample-${grade}-${i+1}`,grade,kind:q.kind ?? 'knowledge',referenceDate:'2026-10-01'})));

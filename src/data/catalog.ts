import type { MaterialQuestion, Topic } from '../domain/curriculum';
import type { Subject } from '../domain/learning';
/** A planning inventory, NOT an assertion that the latest official scope is complete. */
const draftScope: Record<Subject, [string,string,string][]> = {
  life:[['ライフプランニング','計画の基礎','キャッシュフローと資金計画'],['資金計画','係数','6つの係数'],['社会保険','医療・介護','健康保険・国民健康保険・介護保険'],['社会保険','労働保険','雇用保険・労災保険'],['公的年金','受給と保険料','老齢・障害・遺族給付'],['企業年金','私的年金','確定給付・確定拠出年金'],['ローン','住宅と教育','住宅ローン・教育資金'],['倫理','業務関連法規','FPの職業倫理と関連法規']],
  risk:[['保険の基本','保険契約','保険の仕組みと契約者保護'],['生命保険','商品','定期・終身・養老保険'],['生命保険','契約','告知・契約変更・保険金'],['損害保険','商品','火災・地震・自動車保険'],['第三分野','医療・介護','医療・がん・介護保険'],['保険と税','個人と法人','保険料・保険金の税務']],
  finance:[['金融経済','指標','景気・金利・物価・為替'],['預貯金','安全性','預金商品と預金保険'],['債券','価格と利回り','債券価格・各種利回り'],['株式','投資指標','PER・PBR・配当利回り'],['投資信託','商品と費用','投資信託・ETF・REIT'],['ポートフォリオ','リスクと収益','分散投資・相関係数'],['金融税制','課税と制度','課税方式・非課税制度'],['金融商品','関連法規','金融商品取引法等']],
  tax:[['所得税','基礎','納税義務・所得の種類'],['所得税','課税標準','損益通算・繰越控除'],['所得税','所得控除','人的控除・物的控除'],['所得税','税額','税額計算・税額控除'],['所得税','申告','確定申告・源泉徴収'],['法人税','法人課税','法人税の基本'],['消費税','課税','課税取引・納税義務'],['住民税','地方税','個人住民税・事業税']],
  estate:[['不動産','調査','登記・価格・現地調査'],['取引','売買と賃貸','売買契約・借地借家'],['法令制限','都市計画','都市計画法'],['法令制限','建築','建ぺい率・容積率・建築基準法'],['不動産税務','取得・保有','取得税・登録免許税・固定資産税'],['不動産税務','譲渡','譲渡所得・居住用財産の特例'],['不動産活用','投資','有効活用・証券化']],
  inheritance:[['相続','民法','法定相続人・法定相続分'],['相続','遺産分割','遺言・遺留分・遺産分割'],['相続税','課税','課税財産・非課税財産'],['相続税','計算','基礎控除・税額計算・税額控除'],['財産評価','評価','土地・家屋・株式等の評価'],['贈与税','課税','暦年課税・相続時精算課税'],['事業承継','承継対策','自社株・事業承継の基本']],
};
export const topicInventory: Topic[] = Object.entries(draftScope).flatMap(([subject,rows])=>rows.map(([middleCategory,subcategory,point],index)=>({
  id:`${subject}-${index+1}`,subject:subject as Subject,middleCategory,subcategory,point,grades:['2','3'],exams:['academic','practical'],officialScope:null,scopeVerified:false,termIds:[],lawReferenceDate:null,
})));
/** Populated only after an editor actually checks the originals, answer key, explanations and publication rights. */
export const verifiedQuestions: MaterialQuestion[] = [];
export const catalog: MaterialQuestion[] = [...verifiedQuestions];

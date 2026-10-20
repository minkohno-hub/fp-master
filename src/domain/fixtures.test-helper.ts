import type { MaterialQuestion, Topic } from './curriculum';
/** Synthetic test data only. Never import into the shipped catalog. */
export function materialFixture(overrides: Partial<MaterialQuestion> = {}): MaterialQuestion {
  return {
    id:'fixture-1',grade:'3',exam:'academic',subject:'life',topicId:'fixture-topic',middleCategory:'テスト分類',subcategory:'テスト分類',format:'multiple-choice',difficulty:'basic',kind:'knowledge',prompt:'自動テスト用の問題です。正答インデックスは1です。',choices:['A','B','C'],grading:{type:'choice',correctIndex:1},
    explanation:{concise:'テスト用の正答はBです。',standard:'テスト用の正答はBです。',detailed:'テスト用の正答はBです。教材として利用しません。',conditions:[],exceptions:[],commonMistakes:[],example:'',formula:null},choiceExplanations:['テスト用の誤答Aです。','テスト用の正答Bです。','テスト用の誤答Cです。'],relatedTerms:[],relatedQuestions:[],
    source:{origin:'original',references:[{title:'Synthetic test evidence',url:'https://example.com/test-evidence',checkedAt:'2026-01-01'}],originalQuestion:null,modifications:null,publication:'permitted',permissionEvidence:'Synthetic fixture owned by the tests.'},
    year:null,questionNumber:null,lawReferenceDate:'2026-01-01',lastCheckedAt:'2026-01-01',verification:{status:'verified',checkedAt:'2026-01-01',reviewer:'automated-fixture',evidence:['Synthetic fixture, no FP educational claim.']},dataVersion:1,
    ...overrides,
  };
}
export function topicFixture(overrides: Partial<Topic>={}): Topic {
  return {id:'fixture-topic',subject:'life',middleCategory:'テスト分類',subcategory:'テスト分類',point:'テスト論点',grades:['2','3'],exams:['academic','practical'],officialScope:{title:'Synthetic scope',url:'https://example.com/scope',checkedAt:'2026-01-01'},scopeVerified:true,termIds:[],lawReferenceDate:'2026-01-01',...overrides};
}

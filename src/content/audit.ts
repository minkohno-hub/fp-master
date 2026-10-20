import { publicationProblems, validateCatalog, validateMaterial, type MaterialQuestion, type Topic } from '../domain/curriculum.ts';

export interface ContentImport { formatVersion: 1; questions: MaterialQuestion[]; topics: Topic[] }
export interface AuditIssue { path: string; message: string }
export interface ContentAudit {
  /** No record is imported or promoted by running this audit. */
  mode: 'inspection-only';
  candidates: number;
  structurallyValid: number;
  editorialVerified: number;
  publishable: number;
  needsEditorialReview: number;
  issues: AuditIssue[];
  publicationBlocks: { questionId: string; reasons: string[] }[];
}
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const questionKeys = ['id','grade','exam','subject','topicId','middleCategory','subcategory','format','difficulty','kind','prompt','choices','grading','explanation','choiceExplanations','relatedTerms','relatedQuestions','source','year','questionNumber','lawReferenceDate','lastCheckedAt','verification','dataVersion'];
const topicKeys = ['id','subject','middleCategory','subcategory','point','grades','exams','officialScope','scopeVerified','termIds','lawReferenceDate'];
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(v => typeof v === 'string'); }
function nullableText(value: unknown): value is string | null { return value === null || typeof value === 'string'; }
function keys(value: Record<string, unknown>, allowed: string[]): boolean { return Object.keys(value).every(k => allowed.includes(k)) && allowed.every(k => Object.hasOwn(value,k)); }
function sourceRef(value: unknown): boolean { return record(value) && keys(value,['title','url','checkedAt']) && typeof value.title === 'string' && typeof value.url === 'string' && nullableText(value.checkedAt); }
function materialShape(value: unknown): value is MaterialQuestion {
  if (!record(value) || !keys(value,questionKeys)) return false;
  if (!['id','grade','exam','subject','topicId','middleCategory','subcategory','format','difficulty','kind','prompt'].every(k => typeof value[k] === 'string')) return false;
  if (!['choices','choiceExplanations','relatedTerms','relatedQuestions'].every(k => strings(value[k]))) return false;
  if (typeof value.dataVersion !== 'number' || !(value.year === null || typeof value.year === 'number') || !['questionNumber','lawReferenceDate','lastCheckedAt'].every(k=>nullableText(value[k]))) return false;
  const g=value.grading;
  if (!record(g) || !((keys(g,['type','correctIndex']) && g.type==='choice' && typeof g.correctIndex==='number') || (keys(g,['type','expected','unit','decimalPlaces','rounding']) && g.type==='numeric' && typeof g.expected==='string' && typeof g.unit==='string' && typeof g.decimalPlaces==='number' && typeof g.rounding==='string'))) return false;
  const e=value.explanation;
  if (!record(e) || !keys(e,['concise','standard','detailed','conditions','exceptions','commonMistakes','example','formula']) || !['concise','standard','detailed','example'].every(k=>typeof e[k]==='string') || !['conditions','exceptions','commonMistakes'].every(k=>strings(e[k])) || !nullableText(e.formula)) return false;
  const s=value.source;
  if (!record(s) || !keys(s,['origin','references','originalQuestion','modifications','publication','permissionEvidence']) || typeof s.origin!=='string' || typeof s.publication!=='string' || !Array.isArray(s.references) || !s.references.every(sourceRef) || !['originalQuestion','modifications','permissionEvidence'].every(k=>nullableText(s[k]))) return false;
  const v=value.verification;
  return record(v) && keys(v,['status','checkedAt','reviewer','evidence']) && typeof v.status==='string' && nullableText(v.checkedAt) && nullableText(v.reviewer) && strings(v.evidence);
}
function topicShape(value: unknown): value is Topic {
  return record(value) && keys(value,topicKeys) && ['id','subject','middleCategory','subcategory','point'].every(k=>typeof value[k]==='string') && strings(value.grades) && strings(value.exams) && strings(value.termIds) && typeof value.scopeVerified==='boolean' && nullableText(value.lawReferenceDate) && (value.officialScope===null || sourceRef(value.officialScope));
}
/** Parse all required fields before calling typed domain validators. Unknown fields are rejected to catch typos. */
export function parseContentImport(json: string): ContentImport {
  if (new TextEncoder().encode(json).byteLength > MAX_IMPORT_BYTES) throw new Error('候補JSONの上限は10MiBです');
  const input:unknown=JSON.parse(json);
  if (!record(input) || !keys(input,['formatVersion','questions','topics']) || input.formatVersion!==1 || !Array.isArray(input.questions) || !Array.isArray(input.topics)) throw new Error('候補JSONはformatVersion:1、questions配列、topics配列が必要です');
  if (input.questions.length>10000 || input.topics.length>10000) throw new Error('候補数の上限は各10000件です');
  if (!input.questions.every(materialShape)) throw new Error(`問題データの必須属性・型・未知の項目を確認してください（questions[${input.questions.findIndex(q=>!materialShape(q))}]）`);
  if (!input.topics.every(topicShape)) throw new Error(`論点データの必須属性・型・未知の項目を確認してください（topics[${input.topics.findIndex(t=>!topicShape(t))}]）`);
  return {formatVersion:1,questions:input.questions,topics:input.topics};
}
export function auditContent(input: ContentImport): ContentAudit {
  const issues:AuditIssue[]=[];
  const topicIds=new Set<string>();
  for(const [index,t] of input.topics.entries()){
    const path=`topics[${index}]`;
    if(topicIds.has(t.id))issues.push({path,message:'論点IDが重複しています'});topicIds.add(t.id);
    if(!t.id.trim() || !t.point.trim() || !t.middleCategory.trim() || !t.subcategory.trim())issues.push({path,message:'論点名・分類が必要です'});
    if(!['life','risk','finance','tax','estate','inheritance'].includes(t.subject) || !t.grades.length || t.grades.some(g=>!['2','3'].includes(g)) || !t.exams.length || t.exams.some(e=>!['academic','practical'].includes(e)))issues.push({path,message:'論点の分野・対象級・試験区分が不正です'});
    if(t.scopeVerified && (!t.officialScope?.checkedAt || !t.officialScope.url.startsWith('https://')))issues.push({path,message:'公式範囲の照合には原典と実確認日が必要です'});
  }
  for(const error of validateCatalog(input.questions,input.topics))issues.push({path:'questions',message:error});
  const structurallyValid=input.questions.filter(q=>validateMaterial(q,input.topics).length===0).length;
  const publicationBlocks=input.questions.map(q=>({questionId:q.id,reasons:publicationProblems(q,input.topics)})).filter(q=>q.reasons.length>0);
  return {mode:'inspection-only',candidates:input.questions.length,structurallyValid,editorialVerified:input.questions.filter(q=>q.verification.status==='verified').length,publishable:input.questions.length-publicationBlocks.length,needsEditorialReview:input.questions.filter(q=>q.verification.status!=='verified').length,issues,publicationBlocks};
}

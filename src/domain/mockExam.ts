import type { Grade, Subject } from './learning';
import { subjects } from './learning';
import { canPublish, isCalendarDate, type ExamCategory, type MaterialQuestion, type SourceReference } from './curriculum';
import { gradeAnswer, targetScore } from './assessment';

export type QuestionFormat = MaterialQuestion['format'];
export interface ExamSpecification {
  id: string;
  version: number;
  grade: Grade;
  exam: ExamCategory;
  verificationStatus: 'unconfirmed' | 'verified';
  verifiedAt: string | null;
  sources: SourceReference[];
  lawReferenceDate: string | null;
  formats: QuestionFormat[] | null;
  questionCount: number | null;
  /** One MaterialQuestion represents one independently scored answer, not a booklet's larger case number. */
  countingUnit: 'scored-item' | null;
  durationMinutes: number | null;
  fullScore: number | null;
  passingScore: number | null;
  subjectDistribution: Partial<Record<Subject, number>> | null;
  formatDistribution: Partial<Record<QuestionFormat, number>> | null;
  distributionStatus: 'unconfirmed' | 'official' | 'reference';
  scoringStatus: 'unconfirmed' | 'official' | 'reference';
  /** Points correspond to the selected order, not to source-past-paper question numbers. */
  pointsPerQuestion: number[] | null;
  scoringNotes: string;
  requiresCalculation: boolean | null;
}
export interface MockExamSession {
  id: string;
  specificationId: string;
  specificationVersion: number;
  grade: Grade;
  exam: ExamCategory;
  questionIds: string[];
  questionVersions: Record<string, number>;
  responses: Record<string, number | string>;
  flaggedIds: string[];
  currentIndex: number;
  startedAt: string;
  deadlineAt: string;
  finishedAt: string | null;
  endReason: 'submitted' | 'expired' | null;
}
export interface MockReadiness { ready: boolean; reasons: string[]; available: number; selected: MaterialQuestion[] }
const formats: QuestionFormat[] = ['true-false', 'multiple-choice', 'numeric'];
function specificationProblems(spec: ExamSpecification): string[] {
  const reasons: string[] = [];
  if (spec.verificationStatus !== 'verified' || !isCalendarDate(spec.verifiedAt)) reasons.push('公式試験仕様の原典照合が完了していません');
  if (!isCalendarDate(spec.lawReferenceDate)) reasons.push('法令基準日が未確認です');
  if (!spec.sources.length || spec.sources.some(s => {
    try {const u=new URL(s.url);return u.protocol!=='https:'||Boolean(u.username)||Boolean(u.password)||!['jafp.or.jp','www.jafp.or.jp'].includes(u.hostname)||!isCalendarDate(s.checkedAt)||!s.title.trim();}catch{return true;}
  })) reasons.push('日本FP協会の原典と実確認日が必要です');
  if (!Number.isSafeInteger(spec.version) || spec.version<1 || !spec.id.trim()) reasons.push('試験仕様の識別情報が不正です');
  if (!spec.questionCount || !Number.isSafeInteger(spec.questionCount) || spec.questionCount<1 || spec.questionCount>1000 || spec.countingUnit!=='scored-item') reasons.push('問題数と採点単位が未確認です');
  if (!spec.durationMinutes || !Number.isFinite(spec.durationMinutes) || spec.durationMinutes<=0 || spec.durationMinutes>1440) reasons.push('制限時間が未確認です');
  if (!spec.fullScore || !Number.isSafeInteger(spec.fullScore) || spec.fullScore<=0 || spec.passingScore===null || !Number.isFinite(spec.passingScore) || spec.passingScore<0 || spec.passingScore>spec.fullScore) reasons.push('満点または合格基準が未確認です');
  if (spec.requiresCalculation!==true) reasons.push('計算問題を含む出題構成が未確認です');
  if (!spec.formats?.length || spec.formats.some(f=>!formats.includes(f)) || new Set(spec.formats).size!==spec.formats.length) reasons.push('出題形式が未確認です');
  if (spec.distributionStatus==='unconfirmed' || !spec.subjectDistribution || !spec.formatDistribution) reasons.push('分野・形式の出題配分が未確認です');
  if (spec.subjectDistribution) {
    const entries=Object.entries(spec.subjectDistribution);
    if (entries.some(([key,n])=>!subjects.some(s=>s.id===key)||!Number.isSafeInteger(n)||n<0) || entries.reduce((sum,[,n])=>sum+n,0)!==spec.questionCount) reasons.push('分野配分の合計が問題数と一致しません');
  }
  if (spec.formatDistribution) {
    const entries=Object.entries(spec.formatDistribution);
    if (entries.some(([key,n])=>!formats.includes(key as QuestionFormat)||!spec.formats?.includes(key as QuestionFormat)||!Number.isSafeInteger(n)||n<0) || entries.reduce((sum,[,n])=>sum+n,0)!==spec.questionCount) reasons.push('形式配分の合計が問題数と一致しません');
  }
  if (spec.scoringStatus==='unconfirmed') reasons.push('公式配点または参考配点の方針が未確認です');
  if (spec.scoringStatus==='official' && (!spec.pointsPerQuestion || spec.pointsPerQuestion.length!==spec.questionCount || spec.pointsPerQuestion.some(p=>!Number.isFinite(p)||p<=0)||Math.abs(spec.pointsPerQuestion.reduce((sum,p)=>sum+p,0)-(spec.fullScore??0))>0.000001)) reasons.push('公式配点の合計が満点と一致しません');
  if (spec.scoringStatus==='reference' && (!spec.scoringNotes.trim()||spec.pointsPerQuestion!==null)) reasons.push('参考採点は均等配点と説明を指定してください');
  return reasons;
}
function shuffle<T>(items: readonly T[], random:()=>number):T[]{
  const output=[...items];
  for(let i=output.length-1;i>0;i--){const value=random();if(!Number.isFinite(value)||value<0||value>=1)throw new RangeError('乱数は0以上1未満です');const j=Math.floor(value*(i+1));[output[i],output[j]]=[output[j],output[i]];}
  return output;
}
/** Integral max-flow allocates subject AND format quotas without greedy-order failures. */
function allocate(candidates:MaterialQuestion[], subjectQuota:Partial<Record<Subject,number>>, formatQuota:Partial<Record<QuestionFormat,number>>):MaterialQuestion[]|null{
  const fieldIds=subjects.map(s=>s.id);const size=11;const source=0,sink=10;
  const capacity=Array.from({length:size},()=>Array<number>(size).fill(0));const flow=Array.from({length:size},()=>Array<number>(size).fill(0));
  fieldIds.forEach((s,i)=>capacity[source][i+1]=subjectQuota[s]??0);
  formats.forEach((f,i)=>capacity[7+i][sink]=formatQuota[f]??0);
  fieldIds.forEach((s,i)=>formats.forEach((f,j)=>capacity[i+1][7+j]=candidates.filter(q=>q.subject===s&&q.format===f).length));
  let total=0;
  while(true){const parent=Array<number>(size).fill(-1);parent[source]=source;const queue=[source];
    for(let index=0;index<queue.length&&parent[sink]===-1;index++)for(let next=0;next<size;next++)if(parent[next]===-1&&capacity[queue[index]][next]-flow[queue[index]][next]>0){parent[next]=queue[index];queue.push(next);}
    if(parent[sink]===-1)break;
    let delta=Infinity;for(let node=sink;node!==source;node=parent[node])delta=Math.min(delta,capacity[parent[node]][node]-flow[parent[node]][node]);
    for(let node=sink;node!==source;node=parent[node]){flow[parent[node]][node]+=delta;flow[node][parent[node]]-=delta;}total+=delta;
  }
  if(total!==Object.values(subjectQuota).reduce((sum,n)=>sum+n,0))return null;
  const result:MaterialQuestion[]=[];
  fieldIds.forEach((s,i)=>formats.forEach((f,j)=>result.push(...candidates.filter(q=>q.subject===s&&q.format===f).slice(0,flow[i+1][7+j]))));
  return result;
}
function selectExamQuestions(spec:ExamSpecification,candidates:MaterialQuestion[],random:()=>number):MaterialQuestion[]|null{
  if(!spec.subjectDistribution||!spec.formatDistribution)return null;
  const shuffled=shuffle(candidates,random);
  // Reserve one calculation first, then solve the remaining joint quotas. Never remove calculations due to normal-practice preferences.
  for(const calculation of shuffled.filter(q=>q.kind==='calculation')){
    const subjectQuota={...spec.subjectDistribution};const formatQuota={...spec.formatDistribution};
    if(!(subjectQuota[calculation.subject]??0)||!(formatQuota[calculation.format]??0))continue;
    subjectQuota[calculation.subject]=(subjectQuota[calculation.subject]??0)-1;formatQuota[calculation.format]=(formatQuota[calculation.format]??0)-1;
    const rest=allocate(shuffled.filter(q=>q.id!==calculation.id),subjectQuota,formatQuota);
    if(rest)return shuffle([calculation,...rest],random);
  }
  return null;
}
export function mockReadiness(spec:ExamSpecification,catalog:readonly MaterialQuestion[],random:()=>number=Math.random):MockReadiness{
  const reasons=specificationProblems(spec);const ids=new Set<string>();const prompts=new Set<string>();
  const eligible=catalog.filter(q=>{if(ids.has(q.id)||prompts.has(q.prompt.replace(/\s/g,''))||q.grade!==spec.grade||q.exam!==spec.exam||q.lawReferenceDate!==spec.lawReferenceDate||!canPublish(q)||!spec.formats?.includes(q.format))return false;ids.add(q.id);prompts.add(q.prompt.replace(/\s/g,''));return true;});
  if(spec.questionCount!==null&&eligible.length<spec.questionCount)reasons.push(`確認済み・公開可能問題が不足しています（必要${spec.questionCount}問／利用可能${eligible.length}問）`);
  if(!reasons.length){const selected=selectExamQuestions(spec,eligible,random);if(selected)return {ready:true,reasons:[],available:eligible.length,selected};reasons.push('分野・形式の配分を満たし、計算問題を含む問題セットを作れません');}
  return {ready:false,reasons,available:eligible.length,selected:[]};
}
function checkedTime(now:Date):string{if(!Number.isFinite(now.getTime()))throw new RangeError('日時が不正です');return now.toISOString();}
export function createMockSession(spec:ExamSpecification,catalog:readonly MaterialQuestion[],now=new Date(),random:()=>number=Math.random):MockExamSession{
  const readiness=mockReadiness(spec,catalog,random);if(!readiness.ready)throw new Error(readiness.reasons.join('。'));
  const startedAt=checkedTime(now);const deadlineAt=new Date(now.getTime()+spec.durationMinutes!*60000).toISOString();
  return {id:crypto.randomUUID(),specificationId:spec.id,specificationVersion:spec.version,grade:spec.grade,exam:spec.exam,questionIds:readiness.selected.map(q=>q.id),questionVersions:Object.fromEntries(readiness.selected.map(q=>[q.id,q.dataVersion])),responses:{},flaggedIds:[],currentIndex:0,startedAt,deadlineAt,finishedAt:null,endReason:null};
}
export function remainingMockSeconds(session:MockExamSession,now=new Date()):number{
  checkedTime(now);return session.finishedAt?0:Math.max(0,Math.ceil((Date.parse(session.deadlineAt)-now.getTime())/1000));
}
/** Safe to call on every tick and when restoring a persisted session. The original deadline is never extended. */
export function expireMockSession(session:MockExamSession,now=new Date()):MockExamSession{
  checkedTime(now);if(session.finishedAt||now.getTime()<Date.parse(session.deadlineAt))return session;
  return {...session,finishedAt:session.deadlineAt,endReason:'expired'};
}
export function moveMockQuestion(session:MockExamSession,index:number,now=new Date()):MockExamSession{
  const active=expireMockSession(session,now);if(active.finishedAt)return active;
  if(!Number.isSafeInteger(index)||index<0||index>=active.questionIds.length)throw new RangeError('問題番号が範囲外です');
  return {...active,currentIndex:index};
}
export function answerMockQuestion(session:MockExamSession,question:MaterialQuestion,response:number|string,now=new Date()):MockExamSession{
  const active=expireMockSession(session,now);if(active.finishedAt)return active;
  if(!active.questionIds.includes(question.id)||question.grade!==active.grade||question.exam!==active.exam||active.questionVersions[question.id]!==question.dataVersion)throw new Error('この試験の問題ではありません');
  if(!gradeAnswer(question,response).valid)throw new TypeError('解答形式が不正です');
  return {...active,responses:{...active.responses,[question.id]:response}};
}
export function toggleMockFlag(session:MockExamSession,questionId:string,now=new Date()):MockExamSession{
  const active=expireMockSession(session,now);if(active.finishedAt)return active;
  if(!active.questionIds.includes(questionId))throw new Error('この試験の問題ではありません');
  return {...active,flaggedIds:active.flaggedIds.includes(questionId)?active.flaggedIds.filter(id=>id!==questionId):[...active.flaggedIds,questionId]};
}
export function unansweredMockIds(session:MockExamSession):string[]{return session.questionIds.filter(id=>!Object.hasOwn(session.responses,id));}
export function finishMockSession(session:MockExamSession,now=new Date()):MockExamSession{
  const active=expireMockSession(session,now);if(active.finishedAt)return active;
  return {...active,finishedAt:checkedTime(now),endReason:'submitted'};
}
export interface MockExamResult {
  correct:number;total:number;unanswered:number;accuracy:number;score:number;fullScore:number;passingScore:number;
  passed:boolean;targetScore:number;targetReached:boolean;scoringStatus:'official'|'reference';scoringLabel:string;
  bySubject:Record<Subject,{correct:number;total:number}>;
  answers:{questionId:string;response:number|string|null;correct:boolean;points:number}[];
}
/** No score, correctness or correct answer is returned while the session is in progress. */
export function scoreMockSession(session:MockExamSession,spec:ExamSpecification,catalog:readonly MaterialQuestion[]):MockExamResult{
  if(!session.finishedAt)throw new Error('試験終了後に一括採点します');
  if(spec.id!==session.specificationId||spec.version!==session.specificationVersion||spec.grade!==session.grade||spec.exam!==session.exam)throw new Error('開始時の試験仕様と一致しません');
  if(specificationProblems(spec).length)throw new Error('試験仕様が未確認です');
  if(session.questionIds.length!==spec.questionCount||new Set(session.questionIds).size!==session.questionIds.length)throw new Error('問題セットが不正です');
  const questions=session.questionIds.map(id=>{const q=catalog.find(q=>q.id===id);if(!q||q.dataVersion!==session.questionVersions[id])throw new Error('開始時の問題データが見つかりません。履歴を保持し、対応する教材版を復元してください');return q;});
  const bySubject=Object.fromEntries(subjects.map(s=>[s.id,{correct:0,total:0}])) as Record<Subject,{correct:number;total:number}>;
  const answers=questions.map((q,index)=>{const response=Object.hasOwn(session.responses,q.id)?session.responses[q.id]:null;const correct=gradeAnswer(q,response).correct;const points=correct?(spec.scoringStatus==='official'?spec.pointsPerQuestion![index]:spec.fullScore!/questions.length):0;bySubject[q.subject].total++;if(correct)bySubject[q.subject].correct++;return {questionId:q.id,response,correct,points};});
  const correct=answers.filter(a=>a.correct).length;const score=Math.round(answers.reduce((sum,a)=>sum+a.points,0)*1000000)/1000000;
  const personalTarget=targetScore(spec.fullScore!);
  return {correct,total:questions.length,unanswered:unansweredMockIds(session).length,accuracy:correct/questions.length*100,score,fullScore:spec.fullScore!,passingScore:spec.passingScore!,passed:score>=spec.passingScore!,targetScore:personalTarget,targetReached:score>=personalTarget,scoringStatus:spec.scoringStatus as 'official'|'reference',scoringLabel:spec.scoringStatus==='official'?'公式配点に基づく採点':'参考採点（均等配点・本試験の得点や合否を保証しません）',bySubject,answers};
}

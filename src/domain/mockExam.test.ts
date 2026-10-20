import { describe, expect, it } from 'vitest';
import { examSpecifications } from '../data/examSpecifications';
import { materialFixture } from './fixtures.test-helper';
import type { MaterialQuestion } from './curriculum';
import { answerMockQuestion, createMockSession, expireMockSession, finishMockSession, mockReadiness, moveMockQuestion, remainingMockSeconds, scoreMockSession, toggleMockFlag, unansweredMockIds, type ExamSpecification } from './mockExam';
function specification(overrides: Partial<ExamSpecification>={}):ExamSpecification {
  return {id:'synthetic-mock',version:1,grade:'3',exam:'academic',verificationStatus:'verified',verifiedAt:'2026-01-01',sources:[{title:'Synthetic test specification — never real exam data',url:'https://www.jafp.or.jp/exam/',checkedAt:'2026-01-01'}],lawReferenceDate:'2026-01-01',formats:['multiple-choice'],questionCount:4,countingUnit:'scored-item',durationMinutes:10,fullScore:100,passingScore:60,subjectDistribution:{life:2,risk:2},formatDistribution:{'multiple-choice':4},distributionStatus:'official',scoringStatus:'official',pointsPerQuestion:[25,25,25,25],scoringNotes:'Synthetic test scoring only',requiresCalculation:true,...overrides};
}
function bank():MaterialQuestion[]{
  return Array.from({length:4},(_,i)=>{
    const q=materialFixture({id:`mock-q${i}`,prompt:`自動テスト専用問題 ${i}`,subject:i<2?'life':'risk',kind:i===3?'calculation':'knowledge'});
    if(q.kind==='calculation')q.explanation.formula='自動テスト専用の式';
    return q;
  });
}
const start=new Date('2026-01-01T00:00:00Z');
const active=new Date('2026-01-01T00:05:00Z');
describe('official-specification gates',()=>{
 it('keeps every production exam specification unknown and refuses to start from remembered exam facts',()=>{
  expect(examSpecifications).toHaveLength(4);
  expect(new Set(examSpecifications.map(s=>`${s.grade}-${s.exam}`)).size).toBe(4);
  for(const spec of examSpecifications){expect(spec.questionCount).toBeNull();expect(spec.durationMinutes).toBeNull();expect(spec.passingScore).toBeNull();expect(mockReadiness(spec,bank()).ready).toBe(false);expect(()=>createMockSession(spec,bank(),start)).toThrow('原典照合');}
 });
 it('rejects missing source checks, unknown scoring and shortages without duplicating fillers',()=>{
  expect(mockReadiness(specification({sources:[]}),bank()).ready).toBe(false);
  expect(mockReadiness(specification({scoringStatus:'unconfirmed'}),bank()).ready).toBe(false);
  const short=mockReadiness(specification(),bank().slice(0,3));expect(short.reasons.join(' ')).toContain('必要4問／利用可能3問');expect(short.selected).toHaveLength(0);
  const q=bank()[0];expect(mockReadiness(specification(),[q,q,q,q]).available).toBe(1);
 });
 it('matches subject and format quotas simultaneously and always includes calculation',()=>{
  const qs=bank().map((q,i)=>i<2?{...q,format:'true-false' as const,choices:['A','B'],choiceExplanations:['誤答','正答']}:q);
  const spec=specification({formats:['true-false','multiple-choice'],formatDistribution:{'true-false':2,'multiple-choice':2}});
  const readiness=mockReadiness(spec,qs,()=>.5);expect(readiness.ready).toBe(true);
  expect(readiness.selected.filter(q=>q.subject==='life')).toHaveLength(2);expect(readiness.selected.filter(q=>q.format==='true-false')).toHaveLength(2);expect(readiness.selected.some(q=>q.kind==='calculation')).toBe(true);
  expect(new Set(readiness.selected.map(q=>q.id)).size).toBe(4);
  expect(mockReadiness(specification(),bank().map(q=>({...q,kind:'knowledge'}))).ready).toBe(false);
 });
 it('rejects semantic duplicate questions with different IDs',()=>{
  const qs=bank();qs[1]={...qs[1],prompt:qs[0].prompt};expect(mockReadiness(specification(),qs).ready).toBe(false);
 });
});
describe('mock exam lifecycle',()=>{
 it('stores an absolute deadline and preserves it on serialization, navigation and resume',()=>{
  const spec=specification();const qs=bank();const session=createMockSession(spec,qs,start,()=>.5);
  expect(session.deadlineAt).toBe('2026-01-01T00:10:00.000Z');
  const resumed=JSON.parse(JSON.stringify(session)) as typeof session;
  const moved=moveMockQuestion(resumed,3,active);expect(moved.currentIndex).toBe(3);expect(moved.deadlineAt).toBe(session.deadlineAt);expect(remainingMockSeconds(moved,active)).toBe(300);
  expect(()=>moveMockQuestion(moved,4,active)).toThrow('範囲外');
 });
 it('supports answer edits, flags and unanswered indicators without leaking grading results',()=>{
  const qs=bank();let session=createMockSession(specification(),qs,start,()=>.5);const q=qs.find(q=>q.id===session.questionIds[0])!;
  session=answerMockQuestion(session,q,0,active);session=answerMockQuestion(session,q,1,active);
  session=toggleMockFlag(session,q.id,active);expect(session.flaggedIds).toEqual([q.id]);expect(session.responses[q.id]).toBe(1);
  expect(unansweredMockIds(session)).toHaveLength(3);expect(Object.hasOwn(session,'score')).toBe(false);
  expect(()=>scoreMockSession(session,specification(),qs)).toThrow('終了後');
  session=toggleMockFlag(session,q.id,active);expect(session.flaggedIds).toEqual([]);
  expect(()=>answerMockQuestion(session,q,100,active)).toThrow('形式');
 });
 it('expires exactly at the deadline, ignores late answers and never extends the timer',()=>{
  const qs=bank();let session=createMockSession(specification(),qs,start,()=>.5);const q=qs.find(q=>q.id===session.questionIds[0])!;
  session=answerMockQuestion(session,q,1,new Date(session.deadlineAt));
  expect(session.endReason).toBe('expired');expect(session.finishedAt).toBe(session.deadlineAt);expect(session.responses).toEqual({});
  expect(expireMockSession(session,new Date('2027-01-01'))).toBe(session);expect(remainingMockSeconds(session,start)).toBe(0);
 });
 it('scores only after submission and keeps the official pass threshold separate from a 95% target',()=>{
  const spec=specification();const qs=bank();let session=createMockSession(spec,qs,start,()=>.5);
  for(const id of session.questionIds.slice(0,3))session=answerMockQuestion(session,qs.find(q=>q.id===id)!,1,active);
  session=finishMockSession(session,active);const result=scoreMockSession(session,spec,qs);
  expect(result).toMatchObject({correct:3,total:4,unanswered:1,score:75,fullScore:100,passingScore:60,passed:true,targetScore:95,targetReached:false,scoringStatus:'official'});
  expect(result.bySubject.life.total+result.bySubject.risk.total).toBe(4);
  expect(answerMockQuestion(session,qs[0],0,active)).toBe(session);
 });
 it('labels equal-weight reference scoring and refuses silently changed data versions',()=>{
  const spec=specification({scoringStatus:'reference',pointsPerQuestion:null,scoringNotes:'均等配点の参考採点'});const qs=bank();let session=createMockSession(spec,qs,start,()=>.5);
  for(const q of qs)session=answerMockQuestion(session,q,1,active);
  session=finishMockSession(session,active);const result=scoreMockSession(session,spec,qs);expect(result.score).toBe(100);expect(result.scoringLabel).toContain('参考採点');expect(result.targetReached).toBe(true);
  expect(()=>scoreMockSession(session,{...spec,version:2},qs)).toThrow('開始時の試験仕様');
  expect(()=>scoreMockSession(session,spec,qs.map(q=>({...q,dataVersion:2})))).toThrow('開始時の問題データ');
 });
});

import { describe, expect, it } from 'vitest';
import { analyzeLearning, calculateRate, getCoverage, type LearningAttempt } from './analytics';
import { materialFixture, topicFixture } from './fixtures.test-helper';
function attempt(id:string,correct:boolean,index:number,mode:LearningAttempt['mode']='practice'):LearningAttempt{return {id:`a-${index}`,questionId:id,selected:1,correct,answeredAt:new Date(Date.UTC(2026,0,1,0,index)).toISOString(),mode,grade:'3',exam:'academic',durationMs:1000};}
describe('attainment analysis',()=>{
 it('does not equate repeated correct answers with first-seen mastery',()=>{
  const q=materialFixture();const attempts=[attempt(q.id,false,0),...Array.from({length:99},(_,i)=>attempt(q.id,true,i+1,'review'))];
  const analysis=analyzeLearning([q],attempts,'3','academic');expect(analysis.cumulative.accuracy).toBe(99);expect(analysis.firstSeen.accuracy).toBe(0);expect(analysis.review.accuracy).toBe(100);expect(analysis.targetReached).toBe(false);expect(analysis.evidence).toBe('insufficient');
 });
 it('separates categories, timing and modes, and ignores quarantined evidence',()=>{
  const q=materialFixture();const calc=materialFixture({id:'calc',kind:'calculation',explanation:{...q.explanation,formula:'テスト式'}});const unverified=materialFixture({id:'draft',verification:{...q.verification,status:'draft'}});
  const result=analyzeLearning([q,calc,unverified],[attempt(q.id,true,1),attempt(calc.id,false,2,'calculation'),attempt('draft',true,3),{...attempt(q.id,true,4),exam:'practical'}],'3','academic',1);
  expect(result.cumulative.total).toBe(2);expect(result.recent.accuracy).toBe(0);expect(result.practice.total).toBe(1);expect(result.calculation.total).toBe(1);expect(result.durationMs).toBe(2000);expect(result.bySubject.life.total).toBe(2);
 });

 it('filters grade and exam before choosing first-seen evidence and sorts imported history chronologically',()=>{
  const q=materialFixture();const topic=topicFixture();
  const history=[attempt(q.id,false,3),{...attempt(q.id,false,0),exam:'practical' as const},attempt(q.id,true,1)];
  const analysis=analyzeLearning([q],history,'3','academic');
  expect(analysis.firstSeen.accuracy).toBe(100);expect(analysis.recent.accuracy).toBe(50);
  const coverage=getCoverage([topic],[q],history,'3','academic');
  expect(coverage.topics[0].firstSeen.accuracy).toBe(100);
 });
 it('does not reclassify a review-only imported record as first-seen performance',()=>{
  const q=materialFixture();const history=[attempt(q.id,true,0,'review')];
  const analysis=analyzeLearning([q],history,'3','academic');
  expect(analysis.firstSeen.total).toBe(0);expect(analysis.review.total).toBe(1);expect(analysis.answeredQuestionCount).toBe(1);
  const coverage=getCoverage([topicFixture()],[q],history,'3','academic');
  expect(coverage.topics[0].firstSeen.total).toBe(0);expect(coverage.topics[0].learned).toBe(true);expect(coverage.topics[0].mastered).toBe(false);
 });
 it('does not round a below-target accuracy upward',()=>{expect(calculateRate(Array.from({length:200},(_,i)=>({correct:i<189}))).accuracy).toBe(94.5);});
 it('keeps question count, topic coverage and learner mastery independent',()=>{
  const topic1=topicFixture();const topic2=topicFixture({id:'empty-topic'});const qs=Array.from({length:100},(_,i)=>materialFixture({id:`q-${i}`}));
  const coverage=getCoverage([topic1,topic2],qs,qs.map((q,i)=>attempt(q.id,true,i)),'3','academic');
  expect(coverage.questionVerificationRate).toBe(1);expect(coverage.topicCoverage).toBe(.5);expect(coverage.masteryRate).toBe(.5);expect(coverage.pendingTopicIds).toEqual(['empty-topic']);
  const unconfirmed=getCoverage([{...topic1,scopeVerified:false},topic2],qs,[],'3','academic');expect(unconfirmed.topicCoverage).toBeNull();expect(unconfirmed.masteryRate).toBeNull();
 });
});

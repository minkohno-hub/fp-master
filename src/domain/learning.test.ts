import { describe, expect, it } from 'vitest';
import { questions } from '../data/questions';
import { reviewIds, selectQuestions, summarize, subjects, type Attempt } from './learning';
const attempt = (correct: boolean, questionId = 'sample-3-1'): Attempt => ({id:crypto.randomUUID(),questionId,correct,selected:1,answeredAt:new Date().toISOString()});
describe('learning domain',()=>{
 it('distinguishes an empty history from zero percent',()=>{expect(summarize([]).accuracy).toBeNull();expect(summarize([attempt(false)]).accuracy).toBe(0);expect(summarize([attempt(true),attempt(false),attempt(true)]).accuracy).toBe(67);});
 it('uses the latest answer to determine review eligibility',()=>{expect([...reviewIds([attempt(false),attempt(true)])]).toEqual([]);expect([...reviewIds([attempt(true),attempt(false)])]).toEqual(['sample-3-1']);});
 it('isolates grades, subjects, calculation and review queues',()=>{
 expect(selectQuestions(questions,'2','practice',[])).toHaveLength(3);
 expect(selectQuestions(questions,'3','calculation',[]).every(q=>q.kind==='calculation'&&q.grade==='3')).toBe(true);
 expect(selectQuestions(questions,'3','practice',[],'risk')).toHaveLength(1);
 expect(selectQuestions(questions,'3','practice',[]).every(q=>q.kind==='knowledge')).toBe(true);
 expect(selectQuestions(questions,'2','review',[attempt(false)])).toHaveLength(0);
 expect(selectQuestions(questions,'3','review',[attempt(false)])).toHaveLength(1);
 });
 it('provides valid sample content across six subjects for each grade',()=>{expect(new Set(questions.map(q=>q.id)).size).toBe(questions.length);for(const grade of ['2','3'] as const){expect(new Set(questions.filter(q=>q.grade===grade).map(q=>q.subject)).size).toBe(subjects.length);}for(const q of questions){expect(q.choices[q.answer]).toBeTruthy();expect(q.explanation.length).toBeGreaterThan(20);}});
});

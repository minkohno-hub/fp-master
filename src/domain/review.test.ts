import { describe, expect, it } from 'vitest';
import { dueReviews, scheduleReview } from './review';
describe('SM-2-inspired review scheduling',()=>{
 it('schedules uncertain correct answers sooner than confident ones',()=>{
  const answer={questionId:'q',correct:true,answeredAt:'2026-01-31T12:00:00Z'};
  expect(scheduleReview(undefined,{...answer,rating:'again'}).nextReviewAt).toBe('2026-02-01T12:00:00.000Z');
  expect(scheduleReview(undefined,{...answer,rating:'easy'}).nextReviewAt).toBe('2026-02-04T12:00:00.000Z');
 });
 it('expands intervals, resets failures, and respects a floor for ease',()=>{
  let state=scheduleReview(undefined,{questionId:'q',correct:true,rating:'good',answeredAt:'2026-01-01T00:00:00Z'});
  state=scheduleReview(state,{questionId:'q',correct:true,rating:'good',answeredAt:state.nextReviewAt});expect(state.intervalDays).toBe(6);
  for(let i=0;i<10;i++)state=scheduleReview(state,{questionId:'q',correct:false,rating:'easy',answeredAt:state.nextReviewAt});
  expect(state.ease).toBe(1.3);expect(state.intervalDays).toBe(1);expect(state.consecutiveCorrect).toBe(0);expect(state.repetitions).toBe(0);
 });
 it('returns only reviews due by the given moment and rejects another question state',()=>{
  const state=scheduleReview(undefined,{questionId:'q',correct:true,rating:'good',answeredAt:'2026-01-01T00:00:00Z'});
  expect(dueReviews([state],new Date('2026-01-01T23:59:59Z'))).toHaveLength(0);expect(dueReviews([state],new Date(state.nextReviewAt))).toHaveLength(1);
  expect(()=>scheduleReview(state,{questionId:'q',correct:false,rating:'again',answeredAt:'2025-12-31T00:00:00Z'})).toThrow('過去の回答');
  expect(()=>scheduleReview(state,{questionId:'other',correct:true,rating:'good',answeredAt:'2026-01-01T00:00:00Z'})).toThrow();
 });
});

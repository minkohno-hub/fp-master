import { describe, expect, it } from 'vitest';
import { canPublish, isCalendarDate, publicationProblems, validateCatalog, validateMaterial } from './curriculum';
import { materialFixture, topicFixture } from './fixtures.test-helper';
import { catalog, topicInventory, verifiedQuestions } from '../data/catalog';
import { quarantinedQuestions } from '../data/quarantine';
describe('editorial release gate',()=>{
 it('does not infer source verification from a correct-looking question or legacy sample date',()=>{
  expect(verifiedQuestions).toHaveLength(0);expect(catalog).toHaveLength(0);expect(quarantinedQuestions).toHaveLength(12);
  expect(catalog.every(q=>!canPublish(q))).toBe(true);
  expect(topicInventory.every(t=>!t.scopeVerified&&t.officialScope===null)).toBe(true);
 });
 it('requires original-check evidence and explicit Web publication permission',()=>{
  const q=materialFixture();expect(validateMaterial(q)).toEqual([]);expect(canPublish(q)).toBe(true);
  expect(canPublish({...q,verification:{...q.verification,status:'needs-review'}})).toBe(false);
  expect(canPublish({...q,source:{...q.source,publication:'unknown'}})).toBe(false);
  expect(canPublish({...q,source:{...q.source,references:[{...q.source.references[0],checkedAt:null}]}})).toBe(false);
  expect(canPublish({...q,verification:{...q.verification,evidence:[]}})).toBe(false);
 });
 it('validates answer indexes, choices, classification and explanations',()=>{
  const q=materialFixture({grading:{type:'choice',correctIndex:4},choiceExplanations:[]});
  const errors=validateMaterial(q,[topicFixture({subject:'finance'})]);
  expect(errors.join(' ')).toContain('正答');expect(errors.join(' ')).toContain('全選択肢');expect(errors.join(' ')).toContain('論点分類');
  expect(validateCatalog([materialFixture(),materialFixture()],[topicFixture()]).join(' ')).toContain('重複');
 });
 it('requires provenance for adapted questions and rejects calendar impossibilities',()=>{
  const q=materialFixture();expect(publicationProblems({...q,source:{...q.source,origin:'adapted'}}).join(' ')).toContain('原問題');
  expect(isCalendarDate('2025-02-29')).toBe(false);expect(isCalendarDate('2024-02-29')).toBe(true);expect(isCalendarDate('2026-13-01')).toBe(false);
 });
});

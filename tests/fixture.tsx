// Test harness only: Vite's production entry is index.html, which never imports
// this module. The synthetic records make no FP educational or factual claim.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '../src/App';
import { materialFixture, topicFixture } from '../src/domain/fixtures.test-helper';
import type { Term } from '../src/features/glossary/terms';
import '../src/styles.css';

const catalog = Array.from({ length: 100 }, (_, index) => materialFixture({
  id: `e2e-knowledge-${index + 1}`,
  prompt: `E2E自動テスト専用の知識問題 ${index + 1}。教材ではありません。`,
  relatedTerms: ['e2e-term'],
}));
catalog.push(materialFixture({
  id: 'e2e-calculation', kind: 'calculation', format: 'numeric',
  prompt: 'E2E自動テスト専用の計算問題。10 × 12 を入力してください。',
  choices: [], choiceExplanations: [],
  grading: { type: 'numeric', expected: '120', unit: 'テスト単位', decimalPlaces: 0, rounding: 'half-up' },
  explanation: {
    concise: 'テスト用の計算結果は120です。',
    standard: '10 × 12 = 120。自動テスト専用です。',
    detailed: '数値入力と保存の自動テスト用であり、FP教材ではありません。',
    conditions: [], exceptions: [], commonMistakes: [], example: '', formula: '10 × 12 = 120',
  },
}));
catalog.push(materialFixture({
  id: 'e2e-unverified', prompt: '出題されてはいけない未確認のテスト問題',
  verification: { status: 'needs-review', checkedAt: null, reviewer: null, evidence: [] },
}));
const termCatalog: Term[] = [{
  id: 'e2e-term', name: 'テスト用語', reading: 'てすとようご',
  summary: '自動テスト専用の用語説明です。', detail: '検索と問題連携を確認するための合成データです。',
  example: 'FPの知識や制度を説明する教材ではありません。', conditions: '自動テストでのみ利用します。',
  figures: [], relatedTerms: [], relatedQuestions: ['e2e-knowledge-1'],
  grades: ['3'], subject: 'life', importance: 'basic',
  sources: [{ title: 'Synthetic test evidence', url: 'https://example.com/test-evidence' }],
  legalDate: '2026-01-01', verifiedAt: '2026-01-01',
}];
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><div data-testid="fixture-warning" style={{ padding: 8, background: '#fff0c0', color: '#443000' }}>自動テスト専用画面・合成データです。学習教材として利用しないでください。</div><App catalog={catalog} topics={[topicFixture({termIds:['e2e-term']})]} termCatalog={termCatalog}/></React.StrictMode>,
);

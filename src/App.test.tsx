import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { App } from './App';
it('answers a question, shows explanation, restores history and resolves a review',async()=>{
 const user=userEvent.setup();const view=render(<App/>);
 await user.click(screen.getByRole('button',{name:/問題演習をはじめる/}));
 expect(screen.getByRole('button',{name:'回答する →'})).toBeDisabled();
 await user.click(screen.getByLabelText('100万円'));await user.click(screen.getByRole('button',{name:'回答する →'}));
 expect(screen.getByRole('status')).toHaveTextContent('120万円');
 expect(screen.getByRole('button',{name:'次の問題へ →'})).toBeEnabled();
 view.unmount();render(<App/>);
 await user.click(within(screen.getByRole('navigation')).getByRole('button',{name:/復習/}));
 await user.click(screen.getByRole('button',{name:'復習をはじめる →'}));
 await user.click(screen.getByLabelText('120万円'));await user.click(screen.getByRole('button',{name:'回答する →'}));
 expect(screen.getByRole('status')).toHaveTextContent('正解です');
 await user.click(screen.getByRole('button',{name:'結果・学習履歴を見る →'}));
 expect(screen.getByRole('heading',{name:'回答履歴'})).toBeVisible();
 expect(screen.getAllByText(/回答：/)).toHaveLength(2);
 await user.click(within(screen.getByRole('navigation')).getByRole('button',{name:/復習/}));
 expect(screen.getByText('復習待ちの問題はありません')).toBeVisible();
});
it('switches grade and supports calculation-only practice',async()=>{
 const user=userEvent.setup();render(<App/>);await user.selectOptions(screen.getByRole('combobox',{name:'学習コース'}),'2');
 await user.click(screen.getByRole('button',{name:'計算問題に挑戦する →'}));
 expect(screen.getByText('CALCULATION / FP2級')).toBeVisible();expect(screen.getByText(/問題 1 \/ 3/)).toBeVisible();
});
it('shows unavailable mock exams honestly',()=>{render(<App/>);expect(screen.getByText('本番形式で実力をチェック。今後追加予定。')).toBeVisible();});

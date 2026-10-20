import { expect, it, vi } from 'vitest';
import { loadHistory, saveHistory } from './history';
it('persists and restores valid attempts',()=>{const attempts=[{id:'a',questionId:'q',selected:0,correct:true,answeredAt:'2026-10-01T12:00:00Z'}];expect(saveHistory(attempts)).toBe(true);expect(loadHistory()).toEqual({attempts,warning:null});});
it('handles corrupted data without deleting it',()=>{localStorage.setItem('fp-master.history.v1','invalid');expect(loadHistory().warning).toBeTruthy();expect(localStorage.getItem('fp-master.history.v1')).toBe('invalid');});
it('rejects structurally invalid attempts',()=>{localStorage.setItem('fp-master.history.v1',JSON.stringify([{id:'a'}]));expect(loadHistory().warning).toBeTruthy();});
it('reports storage denial',()=>{vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Quota');});expect(saveHistory([])).toBe(false);});

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

/** 学習メモと問題の誤り報告 */
export function NoteAndReport({ itemKey }: { itemKey: string }) {
  const note = useLiveQuery(() => db.notes.get(itemKey), [itemKey]);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState('');
  const [sent, setSent] = useState(false);
  useEffect(() => setText(note?.text ?? ''), [note]);

  const saveNote = async () => {
    if (text.trim()) await db.notes.put({ key: itemKey, text, updatedAt: new Date().toISOString() });
    else await db.notes.delete(itemKey);
  };
  const sendReport = async () => {
    if (!report.trim()) return;
    await db.reports.add({ itemKey, text: report, createdAt: new Date().toISOString(), status: 'open' });
    setReport('');
    setSent(true);
  };

  return (
    <details className="card mt-3" open={open || !!note?.text} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="min-h-10 cursor-pointer font-semibold">メモ・誤りの報告{note?.text ? '（メモあり）' : ''}</summary>
      <div className="mt-2 space-y-3">
        <label className="block">
          <span className="label">学習メモ</span>
          <textarea className="input mt-1 min-h-20 py-2" value={text} onChange={(e) => setText(e.target.value)} onBlur={saveNote} placeholder="覚え方や気づきをメモ（自動保存）" />
        </label>
        <label className="block">
          <span className="label">問題・解説の誤りを報告</span>
          <textarea className="input mt-1 min-h-16 py-2" value={report} onChange={(e) => { setReport(e.target.value); setSent(false); }} placeholder="どこが誤っていると思うか" />
        </label>
        <button className="btn-secondary w-full" onClick={sendReport} disabled={!report.trim()}>
          報告を記録
        </button>
        {sent && <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">記録しました。「データ管理」から一覧の確認・書き出しができます。</p>}
      </div>
    </details>
  );
}

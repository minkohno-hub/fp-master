#!/usr/bin/env python3
"""日本FP協会の試験関連ページの変更検知。

試験要綱（試験時間・問題数・合格基準）、試験日程（法令基準日）、試験問題・模範解答（公表PDF一覧）を取得し、
アプリに組み込んだ値（src/domain/exam.ts）と照合する。差異があれば終了コード0のまま警告を出力する
（Issue 化は workflow 側で行う）。値の書き換えは人が確認してから行うこと。
"""
import html
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UA = 'Mozilla/5.0 (compatible; fp-master-source-check/1.0)'


def text(url: str) -> str:
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read().decode('utf-8', errors='replace')
    raw = re.sub(r'<script.*?</script>|<style.*?</style>', '', raw, flags=re.S)
    return re.sub(r'\s+', '', html.unescape(re.sub(r'<[^>]+>', '', raw)))


def main() -> None:
    warnings = []
    outline = text('https://www.jafp.or.jp/exam/outline/')
    for expect in ['学科試験120分60問多肢選択式36点以上（60点満点）', '実技試験90分40問多肢選択式及び記述式60点以上（100点満点）',
                   '学科試験90分60問多肢選択式36点以上（60点満点）', '実技試験60分20問多肢選択式60点以上（100点満点）']:
        if expect not in outline:
            warnings.append(f'試験要綱：「{expect}」が見つかりません（試験仕様が変わった可能性）')
    schedule = text('https://www.jafp.or.jp/exam/schedule/')
    exam_ts = (ROOT / 'src/domain/exam.ts').read_text(encoding='utf-8')
    known = set(re.findall(r"lawBaseDate: '(\d{4}-\d{2}-\d{2})'", exam_ts))
    found = {f'{y}-{int(m):02d}-{int(d):02d}' for y, m, d in re.findall(r'(\d{4})年(\d{1,2})月(\d{1,2})日', schedule)
             if f'{y}-{int(m):02d}-{int(d):02d}'.endswith('-04-01')}
    new = sorted(found - known)
    if new:
        warnings.append(f'試験日程：アプリ未登録の法令基準日候補 {new}（LAW_BASE_PERIODS の更新を検討）')
    mohan = text('https://www.jafp.or.jp/exam/mohan/')
    imported = {p.stem for p in (ROOT / 'src/content/questions').glob('*.json')}
    pdfs = set(re.findall(r'([gj][23]_\d{6})_(?:qa|q)\.pdf', urllib.request.urlopen(
        urllib.request.Request('https://www.jafp.or.jp/exam/mohan/', headers={'User-Agent': UA}), timeout=30).read().decode('utf-8', 'replace')))
    missing = sorted(p for p in pdfs if p not in imported and p.startswith('g'))
    if missing:
        warnings.append(f'試験問題・模範解答：未取り込みの学科問題 {missing}')
    jitsugi = sorted(p for p in pdfs if p.startswith('j') and not p.startswith('j1'))
    if jitsugi:
        print(f'参考：公表済みの実技問題 {jitsugi}（取り込み未対応分を含む）')
    _ = mohan
    for w in warnings:
        print('警告：' + w)
    if not warnings:
        print('日本FP協会の試験関連ページ：アプリの設定値と一致')


if __name__ == '__main__':
    sys.exit(main())

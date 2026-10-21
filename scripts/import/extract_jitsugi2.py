#!/usr/bin/env python3
"""
2級実技（資産設計提案業務）CBT公表分（2025年・2026年）の取り込み。

3級との違い：問題が複数ページにまたがる／解答形式が混在（○×の複数欄・数値入力・番号選択・複数欄の番号選択）。
- 問題文・資料・語群は、問題見出しから次の見出しまでを原本PDFから画像として切り出して表示（複数ページは縦に連結）
- 解答形式と正答は模範解答PDFから取得（推測しない）：
    "(ア)×"       → 正誤欄（truefalse）
    "250(万円)"    → 数値欄（numeric、単位つき）
    "４"           → 選択欄（choice、選択肢番号は問題文中の「N．」の最大値、なければ4）
    "(ア)2 (イ)5"  → 複数の選択欄（語群の番号。語群の最大番号まで）
- 分野・計算判定は overrides/<set>.json のレビュー結果で確定（未レビューは隔離）
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import extract_gakka as g  # noqa: E402
from extract_jitsugi import guess_field  # noqa: E402
from themes import classify  # noqa: E402

SETS = {
    'j2_202605': dict(q='j2_202605_q.pdf', a='j2_202605_a.pdf', label='2026年公表分', ym='2026-05', law='2025-04-01'),
    'j2_202505': dict(q='j2_202505_q.pdf', a='j2_202505_a.pdf', label='2025年公表分', ym='2025-05', law='2024-04-01'),
}
N = 40
KANA = 'アイウエオ'
H = str.maketrans('０１２３４５６７８９．，（）', '0123456789.,()')


def norm(s: str) -> str:
    return s.translate(H)


def parse_answer_sheet(path: Path) -> dict[int, str]:
    """二段組の模範解答から問ごとの解答テキストを取り出す。"""
    text = g.pdftotext(path)
    cur: dict[str, int | None] = {'L': None, 'R': None}
    ans: dict[int, list[str]] = {}
    for line in text.split('\n'):
        if not line.strip() or '模範解答' in line:
            continue
        heads = [(m.start(), int(norm(m.group(1)))) for m in re.finditer(r'問([0-9０-９]{1,2})', line)]
        if heads:
            # 見出しの位置で左右の欄に分ける
            for k, (pos, n) in enumerate(heads):
                end = heads[k + 1][0] if k + 1 < len(heads) else len(line)
                seg = line[pos:end]
                side = 'L' if pos < 30 else 'R'
                cur[side] = n
                ans.setdefault(n, []).append(re.sub(r'^問[0-9０-９]{1,2}', '', seg).strip())
        elif line.startswith(' ') and cur['L'] and cur['R'] is not None:
            # 継続行：インデントが小さければ左欄、大きければ右欄
            indent = len(line) - len(line.lstrip())
            side = 'L' if indent < 30 else 'R'
            if cur[side]:
                ans[cur[side]].append(line.strip())
    return {n: ' '.join(v) for n, v in ans.items()}


def parse_parts(answer: str, option_count: int) -> tuple[list[dict], str | None]:
    a = norm(answer)
    a = re.sub(r'\s+', ' ', a)
    parts: list[dict] = []
    tf = re.findall(r'\(([アイウエオ])\)\s*([○×])', a)
    if tf:
        return [{'kind': 'truefalse', 'id': f'p{k}', 'prompt': f'({k})', 'answer': v == '○'} for k, v in tf], None
    multi = re.findall(r'\(([アイウエオ])\)\s*([\d,\.]+)\s*(\((?![アイウエオ]\))[^)]*\))?', a)
    if multi:
        for k, v, unit in multi:
            # 単位がある・小数・10以上は数値欄、1桁の整数は語群の番号選択
            if unit or '.' in v or int(v.replace(',', '')) > 9:
                parts.append({'kind': 'numeric', 'id': f'p{k}', 'prompt': f'({k})', 'unit': unit.strip('()') if unit else '', 'answer': float(v.replace(',', ''))})
            else:
                parts.append({'kind': 'choice', 'id': f'p{k}', 'prompt': f'({k})', 'answer': v.strip(),
                              'choices': [{'id': str(i), 'text': str(i)} for i in range(1, option_count + 1)]})
        return parts, None
    m = re.fullmatch(r'([\d,\.]+)\s*(\(([^)]*)\))?', a.strip())
    if m:
        if m.group(3) is not None:
            return [{'kind': 'numeric', 'id': 'p1', 'unit': m.group(3), 'answer': float(m.group(1).replace(',', ''))}], None
        return [{'kind': 'choice', 'id': 'p1', 'answer': m.group(1),
                 'choices': [{'id': str(i), 'text': str(i)} for i in range(1, option_count + 1)]}], None
    return [], f'解答形式を解釈できない: {answer!r}'


def crop_multi(pdf: Path, qid: str, n: int) -> str:
    """問題見出し〜次の見出し（または最終ページの末尾）を、複数ページにまたがっても縦に連結して画像化する。"""
    from PIL import Image
    html = subprocess.run(['pdftotext', '-bbox-layout', str(pdf), '-'], check=True, capture_output=True, text=True).stdout
    pages = []
    for chunk in html.split('<page ')[1:]:
        m = g.PAGE_RE.match('<page ' + chunk)
        ws = [(float(a), float(b), float(c), float(d), t) for a, b, c, d, t in g.WORD_RE.findall(chunk)]
        # (xMin, yMin, xMax, yMax, text)
        pages.append((float(m.group(1)), float(m.group(2)), ws))
    zn = lambda k: str(k).translate(str.maketrans('0123456789', '０１２３４５６７８９'))
    def find(k: int):
        for pi, (_, _, ws) in enumerate(pages):
            for w in ws:
                if w[0] < 80 and w[4] in (f'問{zn(k)}', f'問{k}'):
                    return pi, w[3]
        return None
    start = find(n)
    end = find(n + 1)
    if not start:
        raise SystemExit(f'{qid}: 見出しが見つかりません')
    segs = []
    last_page = end[0] if end else len(pages) - 1
    for pi in range(start[0], last_page + 1):
        pw, ph, ws = pages[pi]
        footer = [w[1] for w in ws if re.fullmatch(r'－\d+終?－', w[4])]
        y0 = start[1] + 2 if pi == start[0] else 50
        y1 = (footer[0] - 4) if footer else ph - 40
        if end and pi == end[0]:
            # 次の問題の見出しの直前まで（見出しの上端）
            nxt = [w[1] for w in ws if w[0] < 80 and w[4] in (f'問{zn(n + 1)}', f'問{n + 1}')][0]
            y1 = min(y1, nxt - 3)
        if y1 - y0 > 12:
            segs.append((pi, y0, y1, pw))
    dpi = 144
    sc = dpi / 72
    imgs = []
    tmp = g.IMG_OUT / '_tmp'
    tmp.mkdir(parents=True, exist_ok=True)
    for pi, y0, y1, pw in segs:
        out = tmp / f'{qid}-{pi}'
        subprocess.run(['pdftoppm', '-r', str(dpi), '-png', '-singlefile', '-f', str(pi + 1), '-l', str(pi + 1),
                        '-x', str(int(50 * sc)), '-y', str(int(y0 * sc)), '-W', str(int((pw - 100) * sc)), '-H', str(int((y1 - y0) * sc)),
                        str(pdf), str(out)], check=True)
        imgs.append(Image.open(out.with_suffix('.png')).convert('L'))
    W = max(i.width for i in imgs)
    canvas = Image.new('L', (W, sum(i.height for i in imgs)), 255)
    y = 0
    for i in imgs:
        canvas.paste(i, (0, y))
        y += i.height
    dest = g.IMG_OUT / f'{qid}.png'
    canvas.quantize(colors=16).save(dest, optimize=True)
    for f in tmp.glob('*.png'):
        f.unlink()
    tmp.rmdir()
    return f'content-img/{qid}.png'


def extract(set_id: str) -> tuple[dict, list[str]]:
    cfg = SETS[set_id]
    qpdf, apdf = g.fetch(cfg['q']), g.fetch(cfg['a'])
    raw = g.pdftotext(qpdf)
    lines = [l for l in g.clean_lines(raw) if '実技試験' not in l or '問' in l]
    answers = parse_answer_sheet(apdf)
    if sorted(answers) != list(range(1, N + 1)):
        raise SystemExit(f'{set_id}: 正答を{N}問分取得できません（{sorted(set(range(1, N + 1)) - set(answers))}）')
    blocks = g.split_blocks(lines, re.compile(r'^\s*問\s*([0-9０-９]{1,2})\s*$'))
    citation = f'日本FP協会 2級ファイナンシャル・プランニング技能検定実技試験（資産設計提案業務） {cfg["label"]}'
    questions = []
    for n in range(1, N + 1):
        reasons: list[str] = []
        body = blocks.get(n, [])
        text = '\n'.join(body)
        stem_lines = []
        for l in body:
            if not l.strip():
                if stem_lines:
                    break
                continue
            stem_lines.append(l)
        stem = g.join_jp(stem_lines) or '（抽出失敗）'
        # 選択肢（「N．」形式）または語群の最大番号
        nums = [int(norm(m)) for m in re.findall(r'(?:^|\s)([１-９1-9])[．.]', text, flags=re.M)]
        option_count = max(nums) if nums else 4
        option_count = max(option_count, 2)
        parts, err = parse_parts(answers[n], option_count)
        if err:
            reasons.append(err)
        for p in parts:
            if p['kind'] == 'choice' and int(p['answer']) > option_count:
                reasons.append(f'正答番号{p["answer"]}が選択肢数{option_count}を超える')
        qid = f'{set_id.replace("_", "-")}-{n:02d}'
        materials = []
        try:
            materials = [{'kind': 'image', 'title': '問題・資料（原本PDFから切り出し）', 'src': crop_multi(qpdf, qid, n),
                          'alt': f'{stem}（問題文と資料の画像）', 'includesStem': True}]
        except SystemExit as e:
            reasons.append(f'資料画像を切り出せない（{e}）')
        if not parts:
            parts = [{'kind': 'truefalse', 'id': 'p1', 'answer': True}]
        field = guess_field(text)
        numeric = any(p['kind'] == 'numeric' for p in parts)
        q = {
            'id': qid, 'exam': 'j2', 'field': field, 'theme': classify(field, stem, text),
            'source': {'kind': 'official', 'citation': citation, 'yearMonth': cfg['ym'], 'number': n,
                       'url': g.BASE_URL + cfg['q'], 'answerUrl': g.BASE_URL + cfg['a'], 'modified': False},
            'lawBaseDate': cfg['law'], 'stem': stem, 'materials': materials, 'parts': parts,
            'requiresCalculation': numeric,
            **({'calcReason': '数値を計算して入力する解答欄がある'} if numeric else {}),
            'status': 'quarantined',
            'quarantineReason': ' / '.join(reasons) if reasons else '未レビュー（分野・計算判定・画像の目視確認待ち）',
        }
        if not materials:
            q.pop('materials')
        questions.append(q)
    return {'id': set_id, 'exam': 'j2', 'title': f'2級 実技 {cfg["label"]}', 'officialSet': True,
            'lawBaseDate': cfg['law'], 'questions': questions}, []


def main(argv: list[str]) -> None:
    from extract_jitsugi import apply_review
    for set_id in argv or list(SETS):
        data, report = extract(set_id)
        apply_review(set_id, data, report)
        ok = sum(q['status'] == 'verified' for q in data['questions'])
        report.insert(0, f'{set_id}: 検証済み {ok} / {len(data["questions"])}')
        for q in data['questions']:
            if q['status'] != 'verified':
                report.append(f'問{q["source"]["number"]}: 隔離 - {q["quarantineReason"]}')
        (g.OUT / f'{set_id}.json').write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        (g.REPORT / f'{set_id}.txt').write_text('\n'.join(report) + '\n', encoding='utf-8')
        print(report[0])


if __name__ == '__main__':
    main(sys.argv[1:])

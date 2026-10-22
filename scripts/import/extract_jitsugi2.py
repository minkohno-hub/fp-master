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
    # 紙試験（実施日つき）。法令基準日は問題冊子の注意事項に明記されている
    'j2_202405': dict(q='j2_202405_q.pdf', a='j2_202405_a.pdf', label='2024年5月実施', ym='2024-05', law='2023-10-01'),
    'j2_202409': dict(q='j2_202409_q.pdf', a='j2_202409_a.pdf', label='2024年9月実施', ym='2024-09', law='2024-04-01'),
    'j2_202501': dict(q='j2_202501_q.pdf', a='j2_202501_a.pdf', label='2025年1月実施', ym='2025-01', law='2024-10-01'),
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
            if unit or '.' in v or int(v.replace(',', '')) > max(9, option_count):
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


_PAGES: dict = {}


def _pages(pdf: Path):
    """(幅, 高さ, [(xMin, yMin, xMax, yMax, text)]) のページ一覧（PDFごとにキャッシュ）"""
    if pdf not in _PAGES:
        html = subprocess.run(['pdftotext', '-bbox-layout', str(pdf), '-'], check=True, capture_output=True, text=True).stdout
        pages = []
        for chunk in html.split('<page ')[1:]:
            m = g.PAGE_RE.match('<page ' + chunk)
            ws = [(float(a), float(b), float(c), float(d), t) for a, b, c, d, t in g.WORD_RE.findall(chunk)]
            pages.append((float(m.group(1)), float(m.group(2)), ws))
        _PAGES[pdf] = pages
    return _PAGES[pdf]


def _zn(k) -> str:
    return str(k).translate(str.maketrans('0123456789', '０１２３４５６７８９'))


def _find_heading(pages, k: int):
    for pi, (_, _, ws) in enumerate(pages):
        for w in ws:
            if w[0] < 80 and w[4] in (f'問{_zn(k)}', f'問{k}'):
                return pi, w[1], w[3]
    return None


def _banners(pages):
    """【第N問】の大問見出し（紙試験のみ）：[(page, yMin, 大問番号)]"""
    out = []
    for pi, (_, _, ws) in enumerate(pages):
        for w in ws:
            m = re.match(r'【第([0-9０-９]+)問】', w[4])
            if w[0] < 80 and m:
                out.append((pi, w[1], int(norm(m.group(1)))))
    return out


def _render(pdf: Path, pages, name: str, start: tuple[int, float], end: tuple[int, float] | None, min_h: float = 60) -> str | None:
    """start=(ページ, y上端) から end=(ページ, y上端：この手前まで) までを縦に連結して画像化。高さが小さければ None。"""
    from PIL import Image
    segs = []
    last_page = end[0] if end else len(pages) - 1
    for pi in range(start[0], last_page + 1):
        pw, ph, ws = pages[pi]
        footer = [w[1] for w in ws if re.fullmatch(r'－\d+終?－', w[4])]
        y0 = start[1] if pi == start[0] else 50
        y1 = (footer[0] - 4) if footer else ph - 40
        if end and pi == end[0]:
            y1 = min(y1, end[1] - 3)
        if y1 - y0 > 12:
            segs.append((pi, y0, y1, pw))
    if sum(s[2] - s[1] for s in segs) < min_h:
        return None
    dpi = 144
    sc = dpi / 72
    imgs = []
    tmp = g.IMG_OUT / '_tmp'
    tmp.mkdir(parents=True, exist_ok=True)
    for pi, y0, y1, pw in segs:
        out = tmp / f'{name}-{pi}'
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
    # 末尾の余白を切り詰める（問題が短いとき、ページ下部の空白が画像に残らないようにする）
    from PIL import ImageOps
    bbox = ImageOps.invert(canvas).getbbox()
    if bbox:
        canvas = canvas.crop((0, 0, canvas.width, min(canvas.height, bbox[3] + 16)))
    canvas.quantize(colors=16).save(g.IMG_OUT / f'{name}.png', optimize=True)
    for f in tmp.glob('*.png'):
        f.unlink()
    tmp.rmdir()
    return f'content-img/{name}.png'


def crop_multi(pdf: Path, qid: str, n: int) -> str:
    """問題見出し〜次の見出し（または最終ページの末尾）を、複数ページにまたがっても縦に連結して画像化する。"""
    pages = _pages(pdf)
    start = _find_heading(pages, n)
    end = _find_heading(pages, n + 1)
    if not start:
        raise SystemExit(f'{qid}: 見出しが見つかりません')
    end_pos = (end[0], end[1]) if end else None
    # 紙試験は次の問題の直前に【第N問】の大問見出しがある。そこまでで切る
    if end:
        cands = [b for b in _banners(pages) if (b[0], b[1]) > (start[0], start[1]) and (b[0], b[1]) < (end[0], end[1])]
        if cands:
            end_pos = (cands[0][0], cands[0][1])
    out = _render(pdf, pages, qid, (start[0], start[2] + 2), end_pos, min_h=20)
    if not out:
        raise SystemExit(f'{qid}: 問題部分の画像が空です')
    return out


def crop_shared(pdf: Path, set_id: str, n: int) -> str | None:
    """紙試験：大問の見出し【第N問】から最初の問題見出しまで（複数問に共通の設例）を画像化。なければ None。"""
    pages = _pages(pdf)
    head = _find_heading(pages, n)
    if not head:
        return None
    before = [b for b in _banners(pages) if (b[0], b[1]) < (head[0], head[1])]
    if not before:
        return None
    b = before[-1]
    # この大問の最初の問題見出し（見出しは問番号の昇順）
    first = n
    while first > 1:
        h = _find_heading(pages, first - 1)
        if not h or (h[0], h[1]) < (b[0], b[1]):
            break
        first -= 1
    h0 = _find_heading(pages, first)
    return _render(pdf, pages, f'{set_id.replace("_", "-")}-s{b[2]}', (b[0], b[1] - 2), (h0[0], h0[1]))


def extract(set_id: str) -> tuple[dict, list[str]]:
    cfg = SETS[set_id]
    qpdf, apdf = g.fetch(cfg['q']), g.fetch(cfg['a'])
    raw = g.pdftotext(qpdf)
    lines = [l for l in g.clean_lines(raw) if ('実技試験' not in l or '問' in l) and not l.strip().startswith('【第')]
    lbd = g.law_base_date(raw) or cfg['law']
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
        nums = [int(norm(m)) for m in re.findall(r'(?:^|\s)([０-９0-9]{1,2})[．.](?![０-９0-9])', text, flags=re.M)]
        nums = [k for k in nums if 1 <= k <= 20]
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
            shared = crop_shared(qpdf, set_id, n)
            if shared:
                materials.insert(0, {'kind': 'image', 'title': '共通の設例（原本PDFから切り出し）', 'src': shared,
                                     'alt': '複数の問題に共通する設例の画像', 'shared': True})
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
            'lawBaseDate': lbd, 'stem': stem, 'materials': materials, 'parts': parts,
            'requiresCalculation': numeric,
            **({'calcReason': '数値を計算して入力する解答欄がある'} if numeric else {}),
            'status': 'quarantined',
            'quarantineReason': ' / '.join(reasons) if reasons else '未レビュー（分野・計算判定・画像の目視確認待ち）',
        }
        if not materials:
            q.pop('materials')
        questions.append(q)
    return {'id': set_id, 'exam': 'j2', 'title': f'2級 実技 {cfg["label"]}', 'officialSet': True,
            'lawBaseDate': lbd, 'questions': questions}, []


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

#!/usr/bin/env python3
"""
日本FP協会が公開する学科試験PDF（公式過去問）から問題を抽出する。

- 依存: poppler-utils（pdftotext, pdfimages）、Python 3 標準ライブラリのみ
- 推測による補完は行わない。不明瞭な抽出結果は quarantine（隔離）として出力し、出題しない。
- 手作業のレビュー結果（計算問題の判定、テーマ、隔離解除、資料の構造化）は
  scripts/import/overrides/<set_id>.json に保存し、抽出結果に上書き適用する。

使い方:
  python3 -I scripts/import/extract_gakka.py            # 全セットを処理
  python3 -I scripts/import/extract_gakka.py g3_202605  # 指定セットのみ
出力:
  src/content/questions/<set_id>.json
  scripts/import/report/<set_id>.txt（抽出レポート）
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from themes import classify  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / 'scripts' / 'import' / '.cache'
OVERRIDES = ROOT / 'scripts' / 'import' / 'overrides'
REPORT = ROOT / 'scripts' / 'import' / 'report'
OUT = ROOT / 'src' / 'content' / 'questions'
IMG_OUT = ROOT / 'public' / 'content-img'
BASE_URL = 'https://www.jafp.or.jp/exam/mohan/files/'
CHECKED_AT = '2026-10-20'

# セット定義。kind: cbt=問題と正解が1つのPDF / paper=問題PDFと解答PDFが別
SETS = {
    'g3_202605': dict(exam='g3', kind='cbt', q='g3_202605_qa.pdf', label='2026年5月公表', ym='2026-05'),
    'g3_202505': dict(exam='g3', kind='cbt', q='g3_202505_qa.pdf', label='2025年5月公表', ym='2025-05'),
    'g3_202405': dict(exam='g3', kind='cbt', q='g3_202405_qa.pdf', label='2024年5月公表', ym='2024-05'),
    'g2_202605': dict(exam='g2', kind='cbt', q='g2_202605_qa.pdf', label='2026年5月公表', ym='2026-05'),
    'g2_202505': dict(exam='g2', kind='cbt', q='g2_202505_qa.pdf', label='2025年5月公表', ym='2025-05'),
    'g2_202501': dict(exam='g2', kind='paper', q='g2_202501_q.pdf', a='g2_202501_a.pdf', label='2025年1月実施', ym='2025-01'),
    'g2_202409': dict(exam='g2', kind='paper', q='g2_202409_q.pdf', a='g2_202409_a.pdf', label='2024年9月実施', ym='2024-09'),
    'g2_202405': dict(exam='g2', kind='paper', q='g2_202405_q.pdf', a='g2_202405_a.pdf', label='2024年5月実施', ym='2024-05'),
}

GRADE = {'g3': 3, 'g2': 2}
FIELDS = 'ABCDEF'

# 全角数字 → 半角（選択肢番号・問題番号の判定にのみ使用。本文は原文のまま）
Z2H = str.maketrans('０１２３４５６７８９', '0123456789')


def fetch(name: str) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    p = CACHE / name
    if not p.exists():
        urllib.request.urlretrieve(BASE_URL + name, p)
    return p


def pdftotext(path: Path, layout=True) -> str:
    args = ['pdftotext', '-enc', 'UTF-8']
    if layout:
        args.append('-layout')
    return subprocess.run(args + [str(path), '-'], check=True, capture_output=True, text=True).stdout


def field_of(exam: str, n: int) -> str:
    """公表問題の分野配列（3級：1-30と31-60で各5問ずつ、2級：10問ずつ）"""
    if exam == 'g3':
        return FIELDS[((n - 1) % 30) // 5]
    return FIELDS[(n - 1) // 10]


# ページ番号・フッター（例：「－9－  ２級 学科試験(2025.1.26)」）
PAGE_NO = re.compile(r'^\s*[－-]\s*[0-9０-９]+\s*終?\s*[－-]\s*(\S*級\s*学科試験\s*\([0-9.]+\))?\s*$')
# 数字と演算子だけの行：分数などの数式レイアウトが崩れている可能性
FORMULA_LINE = re.compile(r'^[\s０-９0-9.．,，＋+－\-×÷/（）()アイウエ１-４]*[＋+－×÷][\s０-９0-9.．,，＋+－\-×÷/]*$|^\s*[０-９0-9.．,，]+\s*$')


def clean_lines(text: str) -> list[str]:
    out = []
    for line in text.split('\n'):
        line = line.replace('\f', '')
        if PAGE_NO.match(line):
            continue
        out.append(line.rstrip())
    return out


def normalize_inline(s: str) -> str:
    """空白の正規化：空欄（　）の表記を統一し、連続空白を1つにする。"""
    s = re.sub(r'（\s*）', '（　　　）', s)
    s = re.sub(r'（\s*([①-⑩ア-ンＡ-Ｚ])\s*）', r'（ \1 ）', s)
    s = re.sub(r'[ 　]{2,}', ' ', s)
    # 日本語の文字同士の間に入ったレイアウト由来の空白を除去
    jp = r'[ぁ-んァ-ヶ一-龠々ー、。・]'
    s = re.sub(rf'(?<={jp}) (?={jp})', '', s)
    return s.strip()


def join_jp(lines: list[str]) -> str:
    """改行で分断された日本語文を連結する（英数字同士の間のみ空白を残す）。"""
    out = ''
    for raw in lines:
        t = raw.strip()
        if not t:
            continue
        if out and re.match(r'[A-Za-z0-9]$', out[-1]) and re.match(r'^[A-Za-z0-9]', t):
            out += ' '
        out += t
    return normalize_inline(out)


Q_HEAD_CBT = re.compile(r'^\s*問\s*([0-9０-９]{1,2})\s*$')
Q_HEAD_PAPER = re.compile(r'^\s*問題\s*([0-9０-９]{1,2})\s*$')
CHOICE_CBT = re.compile(r'^\s*([1-4])\)\s*(.*)$')
CHOICE_PAPER = re.compile(r'^\s*([１-４1-4])．\s*(.*)$')
ANSWER_CBT = re.compile(r'^\s*正解\s*([○〇×]|[1-4]\))\s*$')
TABLEISH = re.compile(r'\S {3,}\S.* {3,}\S')
SUSPICIOUS = re.compile(r'[�-\x00-\x08\x0b\x0c\x0e-\x1f]')
MATERIAL_WORDS = ('〈資料〉', '＜資料＞', '<資料>', '下図', '次の図', '下表', '次の表', 'グラフ', '下記', '〈親族関係図〉', '下記の図')


def split_blocks(lines: list[str], head: re.Pattern) -> dict[int, list[str]]:
    blocks: dict[int, list[str]] = {}
    cur = None
    for line in lines:
        m = head.match(line)
        if m:
            n = int(m.group(1).translate(Z2H))
            cur = n
            if n in blocks:
                blocks[n].append('__DUPLICATE_HEADER__')
            else:
                blocks[n] = []
            continue
        if cur is not None:
            blocks[cur].append(line)
    return blocks


def law_base_date(text: str) -> str | None:
    t = text.translate(Z2H).replace(' ', '').replace('　', '').replace('\n', '')
    m = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日現在施行の法令', t)
    if not m:
        return None
    return f'{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}'


def parse_paper_answers(path: Path) -> dict[int, str]:
    text = pdftotext(path).translate(Z2H)
    lines = [l for l in text.split('\n') if l.strip()]
    ans: dict[int, str] = {}
    for i, line in enumerate(lines):
        nums = re.findall(r'問\s*(\d+)', line)
        if nums and i + 1 < len(lines):
            vals = lines[i + 1].split()
            if len(vals) == len(nums) and all(re.fullmatch(r'[1-4]', v) for v in vals):
                for n, v in zip(nums, vals):
                    ans[int(n)] = v
    return ans


def extract(set_id: str) -> tuple[dict, list[str]]:
    cfg = SETS[set_id]
    exam = cfg['exam']
    qpdf = fetch(cfg['q'])
    raw = pdftotext(qpdf)
    lines = clean_lines(raw)
    report: list[str] = []
    lbd = law_base_date(raw)
    if not lbd:
        raise SystemExit(f'{set_id}: 法令基準日を検出できません')
    report.append(f'法令基準日: {lbd}')

    paper = cfg['kind'] == 'paper'
    blocks = split_blocks(lines, Q_HEAD_PAPER if paper else Q_HEAD_CBT)
    answers = parse_paper_answers(fetch(cfg['a'])) if paper else {}
    if paper and sorted(answers) != list(range(1, 61)):
        raise SystemExit(f'{set_id}: 解答PDFから60問分の正答を取得できません（{len(answers)}件）')

    image_pages = set()
    out = subprocess.run(['pdfimages', '-list', str(qpdf)], capture_output=True, text=True).stdout
    for row in out.split('\n')[2:]:
        if row.strip():
            image_pages.add(int(row.split()[0]))

    qurl = BASE_URL + cfg['q']
    aurl = BASE_URL + cfg['a'] if paper else None
    citation = (
        f'日本FP協会 {GRADE[exam]}級ファイナンシャル・プランニング技能検定学科試験 '
        f'{cfg["label"].replace("実施", "").replace("公表", "公表分")}'
    )
    questions = []
    expected = list(range(1, 61))
    if sorted(blocks) != expected:
        missing = sorted(set(expected) - set(blocks))
        extra = sorted(set(blocks) - set(expected))
        report.append(f'問題番号の不整合: 欠落={missing} 余分={extra}')

    for n in expected:
        reasons: list[str] = []
        body = blocks.get(n, [])
        if '__DUPLICATE_HEADER__' in body:
            reasons.append('問題番号の重複')
            body = [l for l in body if l != '__DUPLICATE_HEADER__']
        stem_lines: list[str] = []
        choices: list[tuple[str, list[str]]] = []
        answer_raw = None
        choice_re = CHOICE_PAPER if paper else CHOICE_CBT
        for line in body:
            m = ANSWER_CBT.match(line)
            if m:
                answer_raw = m.group(1)
                continue
            if line.strip() == '正解':
                continue
            c = choice_re.match(line)
            if c and (not choices or int(c.group(1).translate(Z2H)) == len(choices) + 1):
                choices.append((c.group(1).translate(Z2H), [c.group(2)]))
            elif choices:
                choices[-1][1].append(line)
            else:
                stem_lines.append(line)

        stem = join_jp(stem_lines)
        material_text = None
        if any(w in stem for w in MATERIAL_WORDS) or any(TABLEISH.search(l) for l in stem_lines):
            material_text = '\n'.join(l for l in stem_lines if l.strip())
            reasons.append('資料（表・図）を含むため、資料の構造化と目視確認が必要')
        if any(FORMULA_LINE.match(l) for l in body if l.strip() and not ANSWER_CBT.match(l) and l.strip() != '正解'):
            reasons.append('数式（分数など）のレイアウトを含むため目視確認が必要')
        if SUSPICIOUS.search(stem) or any(SUSPICIOUS.search(' '.join(c[1])) for c in choices):
            reasons.append('文字化けの疑い')

        is_tf = exam == 'g3' and n <= 30
        parts = []
        if is_tf:
            if choices:
                reasons.append('正誤式なのに選択肢が検出された')
            if answer_raw not in ('○', '〇', '×'):
                reasons.append(f'正誤の正答を検出できない: {answer_raw!r}')
                answer_bool = True
            else:
                answer_bool = answer_raw in ('○', '〇')
            parts.append({'kind': 'truefalse', 'id': 'p1', 'answer': answer_bool})
        else:
            need = 3 if exam == 'g3' else 4
            ch = [{'id': cid, 'text': join_jp(t)} for cid, t in choices]
            if len(ch) != need:
                reasons.append(f'選択肢数が{need}ではない（{len(ch)}）')
            if any(not c['text'] for c in ch):
                reasons.append('空の選択肢')
            if paper:
                ans = answers.get(n)
            else:
                ans = answer_raw.rstrip(')') if answer_raw and answer_raw.endswith(')') else None
            if not ans or not any(c['id'] == ans for c in ch):
                reasons.append(f'正答を選択肢と対応付けできない: {ans!r}')
                ans = ch[0]['id'] if ch else '1'
            if len(ch) < 2:
                ch = [{'id': '1', 'text': '（抽出失敗）'}, {'id': '2', 'text': '（抽出失敗）'}]
                ans = '1'
            parts.append({'kind': 'choice', 'id': 'p1', 'choices': ch, 'answer': ans})

        if not stem:
            reasons.append('問題文が空')
            stem = '（抽出失敗）'

        q = {
            'id': f'{set_id.replace("_", "-")}-{n:02d}',
            'exam': exam,
            'field': field_of(exam, n),
            'theme': classify(field_of(exam, n), stem, stem + ' ' + ' '.join(join_jp(c[1]) for c in choices)),
            'source': {
                'kind': 'official',
                'citation': citation,
                'yearMonth': cfg['ym'],
                'number': n,
                'url': qurl,
                **({'answerUrl': aurl} if aurl else {}),
                'modified': False,
            },
            'lawBaseDate': lbd,
            'stem': stem,
            'parts': parts,
            'requiresCalculation': False,
            'status': 'quarantined' if reasons else 'verified',
        }
        if material_text:
            q['materials'] = [{'kind': 'text', 'title': '資料（抽出テキスト・未構造化）', 'body': material_text}]
        if reasons:
            q['quarantineReason'] = ' / '.join(reasons)
        questions.append(q)
        if reasons:
            report.append(f'問{n}: 隔離 - {q["quarantineReason"]}')

    title = f'{GRADE[exam]}級 学科 {cfg["label"]}'
    data = {
        'id': set_id,
        'exam': exam,
        'title': title,
        'officialSet': True,
        'lawBaseDate': lbd,
        'questions': questions,
    }
    return data, report


WORD_RE = re.compile(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>')
PAGE_RE = re.compile(r'<page width="([\d.]+)" height="([\d.]+)">')


def crop_question_image(pdf: Path, qid: str, n: int, paper: bool) -> str:
    """問題見出しの直後から最初の選択肢の直前までを原本PDFから画像として切り出す。"""
    html = subprocess.run(['pdftotext', '-bbox-layout', str(pdf), '-'], check=True, capture_output=True, text=True).stdout
    words = []  # (page, y0, y1, x0, text)
    pages = []
    for pi, chunk in enumerate(html.split('<page ')[1:], start=1):
        m = PAGE_RE.match('<page ' + chunk)
        pages.append((float(m.group(1)), float(m.group(2))))
        for w in WORD_RE.finditer(chunk):
            words.append((pi, float(w.group(2)), float(w.group(4)), float(w.group(1)), w.group(5)))
    words.sort(key=lambda w: (w[0], w[1], w[3]))
    zn = str(n).translate(str.maketrans('0123456789', '０１２３４５６７８９'))
    start = None
    for i, w in enumerate(words):
        t = w[4]
        if (not paper and t in (f'問{n}', f'問{zn}')) or (paper and t == '問題' and i + 1 < len(words) and words[i + 1][4] in (zn, str(n))):
            start = i
            break
    if start is None:
        raise SystemExit(f'{qid}: 見出しが見つかりません')
    head = words[start]
    choice_pat = re.compile(r'^(1\)|１．)')
    end = next((w for w in words[start + 2:] if choice_pat.match(w[4])), None)
    if end is None or end[0] != head[0]:
        raise SystemExit(f'{qid}: 選択肢が同じページにないため自動切り出しできません')
    pw, ph = pages[head[0] - 1]
    dpi = 144
    sc = dpi / 72
    y0 = head[2] + 2
    y1 = end[1] - 3
    x0 = 50
    x1 = pw - 50
    IMG_OUT.mkdir(parents=True, exist_ok=True)
    out = IMG_OUT / qid
    subprocess.run(['pdftoppm', '-r', str(dpi), '-png', '-singlefile', '-f', str(head[0]), '-l', str(head[0]),
                    '-x', str(int(x0 * sc)), '-y', str(int(y0 * sc)), '-W', str(int((x1 - x0) * sc)), '-H', str(int((y1 - y0) * sc)),
                    str(pdf), str(out)], check=True)
    try:  # 16階調に減色して容量を約1/4に（Pillow がない環境ではそのまま）
        from PIL import Image
        png = out.with_suffix('.png')
        Image.open(png).convert('L').quantize(colors=16).save(png, optimize=True)
    except ImportError:
        pass
    return f'content-img/{qid}.png'


def apply_overrides(set_id: str, data: dict, report: list[str]) -> None:
    p = OVERRIDES / f'{set_id}.json'
    if not p.exists():
        report.append('overrides: なし（未レビュー）')
        return
    ov = json.loads(p.read_text(encoding='utf-8'))
    by_num = {q['source']['number']: q for q in data['questions']}
    for key, patch in ov.get('questions', {}).items():
        q = by_num[int(key)]
        expect_stem = patch.pop('_expectStemStartsWith', None)
        if expect_stem and not q['stem'].startswith(expect_stem):
            raise SystemExit(f'{set_id} 問{key}: override の対象問題が一致しません')
        release = patch.pop('_release', None)
        cut = patch.pop('_stemCutAt', None)
        cut = normalize_inline(cut) if cut else cut
        if cut:
            if cut not in q['stem']:
                raise SystemExit(f'{set_id} 問{key}: _stemCutAt が問題文に見つかりません')
            q['stem'] = q['stem'][: q['stem'].rindex(cut)].rstrip()
        rm = patch.pop('_stemRemoveBetween', None)
        if rm:
            a, b = (normalize_inline(x) for x in rm)
            i = q['stem'].rindex(a)
            j = q['stem'].index(b, i)
            q['stem'] = q['stem'][:i].rstrip() + q['stem'][j:]
        if patch.pop('_dropMaterials', None):
            q.pop('materials', None)
        img = patch.pop('_materialImage', None)
        if img:
            cfg = SETS[set_id]
            src = crop_question_image(fetch(cfg['q']), q['id'], int(key), cfg['kind'] == 'paper')
            # 画像は問題見出しの直後から選択肢の直前まで（問題文を含む）
            q['materials'] = [{'kind': 'image', 'title': '問題（原本PDFから切り出し）', 'src': src, 'alt': img, 'includesStem': True}]
        force_q = patch.pop('_quarantine', None)
        if force_q:
            q['status'] = 'quarantined'
            q['quarantineReason'] = force_q
        for k, v in patch.items():
            q[k] = v
        if release:
            # 隔離解除は理由（何を目視確認したか）を必須とする
            q['status'] = 'verified'
            q.pop('quarantineReason', None)
            q.setdefault('tags', []).append('資料目視確認済み')
    report.append(f'overrides: {len(ov.get("questions", {}))}件適用')


def main(argv: list[str]) -> None:
    targets = argv or list(SETS)
    OUT.mkdir(parents=True, exist_ok=True)
    REPORT.mkdir(parents=True, exist_ok=True)
    for set_id in targets:
        data, report = extract(set_id)
        apply_overrides(set_id, data, report)
        n_ok = sum(q['status'] == 'verified' for q in data['questions'])
        report.insert(0, f'{set_id}: 検証済み {n_ok} / {len(data["questions"])}')
        (OUT / f'{set_id}.json').write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        (REPORT / f'{set_id}.txt').write_text('\n'.join(report) + '\n', encoding='utf-8')
        print(report[0])


if __name__ == '__main__':
    main(sys.argv[1:])

#!/usr/bin/env python3
"""
日本FP協会 実技試験（資産設計提案業務）の公式PDFから問題を抽出する。

実技は資料（表・図・設例）が問題の中心のため、問題ごとに「問題見出しの直後〜最初の選択肢の直前」を
原本PDFから画像として切り出し、選択肢と公式正答（模範解答PDF）をテキストで対応付ける。
- 選択肢が同じページにない、選択肢数が想定と違う、正答を対応付けできない → 隔離（出題しない）
- 分野・計算問題の判定は overrides/<set_id>.json のレビュー結果で確定する（未レビューの問題は隔離）

使い方: python3 -I scripts/import/extract_jitsugi.py [set_id ...]
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import extract_gakka as g  # noqa: E402
from themes import RULES, classify  # noqa: E402

SETS = {
    'j3_202605': dict(exam='j3', q='j3_202605_q.pdf', a='j3_202605_a.pdf', label='2026年公表分', ym='2026-05', n=20, choices=3, law='2025-04-01'),
    'j3_202505': dict(exam='j3', q='j3_202505_q.pdf', a='j3_202505_a.pdf', label='2025年公表分', ym='2025-05', n=20, choices=3, law='2024-04-01'),
    'j3_202405': dict(exam='j3', q='j3_202405_q.pdf', a='j3_202405_a.pdf', label='2024年公表分', ym='2024-05', n=20, choices=3, law='2023-04-01'),
}

FOOTER = re.compile(r'^\s*[－-]\s*[0-9０-９]+\s*終?\s*[－-]\s*.*実技試験.*$')
HEAD = re.compile(r'^\s*問\s*([0-9０-９]{1,2})\s*$')


def guess_field(text: str) -> str:
    """分野の推定（レビューで確定する）。各分野のルールに一致した数が最も多い分野。"""
    best, score = 'A', -1
    for f, rules in RULES.items():
        s = sum(1 for _, pat in rules if re.search(pat, text))
        if s > score:
            best, score = f, s
    return best


def extract(set_id: str) -> tuple[dict, list[str]]:
    cfg = SETS[set_id]
    qpdf = g.fetch(cfg['q'])
    apdf = g.fetch(cfg['a'])
    raw = g.pdftotext(qpdf)
    lines = [l for l in g.clean_lines(raw) if not FOOTER.match(l)]
    report: list[str] = []
    # 実技の公表PDFには法令基準日の記載がないため、同じ年度に公表された学科問題（同年度のCBT試験）の
    # 法令基準日を用いる（例：2026年公表分＝2025年度試験＝2025年4月1日基準）
    lbd = g.law_base_date(raw) or cfg['law']
    answers = g.parse_paper_answers(apdf)
    if sorted(answers) != list(range(1, cfg['n'] + 1)):
        raise SystemExit(f'{set_id}: 正答を{cfg["n"]}問分取得できません（{len(answers)}件）')
    blocks = g.split_blocks(lines, HEAD)
    grade = 3 if cfg['exam'] == 'j3' else 2
    citation = f'日本FP協会 {grade}級ファイナンシャル・プランニング技能検定実技試験（資産設計提案業務） {cfg["label"]}'
    questions = []
    for n in range(1, cfg['n'] + 1):
        reasons: list[str] = []
        body = blocks.get(n, [])
        stem_lines: list[str] = []
        choices: list[tuple[str, list[str]]] = []
        for line in body:
            c = g.CHOICE_PAPER.match(line)
            if c and int(c.group(1).translate(g.Z2H)) == len(choices) + 1:
                choices.append((c.group(1).translate(g.Z2H), [c.group(2)]))
            elif choices:
                choices[-1][1].append(line)
            else:
                stem_lines.append(line)
        # 問題文は最初の段落（空行まで）。資料は画像で示す
        first: list[str] = []
        for l in stem_lines:
            if not l.strip():
                if first:
                    break
                continue
            first.append(l)
        stem = g.join_jp(first) or '（抽出失敗）'
        ch = [{'id': cid, 'text': g.join_jp(t)} for cid, t in choices]
        if len(ch) != cfg['choices']:
            reasons.append(f'選択肢数が{cfg["choices"]}ではない（{len(ch)}）')
        if any(not c['text'] for c in ch):
            reasons.append('空の選択肢')
        ans = answers.get(n)
        if not any(c['id'] == ans for c in ch):
            reasons.append(f'正答を選択肢と対応付けできない: {ans!r}')
        qid = f'{set_id.replace("_", "-")}-{n:02d}'
        materials = []
        try:
            src = g.crop_question_image(qpdf, qid, n, paper=False)
            materials = [{'kind': 'image', 'title': '問題・資料（原本PDFから切り出し）', 'src': src,
                          'alt': f'{stem}（問題文と資料の画像）', 'includesStem': True}]
        except SystemExit as e:
            reasons.append(f'資料画像を切り出せない（{e}）')
        if len(ch) < 2:
            ch = [{'id': '1', 'text': '（抽出失敗）'}, {'id': '2', 'text': '（抽出失敗）'}]
        if not any(c['id'] == ans for c in ch):
            ans = ch[0]['id']
        full = stem + ' ' + ' '.join(c['text'] for c in ch)
        field = guess_field(full)
        q = {
            'id': qid,
            'exam': cfg['exam'],
            'field': field,
            'theme': classify(field, stem, full),
            'source': {'kind': 'official', 'citation': citation, 'yearMonth': cfg['ym'], 'number': n,
                       'url': g.BASE_URL + cfg['q'], 'answerUrl': g.BASE_URL + cfg['a'], 'modified': False},
            'lawBaseDate': lbd,
            'stem': stem,
            'materials': materials,
            'parts': [{'kind': 'choice', 'id': 'p1', 'choices': ch, 'answer': ans}],
            'requiresCalculation': False,
            'status': 'quarantined',
            'quarantineReason': ' / '.join(reasons) if reasons else '未レビュー（分野・計算判定・画像の目視確認待ち）',
        }
        if not materials:
            q.pop('materials')
        questions.append(q)
    data = {'id': set_id, 'exam': cfg['exam'], 'title': f'{grade}級 実技 {cfg["label"]}', 'officialSet': True,
            'lawBaseDate': lbd, 'questions': questions}
    return data, report


def apply_review(set_id: str, data: dict, report: list[str]) -> None:
    """レビュー結果：{"questions": {"1": {"field": "A", "theme": "...", "requiresCalculation": bool, "calcReason": "...", "_reviewed": true}}}"""
    p = g.OVERRIDES / f'{set_id}.json'
    if not p.exists():
        report.append('overrides: なし（全問未レビュー＝隔離）')
        return
    ov = json.loads(p.read_text(encoding='utf-8'))
    by_num = {q['source']['number']: q for q in data['questions']}
    for key, patch in ov.get('questions', {}).items():
        q = by_num[int(key)]
        reviewed = patch.pop('_reviewed', False)
        for k, v in patch.items():
            q[k] = v
        if 'field' in patch and 'theme' not in patch:
            full = q['stem'] + ' ' + ' '.join(c['text'] for c in q['parts'][0].get('choices', []))
            q['theme'] = classify(q['field'], q['stem'], full)
        # 構造上の問題がなく、目視レビュー済みのものだけ検証済みにする
        if reviewed and q['quarantineReason'].startswith('未レビュー'):
            q['status'] = 'verified'
            q.pop('quarantineReason')
    report.append(f'overrides: {len(ov.get("questions", {}))}件適用')


def main(argv: list[str]) -> None:
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
        print('\n'.join(report[:1] + [r for r in report[1:] if not r.startswith('問') or '未レビュー' not in r]))


if __name__ == '__main__':
    main(sys.argv[1:])

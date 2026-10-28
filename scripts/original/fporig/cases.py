"""四答択一以外の形式のオリジナル問題（ケース）の作成フレームワーク。

- 実技（資産設計提案業務）形式：設例（text/table の資料）＋ 3〜5 の小問（numeric / choice / truefalse）。exam='j2'
- 学科の非四択：○×（truefalse 1小問）、語群からの空欄補充（choice 複数小問）、組合せ・三択（choice 1小問）。exam='g2'
- core.py（四択）とは独立。出力は QuestionSchema に適合する問題JSONと、既存の解説システム互換の解説。
- 数値の正答は「バッチ内のPythonコードで計算した値」を渡す（手入力しない）。計算過程は steps に残す。
- 数値以外（法令の要件・割合・期間など）の記述は、すべて公式ページの引用（ev）で裏づける。
  式そのものが数学的な定義で法令に書かれていない計算（利回り・係数など）だけ math=True で引用を省略できる
  （ただしケース全体では引用を1つ以上持つこと）。
"""
from __future__ import annotations

import math
import random
import re
from dataclasses import dataclass, field

from .core import BASE_DATE, CHECKED, TOPICS, ev, source


@dataclass
class PartSpec:
    kind: str  # numeric | choice | truefalse
    prompt: str
    note: str
    ev: list[tuple[str, str]]
    math: bool = False
    # numeric
    value: float | None = None
    unit: str = ''
    decimals: int = 0
    steps: list[str] = field(default_factory=list)
    # choice
    options: list[str] = field(default_factory=list)
    answer_text: str = ''
    shuffle: bool = True
    option_notes: dict[str, str] = field(default_factory=dict)
    # truefalse
    truth: bool | None = None


def NUM(prompt: str, value: float, unit: str, note: str, steps: list[str], ev: list[tuple[str, str]] | tuple = (),
        decimals: int = 0, math: bool = False) -> PartSpec:
    """数値入力の小問。value はバッチ内で計算した値。decimals は正答の小数桁数（問題文で端数処理を指示すること）。"""
    return PartSpec('numeric', prompt, note, list(ev), math=math, value=value, unit=unit, decimals=decimals, steps=list(steps))


def SEL(prompt: str, options: list[str], answer: str, note: str, ev: list[tuple[str, str]] | tuple = (), shuffle: bool = True,
        option_notes: dict[str, str] | None = None, math: bool = False) -> PartSpec:
    """選択式の小問（語群・組合せ・三択など）。answer は options のうち正解の文字列。
    shuffle=False で並びを固定（語群を複数の空欄で共通にするときなど）。option_notes は各選択肢の判定理由（単独小問の問題では必須）。"""
    return PartSpec('choice', prompt, note, list(ev), math=math, options=list(options), answer_text=answer, shuffle=shuffle,
                    option_notes=dict(option_notes or {}))


def TF(prompt: str, truth: bool, note: str, ev: list[tuple[str, str]] | tuple = (), math: bool = False) -> PartSpec:
    """○×（適切／不適切）の小問。"""
    return PartSpec('truefalse', prompt, note, list(ev), math=math, truth=truth)


@dataclass
class Case:
    id: str
    exam: str  # 'j2' | 'g2'
    topic: str
    theme: str
    level: int
    stem: str
    materials: list[dict]
    parts: list[PartSpec]
    summary: str
    background: str = ''
    compare: str = ''
    memo: str = ''
    calc: bool = False
    calc_reason: str = ''
    base: str = BASE_DATE
    field_: str = ''
    tags: list[str] = field(default_factory=list)


def Case_(id: str, exam: str, topic: str, theme: str, level: int, stem: str, parts: list[PartSpec], summary: str,
          materials: list[dict] | None = None, background: str = '', compare: str = '', memo: str = '',
          calc: bool | None = None, calc_reason: str = '', base: str = BASE_DATE, tags: tuple = ()) -> Case:
    has_num = any(p.kind == 'numeric' for p in parts)
    if calc is None:
        calc = has_num
    c = Case(id, exam, topic, theme, level, stem, list(materials or []), parts, summary, background, compare, memo, calc, calc_reason,
             base, topic[0], list(tags))
    validate_case(c)
    return c


def T(title: str, rows: list[list[str]]) -> dict:
    """表の資料。先頭行は見出し行として扱う。"""
    return {'kind': 'table', 'title': title, 'rows': rows}


def X(title: str, body: str) -> dict:
    """文章の資料（設例）。"""
    return {'kind': 'text', 'title': title, 'body': body}


def validate_case(c: Case) -> None:
    def bad(msg: str) -> None:
        raise ValueError(f'{c.id}: {msg}')

    if c.exam not in ('j2', 'g2'):
        bad('examは j2 か g2')
    pref = 'j2o' if c.exam == 'j2' else 'g2n'
    if not re.match(rf'^{pref}-[a-z0-9]+-\d{{2}}$', c.id):
        bad(f'IDは {pref}-<バッチ>-<2桁番号> 形式')
    if c.topic not in TOPICS:
        bad(f'未知の論点キー {c.topic}')
    if c.level not in (1, 2, 3, 4, 5):
        bad('levelは1〜5')
    if c.exam == 'j2' and not 3 <= len(c.parts) <= 5:
        bad('実技ケースの小問は3〜5')
    if c.exam == 'g2' and not 1 <= len(c.parts) <= 5:
        bad('学科ケースの小問は1〜5')
    if c.exam == 'j2' and not c.materials:
        bad('実技ケースには設例（materials）が必要')
    if len(c.stem) < 15:
        bad('問題文が短い')
    if c.calc and not c.calc_reason:
        bad('calc=True には calc_reason が必要')
    if any(p.kind == 'numeric' for p in c.parts) and not c.calc:
        bad('数値小問があるのに calc=False（ルールB：計算を要する問題は requiresCalculation=true）')
    for m in c.materials:
        if m['kind'] == 'table':
            w = {len(r) for r in m['rows']}
            if len(w) != 1:
                bad('表の列数が行ごとに違う')
    n_ev = 0
    prompts = set()
    for i, p in enumerate(c.parts, 1):
        tag = f'小問{i}'
        if not p.prompt or p.prompt in prompts:
            bad(f'{tag}: promptが空か重複')
        prompts.add(p.prompt)
        if len(p.note) < 20:
            bad(f'{tag}: 解説が短い')
        if not p.ev and not p.math:
            bad(f'{tag}: 根拠の引用がない（数学的定義だけの計算なら math=True）')
        for k, qt in p.ev:
            source(k)
            if len(qt) < 8:
                bad(f'{tag}: 引用が短すぎる')
            n_ev += 1
        if p.kind == 'numeric':
            if p.value is None or not math.isfinite(p.value):
                bad(f'{tag}: 数値が不正')
            if abs(round(p.value, p.decimals) - p.value) > 1e-9:
                bad(f'{tag}: 正答 {p.value} が decimals={p.decimals} に丸まっていない（端数処理を問題文で指示し、コード側で丸める）')
            if not p.steps:
                bad(f'{tag}: 計算過程（steps）がない')
        elif p.kind == 'choice':
            if len(p.options) < 3 or len(set(p.options)) != len(p.options):
                bad(f'{tag}: 選択肢は3つ以上・重複なし')
            if p.options.count(p.answer_text) != 1:
                bad(f'{tag}: 正答が選択肢にちょうど1つ含まれていない')
            if len(c.parts) == 1:
                miss = [o for o in p.options if len(p.option_notes.get(o, '')) < 15]
                if miss:
                    bad(f'{tag}: 単独小問の選択式は全選択肢の判定理由（option_notes）が必要: {miss[0][:20]}')
            for o in p.options:
                if re.search(r'[1-9１-９]\)|選択肢[1-9]', o):
                    bad(f'{tag}: 選択肢文に他の選択肢番号への言及')
        elif p.kind == 'truefalse':
            if p.truth is None:
                bad(f'{tag}: truth未設定')
        else:
            bad(f'{tag}: 未知のkind')
    if n_ev == 0:
        bad('ケース全体に引用が1つもない')
    if len(c.summary) < 15:
        bad('解答の要点が短い')
    if c.exam == 'g2' and len(c.parts) == 1 and c.parts[0].kind == 'truefalse':
        if not re.search(r'適切|正しい', c.stem) and not re.search(r'適切|正しい', c.parts[0].prompt):
            bad('○×問題は「適切／不適切」を答える旨を問題文か小問に書く')


def _fmt_num(v: float, decimals: int) -> str:
    return f'{v:,.{decimals}f}' if decimals else f'{int(round(v)):,}'


@dataclass
class _Placed:
    spec: PartSpec
    pid: str
    options: list[tuple[str, str]]  # (id, text)
    answer_id: str | None


@dataclass
class CaseBatch:
    id: str
    title: str
    exam: str
    questions: list[Case]

    # --- core.Batch と同じ呼び出し口 ---
    @property
    def set_id(self) -> str:
        return f"{'j2o' if self.exam == 'j2' else 'g2n'}_{self.id}"

    def __post_init__(self) -> None:
        ids = [q.id for q in self.questions]
        if len(set(ids)) != len(ids):
            raise ValueError(f'{self.id}: ID重複')
        pref = 'j2o' if self.exam == 'j2' else 'g2n'
        for q in self.questions:
            if q.exam != self.exam:
                raise ValueError(f'{q.id}: バッチのexam {self.exam} と不一致')
            if not q.id.startswith(f'{pref}-{self.id}-'):
                raise ValueError(f'{q.id}: バッチID {self.id} と不一致')

    def _place(self, c: Case) -> list[_Placed]:
        out = []
        for i, p in enumerate(c.parts, 1):
            pid = f'p{i}'
            if p.kind != 'choice':
                out.append(_Placed(p, pid, [], None))
                continue
            opts = list(p.options)
            if p.shuffle:
                random.Random(f'case:{c.id}:{pid}').shuffle(opts)
            lst = [(str(j + 1), t) for j, t in enumerate(opts)]
            ans = next(i_ for i_, t in lst if t == p.answer_text)
            out.append(_Placed(p, pid, lst, ans))
        return out

    def evidence_items(self):
        """(問題ID, 出典キー, 引用) — check_batch 用"""
        for c in self.questions:
            for p in c.parts:
                for k, qt in p.ev:
                    yield c.id, k, qt

    def question_set(self) -> dict:
        qs = []
        for c in self.questions:
            urls = {}
            for p in c.parts:
                for k, _ in p.ev:
                    s = source(k)
                    urls[s['url']] = s
            parts = []
            for pl in self._place(c):
                sp = pl.spec
                if sp.kind == 'numeric':
                    d = {'kind': 'numeric', 'id': pl.pid, 'prompt': sp.prompt, 'answer': sp.value if sp.decimals else int(round(sp.value))}
                    if sp.unit:
                        d['unit'] = sp.unit
                elif sp.kind == 'truefalse':
                    d = {'kind': 'truefalse', 'id': pl.pid, 'prompt': sp.prompt, 'answer': bool(sp.truth)}
                else:
                    d = {'kind': 'choice', 'id': pl.pid, 'prompt': sp.prompt,
                         'choices': [{'id': i, 'text': t} for i, t in pl.options], 'answer': pl.answer_id}
                parts.append(d)
            q = {
                'id': c.id, 'exam': c.exam, 'field': c.field_, 'theme': c.theme,
                'source': {'kind': 'original', 'author': 'FP Master（日本FP協会の試験範囲に基づくオリジナル問題）',
                           'basis': [{'title': s['title'], 'url': s['url']} for s in urls.values()]},
                'lawBaseDate': c.base, 'stem': c.stem,
                **({'materials': c.materials} if c.materials else {}),
                'parts': parts, 'requiresCalculation': c.calc, 'status': 'verified', 'level': c.level, 'topic': c.topic,
                **({'calcReason': c.calc_reason} if c.calc else {}),
                'tags': (['実技形式'] if c.exam == 'j2' else ['四択以外']) + c.tags,
            }
            qs.append(q)
        return {'id': self.set_id, 'exam': self.exam, 'title': self.title, 'officialSet': False,
                'lawBaseDate': BASE_DATE, 'questions': qs}

    def explanations(self) -> list[dict]:
        out = []
        for c in self.questions:
            placed = self._place(c)
            labels, lines = [], []
            for pl in placed:
                sp = pl.spec
                if sp.kind == 'numeric':
                    ans = f'{_fmt_num(sp.value, sp.decimals)}{sp.unit}'
                    body = f'{sp.note}\n計算：' + ' → '.join(sp.steps)
                elif sp.kind == 'truefalse':
                    ans = '適切（〇）' if sp.truth else '不適切（×）'
                    body = sp.note
                else:
                    ans = f'正解は{pl.answer_id})'
                    body = sp.note
                one = len(placed) == 1
                labels.append(ans if one else f'小問{pl.pid[1:]}：{ans}')
                lines.append(body if one else f'【小問{pl.pid[1:]}】{ans}　{body}')
            seen = set()
            evs, srcs = [], {}
            for p in c.parts:
                for k, qt in p.ev:
                    s = source(k)
                    if (s['url'], qt) not in seen:
                        seen.add((s['url'], qt))
                        evs.append(ev(s['url'], qt))
                    srcs[s['url']] = s
            e = {
                'status': 'draft', 'short': '　'.join(labels) + f'。{c.summary}',
                'standard': '\n'.join(lines),
                'sources': list(srcs.values()), 'evidence': evs, 'lawBaseDate': c.base, 'checkedAt': CHECKED,
            }
            if len(placed) == 1:
                pl = placed[0]
                if pl.spec.kind == 'choice':
                    e['choiceExplanations'] = {i: f"{'適切' if t == pl.spec.answer_text else '不適切'}。{pl.spec.option_notes[t]}" for i, t in pl.options}
                e['whyCorrect'] = pl.spec.note
            detail = '\n'.join(x for x in [c.background, f'【類似制度との違い】{c.compare}' if c.compare else ''] if x)
            if detail:
                e['detail'] = detail
            if c.memo:
                e['mnemonic'] = c.memo
            out.append({'id': c.id, 'terms': [], 'explanation': e})
        return out

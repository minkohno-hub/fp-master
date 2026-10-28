from __future__ import annotations

import json
import random
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

HERE = Path(__file__).resolve().parent
ORIG = HERE.parent
CONTENT = ORIG.parent / 'content'
sys.path.insert(0, str(CONTENT))
from glossary_src import S as _S, ev  # noqa: E402
from evidence_more import S_MORE  # noqa: E402

SYLLABUS = json.loads((ORIG / 'syllabus_fp2.json').read_text(encoding='utf-8'))
TOPICS = {i['key']: i for i in SYLLABUS['items']}
BASE_DATE = '2026-04-01'
CHECKED = '2026-10-27'


EXTRA_SOURCES: dict[str, dict] = {}


def register_sources(d: dict[str, dict]) -> None:
    """バッチ専用の出典を登録する。キーは重複不可（他バッチと衝突しないよう接頭辞を付ける）。"""
    for k, v in d.items():
        if k in EXTRA_SOURCES and EXTRA_SOURCES[k] != v:
            raise ValueError(f'出典キー重複: {k}')
        if not v['url'].startswith('https://'):
            raise ValueError(f'出典URLはhttpsのみ: {k}')
        EXTRA_SOURCES[k] = {'title': v['title'], 'url': v['url']}


def law_source(law_id: str, name: str) -> str:
    """e-Gov法令検索の法令を出典として登録し、キーを返す。"""
    key = f'egov_{law_id}'
    register_sources({key: {'title': f'e-Gov法令検索 {name}', 'url': f'https://laws.e-gov.go.jp/law/{law_id}'}})
    return key


def source(key: str) -> dict:
    s = EXTRA_SOURCES.get(key) or S_MORE.get(key) or _S.get(key)
    if not s:
        raise KeyError(f'未登録の出典キー: {key}')
    return s


@dataclass
class Choice:
    text: str
    truth: bool
    note: str
    ev: list[tuple[str, str]]


def C(text: str, truth: bool, note: str, ev: list[tuple[str, str]] | tuple = ()) -> Choice:
    return Choice(text, truth, note, list(ev))


@dataclass
class Question:
    id: str
    topic: str
    theme: str
    level: int
    stem: str
    ask: str  # 'right'（適切なものを選ぶ）／'wrong'（不適切なものを選ぶ）
    choices: list[Choice]
    summary: str
    background: str = ''
    compare: str = ''
    memo: str = ''
    terms: list[str] = field(default_factory=list)
    calc: bool = False
    calc_reason: str = ''
    base: str = BASE_DATE
    field_: str = ''


def Q(id: str, topic: str, theme: str, level: int, stem: str, ask: str, choices: list[Choice], summary: str, background: str = '',
      compare: str = '', memo: str = '', terms=(), calc: bool = False, calc_reason: str = '', base: str = BASE_DATE) -> Question:
    q = Question(id, topic, theme, level, stem, ask, choices, summary, background, compare, memo, list(terms), calc, calc_reason, base,
                 topic[0])
    validate(q)
    return q


def validate(q: Question) -> None:
    def bad(msg: str) -> None:
        raise ValueError(f'{q.id}: {msg}')

    if not re.match(r'^g2o-[a-z0-9]+-\d{2,3}$', q.id):
        bad('IDは g2o-<バッチ>-<番号> 形式')
    if q.topic not in TOPICS:
        bad(f'未知の論点キー {q.topic}')
    if q.level not in (1, 2, 3, 4, 5):
        bad('levelは1〜5')
    if q.ask not in ('right', 'wrong'):
        bad("askは 'right' か 'wrong'")
    if len(q.choices) != 4:
        bad('選択肢は4つ')
    want = q.ask == 'right'
    if sum(1 for c in q.choices if c.truth == want) != 1:
        bad('正答（askに合致する選択肢）がちょうど1つになっていない')
    if len({c.text for c in q.choices}) != 4:
        bad('選択肢の重複')
    if not q.stem.endswith('か。'):
        bad('問題文は「か。」で終える')
    if q.ask == 'right' and '適切' not in q.stem and '正しい' not in q.stem:
        bad('askがrightなのに問題文に「適切」「正しい」がない')
    if q.ask == 'wrong' and '不適切' not in q.stem and '誤っている' not in q.stem:
        bad('askがwrongなのに問題文に「不適切」「誤っている」がない')
    for c in q.choices:
        if not c.note or len(c.note) < 20:
            bad(f'選択肢解説が短すぎる: {c.text[:20]}')
        if not c.ev:
            bad(f'選択肢に根拠の引用がない: {c.text[:20]}')
        if re.search(r'[1-4１-４]\)|選択肢[1-4]|肢[1-4]', c.text):
            bad('選択肢文に他の選択肢番号への言及がある')
        for k, qt in c.ev:
            source(k)
            if len(qt) < 8:
                bad('引用が短すぎる')
    if len(q.summary) < 15:
        bad('解答の要点が短い')


def _pos_schedule(batch_id: str, n: int) -> list[int]:
    """正答位置（1〜4）を、4問ごとのブロックで均等に割り当てる（バッチIDから決定的）。"""
    rng = random.Random('pos:' + batch_id)
    out: list[int] = []
    while len(out) < n:
        blk = [1, 2, 3, 4]
        rng.shuffle(blk)
        out.extend(blk)
    return out[:n]


@dataclass
class Batch:
    id: str
    title: str
    questions: list[Question]

    def __post_init__(self) -> None:
        ids = [q.id for q in self.questions]
        if len(set(ids)) != len(ids):
            raise ValueError(f'{self.id}: ID重複')
        for q in self.questions:
            if not q.id.startswith(f'g2o-{self.id}-'):
                raise ValueError(f'{q.id}: バッチID {self.id} と不一致')

    @property
    def set_id(self) -> str:
        return f'g2o_{self.id}'

    def evidence_items(self):
        for q in self.questions:
            for c in q.choices:
                for k, qt in c.ev:
                    yield q.id, k, qt

    def placed(self) -> list[tuple[Question, list[Choice], int]]:
        """(問題, 並べ替え後の選択肢, 正答番号)"""
        sched = _pos_schedule(self.id, len(self.questions))
        out = []
        for q, pos in zip(self.questions, sched):
            want = q.ask == 'right'
            ans = next(c for c in q.choices if c.truth == want)
            others = [c for c in q.choices if c is not ans]
            rng = random.Random('ord:' + q.id)
            rng.shuffle(others)
            ordered = others[: pos - 1] + [ans] + others[pos - 1:]
            out.append((q, ordered, pos))
        return out

    def question_set(self) -> dict:
        qs = []
        for q, ch, pos in self.placed():
            urls = {}
            for c in q.choices:
                for k, _ in c.ev:
                    s = source(k)
                    urls[s['url']] = s
            qs.append({
                'id': q.id, 'exam': 'g2', 'field': q.field_, 'theme': q.theme,
                'source': {'kind': 'original', 'author': 'FP Master（日本FP協会の試験範囲に基づくオリジナル問題）',
                          'basis': [{'title': s['title'], 'url': s['url']} for s in urls.values()]},
                'lawBaseDate': q.base, 'stem': q.stem,
                'parts': [{'kind': 'choice', 'id': 'p1', 'choices': [{'id': str(i + 1), 'text': c.text} for i, c in enumerate(ch)],
                           'answer': str(pos)}],
                'requiresCalculation': q.calc, 'status': 'verified', 'level': q.level, 'topic': q.topic,
                **({'calcReason': q.calc_reason} if q.calc else {}),
            })
        return {'id': f'g2o_{self.id}', 'exam': 'g2', 'title': self.title, 'officialSet': False,
                'lawBaseDate': BASE_DATE, 'questions': qs}

    def explanations(self) -> list[dict]:
        out = []
        for q, ch, pos in self.placed():
            notes = {str(i + 1): f"{'適切' if c.truth else '不適切'}。{c.note}" for i, c in enumerate(ch)}
            seen = set()
            evs, srcs = [], {}
            for c in q.choices:
                for k, qt in c.ev:
                    s = source(k)
                    if (s['url'], qt) not in seen:
                        seen.add((s['url'], qt))
                        evs.append(ev(s['url'], qt))
                    srcs[s['url']] = s
            detail = '\n'.join(x for x in [q.background, f'【類似制度との違い】{q.compare}' if q.compare else ''] if x)
            e = {
                'status': 'draft', 'short': f'正解は{pos})。{q.summary}',
                'whyCorrect': notes[str(pos)], 'choiceExplanations': notes,
                'sources': list(srcs.values()), 'evidence': evs, 'lawBaseDate': q.base, 'checkedAt': CHECKED,
            }
            if detail:
                e['detail'] = detail
            if q.memo:
                e['mnemonic'] = q.memo
            out.append({'id': q.id, 'terms': q.terms, 'explanation': e})
        return out


def all_batches() -> list[Batch]:
    import importlib
    import pkgutil

    from . import batches

    res = []
    for m in sorted(pkgutil.iter_modules(batches.__path__), key=lambda x: x.name):
        mod = importlib.import_module(f'{batches.__name__}.{m.name}')
        res.append(mod.BATCH)
    return res


def write_question_sets(out_dir: Path) -> list[str]:
    written = []
    for b in all_batches():
        p = out_dir / f'{b.set_id}.json'
        p.write_text(json.dumps(b.question_set(), ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        written.append(p.name)
    return written

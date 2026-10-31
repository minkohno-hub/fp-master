"""src/domain/termlink.ts の照合ロジックの Python 移植（build_content 専用）。

問題文・解説などのテキストに登場する用語を検出し、question-terms.json の自動生成に使う。
UI 側の照合（termlink.ts）と同じ規則にする：
- 照合キーは NFKC 正規化＋小文字化
- 用語の表記は「括弧を除いた正式名称」「正式名称」「別名」。1文字の表記は除外
- 同じ表記が複数の用語に登録されている場合は曖昧として検出しない
- 長い表記を優先する（正規表現の alternation を長さ降順にする）
"""
from __future__ import annotations

import re
import unicodedata


def normalize_key(s: str) -> str:
    return unicodedata.normalize('NFKC', s).lower()


def term_surfaces(t: dict) -> list[str]:
    names = [re.sub(r'（.*?）', '', t['name']), t['name'], *(t.get('aliases') or [])]
    out = []
    for n in names:
        k = normalize_key(n)
        if len(k) >= 2 and k not in out:
            out.append(k)
    return out


class Matcher:
    def __init__(self, terms: list[dict]):
        candidates: dict[str, dict[str, dict]] = {}
        for t in terms:
            for key in term_surfaces(t):
                candidates.setdefault(key, {})[t['id']] = t
        self.by_key: dict[str, dict] = {}
        self.ambiguous: dict[str, list[dict]] = {}
        for key, m in candidates.items():
            if len(m) == 1:
                self.by_key[key] = next(iter(m.values()))
            else:
                self.ambiguous[key] = list(m.values())
        keys = sorted(self.by_key.keys(), key=len, reverse=True)
        self.re = re.compile('|'.join(re.escape(k) for k in keys)) if keys else None

    def term_ids_in(self, text: str) -> list[str]:
        """テキストに登場する用語ID（出現順・重複なし）。"""
        if not self.re or not text:
            return []
        norm = normalize_key(text)
        seen: list[str] = []
        for m in self.re.finditer(norm):
            t = self.by_key.get(m.group(0))
            if t and t['id'] not in seen:
                seen.append(t['id'])
        return seen

#!/usr/bin/env python3
"""問題作成用：e-Gov法令検索の条文取得ツール（ディスクキャッシュ付き）。
  python3 -I scripts/original/lawtext.py find 借地借家          # 法令名の部分一致 → 法令ID
  python3 -I scripts/original/lawtext.py art 403AC0000000090 3 4 22の2   # 条文（第N条）を表示
  python3 -I scripts/original/lawtext.py grep 403AC0000000090 正当の事由 # キーワード周辺を表示
  python3 -I scripts/original/lawtext.py page <URL> [キーワード...]       # 一般ページ本文（国税庁など）のキーワード周辺
表示される本文は空白除去後のテキスト。引用（quote）はこの本文からそのままコピーすること。
"""
import hashlib
import html
import re
import sys
import urllib.request
from pathlib import Path

CACHE = Path(__file__).resolve().parent / '.cache'
CACHE.mkdir(exist_ok=True)
UA = 'Mozilla/5.0 (compatible; fp-master-source-check/1.0)'
KAN = '〇一二三四五六七八九'


def _get(url: str) -> bytes:
    f = CACHE / ('raw_' + hashlib.sha1(url.encode()).hexdigest())
    if f.exists():
        return f.read_bytes()
    b = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60).read()
    f.write_bytes(b)
    return b


def _decode(b: bytes) -> str:
    try:
        return b.decode('utf-8')
    except UnicodeDecodeError:
        return b.decode('cp932', errors='replace')


def clean(raw: str) -> str:
    raw = re.sub(r'<script.*?</script>|<style.*?</style>', '', raw, flags=re.S)
    return re.sub(r'\s+', '', html.unescape(re.sub(r'<[^>]+>', '', raw)))


def law_text(law_id: str) -> str:
    return clean(_decode(_get(f'https://laws.e-gov.go.jp/api/1/lawdata/{law_id}')))


def find(name: str) -> None:
    x = _decode(_get('https://laws.e-gov.go.jp/api/1/lawlists/1'))
    for i, n in re.findall(r'<LawId>(.*?)</LawId>\s*<LawName>(.*?)</LawName>', x):
        if name in n:
            print(i, n)


def kn(n: int) -> str:
    s = ''
    if n >= 100:
        s += (KAN[n // 100] if n // 100 > 1 else '') + '百'
        n %= 100
    if n >= 10:
        s += (KAN[n // 10] if n // 10 > 1 else '') + '十'
        n %= 10
    if n:
        s += KAN[n]
    return s


def art(law_id: str, nums: list[str]) -> None:
    x = law_text(law_id)
    for a in nums:
        m = re.match(r'(\d+)(?:の(\d+))?$', a)
        if not m:
            print('##', a, '形式は N または NのM')
            continue
        nn = kn(int(m.group(1))) + ('の' + kn(int(m.group(2))) if m.group(2) else '')
        pat = re.compile('（[^（）]{1,40}）第' + nn + '条(?=[^〇一二三四五六七八九十百の])|(?<=。)第' + nn + '条(?=[^〇一二三四五六七八九十百の])')
        mm = pat.search(x)
        if not mm:
            print('##', a, '見つからない')
            continue
        nxt = re.compile('（[^（）]{1,40}）第[〇一二三四五六七八九十百]+条(の[〇一二三四五六七八九十]+)?(?=[^〇一二三四五六七八九十百の])').search(x, mm.end())
        end = nxt.start() if nxt else mm.end() + 1500
        print('##', a, x[mm.start():min(end, mm.start() + 2500)])
        print()


def grep(text: str, kws: list[str], width: int = 220) -> None:
    for k in kws:
        ms = list(re.finditer(re.escape(k), text))[:3]
        if not ms:
            print('NF', k)
        for m in ms:
            print(f'[{k}]', text[max(0, m.start() - 60):m.end() + width])
            print()


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'find':
        find(sys.argv[2])
    elif cmd == 'art':
        art(sys.argv[2], sys.argv[3:])
    elif cmd == 'grep':
        grep(law_text(sys.argv[2]), sys.argv[3:])
    elif cmd == 'page':
        grep(clean(_decode(_get(sys.argv[2]))), sys.argv[3:])
    else:
        print(__doc__)

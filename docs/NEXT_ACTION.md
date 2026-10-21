# NEXT ACTION
1. push 権限が戻ったら `git push -u origin claude/fp-master-learning-app-76z7in` → PR作成 → CI確認。
2. 解説作成を継続：scripts/content/explanations_src.py に g3_202505 → g3_202405 → 2級各回の順で追加し build_content.py。
3. 実技取込：scripts/import に extract_jitsugi.py（問ごとに資料画像を切り出し、解答PDFと照合、複数解答欄を parts 化）。
4. draft の用語・カードに evidence を追加。
5. ページ単位の React.lazy 分割。

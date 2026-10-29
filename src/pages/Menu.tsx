import { Link } from 'react-router';
import { EXAM_SPEC_SOURCE } from '../domain/exam';
import { PageTitle } from '../ui/Layout';
import { LinkRow } from '../ui/common';

export function MenuPage() {
  return (
    <div className="space-y-4">
      <PageTitle>メニュー</PageTitle>
      <nav className="card py-1" aria-label="学習">
        <LinkRow to="/practice" title="通常演習" sub="知識問題をテンポよく" />
        <LinkRow to="/calc" title="計算トレーニング" />
        <LinkRow to="/challenge" title="95%チャレンジ（2級学科）" sub="高難度・初見の対応力を鍛える" />
        <LinkRow to="/review" title="苦手問題の復習" />
        <LinkRow to="/mock" title="模擬試験" />
        <LinkRow to="/cards" title="暗記カード" />
        <LinkRow to="/glossary" title="用語集" />
        <LinkRow to="/questions" title="過去問一覧" />
      </nav>
      <nav className="card py-1" aria-label="記録と計画">
        <LinkRow to="/stats" title="成績分析" />
        <LinkRow to="/plan" title="学習計画" />
        <LinkRow to="/bookmarks" title="ブックマーク・後で復習" />
        <LinkRow to="/mistakes" title="間違いノート" />
        <LinkRow to="/history" title="学習履歴" />
      </nav>
      <nav className="card py-1" aria-label="設定と情報">
        <LinkRow to="/settings" title="設定" />
        <LinkRow to="/data" title="データ管理（バックアップ・復元）" />
        <LinkRow to="/law" title="制度改正情報・法令基準日" />
        <LinkRow to="/guide" title="詳しい説明書" sub="使い方・計算の考え方・正確性ポリシー" />
        <LinkRow to="/about" title="出典と利用条件" />
      </nav>
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <PageTitle>出典と利用条件</PageTitle>
      <section className="card space-y-2">
        <h2 className="font-bold">過去問題について</h2>
        <p>
          本アプリの過去問題は、日本FP協会が公開する「試験問題・模範解答」から収録しています。日本FP協会の「FP技能検定の試験問題の利用について」に従い、各問題に出典を明記しています。2級・3級学科試験は日本FP協会と金融財政事情研究会の共通問題です。
        </p>
        <p>
          <a className="underline" href="https://www.jafp.or.jp/exam/mohan/" target="_blank" rel="noreferrer">
            日本FP協会 試験問題・模範解答
          </a>
        </p>
        <p>問題文は改行・空白の調整のみ行い、内容は変更していません。図表は原本PDFから画像として切り出して表示しています。正答は公表された模範解答と照合済みです。</p>
        <p>日本FP協会は、利用者が試験問題を用いて行う一切の行為について責任を負いません。本アプリは日本FP協会・金融財政事情研究会とは関係のない個人の学習用アプリです。</p>
      </section>
      <section className="card space-y-2">
        <h2 className="font-bold">解説・用語集の正確性</h2>
        <p>
          解説・用語・暗記カードは公的機関の資料をもとに作成しています。「根拠照合済み」は根拠資料の該当箇所を公式ページ上で自動照合できたもの、「要確認」は照合が完了していないものです。税制・社会保険は改正が多いため、最新の情報は必ず出典で確認してください。
        </p>
        <p>
          試験仕様の出典：
          <a className="underline" href={EXAM_SPEC_SOURCE.url} target="_blank" rel="noreferrer">
            {EXAM_SPEC_SOURCE.title}
          </a>
          （{EXAM_SPEC_SOURCE.checkedAt}確認）
        </p>
      </section>
      <section className="card space-y-2">
        <h2 className="font-bold">データの保存</h2>
        <p>学習記録はこの端末のブラウザ内にのみ保存され、外部に送信されません。端末をまたぐ自動同期はありません（GitHub Pages は静的サイトのため）。バックアップ機能をご利用ください。</p>
      </section>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="space-y-3 pt-6 text-center">
      <p>ページが見つかりません。</p>
      <Link to="/" className="btn-primary">
        ホームへ
      </Link>
    </div>
  );
}

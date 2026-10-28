import { Link } from 'react-router';
import { EXAM_SPEC_SOURCE } from '../domain/exam';
import { PageTitle } from '../ui/Layout';
import { LinkRow } from '../ui/common';
import { TermText } from '../ui/TermText';

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
        <LinkRow to="/help" title="使い方（日本語説明書）" />
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

const HELP: { title: string; body: string }[] = [
  {
    title: '用語をタップして意味を確認する',
    body: '問題文・選択肢・解説・計算の説明に出てくる下線つきの用語をタップすると、その場で意味が表示されます。たとえば「基礎控除」「NISA」「iDeCo」「遺留分」のような用語です。表示を閉じると元の問題にそのまま戻れ、解答状況は失われません。解答前は概念の説明だけが表示され、解答を確定すると数字・例外・類似用語との違いまで読めます。',
  },
  {
    title: '通常演習と計算トレーニング',
    body: '通常演習には、計算の操作が必要な問題を含めません（設定で含めることもできます）。計算問題は「計算トレーニング」で、解答後に計算過程と使う公式を確認できます。模擬試験は設定にかかわらず計算問題を含めます。',
  },
  {
    title: '95%チャレンジ（2級学科）',
    body: '難易度の高い問題や初見の問題に絞って演習します。初見の正答率、復習の正答率、累計の正答率は分けて表示します。95%は学習の目標であり、本試験の合格や得点を保証するものではありません。',
  },
  {
    title: '用語集と暗記カード',
    body: '用語集では、読み仮名・略称・別名でも検索できます。お気に入りに入れた用語は、暗記カードで復習できます。用語の説明は、根拠資料の引用を公式ページで照合できたものに「根拠照合済み」と表示します。「要確認」は照合が完了していない説明です。',
  },
  {
    title: '学習記録の保護',
    body: '学習記録はこの端末のブラウザ内に保存されます。端末の入れ替えや消去に備えて、「データ管理」から定期的にバックアップを書き出してください。',
  },
];

export function HelpPage() {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <PageTitle>使い方（日本語説明書）</PageTitle>
      {HELP.map((h) => (
        <section key={h.title} className="card space-y-1">
          <h2 className="font-bold">{h.title}</h2>
          <p>
            <TermText text={h.body} />
          </p>
        </section>
      ))}
    </div>
  );
}

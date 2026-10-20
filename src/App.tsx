import { useEffect, useRef, useState } from 'react';
import { questions } from './data/questions';
import { selectQuestions, subjects, summarize, reviewIds, type Attempt, type Grade, type Mode, type Question, type Subject } from './domain/learning';
import { loadHistory, saveHistory } from './features/history';
type Page = 'home' | 'history' | 'review';
interface Session { questions: Question[]; index: number; mode: Mode }
export function App() {
  const [initial] = useState(loadHistory);
  const [attempts,setAttempts] = useState(initial.attempts);
  const [warning,setWarning] = useState(initial.warning);
  const [grade,setGrade] = useState<Grade>('3');
  const [page,setPage] = useState<Page>('home');
  const [session,setSession] = useState<Session | null>(null);
  const [selected,setSelected] = useState<number | null>(null);
  const [answered,setAnswered] = useState(false);
  const [empty,setEmpty] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const gradeAttempts = attempts.filter(a => questions.some(q => q.id === a.questionId && q.grade === grade));
  const stats = summarize(gradeAttempts);
  const missed = reviewIds(gradeAttempts);
  const current = session?.questions[session.index];
  useEffect(() => { heading.current?.focus(); },[page,session?.index,Boolean(session)]);
  function start(mode: Mode, subject?: Subject) {
    const list = selectQuestions(questions,grade,mode,attempts,subject);
    if (!list.length) { setEmpty('復習する問題はありません。演習で間違えた問題がここに集まります。'); return; }
    setSession({questions:list,index:0,mode}); setSelected(null); setAnswered(false); setEmpty('');
  }
  function navigate(next: Page) {setSession(null);setPage(next);setEmpty('');}
  function answer() {
    if (!current || selected === null || answered) return;
    const next: Attempt[] = [...attempts,{id:crypto.randomUUID(),questionId:current.id,selected,correct:selected === current.answer,answeredAt:new Date().toISOString()}];
    setAttempts(next);setAnswered(true);
    if (!initial.warning && !saveHistory(next)) setWarning('履歴を保存できませんでした。この画面を閉じると今回の記録が失われる可能性があります。');
  }
  return <div className="layout">
    <a className="skip" href="#main">本文へ移動</a>
    <aside className="sidebar"><a href="#" className="brand" onClick={e=>{e.preventDefault();navigate('home');}}><span className="brand-icon">F<span>↗</span></span>FP Master<span className="brand-sub">LEARN. GROW. ACHIEVE.</span></a>
      <p className="nav-label">MY LEARNING</p><nav aria-label="メインメニュー">{([['home','⌂','ホーム'],['review','↻','復習'],['history','▤','学習履歴']] as const).map(([id,icon,label])=><button key={id} className={page===id&&!session?'nav-active':''} onClick={()=>navigate(id)}><span aria-hidden="true">{icon}</span>{label}{id==='review'&&missed.size>0&&<small>{missed.size}</small>}</button>)}</nav>
      <div className="sidebar-note"><span>一歩ずつ、合格へ。</span><p>小さな積み重ねが、<br/>大きな自信になる。</p><div className="note-lines" aria-hidden="true">▂ ▄ ▅ ▇</div></div><p className="sidebar-footer">FP2級・3級 学習プラットフォーム</p>
    </aside>
    <div className="content"><header><span>あなたのペースで、着実に。</span><label className="grade-select">学習コース<select aria-label="学習コース" value={grade} onChange={e=>{setGrade(e.target.value as Grade);setSession(null);setEmpty('');}}><option value="3">FP3級</option><option value="2">FP2級</option></select></label></header>
    <main id="main">{warning&&<p role="alert" className="notice">{warning}</p>}
      {current && session ? <section className="exercise panel"><div className="section-top"><span className="eyebrow">{session.mode==='calculation'?'CALCULATION':'PRACTICE'} / FP{grade}級</span><button className="text-button" onClick={()=>setSession(null)}>演習を終了</button></div><p className="muted">問題 {session.index+1} / {session.questions.length} ・ {subjects.find(s=>s.id===current.subject)?.short}</p><h1 ref={heading} tabIndex={-1}>{current.prompt}</h1><fieldset disabled={answered}><legend>回答を1つ選択してください</legend>{current.choices.map((choice,i)=><label className={`choice ${selected===i?'chosen':''}`} key={choice}><input type="radio" name="answer" checked={selected===i} onChange={()=>setSelected(i)}/><span>{choice}</span></label>)}</fieldset>{!answered?<button className="primary" disabled={selected===null} onClick={answer}>回答する →</button>:<div className="explanation" role="status"><h2>{selected===current.answer?'正解です！':'もう一度、確認しましょう'}</h2><p><strong>正解：{current.choices[current.answer]}</strong></p><p>{current.explanation}</p><small>基準日：{current.referenceDate} ・ 基礎確認用サンプル</small><div><button className="primary" onClick={()=>{if(session.index+1<session.questions.length){setSession({...session,index:session.index+1});setSelected(null);setAnswered(false);}else{setSession(null);setPage('history');}}}>{session.index+1<session.questions.length?'次の問題へ →':'結果・学習履歴を見る →'}</button></div></div>}</section> : <>
      <div className="page-heading"><div><p className="eyebrow">YOUR LEARNING JOURNEY</p><h1 ref={heading} tabIndex={-1}>{page==='home'?'今日の一問から、確かな力へ。':page==='review'?'苦手を、自信に変えよう。':'積み重ねを、見える形に。'}</h1><p className="muted">{page==='home'?'FP合格に向けて、自分のペースで学習を進めましょう。':page==='review'?'直近の回答で間違えた問題を、もう一度。':'この端末に保存された、あなたの学習記録です。'}</p></div><span className="course-badge">FP{grade}級コース</span></div>
      <div className="stats"><article className="stat"><span>累計回答数</span><p>{stats.total}<small>問</small></p><span className="stat-foot">今日も一歩、前へ</span></article><article className="stat"><span>正答率</span><p>{stats.accuracy??'—'}<small>%</small></p><span className="stat-foot">目標 95%以上</span></article><article className="stat"><span>復習待ち</span><p>{missed.size}<small>問</small></p><button className="text-button" onClick={()=>navigate('review')}>苦手を確認する ↗</button></article></div>
      {page==='home' ? <><section className="hero"><div><span className="hero-tag">LET’S GET STARTED</span><h2>「わかる」を増やす、<br/>今日の学習をはじめよう。</h2><p>6つの分野をバランスよく。<br className="mobile-break"/>一問ずつ、理解を深めていきましょう。</p><button className="light-button" onClick={()=>start('practice')}>問題演習をはじめる <span>→</span></button><small>基礎確認サンプル 全6問 / 何度でも挑戦できます</small></div><div className="hero-art" aria-hidden="true"><div className="orbit"></div><div className="art-card"><span>FP MASTER</span><strong>一問一歩。</strong><div>✓ 理解する<br/>✓ 積み重ねる<br/>✓ 自信になる</div></div><span className="art-star">✦</span></div></section>
      <section><div className="section-title"><h2>分野から学ぶ</h2><span>6 FIELDS</span></div><div className="subjects">{subjects.map((s,i)=><button key={s.id} className="subject" onClick={()=>start('practice',s.id)}><span className={`subject-icon color-${i}`} aria-hidden="true">{s.icon}</span><div><small>FIELD 0{i+1}</small><h3>{s.name}</h3><span>サンプル 1問</span></div><span className="arrow">↗</span></button>)}</div></section>
      <section className="tools"><article className="panel tool"><span className="tool-icon" aria-hidden="true">＋ −<br/>× ÷</span><div><h2>計算トレーニング</h2><p>手を動かして、計算の基礎を確実に。</p><button className="text-button" onClick={()=>start('calculation')}>計算問題に挑戦する →</button></div></article><article className="panel tool coming"><span className="tool-icon" aria-hidden="true">▤</span><div><span className="soon">準備中</span><h2>模擬試験</h2><p>本番形式で実力をチェック。今後追加予定。</p></div></article></section></> : page==='review'?<section className="panel"><h2>復習リスト <small>{missed.size}問</small></h2>{missed.size?<><p>正解すると復習リストから外れます。</p><button className="primary" onClick={()=>start('review')}>復習をはじめる →</button><ul className="review-list">{questions.filter(q=>q.grade===grade&&missed.has(q.id)).map(q=><li key={q.id}>{q.prompt}</li>)}</ul></>:<div className="empty"><span aria-hidden="true">✓</span><h3>復習待ちの問題はありません</h3><p>演習で間違えた問題がここに集まります。</p><button className="primary" onClick={()=>start('practice')}>問題演習へ →</button></div>}</section>:<section className="panel"><h2>回答履歴</h2>{gradeAttempts.length?<ol className="history">{[...gradeAttempts].reverse().map(a=>{const q=questions.find(q=>q.id===a.questionId);return <li key={a.id}><span className={a.correct?'result-correct':'result-wrong'}>{a.correct?'正解':'不正解'}</span><div><p>{q?.prompt??'削除された問題'}</p><small>{new Date(a.answeredAt).toLocaleString('ja-JP')} ・ 回答：{q?.choices[a.selected]??'—'}</small></div></li>;})}</ol>:<div className="empty"><h3>ここから、学習をはじめましょう</h3><p>回答すると履歴と正答率が記録されます。</p><button className="primary" onClick={()=>start('practice')}>最初の一問へ →</button></div>}</section>}
      {empty&&<p role="status" className="notice">{empty}</p>}
      </>}
      <footer><strong>FP Master</strong><p>現在は開発用の基礎確認サンプルです。両級で共通の6問を使用しています。<br/>試験範囲の網羅・合格・正答率95%を保証するものではありません。履歴はこのブラウザ内に保存されます。</p></footer>
    </main></div></div>;
}

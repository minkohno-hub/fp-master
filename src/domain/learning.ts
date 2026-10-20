export type Grade = '3' | '2';
export type Subject = 'life' | 'risk' | 'finance' | 'tax' | 'estate' | 'inheritance';
export type Mode = 'practice' | 'calculation' | 'review';
export interface Question {
  id: string;
  grade: Grade;
  subject: Subject;
  kind: 'knowledge' | 'calculation';
  prompt: string;
  choices: readonly string[];
  answer: number;
  explanation: string;
  referenceDate: string;
}
export interface Attempt { id: string; questionId: string; selected: number; correct: boolean; answeredAt: string }
export const subjects: { id: Subject; name: string; short: string; icon: string }[] = [
  {id:'life',name:'ライフプランニングと資金計画',short:'ライフプラン',icon:'◷'},
  {id:'risk',name:'リスク管理',short:'リスク管理',icon:'◇'},
  {id:'finance',name:'金融資産運用',short:'金融資産運用',icon:'↗'},
  {id:'tax',name:'タックスプランニング',short:'税金',icon:'▤'},
  {id:'estate',name:'不動産',short:'不動産',icon:'⌂'},
  {id:'inheritance',name:'相続・事業承継',short:'相続・事業承継',icon:'♧'},
];
export function summarize(attempts: Attempt[]) {
  const correct = attempts.filter(a => a.correct).length;
  return { total: attempts.length, correct, accuracy: attempts.length ? Math.round(correct / attempts.length * 100) : null };
}
export function reviewIds(attempts: Attempt[]): Set<string> {
  const latest = new Map<string, boolean>();
  for (const attempt of attempts) latest.set(attempt.questionId, attempt.correct);
  return new Set([...latest].filter(([, correct]) => !correct).map(([id]) => id));
}
export function selectQuestions(questions: Question[], grade: Grade, mode: Mode, attempts: Attempt[], subject?: Subject): Question[] {
  const missed = reviewIds(attempts);
  return questions.filter(q => q.grade === grade && (!subject || q.subject === subject) && (mode === 'calculation' ? q.kind === 'calculation' : mode === 'review' ? missed.has(q.id) : true));
}

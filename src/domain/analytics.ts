import type { Attempt, Grade, Subject } from './learning';
import type { Difficulty, ExamCategory, MaterialQuestion, Topic } from './curriculum';
import { canPublish } from './curriculum';
import type { StudyMode } from './assessment';
import type { SelfRating } from './review';
export interface LearningAttempt extends Attempt {
  grade?: Grade;
  exam?: ExamCategory;
  mode?: StudyMode;
  durationMs?: number;
  selfRating?: SelfRating;
  difficulty?: Difficulty;
}
export interface Rate { total: number; correct: number; accuracy: number | null }
export function calculateRate(attempts: readonly Pick<Attempt, 'correct'>[]): Rate {
  const total = attempts.length;
  const correct = attempts.filter(a => a.correct).length;
  // Never round 94.5% up to the 95% target.
  return {total, correct, accuracy: total ? Math.floor(correct / total * 10000) / 100 : null};
}
export interface LearningAnalysis {
  cumulative: Rate;
  recent: Rate;
  firstSeen: Rate;
  review: Rate;
  practice: Rate;
  calculation: Rate;
  mock: Rate;
  bySubject: Record<Subject, Rate>;
  byDifficulty: Record<Difficulty, Rate>;
  answeredQuestionCount: number;
  unlearnedQuestionCount: number;
  unlearnedQuestionRatio: number | null;
  durationMs: number;
  meanDurationMs: number | null;
  evidence: 'insufficient' | 'limited';
  targetReached: boolean;
  /** No pass probability is inferred from this data. */
  confidenceMessage: string;
}
export function analyzeLearning(catalog: readonly MaterialQuestion[], attempts: readonly LearningAttempt[], grade: Grade, exam: ExamCategory, recentCount = 20): LearningAnalysis {
  if (!Number.isSafeInteger(recentCount) || recentCount < 1) throw new RangeError('直近件数が不正です');
  const relevant = catalog.filter(q => q.grade === grade && q.exam === exam && canPublish(q));
  const byId = new Map(relevant.map(q => [q.id,q]));
  // Unknown or quarantined materials and explicitly different exam/grade records cannot support attainment.
  const ordered = attempts.filter(a => Number.isFinite(Date.parse(a.answeredAt)) && byId.has(a.questionId) && (!a.grade || a.grade === grade) && (!a.exam || a.exam === exam)).sort((a,b) => Date.parse(a.answeredAt) - Date.parse(b.answeredAt));
  const seen = new Set<string>();
  const first: LearningAttempt[] = [];
  const repeat: LearningAttempt[] = [];
  for (const a of ordered) { if (seen.has(a.questionId) || a.mode === 'review') repeat.push(a); else first.push(a); seen.add(a.questionId); }
  const repeatIds = new Set(repeat.map(a=>a.id));
  const bySubject = {} as Record<Subject,Rate>;
  for (const s of ['life','risk','finance','tax','estate','inheritance'] as const) bySubject[s] = calculateRate(ordered.filter(a => byId.get(a.questionId)?.subject === s));
  const byDifficulty = {} as Record<Difficulty,Rate>;
  for (const d of ['basic','standard','advanced','expert','exception'] as const) byDifficulty[d] = calculateRate(ordered.filter(a => byId.get(a.questionId)?.difficulty === d));
  const durations = ordered.map(a => a.durationMs).filter((d):d is number => typeof d === 'number' && Number.isFinite(d) && d >= 0);
  const durationMs = durations.reduce((sum,d)=>sum+d,0);
  const firstSeen = calculateRate(first);
  const enough = firstSeen.total >= 30;
  return {
    cumulative:calculateRate(ordered),recent:calculateRate(ordered.slice(-recentCount)),firstSeen,
    review:calculateRate(ordered.filter(a=>a.mode === 'review' || repeatIds.has(a.id))),
    practice:calculateRate(ordered.filter(a=>a.mode === 'practice')),calculation:calculateRate(ordered.filter(a=>a.mode === 'calculation')),mock:calculateRate(ordered.filter(a=>a.mode === 'mock')),
    bySubject,byDifficulty,answeredQuestionCount:seen.size,unlearnedQuestionCount:relevant.length-seen.size,
    unlearnedQuestionRatio:relevant.length ? (relevant.length-seen.size)/relevant.length : null,
    durationMs,meanDurationMs:durations.length ? durationMs/durations.length : null,
    evidence:enough?'limited':'insufficient', targetReached: enough && firstSeen.accuracy !== null && firstSeen.accuracy >= 95,
    confidenceMessage: enough ? '初見成績のみの参考値です。試験範囲の未学習論点と模擬試験も確認してください。合格確率は推定していません。' : '初見回答が30問未満のため、到達度の評価には十分な根拠がありません。合格確率は推定していません。',
  };
}
export interface TopicCoverage {
  topicId:string;
  totalQuestions:number;
  verifiedQuestions:number;
  relatedTerms:number;
  learned:boolean;
  firstSeen:Rate;
  mastered:boolean;
  missingMaterial:boolean;
  scopeVerified:boolean;
  lawReferenceDate:string|null;
}
export interface CoverageReport {
  topics:TopicCoverage[];
  scopeStatus:'confirmed'|'unconfirmed';
  totalTopics:number;
  verifiedScopeTopics:number;
  coveredTopics:number;
  /** Null means the official denominator is unconfirmed. Never advertise a draft inventory as full scope. */
  topicCoverage:number|null;
  questionVerificationRate:number|null;
  masteryRate:number|null;
  unlearnedTopicRatio:number|null;
  pendingTopicIds:string[];
  totalQuestions:number;
  verifiedQuestions:number;
}
export function getCoverage(topics:readonly Topic[], catalog:readonly MaterialQuestion[], attempts:readonly LearningAttempt[], grade:Grade, exam:ExamCategory): CoverageReport {
  const relevantTopics=topics.filter(t=>t.grades.includes(grade)&&t.exams.includes(exam));
  const relevantQuestions=catalog.filter(q=>q.grade===grade&&q.exam===exam);
  const relevantIds=new Set(relevantQuestions.filter(q=>canPublish(q)).map(q=>q.id));
  const ordered=attempts.filter(a=>Number.isFinite(Date.parse(a.answeredAt))&&relevantIds.has(a.questionId)&&(!a.grade||a.grade===grade)&&(!a.exam||a.exam===exam)).sort((a,b)=>Date.parse(a.answeredAt)-Date.parse(b.answeredAt));
  const seen=new Set<string>();
  const first=ordered.filter(a=>{const firstSeen=!seen.has(a.questionId)&&a.mode!=='review';seen.add(a.questionId);return firstSeen;});
  const rows=relevantTopics.map(t=>{
    const qs=relevantQuestions.filter(q=>q.topicId===t.id);
    const verified=qs.filter(q=>canPublish(q));
    const ids=new Set(verified.map(q=>q.id));
    const firstSeen=calculateRate(first.filter(a=>ids.has(a.questionId)&&(!a.grade||a.grade===grade)&&(!a.exam||a.exam===exam)));
    return {topicId:t.id,totalQuestions:qs.length,verifiedQuestions:verified.length,relatedTerms:t.termIds.length,learned:ordered.some(a=>ids.has(a.questionId)),firstSeen,mastered:firstSeen.total>=3&&firstSeen.accuracy!==null&&firstSeen.accuracy>=95,missingMaterial:verified.length===0,scopeVerified:t.scopeVerified,lawReferenceDate:t.lawReferenceDate};
  });
  const verifiedScopeTopics=relevantTopics.filter(t=>t.scopeVerified&&t.officialScope?.checkedAt).length;
  const confirmed=relevantTopics.length>0&&verifiedScopeTopics===relevantTopics.length;
  const coveredTopics=rows.filter(r=>!r.missingMaterial).length;
  const verifiedQuestions=relevantQuestions.filter(q=>canPublish(q)).length;
  return {topics:rows,scopeStatus:confirmed?'confirmed':'unconfirmed',totalTopics:rows.length,verifiedScopeTopics,coveredTopics,
    topicCoverage:confirmed?coveredTopics/rows.length:null,
    questionVerificationRate:relevantQuestions.length?verifiedQuestions/relevantQuestions.length:null,
    masteryRate:confirmed?rows.filter(r=>r.mastered).length/rows.length:null,
    unlearnedTopicRatio:confirmed?rows.filter(r=>!r.learned).length/rows.length:null,
    pendingTopicIds:rows.filter(r=>r.missingMaterial).map(r=>r.topicId),totalQuestions:relevantQuestions.length,verifiedQuestions};
}

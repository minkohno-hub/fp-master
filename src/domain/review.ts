export type SelfRating = 'again' | 'hard' | 'good' | 'easy';
export interface QuestionReview {
  questionId: string;
  ease: number;
  intervalDays: number;
  repetitions: number;
  consecutiveCorrect: number;
  lastAnsweredAt: string;
  nextReviewAt: string;
  reviewCount: number;
}
export interface ReviewAnswer { questionId: string; correct: boolean; rating: SelfRating; answeredAt: string }
/** SM-2-inspired, day-based scheduling. Self-rated uncertainty is eligible even after a correct answer. */
export function scheduleReview(previous: QuestionReview | undefined, answer: ReviewAnswer): QuestionReview {
  if (!Number.isFinite(Date.parse(answer.answeredAt))) throw new RangeError('解答日時が不正です');
  if (previous && previous.questionId !== answer.questionId) throw new Error('別問題の復習状態は更新できません');
  if (previous && (!Number.isFinite(previous.ease) || previous.ease < 1.3 || !Number.isInteger(previous.repetitions) || previous.repetitions < 0 || !Number.isInteger(previous.intervalDays) || previous.intervalDays < 0)) throw new Error('復習状態が不正です');
  if (previous && Date.parse(answer.answeredAt) < Date.parse(previous.lastAnsweredAt)) throw new Error('過去の回答で復習予定を上書きできません');
  const quality = !answer.correct || answer.rating === 'again' ? 0 : answer.rating === 'hard' ? 3 : answer.rating === 'good' ? 4 : 5;
  const oldEase = previous?.ease ?? 2.5;
  const ease = Math.max(1.3, Math.min(3, Math.round((oldEase + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)) * 100) / 100));
  const repetitions = quality < 3 ? 0 : (previous?.repetitions ?? 0) + 1;
  let intervalDays = quality < 3 ? 1 : repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round((previous?.intervalDays ?? 1) * ease);
  if (answer.rating === 'hard' && answer.correct) intervalDays = Math.min(intervalDays, 2);
  if (answer.rating === 'easy' && answer.correct && repetitions === 1) intervalDays = 4;
  intervalDays = Math.max(1, Math.min(365, intervalDays));
  const next = new Date(answer.answeredAt);
  next.setUTCDate(next.getUTCDate() + intervalDays);
  return { questionId: answer.questionId, ease, intervalDays, repetitions,
    consecutiveCorrect: answer.correct && answer.rating !== 'again' ? (previous?.consecutiveCorrect ?? 0) + 1 : 0,
    lastAnsweredAt: answer.answeredAt, nextReviewAt: next.toISOString(), reviewCount: (previous?.reviewCount ?? 0) + 1 };
}
export function dueReviews(reviews: readonly QuestionReview[], now = new Date()): QuestionReview[] {
  if (!Number.isFinite(now.getTime())) throw new RangeError('基準日時が不正です');
  return reviews.filter(r => Date.parse(r.nextReviewAt) <= now.getTime()).sort((a,b) => Date.parse(a.nextReviewAt) - Date.parse(b.nextReviewAt));
}

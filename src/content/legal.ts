import { isCalendarDate, type MaterialQuestion, type SourceReference } from '../domain/curriculum.ts';

export interface LegalChange {
  id: string;
  title: string;
  source: SourceReference;
  effectiveDate: string;
  lawReferenceDate: string;
  affectedTopicIds: string[];
  status: 'needs-review' | 'verified';
  previousRule: string | null;
  currentRule: string | null;
  /** Human editorial evidence; automatic source polling never supplies this. */
  reviewEvidence: string[];
}
export interface LegalWarning {
  changeId: string | null;
  status: 'baseline-unknown' | 'needs-review' | 'outdated';
  message: string;
  source: SourceReference | null;
}
export function isOfficialSourceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (url.hostname === 'jafp.or.jp' || url.hostname === 'www.jafp.or.jp' || url.hostname.endsWith('.go.jp'));
  } catch { return false; }
}
/** This validates metadata, not whether the legal interpretation is factually correct. */
export function validateLegalChange(change: LegalChange): string[] {
  const errors: string[] = [];
  if (!change.id.trim() || !change.title.trim()) errors.push('改正IDと名称が必要です');
  if (!change.source.title.trim() || !isOfficialSourceUrl(change.source.url)) errors.push('公式機関のHTTPS原典が必要です');
  if (!isCalendarDate(change.effectiveDate) || !isCalendarDate(change.lawReferenceDate)) errors.push('適用日と法令基準日を確認してください');
  if (!change.affectedTopicIds.length || change.affectedTopicIds.some(id => !id.trim()) || new Set(change.affectedTopicIds).size !== change.affectedTopicIds.length) errors.push('影響論点を重複なく指定してください');
  if (!['needs-review', 'verified'].includes(change.status)) errors.push('確認状態が不正です');
  if (change.source.checkedAt !== null && !isCalendarDate(change.source.checkedAt)) errors.push('原典確認日が不正です');
  if (change.status === 'verified' && (!isCalendarDate(change.source.checkedAt) || !change.reviewEvidence.length || change.reviewEvidence.some(e => !e.trim()) || !change.currentRule?.trim())) errors.push('確認済みへの変更には原典確認日・照合記録・現行制度の説明が必要です');
  return errors;
}
/** Returns references to input records. It never edits the answer, explanation, or verification status. */
export function affectedMaterials(change: LegalChange, questions: readonly MaterialQuestion[]): MaterialQuestion[] {
  return questions.filter(q => change.affectedTopicIds.includes(q.topicId));
}
/**
 * Compare against the chosen exam's explicit legal reference date, not today's date.
 * A future change must not invalidate a historical exam governed by an earlier date.
 */
export function legalWarnings(question: MaterialQuestion, changes: readonly LegalChange[], targetLawReferenceDate: string): LegalWarning[] {
  if (!isCalendarDate(targetLawReferenceDate)) throw new RangeError('比較対象の法令基準日を指定してください');
  if (!isCalendarDate(question.lawReferenceDate)) return [{changeId:null,status:'baseline-unknown',message:'教材の法令基準日が未確認です。原典照合が完了するまで出題対象にできません。',source:null}];
  const warnings: LegalWarning[] = [];
  for (const change of changes) {
    if (!change.affectedTopicIds.includes(question.topicId)) continue;
    if (validateLegalChange(change).length) throw new Error(`法改正記録 ${change.id} の整合性を確認してください`);
    if (change.effectiveDate > targetLawReferenceDate || change.effectiveDate <= question.lawReferenceDate) continue;
    warnings.push({changeId:change.id,status:change.status === 'verified' ? 'outdated' : 'needs-review',
      message:change.status === 'verified' ? `${change.title}（適用 ${change.effectiveDate}）より前の基準日です。現行制度との原典照合が必要です。` : `${change.title}に関する更新候補があります。未確認のため正答・解説を自動変更しません。`,source:change.source});
  }
  return warnings;
}
/** Empty until actual official documents and interpretations have been reviewed. */
export const legalChanges: LegalChange[] = [];

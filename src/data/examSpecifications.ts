import type { ExamSpecification } from '../domain/mockExam';
/** Current official documents are inaccessible (403). Never fill these fields from memory or inference. */
export const examSpecifications: ExamSpecification[] = (['3','2'] as const).flatMap(grade=>(['academic','practical'] as const).map(exam=>({
  id:`${grade}-${exam}`,version:1,grade,exam,verificationStatus:'unconfirmed',verifiedAt:null,
  sources:[],lawReferenceDate:null,formats:null,questionCount:null,countingUnit:null,durationMinutes:null,
  fullScore:null,passingScore:null,subjectDistribution:null,formatDistribution:null,distributionStatus:'unconfirmed',
  scoringStatus:'unconfirmed',pointsPerQuestion:null,scoringNotes:'公式資料の原典照合待ち。試験仕様・配点・合格基準を推測で確定しません。',requiresCalculation:null,
})));

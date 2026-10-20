/** Editorial quarantine only. Never import from the application entry point or production catalog. */
import { questions } from './questions';
import type { MaterialQuestion } from '../domain/curriculum';
import type { Subject } from '../domain/learning';
import { topicInventory } from './catalog';
const sampleTopic: Record<Subject,string>={life:'life-1',risk:'risk-1',finance:'finance-3',tax:'tax-1',estate:'estate-4',inheritance:'inheritance-1'};
/** Existing foundation samples remain preserved, but cannot enter real learning or a public question bank. */
export const quarantinedQuestions: MaterialQuestion[] = questions.map(q=>({
  id:q.id,grade:q.grade,exam:'academic',subject:q.subject,topicId:sampleTopic[q.subject],
  middleCategory:topicInventory.find(t=>t.id===sampleTopic[q.subject])!.middleCategory,
  subcategory:topicInventory.find(t=>t.id===sampleTopic[q.subject])!.subcategory,
  format:'multiple-choice',difficulty:'basic',kind:q.kind,prompt:q.prompt,choices:[...q.choices],
  grading:{type:'choice',correctIndex:q.answer},
  explanation:{concise:q.explanation,standard:q.explanation,detailed:q.explanation,conditions:[],exceptions:[],commonMistakes:[],example:'',formula:null},
  choiceExplanations:[],relatedTerms:[],relatedQuestions:[],
  source:{origin:'original',references:[],originalQuestion:null,modifications:null,publication:'unknown',permissionEvidence:null},
  year:null,questionNumber:null,lawReferenceDate:null,lastCheckedAt:null,
  verification:{status:'needs-review',checkedAt:null,reviewer:null,evidence:[]},dataVersion:1,
}));

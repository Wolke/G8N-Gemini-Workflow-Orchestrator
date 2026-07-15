export interface EvaluationCase {
  id: string;
  title: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
}

const owners = ['Amy', 'Ben', 'Chia', 'Dora', 'Evan'];

export const projectOpsEvaluation: EvaluationCase[] = Array.from({ length: 20 }, (_, index) => ({
  id: `project-${String(index + 1).padStart(2, '0')}`,
  title: `專案週會案例 ${index + 1}`,
  input: { transcript: `決議採用方案 ${index + 1}。${owners[index % owners.length]} 在 2026-08-${String((index % 20) + 1).padStart(2, '0')} 前完成驗證。風險：外部 API 可能延遲。` },
  expected: { decisions: 1, actionItems: 1, risks: 1, owner: owners[index % owners.length] },
}));

export const marketingOpsEvaluation: EvaluationCase[] = Array.from({ length: 20 }, (_, index) => ({
  id: `marketing-${String(index + 1).padStart(2, '0')}`,
  title: `品牌活動案例 ${index + 1}`,
  input: { brand: `Brand ${index + 1}`, audience: index % 2 ? 'developer' : 'project manager', locales: ['zh-TW', 'en'], bannedTerms: ['best', 'guaranteed'] },
  expected: { strategyAngles: 3, locales: 2, containsBannedTerms: false, approvalStages: 3 },
}));

export const educationOpsEvaluation: EvaluationCase[] = Array.from({ length: 20 }, (_, index) => ({
  id: `education-${String(index + 1).padStart(2, '0')}`,
  title: `系統設計作業案例 ${index + 1}`,
  input: { answer: `Student answer ${index + 1}`, rubric: { correctness: 40, reasoning: 30, evidence: 20, clarity: 10 } },
  expected: { rubricItems: 4, requiresTeacherApproval: true, writesFinalGradeBeforeApproval: false },
}));

export const evaluationDatasets = {
  project_ops: projectOpsEvaluation,
  marketing_ops: marketingOpsEvaluation,
  education_ops: educationOpsEvaluation,
};

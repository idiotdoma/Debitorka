// Типы для ИИ-помощника

export type AIOperationType =
  | 'analyze_counterparty'
  | 'generate_letter'
  | 'explain_priorities'
  | 'daily_plan'
  | 'history_summary'
  | 'ask_question';

export interface AIRequest {
  operation: AIOperationType;
  context: Record<string, any>;
  options?: Record<string, any>;
}

export interface AIResponse {
  success: boolean;
  operation: AIOperationType;
  data?: any;
  error?: string;
  sources?: Array<{
    type: string;
    id: string;
    label: string;
  }>;
  timestamp: string;
  model?: string;
  tokensUsed?: number;
}

export interface CounterpartyAnalysis {
  summary: string;
  facts: Array<{
    fact: string;
    sourceType: string;
    sourceId?: string;
  }>;
  concerns: string[];
  agreements: string[];
  recommendedAction: {
    action: string;
    reason: string;
  };
  missingInformation: string[];
}

export interface LetterDraft {
  subject?: string;
  body: string;
  tone: 'neutral' | 'polite' | 'firm';
  format: 'email' | 'message';
  placeholders: string[];
}

export interface PriorityExplanation {
  counterpartyId: string;
  counterpartyName: string;
  priority: number;
  reasons: string[];
  facts: Array<{
    fact: string;
    sourceType: string;
    sourceId?: string;
  }>;
  recommendedAction: string;
}

export interface DailyPlanItem {
  counterpartyName: string;
  task: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  relatedSourceId?: string;
  estimatedTime?: string;
}

export interface HistorySummary {
  currentSituation: string;
  recentContacts: Array<{
    date: string;
    type: string;
    summary: string;
  }>;
  agreements: string[];
  completedTasks: string[];
  pendingTasks: string[];
  nextSteps: string[];
  needsClarification: string[];
}

export interface AIProvider {
  name: string;
  analyzeCounterparty(context: any): Promise<CounterpartyAnalysis>;
  generateLetter(context: any, options: any): Promise<LetterDraft>;
  explainPriorities(context: any): Promise<PriorityExplanation[]>;
  generateDailyPlan(context: any): Promise<DailyPlanItem[]>;
  summarizeHistory(context: any): Promise<HistorySummary>;
  answerQuestion(context: any, question: string): Promise<string>;
}

export interface AIConfig {
  provider: 'mock' | 'openai' | 'anthropic';
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

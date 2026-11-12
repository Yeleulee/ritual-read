export type QuestionType = "multiple-choice" | "true-false" | "flashcard";

export interface PracticeOption {
  id: string;
  text: string;
}

export interface PracticeQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options?: PracticeOption[];
  correctAnswer: string;
  explanation: string;
  sourceExcerpt?: string;
  difficulty: "easy" | "medium" | "hard";
  topic?: string;
  isFlagged?: boolean;
}

export interface PracticeSet {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  sourceType: "library-book" | "uploaded-doc" | "mock-questions";
  sourceName: string;
  bookId?: string;
  questions: PracticeQuestion[];
  bestScore?: {
    score: number;
    total: number;
    percentage: number;
    completedAt: number;
  };
  lastAttempt?: {
    answers: Record<string, string>;
    score: number;
    total: number;
    percentage: number;
    completedAt: number;
    timeSpentSeconds?: number;
  };
}

export interface PracticeStats {
  totalSets: number;
  totalAttempts: number;
  totalQuestionsAnswered: number;
  totalCorrect: number;
  averageScorePercentage: number;
}

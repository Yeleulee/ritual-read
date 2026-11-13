import { useState, useEffect } from "react";
import type { BookItem } from "@/hooks/use-books";
import type { PracticeQuestion, PracticeSet } from "@/types/practice";
import {
  loadPracticeSets,
  savePracticeSet,
  deletePracticeSet,
  calculatePracticeStats,
  logPracticeSession,
} from "@/lib/practice-storage";
import { SectionHeader, Stat, StatGrid, Panel, Empty } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  Plus,
  Play,
  Layers,
  Trash2,
  Sparkles,
  BookOpen,
  Calendar,
  CheckCircle2,
  FileQuestion,
  RotateCcw,
} from "lucide-react";
import { PracticeCreateDialog } from "./PracticeCreateDialog";
import { QuizPlayer } from "./QuizPlayer";
import { FlashcardPlayer } from "./FlashcardPlayer";
import { QuizResults } from "./QuizResults";
import { PracticeHeatmap } from "./PracticeHeatmap";
import { cn } from "@/lib/utils";

interface PracticeDashboardProps {
  books: BookItem[];
}

const SAMPLE_STARTER_SET: PracticeSet = {
  id: "sample-starter-cognition",
  title: "Cognitive Science & Memory Retention",
  description: "Starter practice set testing key active recall concepts and spaced repetition principles.",
  sourceType: "uploaded-doc",
  sourceName: "Foundations of Human Memory (Syllabus)",
  createdAt: Date.now() - 86400000,
  updatedAt: Date.now() - 86400000,
  questions: [
    {
      id: "q-sample-1",
      type: "multiple-choice",
      question: "Which learning strategy yields significantly higher long-term memory retention according to cognitive research?",
      options: [
        { id: "A", text: "Passive rereading of highlighted notes" },
        { id: "B", text: "Active retrieval practice and self-testing" },
        { id: "C", text: "Massed single-session cramming before exams" },
        { id: "D", text: "Verbatim copying of chapter summaries" },
      ],
      correctAnswer: "B",
      explanation: "Active retrieval forces the brain to reconstruct neural pathways, leading to durable retention compared to passive rereading.",
      sourceExcerpt: "Testing produces superior retention compared to repeated study sessions because retrieval itself modifies the memory trace.",
      difficulty: "easy",
      topic: "Retrieval Practice",
    },
    {
      id: "q-sample-2",
      type: "true-false",
      question: "The 'forgetting curve' demonstrates that memory decay occurs most rapidly immediately after initial learning.",
      options: [
        { id: "True", text: "True" },
        { id: "False", text: "False" },
      ],
      correctAnswer: "True",
      explanation: "Hermann Ebbinghaus discovered that the steepest decline in retention happens within the first 24 to 48 hours unless spaced reinforcement occurs.",
      sourceExcerpt: "The loss of information is rapid initially and then levels off over time, forming an exponential decay curve.",
      difficulty: "medium",
      topic: "Memory Decay",
    },
    {
      id: "q-sample-3",
      type: "multiple-choice",
      question: "How does the 'testing effect' primarily strengthen mental models?",
      options: [
        { id: "A", text: "By lowering cognitive load during initial encoding" },
        { id: "B", text: "By identifying gaps and producing effortful retrieval cues" },
        { id: "C", text: "By replacing sensory memory with implicit reflexes" },
        { id: "D", text: "By preventing new synaptic pruning entirely" },
      ],
      correctAnswer: "B",
      explanation: "Effortful retrieval highlights knowledge gaps and creates multiple associative pathways to the target concept.",
      sourceExcerpt: "Retrieval practice reveals what students know and what they do not know, allowing calibrated restudy.",
      difficulty: "hard",
      topic: "Desirable Difficulties",
    },
  ],
};

interface PracticeAttempt {
  answers: Record<string, string>;
  score: number;
  total: number;
  percentage: number;
  timeSpentSeconds: number;
}

export function PracticeDashboard({ books }: PracticeDashboardProps) {
  const [sets, setSets] = useState<PracticeSet[]>([]);
  const [activeSet, setActiveSet] = useState<PracticeSet | null>(null);
  const [mode, setMode] = useState<"hub" | "quiz" | "flashcards" | "results">("hub");
  const [lastAttempt, setLastAttempt] = useState<PracticeAttempt | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [heatmapKey, setHeatmapKey] = useState(0); // force re-render after sessions

  useEffect(() => {
    const loaded = loadPracticeSets();
    if (loaded.length === 0) {
      const seeded = [SAMPLE_STARTER_SET];
      setSets(seeded);
      savePracticeSet(SAMPLE_STARTER_SET);
    } else {
      setSets(loaded);
    }
  }, []);

  const stats = calculatePracticeStats(sets);

  const handleSetCreated = (newSet: PracticeSet) => {
    const updated = savePracticeSet(newSet);
    setSets(updated);
    setActiveSet(newSet);
    const allFlashcards = newSet.questions.length > 0 && newSet.questions.every((q) => q.type === "flashcard");
    setMode(allFlashcards ? "flashcards" : "quiz");
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = deletePracticeSet(id);
    setSets(updated);
    if (activeSet?.id === id) {
      setActiveSet(null);
      setMode("hub");
    }
  };

  const handleStartQuiz = (set: PracticeSet) => {
    setActiveSet(set);
    setMode("quiz");
  };

  const handleStartFlashcards = (set: PracticeSet) => {
    setActiveSet(set);
    setMode("flashcards");
  };

  const handleQuizFinish = (attempt: PracticeAttempt) => {
    setLastAttempt(attempt);

    // Log into daily activity tracker (GitHub heatmap)
    logPracticeSession(attempt.total, attempt.score);
    setHeatmapKey((k) => k + 1);

    if (activeSet) {
      const isBest = !activeSet.bestScore || attempt.percentage >= activeSet.bestScore.percentage;
      const updatedSet: PracticeSet = {
        ...activeSet,
        lastAttempt: {
          ...attempt,
          completedAt: Date.now(),
        },
        bestScore: isBest
          ? {
              score: attempt.score,
              total: attempt.total,
              percentage: attempt.percentage,
              completedAt: Date.now(),
            }
          : activeSet.bestScore,
      };
      const updatedSets = savePracticeSet(updatedSet);
      setSets(updatedSets);
      setActiveSet(updatedSet);
    }
    setMode("results");
  };

  const handleRetakeMissed = (missedQuestions: PracticeQuestion[]) => {
    if (!activeSet) return;
    const tempSet: PracticeSet = {
      ...activeSet,
      id: `${activeSet.id}-missed-${Date.now()}`,
      title: `${activeSet.title} (Review Missed)`,
      questions: missedQuestions,
    };
    setActiveSet(tempSet);
    setMode("quiz");
  };

  if (mode === "quiz" && activeSet) {
    return (
      <QuizPlayer
        practiceSet={activeSet}
        onFinish={handleQuizFinish}
        onBack={() => setMode("hub")}
      />
    );
  }

  if (mode === "flashcards" && activeSet) {
    return (
      <FlashcardPlayer
        practiceSet={activeSet}
        onFinish={handleQuizFinish}
        onBack={() => setMode("hub")}
      />
    );
  }

  if (mode === "results" && activeSet && lastAttempt) {
    return (
      <QuizResults
        practiceSet={activeSet}
        attempt={lastAttempt}
        onRetake={() => setMode("quiz")}
        onRetakeMissed={handleRetakeMissed}
        onStudyFlashcards={() => setMode("flashcards")}
        onBackToHub={() => { setMode("hub"); setHeatmapKey((k) => k + 1); }}
      />
    );
  }

  return (
    <div className="space-y-10 animate-page-fade">
      {/* Section Header */}
      <SectionHeader
        eyebrow="Practice"
        title="Student Exam & Study Prep"
        meta="Generate practice tests from your lecture notes, PDFs, and books — or import your mock questions. Zero AI credits used."
        action={
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="rounded-full px-5 gap-2 text-xs font-medium"
          >
            <Plus className="h-4 w-4" />
            <span>New Practice Set</span>
          </Button>
        }
      />

      {/* Figures — Symmetrical 4-stat grid matching Progress */}
      <StatGrid className="grid-cols-2 md:grid-cols-4">
        <Stat label="Practice Sets" value={sets.length} hint="Interactive study sets" />
        <Stat label="Questions Tested" value={stats.totalQuestionsAnswered} hint={`${stats.totalAttempts} sessions taken`} />
        <Stat label="Average Score" value={stats.averageScorePercentage ? `${stats.averageScorePercentage}%` : "—"} hint="Across all quizzes" />
        <Stat
          label="Accuracy"
          value={stats.totalQuestionsAnswered ? `${Math.round((stats.totalCorrect / stats.totalQuestionsAnswered) * 100)}%` : "—"}
          hint={`${stats.totalCorrect} correct answers`}
        />
      </StatGrid>

      {/* GitHub-style Practice Activity Heatmap */}
      <Panel title="Practice Activity" action={<span className="eyebrow">Study questions</span>}>
        <PracticeHeatmap key={heatmapKey} weeks={20} />
      </Panel>

      {/* Practice Sets List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <h3 className="eyebrow text-foreground">Your Practice Sets ({sets.length})</h3>
          <span className="text-xs text-muted-foreground font-mono">
            Grounded in your source materials
          </span>
        </div>

        {sets.length === 0 ? (
          <Empty
            title="No practice sets yet."
            body="Upload lecture notes, a PDF, or a Word document to generate an interactive practice test grounded in your course materials."
            action={
              <Button onClick={() => setIsCreateOpen(true)} className="rounded-full px-6 gap-2">
                <Plus className="h-4 w-4" />
                <span>Create Practice Set</span>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {sets.map((set) => {
              const bestPct = set.bestScore?.percentage;
              return (
                <div
                  key={set.id}
                  className="group relative border border-border/70 hover:border-foreground/30 bg-card rounded-2xl p-5 sm:p-6 transition-all space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wider">
                        {set.questions.length} Questions
                      </Badge>

                      <div className="flex items-center gap-2">
                        {bestPct !== undefined && (
                          <span
                            className={cn(
                              "text-xs font-mono font-semibold px-2 py-0.5 rounded-full border",
                              bestPct >= 80
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                : bestPct >= 60
                                ? "bg-secondary text-foreground border-border"
                                : "bg-destructive/10 text-destructive border-destructive/30"
                            )}
                          >
                            Best: {bestPct}%
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, set.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive rounded transition-all"
                          title="Delete set"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="text-lg font-serif font-medium leading-snug text-foreground">
                      {set.title}
                    </h4>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <BookOpen className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                      <span className="truncate">{set.sourceName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                    <Button
                      size="sm"
                      onClick={() => handleStartQuiz(set)}
                      className="flex-1 rounded-full gap-1.5 text-xs h-9"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>Take Quiz</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStartFlashcards(set)}
                      className="rounded-full gap-1.5 text-xs h-9"
                      title="Study with Flashcards"
                    >
                      <Layers className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Flashcards</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Creation Dialog */}
      <PracticeCreateDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        books={books}
        onSetCreated={handleSetCreated}
      />
    </div>
  );
}

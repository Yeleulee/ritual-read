import { useState } from "react";
import type { PracticeQuestion, PracticeSet } from "@/types/practice";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stat, StatGrid } from "@/components/dashboard/primitives";
import {
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Quote,
  Lightbulb,
  Sparkles,
  Layers,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuizResultsProps {
  practiceSet: PracticeSet;
  attempt: {
    answers: Record<string, string>;
    score: number;
    total: number;
    percentage: number;
    timeSpentSeconds: number;
  };
  onRetake: () => void;
  onRetakeMissed?: (missedQuestions: PracticeQuestion[]) => void;
  onStudyFlashcards: () => void;
  onBackToHub: () => void;
}

export function QuizResults({
  practiceSet,
  attempt,
  onRetake,
  onRetakeMissed,
  onStudyFlashcards,
  onBackToHub,
}: QuizResultsProps) {
  const [filter, setFilter] = useState<"all" | "incorrect" | "correct">("all");

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  const getMasteryGrade = (pct: number) => {
    if (pct >= 90) return { label: "Mastery", color: "text-emerald-600 dark:text-emerald-400" };
    if (pct >= 75) return { label: "Proficient", color: "text-primary" };
    if (pct >= 60) return { label: "Passing", color: "text-foreground" };
    return { label: "Review Recommended", color: "text-destructive" };
  };

  const mastery = getMasteryGrade(attempt.percentage);

  const questions = Array.isArray(practiceSet?.questions) ? practiceSet.questions : [];
  const answersMap = attempt?.answers ?? {};

  const evaluatedQuestions = questions.map((q) => {
    const userAns = answersMap[q.id];
    const isCorrect =
      !!userAns &&
      (userAns.toLowerCase().trim() === (q.correctAnswer ?? "").toLowerCase().trim() ||
        userAns.toLowerCase().trim() === (q.correctAnswer ?? "").toLowerCase().slice(0, 1).trim() ||
        userAns === "Correct");
    return { ...q, userAns, isCorrect };
  });

  const missedQuestions = evaluatedQuestions.filter((q) => !q.isCorrect);

  const displayedQuestions = evaluatedQuestions.filter((q) => {
    if (filter === "incorrect") return !q.isCorrect;
    if (filter === "correct") return q.isCorrect;
    return true;
  });

  // Group missed concepts for targeted improvement summary
  const missedTopics = Array.from(
    new Set(missedQuestions.map((q) => q.topic || practiceSet.title))
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-page-fade">
      {/* Header Back */}
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <Button variant="ghost" size="sm" onClick={onBackToHub} className="gap-2 text-xs -ml-2">
          <ArrowLeft className="h-4 w-4" />
          <span>Practice Sets</span>
        </Button>
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
          {practiceSet.title}
        </span>
      </div>

      {/* Hero Score Card */}
      <div className="border border-border bg-card rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-sm">
        <p className="eyebrow">Session Summary</p>
        <div className="space-y-1">
          <div className="display text-5xl sm:text-6xl text-foreground font-serif">
            {attempt.percentage}%
          </div>
          <p className={cn("text-sm font-mono uppercase tracking-wider font-semibold", mastery.color)}>
            {mastery.label}
          </p>
        </div>

        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          You answered {attempt.score} out of {attempt.total} questions correctly in {formatTime(attempt.timeSpentSeconds)}.
        </p>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Button onClick={onRetake} variant="outline" className="rounded-full gap-2 text-xs">
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Retake Full Set</span>
          </Button>

          {missedQuestions.length > 0 && onRetakeMissed && (
            <Button
              onClick={() => onRetakeMissed(missedQuestions)}
              className="rounded-full gap-2 text-xs bg-destructive/90 hover:bg-destructive text-destructive-foreground"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Retry {missedQuestions.length} Missed</span>
            </Button>
          )}

          <Button onClick={onStudyFlashcards} variant="secondary" className="rounded-full gap-2 text-xs">
            <Layers className="h-3.5 w-3.5" />
            <span>Review as Flashcards</span>
          </Button>
        </div>
      </div>

      {/* Quick Mistake Improvement Summary (Requested: quick summary so student can improve) */}
      {missedQuestions.length > 0 ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.04] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-destructive font-serif text-lg font-medium">
              <AlertTriangle className="h-5 w-5" />
              <span>Mistake Analysis & Improvement Plan</span>
            </div>
            <Badge variant="outline" className="border-destructive/40 text-destructive text-[10px] font-mono uppercase">
              {missedQuestions.length} to review
            </Badge>
          </div>

          <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">
            Review the key concepts below to bridge your knowledge gaps before your next attempt. Focus particularly on:{" "}
            <strong>{missedTopics.join(", ")}</strong>.
          </p>

          <div className="space-y-2.5 pt-1">
            {missedQuestions.map((q, idx) => (
              <div
                key={q.id}
                className="bg-background/90 rounded-xl p-3.5 border border-destructive/20 text-xs space-y-1.5 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-foreground/80">Point #{idx + 1}: {q.topic || "Core Concept"}</span>
                  <span className="text-destructive font-mono text-[10px] uppercase">Missed</span>
                </div>
                <p className="text-foreground/90 font-medium">"{q.question}"</p>
                <div className="text-[11px] text-muted-foreground flex items-baseline gap-1.5 pt-0.5">
                  <span className="text-destructive font-mono uppercase">Your choice:</span>
                  <span className="line-through">{q.userAns || "None"}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono uppercase font-semibold">Correct:</span>
                  <span className="font-semibold text-foreground">{q.correctAnswer}</span>
                </div>
                <p className="text-[11px] text-foreground/80 leading-snug bg-muted/30 p-2 rounded-lg border border-border/30">
                  <span className="font-semibold text-foreground/90">Takeaway: </span>
                  {q.explanation}
                </p>
              </div>
            ))}
          </div>

          {onRetakeMissed && (
            <div className="pt-2 flex justify-end">
              <Button
                size="sm"
                onClick={() => onRetakeMissed(missedQuestions)}
                className="rounded-full gap-1.5 text-xs h-8 px-4"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Drill These {missedQuestions.length} Questions Now</span>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.05] p-5 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 font-serif text-lg font-medium">
            <CheckCircle2 className="h-5 w-5" />
            <span>Flawless Recall</span>
          </div>
          <p className="text-xs sm:text-sm text-foreground/85 max-w-md mx-auto">
            You achieved 100% accuracy with zero mistakes. Your understanding of this material is solid and exam-ready.
          </p>
        </div>
      )}

      {/* Stats Breakdown */}
      <StatGrid className="grid-cols-3">
        <Stat label="Correct" value={`${attempt.score}`} hint="Accurate answers" />
        <Stat label="Missed" value={`${attempt.total - attempt.score}`} hint="Needs review" />
        <Stat label="Pace" value={`${Math.round(attempt.timeSpentSeconds / attempt.total)}s`} hint="Avg per question" />
      </StatGrid>

      {/* Review Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <h3 className="text-lg font-serif font-medium">Question Review</h3>
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/40 text-xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn("px-2.5 py-1 rounded-md transition-colors", filter === "all" ? "bg-background shadow-xs font-medium" : "text-muted-foreground")}
            >
              All ({evaluatedQuestions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("incorrect")}
              className={cn("px-2.5 py-1 rounded-md transition-colors", filter === "incorrect" ? "bg-background shadow-xs font-medium text-destructive" : "text-muted-foreground")}
            >
              Missed ({missedQuestions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("correct")}
              className={cn("px-2.5 py-1 rounded-md transition-colors", filter === "correct" ? "bg-background shadow-xs font-medium text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}
            >
              Correct ({attempt.score})
            </button>
          </div>
        </div>

        {/* Question cards list */}
        <div className="space-y-4">
          {displayedQuestions.map((q, idx) => (
            <div
              key={q.id}
              className={cn(
                "border rounded-xl p-5 space-y-3.5 transition-all bg-card/60",
                q.isCorrect ? "border-emerald-500/20" : "border-destructive/30"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    #{idx + 1}
                  </span>
                  {q.isCorrect ? (
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 gap-1 text-[10px] font-mono">
                      <CheckCircle2 className="h-3 w-3" /> Correct
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-destructive/40 text-destructive gap-1 text-[10px] font-mono">
                      <XCircle className="h-3 w-3" /> Missed
                    </Badge>
                  )}
                </div>
                {q.topic && (
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {q.topic}
                  </span>
                )}
              </div>

              <h4 className="text-base font-serif font-medium leading-relaxed">
                {q.question}
              </h4>

              {/* Answers comparison */}
              <div className="text-xs space-y-1.5 pt-1">
                {q.userAns && !q.isCorrect && (
                  <div className="flex items-baseline gap-2 text-destructive">
                    <span className="font-mono uppercase font-semibold">Your choice:</span>
                    <span>{q.userAns}</span>
                  </div>
                )}
                <div className="flex items-baseline gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="font-mono uppercase">Correct Answer:</span>
                  <span>{q.correctAnswer}</span>
                </div>
              </div>

              {/* Explanation */}
              <div className="bg-muted/40 rounded-lg p-3 text-xs leading-relaxed border border-border/50 text-foreground/85 space-y-1">
                <div className="flex items-center gap-1 text-muted-foreground font-mono text-[10px] uppercase">
                  <Lightbulb className="h-3 w-3 text-streak" />
                  <span>Explanation</span>
                </div>
                <p>{q.explanation}</p>
              </div>

              {/* Source excerpt if available */}
              {q.sourceExcerpt && (
                <div className="bg-primary/[0.03] rounded-lg p-3 text-xs border border-primary/20 text-foreground/80 space-y-1">
                  <div className="flex items-center gap-1 text-primary font-mono text-[10px] uppercase">
                    <Quote className="h-3 w-3" />
                    <span>Evidence From Material</span>
                  </div>
                  <blockquote className="italic font-serif pl-2 border-l border-primary/40">
                    "{q.sourceExcerpt}"
                  </blockquote>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

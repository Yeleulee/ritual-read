import { useState, useEffect } from "react";
import type { PracticeQuestion, PracticeSet } from "@/types/practice";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rule } from "@/components/dashboard/primitives";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  Bookmark,
  BookmarkCheck,
  Quote,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuizPlayerProps {
  practiceSet: PracticeSet;
  onFinish: (attempt: {
    answers: Record<string, string>;
    score: number;
    total: number;
    percentage: number;
    timeSpentSeconds: number;
  }) => void;
  onBack: () => void;
}

export function QuizPlayer({ practiceSet, onFinish, onBack }: QuizPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, boolean>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [instantFeedback, setInstantFeedback] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [startTime] = useState(Date.now());
  const [timeSpent, setTimeSpent] = useState(0);

  const questions = Array.isArray(practiceSet?.questions) ? practiceSet.questions : [];
  const currentQ = questions[currentIndex];
  const total = questions.length;

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleSelectOption = (optionId: string) => {
    if (submittedAnswers[currentQ.id] && instantFeedback) return;
    setSelectedAnswers((prev) => ({ ...prev, [currentQ.id]: optionId }));
  };

  const handleCheckAnswer = () => {
    if (currentQ.options && currentQ.options.length > 0 && !selectedAnswers[currentQ.id]) return;
    setSubmittedAnswers((prev) => ({ ...prev, [currentQ.id]: true }));
  };

  const toggleFlag = () => {
    setFlaggedQuestions((prev) => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }));
  };

  const handleNext = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      finishQuiz();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
  };

  const isAnswerCorrect = (q: PracticeQuestion, userAns?: string) =>
    !!userAns &&
    (userAns === "Correct" ||
      userAns.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim() ||
      (q.options && q.options.length > 0 && userAns.toLowerCase().trim() === q.correctAnswer.toLowerCase().slice(0, 1).trim()));

  const finishQuiz = () => {
    let score = 0;
    questions.forEach((q) => {
      if (isAnswerCorrect(q, selectedAnswers[q.id])) score += 1;
    });

    const percentage = Math.round((score / total) * 100);
    onFinish({
      answers: selectedAnswers,
      score,
      total,
      percentage,
      timeSpentSeconds: timeSpent,
    });
  };

  if (!currentQ) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 space-y-4">
        <p className="text-sm text-muted-foreground">No questions available in this practice set.</p>
        <Button variant="outline" size="sm" onClick={onBack}>Back to Practice Sets</Button>
      </div>
    );
  }

  const hasOptions = !!(currentQ.options && currentQ.options.length > 0);
  const currentSelection = selectedAnswers[currentQ.id];
  const isCorrect = isAnswerCorrect(currentQ, currentSelection);

  const answeredCount = Object.keys(selectedAnswers).length;
  const progressPercent = Math.round(((currentIndex + 1) / total) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-page-fade">
      {/* Top Bar with set title, progress and timer */}
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-xs -ml-2">
          <ArrowLeft className="h-4 w-4" />
          <span>Exit Practice</span>
        </Button>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {formatTimer(timeSpent)}
          </span>
          <span className="h-3 w-px bg-border" />
          <button
            type="button"
            onClick={toggleFlag}
            className={cn(
              "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors border",
              flaggedQuestions[currentQ.id]
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {flaggedQuestions[currentQ.id] ? (
              <BookmarkCheck className="h-3.5 w-3.5" />
            ) : (
              <Bookmark className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {flaggedQuestions[currentQ.id] ? "Flagged" : "Flag"}
            </span>
          </button>
        </div>
      </div>

      {/* Question Header & Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-3">
            <p className="eyebrow">
              Question {currentIndex + 1} of {total}
            </p>
            {total >= 10 && (
              <button
                type="button"
                onClick={() => setShowGrid(!showGrid)}
                className="text-[11px] font-mono text-primary hover:underline cursor-pointer"
              >
                {showGrid ? "Hide Grid" : "Question Grid ▾"}
              </button>
            )}
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {answeredCount} of {total} answered
          </span>
        </div>
        <Rule value={progressPercent} />

        {/* 100-Question Quick Jump Matrix */}
        {showGrid && (
          <div className="p-3.5 border rounded-xl bg-card/70 space-y-2.5 mt-2 animate-in fade-in-50">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground">
              <span>Exam Navigator (Click to Jump)</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Answered
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Flagged
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full border border-border inline-block" /> Open
                </span>
              </div>
            </div>
            <div className="grid grid-cols-10 sm:grid-cols-20 gap-1 max-h-48 overflow-y-auto pr-1">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered = !!selectedAnswers[q.id];
                const isFlagged = !!flaggedQuestions[q.id];
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      setShowGrid(false);
                    }}
                    className={cn(
                      "h-7 rounded text-[11px] font-mono font-medium transition-all flex items-center justify-center relative",
                      isCurrent
                        ? "bg-foreground text-background font-bold ring-2 ring-primary ring-offset-1"
                        : isAnswered
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted border border-border/50",
                    )}
                  >
                    {idx + 1}
                    {isFlagged && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main Question Card */}
      <div className="border border-border/80 bg-card rounded-xl p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="space-y-2">
          {currentQ.topic && (
            <Badge variant="outline" className="text-[10px] tracking-wider uppercase font-mono py-0.5">
              {currentQ.topic}
            </Badge>
          )}
          <h2 className="text-xl sm:text-2xl font-serif font-medium leading-relaxed text-foreground">
            {currentQ.question}
          </h2>
        </div>

        {/* Options */}
        <div className="space-y-3 pt-2">
          {currentQ.options && currentQ.options.length > 0 ? (
            currentQ.options.map((opt) => {
              const isSelected = currentSelection === opt.id;
              const isOptionCorrect =
                opt.id.toLowerCase().trim() === currentQ.correctAnswer.toLowerCase().trim() ||
                opt.id.toLowerCase().trim() === currentQ.correctAnswer.toLowerCase().slice(0, 1).trim();

              let stateStyle = "border-border/60 hover:border-foreground/30 hover:bg-muted/30";

              if (instantFeedback && submittedAnswers[currentQ.id]) {
                if (isOptionCorrect) {
                  stateStyle = "border-emerald-500/60 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 font-medium";
                } else if (isSelected && !isOptionCorrect) {
                  stateStyle = "border-destructive/60 bg-destructive/10 text-destructive";
                } else {
                  stateStyle = "border-border/40 opacity-50";
                }
              } else if (isSelected) {
                stateStyle = "border-foreground bg-primary/5 text-foreground ring-1 ring-foreground/20 font-medium";
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectOption(opt.id)}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3.5",
                    stateStyle
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-semibold transition-colors",
                      isSelected
                        ? "border-foreground bg-foreground text-background"
                        : "border-border/80 bg-muted/40 text-muted-foreground"
                    )}
                  >
                    {opt.id}
                  </span>
                  <div className="flex-1 pt-0.5 text-sm sm:text-base leading-relaxed">
                    {opt.text}
                  </div>
                  {instantFeedback && submittedAnswers[currentQ.id] && isOptionCorrect && (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  {instantFeedback && submittedAnswers[currentQ.id] && isSelected && !isOptionCorrect && (
                    <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  )}
                </button>
              );
            })
          ) : (
            /* Short Answer / Open-ended Question */
            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-border/60 bg-muted/30 text-sm">
                <p className="text-muted-foreground italic">
                  Recall or write down your answer, then click &ldquo;Reveal Answer&rdquo; below to check yourself.
                </p>
              </div>
              {submittedAnswers[currentQ.id] && (
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={currentSelection === "Correct" ? "default" : "outline"}
                    onClick={() => setSelectedAnswers((prev) => ({ ...prev, [currentQ.id]: "Correct" }))}
                    className="flex-1 rounded-xl text-xs gap-1.5"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>I Got It Right</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={currentSelection === "Missed" ? "destructive" : "outline"}
                    onClick={() => setSelectedAnswers((prev) => ({ ...prev, [currentQ.id]: "Missed" }))}
                    className="flex-1 rounded-xl text-xs gap-1.5"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>I Missed This</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Immediate Explanation & Exact Study Material Citation */}
        {instantFeedback && submittedAnswers[currentQ.id] && (
          <div className="mt-6 border-t border-border/70 pt-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {hasOptions ? (
              <div className="flex items-center gap-2">
                {isCorrect ? (
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Correct!</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-destructive font-medium text-sm">
                    <XCircle className="h-4 w-4" />
                    <span>Incorrect. The correct answer is {currentQ.correctAnswer}.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm font-medium text-foreground">
                <span className="font-mono text-xs uppercase text-muted-foreground mr-2">Answer:</span>
                <span>{currentQ.correctAnswer}</span>
              </div>
            )}

            {/* Explanation */}
            <div className="bg-muted/40 rounded-xl p-4 border border-border/50 text-sm leading-relaxed space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                <span>Explanation</span>
              </div>
              <p className="text-foreground/90">{currentQ.explanation}</p>
            </div>

            {/* Direct Citation Excerpt from Material */}
            {currentQ.sourceExcerpt && (
              <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4 text-xs sm:text-sm text-foreground/85">
                <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-primary mb-1.5">
                  <Quote className="h-3 w-3" />
                  <span>Verified Study Material Excerpt</span>
                </div>
                <blockquote className="italic font-serif text-foreground/90 border-l-2 border-primary/40 pl-3 py-0.5">
                  "{currentQ.sourceExcerpt}"
                </blockquote>
              </div>
            )}
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="gap-1.5 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Previous</span>
          </Button>

          <div className="flex items-center gap-2">
            {instantFeedback && !submittedAnswers[currentQ.id] && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheckAnswer}
                disabled={hasOptions && !currentSelection}
                className="text-xs px-4"
              >
                {hasOptions ? "Check Answer" : "Reveal Answer"}
              </Button>
            )}

            <Button
              size="sm"
              onClick={handleNext}
              className="gap-1.5 text-xs px-5 rounded-full"
            >
              <span>{currentIndex === total - 1 ? "Complete Quiz" : "Next"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

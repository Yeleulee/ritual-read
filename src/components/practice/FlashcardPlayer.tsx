import { useState } from "react";
import type { PracticeQuestion, PracticeSet } from "@/types/practice";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rule } from "@/components/dashboard/primitives";
import { ArrowLeft, RotateCw, Check, X, Quote, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlashcardPlayerProps {
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

export function FlashcardPlayer({ practiceSet, onFinish, onBack }: FlashcardPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [startTime] = useState(Date.now());

  const questions = Array.isArray(practiceSet?.questions) ? practiceSet.questions : [];
  const currentQ = questions[currentIndex];
  const total = questions.length;

  if (!currentQ) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 space-y-4">
        <p className="text-sm text-muted-foreground">No flashcards available in this practice set.</p>
        <Button variant="outline" size="sm" onClick={onBack}>Back to Practice Sets</Button>
      </div>
    );
  }

  const handleFlip = () => setIsFlipped((prev) => !prev);

  const handleRate = (passed: boolean) => {
    const updatedResults = { ...results, [currentQ.id]: passed };
    setResults(updatedResults);
    setIsFlipped(false);

    if (currentIndex < total - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      const correctCount = Object.values(updatedResults).filter(Boolean).length;
      const percentage = Math.round((correctCount / total) * 100);
      const timeSpentSeconds = Math.floor((Date.now() - startTime) / 1000);
      onFinish({
        answers: Object.fromEntries(
          Object.entries(updatedResults).map(([k, v]) => [k, v ? "Correct" : "Again"])
        ),
        score: correctCount,
        total,
        percentage,
        timeSpentSeconds,
      });
    }
  };

  const progressPercent = Math.round(((currentIndex + 1) / total) * 100);

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-page-fade">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-xs -ml-2">
          <ArrowLeft className="h-4 w-4" />
          <span>Exit Flashcards</span>
        </Button>
        <span className="font-mono text-xs text-muted-foreground">
          Card {currentIndex + 1} of {total}
        </span>
      </div>

      <Rule value={progressPercent} />

      {/* 3D Flip Card Container */}
      <div
        onClick={handleFlip}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleFlip();
          }
        }}
        className={cn(
          "min-h-[380px] w-full rounded-2xl border border-border/80 bg-card p-8 flex flex-col justify-between shadow-sm cursor-pointer select-none transition-all duration-300 hover:border-foreground/40",
          isFlipped ? "bg-card/95" : "bg-card"
        )}
      >
        {/* Card Header */}
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="font-mono text-[10px] uppercase">
            {isFlipped ? "Verified Answer" : currentQ.topic || "Question"}
          </Badge>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RotateCw className="h-3 w-3" />
            <span>Click to flip</span>
          </div>
        </div>

        {/* Card Center Content */}
        <div className="py-8 my-auto text-center space-y-4">
          {!isFlipped ? (
            <h2 className="text-xl sm:text-2xl font-serif leading-relaxed text-foreground/90">
              {currentQ.question}
            </h2>
          ) : (
            <div className="space-y-4 text-left">
              <div className="text-lg font-serif text-foreground font-medium">
                {currentQ.correctAnswer}
              </div>
              <div className="text-sm text-foreground/85 leading-relaxed bg-muted/40 p-4 rounded-xl border border-border/40">
                <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase text-muted-foreground mb-1">
                  <Lightbulb className="h-3 w-3 text-streak" />
                  <span>Explanation</span>
                </div>
                {currentQ.explanation}
              </div>
              {currentQ.sourceExcerpt && (
                <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-3.5 text-xs text-foreground/80">
                  <div className="flex items-center gap-1 text-[10px] font-mono uppercase text-primary mb-1">
                    <Quote className="h-2.5 w-2.5" />
                    <span>From Study Material</span>
                  </div>
                  <blockquote className="italic font-serif pl-2 border-l border-primary/40">
                    "{currentQ.sourceExcerpt}"
                  </blockquote>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card Footer Hint */}
        <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border/40">
          {!isFlipped ? "Try recalling before revealing" : "Rate how well you knew this"}
        </div>
      </div>

      {/* Response Action Buttons (Visible after flip) */}
      <div className="flex items-center justify-center gap-4 pt-2">
        {!isFlipped ? (
          <Button onClick={handleFlip} className="rounded-full px-8 gap-2">
            <RotateCw className="h-4 w-4" />
            <span>Reveal Answer</span>
          </Button>
        ) : (
          <div className="flex items-center gap-4 w-full">
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                handleRate(false);
              }}
              className="flex-1 rounded-xl h-12 border-destructive/40 text-destructive hover:bg-destructive/10 gap-2"
            >
              <X className="h-4 w-4" />
              <span>Study Again</span>
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleRate(true);
              }}
              className="flex-1 rounded-xl h-12 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Check className="h-4 w-4" />
              <span>I Knew This</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

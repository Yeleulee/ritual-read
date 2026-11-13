import { useState, useRef } from "react";
import type { BookItem } from "@/hooks/use-books";
import type { PracticeQuestion, PracticeSet } from "@/types/practice";
import {
  extractTextFromFile,
  extractTextFromBook,
  generatePracticeQuestions,
  createPracticeSet,
} from "@/lib/practice-generator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Upload,
  BookOpen,
  FileText,
  Loader2,
  Sparkles,
  Check,
  FileQuestion,
  HelpCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface PracticeCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  books: BookItem[];
  onSetCreated: (set: PracticeSet) => void;
}

export function PracticeCreateDialog({
  open,
  onOpenChange,
  books,
  onSetCreated,
}: PracticeCreateDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"upload" | "library" | "mock">("upload");
  const [title, setTitle] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<string>("");
  const [mockText, setMockText] = useState("");
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [questionType, setQuestionType] = useState<"multiple-choice" | "true-false" | "mixed" | "flashcard">("multiple-choice");
  const mockFileInputRef = useRef<HTMLInputElement>(null);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [topicFocus, setTopicFocus] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>("");

  const resetForm = () => {
    setTitle("");
    setUploadedFile(null);
    setSelectedBookId("");
    setMockText("");
    setQuestionCount(10);
    setTopicFocus("");
    setIsGenerating(false);
    setLoadingStep("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, "") + " Practice");
      }
    }
  };

  const handleMockFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const extracted = await extractTextFromFile(file);
      setMockText(extracted);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, "") + " Mock");
      }
      toast({ title: "Mock questions loaded", description: `Imported text from ${file.name}` });
    } catch (err) {
      toast({
        title: "Could not read file",
        description: err instanceof Error ? err.message : "Unsupported file",
        variant: "destructive",
      });
    } finally {
      if (mockFileInputRef.current) mockFileInputRef.current.value = "";
    }
  };

  const handleBookSelect = (book: BookItem) => {
    setSelectedBookId(book.id);
    if (!title) {
      setTitle(`${book.title} Practice`);
    }
  };

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      let materialText = "";
      let sourceName = "";
      let sourceType: PracticeSet["sourceType"] = "uploaded-doc";
      let associatedBookId: string | undefined;

      if (activeTab === "upload") {
        if (!uploadedFile) {
          toast({ title: "Please upload a document", variant: "destructive" });
          setIsGenerating(false);
          return;
        }
        setLoadingStep("Extracting text from document...");
        materialText = await extractTextFromFile(uploadedFile);
        sourceName = uploadedFile.name;
        sourceType = "uploaded-doc";
      } else if (activeTab === "library") {
        const book = books.find((b) => b.id === selectedBookId);
        if (!book) {
          toast({ title: "Please choose a volume from your library", variant: "destructive" });
          setIsGenerating(false);
          return;
        }
        setLoadingStep(`Reading "${book.title}"...`);
        materialText = await extractTextFromBook(book);
        sourceName = book.title;
        sourceType = "library-book";
        associatedBookId = book.id;
      } else if (activeTab === "mock") {
        if (!mockText.trim()) {
          toast({ title: "Please paste your mock questions", variant: "destructive" });
          setIsGenerating(false);
          return;
        }
        sourceName = title || "Custom Mock Exam";
        sourceType = "mock-questions";
        if (selectedBookId) {
          const book = books.find((b) => b.id === selectedBookId);
          if (book) {
            try {
              materialText = await extractTextFromBook(book);
            } catch {
              /* ignore */
            }
          }
        }
      }

      setLoadingStep("Generating strictly grounded questions...");

      const questions = await generatePracticeQuestions({
        materialText,
        materialTitle: sourceName,
        mockQuestionsText: activeTab === "mock" ? mockText : undefined,
        questionCount,
        questionType,
        difficulty,
        topicFocus: topicFocus.trim() || undefined,
      });

      if (!questions || questions.length === 0) {
        throw new Error("No practice questions could be generated. Check your document contents.");
      }

      const finalTitle = title.trim() || `${sourceName} Practice`;
      const practiceSet = createPracticeSet(
        finalTitle,
        sourceType,
        sourceName,
        questions,
        associatedBookId
      );

      toast({
        title: "Practice Set Created",
        description: `Ready with ${questions.length} verified questions.`,
      });

      onSetCreated(practiceSet);
      onOpenChange(false);
      resetForm();
    } catch (err) {
      console.error("Practice generation error:", err);
      toast({
        title: "Generation Failed",
        description: err instanceof Error ? err.message : "Could not generate questions.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setLoadingStep("");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isGenerating) {
          onOpenChange(v);
          if (!v) resetForm();
        }
      }}
    >
      <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto p-5 sm:p-7 gap-5">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border/60">
              Student Prep
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
              Grounded in Material · Zero AI Credits
            </span>
          </div>
          <DialogTitle className="text-2xl sm:text-[26px] font-serif font-normal tracking-tight text-foreground">
            Create Practice Set
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Generate quiz questions strictly grounded in your lecture notes, PDFs, or books — or convert custom mock tests.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Practice Set Name & Optional Topic Focus (Balanced 2-Column Row) */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div className={cn("space-y-1.5", activeTab === "mock" ? "sm:col-span-5" : "sm:col-span-3")}>
              <Label htmlFor="set-title" className="text-xs font-medium text-foreground/90">
                Practice set name
              </Label>
              <Input
                id="set-title"
                placeholder="e.g. Biology Midterm Review"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-9 text-xs rounded-xl bg-muted/20 border-border/70 focus-visible:ring-1 focus-visible:ring-streak/30 focus-visible:border-streak"
              />
            </div>
            {activeTab !== "mock" && (
              <div className="sm:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="topic-focus" className="text-xs font-medium text-foreground/90">
                    Topic / Chapter
                  </Label>
                  <span className="text-[10px] text-muted-foreground">optional</span>
                </div>
                <Input
                  id="topic-focus"
                  placeholder="e.g. Chapter 4"
                  value={topicFocus}
                  onChange={(e) => setTopicFocus(e.target.value)}
                  className="h-9 text-xs rounded-xl bg-muted/20 border-border/70 focus-visible:ring-1 focus-visible:ring-streak/30 focus-visible:border-streak"
                />
              </div>
            )}
          </div>

          {/* Source Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "upload" | "library" | "mock")} className="w-full">
            <TabsList className="grid grid-cols-3 w-full h-9 p-1 bg-muted/40 rounded-xl border border-border/60">
              <TabsTrigger value="upload" className="text-xs gap-1.5 rounded-lg py-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload File</span>
              </TabsTrigger>
              <TabsTrigger value="library" className="text-xs gap-1.5 rounded-lg py-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
                <BookOpen className="h-3.5 w-3.5" />
                <span>From Library</span>
              </TabsTrigger>
              <TabsTrigger value="mock" className="text-xs gap-1.5 rounded-lg py-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
                <FileQuestion className="h-3.5 w-3.5" />
                <span>Mock Questions</span>
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Upload Document */}
            <TabsContent value="upload" className="mt-3 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.text,.md,.pptx,.epub"
                onChange={handleFileChange}
                className="hidden"
                id="practice-file-upload"
              />
              <label
                htmlFor="practice-file-upload"
                className={cn(
                  "group border border-dashed rounded-xl p-4 sm:p-4.5 flex items-center gap-4 cursor-pointer transition-all duration-150",
                  uploadedFile
                    ? "border-streak/60 bg-streak/[0.04]"
                    : "border-border/70 bg-muted/15 hover:border-streak/40 hover:bg-muted/30"
                )}
              >
                <div
                  className={cn(
                    "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center border transition-colors",
                    uploadedFile
                      ? "bg-streak/10 border-streak/30 text-streak"
                      : "bg-background border-border/70 text-muted-foreground group-hover:text-foreground"
                  )}
                >
                  {uploadedFile ? <FileText className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  {uploadedFile ? (
                    <>
                      <p className="text-xs font-medium text-foreground truncate">{uploadedFile.name}</p>
                      <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB · Click to choose different file
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-medium text-foreground">
                        Drop lecture notes, syllabus, or reading material
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        PDF, EPUB, Word (DOCX), PowerPoint (PPTX), TXT, Markdown
                      </p>
                    </>
                  )}
                </div>
              </label>
            </TabsContent>

            {/* Tab 2: Choose from Library */}
            <TabsContent value="library" className="mt-3 space-y-2">
              {books.length === 0 ? (
                <div className="border border-dashed border-border/70 p-5 rounded-xl text-center text-xs text-muted-foreground bg-muted/15">
                  Your library is currently empty. Upload a file above or add a book to your library first.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {books.map((b) => {
                    const isSelected = selectedBookId === b.id;
                    return (
                      <div
                        key={b.id}
                        onClick={() => handleBookSelect(b)}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-xl border text-left cursor-pointer transition-all",
                          isSelected
                            ? "border-streak/60 bg-streak/5 text-foreground ring-1 ring-streak/20"
                            : "border-border/60 hover:border-border hover:bg-muted/30"
                        )}
                      >
                        <div className="h-9 w-7 shrink-0 bg-muted rounded border border-border/40 overflow-hidden flex items-center justify-center">
                          {b.coverUrl ? (
                            <img src={b.coverUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{b.title}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{b.author || "Unknown author"}</p>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 text-streak shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Tab 3: Paste / Import Mock Questions */}
            <TabsContent value="mock" className="mt-3 space-y-2">
              <div className="bg-muted/20 border border-border/50 rounded-xl p-3 text-xs text-muted-foreground flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <HelpCircle className="h-4 w-4 shrink-0 text-streak" />
                  <p className="truncate">
                    Converts <strong>your exact questions</strong> without generating new ones.
                  </p>
                </div>
                <input
                  ref={mockFileInputRef}
                  type="file"
                  accept=".txt,.text,.md,.docx,.pdf"
                  onChange={handleMockFileChange}
                  className="hidden"
                  id="mock-file-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => mockFileInputRef.current?.click()}
                  className="shrink-0 h-7 text-[11px] gap-1.5 rounded-lg px-2.5"
                >
                  <Upload className="h-3 w-3" />
                  <span>Load File</span>
                </Button>
              </div>
              <Textarea
                placeholder="Paste mock questions here:&#10;1. What is the powerhouse of the cell?&#10;A) Ribosome&#10;B) Mitochondria&#10;C) Nucleus&#10;D) Endoplasmic Reticulum&#10;Answer: B"
                value={mockText}
                onChange={(e) => setMockText(e.target.value)}
                rows={5}
                className="font-mono text-xs leading-relaxed rounded-xl bg-muted/20 border-border/70"
              />
            </TabsContent>
          </Tabs>

          {/* Configuration Options (When generating from material) */}
          {activeTab !== "mock" && (
            <div className="space-y-3.5 pt-1 border-t border-border/50">
              {/* Question Format & Difficulty (Side-by-Side Grid) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Format */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground/90">
                    Question format
                  </Label>
                  <div className="bg-muted/40 p-1 rounded-xl flex gap-1 border border-border/50">
                    {[
                      { id: "multiple-choice", label: "MCQ" },
                      { id: "true-false", label: "T / F" },
                      { id: "mixed", label: "Mixed" },
                      { id: "flashcard", label: "Cards" },
                    ].map((fmt) => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setQuestionType(fmt.id as typeof questionType)}
                        className={cn(
                          "flex-1 py-1.5 px-1.5 rounded-lg text-xs font-medium transition-all text-center",
                          questionType === fmt.id
                            ? "bg-background text-foreground shadow-xs border border-border/70 font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                        )}
                      >
                        {fmt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground/90">
                    Difficulty level
                  </Label>
                  <div className="bg-muted/40 p-1 rounded-xl flex gap-1 border border-border/50">
                    {(["easy", "medium", "hard"] as const).map((diff) => (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => setDifficulty(diff)}
                        className={cn(
                          "flex-1 py-1.5 px-2 rounded-lg text-xs capitalize font-medium transition-all text-center",
                          difficulty === diff
                            ? "bg-background text-foreground shadow-xs border border-border/70 font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                        )}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Number of Questions */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-foreground/90">
                    Question count
                  </Label>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {questionCount === 100 ? (
                      <span className="inline-flex items-center gap-1 text-streak font-medium">
                        <Sparkles className="w-3 h-3" /> Full 100-Question Exam
                      </span>
                    ) : (
                      `${questionCount} questions`
                    )}
                  </span>
                </div>
                <div className="bg-muted/40 p-1 rounded-xl flex gap-1 border border-border/50">
                  {[5, 10, 20, 50, 100].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setQuestionCount(num)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs font-mono font-medium transition-all text-center",
                        questionCount === num
                          ? "bg-background text-foreground shadow-xs border border-border/70 font-semibold text-streak"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                      )}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full h-11 rounded-xl gap-2 text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-all shadow-sm active:scale-[0.99]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{loadingStep || "Processing material..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-streak" />
                  <span>
                    {activeTab === "mock" ? "Import & Build Practice Set" : "Generate Practice Questions"}
                  </span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

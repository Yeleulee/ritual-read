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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Upload,
  BookOpen,
  FileText,
  Loader2,
  Sparkles,
  ShieldCheck,
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
        // If a book was also selected in the background, use it as reference
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
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px] uppercase">
              Student Prep
            </Badge>
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Grounded in Material · Zero AI Credits</span>
            </div>
          </div>
          <DialogTitle className="text-2xl font-serif mt-1">Create Practice Set</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Generate questions strictly from your lecture notes, PDFs, or books without consuming AI credits — or import your own mock questions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Title Input */}
          <div className="space-y-1.5">
            <Label htmlFor="set-title" className="text-xs font-mono uppercase text-muted-foreground">
              Practice Set Name
            </Label>
            <Input
              id="set-title"
              placeholder="e.g. Biology Midterm Review, Econ Chapter 3"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10 text-sm"
            />
          </div>

          {/* Source Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "upload" | "library" | "mock")} className="w-full">
            <TabsList className="grid grid-cols-3 w-full h-10">
              <TabsTrigger value="upload" className="text-xs gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload File</span>
              </TabsTrigger>
              <TabsTrigger value="library" className="text-xs gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                <span>From Library</span>
              </TabsTrigger>
              <TabsTrigger value="mock" className="text-xs gap-1.5">
                <FileQuestion className="h-3.5 w-3.5" />
                <span>Mock Questions</span>
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Upload Document */}
            <TabsContent value="upload" className="pt-4 space-y-3">
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
                  "border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors",
                  uploadedFile
                    ? "border-primary bg-primary/5"
                    : "border-border/80 hover:border-foreground/40 hover:bg-muted/30"
                )}
              >
                {uploadedFile ? (
                  <div className="space-y-1">
                    <FileText className="h-8 w-8 mx-auto text-primary" />
                    <p className="text-sm font-medium text-foreground">{uploadedFile.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB · Click to choose different file
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground/60" />
                    <p className="text-sm font-medium text-foreground">
                      Drop lecture notes or syllabus document
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      PDF, EPUB, Word (DOCX), PowerPoint (PPTX), TXT, Markdown
                    </p>
                  </div>
                )}
              </label>
            </TabsContent>

            {/* Tab 2: Choose from Library */}
            <TabsContent value="library" className="pt-4 space-y-3">
              {books.length === 0 ? (
                <div className="border border-dashed border-border p-6 rounded-xl text-center text-xs text-muted-foreground">
                  Your library is currently empty. Upload a file above or add a book to your library first.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-52 overflow-y-auto pr-1">
                  {books.map((b) => {
                    const isSelected = selectedBookId === b.id;
                    return (
                      <div
                        key={b.id}
                        onClick={() => handleBookSelect(b)}
                        className={cn(
                          "flex items-center gap-3 p-2.5 rounded-xl border text-left cursor-pointer transition-all",
                          isSelected
                            ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                            : "border-border/60 hover:border-border hover:bg-muted/40"
                        )}
                      >
                        <div className="h-10 w-8 shrink-0 bg-muted rounded border border-border/40 overflow-hidden flex items-center justify-center">
                          {b.coverUrl ? (
                            <img src={b.coverUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{b.title}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{b.author || "Unknown author"}</p>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Tab 3: Paste / Import Mock Questions */}
            <TabsContent value="mock" className="pt-4 space-y-3">
              <div className="bg-muted/30 border border-border/50 rounded-xl p-3 text-xs text-muted-foreground flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <HelpCircle className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                  <p>
                    Paste your test questions or upload a sheet. The system converts <strong>only your exact questions</strong> without injecting random questions.
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
                  className="shrink-0 h-8 text-[11px] gap-1.5 rounded-lg"
                >
                  <Upload className="h-3 w-3" />
                  <span>Load File</span>
                </Button>
              </div>
              <Textarea
                placeholder="Paste mock questions here:&#10;1. What is the powerhouse of the cell?&#10;A) Ribosome&#10;B) Mitochondria&#10;C) Nucleus&#10;D) Endoplasmic Reticulum&#10;Answer: B"
                value={mockText}
                onChange={(e) => setMockText(e.target.value)}
                rows={6}
                className="font-mono text-xs leading-relaxed"
              />
            </TabsContent>
          </Tabs>

          {/* Configuration Options (When generating from material) */}
          {activeTab !== "mock" && (
            <div className="space-y-4 border-t border-border/60 pt-4">
              {/* Question Format */}
              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase text-muted-foreground">
                  Question Format
                </Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: "multiple-choice", label: "MCQ" },
                    { id: "true-false", label: "True / False" },
                    { id: "mixed", label: "Mixed" },
                    { id: "flashcard", label: "Flashcards" },
                  ].map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setQuestionType(fmt.id as typeof questionType)}
                      className={cn(
                        "py-1.5 px-2 rounded-lg border text-xs font-medium transition-colors",
                        questionType === fmt.id
                          ? "bg-foreground text-background border-foreground"
                          : "border-border/60 hover:bg-muted text-foreground/80"
                      )}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Number of Questions */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono uppercase text-muted-foreground">
                    Question Count
                  </Label>
                  <div className="flex items-center gap-1.5">
                    {[5, 10, 15, 20].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setQuestionCount(num)}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors",
                          questionCount === num
                            ? "bg-foreground text-background border-foreground"
                            : "border-border/60 hover:bg-muted text-foreground/80"
                        )}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono uppercase text-muted-foreground">
                    Difficulty Level
                  </Label>
                  <div className="flex items-center gap-1.5">
                    {(["easy", "medium", "hard"] as const).map((diff) => (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => setDifficulty(diff)}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg border text-xs capitalize font-medium transition-colors",
                          difficulty === diff
                            ? "bg-foreground text-background border-foreground"
                            : "border-border/60 hover:bg-muted text-foreground/80"
                        )}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Optional Topic Focus */}
              <div className="space-y-1.5">
                <Label htmlFor="topic-focus" className="text-xs font-mono uppercase text-muted-foreground">
                  Focus Topic or Chapter <span className="opacity-60 lowercase">(optional)</span>
                </Label>
                <Input
                  id="topic-focus"
                  placeholder="e.g. Chapter 4: Cellular Respiration, or leave blank for full document"
                  value={topicFocus}
                  onChange={(e) => setTopicFocus(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full h-11 rounded-full gap-2 text-sm font-medium"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{loadingStep || "Processing material..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>
                    {activeTab === "mock" ? "Import & Build Interactive Test" : "Generate Practice Questions"}
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

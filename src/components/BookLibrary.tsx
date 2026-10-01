import { useRef, useState } from "react";
import { extractDocxContent, estimateDocxPages } from "@/lib/docx";
import { loadPdfjs } from "@/lib/pdf";
import { ACCEPT_FORMATS, FORMAT_LABELS, validateBookFile, type BookFormat } from "@/lib/book-formats";
import { errorText, preflightEpub } from "@/lib/epub-repair";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SectionHeader, Rule, Empty } from "@/components/dashboard/primitives";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface BookItem {
  id: string;
  title: string;
  author: string;
  progress: number;
  totalPages: number;
  coverUrl?: string;
  content?: string;
  fileUrl?: string;
  fileType?: string;
  lastRead?: Date;
}

interface BookLibraryProps {
  books: BookItem[];
  onBookSelect: (book: BookItem) => void;
  onAddBook: (book: Omit<BookItem, "id"> & { file?: File; storedUrl?: Promise<string> }) => void | Promise<unknown>;
  /** Starts storing the file immediately; null when files stay on this device */
  onPrepareUpload?: (file: File) => Promise<string> | null;
  /** The user backed out after a file was already stored; remove it again */
  onDiscardUpload?: (storedUrl: Promise<string>) => void;
  onRemoveBook?: (bookId: string) => void;
}

// Everything we can learn from a file before the user confirms the import
interface Draft {
  file: File;
  fileName: string;
  title: string;
  author: string;
  totalPages: number;
  content: string;
  fileUrl?: string;
  fileType: BookFormat;
  coverUrl?: string;
}

const stripExt = (name: string) => name.replace(/\.[^/.]+$/, "");
const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// Resolves even if a parser hangs, so the dialog never gets stuck on a bad file
const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
  new Promise((resolve) => {
    const t = window.setTimeout(() => resolve(fallback), ms);
    p.then((v) => { window.clearTimeout(t); resolve(v); }, () => { window.clearTimeout(t); resolve(fallback); });
  });

// Flat ink cover with a serif glyph — used when a file has no artwork
const flatCover = (label: string, small = false): string => {
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#161616';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  ctx.fillStyle = '#F8EFE5';
  ctx.font = small ? '500 34px "JetBrains Mono", monospace' : 'italic 150px "Instrument Serif", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, canvas.width / 2, canvas.height / 2 + (small ? 0 : 12));
  return canvas.toDataURL('image/png');
};

export const BookLibrary = ({ books, onBookSelect, onAddBook, onPrepareUpload, onDiscardUpload, onRemoveBook }: BookLibraryProps) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newBook, setNewBook] = useState({
    title: "",
    author: "",
    totalPages: 0,
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  // Upload runs from the moment a file is picked so it overlaps analysis and the title check
  const upload = useRef<{ file: File; promise: Promise<string> } | null>(null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "done" | "failed">("idle");
  const fileInput = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const startUpload = (file: File) => {
    discardUpload();
    const promise = onPrepareUpload?.(file) ?? null;
    if (!promise) {
      upload.current = null;
      setUploadState("idle");
      return;
    }
    upload.current = { file, promise };
    setUploadState("uploading");
    promise.then(
      () => { if (upload.current?.file === file) setUploadState("done"); },
      () => { if (upload.current?.file === file) setUploadState("failed"); },
    );
  };

  // Anything already sent to storage for a file that won't be imported is deleted again
  const discardUpload = () => {
    const pending = upload.current;
    upload.current = null;
    if (pending) onDiscardUpload?.(pending.promise);
  };

  const resetDialog = () => {
    upload.current = null;
    setUploadState("idle");
    setNewBook({ title: "", author: "", totalPages: 0 });
    setDraft(null);
    setAnalyzing(false);
    setSaving(false);
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleDialogChange = (open: boolean) => {
    if (!open && saving) return;
    setIsAddDialogOpen(open);
    if (!open) {
      discardUpload();
      resetDialog();
    }
  };

  // Covers are stored inline in the books row, so keep them small: fit into 320×480 and re-encode as JPEG
  const blobUrlToDataUrl = async (blobUrl: string): Promise<string> => {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = blobUrl;
    });
    const scale = Math.min(1, 320 / img.naturalWidth, 480 / img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  };

  // Read what we can from the file: title/author metadata, page count, cover, text
  const analyzeFile = async (file: File, format: BookFormat): Promise<Draft> => {
    const draft: Draft = {
      file,
      fileName: file.name,
      title: stripExt(file.name),
      author: "",
      totalPages: 0,
      content: "",
      fileType: format,
    };
    // Every format keeps the original file; text formats also store their extracted text
    draft.fileUrl = URL.createObjectURL(file);

    if (format === "txt") {
      const text = await file.text();
      draft.content = text;
      draft.totalPages = Math.max(1, Math.ceil(text.length / 2000));
    } else if (format === "pdf") {
      const pdfjsLib = await loadPdfjs();
      // A damaged file is refused; a merely slow one still imports with the file name
      const loaded = await Promise.race([
        pdfjsLib.getDocument(draft.fileUrl).promise.then((pdf) => ({ pdf }), (error: unknown) => ({ error })),
        new Promise<{ timeout: true }>((resolve) => window.setTimeout(() => resolve({ timeout: true }), 15000)),
      ]);
      if ("error" in loaded) throw new Error(`This PDF couldn't be read (${errorText(loaded.error)}). It may be damaged or password-protected.`);
      const pdf = "pdf" in loaded ? loaded.pdf : null;
      if (pdf) {
        draft.totalPages = pdf.numPages;
        const meta = await withTimeout(pdf.getMetadata(), 5000, null);
        const info = (meta?.info ?? {}) as Record<string, unknown>;
        if (clean(info.Title)) draft.title = clean(info.Title);
        if (clean(info.Author)) draft.author = clean(info.Author);
        try {
          const page1 = await withTimeout(pdf.getPage(1), 5000, null);
          if (page1) {
            const viewport = page1.getViewport({ scale: 0.5 });
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (ctx) {
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              const renderTask = page1.render({ canvasContext: ctx, viewport, canvas });
              const rendered = await withTimeout(renderTask.promise.then(() => true), 8000, false);
              if (rendered) {
                draft.coverUrl = canvas.toDataURL("image/jpeg", 0.8);
              } else {
                renderTask.cancel();
              }
            }
          }
        } catch (err) {
          console.warn("Could not render PDF cover:", err);
        }
        pdf.destroy().catch(() => {});
      }
      draft.content = `PDF: ${draft.title}\n\nOpen to render.`;
    } else if (format === "epub") {
      // Same pre-flight the reader runs, so a file that can't open is refused here instead of later
      const pre = await preflightEpub(await file.arrayBuffer());
      try {
        const ePub = await import("epubjs");
        const book = ePub.default(pre.data);
        await withTimeout(book.ready, 15000, null);
        const meta = await withTimeout((book as any).loaded?.metadata as Promise<any>, 5000, null);
        if (clean(meta?.title)) draft.title = clean(meta.title);
        if (clean(meta?.creator)) draft.author = clean(meta.creator);
        const spineLen: number = (book as any).spine?.length ?? 0;
        // Rough estimate until the reader has laid the book out; replaced by the real page count then
        draft.totalPages = Math.max(20, Math.round(file.size / 4000));
        if (spineLen) draft.totalPages = Math.max(spineLen, draft.totalPages);
        const maybeCover = await withTimeout((book as any).coverUrl?.() as Promise<string | null>, 5000, null);
        if (maybeCover) {
          try {
            draft.coverUrl = await blobUrlToDataUrl(maybeCover);
          } catch {
            draft.coverUrl = maybeCover;
          }
        }
        book.destroy?.();
      } catch (error) {
        console.warn("EPUB metadata unavailable, importing with file name only:", error);
      }
      draft.content = `EPUB File: ${draft.title}\n\nOpen to read.`;
    } else if (format === "docx") {
      const { text } = await extractDocxContent(await file.arrayBuffer());
      if (!text.trim()) throw new Error("No readable text was found in this document.");
      draft.content = text;
      draft.totalPages = estimateDocxPages(text);
      draft.coverUrl = flatCover("DOCX", true);
    } else if (format === "pptx") {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const slides = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n)).length;
      if (!slides) throw new Error("No slides were found in this presentation.");
      draft.totalPages = slides;
      draft.content = `PowerPoint Presentation: ${draft.title}\n\n${slides} slides. Open to view.`;
      draft.coverUrl = flatCover("PPTX", true);
    }

    if (!draft.coverUrl) draft.coverUrl = flatCover((draft.title.trim()[0] || "B").toUpperCase());
    return draft;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    // Unsupported or oversized files never start an upload
    let format: BookFormat;
    try {
      format = validateBookFile(file);
    } catch (error) {
      discardUpload();
      setDraft(null);
      setNewBook({ title: "", author: "", totalPages: 0 });
      if (fileInput.current) fileInput.current.value = "";
      toast({ title: "Can't import this file", description: errorText(error), variant: "destructive" });
      return;
    }
    setAnalyzing(true);
    setDraft(null);
    startUpload(file);
    // A new file replaces whatever the previous file prefilled
    setNewBook({ title: "", author: "", totalPages: 0 });
    try {
      // Hard ceiling so a pathological file can never leave the dialog stuck
      const d = await Promise.race([
        analyzeFile(file, format),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("File analysis timed out")), 30000)),
      ]);
      setDraft(d);
      setNewBook({ title: d.title, author: d.author, totalPages: d.totalPages });
    } catch (error) {
      console.error("Error reading file:", error);
      // The file itself is unreadable, so importing it would only produce a book that can't open
      discardUpload();
      setDraft(null);
      if (fileInput.current) fileInput.current.value = "";
      toast({
        title: "Couldn't read this file",
        description: `${errorText(error)} Try re-exporting it, or convert it to ${FORMAT_LABELS.join(", ")}.`,
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleImport = async () => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      // A failed upload is retried here rather than silently dropping the file
      if (uploadState === "failed") startUpload(draft.file);
      const storedUrl = upload.current?.file === draft.file ? upload.current.promise : undefined;
      // The hook toasts success/failure once the upload and insert actually finish
      await onAddBook({
        title: newBook.title.trim() || draft.title,
        author: newBook.author.trim() || draft.author || "Unknown Author",
        progress: 0,
        totalPages: newBook.totalPages || draft.totalPages,
        content: draft.content,
        fileUrl: draft.fileUrl,
        fileType: draft.fileType,
        coverUrl: draft.coverUrl,
        lastRead: new Date(),
        file: draft.file,
        storedUrl,
      });
      // The stored file now belongs to a book row; nothing left to discard
      upload.current = null;
      setIsAddDialogOpen(false);
      resetDialog();
    } catch (error) {
      console.error("Error adding book:", error);
      setSaving(false);
    }
  };

  const formatLastRead = (date?: Date) => {
    if (!date) return "Never";
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return "Yesterday";
    return `${Math.floor(diffInHours / 24)} days ago`;
  };

  const inProgress = books.filter((b) => b.progress > 0 && b.progress < 100).length;
  const finished = books.filter((b) => b.progress >= 100).length;

  const addDialog = (
    <Dialog open={isAddDialogOpen} onOpenChange={handleDialogChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4" />
          Add book
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md overflow-hidden rounded-lg">
        <DialogHeader>
          <p className="eyebrow">Library</p>
          <DialogTitle className="display text-3xl">Add a book</DialogTitle>
        </DialogHeader>
        {/* min-w-0: a grid item's auto min-width would otherwise grow to the file input's intrinsic (filename) width */}
        <div className="min-w-0 space-y-5 pt-2">
          <div className="space-y-2">
            <Label htmlFor="file" className="eyebrow">File</Label>
            <Input
              ref={fileInput}
              id="file"
              type="file"
              accept={ACCEPT_FORMATS}
              onChange={handleFileChange}
              disabled={analyzing || saving}
              className="min-w-0 max-w-full cursor-pointer truncate file:mr-3 file:font-mono file:text-[11px] file:uppercase file:tracking-[0.12em]"
            />
            <p className="text-xs text-muted-foreground">
              {FORMAT_LABELS.join(", ")}. Title and author are read from the file when available.
            </p>
          </div>

          {(analyzing || draft) && (
            <div className="flex items-center gap-4 rounded-md border border-border bg-muted/40 p-3">
              <div className="h-16 w-12 shrink-0 overflow-hidden rounded-sm bg-foreground/10">
                {draft?.coverUrl && !analyzing ? (
                  <img src={draft.coverUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="min-w-0 text-sm">
                {analyzing ? (
                  <p className="text-muted-foreground">Reading file details…</p>
                ) : (
                  <>
                    <p className="truncate font-medium">{draft?.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {draft?.fileType?.toUpperCase()}
                      {draft?.totalPages ? ` · ~${draft.totalPages} pages` : ""}
                      {uploadState === "uploading" && " · Uploading…"}
                      {uploadState === "done" && " · Uploaded"}
                      {uploadState === "failed" && <span className="text-destructive"> · Upload failed — Add retries it</span>}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title" className="eyebrow">Title</Label>
            <Input
              id="title"
              value={newBook.title}
              onChange={(e) => setNewBook(prev => ({ ...prev, title: e.target.value }))}
              placeholder={draft ? draft.title : "Filled in from the file"}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="author" className="eyebrow">Author</Label>
            <Input
              id="author"
              value={newBook.author}
              onChange={(e) => setNewBook(prev => ({ ...prev, author: e.target.value }))}
              placeholder="Optional"
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pages" className="eyebrow">Pages</Label>
            <Input
              id="pages"
              type="number"
              value={newBook.totalPages || ""}
              onChange={(e) => setNewBook(prev => ({ ...prev, totalPages: parseInt(e.target.value) || 0 }))}
              placeholder="Optional — estimated from the file"
              disabled={saving}
            />
          </div>
        </div>
        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={() => handleDialogChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!draft || analyzing || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? (uploadState === "uploading" ? "Uploading…" : "Adding…") : "Add to library"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Library"
        title={books.length ? "Your shelf" : "An empty shelf"}
        meta={
          books.length
            ? `${books.length} ${books.length === 1 ? "book" : "books"} · ${inProgress} in progress · ${finished} finished`
            : "Add a file to start."
        }
        action={addDialog}
      />

      {books.length === 0 ? (
        <Empty
          title="Nothing here yet."
          body={`Drop in an ${FORMAT_LABELS.slice(0, -1).join(", ")} or ${FORMAT_LABELS[FORMAT_LABELS.length - 1]} file and it will appear on this shelf with its cover, progress and last-read time.`}
          action={
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              Add your first book
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10">
          {books.map((book) => (
            <li key={book.id} className="group relative">
              <button
                type="button"
                onClick={() => onBookSelect(book)}
                className="block w-full text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
              >
                <div className="relative aspect-[2/3] w-full overflow-hidden border border-border bg-muted transition-transform duration-300 ease-out group-hover:-translate-y-1">
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-foreground text-background">
                      <span className="font-serif italic text-6xl">{book.title.trim()[0]?.toUpperCase() || "B"}</span>
                    </div>
                  )}
                  {book.progress >= 100 && (
                    <span className="absolute left-2 top-2 bg-foreground px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-background">
                      Finished
                    </span>
                  )}
                </div>
                <Rule value={book.progress} className="mt-3" />
                <h3 className="mt-3 font-serif text-lg leading-snug line-clamp-2">{book.title}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground truncate">{book.author}</p>
                <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  {Math.round(book.progress)}% · {book.totalPages} pp · {formatLastRead(book.lastRead)}
                </p>
              </button>

              {onRemoveBook && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      aria-label={`Remove ${book.title}`}
                      className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center border border-border bg-background/90 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-lg">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="display text-2xl">Remove this book?</AlertDialogTitle>
                      <AlertDialogDescription>
                        “{book.title}” will be removed from your library. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => onRemoveBook(book.id)}
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
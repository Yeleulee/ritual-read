import { useState } from "react";
import { extractDocxContent, estimateDocxPages } from "@/lib/docx";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
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
  onAddBook: (book: Omit<BookItem, "id">) => void;
  onRemoveBook?: (bookId: string) => void;
}

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

export const BookLibrary = ({ books, onBookSelect, onAddBook, onRemoveBook }: BookLibraryProps) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newBook, setNewBook] = useState({
    title: "",
    author: "",
    totalPages: 0,
  });
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    let content = "";
    let estimatedPages = 0;
    let fileUrl: string | undefined;
    let fileType: string | undefined;
    let coverUrl: string | undefined;

    try {
      const blobUrlToDataUrl = async (blobUrl: string): Promise<string> => {
        const res = await fetch(blobUrl);
        const blob = await res.blob();
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };

      const generatePlaceholderCover = (title: string): string =>
        flatCover((title?.trim()?.[0] || 'B').toUpperCase());

      // Generate an object URL for supported binary formats so the readers can open them later
      if (fileExtension && ['pdf', 'epub', 'mobi', 'azw', 'azw3', 'ppt', 'pptx'].includes(fileExtension)) {
        fileUrl = URL.createObjectURL(file);
        fileType = fileExtension === 'pptx' || fileExtension === 'ppt' ? 'pptx' : fileExtension;
      }

      if (fileExtension === 'txt') {
        // Handle text files
        const text = await file.text();
        content = text;
        estimatedPages = Math.ceil(text.length / 2000);
      } else if (fileExtension === 'pdf') {
        // Handle PDF files
        fileType = 'pdf';
        const pdfjsLib = await import('pdfjs-dist');
        // @ts-ignore - version prop available at runtime
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjsLib as any).version}/pdf.worker.min.js`;
        
        const pdf = await pdfjsLib.getDocument(fileUrl).promise;
        estimatedPages = pdf.numPages;
        content = `PDF: ${newBook.title || file.name}\n\nOpen to render.`;

        // Render first page to a small canvas to create a cover image
        try {
          const page1 = await pdf.getPage(1);
          const viewport = page1.getViewport({ scale: 0.5 });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page1.render({ canvasContext: ctx, viewport, canvas }).promise;
            coverUrl = canvas.toDataURL('image/png');
          }
        } catch (err) {
          console.warn('Could not render PDF cover:', err);
        }
      } else if (fileExtension === 'epub') {
        // Handle EPUB files
        const arrayBuffer = await file.arrayBuffer();
        try {
          const ePub = await import('epubjs');
          const book = ePub.default(arrayBuffer);
          
          await book.ready;
          
          // Get rough page estimate
          estimatedPages = 100; // Default estimate for EPUB
          
          // Create placeholder content for EPUB
          content = `EPUB File: ${newBook.title || file.name}

This is an EPUB file that has been imported into your library. The full content will be displayed when you open the book for reading.

File: ${file.name}
Estimated pages: ${estimatedPages}

Start reading to view the full content.`;

          // Try to get cover from epub.js and convert to a data URL (persistent)
          try {
            const maybeCoverUrl = await (book as any).coverUrl?.();
            if (maybeCoverUrl) {
              try {
                coverUrl = await blobUrlToDataUrl(maybeCoverUrl as string);
              } catch (e) {
                console.warn('Failed to cache EPUB cover blob, using blob URL directly:', e);
                coverUrl = maybeCoverUrl as string;
              }
            }
          } catch (e) {
            // Best-effort only
            console.warn('Failed to extract EPUB cover via coverUrl():', e);
          }
        } catch (error) {
          console.warn('EPUB parsing failed, treating as generic file:', error);
          estimatedPages = 100;
          content = `EPUB File: ${newBook.title || file.name}

This EPUB file has been imported but could not be fully parsed. You can still read it in the reader interface.`;
        }
      } else if (fileExtension === 'docx' || fileExtension === 'doc') {
        // Handle Word documents
        const buffer = await file.arrayBuffer();
        const { text } = await extractDocxContent(buffer);
        content = text;
        estimatedPages = estimateDocxPages(text);
        fileType = 'docx';
        fileUrl = URL.createObjectURL(file);
        coverUrl = flatCover('DOCX', true);
      } else if (fileExtension === 'pptx' || fileExtension === 'ppt') {
        // Handle PowerPoint files
        fileType = 'pptx';
        estimatedPages = 10; // Default estimate for presentations
        
        content = `PowerPoint Presentation: ${newBook.title || file.name}

This is a PowerPoint presentation that has been imported into your library. The slides will be displayed when you open it for viewing.

File: ${file.name}
Estimated slides: ${estimatedPages}

Start viewing to see the full presentation.`;

        coverUrl = flatCover('PPTX', true);
      } else {
        // Fallback for other formats - try to read as text
        content = await file.text();
        estimatedPages = Math.ceil(content.length / 2000);
      }

      // Ensure we always have a persistent cover image if possible
      if (!coverUrl) {
        coverUrl = generatePlaceholderCover(newBook.title || file.name.replace(/\.[^/.]+$/, ""));
      }

      onAddBook({
        title: newBook.title || file.name.replace(/\.[^/.]+$/, ""),
        author: newBook.author || "Unknown Author",
        progress: 0,
        totalPages: newBook.totalPages || estimatedPages,
        content,
        fileUrl,
        fileType: fileType || fileExtension,
        coverUrl,
        lastRead: new Date(),
      });

      toast({
        title: "Book Added Successfully",
        description: `"${newBook.title || file.name}" has been added to your library.`,
      });

      setNewBook({ title: "", author: "", totalPages: 0 });
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error('Error processing file:', error);
      toast({
        title: "Error Adding Book",
        description: "There was an error processing your file. Please try again.",
        variant: "destructive",
      });
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
    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4" />
          Add book
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-lg">
        <DialogHeader>
          <p className="eyebrow">Library</p>
          <DialogTitle className="display text-3xl">Add a book</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label htmlFor="title" className="eyebrow">Title</Label>
            <Input
              id="title"
              value={newBook.title}
              onChange={(e) => setNewBook(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Leave blank to use the file name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="author" className="eyebrow">Author</Label>
            <Input
              id="author"
              value={newBook.author}
              onChange={(e) => setNewBook(prev => ({ ...prev, author: e.target.value }))}
              placeholder="Optional"
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
            />
          </div>
          <div className="space-y-2 border-t border-border pt-5">
            <Label htmlFor="file" className="eyebrow">File</Label>
            <Input
              id="file"
              type="file"
              accept=".txt,.epub,.pdf,.mobi,.azw,.azw3,.fb2,.djvu,.rtf,.doc,.docx,.ppt,.pptx"
              onChange={handleFileUpload}
              className="cursor-pointer file:mr-3 file:font-mono file:text-[11px] file:uppercase file:tracking-[0.12em]"
            />
            <p className="text-xs text-muted-foreground">
              EPUB, PDF, TXT, DOCX, PPTX and more. Choosing a file adds it immediately.
            </p>
          </div>
        </div>
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
          body="Drop in an EPUB or PDF and it will appear on this shelf with its cover, progress and last-read time."
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
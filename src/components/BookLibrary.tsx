import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, BookOpen, Clock, FileText, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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

      const generatePlaceholderCover = (title: string): string => {
        const canvas = document.createElement('canvas');
        // 3:4 thumbnail
        canvas.width = 240;
        canvas.height = 320;
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';
        // gradient background
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, 'hsl(265,85%,47%)');
        grad.addColorStop(1, 'hsl(35,85%,65%)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // title initial
        const initial = (title?.trim()?.[0] || 'B').toUpperCase();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 160px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initial, canvas.width / 2, canvas.height / 2 + 10);
        return canvas.toDataURL('image/png');
      };

      // Generate an object URL for supported binary formats so the readers can open them later
      if (fileExtension && ['pdf', 'epub', 'mobi', 'azw', 'azw3'].includes(fileExtension)) {
        fileUrl = URL.createObjectURL(file);
        fileType = fileExtension;
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
            await page1.render({ canvasContext: ctx, viewport }).promise;
            coverUrl = canvas.toDataURL('image/png');
          }
        } catch (err) {
          console.warn('Could not render PDF cover:', err);
        }
      } else if (fileExtension === 'epub') {
        // Handle EPUB files
        const arrayBuffer = await file.arrayBuffer();
        
        // Create blob URL for the EPUB file
        const blob = new Blob([arrayBuffer], { type: 'application/epub+zip' });
        fileUrl = URL.createObjectURL(blob);
        fileType = 'epub';
        
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold ritual-heading">Your Library</h2>
          <p className="text-muted-foreground">Curate your mindful reading collection</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ritual">
              <Plus className="w-4 h-4 mr-2" />
              Add Book
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="ritual-heading">Add New Book</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={newBook.title}
                  onChange={(e) => setNewBook(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter book title"
                />
              </div>
              <div>
                <Label htmlFor="author">Author</Label>
                <Input
                  id="author"
                  value={newBook.author}
                  onChange={(e) => setNewBook(prev => ({ ...prev, author: e.target.value }))}
                  placeholder="Enter author name"
                />
              </div>
              <div>
                <Label htmlFor="pages">Total Pages (optional)</Label>
                <Input
                  id="pages"
                  type="number"
                  value={newBook.totalPages || ""}
                  onChange={(e) => setNewBook(prev => ({ ...prev, totalPages: parseInt(e.target.value) || 0 }))}
                  placeholder="Number of pages"
                />
              </div>
              <div>
                <Label htmlFor="file">Upload File</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".txt,.epub,.pdf,.mobi,.azw,.azw3,.fb2,.djvu,.rtf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supports TXT, EPUB, PDF, MOBI, AZW, FB2, DJVU, RTF, DOC, DOCX files
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Books Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {books.map((book) => (
          <Card 
            key={book.id} 
            className="group cursor-pointer transition-ritual hover:ritual-glow hover:-translate-y-1"
            onClick={() => onBookSelect(book)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="w-12 h-16 rounded-lg overflow-hidden mb-3 bg-muted flex items-center justify-center">
                  {book.coverUrl ? (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full gradient-reading flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-primary" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {book.progress > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(book.progress)}%
                    </Badge>
                  )}
                  {onRemoveBook && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          aria-label="Delete book"
                          className="inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-muted transition-colors text-red-600 hover:text-red-700 dark:text-red-400"
                          onClick={(e) => e.stopPropagation()}
                          title="Remove book"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove this book?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{book.title}" will be removed from your library. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveBook(book.id);
                            }}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
              <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
                {book.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{book.author}</p>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{Math.round(book.progress)}%</span>
                </div>
                <Progress value={book.progress} className="h-2" />
              </div>
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {book.totalPages} pages
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatLastRead(book.lastRead)}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {books.length === 0 && (
          <div className="col-span-full text-center py-12">
            <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-medium text-muted-foreground mb-2">
              Your library is empty
            </h3>
            <p className="text-muted-foreground mb-4">
              Add your first book to begin your mindful reading journey
            </p>
            <Button 
              onClick={() => setIsAddDialogOpen(true)}
              variant="ritual"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Book
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
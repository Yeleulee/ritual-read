import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, BookOpen, Clock, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BookItem {
  id: string;
  title: string;
  author: string;
  progress: number;
  totalPages: number;
  coverUrl?: string;
  content?: string;
  lastRead?: Date;
}

interface BookLibraryProps {
  books: BookItem[];
  onBookSelect: (book: BookItem) => void;
  onAddBook: (book: Omit<BookItem, "id">) => void;
}

export const BookLibrary = ({ books, onBookSelect, onAddBook }: BookLibraryProps) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newBook, setNewBook] = useState({
    title: "",
    author: "",
    totalPages: 0,
  });
  const { toast } = useToast();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const estimatedPages = Math.ceil(content.length / 2000); // Rough estimate
      
      onAddBook({
        title: newBook.title || file.name.replace(/\.[^/.]+$/, ""),
        author: newBook.author || "Unknown Author",
        progress: 0,
        totalPages: newBook.totalPages || estimatedPages,
        content,
        lastRead: new Date(),
      });

      toast({
        title: "Book Added Successfully",
        description: `"${newBook.title || file.name}" has been added to your library.`,
      });

      setNewBook({ title: "", author: "", totalPages: 0 });
      setIsAddDialogOpen(false);
    };
    reader.readAsText(file);
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
                  accept=".txt,.epub,.pdf"
                  onChange={handleFileUpload}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supports TXT, EPUB, and PDF files
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
              <div className="flex items-start justify-between">
                <div className="w-12 h-16 gradient-reading rounded-lg flex items-center justify-center mb-3">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
                {book.progress > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {Math.round(book.progress)}%
                  </Badge>
                )}
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
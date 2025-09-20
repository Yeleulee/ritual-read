import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBook } from '@/hooks/use-books.cloud';

export function CloudBookReader({ id, onBack }: { id: string; onBack?: () => void }) {
  const { data, isLoading, error } = useBook(id);

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (error || !data) return <div className="text-red-600">Failed to load book.</div>;

  const { book, fileUrl } = data;
  const isPdf = (book.mime_type || '').includes('pdf') || book.storage_path.toLowerCase().endsWith('.pdf');

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{book.title}</CardTitle>
          {onBack && (
            <button className="text-sm text-muted-foreground hover:underline" onClick={onBack}>Back</button>
          )}
        </div>
        {!!book.author && <div className="text-xs text-muted-foreground">by {book.author}</div>}
      </CardHeader>
      <CardContent>
        {isPdf ? (
          <iframe src={fileUrl} title={book.title} className="w-full h-[75vh] border rounded" />
        ) : (
          <div className="p-4 text-sm text-muted-foreground">
            This format isn’t previewable in an iframe. Use a dedicated reader
            component and pass it the fresh URL from useBook(id).
          </div>
        )}
      </CardContent>
    </Card>
  );
}



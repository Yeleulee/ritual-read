import { useState } from 'react';
import { useBooks, useUploadBook } from '@/hooks/use-books.cloud';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function CloudLibrary({ onOpen }: { onOpen: (id: string) => void }) {
  const { data: books, isLoading, error } = useBooks();
  const { mutateAsync, isPending } = useUploadBook();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');

  const onUpload = async () => {
    if (!file || !title) return;
    await mutateAsync({ file, title, author });
    setFile(null);
    setTitle('');
    setAuthor('');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>File</Label>
            <Input type="file" accept=".pdf,.epub" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Book title" />
          </div>
          <div>
            <Label>Author</Label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div className="mt-3">
          <Button disabled={!file || !title || isPending} onClick={onUpload}>
            {isPending ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
      </div>

      {isLoading && <div className="text-muted-foreground">Loading…</div>}
      {error && <div className="text-red-600">Failed to load books.</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {books?.map((b) => (
          <Card key={b.id} className="hover:shadow-md transition cursor-pointer" onClick={() => onOpen(b.id)}>
            <CardHeader>
              <CardTitle className="text-base">{b.title}</CardTitle>
              {b.author && <div className="text-xs text-muted-foreground">{b.author}</div>}
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground break-all">{b.storage_path}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}



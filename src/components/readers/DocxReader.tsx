import { useEffect, useMemo } from "react";

interface DocxReaderProps {
  content: string;
  page?: number;
  wordsPerPage?: number;
  onPageCount?: (count: number) => void;
  onPageText?: (text: string) => void;
}

const DEFAULT_WORDS_PER_PAGE = 350;

function paginate(content: string, wordsPerPage: number): string[] {
  if (!content.trim()) return [""];

  const words = content.trim().split(/\s+/);
  const pages: string[] = [];

  for (let i = 0; i < words.length; i += wordsPerPage) {
    pages.push(words.slice(i, i + wordsPerPage).join(" "));
  }

  return pages.length > 0 ? pages : [""];
}

export const DocxReader = ({
  content,
  page = 1,
  wordsPerPage = DEFAULT_WORDS_PER_PAGE,
  onPageCount,
  onPageText,
}: DocxReaderProps) => {
  const pages = useMemo(() => paginate(content, wordsPerPage), [content, wordsPerPage]);
  const safeIndex = Math.min(Math.max(page - 1, 0), pages.length - 1);
  const currentPage = pages[safeIndex] ?? "";

  useEffect(() => {
    onPageCount?.(pages.length);
  }, [pages.length, onPageCount]);

  useEffect(() => {
    onPageText?.(currentPage);
  }, [currentPage, onPageText]);

  const paragraphs = useMemo(() => currentPage.split(/\n{2,}/).filter(Boolean), [currentPage]);

  return (
    <div className="h-full overflow-y-auto bg-background px-6 py-8">
      {paragraphs.length === 0 ? (
        <div className="mx-auto max-w-3xl text-center text-sm text-muted-foreground">
          This document is empty or could not be parsed.
        </div>
      ) : (
        <article className="mx-auto max-w-3xl space-y-5 leading-relaxed">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="text-foreground">
              {paragraph}
            </p>
          ))}
        </article>
      )}
    </div>
  );
};

export default DocxReader;

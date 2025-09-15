import { useEffect, useMemo, useRef } from "react";
import HTMLFlipBook from "react-pageflip";
const AnyFlipBook: any = HTMLFlipBook as any;

interface TextFlipBookProps {
  content: string;
  wordsPerPage: number;
  currentPage: number; // 1-indexed
  onPageChange: (page: number) => void;
}

export const TextFlipBook = ({ content, wordsPerPage, currentPage, onPageChange }: TextFlipBookProps) => {
  const flipRef = useRef<any>(null);

  const pages = useMemo(() => {
    const words = content.split(' ').filter(Boolean);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += wordsPerPage) {
      chunks.push(words.slice(i, i + wordsPerPage).join(' '));
    }
    return chunks.length > 0 ? chunks : [""];
  }, [content, wordsPerPage]);

  // Sync flipbook when parent currentPage changes
  useEffect(() => {
    try {
      const targetIndex = Math.max(0, Math.min(pages.length - 1, currentPage - 1));
      if (flipRef.current?.pageFlip) {
        const inst = flipRef.current.pageFlip();
        if (inst.getCurrentPageIndex() !== targetIndex) {
          inst.flip(targetIndex);
        }
      }
    } catch {}
  }, [currentPage, pages.length]);

  return (
    <div className="w-full h-full">
      <AnyFlipBook
        width={800}
        height={560}
        size="stretch"
        minWidth={320}
        maxWidth={1100}
        minHeight={300}
        maxHeight={900}
        maxShadowOpacity={0.5}
        showCover={false}
        mobileScrollSupport={true}
        className="shadow-sm"
        ref={flipRef}
        onFlip={(e: any) => {
          const pageIdx = e?.data || 0;
          onPageChange(pageIdx + 1);
        }}
      >
        {pages.map((p, i) => (
          <div className="bg-background p-8" key={i} data-density="hard">
            <div
              className="leading-relaxed"
              style={{ textAlign: 'justify' }}
            >
              {p}
            </div>
          </div>
        ))}
      </AnyFlipBook>
    </div>
  );
};

export default TextFlipBook;



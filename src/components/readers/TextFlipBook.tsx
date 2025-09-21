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
        maxShadowOpacity={0.8}
        flippingTime={900}
        usePortrait={true}
        showPageCorners={true}
        drawShadow={true}
        showCover={false}
        mobileScrollSupport={true}
        className="shadow-xl"
        style={{ perspective: '2000px' }}
        ref={flipRef}
        onFlip={(e: any) => {
          const pageIdx = e?.data || 0;
          onPageChange(pageIdx + 1);
        }}
      >
        {pages.map((p, i) => {
          const isLeft = i % 2 === 0;
          return (
            <div className={`bg-card p-6 md:p-8 border border-border ${isLeft ? 'book-page-left' : 'book-page-right'}`} key={i}>
              <div
                className="leading-relaxed reading-text"
                style={{ textAlign: 'justify' }}
              >
                {p}
              </div>
            </div>
          );
        })}
      </AnyFlipBook>
    </div>
  );
};

export default TextFlipBook;



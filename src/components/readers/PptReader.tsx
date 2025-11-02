import { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { getCachedFile, cacheFile } from '@/lib/indexedDBCache';

interface Slide {
  number: number;
  imageUrl?: string;
  title?: string;
  content?: string[];
}

interface PptReaderProps {
  fileUrl: string;
  page?: number;
  onPageCount?: (count: number) => void;
  onPageText?: (text: string) => void;
}

export function PptReader({ fileUrl, page = 1, onPageCount, onPageText }: PptReaderProps) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(page - 1);
  const [useIframe, setUseIframe] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const extractPPTX = useCallback(async (url: string) => {
    try {
      console.log('Loading PPTX file:', url);
      
      // Check cache first
      const cacheKey = `pptx-${url}`;
      const cachedBlob = await getCachedFile(cacheKey);
      
      let arrayBuffer: ArrayBuffer;
      if (cachedBlob) {
        console.log('Using cached PPTX file');
        arrayBuffer = await cachedBlob.arrayBuffer();
      } else {
        console.log('Fetching PPTX file');
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load file');
        
        const blob = await response.blob();
        arrayBuffer = await blob.arrayBuffer();
        
        // Cache for faster future access
        await cacheFile(cacheKey, blob, 'pptx');
      }

      const zip = await JSZip.loadAsync(arrayBuffer);
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
      });

      // Get presentation structure
      const slidesFolder = zip.folder('ppt/slides');
      if (!slidesFolder) {
        throw new Error('Invalid PPTX structure');
      }

      const slideFiles = Object.keys(zip.files)
        .filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'))
        .sort();

      console.log(`Found ${slideFiles.length} slides`);
      
      const extractedSlides: Slide[] = [];

      // Extract slide content and images
      for (let i = 0; i < slideFiles.length; i++) {
        const slideFile = slideFiles[i];
        const slideXml = await zip.file(slideFile)?.async('text');
        
        if (!slideXml) continue;

        const slideData = parser.parse(slideXml);
        
        // Extract text content from slide
        const texts: string[] = [];
        let title = '';
        
        const extractText = (obj: any): void => {
          if (!obj) return;
          
          if (typeof obj === 'string') {
            texts.push(obj);
            return;
          }
          
          if (obj['a:t']) {
            const text = obj['a:t'];
            texts.push(text);
            if (!title) title = text;
          }
          
          if (Array.isArray(obj)) {
            obj.forEach(extractText);
          } else if (typeof obj === 'object') {
            Object.values(obj).forEach(extractText);
          }
        };

        extractText(slideData);

        // Try to find slide image in media folder
        const mediaFolder = zip.folder('ppt/media');
        let imageUrl: string | undefined;
        
        if (mediaFolder) {
          const imageFiles = Object.keys(zip.files)
            .filter(name => name.startsWith('ppt/media/') && /\.(jpg|jpeg|png|gif)$/i.test(name));
          
          // Try to match image to slide number
          if (imageFiles.length > i) {
            const imageFile = zip.file(imageFiles[i]);
            if (imageFile) {
              const imageBlob = await imageFile.async('blob');
              imageUrl = URL.createObjectURL(imageBlob);
            }
          }
        }

        extractedSlides.push({
          number: i + 1,
          title: title || `Slide ${i + 1}`,
          content: texts,
          imageUrl,
        });
      }

      if (extractedSlides.length === 0) {
        throw new Error('No slides found');
      }

      setSlides(extractedSlides);
      onPageCount?.(extractedSlides.length);
      setLoading(false);
      
      // Set initial slide text
      if (extractedSlides[currentSlide]) {
        const slideText = [
          extractedSlides[currentSlide].title,
          ...(extractedSlides[currentSlide].content || [])
        ].join('\n');
        onPageText?.(slideText);
      }

    } catch (err) {
      console.error('Failed to extract PPTX:', err);
      setError('Could not parse PowerPoint file. Using fallback viewer...');
      setUseIframe(true);
      setLoading(false);
    }
  }, [currentSlide, onPageCount, onPageText]);

  useEffect(() => {
    if (fileUrl) {
      setLoading(true);
      setError(null);
      
      // Check if it's a .ppt (old format) or .pptx
      const isPpt = fileUrl.toLowerCase().endsWith('.ppt');
      
      if (isPpt) {
        // Old .ppt format - use iframe viewer
        setUseIframe(true);
        setLoading(false);
      } else {
        // Modern .pptx format - try to extract
        extractPPTX(fileUrl);
      }
    }
  }, [fileUrl, extractPPTX]);

  useEffect(() => {
    if (page && page > 0 && page <= slides.length) {
      setCurrentSlide(page - 1);
      
      // Update slide text for AI context
      if (slides[page - 1]) {
        const slideText = [
          slides[page - 1].title,
          ...(slides[page - 1].content || [])
        ].join('\n');
        onPageText?.(slideText);
      }
    }
  }, [page, slides, onPageText]);

  const handlePrevious = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = 'presentation.pptx';
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading presentation...</p>
        </div>
      </div>
    );
  }

  if (useIframe) {
    // Fallback to Office Online viewer or Google Docs viewer
    const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
    
    return (
      <div className="h-full flex flex-col">
        {error && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 text-sm">
            {error}
          </div>
        )}
        <iframe
          src={viewerUrl}
          className="w-full flex-1 border-0"
          title="PowerPoint Presentation"
        />
        <div className="p-2 border-t bg-muted/50 flex justify-center">
          <Button size="sm" variant="outline" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </div>
    );
  }

  const currentSlideData = slides[currentSlide];

  return (
    <div className="h-full flex flex-col bg-background" ref={containerRef}>
      {/* Slide Display */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        <div className="max-w-4xl w-full">
          {currentSlideData?.imageUrl ? (
            <img
              src={currentSlideData.imageUrl}
              alt={currentSlideData.title || `Slide ${currentSlideData.number}`}
              className="w-full h-auto rounded-lg shadow-lg"
            />
          ) : (
            <div className="bg-card border rounded-lg p-8 shadow-lg">
              <h2 className="text-3xl font-bold mb-6 text-foreground">
                {currentSlideData?.title || `Slide ${currentSlideData?.number}`}
              </h2>
              <div className="space-y-3">
                {currentSlideData?.content?.map((text, idx) => (
                  <p key={idx} className="text-lg text-muted-foreground leading-relaxed">
                    {text}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="border-t bg-muted/50 p-3 flex items-center justify-between">
        <Button
          size="sm"
          variant="outline"
          onClick={handlePrevious}
          disabled={currentSlide === 0}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>

        <div className="text-sm font-medium">
          Slide {currentSlide + 1} of {slides.length}
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleNext}
          disabled={currentSlide === slides.length - 1}
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

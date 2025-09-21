import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Sparkles, Timer, Shield, Brain, ArrowRight, Flame, Headphones } from "lucide-react";
import { SplineSceneBasic } from "@/components/ui/spline-demo";
import { GlowingEffectDemo } from "@/components/ui/glowing-effect-demo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="container mx-auto px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
        <Link to="/app" className="flex items-center group">
          <span
            className="text-2xl sm:text-3xl font-medium bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent"
            style={{ fontFamily: 'Great Vibes, cursive' }}
          >
            Ritual
          </span>
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/app">
            <Button variant="outline">Log In</Button>
          </Link>
          <a href="#features">
            <Button variant="ghost">Features</Button>
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-8 md:py-10">
        <SplineSceneBasic />
      </section>

      {/* Glowing grid showcase */}
      <section className="container mx-auto px-4 py-8">
        <GlowingEffectDemo />
      </section>

      {/* Key Features */}
      <section id="features" className="container mx-auto px-4 py-10 md:py-12">
        <div className="text-center mb-6 md:mb-8">
          <h2 className="text-2xl md:text-3xl font-semibold">Why Ritual</h2>
          <p className="text-sm md:text-base text-muted-foreground mt-2">Focused reading, gentle motivation, and tools that stay out of your way.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <Card className="p-5 md:p-6">
            <div className="flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-primary shrink-0" />
              <div>
                <div className="font-medium">Beautiful Reader</div>
                <p className="text-sm text-muted-foreground mt-1">EPUB/PDF support, adjustable typography, and distraction-free paging with large tap targets on phones.</p>
              </div>
            </div>
          </Card>
          <Card className="p-5 md:p-6">
            <div className="flex items-start gap-3">
              <Timer className="w-5 h-5 text-primary shrink-0" />
              <div>
                <div className="font-medium">Streaks & Ritual Music</div>
                <p className="text-sm text-muted-foreground mt-1">Stay consistent with daily goals and play background audio via YouTube while you read.</p>
              </div>
            </div>
          </Card>
          <Card className="p-5 md:p-6">
            <div className="flex items-start gap-3">
              <Brain className="w-5 h-5 text-primary shrink-0" />
              <div>
                <div className="font-medium">Built‑in Assistant</div>
                <p className="text-sm text-muted-foreground mt-1">Summaries and Q&A in a phone‑friendly sheet on mobile and a side panel on desktop.</p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Stats strip */}
      <section className="container mx-auto px-4 pb-6">
        <div className="rounded-2xl border bg-card/60 backdrop-blur p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-semibold">5,000+</div>
            <div className="text-sm text-muted-foreground mt-1">Books imported</div>
          </div>
          <div>
            <div className="text-2xl font-semibold">32 min</div>
            <div className="text-sm text-muted-foreground mt-1">Average session</div>
          </div>
          <div>
            <div className="text-2xl font-semibold">12‑day</div>
            <div className="text-sm text-muted-foreground mt-1">Median streak</div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container mx-auto px-4 py-10 md:py-12">
        <div className="text-center mb-6 md:mb-8">
          <h2 className="text-2xl md:text-3xl font-semibold">FAQs</h2>
          <p className="text-sm md:text-base text-muted-foreground mt-2">Quick answers about importing, music, and the assistant.</p>
        </div>
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>Can I listen to music in the background?</AccordionTrigger>
              <AccordionContent>
                Yes. Use the Ritual Music button to search YouTube and play audio while you read. The mini player persists across tabs and supports play/pause, next/prev, and volume.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>How do I import EPUB or PDF?</AccordionTrigger>
              <AccordionContent>
                Open the Library and click Add Book. You can upload TXT, EPUB, or PDF. Covers are generated automatically; PDFs render natively and EPUBs use a dedicated viewer.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>Does the assistant work offline?</AccordionTrigger>
              <AccordionContent>
                The assistant uses online models. On mobile, it opens in a bottom sheet so it never blocks your reading. You can pass the current page text as context.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Trust strip */}
      <section className="container mx-auto px-4 py-8">
        <div className="rounded-2xl border bg-card/40 p-6 grid md:grid-cols-3 gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><Shield className="w-4 h-4" /> Local-first. Your books stay on your device.</div>
          <div className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Clean, matte-black theme for long reads.</div>
          <div className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> Import EPUB, PDF, and TXT in seconds.</div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-10 md:py-12">
        <div className="rounded-3xl border bg-card/60 backdrop-blur p-8 text-center">
          <h3 className="text-2xl md:text-3xl font-semibold text-balance">Ready to build your reading ritual?</h3>
          <p className="text-muted-foreground mt-2">Sign in to start building your streak.</p>
          <Link to="/app">
            <Button className="mt-5 gap-2">Log In <ArrowRight className="w-4 h-4" /></Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-6 text-xs text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
        <div className="whitespace-nowrap">© {new Date().getFullYear()} Ritual Reader</div>
        <div className="flex items-center gap-3 flex-wrap">
          <a href="#features" className="hover:underline">Features</a>
          <Link to="/app" className="hover:underline">Log In</Link>
        </div>
      </footer>
    </div>
  );
};

export default Landing;



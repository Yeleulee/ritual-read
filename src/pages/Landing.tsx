import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Sparkles, Timer, Shield, Brain, ArrowRight } from "lucide-react";
import { SplineSceneBasic } from "@/components/ui/spline-demo";
import { GlowingEffectDemo } from "@/components/ui/glowing-effect-demo";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="container mx-auto px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-white ring-1 ring-border shadow-sm flex items-center justify-center">
            <img src="/logo.png" alt="Ritual Reader" className="w-full h-full object-contain p-1" />
          </div>
          <div className="text-lg font-semibold">Ritual Reader</div>
        </div>
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

      {/* Features section removed - now using the glowing grid above */}

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



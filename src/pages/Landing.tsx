import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/Wordmark";
import { ArrowRight, ArrowUpRight, Moon, Sun } from "lucide-react";
import { ReadingHero } from "@/components/landing/ReadingHero";

const features = [
  {
    n: "01",
    title: "A library that travels",
    body: "Drop in EPUB, PDF or plain text. Covers, progress and last-read position sync across devices, or stay entirely on-device — your call.",
    meta: "Import · Sync · Local-first",
  },
  {
    n: "02",
    title: "A reader that gets out of the way",
    body: "Typography you can tune, page turns that feel like paper, and a sepia mode built for long evenings. Nothing else on screen.",
    meta: "EPUB · PDF · Sepia",
  },
  {
    n: "03",
    title: "A streak worth keeping",
    body: "Set a daily minute goal. A quiet counter marks the days you showed up — no confetti, no guilt trips.",
    meta: "Goals · Streaks · Stats",
  },
  {
    n: "04",
    title: "An assistant in the margins",
    body: "Ask about a passage, get a summary of what you read yesterday, or argue with the author. Powered by Gemini, scoped to your book.",
    meta: "Summaries · Q&A · Context",
  },
];

const Landing = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="theme-paper min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-[2px] border-b border-border">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between">
          <Wordmark iconOnly />
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#hero" className="hover:text-foreground transition-colors">About</a>
            <a href="#features" className="hover:text-foreground transition-colors">Inside</a>
            <a href="#method" className="hover:text-foreground transition-colors">Method</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="h-9 w-9 rounded-full"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button asChild size="sm" variant="outline" className="rounded-full px-5">
              <Link to="/app">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <ReadingHero />

        <div className="mx-auto max-w-[1400px]">
        {/* Feature index */}
        <section id="features" className="px-4 sm:px-6 lg:px-10 py-20 md:py-28">
          <div className="grid md:grid-cols-12 gap-8 md:gap-6 mb-14">
            <p className="eyebrow md:col-span-3">02 — What's inside</p>
            <h2 className="display text-4xl sm:text-5xl md:col-span-9 max-w-3xl">
              Four things, done properly. <span className="text-muted-foreground">Nothing you have to manage.</span>
            </h2>
          </div>

          <ol className="border-t border-border">
            {features.map((f) => (
              <li
                key={f.n}
                className="group grid md:grid-cols-12 gap-4 md:gap-6 py-8 md:py-10 border-b border-border transition-colors hover:bg-card/60"
              >
                <span className="font-mono text-sm text-muted-foreground md:col-span-1">{f.n}</span>
                <h3 className="display text-2xl sm:text-3xl md:col-span-4">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed md:col-span-5 max-w-prose">{f.body}</p>
                <span className="eyebrow md:col-span-2 md:text-right self-start pt-1">{f.meta}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Method / statement */}
        <section id="method" className="border-y border-border">
          <div className="grid md:grid-cols-12">
            <div className="md:col-span-5 px-4 sm:px-6 lg:px-10 py-16 md:py-24 md:border-r border-border">
              <p className="eyebrow">03 — The method</p>
              <h2 className="display text-4xl sm:text-5xl mt-8">
                One book.<br />
                Twenty minutes.<br />
                <em className="italic text-muted-foreground">Every day.</em>
              </h2>
            </div>
            <div className="md:col-span-7 px-4 sm:px-6 lg:px-10 py-16 md:py-24 grid sm:grid-cols-2 gap-x-10 gap-y-12">
              {[
                ["Open", "Your library remembers where you were. Open the book, not a dashboard."],
                ["Read", "Full-screen. No chrome, no notifications. Turn pages, not tabs."],
                ["Mark", "A small counter records the session. The streak grows without asking."],
                ["Reflect", "Ask the assistant what you missed. Then close it and go to bed."],
              ].map(([k, v]) => (
                <div key={k} className="border-t border-border pt-5">
                  <h3 className="font-serif text-2xl">{k}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="px-4 sm:px-6 lg:px-10 py-24 md:py-32">
          <div className="grid md:grid-cols-12 gap-8 items-end">
            <h2 className="display text-5xl sm:text-6xl lg:text-7xl md:col-span-8">
              Build a reading ritual<br />
              <span className="text-muted-foreground">you'll actually keep.</span>
            </h2>
            <div className="md:col-span-4 flex flex-col items-start md:items-end gap-4">
              <Button asChild size="lg">
                <Link to="/app">
                  Start reading <ArrowRight />
                </Link>
              </Button>
              <p className="eyebrow">Free · No card · Books stay yours</p>
            </div>
          </div>
        </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-6 grid sm:grid-cols-3 gap-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <span>© {new Date().getFullYear()} Ritual Reader</span>
          <span className="sm:text-center">Made for slow reading</span>
          <span className="sm:text-right flex sm:justify-end gap-6">
            <a href="#features" className="hover:text-foreground transition-colors">Inside</a>
            <Link to="/app" className="hover:text-foreground transition-colors inline-flex items-center gap-1">
              Log in <ArrowUpRight className="w-3 h-3" />
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;



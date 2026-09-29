'use client'

import { SplineScene } from "@/components/ui/splite";
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"

export function SplineSceneBasic() {
  return (
    <section className="relative border-y border-border">
      <div className="grid md:grid-cols-12 min-h-[560px]">
        {/* Copy */}
        <div className="md:col-span-6 lg:col-span-5 flex flex-col justify-between px-4 sm:px-6 lg:px-10 py-10 md:py-14 md:border-r border-border">
          <p className="eyebrow">01 — A reading app, not a feed</p>

          <div className="mt-12 md:mt-0">
            <h1 className="display text-[2.75rem] sm:text-6xl lg:text-7xl text-foreground">
              Read like it <em className="italic text-muted-foreground">matters.</em>
            </h1>
            <p className="mt-6 max-w-md text-base md:text-lg leading-relaxed text-muted-foreground">
              Import your EPUBs and PDFs, sit down with one book at a time, and let the streak
              take care of the rest.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link to="/app">
                  Start reading <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="link" size="lg" className="px-2">
                <a href="#features">See what's inside</a>
              </Button>
            </div>
          </div>

          <dl className="mt-12 grid grid-cols-3 gap-4 border-t border-border pt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <div>
              <dt>Formats</dt>
              <dd className="mt-1 text-foreground">EPUB · PDF · TXT</dd>
            </div>
            <div>
              <dt>Storage</dt>
              <dd className="mt-1 text-foreground">Local-first</dd>
            </div>
            <div>
              <dt>Assistant</dt>
              <dd className="mt-1 text-foreground">Gemini</dd>
            </div>
          </dl>
        </div>

        {/* Scene */}
        <div className="md:col-span-6 lg:col-span-7 relative min-h-[320px] bg-[#0a0a0a]">
          <SplineScene
            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
            className="w-full h-full will-change-transform"
          />
          <span className="pointer-events-none absolute bottom-4 right-4 eyebrow">fig. 1 — the reading room</span>
        </div>
      </div>
    </section>
  )
}



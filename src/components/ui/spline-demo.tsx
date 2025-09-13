'use client'

import { SplineScene } from "@/components/ui/splite";
import { Card } from "@/components/ui/card"
import { Spotlight } from "@/components/ui/spotlight"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"
 
export function SplineSceneBasic() {
  return (
    <Card className="w-full h-[500px] bg-black/[0.96] relative overflow-hidden">
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
        fill="white"
      />
      
      <div className="flex h-full">
        {/* Left content */}
        <div className="flex-1 p-8 relative z-10 flex flex-col justify-center">
          <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
            Ritual Reader
          </h1>
          <p className="mt-4 text-neutral-300 max-w-lg">
            Transform reading into a mindful ritual. Import books, focus deeply, track streaks, 
            and get AI insights—all in a beautifully minimal experience.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/app">
              <Button className="gap-2">
                Get Started <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button variant="outline">See Features</Button>
            </a>
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 relative">
          <SplineScene 
            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
            className="w-full h-full"
          />
        </div>
      </div>
    </Card>
  )
}



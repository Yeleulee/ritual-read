'use client'

import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
const Spline = lazy(() => import('@splinetool/react-spline'))

interface SplineSceneProps {
  scene: string
  className?: string
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  const [reduced, setReduced] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    try {
      setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      // @ts-ignore
      mq.addEventListener?.('change', onChange)
      return () => {
        // @ts-ignore
        mq.removeEventListener?.('change', onChange)
      }
    } catch {}
  }, [])

  useEffect(() => {
    const update = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const shouldFallback = reduced

  if (shouldFallback) {
    return (
      <div className={className}>
        <div className="w-full h-full rounded-2xl border bg-gradient-to-br from-muted/60 to-background" />
      </div>
    )
  }

  return (
    <Suspense 
      fallback={
        <div className="w-full h-full flex items-center justify-center">
          <span className="loader"></span>
        </div>
      }
    >
      <Spline
        scene={scene}
        className={className}
      />
    </Suspense>
  )
}



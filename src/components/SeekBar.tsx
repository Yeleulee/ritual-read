import { useState } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

/** Touch-sized seek slider: 2px rule visually, 44px hit area, keyboard-operable. */
export function SeekBar({
  currentTime,
  duration,
  onSeek,
  className,
}: {
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  className?: string;
}) {
  const [dragValue, setDragValue] = useState<number | null>(null);
  const max = Math.max(1, Math.floor(duration || 0));
  const value = dragValue ?? Math.min(max, Math.floor(currentTime || 0));

  return (
    <SliderPrimitive.Root
      className={cn("group relative flex h-11 w-full touch-none select-none items-center", className)}
      value={[value]}
      min={0}
      max={max}
      step={1}
      disabled={!duration}
      onValueChange={(v) => setDragValue(v[0])}
      onValueCommit={(v) => {
        setDragValue(null);
        onSeek(v[0]);
      }}
      aria-label="Seek"
    >
      <SliderPrimitive.Track className="relative h-[2px] w-full grow overflow-hidden bg-border">
        <SliderPrimitive.Range className="absolute h-full bg-foreground" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border border-foreground bg-background opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 [@media(pointer:coarse)]:opacity-100" />
    </SliderPrimitive.Root>
  );
}

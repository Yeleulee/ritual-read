import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string; // container sizing, e.g. w-16 h-16
  imgClassName?: string; // image sizing, defaults to fill container
  alt?: string;
  priority?: boolean; // mark as high priority (header logos)
  withAura?: boolean; // add a subtle gradient halo behind for better contrast
}

export const Logo = ({ className, imgClassName, alt = "Ritual Reader", priority = true, withAura = true }: LogoProps) => {
  return (
    <div className={cn("relative flex items-center justify-center group text-foreground", className)}>
      {withAura && (
        <div
          aria-hidden
          className={
            // Soft radial halo that adapts to theme; intensifies on parent .group hover
            "absolute inset-0 rounded-full -z-10 pointer-events-none opacity-35 group-hover:opacity-60 transition-opacity " +
            "bg-[radial-gradient(ellipse_at_center,theme(colors.primary/30),transparent_60%)] blur-[6px]"
          }
        />
      )}
      {/* Prefer mask rendering to avoid any white background in source asset */}
      <div
        aria-hidden
        className="w-full h-full"
        style={{
          backgroundColor: 'currentColor',
          // @ts-ignore vendor
          WebkitMaskImage: "url('/new-logo.png')",
          maskImage: "url('/new-logo.png')",
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          // Prefer luminance if alpha has a solid background
          // @ts-ignore
          maskMode: 'luminance',
        } as any}
      />
      {/* Fallback img if mask is not supported */}
      <img
        src="/new-logo.png"
        alt={alt}
        className={cn(
          "object-contain w-full h-full select-none " +
          "drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)] group-hover:drop-shadow-[0_0_10px_rgba(59,130,246,0.35)] transition-all",
          imgClassName
          , "hidden")}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchpriority={priority ? ("high" as any) : ("auto" as any)}
        width={80}
        height={80}
        sizes="(min-width: 768px) 80px, (min-width: 640px) 64px, 56px"
        draggable={false}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = "/new-logo.png";
        }}
      />
    </div>
  );
};



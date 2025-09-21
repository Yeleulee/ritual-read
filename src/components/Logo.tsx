import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string; // container sizing, e.g. w-16 h-16
  imgClassName?: string; // image sizing, defaults to fill container
  alt?: string;
}

export const Logo = ({ className, imgClassName, alt = "Ritual Reader" }: LogoProps) => {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <img
        src="/image.png"
        alt={alt}
        className={cn(
          "object-contain w-full h-full drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)] select-none",
          imgClassName
        )}
        loading="eager"
        decoding="async"
        draggable={false}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = "/logo.png";
        }}
      />
    </div>
  );
};



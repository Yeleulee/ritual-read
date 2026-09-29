import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";

interface WordmarkProps {
  to?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  iconOnly?: boolean;
}

const sizes = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-3xl",
};

export const Wordmark = ({ to = "/", className, size = "md", iconOnly = false }: WordmarkProps) => (
  <Link to={to} aria-label="Ritual Reader — home" className={cn("inline-flex items-baseline gap-2 group", className)}>
    <Logo label="" className={cn("self-center text-foreground", iconOnly ? "text-3xl" : sizes[size])} />
    {!iconOnly && (
      <>
        <span className={cn("font-serif italic leading-none tracking-[-0.02em] text-foreground", sizes[size])}>Ritual</span>
        <span className="eyebrow group-hover:text-foreground transition-colors">Reader</span>
      </>
    )}
  </Link>
);

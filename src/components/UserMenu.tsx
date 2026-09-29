import { Link } from "react-router-dom";
import { BookOpen, Home, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getFirstName, getInitial } from "@/lib/user";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  /** "app" shows a Home link; "landing" shows a Library link. */
  context?: "app" | "landing";
  className?: string;
}

/** Signed-in indicator: a circle with the user's first initial that opens a small account menu. */
export const UserMenu = ({ context = "app", className }: UserMenuProps) => {
  const { user, signOut } = useAuth();
  if (!user) return null;

  const firstName = getFirstName(user);
  const initial = getInitial(user);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account: ${firstName || user.email}`}
          title={firstName ? `Signed in as ${firstName}` : "Account"}
          className={cn(
            "grid h-9 w-9 place-items-center rounded-full bg-foreground text-background",
            "font-serif text-lg leading-none select-none",
            "ring-offset-background transition-opacity hover:opacity-85",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className,
          )}
        >
          <span aria-hidden className="translate-y-[0.5px]">{initial}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="eyebrow">Signed in as</p>
          <p className="mt-1 font-serif text-base leading-tight">{firstName || "Reader"}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {context === "landing" ? (
          <DropdownMenuItem asChild>
            <Link to="/app" className="cursor-pointer">
              <BookOpen className="mr-2 h-4 w-4" />
              Open library
            </Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild>
            <Link to="/" className="cursor-pointer">
              <Home className="mr-2 h-4 w-4" />
              Home
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => void signOut()} className="cursor-pointer text-muted-foreground focus:text-foreground">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

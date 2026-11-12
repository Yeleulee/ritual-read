import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Home, LogOut, GraduationCap, User, Flame, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getFirstName, getInitial } from "@/lib/user";
import { getPracticeStreak } from "@/lib/practice-storage";
import { PracticeHeatmap } from "@/components/practice/PracticeHeatmap";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const [profileOpen, setProfileOpen] = useState(false);

  if (!user) return null;

  const firstName = getFirstName(user);
  const initial = getInitial(user);
  const streak = getPracticeStreak();

  return (
    <>
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
        <DropdownMenuContent align="end" sideOffset={8} className="w-64">
          <DropdownMenuLabel className="font-normal">
            <p className="eyebrow">Signed in as</p>
            <p className="mt-1 font-serif text-base leading-tight">{firstName || "Reader"}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {/* Quick Profile & Activity Link */}
          <DropdownMenuItem onSelect={() => setProfileOpen(true)} className="cursor-pointer">
            <User className="mr-2 h-4 w-4 text-primary" />
            <span>Profile & Study Tracker</span>
          </DropdownMenuItem>

          {/* Practice Activity Mini Stats */}
          <div className="px-2 py-2">
            <div className="flex items-center gap-1.5 mb-2">
              <GraduationCap className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Practice Activity</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="flex flex-col items-center gap-0.5 flex-1 bg-muted/40 rounded-lg py-1.5">
                <span className="font-mono font-semibold text-foreground tabular-nums text-sm">{streak.current}</span>
                <span className="text-[10px] text-muted-foreground">Day Streak</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 flex-1 bg-muted/40 rounded-lg py-1.5">
                <span className="font-mono font-semibold text-foreground tabular-nums text-sm">{streak.longest}</span>
                <span className="text-[10px] text-muted-foreground">Longest</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 flex-1 bg-muted/40 rounded-lg py-1.5">
                <span className="font-mono font-semibold text-foreground tabular-nums text-sm">{streak.totalDays}</span>
                <span className="text-[10px] text-muted-foreground">Active Days</span>
              </div>
            </div>
          </div>

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

      {/* User Profile & GitHub-style Study Streak Modal */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-6">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px] uppercase">
                Student Profile
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-mono">
                Active Learner
              </Badge>
            </div>
            <DialogTitle className="text-2xl font-serif mt-1 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-foreground text-background flex items-center justify-center font-serif text-xl font-normal shrink-0">
                {initial}
              </div>
              <div>
                <p>{firstName || "Ritual Scholar"}</p>
                <p className="text-xs font-mono font-normal text-muted-foreground mt-0.5">{user.email}</p>
              </div>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Your overall learning discipline, question practice streak, and revision history.
            </DialogDescription>
          </DialogHeader>

          {/* GitHub-style practice questions activity heatmap */}
          <div className="space-y-3 border rounded-xl p-4 bg-card/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-serif font-medium">Practice Questions Streak</h4>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">GitHub Commit Style</span>
            </div>
            <PracticeHeatmap weeks={18} />
          </div>

          {/* Practice Summary Cards */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="border rounded-xl p-3 bg-muted/20">
              <span className="font-mono text-2xl font-light text-foreground">{streak.current}</span>
              <p className="text-[11px] font-mono uppercase text-muted-foreground mt-1">Current Streak</p>
            </div>
            <div className="border rounded-xl p-3 bg-muted/20">
              <span className="font-mono text-2xl font-light text-foreground">{streak.longest}</span>
              <p className="text-[11px] font-mono uppercase text-muted-foreground mt-1">Best Streak</p>
            </div>
            <div className="border rounded-xl p-3 bg-muted/20">
              <span className="font-mono text-2xl font-light text-foreground">{streak.totalDays}</span>
              <p className="text-[11px] font-mono uppercase text-muted-foreground mt-1">Days Practiced</p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setProfileOpen(false)} className="rounded-full px-5 text-xs">
              Close Profile
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Flame, Calendar, Trophy, Target, Star } from "lucide-react";
import { useReadingStats } from "@/hooks/use-reading-stats";

interface StreakTrackerProps {
  detailed?: boolean;
}

export const StreakTracker = ({ detailed = false }: StreakTrackerProps) => {
  const { state, current, weekly, setGoalMinutes } = useReadingStats();

  const badges = useMemo(() => ([
    { id: 1, name: "First Steps", description: "Read for 1 day", earned: current.currentStreak >= 1, icon: "🌱" },
    { id: 2, name: "Week Warrior", description: "7-day streak", earned: current.currentStreak >= 7, icon: "⚡" },
    { id: 3, name: "Consistency Champ", description: "14-day streak", earned: current.currentStreak >= 14, icon: "🏅" },
    { id: 4, name: "Month Master", description: "30-day streak", earned: current.currentStreak >= 30, icon: "🏆" },
  ]), [current.currentStreak]);

  if (!detailed) {
    const minutesRead = Math.floor((current.todayProgress / 100) * state.goalMinutesPerDay);
    const minutesLeft = Math.max(0, state.goalMinutesPerDay - minutesRead);
    return (
      <Card className="w-fit border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500/20 to-yellow-400/20 flex items-center justify-center">
              <Flame className="w-5 h-5 text-streak" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-none">{current.currentStreak} day streak</div>
              <div className="mt-1 w-28">
                <Progress value={current.todayProgress} className="h-1" />
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground truncate">
                {minutesLeft > 0 ? `Read ${minutesLeft} min today to keep it 🔥` : 'Goal met — keep going!'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Streak Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="ritual-glow animate-page-fade">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 gradient-secondary rounded-full flex items-center justify-center mx-auto mb-4 animate-streak-pulse">
              <Flame className="w-8 h-8 text-streak-foreground" />
            </div>
            <div className="text-3xl font-bold text-streak mb-2">{current.currentStreak}</div>
            <div className="text-sm text-muted-foreground">Current Streak</div>
          </CardContent>
        </Card>

        <Card className="animate-page-fade">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-secondary" />
            </div>
            <div className="text-3xl font-bold mb-2">{state.longestStreak}</div>
            <div className="text-sm text-muted-foreground">Longest Streak</div>
          </CardContent>
        </Card>

        <Card className="animate-page-fade">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-focus" />
            </div>
            <div className="text-3xl font-bold mb-2">{current.todayProgress}%</div>
            <div className="text-sm text-muted-foreground">Today's Goal</div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Progress */}
      <Card className="animate-page-fade">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Today's Reading Goal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{state.goalMinutesPerDay} minutes daily goal</span>
            <span className="font-medium">{Math.floor((current.todayProgress / 100) * state.goalMinutesPerDay)} min read</span>
          </div>
          <Progress value={current.todayProgress} className="h-3" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Adjust goal:</span>
            <div className="flex gap-1">
              {[10,20,30,45,60].map(m => (
                <Button key={m} size="sm" variant="outline" onClick={() => setGoalMinutes(m)}>{m}m</Button>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Keep going! You're {Math.max(0, 100 - current.todayProgress)}% away from maintaining your streak.
          </p>
        </CardContent>
      </Card>

      {/* Weekly Calendar */}
      <Card className="animate-page-fade">
        <CardHeader>
          <CardTitle className="ritual-heading">This Week's Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-3">
            {weekly.map((day, index) => (
              <div key={index} className="text-center">
                <div className="text-xs text-muted-foreground mb-2">{day.day}</div>
                <div 
                  className={`w-12 h-12 rounded-lg flex items-center justify-center text-sm font-medium transition-ritual ${
                    day.read 
                      ? 'gradient-secondary text-secondary-foreground achievement-glow' 
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {day.read ? day.minutes : '—'}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card className="animate-page-fade">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-secondary" />
            Reading Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {badges.map((badge) => (
              <div 
                key={badge.id} 
                className={`p-4 rounded-lg border transition-ritual ${
                  badge.earned 
                    ? 'bg-secondary/10 border-secondary/20 animate-achievement-bounce' 
                    : 'bg-muted/50 border-border'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">{badge.icon}</div>
                  <div className="flex-1">
                    <div className={`font-medium ${badge.earned ? 'text-secondary' : 'text-muted-foreground'}`}>
                      {badge.name}
                    </div>
                    <div className="text-sm text-muted-foreground">{badge.description}</div>
                  </div>
                  {badge.earned && (
                    <Badge className="gradient-secondary">
                      Earned
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Motivation */}
      <Card className="gradient-primary text-primary-foreground animate-page-fade">
        <CardContent className="p-6 text-center">
          <Flame className="w-12 h-12 mx-auto mb-4 animate-ritual-glow" />
          <h3 className="text-xl font-bold mb-2">You're on fire! 🔥</h3>
          <p className="text-primary-foreground/90">
            {current.currentStreak >= 7 
              ? `Amazing! You've been reading consistently for ${current.currentStreak} days. Keep the momentum going!`
              : `You're doing great! Just ${Math.max(0, 7 - current.currentStreak)} more days to unlock the Week Warrior badge.`
            }
          </p>
        </CardContent>
      </Card>
    </div>
  );
};